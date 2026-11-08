# PoloBridge: Wireless Water Polo Timing & Shot Clock System

A modern hardware and software system that replaces legacy aquatic desk consoles (Colorado Time Systems System 6, Daktronics All Sport 5000) and wired "pickle switch" remotes with an intuitive iPad interface.

---

## Repository Structure

* **`Package.swift`**: Swift Package Manager manifest for compiling and testing `PoloBridge` core on iOS/macOS.
* **`firmware/`**
  * `polobridge_firmware.ino`: Production ESP32/ESP32-S3 C++ firmware implementing Bluetooth Low Energy (BLE) and the Colorado Time Systems (CTS) RS-232 serial frame generator (9600 Baud, 8-E-1).
  * `platformio.ini`: PlatformIO build configuration for ESP32 and ESP32-S3 boards.
  * `HARDWARE_WIRING.md`: Complete pinout, MAX3232 wiring diagram, 1/4" phone jack pinouts, and CTS WA-3 adapter integration.
* **`ipad_app/`**
  * `PoloPadApp.swift`: SwiftUI application entry point.
  * `BluetoothManager.swift`: CoreBluetooth Central Manager handling connection, command serialization, and 10Hz live state sync with the dongle.
  * `WaterPoloGameModel.swift`: Complete World Aquatics (FINA) & USA Water Polo rules engine (30s possession, 20s rebound/exclusion reset, 3-foul "rolled" disqualifications, 60s/30s timeouts, OT1/OT2, penalty shootouts, and 15-state undo stack).
  * `PoloPadView.swift`: High-contrast, tactile 3D instrument desk UI optimized for wet pool decks with mechanical key actuators and recessed optical chambers.
* **`simulator/`**
  * `index.html`: Interactive web simulator replicating the physical 3D desk console, virtual CTS LED scoreboard, sound synthesis engine, and real-time RS-232 serial packet inspector.
* **`tests/`**
  * `test_rules_engine.py`: Unit test suite verifying water polo timing rules and state invariants.
  * `swift_tests/WaterPoloGameModelTests.swift`: XCTest suite for Swift Package Manager.
* **`tools/`**
  * `cts_packet_sniffer.py`: Python CLI tool to sniff and decode CTS RS-232 serial data streams from a USB-to-RS232 adapter.

---

## How It Works

```
┌─────────────────┐       BLE (<5ms latency)       ┌────────────────────────┐
│  iPad (PoloPad) │ ─────────────────────────────► │ PoloBridge Dongle      │
│  Tactile Deck   │                                │ (ESP32-S3 + MAX3232)   │
└─────────────────┘                                └───────────┬────────────┘
                                                               │ RS-232 Serial (9600 8-E-1)
                                                               │ via 1/4" Mono Phone Jack
                                                               ▼
                                       ┌─────────────────────────────────────────────────┐
                                       │ CTS WA-3 Wireless Adapter OR Pool Deck Wall Jack│
                                       └───────────────────────┬─────────────────────────┘
                                                               │ 2.4 GHz / Direct Cable
                                                               ▼
                                                   ┌───────────────────────┐
                                                   │ CTS SC-500 / SC-600   │
                                                   │ Water Polo Shot Clocks│
                                                   └───────────────────────┘
```

---

## Features

1. **Separated 30s vs 20s Resets**: Big green (30s full turnover) and big amber (20s ejection/rebound) buttons prevent table worker errors.
2. **Instant Undo**: Accidentally tapped reset during a possession? Tap `UNDO` to immediately restore the clock, score, and foul states to previous ticks.
3. **Official 3-Foul "Rolled" Tracking**: Automatically logs personal major fouls (1st, 2nd, and 3rd). When a player reaches 3 fouls, the system flags them as **ROLLED OUT** with a clear indicator that substitution is required once the 20 seconds or goal expires.
4. **Timeout Management Engine**: Full 1:00 and 0:30 team timeout countdowns with automatic game clock pause, 45-second warning horn, and visual resume controls.
5. **Overtime & Penalty Shootouts (PSO)**: Automated support for two 3-minute overtime periods (OT1, OT2) and an interactive 5-round alternating penalty shootout scorecard with sudden-death rounds.
6. **Console Companion Mode**: Optional optocoupler tap connects directly to the 1/4" "Pickle Switch" port of an existing System 6 console.
7. **Interactive Web Simulator**: Test the entire system in any modern web browser (`simulator/index.html`) with acoustic buzzer sound effects and live RS-232 byte streaming.
