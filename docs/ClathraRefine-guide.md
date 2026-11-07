# ClathraRefine Rev B: Build and Deployment Guide

Nov 7, 2026 · @Iliyas

## 1. Decisions this revision is built on

Revision B keeps the ESP32-S3 board, the two MQ-2 sensors, the six relays, AWS and the Next.js dashboard on Vercel. It fixes the bugs found in review, sends every reading to AWS, and adds a Jumia-style marketplace.

| Topic | Decision |
| --- | --- |
| Sensors | Two MQ-2 sensors only. The dashboard shows real MQ-2 readings; every CO2 figure is labelled "Simulated" |
| CO2 values in the simulation | Kept at or below 1% (10,000 ppm), so they match the range of a low-cost infrared CO2 sensor if one is added later |
| Cloud | AWS IoT Core in eu-west-1 (Ireland). Every reading is stored in AWS |
| Dashboard | Next.js on Vercel, Clerk for sign-in and roles |
| Marketplace | Multi-vendor, in the style of Jumia: vendors list products, buyers order and pay online, the platform takes a commission |
| Prediction | Short-term forecasting used for anomaly detection, advisory only |
| Safety principle | Alarms and relays run on the ESP32 and never wait for the network or the models |

## 2. Corrections register

Each issue below was found in the revision A dossier and is fixed in this guide.

| No. | Issue in revision A | Evidence | Fix in revision B |
| --- | --- | --- | --- |
| 1 | CO2 inlet 11.2%, outlet 0.9% and efficiency 91.96% shown as live, but both inputs are MQ-2 sensors | The MQ-2 target gases are LPG, propane, butane, methane and other combustibles; CO2 is not listed ([MQ-2 sheet](https://w11stop.com/files/others/mq-2-gas-sensor.pdf)) | CO2 panel labelled "Simulated", values kept at or below 1% (section 6) |
| 2 | AWS region af-south-1 | AWS IoT Core is listed in 25 regions, none in Africa ([AWS Fundamentals](https://awsfundamentals.com/regions/service/aws-iot-core)) | Use eu-west-1 (Ireland). Confirm in the AWS console region list before creating resources |
| 3 | 10k/18k divider gives 3.21 V at the pin | The ESP32-S3 ADC at 11 dB measures 0 to 3,100 mV ([Espressif](https://docs.espressif.com/projects/esp-idf/en/v4.4.4/esp32s3/api-reference/peripherals/adc.html)) | 10k/15k divider, giving 3.0 V at 5 V sensor output. Read with `analogReadMilliVolts()` |
| 4 | Pump can stay off when gas returns during purging | The PURGING state moved to SCRUBBING without switching the pump on | Pump and fan switched on when gas returns (section 4) |
| 5 | No hysteresis on any threshold | A reading near a threshold toggles relays and lamps repeatedly | On and off thresholds 100 mV apart |
| 6 | Critical alarm clears itself the moment the reading drops | Industrial alarms latch until an operator acknowledges them | Latched trip, acknowledge button on GPIO4, siren silence separate from reset |
| 7 | Alarms active while the MQ-2 heater is cold | Cold metal-oxide sensors read high after power-on | 3-minute warm-up: yellow lamp, no trips. Burn new sensors in before calibrating |
| 8 | No watchdog | A hung task leaves relays in their last state | Task watchdog on the three safety tasks, plus a sensor-data timeout that trips the alarm |
| 9 | No AWS code in the firmware | The dossier describes AWS but the firmware has no network task | Network task on core 0 with MQTT over TLS, offline buffer in PSRAM (section 4) |
| 10 | Thresholds in raw ADC counts | Raw counts change with divider and attenuation | Thresholds in sensor millivolts, converted from the revision A values |
| 11 | Rich solvent pH 8.1 with the carbonate-only equation | pH 12.4 is about 0.025 M NaOH. pH near 8 is the bicarbonate region | Two-step reaction shown on the UI (section 6) |
| 12 | Timestream as a possible data store | Timestream for LiveAnalytics closed to new customers on 20 June 2025 ([AWS](https://docs.aws.amazon.com/timestream/latest/developerguide/AmazonTimestreamForLiveAnalytics-availability-change.html)) | DynamoDB for live data, S3 for the archive |
| 13 | Supervisor PIN `8821` written in the dossier and UI | A shared PIN identifies nobody and is now public | PIN removed. Overrides need two different signed-in supervisors, enforced on the server |
| 14 | SCRAM requires supervisor confirmation | An emergency stop that waits for a second person slows the safe action | SCRAM is one click for any signed-in operator. Two-person approval applies to actions that reduce safety: bypasses, threshold changes, relay overrides |
| 15 | Marketplace sells food-grade CO2, biomethane and "Verified Carbon Credits" | The prototype produces none of these | Listings marked "Demo"; "Verified" removed (section 8) |
| 16 | Exchange rate fixed at ₦1,450 per US dollar | October 2026 rates were about ₦1,333 official and ₦1,357 parallel ([TechEconomy](https://techeconomy.ng/dollar-to-naira-naira-slips-to-133290-at-official-market-strengthens-to-1357-parallel)) | Rate stored as a setting, not hard-coded |
| 17 | OSHA 1910 in the compliance exports | OSHA is United States law | Exports labelled as templates. Nigerian references: NUPRC methane guidelines, NMDPRA, NESREA |
| 18 | "Clathra" in the name | Suggests clathrate hydrate capture; the system uses a caustic solvent | Team decision; be ready to explain the name to judges |

## 3. Hardware and wiring changes

Three wiring changes and one added button. Every other connection stays as in revision A.

### Pin map, revision B

| Board pin | Connected to | Type | Change from revision A |
| --- | --- | --- | --- |
| GPIO1 | MQ-2 "exhaust" analogue output | ADC1 input | Divider now 10 kΩ (top) and 15 kΩ (bottom) |
| GPIO2 | MQ-2 "ambient" analogue output | ADC1 input | Same divider change |
| GPIO4 | Acknowledge push button to GND | Digital input, internal pull-up | New |
| GPIO6 | Relay 1, extraction fan | Digital output, active LOW | None |
| GPIO7 | Relay 2, solvent pump | Digital output, active LOW | None |
| GPIO8 | Relay 3, red lamp | Digital output, active LOW | None |
| GPIO9 | Relay 4, green lamp | Digital output, active LOW | None |
| GPIO10 | Relay 5, yellow lamp | Digital output, active LOW | None |
| GPIO11 | Relay 6, siren | Digital output, active LOW | None |

All pins avoid the octal PSRAM lines (GPIO35 to 37), the strapping pins (GPIO0, 3, 45, 46) and the USB pins (GPIO19, 20) ([atomic14 module notes](https://www.atomic14.com/esp32/modules/esp32-s3-wroom-1/)). GPIO1, 2 and 4 are ADC1 pins, which keep working while Wi-Fi is on.

### Divider

```latex
V_{pin} = V_{sensor} \times \frac{15}{10 + 15} = 5.0 \times 0.6 = 3.0\ \mathrm{V}
```

The firmware multiplies the pin reading by 25/15 to get back the sensor voltage. Use 1% resistors if you can; small resistor errors shift every threshold.

### Relay modules

- Many active-LOW relay boards are powered at 5 V. A 3.3 V HIGH from the ESP32 can leave their input LED partly on, so the relay may not release. Before the event, check each relay switches off when its pin is HIGH.
- If it does not, use relay boards rated for 3.3 V logic, or drive them through a transistor array such as a ULN2003.
- Relay inputs float for a moment at power-up, before the firmware runs. Watch the relays at reset; if any click, fit a pull-up resistor that holds the input at its off level.

### Sensors

- MQ-2 heaters draw a large current. Power them from the 5 V supply, not from a board pin.
- Burn new MQ-2 sensors in by leaving them powered for 24 to 48 hours before calibrating. Confirm the exact preheat time on the datasheet for your module.

## 4. Firmware revision B

Four tasks run on the board. Three safety tasks share core 1 and never wait for the network. The network task runs alone on core 0 and only reads a copy of the plant status.

| Task | Core | Priority | Job |
| --- | --- | --- | --- |
| HazardSafety | 1 | 4 | Alarm levels, latched trip, acknowledge button, SCRAM, sensor-timeout trip |
| SensorAcquisition | 1 | 3 | Reads both MQ-2 sensors every 100 ms, 16 samples averaged |
| ExhaustControl | 1 | 2 | Fan and pump sequence: 2 s stagger, 5 s purge |
| Network | 0 | 1 | Wi-Fi, MQTT over TLS to AWS, telemetry every 2 s, offline buffer, SCRAM commands |

### Board settings (Arduino IDE)

- Board: ESP32S3 Dev Module, Arduino-ESP32 core 3.x
- Flash size: 16 MB; PSRAM: OPI PSRAM; USB CDC on boot: Enabled
- Libraries: **MQTT** by Joel Gaehwiler (the library used in [AWS's own ESP32 guide](https://aws.amazon.com/blogs/compute/building-an-aws-iot-core-device-using-aws-serverless-and-an-esp32/)) and **ArduinoJson** version 7

### secrets.h (never commit this file)

```cpp
#pragma once
#include <pgmspace.h>

#define THING_NAME        "ESP32S3-N16R8-HARNESS-01"   // must match the AWS IoT thing name
#define WIFI_SSID         "your-wifi-name"
#define WIFI_PASSWORD     "your-wifi-password"
#define AWS_IOT_ENDPOINT  "xxxxxxxxxxxxxx-ats.iot.eu-west-1.amazonaws.com"  // AWS IoT console > Settings

// Amazon Root CA 1
static const char AWS_CERT_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
paste AmazonRootCA1.pem here
-----END CERTIFICATE-----
)EOF";

// Device certificate
static const char AWS_CERT_CRT[] PROGMEM = R"KEY(
-----BEGIN CERTIFICATE-----
paste xxxx-certificate.pem.crt here
-----END CERTIFICATE-----
)KEY";

// Device private key
static const char AWS_CERT_PRIVATE[] PROGMEM = R"KEY(
-----BEGIN RSA PRIVATE KEY-----
paste xxxx-private.pem.key here
-----END RSA PRIVATE KEY-----
)KEY";
```

Add `secrets.h` to `.gitignore` before the first commit.

### Main sketch

```cpp
/**
 * ClathraRefine firmware, revision B
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
static constexpr uint8_t PIN_ACK_BUTTON  = 4;   // push button to GND
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

// ---------------- Shared state ----------------
enum class ScrubberState : uint8_t { IDLE, INTAKE_ACTIVE, SCRUBBING, PURGING };
enum class AlarmLevel    : uint8_t { NORMAL, WARNING, CRITICAL };

struct SensorTelemetry_t {
  uint16_t exhaustMv;
  uint16_t ambientMv;
  uint32_t uptimeMs;
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
};

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
};

static PlantStatus_t gStatus;
static portMUX_TYPE gMux = portMUX_INITIALIZER_UNLOCKED;
static volatile bool gScramRequest = false;   // set by a cloud command, handled by HazardSafety
static QueueHandle_t qExhaust = nullptr;
static QueueHandle_t qAmbient = nullptr;

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
    SensorTelemetry_t t{readSensorMv(PIN_MQ2_EXHAUST), readSensorMv(PIN_MQ2_AMBIENT), millis()};
    xQueueOverwrite(qExhaust, &t);
    xQueueOverwrite(qAmbient, &t);
    portENTER_CRITICAL(&gMux);
    gStatus.exhaustMv = t.exhaustMv;
    gStatus.ambientMv = t.ambientMv;
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
  SensorTelemetry_t rx;
  for (;;) {
    esp_task_wdt_reset();
    if (xQueueReceive(qExhaust, &rx, pdMS_TO_TICKS(500)) != pdTRUE) continue;  // stale data is handled by HazardSafety

    bool scram;
    portENTER_CRITICAL(&gMux);
    scram = gStatus.scram;
    portEXIT_CRITICAL(&gMux);

    if (scram) {
      // SCRAM: stop the pump, keep extraction running
      setRelay(RELAY_2_PUMP, false);
      setRelay(RELAY_1_INTAKE, true);
      state = ScrubberState::IDLE;
      gasActive = false;
      wasScram = true;
    } else {
      if (wasScram) { setRelay(RELAY_1_INTAKE, false); wasScram = false; }

      // Hysteresis: separate on and off thresholds stop relay chatter
      if (!gasActive && rx.exhaustMv >= EXH_ON_MV)       gasActive = true;
      else if (gasActive && rx.exhaustMv <= EXH_OFF_MV)  gasActive = false;
      if (inWarmup()) gasActive = false;   // a cold MQ-2 reads high

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
static volatile bool gAckPending = false;
static char gAckCmd[24] = {0};

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
  doc["fw"]             = "rev-B";
  return serializeJson(doc, out, len);
}

static bool publishTo(const String &topic, const BufferedRecord_t &r, bool buffered) {
  char payload[512];
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
  if (strcmp(cmd, "scram") == 0) gScramRequest = true;
  strncpy(gAckCmd, cmd, sizeof(gAckCmd) - 1);
  gAckPending = true;
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

    if (gAckPending && mqtt.connected()) {
      gAckPending = false;
      JsonDocument ack;
      ack["cmd"] = gAckCmd;
      ack["accepted"] = (strcmp(gAckCmd, "scram") == 0 || strcmp(gAckCmd, "ping") == 0);
      ack["uptime_ms"] = millis();
      char out[160];
      size_t n = serializeJson(ack, out, sizeof(out));
      mqtt.publish(topicAck.c_str(), out, n, false, 1);
    }

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

  esp_task_wdt_config_t wdt = {.timeout_ms = WDT_TIMEOUT_MS, .idle_core_mask = 0, .trigger_panic = true};
  if (esp_task_wdt_reconfigure(&wdt) != ESP_OK) esp_task_wdt_init(&wdt);

  qExhaust = xQueueCreate(1, sizeof(SensorTelemetry_t));
  qAmbient = xQueueCreate(1, sizeof(SensorTelemetry_t));
  configASSERT(qExhaust != nullptr && qAmbient != nullptr);

  xTaskCreatePinnedToCore(Task_HazardSafety,      "HazSafe", 4096, nullptr, 4, nullptr, 1);
  xTaskCreatePinnedToCore(Task_SensorAcquisition, "SensAcq", 4096, nullptr, 3, nullptr, 1);
  xTaskCreatePinnedToCore(Task_ExhaustControl,    "ExhCtrl", 4096, nullptr, 2, nullptr, 1);
  xTaskCreatePinnedToCore(Task_Network,           "Network", 8192, nullptr, 1, nullptr, 0);
}

void loop() { vTaskDelete(nullptr); }
```

### Behaviour to check on the bench

- **Power-on:** yellow lamp for 3 minutes (warm-up), then green.
- **Gas at the exhaust sensor:** fan on, pump on 2 s later; both off 5 s after the gas clears.
- **Gas at the ambient sensor:** yellow from about 1.41 V, red and siren from about 2.71 V; red stays on until the reading is back to normal and the button is pressed.
- **Known gap, a disconnected MQ-2:** its output drops towards 0 V, which looks like clean air, so the board does not trip. The sensor-timeout trip only covers a stalled firmware task. The dashboard flags any reading below 100 mV as "Check sensor" (section 6).
- **Cloud SCRAM:** pump stops, fan runs, red lamp and siren on; only the local button clears it.
- **Wi-Fi off for 5 minutes, then on:** the dashboard fills the gap from the buffer.

## 5. AWS setup, step by step

The board publishes to AWS IoT Core. A rule stores every reading in DynamoDB for the dashboard and in S3 for model training. The dashboard sends commands back through IoT Core only.

&#91;embedded content: cloud architecture · data path and command path\]

### Step 1. Account and region

1. Create an AWS account, turn on multi-factor sign-in for the root user, and create a separate admin user for daily work.
2. Select **Europe (Ireland) eu-west-1** at the top right of the console. Use this region for every step.
3. In **Billing > Budgets**, create a monthly budget of US$5 with an email alert, so no charge surprises you.

### Step 2. Create the thing and its certificate

1. Open **AWS IoT Core > Manage > All devices > Things > Create things > Create single thing**.
2. Thing name: `ESP32S3-N16R8-HARNESS-01`. It must match `THING_NAME` in `secrets.h`.
3. Choose **Auto-generate a new certificate**.
4. Download the device certificate, the private key and **Amazon Root CA 1**. The private key can only be downloaded once. Store all three outside the code repository.
5. Attach the policy from step 3 (create it first in another tab, or attach it afterwards under **Security > Certificates**).

### Step 3. Device policy

Create it under **Security > Policies > Create policy > JSON**. Replace `ACCOUNT_ID` with your 12-digit account number. The policy lets each board connect only as itself and use only its own topics. It works because the firmware uses the thing name as its MQTT client ID, which AWS requires for the `iot:Connection.Thing.ThingName` variable ([AWS thing policy variables](https://docs.aws.amazon.com/iot/latest/developerguide/thing-policy-variables.md)).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iot:Connect",
      "Resource": "arn:aws:iot:eu-west-1:ACCOUNT_ID:client/${iot:Connection.Thing.ThingName}",
      "Condition": { "Bool": { "iot:Connection.Thing.IsAttached": "true" } }
    },
    {
      "Effect": "Allow",
      "Action": "iot:Publish",
      "Resource": [
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/clathrarefine/${iot:Connection.Thing.ThingName}/telemetry",
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/clathrarefine/${iot:Connection.Thing.ThingName}/events",
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/clathrarefine/${iot:Connection.Thing.ThingName}/cmd/ack"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "iot:Subscribe",
      "Resource": "arn:aws:iot:eu-west-1:ACCOUNT_ID:topicfilter/clathrarefine/${iot:Connection.Thing.ThingName}/cmd"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Receive",
      "Resource": "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/clathrarefine/${iot:Connection.Thing.ThingName}/cmd"
    }
  ]
}
```

### Step 4. First connection test

1. Copy the endpoint from **AWS IoT Core > Settings > Device data endpoint** (it ends in `-ats.iot.eu-west-1.amazonaws.com`) into `secrets.h`.
2. Paste the three certificate files into `secrets.h` and flash the board.
3. Open **MQTT test client**, subscribe to `clathrarefine/#`.
4. Within a few seconds you should see a telemetry message every 2 s. If nothing arrives, check in this order: Wi-Fi name and password, endpoint, thing name spelling, policy attached to the certificate, certificate marked **Active**.

### Step 5. Storage

Create these in **DynamoDB > Tables > Create table**:

| Table | Partition key | Sort key | Notes |
| --- | --- | --- | --- |
| `ClathraTelemetry` | `device` (String) | `sk` (String) | Turn on Time to Live with attribute `expires`, so records delete themselves after 30 days |
| `ClathraEvents` | `device` (String) | `sk` (String) | Same Time to Live setting |
| `ClathraCommands` | `request_id` (String) | none | Holds SCRAM and override requests from the dashboard |

Then create an S3 bucket such as `clathrarefine-archive-<your-initials>` in eu-west-1, with public access blocked.

### Step 6. Rules that store every reading

Create under **Message routing > Rules > Create rule**, SQL version 2016-03-23.

**Rule `TelemetryToStore`:**

```sql
SELECT *,
  topic(2) AS device,
  concat(concat(cast(timestamp() AS String), '#'), newuuid()) AS sk,
  timestamp() AS ingest_ms,
  floor(timestamp() / 1000) + 2592000 AS expires
FROM 'clathrarefine/+/telemetry'
```

Actions:

1. **DynamoDBv2**, table `ClathraTelemetry`, with a new IAM role created from the console. Each JSON field becomes its own column, and the table keys come from `device` and `sk` above ([AWS DynamoDB rule action](https://docs.aws.amazon.com/iot/latest/developerguide/dynamodb-rule-action.md)).
2. **S3**, bucket `clathrarefine-archive-...`, key `${topic(2)}/${parse_time("yyyy/MM/dd", timestamp())}/${timestamp()}-${newuuid()}.json`.

The sort key starts with the arrival time in milliseconds, so records sort by time, and the random suffix stops two records that arrive in the same millisecond from overwriting each other. The device's own clock reading is kept in the `ts` field.

**Rule `EventsToStore`:** the same SQL with `FROM 'clathrarefine/+/events'` and a DynamoDBv2 action into `ClathraEvents`.

### Step 7. Check the whole path

1. With the board running, open `ClathraTelemetry` in **DynamoDB > Explore items**. A new row should appear every 2 s.
2. Hold gas near the ambient sensor. A row with `ambient_level` `WARNING` or `CRITICAL` should appear in `ClathraEvents`.
3. In the MQTT test client, publish `{"cmd":"ping"}` to `clathrarefine/ESP32S3-N16R8-HARNESS-01/cmd`. An acknowledgement should arrive on `.../cmd/ack`.

### Running cost

| Item | Use at one message every 2 s | Price | Expected cost |
| --- | --- | --- | --- |
| IoT Core messages | About 1.3 million a month | Free tier: 500,000 a month for the first 12 months. Then US$1 per million; messages metered in 5 KB steps ([AWS IoT pricing](https://aws.amazon.com/iot/pricing/)) | Under US$1.50 a month |
| IoT Core connection | About 43,000 minutes a month | Free tier: 2.25 million minutes for 12 months; then US$0.08 per million minutes | Near zero |
| DynamoDB | About 1.3 million small writes a month; 30-day expiry keeps storage under 1 GB | Always-free allowance of 25 GB storage and 25 read and 25 write capacity units on provisioned tables ([usage.ai summary](https://usage.ai/blogs/aws/reserved-instances/dynamodb/free-tier/)) | Free if the tables use provisioned capacity within the allowance |
| S3 archive | Under 1 GB a month | Standard storage pricing | A few cents |

Prices are AWS's published examples and can vary by region. Check the AWS pricing calculator for eu-west-1 before the event.

## 6. Dashboard on Vercel

The dashboard reads DynamoDB and sends SCRAM through IoT Core. It holds no AWS keys: Vercel proves its identity to AWS with a short-lived OIDC token, and AWS lets it take on one narrow IAM role ([Vercel OIDC for AWS](https://vercel.com/docs/oidc/aws)). Sign-in and roles come from Clerk.

### Step 1. Let Vercel into AWS without keys

1. In Vercel, open the project, then **Settings > Security**, and confirm OIDC Federation is on with **Team** issuer mode. Note your team slug (the part after `vercel.com/` in your team URL).
2. In AWS, open **IAM > Identity providers > Add provider > OpenID Connect**. Provider URL `https://oidc.vercel.com/TEAM_SLUG`, audience `https://vercel.com/TEAM_SLUG`.
3. Create an IAM role `ClathraDashboardRole` with this trust policy. It allows only your project, in production and local development:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/oidc.vercel.com/TEAM_SLUG" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": { "oidc.vercel.com/TEAM_SLUG:aud": "https://vercel.com/TEAM_SLUG" },
        "StringLike": {
          "oidc.vercel.com/TEAM_SLUG:sub": [
            "owner:TEAM_SLUG:project:PROJECT_NAME:environment:production",
            "owner:TEAM_SLUG:project:PROJECT_NAME:environment:development"
          ]
        }
      }
    }
  ]
}
```

4. Give the role only what the dashboard and marketplace need:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:Query", "dynamodb:GetItem"],
      "Resource": [
        "arn:aws:dynamodb:eu-west-1:ACCOUNT_ID:table/ClathraTelemetry",
        "arn:aws:dynamodb:eu-west-1:ACCOUNT_ID:table/ClathraEvents"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query", "dynamodb:Scan"],
      "Resource": [
        "arn:aws:dynamodb:eu-west-1:ACCOUNT_ID:table/ClathraCommands",
        "arn:aws:dynamodb:eu-west-1:ACCOUNT_ID:table/ClathraProducts",
        "arn:aws:dynamodb:eu-west-1:ACCOUNT_ID:table/ClathraOrders"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "iot:Publish",
      "Resource": "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/clathrarefine/*/cmd"
    }
  ]
}
```

The role can publish only to the `cmd` topic, and the board accepts only `scram` and `ping` there. Nothing in the cloud can clear a trip, silence the siren or change a threshold on the board.

### Step 2. Clerk sign-in and roles

1. Create a Clerk application and copy its two keys.
2. In Clerk, open **Sessions > Customize session token** and add `{"metadata": "{{user.public_metadata}}"}`, so the role travels with each request.
3. For each team member, set public metadata to `{"role": "viewer"}`, `{"role": "operator"}` or `{"role": "supervisor"}`. Give supervisor to at least two people, because overrides need a second supervisor.

| Role | Can do |
| --- | --- |
| viewer | See live readings, events and the marketplace |
| operator | All of the above, plus press SCRAM |
| supervisor | All of the above, plus request or approve a settings override (never their own) |

### Step 3. Environment variables

Set these in **Vercel > Settings > Environment Variables**, and pull them locally with `vercel env pull .env.local`:

```bash
AWS_REGION=eu-west-1
AWS_ROLE_ARN=arn:aws:iam::ACCOUNT_ID:role/ClathraDashboardRole
IOT_ENDPOINT=xxxxxxxxxxxxxx-ats.iot.eu-west-1.amazonaws.com
THING_NAME=ESP32S3-N16R8-HARNESS-01
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
PAYSTACK_SECRET_KEY=sk_test_...
```

Set `AWS_REGION` yourself: Vercel otherwise fills it with the function's own region, which can send AWS calls to the wrong place.

### Step 4. Install packages

```bash
npm i @clerk/nextjs @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-iot-data-plane @vercel/oidc-aws-credentials-provider recharts
```

### Step 5. Code

**`lib/aws.ts`**, one place for AWS clients:

```ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { IoTDataPlaneClient } from "@aws-sdk/client-iot-data-plane";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";

const region = process.env.AWS_REGION!;
const credentials = awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN! });

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region, credentials }));

export const iot = new IoTDataPlaneClient({
  region,
  credentials,
  endpoint: `https://${process.env.IOT_ENDPOINT}`,
});

export const THING = process.env.THING_NAME!;
```

**`lib/roles.ts`**, the server-side role check every API route uses:

```ts
import { auth } from "@clerk/nextjs/server";

export type Role = "viewer" | "operator" | "supervisor";

export async function requireRole(allowed: Role[]) {
  const { userId, sessionClaims } = await auth();
  if (!userId) return { ok: false as const, status: 401 };
  const role = ((sessionClaims?.metadata as { role?: Role } | undefined)?.role) ?? "viewer";
  if (!allowed.includes(role)) return { ok: false as const, status: 403 };
  return { ok: true as const, userId, role };
}
```

**`proxy.ts`** at the project root (name it `middleware.ts` if your Next.js version is 15 or older). It makes every page except the public ones require sign-in:

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher([
  "/",
  "/market(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/market/products(.*)",
  "/api/paystack/webhook",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

**`app/api/telemetry/route.ts`**, the latest readings, oldest first:

```ts
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, THING } from "@/lib/aws";
import { requireRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireRole(["viewer", "operator", "supervisor"]);
  if (!gate.ok) return new Response(null, { status: gate.status });

  const asked = Number(new URL(req.url).searchParams.get("limit") ?? 150);
  const limit = Math.min(Math.max(asked, 1), 900);

  const out = await ddb.send(new QueryCommand({
    TableName: "ClathraTelemetry",
    KeyConditionExpression: "#d = :d",
    ExpressionAttributeNames: { "#d": "device" },
    ExpressionAttributeValues: { ":d": THING },
    ScanIndexForward: false,
    Limit: limit,
  }));

  const rows = (out.Items ?? []).reverse().map((r) => ({
    ...r,
    // A disconnected MQ-2 reads near 0 V, which looks like clean air.
    check_sensor: Number(r.exhaust_mv) < 100 || Number(r.ambient_mv) < 100,
  }));
  return Response.json(rows);
}
```

**`app/api/scram/route.ts`**, one click for an operator or supervisor:

```ts
import { PublishCommand } from "@aws-sdk/client-iot-data-plane";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, iot, THING } from "@/lib/aws";
import { requireRole } from "@/lib/roles";

export async function POST() {
  const gate = await requireRole(["operator", "supervisor"]);
  if (!gate.ok) return new Response(null, { status: gate.status });

  const request_id = crypto.randomUUID();
  await ddb.send(new PutCommand({
    TableName: "ClathraCommands",
    Item: { request_id, kind: "scram", requested_by: gate.userId, at: Date.now(), status: "sent" },
  }));

  await iot.send(new PublishCommand({
    topic: `clathrarefine/${THING}/cmd`,
    qos: 1,
    payload: new TextEncoder().encode(JSON.stringify({ cmd: "scram" })),
  }));

  return Response.json({ request_id });
}
```

The dashboard confirms the SCRAM from the board's own telemetry (`scram: true`, `trip_latched: true`), not from the button press. The trip is then reset only at the board, with the ACK button, once readings are safe.

**`app/api/overrides/route.ts`** and **`app/api/overrides/[id]/approve/route.ts`**, the two-person rule. Overrides cover dashboard settings only, such as the display alert lines or the marketplace exchange rate. They never reach the board.

```ts
// app/api/overrides/route.ts
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "@/lib/aws";
import { requireRole } from "@/lib/roles";

const ALLOWED = new Set(["display_warn_mv", "display_crit_mv", "usd_ngn_rate"]);

export async function POST(req: Request) {
  const gate = await requireRole(["supervisor"]);
  if (!gate.ok) return new Response(null, { status: gate.status });

  const { setting, value, reason } = await req.json();
  if (!ALLOWED.has(setting) || typeof value !== "number" || !reason) {
    return new Response("Bad request", { status: 400 });
  }

  const request_id = crypto.randomUUID();
  await ddb.send(new PutCommand({
    TableName: "ClathraCommands",
    Item: { request_id, kind: "override", setting, value, reason,
            requested_by: gate.userId, at: Date.now(), status: "pending" },
  }));
  return Response.json({ request_id });
}
```

```ts
// app/api/overrides/[id]/approve/route.ts
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "@/lib/aws";
import { requireRole } from "@/lib/roles";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireRole(["supervisor"]);
  if (!gate.ok) return new Response(null, { status: gate.status });
  const { id } = await ctx.params;

  try {
    await ddb.send(new UpdateCommand({
      TableName: "ClathraCommands",
      Key: { request_id: id },
      // The database itself refuses approval by the requester.
      ConditionExpression: "#s = :pending AND requested_by <> :me",
      UpdateExpression: "SET #s = :approved, approved_by = :me, approved_at = :now",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":pending": "pending", ":approved": "approved", ":me": gate.userId, ":now": Date.now() },
    }));
  } catch {
    return new Response("Needs a pending request and a different supervisor", { status: 409 });
  }
  return Response.json({ ok: true });
}
```

**`app/dashboard/page.tsx`**, the live view. It polls every 3 s and shows only MQ-2 readings as live. The CO2 panel is labelled as simulated.

```tsx
"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type Row = {
  sk: string; ingest_ms: number; exhaust_mv: number; ambient_mv: number;
  ambient_level: string; scrubber: string; trip_latched: boolean;
  scram: boolean; warming_up: boolean; sensor_fault: boolean; check_sensor: boolean;
};

export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/telemetry?limit=150", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        setRows(await res.json());
        setError("");
      } catch (e) {
        setError("Cannot reach the data service");
      }
    };
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const last = rows[rows.length - 1];
  const stale = !last || Date.now() - last.ingest_ms > 10000;

  const scram = async () => {
    const res = await fetch("/api/scram", { method: "POST" });
    if (!res.ok) alert("SCRAM not sent: you need the operator or supervisor role.");
  };

  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h1>ClathraRefine live</h1>
      {error && <p role="alert">{error}</p>}
      {stale && <p role="alert">No reading for over 10 s. Check the board and Wi-Fi.</p>}
      {last?.check_sensor && <p role="alert">Check sensor: a reading is below 100 mV.</p>}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <Card title="Exhaust MQ-2" value={last ? `${last.exhaust_mv} mV` : "-"} />
        <Card title="Ambient MQ-2" value={last ? `${last.ambient_mv} mV, ${last.ambient_level}` : "-"} />
        <Card title="Scrubber" value={last ? last.scrubber : "-"} />
        <Card title="Trip" value={last ? (last.trip_latched ? "LATCHED: reset at the board" : "Clear") : "-"} />
        <Card title="CO2 (SIMULATED)" value="Model output, not a sensor reading" />
      </section>

      <div style={{ height: 280, marginTop: 16 }}>
        <ResponsiveContainer>
          <LineChart data={rows}>
            <XAxis dataKey="ingest_ms" tickFormatter={(v) => new Date(v).toLocaleTimeString("en-GB")} />
            <YAxis unit=" mV" />
            <Tooltip labelFormatter={(v) => new Date(Number(v)).toLocaleTimeString("en-GB")} />
            <Line dataKey="exhaust_mv" name="Exhaust" dot={false} isAnimationActive={false} />
            <Line dataKey="ambient_mv" name="Ambient" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <button onClick={scram} style={{ marginTop: 16, padding: "12px 24px", background: "#b00020", color: "#fff", border: 0, borderRadius: 8 }}>
        SCRAM
      </button>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
```

Wrap the root layout in `<ClerkProvider>` as the Clerk Next.js quickstart shows.

### Step 6. Deploy

1. Push the project to GitHub. Check that `.env.local`, `secrets.h` and every `.pem` or `.key` file are listed in `.gitignore` first.
2. In Vercel, **Add New > Project**, import the repository and deploy.
3. Sign in, open `/dashboard`, and check that the readings match the MQTT test client.
4. Sign in as a viewer and press SCRAM. The request must fail with 403. Then repeat as an operator: the board must latch the trip within a few seconds.

The Vercel Hobby plan is free but for non-commercial use, which covers the hackathon. One open dashboard polling every 3 s makes about 1,200 requests an hour, well inside the Hobby allowance.

## 7. Models to train

Three models are worth building, and only two of them learn from your data. All three are advisory: they draw lines and raise notices on the dashboard. None of them can switch a relay. The board's fixed thresholds stay in charge of safety.

| Model | What it answers | Learns from | Where it runs |
| --- | --- | --- | --- |
| Short-term forecaster | Where will the ambient MQ-2 reading be in 30 s? | Your S3 archive | Dashboard API, from exported coefficients |
| Anomaly detector | Is this reading unusual for clean air, before it crosses a threshold? | Clean-air sessions in the archive | Dashboard API |
| CO2 capture simulator | What would the scrubber do with a 1% CO2 stream? | Chemistry, not data | Dashboard, labelled simulated |

### 7.1 Collect the training data first

A model is only as honest as its data. The board stores a reading every 2 s, so one hour gives 1,800 rows. Plan these sessions on the bench, all logged to S3 automatically:

1. **Clean air:** at least 3 hours spread over two days, board powered and warmed up. This teaches the normal level and drift.
2. **Exposures:** at least 20 short exposures, each 20 to 60 s, then wait for the reading to return to baseline. Use incense smoke, and separately an unlit butane lighter released for one second at 30 cm. Never have incense or any flame near the butane test.
3. **Labels:** keep a simple sheet as you go, saved as `labels.csv`:

```csv
start_utc,end_utc,kind
2026-11-08T10:15:00Z,2026-11-08T10:15:40Z,incense
2026-11-08T10:22:00Z,2026-11-08T10:22:02Z,butane
```

The board's clock comes from NTP, and the rule adds `ingest_ms`, so use a phone clock set to network time when writing labels.

### 7.2 Download the archive

```bash
pip install --break-system-packages boto3 pandas numpy scikit-learn
aws s3 sync s3://clathrarefine-archive-XX/ESP32S3-N16R8-HARNESS-01/ ./data
```

### 7.3 Training script

Save as `train_models.py` and run `python train_models.py`. It trains the forecaster against a fair baseline, builds the anomaly detector from clean air only, and exports both to `model.json` for the dashboard.

```python
import glob, json
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error

STEP_S = 2
HORIZON = 15          # 15 steps of 2 s = 30 s ahead
LAGS = [1, 2, 5, 10, 15]

# 1. Load every archived reading
rows = [json.load(open(p)) for p in glob.glob("data/**/*.json", recursive=True)]
df = pd.DataFrame(rows)
# Buffered readings arrive late, so use the board's own clock when it was set
df["t_ms"] = np.where(df["ts"] > 0, df["ts"], df["ingest_ms"])
df["t"] = pd.to_datetime(df["t_ms"], unit="ms", utc=True)
df = df.sort_values("t").drop_duplicates("t")

# 2. Drop readings the board itself marked as untrustworthy
df = df[(df["warming_up"] == False) & (df["sensor_fault"] == False)]
df = df[(df["ambient_mv"] >= 100) & (df["exhaust_mv"] >= 100)]

# 3. Put readings on an even 2 s grid; gaps over 10 s stay empty
s = df.set_index("t")[["ambient_mv", "exhaust_mv"]].resample(f"{STEP_S}s").mean()
s = s.interpolate(limit=5)

# 4. Mark labelled exposures
labels = pd.read_csv("labels.csv", parse_dates=["start_utc", "end_utc"])
s["exposed"] = False
for _, r in labels.iterrows():
    # Count 3 minutes after each exposure as exposed while the sensor recovers
    s.loc[r.start_utc : r.end_utc + pd.Timedelta(minutes=3), "exposed"] = True

# 5. Features: recent values, changes and short-window statistics
x = s["ambient_mv"]
feat = pd.DataFrame(index=s.index)
feat["now"] = x
for k in LAGS:
    feat[f"lag{k}"] = x.shift(k)
    feat[f"diff{k}"] = x - x.shift(k)
feat["mean30s"] = x.rolling(15).mean()
feat["std30s"] = x.rolling(15).std()
feat["exhaust_now"] = s["exhaust_mv"]
target = x.shift(-HORIZON)

data = feat.assign(target=target, exposed=s["exposed"]).dropna()

# 6. Split by time, never at random, so the test is on unseen hours
cut = int(len(data) * 0.7)
train, test = data.iloc[:cut], data.iloc[cut:]
cols = [c for c in feat.columns]

mu, sd = train[cols].mean(), train[cols].std().replace(0, 1)
model = Ridge(alpha=1.0).fit((train[cols] - mu) / sd, train["target"])
pred = model.predict((test[cols] - mu) / sd)

mae_model = mean_absolute_error(test["target"], pred)
mae_persist = mean_absolute_error(test["target"], test["now"])  # "no change" baseline
print(f"30 s forecast MAE: model {mae_model:.0f} mV, persistence {mae_persist:.0f} mV")

# 7. Anomaly detector from clean air only: robust z-score of level and 10 s rise
clean = train[~train["exposed"]]
med_lvl = clean["now"].median()
mad_lvl = (clean["now"] - med_lvl).abs().median() * 1.4826 or 1.0
med_rise = clean["diff5"].median()
mad_rise = (clean["diff5"] - med_rise).abs().median() * 1.4826 or 1.0

def score(df_):
    z_lvl = (df_["now"] - med_lvl) / mad_lvl
    z_rise = (df_["diff5"] - med_rise) / mad_rise
    return np.maximum(z_lvl, z_rise)

# Pick the lowest threshold that gives at most 1 false alarm per clean hour on test data
test_clean = test[~test["exposed"]]
clean_hours = len(test_clean) * STEP_S / 3600
threshold = None
for th in np.arange(3, 30, 0.5):
    alarms = (score(test_clean) > th).astype(int).diff().clip(lower=0).sum()
    if clean_hours > 0 and alarms / clean_hours <= 1:
        threshold = float(th)
        break

# How many labelled exposures the detector caught, and how fast
caught, delays = 0, []
for _, r in labels.iterrows():
    window = test.loc[r.start_utc : r.start_utc + pd.Timedelta(minutes=2)]
    hits = window[score(window) > (threshold or 1e9)]
    if len(hits):
        caught += 1
        delays.append((hits.index[0] - r.start_utc).total_seconds())
in_test = sum(1 for _, r in labels.iterrows() if r.start_utc >= test.index[0])
print(f"Threshold {threshold}; caught {caught}/{in_test} test exposures; "
      f"median delay {np.median(delays) if delays else 'n/a'} s")

# 8. Export for the dashboard
json.dump({
    "version": pd.Timestamp.utcnow().isoformat(),
    "forecast": {"horizon_s": HORIZON * STEP_S, "features": cols,
                 "mean": mu.tolist(), "scale": sd.tolist(),
                 "coef": model.coef_.tolist(), "intercept": float(model.intercept_),
                 "mae_mv": mae_model, "persistence_mae_mv": mae_persist},
    "anomaly": {"median_level": med_lvl, "mad_level": mad_lvl,
                "median_rise": med_rise, "mad_rise": mad_rise,
                "threshold": threshold},
}, open("model.json", "w"), indent=2)
print("Saved model.json")
```

### 7.4 How to judge the result

The check that matters is not the model's own score but a comparison with something simpler:

1. **Forecaster:** keep it only if its error is clearly below the persistence baseline, which just assumes "no change". Aim for at least 10% lower. If it is not lower, show no forecast line. Say so honestly at the pitch: on a bench this small, that is a valid finding.
2. **Anomaly detector:** report three numbers: exposures caught out of the total, median delay in seconds, and false alarms per clean hour. Compare the delay with the board's fixed warning threshold on the same exposures. The model earns its place only if it warns earlier at the same false-alarm rate.
3. **Retrain** whenever you move the board, swap a sensor, or after a few days of drift. MQ-2 readings shift with temperature, humidity and ageing, so a model from one room does not carry to another.

### 7.5 Use the model in the dashboard

Copy `model.json` into the project as `lib/model.json`. This function scores the newest readings. Call it in the telemetry route and return the result beside the rows.

```ts
import m from "./model.json";

// rows: oldest first, ambient_mv and diff values computed the same way as in training
export function forecastAndScore(amb: number[], exhaustNow: number) {
  const n = amb.length - 1;
  if (n < 15) return null;
  const now = amb[n];
  const f: Record<string, number> = { now, exhaust_now: exhaustNow };
  for (const k of [1, 2, 5, 10, 15]) {
    f[`lag${k}`] = amb[n - k];
    f[`diff${k}`] = now - amb[n - k];
  }
  const last15 = amb.slice(n - 14);
  const mean = last15.reduce((a, b) => a + b, 0) / 15;
  f.mean30s = mean;
  f.std30s = Math.sqrt(last15.reduce((a, b) => a + (b - mean) ** 2, 0) / 14);

  const p = m.forecast;
  const forecast = p.features.reduce(
    (acc, name, i) => acc + p.coef[i] * ((f[name] - p.mean[i]) / p.scale[i]),
    p.intercept,
  );

  const a = m.anomaly;
  const z = Math.max((now - a.median_level) / a.mad_level, (f.diff5 - a.median_rise) / a.mad_rise);
  return { forecast_mv: Math.round(forecast), anomaly: a.threshold !== null && z > a.threshold, z };
}
```

The dashboard must compute features from the same evenly spaced 2 s readings as training. If readings are missing, skip the forecast rather than guess.

### 7.6 CO2 capture simulator

The MQ-2 cannot measure CO2, so the CO2 panel is a calculation, clearly labelled. It uses the chemistry from section 2:

- The solvent at pH 12.4 is about 0.025 M NaOH. Taking it to carbonate (CO2 + 2OH⁻ → CO3²⁻ + H2O) uses 0.0125 mol CO2 per litre, about **0.55 g CO2 per litre**.
- A 1% CO2 stream at 1 L/min carries about 0.018 g CO2 per minute (CO2 at about 1.8 g/L near room temperature).
- So 2 L of solvent reaches carbonate after roughly 1 hour at full capture. After that the solution moves on towards bicarbonate, and pH falls towards about 8.

```ts
// Simulated only. Assumed starting capture efficiency; replace with a measured value if you get one.
export function simulateCapture(minutes: number, opts = {
  inletPct: 1.0, gasLpm: 1.0, solventL: 2.0, eff0: 0.6,
}) {
  const capacityG = 0.55 * opts.solventL;          // to carbonate
  const co2InPerMin = opts.gasLpm * (opts.inletPct / 100) * 1.8;
  let loadedG = 0;
  const out: { min: number; outletPct: number; loadingPct: number }[] = [];
  for (let t = 0; t <= minutes; t++) {
    const eff = opts.eff0 * Math.max(0, 1 - loadedG / capacityG);
    loadedG += co2InPerMin * eff;
    out.push({ min: t, outletPct: +(opts.inletPct * (1 - eff)).toFixed(3),
               loadingPct: +(100 * loadedG / capacityG).toFixed(1) });
  }
  return out;
}
```

The starting efficiency of 0.6 is an assumption, not a measurement. Show it on the panel so judges can see it.

## 8. Marketplace, Jumia style

Jumia is a multi-vendor marketplace: many sellers list in one catalogue, buyers pay the platform once, and the platform passes each seller their share after its commission. The ClathraRefine market copies that pattern at hackathon scale, with Paystack doing the money split.

### 8.1 What to build, and what to leave out

| Jumia feature | ClathraRefine version | For the hackathon |
| --- | --- | --- |
| Catalogue with categories, search and filters | Categories: Recovered products, Equipment and hire, Services, Data and reports | Build |
| Product page with photos, specs, seller, stock | Same, plus a "Demo listing" badge | Build |
| Cart and checkout | Cart in the browser; one seller per checkout | Build |
| Payment and seller payout | Paystack test mode with a subaccount per seller and a platform commission | Build |
| Order tracking | Pending payment, Paid, Processing, Shipped, Delivered, Cancelled | Build |
| Seller centre | Sellers add listings and move orders along | Build, simple |
| Verified-buyer reviews | Only buyers with a delivered order can review | Build if time allows |
| Own logistics and wallet (Jumia Logistics, JumiaPay) | Not needed | Leave out |

Every listing is marked **Demo** and Paystack stays in test mode. Selling chemicals such as sodium carbonate for real needs product quality and safety approvals in Nigeria, so do not take real payments for them.

Sample listings: "Sodium carbonate solution, 1 L (Demo)", "Bench scrubber skid hire, per day (Demo)", "Gas leak sensor retrofit, per site (Demo)", "Monthly emissions data report (Demo)".

### 8.2 Data

Two more DynamoDB tables in eu-west-1, both on-demand or within the free provisioned allowance:

| Table | Key | Main fields |
| --- | --- | --- |
| `ClathraProducts` | `product_id` | `seller_id`, `title`, `category`, `price_kobo`, `stock`, `images`, `specs`, `status` (`live` or `hidden`), `demo: true` |
| `ClathraOrders` | `order_id` | `buyer_id`, `buyer_email`, `seller_id`, `items`, `total_kobo`, `status`, `paystack_reference`, `created_at` |

Store money in kobo as whole numbers (₦150.00 is 15000), as Paystack does, so rounding never changes a price.

A seller is a Clerk user whose public metadata also holds their Paystack subaccount, for example `{"role": "viewer", "seller_subaccount": "ACCT_xxxxxxxx"}`.

### 8.3 Pages

| Path | Purpose |
| --- | --- |
| `/market` | Home: categories, search box, product grid |
| `/market/c/[category]` | Category list with price filter and sort |
| `/market/p/[id]` | Product page with Add to cart |
| `/market/cart` | Cart, then Checkout |
| `/market/orders` | The buyer's orders and their status |
| `/market/seller` | Seller centre: listings and incoming orders |

### 8.4 Paystack setup

1. Create a Paystack business account and stay in **Test mode**. Copy the test secret key into `PAYSTACK_SECRET_KEY`.
2. For each seller, create a subaccount. `percentage_charge` is the share the platform keeps ([Paystack split payments](https://paystack.com/docs/payments/split-payments/)). Get bank codes from `GET https://api.paystack.co/bank`.

```bash
curl https://api.paystack.co/subaccount \
  -H "Authorization: Bearer $PAYSTACK_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"business_name":"Demo Seller Ltd","settlement_bank":"058","account_number":"0000000000","percentage_charge":10}'
```

3. In **Settings > API Keys and Webhooks**, set the webhook URL to `https://YOUR-APP.vercel.app/api/paystack/webhook`.

### 8.5 Checkout route

The server works out the price from the database. It never trusts a price sent from the browser.

```ts
// app/api/market/checkout/route.ts
import { BatchGetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { ddb } from "@/lib/aws";

type CartLine = { product_id: string; qty: number };

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return new Response(null, { status: 401 });
  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) return new Response("No email on account", { status: 400 });

  const { lines } = (await req.json()) as { lines: CartLine[] };
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 20) {
    return new Response("Bad cart", { status: 400 });
  }

  const got = await ddb.send(new BatchGetCommand({
    RequestItems: { ClathraProducts: { Keys: lines.map((l) => ({ product_id: l.product_id })) } },
  }));
  const products = got.Responses?.ClathraProducts ?? [];

  let total = 0;
  const sellers = new Set<string>();
  const items = [];
  for (const l of lines) {
    const p = products.find((x) => x.product_id === l.product_id);
    const qty = Math.floor(Number(l.qty));
    if (!p || p.status !== "live" || qty < 1 || qty > p.stock) {
      return new Response(`Unavailable: ${p?.title ?? l.product_id}`, { status: 409 });
    }
    sellers.add(p.seller_id);
    total += p.price_kobo * qty;
    items.push({ product_id: p.product_id, title: p.title, qty, price_kobo: p.price_kobo });
  }
  if (sellers.size !== 1) return new Response("One seller per checkout", { status: 400 });

  const seller_id = [...sellers][0];
  const clerk = await clerkClient();
  const seller = await clerk.users.getUser(seller_id);
  const subaccount = (seller.publicMetadata as { seller_subaccount?: string }).seller_subaccount;
  if (!subaccount) return new Response("Seller not set up for payment", { status: 400 });

  const order_id = crypto.randomUUID();
  await ddb.send(new PutCommand({
    TableName: "ClathraOrders",
    Item: { order_id, buyer_id: user.id, buyer_email: email, seller_id, items,
            total_kobo: total, status: "pending_payment", created_at: Date.now() },
  }));

  const ps = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      amount: total,                 // kobo
      reference: order_id,
      subaccount,
      bearer: "account",             // platform pays the Paystack fee
      callback_url: `${new URL(req.url).origin}/market/orders`,
      metadata: { order_id },
    }),
  }).then((r) => r.json());

  if (!ps.status) return new Response("Payment could not start", { status: 502 });
  return Response.json({ authorization_url: ps.data.authorization_url });
}
```

The browser then sends the buyer to `authorization_url`.

### 8.6 Payment webhook

An order becomes Paid only when Paystack's signed webhook says so and a second check with Paystack confirms the amount. A buyer returning to the callback page proves nothing.

```ts
// app/api/paystack/webhook/route.ts
import crypto from "node:crypto";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "@/lib/aws";

export async function POST(req: Request) {
  const raw = await req.text();
  const expected = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!).update(raw).digest("hex");
  const given = req.headers.get("x-paystack-signature") ?? "";
  if (given.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response(null, { status: 401 });
  }

  const event = JSON.parse(raw);
  if (event.event !== "charge.success") return new Response(null, { status: 200 });
  const reference: string = event.data.reference;

  // Ask Paystack directly rather than trusting the webhook body alone
  const v = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  }).then((r) => r.json());

  const order = (await ddb.send(new GetCommand({ TableName: "ClathraOrders", Key: { order_id: reference } }))).Item;
  if (!order || v.data?.status !== "success" || v.data?.amount !== order.total_kobo) {
    return new Response(null, { status: 200 }); // log for review; do not mark paid
  }

  try {
    await ddb.send(new UpdateCommand({
      TableName: "ClathraOrders",
      Key: { order_id: reference },
      ConditionExpression: "#s = :pending",      // makes a repeated webhook harmless
      UpdateExpression: "SET #s = :paid, paystack_reference = :r, paid_at = :now",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":pending": "pending_payment", ":paid": "paid", ":r": reference, ":now": Date.now() },
    }));
  } catch {
    /* already paid */
  }
  return new Response(null, { status: 200 });
}
```

After the order is paid, reduce stock for each item with a conditional update (`stock >= :qty`) so stock never goes below zero.

### 8.7 Test it

1. Add two demo sellers, each with a test subaccount, and three listings each.
2. Buy as a third user with a Paystack test card from the Paystack test payments page.
3. Check that the order moves to Paid, stock falls, and the Paystack dashboard shows the split.
4. Send the same webhook twice (Paystack can retry). The order must stay Paid once, with stock reduced once.
5. Change a price in the browser's developer tools before checkout. The charge must still use the database price.

Paystack's published Nigerian local card fee is 1.5% plus ₦100, with the ₦100 waived under ₦2,500 and the fee capped at ₦2,000 ([Paystack pricing](https://paystack.com/pricing)). Test mode costs nothing.

## 9. Run book

The hackathon runs from 9 to 11 November 2026 in Port Harcourt. Work through these lists in order.

### 9.1 Before you travel

1. Power the board with both MQ-2 sensors for at least 24 hours (the burn-in in section 3), then record the clean-air readings.
2. Flash the Rev B firmware. Check each relay, the siren, the ACK button and the 180 s warm-up on the bench.
3. Complete section 5 step 7 and section 6 step 6. Every test must pass.
4. Collect the training data, run `train_models.py`, and write the three anomaly numbers and the forecast comparison on one slide.
5. Confirm that `secrets.h`, the certificates and `.env.local` are not in the Git repository: `git ls-files | grep -Ei 'secret|pem|key|env'` must print nothing.
6. Ask the organisers in writing whether incense, a butane lighter and a dilute NaOH solution are allowed in the hall. Do not bring them without a yes.
7. Transport: sodium hydroxide, even as pellets, and butane lighters are restricted on flights. If you fly, buy them locally or take the road.

### 9.2 Packing list

| Group | Items |
| --- | --- |
| Electronics | Board, two MQ-2 sensors plus one spare, relay board, siren, ACK button, power supply, extension lead, USB cable, laptop and charger |
| Network | Phone with mobile data for a hotspot; the Wi-Fi name and password already in `secrets.h` as a second network if your firmware supports it |
| Demo materials | Incense sticks and holder, butane lighter, sealed and labelled solvent bottle (0.025 M NaOH, pH about 12.4), pH strips |
| Safety | Nitrile gloves, splash goggles, 1 L of clean water for rinsing, paper towels, small CO2 or dry-powder extinguisher if allowed, printed one-page safety sheet |

### 9.3 On the day, 30 minutes before judging

1. Connect to the hotspot. Many venue networks block port 8883, which MQTT over TLS uses.
2. Power the board and wait out the 3-minute warm-up.
3. Open the MQTT test client and the dashboard side by side. Check that both update.
4. Sign in on the laptop as an operator. Keep a viewer account ready on a phone.
5. Wear gloves and goggles before you open the solvent.

### 9.4 Demo script, about 6 minutes

| Step | What you do | What the judges see |
| --- | --- | --- |
| 1 | Show clean air | Steady MQ-2 lines; the CO2 panel clearly marked Simulated |
| 2 | Bring smoking incense near the ambient sensor | Warning, then the siren; the trip latches |
| 3 | Press ACK once, then remove the incense, wait, press ACK again | Siren silenced; trip resets only after readings are safe |
| 4 | Puff the exhaust sensor with the unlit lighter (incense out and away) | Exhaust fan and scrubber relays switch on, with hysteresis |
| 5 | Press SCRAM from the viewer phone, then from the operator laptop | Viewer refused; operator SCRAM latches the board within seconds |
| 6 | Show the simulated 1% CO2 capture run | Outlet falls, solvent loading rises, assumption shown on screen |
| 7 | Buy a demo listing with a Paystack test card | Order goes to Paid; seller split visible in Paystack |
| 8 | Show the model slide | Forecast against the no-change baseline; caught exposures, delay, false alarms |

Close by stating the limits plainly: the MQ-2 detects combustible gases and smoke, not CO2; CO2 figures are simulated; this is a prototype, not a certified safety system.

### 9.5 If something fails

| Problem | Do this |
| --- | --- |
| No telemetry in AWS | Switch to the phone hotspot. The board keeps tripping locally and uploads its buffer when it reconnects |
| Dashboard shows an error | Show the MQTT test client and the serial monitor instead; check `AWS_ROLE_ARN` and `AWS_REGION` in Vercel |
| "Check sensor" notice | Reading below 100 mV: power off, reseat the sensor wiring, power on and wait out the warm-up |
| Relays chatter | Supply is sagging: use a separate 5 V supply for the relay board, sharing ground |
| Trip will not reset | Readings are still above the reset level. Ventilate and wait; never bypass the latch |
| Paystack test fails | Show a completed test order from earlier in the Paystack dashboard |
| Solvent on skin or in eyes | Rinse with clean water for at least 15 minutes and get first aid |

### 9.6 After the event

1. If the board leaves your control, set its certificate to **Inactive** in AWS IoT Core.
2. Keep the AWS budget alert. Delete the S3 archive and tables when you no longer need them.
3. Neutralise and dispose of leftover solvent as the venue or your department directs.
4. Rotate any key that was shown on screen during the event.

## 10. References

1. AWS. *Thing policy variables*, AWS IoT Core Developer Guide. https://docs.aws.amazon.com/iot/latest/developerguide/thing-policy-variables.html
2. AWS. *DynamoDBv2 rule action*, AWS IoT Core Developer Guide. https://docs.aws.amazon.com/iot/latest/developerguide/dynamodb-v2-rule-action.html
3. AWS. *AWS IoT Core pricing*. https://aws.amazon.com/iot-core/pricing/
4. AWS. *Amazon DynamoDB pricing*. https://aws.amazon.com/dynamodb/pricing/
5. AWS. *AWS IoT Core endpoints and quotas* (service regions). https://docs.aws.amazon.com/general/latest/gr/iot-core.html
6. Vercel. *Connect to Amazon Web Services (AWS)* with OIDC federation. https://vercel.com/docs/oidc/aws
7. Clerk. *Next.js quickstart* and *Basic role-based access control with metadata*. https://clerk.com/docs
8. Paystack. *Split payments*. https://paystack.com/docs/payments/split-payments/
9. Paystack. *Webhooks*. https://paystack.com/docs/payments/webhooks/
10. Paystack. *Pricing*. https://paystack.com/pricing
11. Espressif. *ESP32-S3 GPIO and RTC GPIO*, ESP-IDF Programming Guide. https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/gpio.html
12. Espressif. *ESP32-S3 ADC oneshot mode* (attenuation and input range). https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/adc\_oneshot.html
13. Hanwei Electronics. *MQ-2 gas sensor technical data*. https://www.pololu.com/file/0J309/MQ2.pdf
14. scikit-learn. *Ridge regression* user guide. https://scikit-learn.org/stable/modules/linear\_model.html#ridge-regression

Prices and service availability were checked in November 2026 and can change. Confirm them before relying on a figure.
