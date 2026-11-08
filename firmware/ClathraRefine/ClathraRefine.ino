/**
 * ClathraRefine firmware, revision C (manual fan/pump commands with board interlocks, MQ-135 CO2 inputs)
 * Board: ESP32-S3-WROOM-1-N16R8 | Arduino-ESP32 core 3.x (ESP-IDF 5.x)
 * Libraries: MQTT (Joel Gaehwiler), ArduinoJson 7.x
 * Safety tasks run on core 1 and never wait for the network.
 * The network task runs on core 0 and only reads a snapshot of plant status.
 */
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <MQTT.h>
#include <ArduinoJson.h>
#include <sys/time.h>
#include <time.h>
#include "esp_task_wdt.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "secrets.h"

// ---------------- Pins ----------------
static constexpr uint8_t PIN_MQ2_EXHAUST = 1;   // ADC1_CH0, 10k/15k divider
static constexpr uint8_t PIN_MQ2_AMBIENT = 2;   // ADC1_CH1, 10k/15k divider
static constexpr uint8_t PIN_ACK_BUTTON  = 12;  // push button to GND (moved from GPIO4 in rev C)
static constexpr uint8_t PIN_MQ135_IN    = 4;   // ADC1_CH3, inlet CO2, 10k/15k divider
static constexpr uint8_t PIN_MQ135_OUT   = 5;   // ADC1_CH4, outlet CO2, 10k/15k divider
// GPIO3 is a strapping pin and ADC2 is unreliable with Wi-Fi on: neither is used.
static constexpr uint8_t RELAY_1_INTAKE  = 6;   // extraction fan
static constexpr uint8_t RELAY_2_PUMP    = 7;   // solvent pump
static constexpr uint8_t RELAY_3_RED     = 8;
static constexpr uint8_t RELAY_4_GREEN   = 9;
static constexpr uint8_t RELAY_5_YELLOW  = 10;
static constexpr uint8_t RELAY_6_SIREN   = 11;
static const uint8_t RELAY_PINS[6] = {RELAY_1_INTAKE, RELAY_2_PUMP, RELAY_3_RED,
                                      RELAY_4_GREEN, RELAY_5_YELLOW, RELAY_6_SIREN};
static constexpr uint8_t RELAY_ACTIVE_LEVEL   = LOW;
static constexpr uint8_t RELAY_INACTIVE_LEVEL = HIGH;

// ---------------- Scaling ----------------
// Divider 10k (top) / 15k (bottom): Vpin = Vsensor x 15/25.
// 5.0 V at the sensor gives 3.0 V at the pin, inside the 0-3100 mV range at 11 dB.
static constexpr uint32_t DIV_NUM = 25;
static constexpr uint32_t DIV_DEN = 15;

// ---------------- Thresholds (sensor-side millivolts) ----------------
// Converted from the rev A raw-count thresholds 1500 / 1200 / 2300.
// Re-calibrate in clean air on the demo site.
static constexpr uint16_t EXH_ON_MV       = 1770;
static constexpr uint16_t EXH_OFF_MV      = 1670;
static constexpr uint16_t AMB_WARN_ON_MV  = 1410;
static constexpr uint16_t AMB_WARN_OFF_MV = 1310;
static constexpr uint16_t AMB_CRIT_ON_MV  = 2710;
static constexpr uint16_t AMB_CRIT_OFF_MV = 2610;

// ---------------- Timing ----------------
static constexpr uint32_t SAMPLE_PERIOD_MS    = 100;
static constexpr uint8_t  OVERSAMPLES         = 16;
static constexpr uint32_t PUMP_STAGGER_MS     = 2000;
static constexpr uint32_t PURGE_HOLD_MS       = 5000;
static constexpr uint32_t WARMUP_MS           = 180000;  // MQ-2 heater warm-up after power-on
static constexpr uint32_t ACK_DEBOUNCE_MS     = 50;
static constexpr uint32_t SENSOR_TIMEOUT_MS   = 1000;    // no fresh data -> fault trip
static constexpr uint32_t TELEMETRY_PERIOD_MS = 2000;
static constexpr uint32_t WDT_TIMEOUT_MS      = 3000;
static constexpr uint32_t MANUAL_TIMEOUT_MS   = 600000;  // manual mode returns to auto after 10 min without a command

// ---------------- Shared state ----------------
enum class ScrubberState : uint8_t { IDLE, INTAKE_ACTIVE, SCRUBBING, PURGING };
enum class AlarmLevel    : uint8_t { NORMAL, WARNING, CRITICAL };
enum class ControlMode   : uint8_t { AUTO, MANUAL };

struct SensorTelemetry_t {
  uint16_t exhaustMv;
  uint16_t ambientMv;
  uint32_t uptimeMs;
  uint16_t co2InMv;
  uint16_t co2OutMv;
};

struct PlantStatus_t {
  uint16_t exhaustMv = 0;
  uint16_t ambientMv = 0;
  ScrubberState scrubber = ScrubberState::IDLE;
  AlarmLevel level = AlarmLevel::NORMAL;
  bool tripLatched = false;
  bool sirenSilenced = false;
  bool warmingUp = true;
  bool scram = false;
  bool sensorFault = false;
  uint8_t relayMask = 0;   // bit 0 = relay 1 ... bit 5 = relay 6
  uint16_t co2InMv = 0;
  uint16_t co2OutMv = 0;
  ControlMode mode = ControlMode::AUTO;
  bool gasActive = false;
};

// Manual command from the cloud, decided on core 1 by ExhaustControl, acknowledged by the network task.
struct Command_t { char cmd[8]; bool on; };
struct Ack_t { char cmd[8]; bool accepted; char reason[64]; };

// Defined here, before the first function, because the Arduino IDE writes
// function prototypes above the first function and they use this type.
struct BufferedRecord_t {
  uint64_t epochMs;
  uint32_t uptimeMs;
  uint16_t exhaustMv;
  uint16_t ambientMv;
  uint8_t  level;
  uint8_t  scrubber;
  uint8_t  flags;      // bit0 trip, bit1 siren silenced, bit2 warm-up, bit3 SCRAM, bit4 sensor fault
  uint8_t  relayMask;
  uint16_t co2InMv;
  uint16_t co2OutMv;
  uint8_t  mode;
};

static PlantStatus_t gStatus;
static portMUX_TYPE gMux = portMUX_INITIALIZER_UNLOCKED;
static volatile bool gScramRequest = false;   // set by a cloud command, handled by HazardSafety
static QueueHandle_t qExhaust = nullptr;
static QueueHandle_t qAmbient = nullptr;
static QueueHandle_t qCmd = nullptr;   // cloud -> ExhaustControl
static QueueHandle_t qAck = nullptr;   // ExhaustControl -> network

// ---------------- Helpers ----------------
static void setRelay(uint8_t pin, bool on) {
  digitalWrite(pin, on ? RELAY_ACTIVE_LEVEL : RELAY_INACTIVE_LEVEL);
  for (uint8_t i = 0; i < 6; ++i) {
    if (RELAY_PINS[i] == pin) {
      portENTER_CRITICAL(&gMux);
      if (on) gStatus.relayMask |= (1u << i);
      else    gStatus.relayMask &= ~(1u << i);
      portEXIT_CRITICAL(&gMux);
    }
  }
}

static void initSafeRelayPin(uint8_t pin) {
  digitalWrite(pin, RELAY_INACTIVE_LEVEL);   // set the level before the pin becomes an output
  pinMode(pin, OUTPUT);
  digitalWrite(pin, RELAY_INACTIVE_LEVEL);
}

static inline bool inWarmup() { return millis() < WARMUP_MS; }

static uint16_t readSensorMv(uint8_t pin) {
  uint32_t sum = 0;
  for (uint8_t i = 0; i < OVERSAMPLES; ++i) sum += analogReadMilliVolts(pin);
  return static_cast<uint16_t>((sum / OVERSAMPLES) * DIV_NUM / DIV_DEN);
}

// ---------------- Task: sensor acquisition ----------------
static void Task_SensorAcquisition(void *) {
  esp_task_wdt_add(nullptr);
  TickType_t last = xTaskGetTickCount();
  for (;;) {
    SensorTelemetry_t t{readSensorMv(PIN_MQ2_EXHAUST), readSensorMv(PIN_MQ2_AMBIENT), millis(),
                        readSensorMv(PIN_MQ135_IN), readSensorMv(PIN_MQ135_OUT)};
    xQueueOverwrite(qExhaust, &t);
    xQueueOverwrite(qAmbient, &t);
    portENTER_CRITICAL(&gMux);
    gStatus.exhaustMv = t.exhaustMv;
    gStatus.ambientMv = t.ambientMv;
    gStatus.co2InMv = t.co2InMv;
    gStatus.co2OutMv = t.co2OutMv;
    gStatus.warmingUp = inWarmup();
    portEXIT_CRITICAL(&gMux);
    esp_task_wdt_reset();
    vTaskDelayUntil(&last, pdMS_TO_TICKS(SAMPLE_PERIOD_MS));
  }
}

// ---------------- Task: exhaust fan and pump sequence ----------------
static void Task_ExhaustControl(void *) {
  esp_task_wdt_add(nullptr);
  ScrubberState state = ScrubberState::IDLE;
  TickType_t intakeStart = 0, clearedAt = 0;
  bool gasActive = false, wasScram = false;
  ControlMode mode = ControlMode::AUTO;
  bool manualFan = false, manualPump = false;
  uint32_t lastCmdMs = 0;
  SensorTelemetry_t rx;
  for (;;) {
    esp_task_wdt_reset();

    bool scram, tripped, sensorFault;
    AlarmLevel level;
    portENTER_CRITICAL(&gMux);
    scram = gStatus.scram;
    tripped = gStatus.tripLatched;
    sensorFault = gStatus.sensorFault;
    level = gStatus.level;
    portEXIT_CRITICAL(&gMux);

    // Manual commands. The board refuses unsafe ones and says why.
    Command_t c;
    while (xQueueReceive(qCmd, &c, 0) == pdTRUE) {
      Ack_t a{};
      strncpy(a.cmd, c.cmd, sizeof(a.cmd) - 1);
      const char *reason = nullptr;
      if (strcmp(c.cmd, "mode") == 0) {
        if (!c.on) { mode = ControlMode::AUTO; manualFan = manualPump = false; }
        else if (tripped)    reason = "Trip latched: manual mode not allowed";
        else if (scram)      reason = "SCRAM active: manual mode not allowed";
        else if (inWarmup()) reason = "Sensors warming up: manual mode not allowed";
        else if (gasActive)  reason = "Exhaust gas active: automatic control required";
        else { mode = ControlMode::MANUAL; manualFan = state != ScrubberState::IDLE; manualPump = state == ScrubberState::SCRUBBING; }
      } else if (mode != ControlMode::MANUAL) {
        reason = "Manual mode required";
      } else if (strcmp(c.cmd, "fan") == 0) {
        if (!c.on && gasActive)                 reason = "Exhaust gas active: fan must stay on";
        else if (!c.on && (tripped || scram))   reason = "Trip or SCRAM active: fan must stay on";
        else if (!c.on && manualPump)           reason = "Stop the pump before the fan";
        else manualFan = c.on;
      } else if (strcmp(c.cmd, "pump") == 0) {
        if (c.on && !manualFan)                 reason = "Fan must be on before the pump";
        else if (c.on && tripped)               reason = "Trip latched: pump not allowed";
        else manualPump = c.on;
      } else {
        reason = "Unknown command";
      }
      a.accepted = (reason == nullptr);
      if (reason) strncpy(a.reason, reason, sizeof(a.reason) - 1);
      if (a.accepted) lastCmdMs = millis();
      xQueueSend(qAck, &a, 0);
    }

    if (xQueueReceive(qExhaust, &rx, pdMS_TO_TICKS(200)) != pdTRUE) continue;  // stale data is handled by HazardSafety

    // Hysteresis: separate on and off thresholds stop relay chatter
    if (!gasActive && rx.exhaustMv >= EXH_ON_MV)       gasActive = true;
    else if (gasActive && rx.exhaustMv <= EXH_OFF_MV)  gasActive = false;
    if (inWarmup()) gasActive = false;   // a cold MQ-2 reads high

    // Automatic safety always wins: gas, critical level, sensor fault, trip, SCRAM or a 10 min idle returns to AUTO.
    if (mode == ControlMode::MANUAL &&
        (gasActive || level == AlarmLevel::CRITICAL || sensorFault || tripped || scram || millis() - lastCmdMs > MANUAL_TIMEOUT_MS)) {
      mode = ControlMode::AUTO;
      manualFan = manualPump = false;
    }

    if (mode == ControlMode::MANUAL) {
      setRelay(RELAY_1_INTAKE, manualFan);
      setRelay(RELAY_2_PUMP, manualPump);
      state = manualPump ? ScrubberState::SCRUBBING : (manualFan ? ScrubberState::INTAKE_ACTIVE : ScrubberState::IDLE);
    } else if (scram) {
      // SCRAM: stop the pump, keep extraction running
      setRelay(RELAY_2_PUMP, false);
      setRelay(RELAY_1_INTAKE, true);
      state = ScrubberState::IDLE;
      gasActive = false;
      wasScram = true;
    } else {
      if (wasScram) { setRelay(RELAY_1_INTAKE, false); wasScram = false; }

      TickType_t now = xTaskGetTickCount();
      switch (state) {
        case ScrubberState::IDLE:
          if (gasActive) {
            setRelay(RELAY_1_INTAKE, true);
            setRelay(RELAY_2_PUMP, false);
            intakeStart = now;
            state = ScrubberState::INTAKE_ACTIVE;
          }
          break;
        case ScrubberState::INTAKE_ACTIVE:
          if (!gasActive) {
            clearedAt = now;
            state = ScrubberState::PURGING;
          } else if ((now - intakeStart) >= pdMS_TO_TICKS(PUMP_STAGGER_MS)) {
            setRelay(RELAY_2_PUMP, true);
            state = ScrubberState::SCRUBBING;
          }
          break;
        case ScrubberState::SCRUBBING:
          if (!gasActive) {
            clearedAt = now;
            state = ScrubberState::PURGING;
          }
          break;
        case ScrubberState::PURGING:
          if (gasActive) {
            // Rev A bug fix: the pump may never have started, so switch both on
            setRelay(RELAY_1_INTAKE, true);
            setRelay(RELAY_2_PUMP, true);
            state = ScrubberState::SCRUBBING;
          } else if ((now - clearedAt) >= pdMS_TO_TICKS(PURGE_HOLD_MS)) {
            setRelay(RELAY_2_PUMP, false);
            setRelay(RELAY_1_INTAKE, false);
            state = ScrubberState::IDLE;
          }
          break;
      }
    }
    portENTER_CRITICAL(&gMux);
    gStatus.scrubber = state;
    gStatus.mode = mode;
    gStatus.gasActive = gasActive;
    portEXIT_CRITICAL(&gMux);
  }
}

// ---------------- Task: hazard alarms ----------------
static void Task_HazardSafety(void *) {
  esp_task_wdt_add(nullptr);
  AlarmLevel level = AlarmLevel::NORMAL;
  bool tripLatched = false, sirenSilenced = false, scram = false;
  uint32_t ackLowSince = 0;
  bool ackHandled = false;
  uint32_t lastData = millis();
  SensorTelemetry_t rx;

  for (;;) {
    esp_task_wdt_reset();
    bool fresh = (xQueueReceive(qAmbient, &rx, pdMS_TO_TICKS(200)) == pdTRUE);
    uint32_t nowMs = millis();
    if (fresh) lastData = nowMs;
    bool sensorFault = (nowMs - lastData) > SENSOR_TIMEOUT_MS;

    // Cloud SCRAM: latched here; only the local acknowledge button clears it
    if (gScramRequest) {
      gScramRequest = false;
      scram = true;
      tripLatched = true;
      sirenSilenced = false;
    }

    // Debounced acknowledge button (active LOW), one action per press
    bool ackPressed = false;
    if (digitalRead(PIN_ACK_BUTTON) == LOW) {
      if (ackLowSince == 0) ackLowSince = nowMs;
      if (!ackHandled && (nowMs - ackLowSince) >= ACK_DEBOUNCE_MS) { ackPressed = true; ackHandled = true; }
    } else {
      ackLowSince = 0;
      ackHandled = false;
    }

    // Alarm level with hysteresis; frozen during warm-up
    if (fresh && !inWarmup()) {
      uint16_t mv = rx.ambientMv;
      switch (level) {
        case AlarmLevel::NORMAL:
          if (mv >= AMB_CRIT_ON_MV)       level = AlarmLevel::CRITICAL;
          else if (mv >= AMB_WARN_ON_MV)  level = AlarmLevel::WARNING;
          break;
        case AlarmLevel::WARNING:
          if (mv >= AMB_CRIT_ON_MV)       level = AlarmLevel::CRITICAL;
          else if (mv <= AMB_WARN_OFF_MV) level = AlarmLevel::NORMAL;
          break;
        case AlarmLevel::CRITICAL:
          if (mv <= AMB_WARN_OFF_MV)      level = AlarmLevel::NORMAL;
          else if (mv <= AMB_CRIT_OFF_MV) level = AlarmLevel::WARNING;
          break;
      }
    }

    // Latch the trip on a critical reading or lost sensor data
    if (level == AlarmLevel::CRITICAL || sensorFault) {
      if (!tripLatched) sirenSilenced = false;
      tripLatched = true;
    }

    // First press while unsafe silences the siren; a press once safe resets the trip
    if (ackPressed && tripLatched) {
      if (level == AlarmLevel::NORMAL && !sensorFault) {
        tripLatched = false;
        scram = false;
        sirenSilenced = false;
      } else {
        sirenSilenced = true;
      }
    }

    // Outputs
    if (tripLatched) {
      setRelay(RELAY_4_GREEN, false);
      setRelay(RELAY_5_YELLOW, false);
      setRelay(RELAY_3_RED, true);
      setRelay(RELAY_6_SIREN, !sirenSilenced);
    } else if (inWarmup() || level == AlarmLevel::WARNING) {
      setRelay(RELAY_4_GREEN, false);
      setRelay(RELAY_3_RED, false);
      setRelay(RELAY_6_SIREN, false);
      setRelay(RELAY_5_YELLOW, true);
    } else {
      setRelay(RELAY_3_RED, false);
      setRelay(RELAY_5_YELLOW, false);
      setRelay(RELAY_6_SIREN, false);
      setRelay(RELAY_4_GREEN, true);
    }

    portENTER_CRITICAL(&gMux);
    gStatus.level = level;
    gStatus.tripLatched = tripLatched;
    gStatus.sirenSilenced = sirenSilenced;
    gStatus.scram = scram;
    gStatus.sensorFault = sensorFault;
    portEXIT_CRITICAL(&gMux);
  }
}

// ---------------- Network: AWS IoT Core over MQTT/TLS ----------------
static WiFiClientSecure net;
static MQTTClient mqtt(1024);
static String topicTelemetry, topicEvents, topicCmd, topicAck;
static volatile bool gPingPending = false;
static volatile bool gScramAckPending = false;

static constexpr size_t BUFFER_LEN = 4096;   // about 2.3 hours at one record every 2 s
static BufferedRecord_t *ring = nullptr;
static size_t ringHead = 0, ringCount = 0;

static void bufferPush(const BufferedRecord_t &r) {
  if (!ring) return;
  ring[(ringHead + ringCount) % BUFFER_LEN] = r;
  if (ringCount < BUFFER_LEN) ringCount++;
  else ringHead = (ringHead + 1) % BUFFER_LEN;   // full: overwrite the oldest record
}

static uint64_t epochMs() {
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  if (tv.tv_sec < 1700000000) return 0;   // clock not yet set by NTP
  return static_cast<uint64_t>(tv.tv_sec) * 1000ULL + tv.tv_usec / 1000ULL;
}

static const char *levelName(uint8_t l) {
  return l == 2 ? "CRITICAL" : (l == 1 ? "WARNING" : "NORMAL");
}

static const char *scrubberName(uint8_t s) {
  static const char *names[] = {"IDLE", "INTAKE_ACTIVE", "SCRUBBING", "PURGING"};
  return names[s & 3];
}

static BufferedRecord_t snapshot() {
  PlantStatus_t s;
  portENTER_CRITICAL(&gMux);
  s = gStatus;
  portEXIT_CRITICAL(&gMux);
  BufferedRecord_t r;
  r.epochMs   = epochMs();
  r.uptimeMs  = millis();
  r.exhaustMv = s.exhaustMv;
  r.ambientMv = s.ambientMv;
  r.level     = static_cast<uint8_t>(s.level);
  r.scrubber  = static_cast<uint8_t>(s.scrubber);
  r.relayMask = s.relayMask;
  r.co2InMv   = s.co2InMv;
  r.co2OutMv  = s.co2OutMv;
  r.mode      = static_cast<uint8_t>(s.mode);
  r.flags = (s.tripLatched ? 1 : 0) | (s.sirenSilenced ? 2 : 0) | (s.warmingUp ? 4 : 0) |
            (s.scram ? 8 : 0) | (s.sensorFault ? 16 : 0);
  return r;
}

static size_t buildJson(const BufferedRecord_t &r, bool buffered, char *out, size_t len) {
  JsonDocument doc;
  doc["thing"]          = THING_NAME;
  doc["ts"]             = static_cast<unsigned long long>(r.epochMs);   // 0 = clock not synced
  doc["uptime_ms"]      = r.uptimeMs;
  doc["exhaust_mv"]     = r.exhaustMv;
  doc["ambient_mv"]     = r.ambientMv;
  doc["ambient_level"]  = levelName(r.level);
  doc["scrubber"]       = scrubberName(r.scrubber);
  doc["relay_mask"]     = r.relayMask;
  doc["trip_latched"]   = (r.flags & 1) != 0;
  doc["siren_silenced"] = (r.flags & 2) != 0;
  doc["warming_up"]     = (r.flags & 4) != 0;
  doc["scram"]          = (r.flags & 8) != 0;
  doc["sensor_fault"]   = (r.flags & 16) != 0;
  doc["buffered"]       = buffered;
  doc["mode"]           = r.mode ? "MANUAL" : "AUTO";
  doc["co2_in_mv"]      = r.co2InMv;
  doc["co2_out_mv"]     = r.co2OutMv;
  doc["fw"]             = "rev-C";
  return serializeJson(doc, out, len);
}

static bool publishTo(const String &topic, const BufferedRecord_t &r, bool buffered) {
  char payload[640];
  size_t n = buildJson(r, buffered, payload, sizeof(payload));
  return mqtt.publish(topic.c_str(), payload, n, false, 1);
}

// One line per reading on the serial monitor (115200 baud)
static void printReading(const BufferedRecord_t &r, bool sent) {
  Serial.printf("[%7lus] EXH %4u mV | AMB %4u mV %-8s | %-13s | relays %c%c%c%c%c%c | %s%s%s%s%s| AWS %s | buf %u\n",
                (unsigned long)(r.uptimeMs / 1000), r.exhaustMv, r.ambientMv, levelName(r.level),
                scrubberName(r.scrubber),
                (r.relayMask & 1) ? 'F' : '-', (r.relayMask & 2) ? 'P' : '-', (r.relayMask & 4) ? 'R' : '-',
                (r.relayMask & 8) ? 'G' : '-', (r.relayMask & 16) ? 'Y' : '-', (r.relayMask & 32) ? 'S' : '-',
                (r.flags & 4) ? "WARM-UP " : "", (r.flags & 1) ? "TRIP " : "", (r.flags & 2) ? "SILENCED " : "",
                (r.flags & 8) ? "SCRAM " : "", (r.flags & 16) ? "SENSOR-FAULT " : "",
                sent ? "sent" : "offline", (unsigned)ringCount);
  if (r.exhaustMv < 100 || r.ambientMv < 100) Serial.println("  CHECK SENSOR: a reading is below 100 mV");
}

// The MQTT library must not be used inside this callback, so it only sets flags
static void onMessage(String &topic, String &payload) {
  JsonDocument doc;
  if (deserializeJson(doc, payload)) return;
  const char *cmd = doc["cmd"] | "";
  const char *value = doc["value"] | "";
  if (strcmp(cmd, "scram") == 0) { gScramRequest = true; gScramAckPending = true; return; }
  if (strcmp(cmd, "ping") == 0)  { gPingPending = true; return; }
  Command_t c{};
  strncpy(c.cmd, cmd, sizeof(c.cmd) - 1);
  c.on = (strcmp(value, "on") == 0 || strcmp(value, "manual") == 0);
  xQueueSend(qCmd, &c, 0);   // decided by ExhaustControl, acknowledged below
}

static void publishAck(const Ack_t &a) {
  JsonDocument ack;
  ack["cmd"] = a.cmd;
  ack["accepted"] = a.accepted;
  if (!a.accepted) ack["reason"] = a.reason;
  ack["uptime_ms"] = millis();
  char out[200];
  size_t n = serializeJson(ack, out, sizeof(out));
  mqtt.publish(topicAck.c_str(), out, n, false, 1);
}

static void Task_Network(void *) {
  ring = static_cast<BufferedRecord_t *>(ps_malloc(BUFFER_LEN * sizeof(BufferedRecord_t)));

  String base = String("clathrarefine/") + THING_NAME;
  topicTelemetry = base + "/telemetry";
  topicEvents    = base + "/events";
  topicCmd       = base + "/cmd";
  topicAck       = base + "/cmd/ack";

  net.setCACert(AWS_CERT_CA);
  net.setCertificate(AWS_CERT_CRT);
  net.setPrivateKey(AWS_CERT_PRIVATE);
  mqtt.begin(AWS_IOT_ENDPOINT, 8883, net);
  mqtt.onMessage(onMessage);
  mqtt.setKeepAlive(30);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  configTime(0, 0, "pool.ntp.org", "time.google.com");

  uint32_t lastTelemetry = 0, lastConnectTry = 0;
  BufferedRecord_t lastEvent = snapshot();

  for (;;) {
    uint32_t now = millis();

    if (WiFi.status() != WL_CONNECTED) {
      if (now - lastConnectTry > 10000) { lastConnectTry = now; WiFi.reconnect(); }
    } else if (!mqtt.connected() && now - lastConnectTry > 5000) {
      lastConnectTry = now;
      if (mqtt.connect(THING_NAME)) mqtt.subscribe(topicCmd.c_str(), 1);   // client ID = thing name
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

    // Send buffered records gently after a reconnect
    for (int i = 0; i < 10 && mqtt.connected() && ringCount > 0; ++i) {
      if (!publishTo(topicTelemetry, ring[ringHead], true)) break;
      ringHead = (ringHead + 1) % BUFFER_LEN;
      ringCount--;
    }

    if (mqtt.connected() && (gPingPending || gScramAckPending)) {
      Ack_t a{};
      strncpy(a.cmd, gPingPending ? "ping" : "scram", sizeof(a.cmd) - 1);
      a.accepted = true;
      if (gPingPending) gPingPending = false; else gScramAckPending = false;
      publishAck(a);
    }
    Ack_t a;
    while (mqtt.connected() && xQueueReceive(qAck, &a, 0) == pdTRUE) publishAck(a);

    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

// ---------------- Setup ----------------
void setup() {
  for (uint8_t p : RELAY_PINS) initSafeRelayPin(p);
  pinMode(PIN_ACK_BUTTON, INPUT_PULLUP);
  Serial.begin(115200);

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_MQ2_EXHAUST, ADC_11db);
  analogSetPinAttenuation(PIN_MQ2_AMBIENT, ADC_11db);
  analogSetPinAttenuation(PIN_MQ135_IN, ADC_11db);
  analogSetPinAttenuation(PIN_MQ135_OUT, ADC_11db);

  esp_task_wdt_config_t wdt = {.timeout_ms = WDT_TIMEOUT_MS, .idle_core_mask = 0, .trigger_panic = true};
  if (esp_task_wdt_reconfigure(&wdt) != ESP_OK) esp_task_wdt_init(&wdt);

  qExhaust = xQueueCreate(1, sizeof(SensorTelemetry_t));
  qAmbient = xQueueCreate(1, sizeof(SensorTelemetry_t));
  qCmd = xQueueCreate(4, sizeof(Command_t));
  qAck = xQueueCreate(4, sizeof(Ack_t));
  configASSERT(qExhaust != nullptr && qAmbient != nullptr && qCmd != nullptr && qAck != nullptr);

  xTaskCreatePinnedToCore(Task_HazardSafety,      "HazSafe", 4096, nullptr, 4, nullptr, 1);
  xTaskCreatePinnedToCore(Task_SensorAcquisition, "SensAcq", 4096, nullptr, 3, nullptr, 1);
  xTaskCreatePinnedToCore(Task_ExhaustControl,    "ExhCtrl", 4096, nullptr, 2, nullptr, 1);
  xTaskCreatePinnedToCore(Task_Network,           "Network", 8192, nullptr, 1, nullptr, 0);
}

void loop() { vTaskDelete(nullptr); }
