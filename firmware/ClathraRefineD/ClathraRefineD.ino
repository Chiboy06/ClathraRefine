/**
 * ClathraRefine Industrial Firmware, Revision D.3 (D.2 plus manual relay control)
 * D.3 adds the dashboard commands mode, fan and pump. The board checks its own interlocks on every
 * command and answers on cmd/ack with accepted and a reason when refused:
 *   - manual mode is refused while exhaust gas is active, a trip or lockout is latched, a sensor is faulty or during warm-up;
 *   - in manual mode the fan must run before the pump starts, and the pump must stop before the fan;
 *   - exhaust gas, a trip, SCRAM, lockout, a sensor fault or 10 minutes without a command return the board to automatic.
 * Lamps and siren stay under automatic safety control.
 * Target: ESP32-S3-WROOM-1-N16R8 (16MB Flash, 8MB Octal PSRAM)
 * Core Framework: Arduino-ESP32 3.x / ESP-IDF 5.x
 * Dependencies: MQTT (Joel Gaehwiler), ArduinoJson 7.x
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <MQTT.h>
#include <ArduinoJson.h>
#include <sys/time.h>
#include <time.h>
#include <atomic>
#include "esp_task_wdt.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "secrets.h"

// ---------------- Hardware Pin Assignments ----------------
static constexpr uint8_t PIN_MQ2_EXHAUST = 1;   // ADC1_CH0
static constexpr uint8_t PIN_MQ2_AMBIENT = 2;   // ADC1_CH1
static constexpr uint8_t PIN_MQ135_CO2   = 5;   // ADC1_CH4

static constexpr uint8_t RELAY_1_INTAKE  = 6;   // Extraction ID Fan
static constexpr uint8_t RELAY_2_PUMP_1  = 12;  // Primary Scrubber Pump (Continuous)
static constexpr uint8_t RELAY_PUMP_2    = 7;   // Secondary Reagent Pump (19s timer)
static constexpr uint8_t RELAY_3_RED     = 8;   // Red Alarm Beacon
static constexpr uint8_t RELAY_4_GREEN   = 9;   // Green Status Lamp
static constexpr uint8_t RELAY_6_SIREN   = 10;  // Acoustic Annunciator / Siren

static const uint8_t RELAY_PINS[6] = {
  RELAY_1_INTAKE, RELAY_2_PUMP_1, RELAY_PUMP_2, RELAY_3_RED, RELAY_4_GREEN, RELAY_6_SIREN
};
static constexpr uint8_t RELAY_ACTIVE_LEVEL   = LOW;
static constexpr uint8_t RELAY_INACTIVE_LEVEL = HIGH;

// ---------------- Thresholds ----------------
static constexpr uint16_t EXH_DELTA_TRIGGER_MV  = 200;  
static constexpr uint16_t AMB_DELTA_WARN_MV     = 150;  
static constexpr uint16_t AMB_DELTA_CRIT_MV     = 300;  
static constexpr uint16_t TOXIC_DELTA_WARN_MV   = 150;  
static constexpr uint16_t TOXIC_DELTA_CRIT_MV   = 300;  
static constexpr uint16_t HARD_CEILING_MV       = 3120; 

// ---------------- Timing Parameters ----------------
static constexpr uint32_t SAMPLE_PERIOD_MS     = 100;
static constexpr uint8_t  OVERSAMPLES          = 16;
static constexpr uint32_t PUMP_STAGGER_MS      = 2000;
static constexpr uint32_t PUMP_2_RUNTIME_MS    = 19000;   
static constexpr uint32_t WARMUP_MS            = 30000;   
static constexpr uint32_t SENSOR_TIMEOUT_MS    = 1000;
static constexpr uint32_t LOCKOUT_TIMEOUT_MS   = 300000;  
static constexpr uint32_t TELEMETRY_PERIOD_MS  = 2000;
static constexpr uint32_t WDT_TIMEOUT_MS       = 3000;
static constexpr uint32_t MANUAL_IDLE_MS       = 600000;  // manual mode returns to automatic after 10 min without a command

// ---------------- Types & Shared State ----------------
enum class ScrubberState : uint8_t { IDLE, INTAKE_ACTIVE, SCRUBBING };
enum class AlarmLevel    : uint8_t { NORMAL, WARNING, CRITICAL };

struct SensorTelemetry_t {
  uint16_t exhaustMv;
  uint16_t ambientMv;
  uint16_t co2Mv;
  uint16_t exhaustDelta;
  uint16_t ambientDelta;
  uint16_t co2Delta;
  uint32_t uptimeMs;
};

struct PlantStatus_t {
  uint16_t exhaustMv = 0;
  uint16_t ambientMv = 0;
  uint16_t co2Mv     = 0;
  uint16_t baseExh   = 0;
  uint16_t baseAmb   = 0;
  uint16_t baseCo2   = 0;
  ScrubberState scrubber = ScrubberState::IDLE;
  AlarmLevel level = AlarmLevel::NORMAL;
  bool tripLatched   = false;
  bool sirenSilenced = false;
  bool warmingUp     = true;
  bool scram         = false;
  bool lockout       = false;
  bool sensorFault   = false;
  uint8_t relayMask  = 0;   
  bool manual        = false;
};

struct BufferedRecord_t {
  uint64_t epochMs;
  uint32_t uptimeMs;
  uint16_t exhaustMv;
  uint16_t ambientMv;
  uint16_t co2Mv;
  uint16_t exhaustDelta;
  uint16_t ambientDelta;
  uint16_t co2Delta;
  uint8_t  level;
  uint8_t  scrubber;
  uint8_t  flags;      
  uint8_t  relayMask;
};

static PlantStatus_t gStatus;
static portMUX_TYPE gMux = portMUX_INITIALIZER_UNLOCKED;

// Cross-core atomic command signals
static std::atomic<bool> gScramRequest{false};
static std::atomic<bool> gResetRequest{false};
static std::atomic<bool> gStopRequest{false};
static std::atomic<bool> gSilenceRequest{false};
static std::atomic<uint8_t> gChirpPulses{0};

static QueueHandle_t qExhaust = nullptr;
static QueueHandle_t qAmbient = nullptr;

// Commands from the dashboard go to the control task; every command gets one acknowledgement back.
struct Command_t { char cmd[12]; char value[8]; };
struct Ack_t { char cmd[12]; char value[8]; bool accepted; char reason[72]; };
static QueueHandle_t qCmd = nullptr;
static QueueHandle_t qAck = nullptr;

static void sendAck(const char *cmd, const char *value, bool accepted, const char *reason) {
  Ack_t a{};
  strncpy(a.cmd, cmd, sizeof(a.cmd) - 1);
  strncpy(a.value, value, sizeof(a.value) - 1);
  a.accepted = accepted;
  strncpy(a.reason, reason, sizeof(a.reason) - 1);
  xQueueSend(qAck, &a, 0);
}

// ---------------- Hardware Drivers (Core 1) ----------------
static void setRelay(uint8_t pin, bool on) {
  digitalWrite(pin, on ? RELAY_ACTIVE_LEVEL : RELAY_INACTIVE_LEVEL);
  for (uint8_t i = 0; i < 6; ++i) {
    if (RELAY_PINS[i] == pin) {
      portENTER_CRITICAL(&gMux);
      if (on) gStatus.relayMask |= (1u << i);
      else    gStatus.relayMask &= ~(1u << i);
      portEXIT_CRITICAL(&gMux);
      break;
    }
  }
}

static void initSafeRelayPin(uint8_t pin) {
  digitalWrite(pin, RELAY_INACTIVE_LEVEL);
  pinMode(pin, OUTPUT);
  digitalWrite(pin, RELAY_INACTIVE_LEVEL);
}

static inline bool inWarmup() {
  static bool warmedUp = false;
  if (!warmedUp && millis() >= WARMUP_MS) warmedUp = true;
  return !warmedUp;
}

static uint16_t readSensorMv(uint8_t pin) {
  uint32_t sum = 0;
  for (uint8_t i = 0; i < OVERSAMPLES; ++i) {
    sum += analogReadMilliVolts(pin);
  }
  return static_cast<uint16_t>(sum / OVERSAMPLES);
}

// ---------------- Core 1: Sensor Acquisition ----------------
static void Task_SensorAcquisition(void *) {
  esp_task_wdt_add(nullptr);
  TickType_t last = xTaskGetTickCount();

  uint32_t sumExh = 0, sumAmb = 0, sumCo2 = 0, calibSamples = 0;
  uint16_t baseExh = 0, baseAmb = 0, baseCo2 = 0;
  bool calibrated = false;

  for (;;) {
    uint32_t nowMs = millis();
    uint16_t exh = readSensorMv(PIN_MQ2_EXHAUST);
    uint16_t amb = readSensorMv(PIN_MQ2_AMBIENT);
    uint16_t co2 = readSensorMv(PIN_MQ135_CO2);

    if (nowMs > (WARMUP_MS > 5000 ? WARMUP_MS - 5000 : 0) && nowMs <= WARMUP_MS) {
      sumExh += exh; sumAmb += amb; sumCo2 += co2;
      calibSamples++;
    } else if (nowMs > WARMUP_MS && !calibrated) {
      baseExh = calibSamples > 0 ? (sumExh / calibSamples) : exh;
      baseAmb = calibSamples > 0 ? (sumAmb / calibSamples) : amb;
      baseCo2 = calibSamples > 0 ? (sumCo2 / calibSamples) : co2;
      calibrated = true;
      Serial.printf("\n[CALIB] Baselines: EXH=%u mV | AMB=%u mV | TOXIC=%u mV\n\n", baseExh, baseAmb, baseCo2);
    }

    uint16_t dExh = (calibrated && exh > baseExh) ? (exh - baseExh) : 0;
    uint16_t dAmb = (calibrated && amb > baseAmb) ? (amb - baseAmb) : 0;
    uint16_t dCo2 = (calibrated && co2 > baseCo2) ? (co2 - baseCo2) : 0;

    SensorTelemetry_t t{exh, amb, co2, dExh, dAmb, dCo2, nowMs};
    xQueueOverwrite(qExhaust, &t);
    xQueueOverwrite(qAmbient, &t);

    portENTER_CRITICAL(&gMux);
    gStatus.exhaustMv = exh;
    gStatus.ambientMv = amb;
    gStatus.co2Mv     = co2;
    gStatus.baseExh   = baseExh;
    gStatus.baseAmb   = baseAmb;
    gStatus.baseCo2   = baseCo2;
    gStatus.warmingUp = inWarmup();
    portEXIT_CRITICAL(&gMux);

    esp_task_wdt_reset();
    vTaskDelayUntil(&last, pdMS_TO_TICKS(SAMPLE_PERIOD_MS));
  }
}

// ---------------- Core 1: Exhaust & Dual-Pump Control ----------------
static void Task_ExhaustControl(void *) {
  esp_task_wdt_add(nullptr);
  ScrubberState state = ScrubberState::IDLE;
  TickType_t intakeStart = 0, pump2Start = 0;
  bool latchedActive = false, pump2Running = false;
  bool manual = false, manFan = false, manPump = false;
  uint32_t lastManualCmd = 0;
  SensorTelemetry_t rx;

  for (;;) {
    esp_task_wdt_reset();
    if (xQueueReceive(qExhaust, &rx, pdMS_TO_TICKS(500)) != pdTRUE) continue;

    bool emergency, lockout, fault;
    portENTER_CRITICAL(&gMux);
    emergency = gStatus.scram || gStatus.tripLatched;
    lockout   = gStatus.lockout;
    fault     = gStatus.sensorFault;
    portEXIT_CRITICAL(&gMux);

    // Dashboard commands, checked against this board's own interlocks.
    Command_t c;
    while (xQueueReceive(qCmd, &c, 0) == pdTRUE) {
      const bool on = strcmp(c.value, "on") == 0;
      if (strcmp(c.cmd, "mode") == 0) {
        if (strcmp(c.value, "auto") == 0) {
          manual = false;
          sendAck(c.cmd, c.value, true, "");
        } else if (latchedActive) sendAck(c.cmd, c.value, false, "Exhaust gas active: automatic control required");
        else if (emergency || lockout) sendAck(c.cmd, c.value, false, "Trip latched: reset at the board first");
        else if (fault) sendAck(c.cmd, c.value, false, "Sensor fault: automatic control required");
        else if (inWarmup()) sendAck(c.cmd, c.value, false, "Sensors warming up");
        else {
          manual = true;
          manFan = manPump = false;
          lastManualCmd = millis();
          sendAck(c.cmd, c.value, true, "");
        }
      } else if (!manual) {
        sendAck(c.cmd, c.value, false, "Switch to manual mode first");
      } else if (strcmp(c.cmd, "fan") == 0) {
        if (!on && manPump) sendAck(c.cmd, c.value, false, "Stop the pump before the fan");
        else {
          manFan = on;
          lastManualCmd = millis();
          sendAck(c.cmd, c.value, true, "");
        }
      } else if (strcmp(c.cmd, "pump") == 0) {
        if (on && !manFan) sendAck(c.cmd, c.value, false, "Start the fan before the pump");
        else {
          manPump = on;
          lastManualCmd = millis();
          sendAck(c.cmd, c.value, true, "");
        }
      }
    }

    // Safety always wins: any hazard or fault, or 10 minutes idle, hands control back to automatic.
    if (manual && (emergency || lockout || fault || gStopRequest.load(std::memory_order_relaxed) || rx.exhaustDelta >= EXH_DELTA_TRIGGER_MV || rx.exhaustMv >= HARD_CEILING_MV ||
                   millis() - lastManualCmd >= MANUAL_IDLE_MS)) {
      manual = false;
      setRelay(RELAY_2_PUMP_1, false);
      setRelay(RELAY_PUMP_2,   false);
      if (!emergency) setRelay(RELAY_1_INTAKE, false);
    }

    if (manual) {
      setRelay(RELAY_1_INTAKE, manFan);
      setRelay(RELAY_2_PUMP_1, manPump);
      setRelay(RELAY_PUMP_2,   false);
      state = manPump ? ScrubberState::SCRUBBING : (manFan ? ScrubberState::INTAKE_ACTIVE : ScrubberState::IDLE);
      portENTER_CRITICAL(&gMux);
      gStatus.scrubber = state;
      gStatus.manual   = true;
      portEXIT_CRITICAL(&gMux);
      continue;
    }

    if (gStopRequest.exchange(false, std::memory_order_relaxed)) {
      setRelay(RELAY_2_PUMP_1, false);
      setRelay(RELAY_PUMP_2,   false);
      setRelay(RELAY_1_INTAKE, false);
      state = ScrubberState::IDLE;
      latchedActive = false;
      pump2Running  = false;
    }

    if (lockout) {
      setRelay(RELAY_2_PUMP_1, false);
      setRelay(RELAY_PUMP_2,   false);
      setRelay(RELAY_1_INTAKE, false);
      state = ScrubberState::IDLE;
      latchedActive = false;
      pump2Running  = false;
    } else if (emergency) {
      setRelay(RELAY_2_PUMP_1, false);
      setRelay(RELAY_PUMP_2,   false);
      setRelay(RELAY_1_INTAKE, true);
      pump2Running = false;
    } else {
      if (!latchedActive && !inWarmup()) {
        if (rx.exhaustDelta >= EXH_DELTA_TRIGGER_MV || rx.exhaustMv >= HARD_CEILING_MV) {
          latchedActive = true;
          gChirpPulses.store(4, std::memory_order_relaxed);
        }
      }

      TickType_t now = xTaskGetTickCount();
      if (latchedActive) {
        switch (state) {
          case ScrubberState::IDLE:
            setRelay(RELAY_1_INTAKE, true);
            setRelay(RELAY_2_PUMP_1, false);
            setRelay(RELAY_PUMP_2,   false);
            intakeStart = now;
            state = ScrubberState::INTAKE_ACTIVE;
            break;

          case ScrubberState::INTAKE_ACTIVE:
            if ((now - intakeStart) >= pdMS_TO_TICKS(PUMP_STAGGER_MS)) {
              setRelay(RELAY_2_PUMP_1, true);
              setRelay(RELAY_PUMP_2,   true);
              pump2Start   = now;
              pump2Running = true;
              state = ScrubberState::SCRUBBING;
            }
            break;

          case ScrubberState::SCRUBBING:
            setRelay(RELAY_1_INTAKE, true);
            setRelay(RELAY_2_PUMP_1, true);

            if (pump2Running) {
              if ((now - pump2Start) >= pdMS_TO_TICKS(PUMP_2_RUNTIME_MS)) {
                setRelay(RELAY_PUMP_2, false);
                pump2Running = false;
              } else {
                setRelay(RELAY_PUMP_2, true);
              }
            } else {
              setRelay(RELAY_PUMP_2, false);
            }
            break;
        }
      }
    }

    portENTER_CRITICAL(&gMux);
    gStatus.scrubber = state;
    gStatus.manual   = false;
    portEXIT_CRITICAL(&gMux);
  }
}

// ---------------- Core 1: Multi-Gas Safety & Lockout ----------------
static void Task_HazardSafety(void *) {
  esp_task_wdt_add(nullptr);
  AlarmLevel level = AlarmLevel::NORMAL;
  bool tripLatched = false, sirenSilenced = false, scram = false, lockout = false;
  uint32_t lastData = millis(), tripTime = 0;
  SensorTelemetry_t rx;

  for (;;) {
    esp_task_wdt_reset();
    bool fresh = (xQueueReceive(qAmbient, &rx, pdMS_TO_TICKS(200)) == pdTRUE);
    uint32_t nowMs = millis();
    if (fresh) lastData = nowMs;
    bool sensorFault = (nowMs - lastData) > SENSOR_TIMEOUT_MS;

    if (gScramRequest.exchange(false, std::memory_order_relaxed)) {
      scram = true;
      tripLatched = true;
      sirenSilenced = false;
      tripTime = nowMs;
    }
    if (gSilenceRequest.exchange(false, std::memory_order_relaxed)) {
      sirenSilenced = true;
    }
    bool cloudReset = gResetRequest.exchange(false, std::memory_order_relaxed);

    if (fresh && !inWarmup()) {
      bool isCrit = (rx.ambientDelta >= AMB_DELTA_CRIT_MV) ||
                    (rx.co2Delta >= TOXIC_DELTA_CRIT_MV) ||
                    (rx.ambientMv >= HARD_CEILING_MV) ||
                    (rx.co2Mv >= HARD_CEILING_MV);
      bool isWarn = (rx.ambientDelta >= AMB_DELTA_WARN_MV) ||
                    (rx.co2Delta >= TOXIC_DELTA_WARN_MV);
      bool isClean = (rx.ambientDelta < AMB_DELTA_WARN_MV - 80) &&
                     (rx.co2Delta < TOXIC_DELTA_WARN_MV - 80);

      if (isCrit) level = AlarmLevel::CRITICAL;
      else if (isWarn && level != AlarmLevel::CRITICAL) level = AlarmLevel::WARNING;
      else if (isClean) level = AlarmLevel::NORMAL;
    }

    if (level == AlarmLevel::CRITICAL || sensorFault || scram) {
      if (!tripLatched) {
        tripLatched = true;
        tripTime = nowMs;
        sirenSilenced = false;
      }
    }

    if (tripLatched && !lockout) {
      if (nowMs - tripTime >= LOCKOUT_TIMEOUT_MS) lockout = true;
    }

    if (cloudReset) {
      if (level == AlarmLevel::NORMAL && !sensorFault) {
        scram = false;
        tripLatched = false;
        lockout = false;
        sirenSilenced = false;
      }
    }

    uint8_t chirps = gChirpPulses.load(std::memory_order_relaxed);
    bool chirpActive = false;
    if (chirps > 0 && !tripLatched && !inWarmup()) {
      chirpActive = (chirps % 2 == 0);
      gChirpPulses.store(chirps - 1, std::memory_order_relaxed);
    }

    if (inWarmup()) {
      setRelay(RELAY_4_GREEN, false);
      setRelay(RELAY_3_RED,   false);
      setRelay(RELAY_6_SIREN, false);
    } else if (lockout) {
      setRelay(RELAY_4_GREEN, false);
      setRelay(RELAY_3_RED,   true);
      setRelay(RELAY_6_SIREN, false);
    } else if (tripLatched) {
      setRelay(RELAY_4_GREEN, false);
      setRelay(RELAY_3_RED,   true);
      setRelay(RELAY_6_SIREN, !sirenSilenced);
    } else if (level == AlarmLevel::WARNING) {
      setRelay(RELAY_4_GREEN, false);
      setRelay(RELAY_3_RED,   false);
      setRelay(RELAY_6_SIREN, false);
    } else {
      setRelay(RELAY_3_RED,   false);
      setRelay(RELAY_6_SIREN, chirpActive);
      setRelay(RELAY_4_GREEN, true);
    }

    portENTER_CRITICAL(&gMux);
    gStatus.level         = level;
    gStatus.tripLatched   = tripLatched;
    gStatus.sirenSilenced = sirenSilenced;
    gStatus.scram         = scram;
    gStatus.lockout       = lockout;
    gStatus.sensorFault   = sensorFault;
    portEXIT_CRITICAL(&gMux);
  }
}

// ---------------- Core 0: Hardened Network Engine ----------------
static WiFiClientSecure net;
static MQTTClient mqtt(2048); // Scaled buffer size for full JSON telemetry payloads
static String topicTelemetry, topicEvents, topicCmd, topicAck;

static constexpr size_t BUFFER_LEN = 4096;
static BufferedRecord_t *ring = nullptr;
static size_t ringHead = 0, ringCount = 0;

static void bufferPush(const BufferedRecord_t &r) {
  if (!ring) return;
  ring[(ringHead + ringCount) % BUFFER_LEN] = r;
  if (ringCount < BUFFER_LEN) ringCount++;
  else ringHead = (ringHead + 1) % BUFFER_LEN;
}

static uint64_t epochMs() {
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  if (tv.tv_sec < 1700000000) return 0;
  return static_cast<uint64_t>(tv.tv_sec) * 1000ULL + tv.tv_usec / 1000ULL;
}

static const char *levelName(uint8_t l) {
  return l == 2 ? "CRITICAL" : (l == 1 ? "WARNING" : "NORMAL");
}

static const char *scrubberName(uint8_t s) {
  static const char *names[] = {"IDLE", "INTAKE_ACTIVE", "SCRUBBING"};
  return names[s & 3];
}

static BufferedRecord_t snapshot() {
  PlantStatus_t s;
  portENTER_CRITICAL(&gMux);
  s = gStatus;
  portEXIT_CRITICAL(&gMux);

  BufferedRecord_t r;
  r.epochMs      = epochMs();
  r.uptimeMs     = millis();
  r.exhaustMv    = s.exhaustMv;
  r.ambientMv    = s.ambientMv;
  r.co2Mv        = s.co2Mv;
  r.exhaustDelta = (s.exhaustMv > s.baseExh) ? (s.exhaustMv - s.baseExh) : 0;
  r.ambientDelta = (s.ambientMv > s.baseAmb) ? (s.ambientMv - s.baseAmb) : 0;
  r.co2Delta     = (s.co2Mv > s.baseCo2) ? (s.co2Mv - s.baseCo2) : 0;
  r.level        = static_cast<uint8_t>(s.level);
  r.scrubber     = static_cast<uint8_t>(s.scrubber);
  r.relayMask    = s.relayMask;
  r.flags = (s.tripLatched   ? 1  : 0) |
            (s.sirenSilenced ? 2  : 0) |
            (s.warmingUp     ? 4  : 0) |
            (s.scram         ? 8  : 0) |
            (s.sensorFault   ? 16 : 0) |
            (s.lockout       ? 32 : 0) |
            (s.manual        ? 64 : 0);
  return r;
}

static size_t buildJson(const BufferedRecord_t &r, bool buffered, char *out, size_t len) {
  JsonDocument doc;
  doc["thing"]         = THING_NAME;
  doc["ts"]            = static_cast<unsigned long long>(r.epochMs);
  doc["uptime_ms"]     = r.uptimeMs;
  doc["feed_influx_mv"]= r.exhaustMv;
  doc["feed_delta_mv"] = r.exhaustDelta;
  doc["amb_leak_mv"]   = r.ambientMv;
  doc["amb_delta_mv"]  = r.ambientDelta;
  doc["solvent_mv"]    = r.co2Mv;
  doc["solvent_delta"] = r.co2Delta;
  doc["ambient_level"] = levelName(r.level);
  doc["scrubber"]      = scrubberName(r.scrubber);
  doc["relays"]        = r.relayMask;
  doc["trip"]          = (r.flags & 1) != 0;
  doc["silenced"]      = (r.flags & 2) != 0;
  doc["warmup"]        = (r.flags & 4) != 0;
  doc["scram"]         = (r.flags & 8) != 0;
  doc["fault"]         = (r.flags & 16) != 0;
  doc["lockout"]       = (r.flags & 32) != 0;
  doc["mode"]          = (r.flags & 64) ? "MANUAL" : "AUTO";
  doc["buffered"]      = buffered;
  doc["fw"]            = "rev-D.3";
  return serializeJson(doc, out, len);
}

static bool publishTo(const String &topic, const BufferedRecord_t &r, bool buffered) {
  char payload[512];
  size_t n = buildJson(r, buffered, payload, sizeof(payload));
  return mqtt.publish(topic.c_str(), payload, n, false, 1);
}

static void printReading(const BufferedRecord_t &r, bool sent) {
  Serial.printf("[%6lus] EXH %4u(Δ%3u) | AMB %4u(Δ%3u) | TOX %4u(Δ%3u) | %-8s | %-8s | %c%c%c%c%c%c | %s%s%s%s%s%s| AWS:%s | buf:%u\n",
                (unsigned long)(r.uptimeMs / 1000), r.exhaustMv, r.exhaustDelta, r.ambientMv, r.ambientDelta,
                r.co2Mv, r.co2Delta, levelName(r.level), scrubberName(r.scrubber),
                (r.relayMask & 1) ? 'F' : '-', (r.relayMask & 2) ? 'P' : '-', (r.relayMask & 4) ? 'p' : '-',
                (r.relayMask & 8) ? 'R' : '-', (r.relayMask & 16) ? 'G' : '-', (r.relayMask & 32) ? 'S' : '-',
                (r.flags & 4) ? "WARM " : "", (r.flags & 1) ? "TRIP " : "", (r.flags & 2) ? "MUTE " : "",
                (r.flags & 8) ? "SCRAM " : "", (r.flags & 16) ? "FAULT " : "", (r.flags & 32) ? "LOCKOUT " : "",
                sent ? "sent" : "offline", (unsigned)ringCount);
}

static void queueCommand(const char *cmd, const char *value) {
  Command_t c{};
  strncpy(c.cmd, cmd, sizeof(c.cmd) - 1);
  strncpy(c.value, value, sizeof(c.value) - 1);
  if (xQueueSend(qCmd, &c, 0) != pdTRUE) sendAck(cmd, value, false, "Board busy: try again");
}

static void onMessage(String &topic, String &payload) {
  JsonDocument doc;
  if (deserializeJson(doc, payload)) return;

  // 1. System commands. The app sends {"cmd": ..., "value": ...}.
  const char *cmd = doc["cmd"] | "";
  const char *value = doc["value"] | "";

  // 2. Direct relay command {"relay": index or GPIO, "state": true|false}, kept from D.2 but interlocked:
  //    only the fan (index 0 / GPIO 6) and primary pump (index 1 / GPIO 12), only in manual mode.
  //    Lamps, siren and the reagent pump stay under automatic safety control.
  if (!cmd[0] && doc["relay"].is<int>() && doc["state"].is<bool>()) {
    const int r = doc["relay"];
    const char *state = doc["state"].as<bool>() ? "on" : "off";
    if (r == 0 || r == RELAY_1_INTAKE) queueCommand("fan", state);
    else if (r == 1 || r == RELAY_2_PUMP_1) queueCommand("pump", state);
    else sendAck("relay", state, false, "Lamps, siren and reagent pump stay under automatic control");
    return;
  }

  if (strcmp(cmd, "scram") == 0)        { gScramRequest.store(true, std::memory_order_relaxed); sendAck(cmd, value, true, ""); }
  else if (strcmp(cmd, "ping") == 0)    sendAck(cmd, value, true, "");
  else if (strcmp(cmd, "reset") == 0)   { gResetRequest.store(true, std::memory_order_relaxed); sendAck(cmd, value, true, "Resets only when readings are normal"); }
  else if (strcmp(cmd, "stop") == 0)    { gStopRequest.store(true, std::memory_order_relaxed); sendAck(cmd, value, true, ""); }
  else if (strcmp(cmd, "silence") == 0) { gSilenceRequest.store(true, std::memory_order_relaxed); sendAck(cmd, value, true, ""); }
  else if (strcmp(cmd, "mode") == 0 || strcmp(cmd, "fan") == 0 || strcmp(cmd, "pump") == 0) queueCommand(cmd, value);
  else sendAck(cmd[0] ? cmd : "unknown", value, false, "Unknown command");
}

static void Task_Network(void *) {
  ring = static_cast<BufferedRecord_t *>(ps_malloc(BUFFER_LEN * sizeof(BufferedRecord_t)));
  if (!ring) ring = static_cast<BufferedRecord_t *>(malloc(256 * sizeof(BufferedRecord_t)));

  String base = String("clathrarefine/") + THING_NAME;
  topicTelemetry = base + "/telemetry";
  topicEvents    = base + "/events";
  topicCmd       = base + "/cmd";
  topicAck       = base + "/cmd/ack";

  // 1. Establish Wi-Fi connection prior to attempting secure configuration loops
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[WIFI] Connecting to SSID: ");
  Serial.println(WIFI_SSID);

  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 40) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WIFI] Connected successfully! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[WIFI] Initial connection timeout. Will retry in background loop.");
  }

  // 2. Synchronize NTP Time strictly before loading secure certs & connecting to AWS
  Serial.print("[NTP] Syncing time");
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  while (time(nullptr) < 946684800) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[NTP] Time synchronized successfully!");

  // 3. Bind AWS Certificates securely to the client wrapper
  net.setCACert(AWS_CERT_CA);
  net.setCertificate(AWS_CERT_CRT);
  net.setPrivateKey(AWS_CERT_PRIVATE);

  mqtt.begin(AWS_IOT_ENDPOINT, 8883, net);
  mqtt.onMessage(onMessage);
  mqtt.setKeepAlive(30);

  uint32_t lastTelemetry = 0, lastConnectTry = 0;
  BufferedRecord_t lastEvent = snapshot();

  for (;;) {
    uint32_t now = millis();

    // Resilient Connection Maintenance Block
    if (WiFi.status() != WL_CONNECTED) {
      if (now - lastConnectTry > 10000) { 
        lastConnectTry = now; 
        Serial.println("[WIFI] Connection lost. Reconnecting...");
        WiFi.reconnect(); 
      }
    } else if (!mqtt.connected() && (now - lastConnectTry > 5000)) {
      lastConnectTry = now;
      Serial.print("[MQTT] Connecting to AWS IoT Core...");
      if (mqtt.connect(THING_NAME)) {
        Serial.println(" Connected!");
        mqtt.subscribe(topicCmd.c_str(), 1);
      } else {
        Serial.printf(" Failed, error code: %d\n", mqtt.lastError());
      }
    }
    
    mqtt.loop();

    if (now - lastTelemetry >= TELEMETRY_PERIOD_MS) {
      lastTelemetry = now;
      BufferedRecord_t r = snapshot();
      bool sent = mqtt.connected() && publishTo(topicTelemetry, r, false);
      if (!sent) bufferPush(r);
      printReading(r, sent);

      if (r.level != lastEvent.level || r.flags != lastEvent.flags || r.scrubber != lastEvent.scrubber) {
        if (mqtt.connected()) publishTo(topicEvents, r, false);
        lastEvent = r;
      }
    }

    for (int i = 0; i < 10 && mqtt.connected() && ringCount > 0; ++i) {
      if (!publishTo(topicTelemetry, ring[ringHead], true)) break;
      ringHead = (ringHead + 1) % BUFFER_LEN;
      ringCount--;
    }

    Ack_t a;
    while (mqtt.connected() && xQueueReceive(qAck, &a, 0) == pdTRUE) {
      JsonDocument ack;
      ack["thing"] = THING_NAME;
      ack["cmd"] = a.cmd;
      if (a.value[0]) ack["value"] = a.value;
      ack["accepted"] = a.accepted;
      if (a.reason[0]) ack["reason"] = a.reason;
      ack["uptime_ms"] = millis();
      char out[256];
      size_t n = serializeJson(ack, out, sizeof(out));
      mqtt.publish(topicAck.c_str(), out, n, false, 1);
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

// ---------------- System Initialization ----------------
void setup() {
  for (uint8_t p : RELAY_PINS) initSafeRelayPin(p);
  Serial.begin(115200);

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_MQ2_EXHAUST, ADC_11db);
  analogSetPinAttenuation(PIN_MQ2_AMBIENT, ADC_11db);
  analogSetPinAttenuation(PIN_MQ135_CO2,   ADC_11db);

  esp_task_wdt_config_t wdt = {.timeout_ms = WDT_TIMEOUT_MS, .idle_core_mask = 0, .trigger_panic = true};
  if (esp_task_wdt_reconfigure(&wdt) != ESP_OK) esp_task_wdt_init(&wdt);

  qExhaust = xQueueCreate(1, sizeof(SensorTelemetry_t));
  qAmbient = xQueueCreate(1, sizeof(SensorTelemetry_t));
  qCmd     = xQueueCreate(4, sizeof(Command_t));
  qAck     = xQueueCreate(8, sizeof(Ack_t));
  configASSERT(qExhaust != nullptr && qAmbient != nullptr && qCmd != nullptr && qAck != nullptr);

  xTaskCreatePinnedToCore(Task_HazardSafety,      "HazSafe", 4096, nullptr, 4, nullptr, 1);
  xTaskCreatePinnedToCore(Task_SensorAcquisition, "SensAcq", 4096, nullptr, 3, nullptr, 1);
  xTaskCreatePinnedToCore(Task_ExhaustControl,    "ExhCtrl", 4096, nullptr, 2, nullptr, 1);
  xTaskCreatePinnedToCore(Task_Network,           "Network", 8192, nullptr, 1, nullptr, 0);
}

void loop() { vTaskDelete(nullptr); }
