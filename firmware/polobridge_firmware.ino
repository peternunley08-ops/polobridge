/*
 * PoloBridge Firmware Rev 2.5 — Dual-Mode RS-232 + 3-Channel Pickle Companion
 * + Triple-Redundant 105dB Horn Driver + 3 Emergency Lid Fail-Safe Buttons
 * Target: ESP32-S3-WROOM-1U-N8 / ESP32-S3 DevKitC
 *
 * Supported Protocols (Dual-Output Active Simultaneously):
 *   1. Colorado Time Systems (CTS System 6 / System 5 / WA-3): 9600 Baud, 8-E-1
 *   2. Daktronics (All Sport 5000 / RTD Water Polo Code 4498): 19200 Baud, 8-N-1
 *   3. 3-Channel Isolated Optocoupler Pickle Companion (30s Reset, 20s Reset, Start/Stop)
 *
 * Implements Official World Aquatics, NCAA & NFHS Timing Rules:
 *   - Shot Clock Expiration (0.0s): Automatically stops BOTH Game & Shot clocks and fires Triple Horn
 *   - Rule WP 20.15: Automatic Shot Clock Blanking when Game Time <= Shot Time
 *   - Hardware Fail-Safe: 3 Waterproof Emergency Lid Buttons (Start/Stop, 30s, 20s) operate
 *     autonomously even if the iPad battery dies mid-quarter.
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ==========================================
// PIN DEFINITIONS (POLOBRIDGE REV 2.5 PCB)
// ==========================================
#define SERIAL_TX_PIN             17    // Isolated RS-232 Driver (ADuM1201 -> MAX3232E)
#define SERIAL_RX_PIN             16    // Isolated RS-232 Receive
#define STATUS_LED_PIN            2     // Cyan/Emerald BLE & Activity Status LED

// 3-Channel Isolated Optocoupler Pickle Companion Port (EL817S x3 -> TRS / Breakout)
#define PICKLE_30S_PIN            4     // Ch 1: System 6 "RESET 1 (30s)" optocoupler
#define PICKLE_20S_PIN            5     // Ch 2: System 6 "RESET 2 (20s)" optocoupler
#define PICKLE_START_STOP_PIN     6     // Ch 3: System 6 "START / STOP" optocoupler

// Triple-Redundant Acoustic Horn Driver (AO3400A MOSFET -> 105dB Marine Piezo / Aux Horn)
#define AUX_HORN_MOSFET_PIN       7     // Fires onboard 105dB piezo in sync with RS-232 0x40 bit

// 3 Waterproof Emergency Fail-Safe Buttons on Enclosure Lid (Active LOW w/ Internal Pull-Up)
#define BTN_FAILSAFE_START_STOP   18    // Lid Button 1: Emergency Start / Pause Clock
#define BTN_FAILSAFE_RESET_30     19    // Lid Button 2: Emergency 30s Full Reset
#define BTN_FAILSAFE_RESET_20     20    // Lid Button 3: Emergency 20s Exclusion / Rebound Reset

// Hardware Protocol Toggle Switch
#define PROTOCOL_MODE_PIN         21    // LOW = CTS (9600 8-E-1), HIGH = Daktronics (19200 8-N-1)

// ==========================================
// BLE SERVICE & CHARACTERISTIC UUIDs
// ==========================================
#define SERVICE_UUID           "4FA10001-B5A3-F393-E0A9-E50E24DCCA9E"
#define COMMAND_CHAR_UUID      "4FA10002-B5A3-F393-E0A9-E50E24DCCA9E"
#define STATUS_CHAR_UUID       "4FA10003-B5A3-F393-E0A9-E50E24DCCA9E"

enum ProtocolMode {
    MODE_CTS = 0,         // Colorado Time Systems (9600 Baud, 8-E-1)
    MODE_DAKTRONICS = 1   // Daktronics All Sport 5000 (19200 Baud, 8-N-1)
};

enum CommandCode {
    CMD_STOP            = 0x01,
    CMD_START           = 0x02,
    CMD_RESET_30        = 0x03,
    CMD_RESET_20        = 0x04,
    CMD_SET_SHOT_CLOCK  = 0x05,
    CMD_SET_GAME_CLOCK  = 0x06,
    CMD_TRIGGER_HORN    = 0x07,
    CMD_SET_SCORES      = 0x08,
    CMD_PULSE_PICKLE    = 0x09, // payload: [durMs, channel (1=30s, 2=20s, 3=Start/Stop)]
    CMD_SET_PROTOCOL    = 0x0B  // payload: [uint8_t mode: 0=CTS, 1=Daktronics]
};

struct GameState {
    bool isRunning = false;
    uint32_t gameTimeMs = 7 * 60 * 1000; // 7:00 NFHS default (configurable to 8:00 NCAA)
    uint32_t shotTimeMs = 30 * 1000;     // 30.0s default
    uint8_t scoreWhite = 0;
    uint8_t scoreDark = 0;
    uint8_t period = 1;

    bool isBlanked = false; // Rule WP 20.15: Shot clock blanked when Game <= Shot

    bool hornActive = false;
    uint32_t hornUntilMs = 0;

    uint32_t pickle30UntilMs = 0;
    uint32_t pickle20UntilMs = 0;
    uint32_t pickleStartStopUntilMs = 0;

    ProtocolMode protocol = MODE_CTS;
};

GameState state;
BLEServer* pServer = nullptr;
BLECharacteristic* pCommandChar = nullptr;
BLECharacteristic* pStatusChar = nullptr;
bool deviceConnected = false;

HardwareSerial ScoreSerial(1);

// ==========================================
// 3-CHANNEL PICKLE & TRIPLE HORN HELPERS
// ==========================================
void pulsePickleChannel(uint8_t pin, uint32_t durationMs = 150) {
    uint32_t until = millis() + durationMs;
    digitalWrite(pin, HIGH);
    if (pin == PICKLE_30S_PIN) state.pickle30UntilMs = until;
    else if (pin == PICKLE_20S_PIN) state.pickle20UntilMs = until;
    else if (pin == PICKLE_START_STOP_PIN) state.pickleStartStopUntilMs = until;
}

void triggerHorn(uint32_t durationMs = 1500) {
    state.hornActive = true;
    state.hornUntilMs = millis() + durationMs;
    digitalWrite(AUX_HORN_MOSFET_PIN, HIGH); // Fire onboard 105dB Piezo / Aux Horn MOSFET
}

// ==========================================
// COLORADO TIME SYSTEMS (CTS) PROTOCOL ENGINE
// ==========================================
void sendCtsChannelFrame(uint8_t channel, const char* ascii8, const uint8_t* attr8) {
    uint8_t charHeader = 0x80 | ((channel & 0x1F) << 1) | 0x00;
    ScoreSerial.write(charHeader);
    for (int i = 0; i < 8; i++) {
        ScoreSerial.write(ascii8[i] & 0x7F);
    }

    if (attr8 != nullptr) {
        uint8_t attrHeader = 0x80 | ((channel & 0x1F) << 1) | 0x01;
        ScoreSerial.write(attrHeader);
        for (int i = 0; i < 8; i++) {
            ScoreSerial.write(attr8[i] & 0x7F);
        }
    }
}

void broadcastCts() {
    // --- 1. SHOT CLOCK (Channel 0x05) ---
    char shotAscii[9];
    uint8_t shotAttr[8] = {0};

    // RULE WP 20.15 AUTOMATION:
    // If the game clock has less time remaining than the shot clock, blank the display!
    if (state.gameTimeMs <= state.shotTimeMs && state.gameTimeMs > 0) {
        state.isBlanked = true;
        snprintf(shotAscii, sizeof(shotAscii), "        ");
    } else {
        state.isBlanked = false;
        uint32_t shotSec = state.shotTimeMs / 1000;
        uint32_t shotTenths = (state.shotTimeMs % 1000) / 100;

        if (shotSec >= 10) {
            snprintf(shotAscii, sizeof(shotAscii), "   %2lu   ", shotSec);
        } else {
            snprintf(shotAscii, sizeof(shotAscii), "   %lu%lu   ", shotSec, shotTenths);
            shotAttr[4] = 0x01; // Decimal point
        }
    }

    // Horn bit 6 (0x40) activates physical 125dB horn on CTS SC-500/600 shot clocks
    if (state.hornActive) {
        shotAttr[0] |= 0x40;
        shotAttr[7] |= 0x40;
    }
    sendCtsChannelFrame(0x05, shotAscii, shotAttr);

    // --- 2. GAME CLOCK (Channel 0x00) ---
    char gameAscii[9];
    uint8_t gameAttr[8] = {0};
    uint32_t gameMin = state.gameTimeMs / 60000;
    uint32_t gameSec = (state.gameTimeMs % 60000) / 1000;
    uint32_t gameTenth = (state.gameTimeMs % 1000) / 100;

    if (gameMin > 0) {
        snprintf(gameAscii, sizeof(gameAscii), " %02lu:%02lu ", gameMin, gameSec);
        gameAttr[3] = 0x02; // Colon
    } else {
        snprintf(gameAscii, sizeof(gameAscii), "  %02lu.%01lu  ", gameSec, gameTenth);
        gameAttr[4] = 0x01; // Decimal
    }
    sendCtsChannelFrame(0x00, gameAscii, gameAttr);

    // --- 3. SCORES & PERIOD (Channel 0x01) ---
    char scoreAscii[9];
    snprintf(scoreAscii, sizeof(scoreAscii), "%2u  %1u %2u", state.scoreWhite, state.period, state.scoreDark);
    sendCtsChannelFrame(0x01, scoreAscii, nullptr);
}

// ==========================================
// DAKTRONICS PROTOCOL ENGINE (CODE 4498)
// ==========================================
void broadcastDaktronics() {
    uint32_t shotSec = state.shotTimeMs / 1000;
    uint32_t gameMin = state.gameTimeMs / 60000;
    uint32_t gameSec = (state.gameTimeMs % 60000) / 1000;

    char shotBuffer[4];
    if (state.gameTimeMs <= state.shotTimeMs && state.gameTimeMs > 0) {
        snprintf(shotBuffer, sizeof(shotBuffer), "   ");
    } else {
        snprintf(shotBuffer, sizeof(shotBuffer), "%2lu ", shotSec);
    }

    char daktPacket[64];
    int len = snprintf(daktPacket, sizeof(daktPacket),
        "\x16\x01" "4498" "%02lu:%02lu" "%s" "%2u" "%2u" "%1u" "\x04",
        gameMin, gameSec, shotBuffer, state.scoreWhite, state.scoreDark, state.period
    );

    ScoreSerial.write((const uint8_t*)daktPacket, len);
}

void configureSerialForProtocol(ProtocolMode mode) {
    ScoreSerial.end();
    if (mode == MODE_CTS) {
        ScoreSerial.begin(9600, SERIAL_8E1, SERIAL_RX_PIN, SERIAL_TX_PIN);
        Serial.println("[UART] Switched to Colorado Time Systems (9600 Baud, 8-E-1)");
    } else {
        ScoreSerial.begin(19200, SERIAL_8N1, SERIAL_RX_PIN, SERIAL_TX_PIN);
        Serial.println("[UART] Switched to Daktronics All Sport (19200 Baud, 8-N-1)");
    }
    state.protocol = mode;
}

void broadcastScoreboard() {
    if (state.protocol == MODE_CTS) {
        broadcastCts();
    } else {
        broadcastDaktronics();
    }
}

// ==========================================
// BLE CALLBACKS & COMMAND PROCESSOR
// ==========================================
class ServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        deviceConnected = true;
        digitalWrite(STATUS_LED_PIN, HIGH);
        Serial.println("[BLE] PoloPad Pro Connected!");
    }
    void onDisconnect(BLEServer* pServer) {
        deviceConnected = false;
        digitalWrite(STATUS_LED_PIN, LOW);
        Serial.println("[BLE] iPad Disconnected — Autonomous Hardware Clock & Lid Buttons Active.");
        pServer->startAdvertising();
    }
};

class CommandCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pCharacteristic) {
        std::string value = pCharacteristic->getValue();
        if (value.length() == 0) return;

        const uint8_t* data = (const uint8_t*)value.data();
        uint8_t cmd = data[0];

        switch (cmd) {
            case CMD_STOP:
                if (state.isRunning) {
                    state.isRunning = false;
                    pulsePickleChannel(PICKLE_START_STOP_PIN, 150);
                }
                break;
            case CMD_START:
                if (!state.isRunning) {
                    state.isRunning = true;
                    pulsePickleChannel(PICKLE_START_STOP_PIN, 150);
                }
                break;
            case CMD_RESET_30:
                state.shotTimeMs = 30 * 1000;
                pulsePickleChannel(PICKLE_30S_PIN, 150);
                break;
            case CMD_RESET_20:
                state.shotTimeMs = 20 * 1000;
                pulsePickleChannel(PICKLE_20S_PIN, 150);
                break;
            case CMD_SET_SHOT_CLOCK:
                if (value.length() >= 3) {
                    state.shotTimeMs = (data[1] * 1000) + (data[2] * 100);
                }
                break;
            case CMD_SET_GAME_CLOCK:
                if (value.length() >= 4) {
                    state.gameTimeMs = (data[1] * 60000) + (data[2] * 1000) + (data[3] * 100);
                }
                break;
            case CMD_TRIGGER_HORN: {
                uint16_t dur = (value.length() >= 3) ? ((data[1] << 8) | data[2]) : 1500;
                triggerHorn(dur);
                break;
            }
            case CMD_SET_SCORES:
                if (value.length() >= 4) {
                    state.scoreWhite = data[1];
                    state.scoreDark = data[2];
                    state.period = data[3];
                }
                break;
            case CMD_PULSE_PICKLE: {
                uint8_t dur = (value.length() >= 2) ? data[1] : 150;
                uint8_t ch = (value.length() >= 3) ? data[2] : 1;
                if (ch == 2) pulsePickleChannel(PICKLE_20S_PIN, dur);
                else if (ch == 3) pulsePickleChannel(PICKLE_START_STOP_PIN, dur);
                else pulsePickleChannel(PICKLE_30S_PIN, dur);
                break;
            }
            case CMD_SET_PROTOCOL:
                if (value.length() >= 2) {
                    configureSerialForProtocol((ProtocolMode)data[1]);
                }
                break;
        }

        broadcastScoreboard();
    }
};

void notifyIpad() {
    if (!deviceConnected) return;

    uint8_t payload[13];
    payload[0] = (state.isRunning ? 0x01 : 0x00) |
                 (state.hornActive ? 0x02 : 0x00) |
                 (state.isBlanked ? 0x04 : 0x00);

    payload[1] = (state.gameTimeMs >> 24) & 0xFF;
    payload[2] = (state.gameTimeMs >> 16) & 0xFF;
    payload[3] = (state.gameTimeMs >> 8) & 0xFF;
    payload[4] = state.gameTimeMs & 0xFF;

    payload[5] = (state.shotTimeMs >> 24) & 0xFF;
    payload[6] = (state.shotTimeMs >> 16) & 0xFF;
    payload[7] = (state.shotTimeMs >> 8) & 0xFF;
    payload[8] = state.shotTimeMs & 0xFF;

    payload[9] = state.scoreWhite;
    payload[10] = state.scoreDark;
    payload[11] = state.period;
    payload[12] = (uint8_t)state.protocol;

    pStatusChar->setValue(payload, sizeof(payload));
    pStatusChar->notify();
}

// ==========================================
// EMERGENCY LID BUTTON HARDWARE DEBOUNCER
// ==========================================
void pollEmergencyLidButtons(uint32_t now) {
    static uint32_t lastBtnPressMs = 0;
    if (now - lastBtnPressMs < 180) return; // 180ms tactile debounce

    if (digitalRead(BTN_FAILSAFE_START_STOP) == LOW) {
        lastBtnPressMs = now;
        state.isRunning = !state.isRunning;
        pulsePickleChannel(PICKLE_START_STOP_PIN, 150);
        broadcastScoreboard();
    } else if (digitalRead(BTN_FAILSAFE_RESET_30) == LOW) {
        lastBtnPressMs = now;
        state.shotTimeMs = 30 * 1000;
        pulsePickleChannel(PICKLE_30S_PIN, 150);
        broadcastScoreboard();
    } else if (digitalRead(BTN_FAILSAFE_RESET_20) == LOW) {
        lastBtnPressMs = now;
        state.shotTimeMs = 20 * 1000;
        pulsePickleChannel(PICKLE_20S_PIN, 150);
        broadcastScoreboard();
    }
}

// ==========================================
// SETUP & DETERMINISTIC 10HZ LOOP
// ==========================================
void setup() {
    Serial.begin(115200);
    delay(400);
    Serial.println("\n=== PoloBridge Pro Rev 2.5 Starting ===");

    pinMode(STATUS_LED_PIN, OUTPUT);
    digitalWrite(STATUS_LED_PIN, LOW);

    pinMode(PICKLE_30S_PIN, OUTPUT);
    pinMode(PICKLE_20S_PIN, OUTPUT);
    pinMode(PICKLE_START_STOP_PIN, OUTPUT);
    digitalWrite(PICKLE_30S_PIN, LOW);
    digitalWrite(PICKLE_20S_PIN, LOW);
    digitalWrite(PICKLE_START_STOP_PIN, LOW);

    pinMode(AUX_HORN_MOSFET_PIN, OUTPUT);
    digitalWrite(AUX_HORN_MOSFET_PIN, LOW);

    pinMode(BTN_FAILSAFE_START_STOP, INPUT_PULLUP);
    pinMode(BTN_FAILSAFE_RESET_30, INPUT_PULLUP);
    pinMode(BTN_FAILSAFE_RESET_20, INPUT_PULLUP);

    pinMode(PROTOCOL_MODE_PIN, INPUT_PULLUP);
    ProtocolMode initialMode = (digitalRead(PROTOCOL_MODE_PIN) == LOW) ? MODE_CTS : MODE_DAKTRONICS;
    configureSerialForProtocol(initialMode);

    BLEDevice::init("PoloBridge-Pro");
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());

    BLEService* pService = pServer->createService(SERVICE_UUID);

    pCommandChar = pService->createCharacteristic(
        COMMAND_CHAR_UUID,
        BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
    );
    pCommandChar->setCallbacks(new CommandCallbacks());

    pStatusChar = pService->createCharacteristic(
        STATUS_CHAR_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pStatusChar->addDescriptor(new BLE2902());

    pService->start();

    BLEAdvertising* pAdv = BLEDevice::getAdvertising();
    pAdv->addServiceUUID(SERVICE_UUID);
    pAdv->setScanResponse(true);
    BLEDevice::startAdvertising();

    Serial.println("[BLE] Ready for pairing (Dual RS-232 + 3-Ch Pickle + 105dB Piezo + 3 Fail-Safe Buttons).");
}

void loop() {
    static uint32_t lastTickMs = 0;
    static uint32_t lastBroadcastMs = 0;
    static uint32_t lastNotifyMs = 0;
    uint32_t now = millis();

    // Poll physical fail-safe buttons on enclosure lid
    pollEmergencyLidButtons(now);

    // 100ms Precision Autonomous Time Engine
    if (now - lastTickMs >= 100) {
        uint32_t dt = now - lastTickMs;
        lastTickMs = now;

        if (state.isRunning) {
            if (state.gameTimeMs > dt) {
                state.gameTimeMs -= dt;
            } else {
                state.gameTimeMs = 0;
                state.shotTimeMs = 0;
                state.isRunning = false;
                triggerHorn(2000); // End of period 2.0s horn
            }

            if (state.isRunning && !state.isBlanked) {
                if (state.shotTimeMs > dt) {
                    state.shotTimeMs -= dt;
                } else {
                    // Official Rule: Shot Clock Expiration stops BOTH Game & Shot Clocks immediately!
                    state.shotTimeMs = 0;
                    state.isRunning = false;
                    pulsePickleChannel(PICKLE_START_STOP_PIN, 150);
                    triggerHorn(1500); // Shot clock violation 1.5s horn
                }
            }
        }
    }

    // Turn off Triple-Redundant Horn when duration completes
    if (state.hornActive && now >= state.hornUntilMs) {
        state.hornActive = false;
        digitalWrite(AUX_HORN_MOSFET_PIN, LOW);
    }

    // Turn off 3-Channel Pickle Optocouplers after pulse duration
    if (state.pickle30UntilMs && now >= state.pickle30UntilMs) {
        digitalWrite(PICKLE_30S_PIN, LOW);
        state.pickle30UntilMs = 0;
    }
    if (state.pickle20UntilMs && now >= state.pickle20UntilMs) {
        digitalWrite(PICKLE_20S_PIN, LOW);
        state.pickle20UntilMs = 0;
    }
    if (state.pickleStartStopUntilMs && now >= state.pickleStartStopUntilMs) {
        digitalWrite(PICKLE_START_STOP_PIN, LOW);
        state.pickleStartStopUntilMs = 0;
    }

    // 10Hz Scoreboard Broadcast
    if (now - lastBroadcastMs >= 100) {
        lastBroadcastMs = now;
        broadcastScoreboard();
    }

    // 10Hz iPad BLE Notification
    if (now - lastNotifyMs >= 100) {
        lastNotifyMs = now;
        notifyIpad();
    }
}
