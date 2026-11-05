/*
 * PoloBridge Firmware - ESP32 / ESP32-S3
 * Bridges iPad (Bluetooth Low Energy) -> Colorado Time Systems (CTS) RS-232 Protocol
 *
 * Baud: 9600 Baud, 8 Data Bits, EVEN Parity, 1 Stop Bit (SERIAL_8E1)
 * Output: Hardware Serial TX -> MAX3232 Level Shifter -> 1/4" Mono Phone Jack
 *
 * Target: Aquatic timing consoles / Shot Clocks (CTS SC-500, SC-600, WA-3 Wireless Adapter)
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ==========================================
// PIN DEFINITIONS
// ==========================================
#define CTS_SERIAL_TX_PIN   17    // Connect to MAX3232 DIN (RS-232 Driver)
#define CTS_SERIAL_RX_PIN   16    // Optional (CTS scoreboards are receive-only)
#define STATUS_LED_PIN      2     // Onboard status LED
#define RELAY_PICKLE_PIN    4     // Optocoupler relay for System 6 Pickle switch tap

// ==========================================
// BLE SERVICE & CHARACTERISTIC UUIDs
// ==========================================
#define SERVICE_UUID           "4FA10001-B5A3-F393-E0A9-E50E24DCCA9E"
#define COMMAND_CHAR_UUID      "4FA10002-B5A3-F393-E0A9-E50E24DCCA9E" // iPad -> Dongle (Write)
#define STATUS_CHAR_UUID       "4FA10003-B5A3-F393-E0A9-E50E24DCCA9E" // Dongle -> iPad (Notify)

// ==========================================
// PROTOCOL COMMAND CODES
// ==========================================
enum CommandCode {
    CMD_STOP            = 0x01,
    CMD_START           = 0x02,
    CMD_RESET_30        = 0x03,
    CMD_RESET_20        = 0x04,
    CMD_SET_SHOT_CLOCK  = 0x05, // payload: [uint8_t seconds, uint8_t tenths]
    CMD_SET_GAME_CLOCK  = 0x06, // payload: [uint8_t minutes, uint8_t seconds, uint8_t tenths]
    CMD_TRIGGER_HORN    = 0x07, // payload: [uint16_t duration_ms]
    CMD_SET_SCORES      = 0x08, // payload: [uint8_t white, uint8_t dark, uint8_t period]
    CMD_PULSE_PICKLE    = 0x09, // payload: [uint8_t duration_ms]
    CMD_SYNC_STATE      = 0x0A  // payload: full game sync from iPad
};

// ==========================================
// GAME STATE STRUCT
// ==========================================
struct GameState {
    bool isRunning = false;
    uint32_t gameTimeMs = 8 * 60 * 1000; // 8 minutes default
    uint32_t shotTimeMs = 30 * 1000;      // 30 seconds default
    uint8_t scoreWhite = 0;
    uint8_t scoreDark = 0;
    uint8_t period = 1;

    bool hornActive = false;
    uint32_t hornUntilMs = 0;

    bool pickleActive = false;
    uint32_t pickleUntilMs = 0;
};

GameState state;
BLEServer* pServer = nullptr;
BLECharacteristic* pCommandChar = nullptr;
BLECharacteristic* pStatusChar = nullptr;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// Hardware Serial instance for CTS (UART 1 or 2)
HardwareSerial CtsSerial(1);

// ==========================================
// CTS SCOREBOARD PROTOCOL EMULATOR
// ==========================================
/*
 * Colorado Time Systems Frame Architecture:
 * - Speed: 9600 Baud, 8 Data Bits, Even Parity, 1 Stop Bit
 * - Unidirectional byte stream.
 * - Header byte: Value > 127 (MSB = 1)
 *     Format: 0x80 | (channel << 1) | (format_flag & 0x01)
 *     If format_flag == 0: followed by up to 8 character bytes (ASCII values < 128)
 *     If format_flag == 1: followed by up to 8 attribute/flag bytes (colons, dots, horn bit)
 *
 * Standard Aquatic Channels:
 *   Channel 0x00: Running Game Time (e.g. "  8:00.0")
 *   Channel 0x01: Scores & Period (e.g. " 0  1  0")
 *   Channel 0x05: Shot Clock (e.g. "   30   ") -> Displayed on SC-500/SC-600 & WA-3
 */
void sendCtsChannelFrame(uint8_t channel, const char* ascii8, const uint8_t* attr8) {
    // 1. Send Character Payload Frame (format_flag = 0)
    uint8_t charHeader = 0x80 | ((channel & 0x1F) << 1) | 0x00;
    CtsSerial.write(charHeader);
    for (int i = 0; i < 8; i++) {
        uint8_t ch = ascii8[i] & 0x7F; // ensure < 128
        CtsSerial.write(ch);
    }

    // 2. Send Attribute / Formatting Frame (format_flag = 1)
    if (attr8 != nullptr) {
        uint8_t attrHeader = 0x80 | ((channel & 0x1F) << 1) | 0x01;
        CtsSerial.write(attrHeader);
        for (int i = 0; i < 8; i++) {
            CtsSerial.write(attr8[i] & 0x7F);
        }
    }
}

void broadcastCtsDisplays() {
    // --- 1. CHANNEL 0x05: SHOT CLOCK ---
    char shotAscii[9];
    uint8_t shotAttr[8] = {0};
    uint32_t shotSec = state.shotTimeMs / 1000;
    uint32_t shotTenths = (state.shotTimeMs % 1000) / 100;

    if (shotSec >= 10) {
        snprintf(shotAscii, sizeof(shotAscii), "   %2lu   ", shotSec);
    } else {
        // Under 10 seconds: show tenths (e.g. " 9.4 ")
        snprintf(shotAscii, sizeof(shotAscii), "   %lu%lu   ", shotSec, shotTenths);
        shotAttr[4] = 0x01; // Decimal point between second and tenth
    }

    // If horn is firing, set bit 6 (0x40) or bit 0 on attribute byte to buzz SC-500/600 horn
    if (state.hornActive) {
        shotAttr[0] |= 0x40; // Horn trigger bit for CTS display horns
        shotAttr[7] |= 0x40;
    }
    sendCtsChannelFrame(0x05, shotAscii, shotAttr);

    // --- 2. CHANNEL 0x00: GAME CLOCK ---
    char gameAscii[9];
    uint8_t gameAttr[8] = {0};
    uint32_t gameMin = state.gameTimeMs / 60000;
    uint32_t gameSec = (state.gameTimeMs % 60000) / 1000;
    uint32_t gameTenth = (state.gameTimeMs % 1000) / 100;

    if (gameMin > 0) {
        snprintf(gameAscii, sizeof(gameAscii), " %02lu:%02lu ", gameMin, gameSec);
        gameAttr[3] = 0x02; // Colon indicator
    } else {
        // Under 1 minute: show seconds and tenths (e.g. "  59.4  ")
        snprintf(gameAscii, sizeof(gameAscii), "  %02lu.%01lu  ", gameSec, gameTenth);
        gameAttr[4] = 0x01; // Decimal indicator
    }
    sendCtsChannelFrame(0x00, gameAscii, gameAttr);

    // --- 3. CHANNEL 0x01: SCORES & PERIOD ---
    char scoreAscii[9];
    snprintf(scoreAscii, sizeof(scoreAscii), "%2u  %1u %2u", state.scoreWhite, state.period, state.scoreDark);
    sendCtsChannelFrame(0x01, scoreAscii, nullptr);
}

// ==========================================
// BLE CALLBACKS
// ==========================================
class ServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        deviceConnected = true;
        digitalWrite(STATUS_LED_PIN, HIGH);
        Serial.println("[BLE] iPad Connected!");
    }

    void onDisconnect(BLEServer* pServer) {
        deviceConnected = false;
        digitalWrite(STATUS_LED_PIN, LOW);
        Serial.println("[BLE] iPad Disconnected. Resuming advertising...");
        pServer->startAdvertising();
    }
};

void triggerHorn(uint32_t durationMs = 1200) {
    state.hornActive = true;
    state.hornUntilMs = millis() + durationMs;
    Serial.printf("[HORN] Triggered for %lu ms\n", durationMs);
}

class CommandCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pCharacteristic) {
        std::string value = pCharacteristic->getValue();
        if (value.length() == 0) return;

        const uint8_t* data = (const uint8_t*)value.data();
        uint8_t cmd = data[0];

        switch (cmd) {
            case CMD_STOP:
                state.isRunning = false;
                Serial.println("[CMD] STOP");
                break;

            case CMD_START:
                state.isRunning = true;
                Serial.println("[CMD] START");
                break;

            case CMD_RESET_30:
                state.shotTimeMs = 30 * 1000;
                Serial.println("[CMD] RESET 30s");
                break;

            case CMD_RESET_20:
                state.shotTimeMs = 20 * 1000;
                Serial.println("[CMD] RESET 20s");
                break;

            case CMD_SET_SHOT_CLOCK:
                if (value.length() >= 3) {
                    uint8_t sec = data[1];
                    uint8_t tenths = data[2];
                    state.shotTimeMs = (sec * 1000) + (tenths * 100);
                    Serial.printf("[CMD] SET SHOT: %u.%u\n", sec, tenths);
                }
                break;

            case CMD_SET_GAME_CLOCK:
                if (value.length() >= 4) {
                    uint8_t min = data[1];
                    uint8_t sec = data[2];
                    uint8_t tenths = data[3];
                    state.gameTimeMs = (min * 60000) + (sec * 1000) + (tenths * 100);
                    Serial.printf("[CMD] SET GAME: %02u:%02u.%u\n", min, sec, tenths);
                }
                break;

            case CMD_TRIGGER_HORN: {
                uint16_t duration = 1200;
                if (value.length() >= 3) {
                    duration = (data[1] << 8) | data[2];
                }
                triggerHorn(duration);
                break;
            }

            case CMD_SET_SCORES:
                if (value.length() >= 4) {
                    state.scoreWhite = data[1];
                    state.scoreDark = data[2];
                    state.period = data[3];
                    Serial.printf("[CMD] SCORES: W=%u D=%u Period=%u\n", state.scoreWhite, state.scoreDark, state.period);
                }
                break;

            case CMD_PULSE_PICKLE: {
                uint8_t duration = (value.length() >= 2) ? data[1] : 150;
                digitalWrite(RELAY_PICKLE_PIN, HIGH);
                state.pickleActive = true;
                state.pickleUntilMs = millis() + duration;
                Serial.printf("[CMD] PULSE PICKLE RELAY (%u ms)\n", duration);
                break;
            }

            default:
                Serial.printf("[CMD] Unknown Command: 0x%02X\n", cmd);
                break;
        }

        // Immediately transmit updated state to displays
        broadcastCtsDisplays();
    }
};

// ==========================================
// NOTIFY IPAD OF REALTIME STATE
// ==========================================
void notifyIpadStatus() {
    if (!deviceConnected) return;

    /*
     * Status Notification Payload (12 bytes):
     * [0]: Flags (bit 0 = running, bit 1 = hornActive, bit 2 = pickleActive)
     * [1..4]: Game Time (uint32_t ms, big-endian)
     * [5..8]: Shot Time (uint32_t ms, big-endian)
     * [9]: White Score
     * [10]: Dark Score
     * [11]: Period
     */
    uint8_t payload[12];
    payload[0] = (state.isRunning ? 0x01 : 0x00) |
                 (state.hornActive ? 0x02 : 0x00) |
                 (state.pickleActive ? 0x04 : 0x00);

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

    pStatusChar->setValue(payload, sizeof(payload));
    pStatusChar->notify();
}

// ==========================================
// SETUP & INITIALIZATION
// ==========================================
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n=== PoloBridge CTS Shot Clock Dongle Starting ===");

    pinMode(STATUS_LED_PIN, OUTPUT);
    digitalWrite(STATUS_LED_PIN, LOW);

    pinMode(RELAY_PICKLE_PIN, OUTPUT);
    digitalWrite(RELAY_PICKLE_PIN, LOW);

    // Initialize CTS RS-232 Serial Port (9600 Baud, 8-E-1)
    CtsSerial.begin(9600, SERIAL_8E1, CTS_SERIAL_RX_PIN, CTS_SERIAL_TX_PIN);
    Serial.println("[UART] CTS Serial initialized at 9600 8-E-1");

    // Initialize Bluetooth Low Energy
    BLEDevice::init("PoloBridge-CTS");
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());

    BLEService* pService = pServer->createService(SERVICE_UUID);

    // Command Characteristic (Write)
    pCommandChar = pService->createCharacteristic(
        COMMAND_CHAR_UUID,
        BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
    );
    pCommandChar->setCallbacks(new CommandCallbacks());

    // Status Characteristic (Notify)
    pStatusChar = pService->createCharacteristic(
        STATUS_CHAR_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pStatusChar->addDescriptor(new BLE2902());

    pService->start();

    // Advertising setup
    BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06); // 7.5ms BLE connection interval for instant response
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();

    Serial.println("[BLE] Advertising as 'PoloBridge-CTS'. Ready for iPad pairing.");
}

// ==========================================
// MAIN LOOP
// ==========================================
void loop() {
    static uint32_t lastClockTickMs = 0;
    static uint32_t lastCtsBroadcastMs = 0;
    static uint32_t lastBleNotifyMs = 0;
    uint32_t now = millis();

    // 1. High-Precision Timing Engine (Runs every 100ms / 10Hz)
    if (now - lastClockTickMs >= 100) {
        uint32_t deltaMs = now - lastClockTickMs;
        lastClockTickMs = now;

        if (state.isRunning) {
            // Decrement Game Clock
            if (state.gameTimeMs > deltaMs) {
                state.gameTimeMs -= deltaMs;
            } else {
                state.gameTimeMs = 0;
                state.isRunning = false;
                triggerHorn(2000); // Quarter ending long buzzer
            }

            // Decrement Shot Clock
            if (state.shotTimeMs > deltaMs) {
                state.shotTimeMs -= deltaMs;
            } else {
                state.shotTimeMs = 0;
                triggerHorn(1200); // Shot clock expiration buzzer
                state.shotTimeMs = 30 * 1000; // Reset after horn
            }
        }
    }

    // 2. Turn off Horn Buzzer when duration expires
    if (state.hornActive && now >= state.hornUntilMs) {
        state.hornActive = false;
        Serial.println("[HORN] Off");
    }

    // 3. Turn off Pickle Switch Relay when duration expires
    if (state.pickleActive && now >= state.pickleUntilMs) {
        digitalWrite(RELAY_PICKLE_PIN, LOW);
        state.pickleActive = false;
    }

    // 4. Stream CTS RS-232 frames at 10Hz (Standard CTS scoreboard multiplex rate)
    if (now - lastCtsBroadcastMs >= 100) {
        lastCtsBroadcastMs = now;
        broadcastCtsDisplays();
    }

    // 5. Notify iPad over BLE at 10Hz
    if (now - lastBleNotifyMs >= 100) {
        lastBleNotifyMs = now;
        notifyIpadStatus();
    }
}
