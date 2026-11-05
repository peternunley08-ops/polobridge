# PoloBridge: Wireless Water Polo Timing & Shot Clock System

A modern hardware and software system that replaces legacy aquatic desk consoles (Colorado Time Systems System 6, Daktronics All Sport 5000) and wired "pickle switch" remotes with an intuitive iPad interface.

---

## Repository Structure

* **`firmware/`**
  * `polobridge_firmware.ino`: Production ESP32/ESP32-S3 C++ firmware implementing Bluetooth Low Energy (BLE) and the Colorado Time Systems (CTS) RS-232 serial frame generator (9600 Baud, 8-E-1).
  * `HARDWARE_WIRING.md`: Complete pinout, MAX3232 wiring diagram, 1/4" phone jack pinouts, and CTS WA-3 adapter integration.
* **`ipad_app/`**
  * `PoloPadApp.swift`: SwiftUI application entry point.
  * `BluetoothManager.swift`: CoreBluetooth Central Manager handling connection, command serialization, and 10Hz live state sync with the dongle.
  * `WaterPoloGameModel.swift`: Rule logic for World Aquatics / USA Water Polo (30s possession, 20s offensive rebound/exclusion reset, undo stack, multi-player ejection countdowns).
  * `PoloPadView.swift`: High-contrast, wet-deck-optimized iPad UI with giant touch targets.

---

## How It Works

```
┌─────────────────┐       BLE (<5ms latency)       ┌────────────────────────┐
│  iPad (PoloPad) │ ─────────────────────────────► │ PoloBridge Dongle      │
└─────────────────┘                                │ (ESP32-S3 + MAX3232)   │
                                                   └───────────┬────────────┘
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
2. **Instant Undo**: Accidentally tapped reset during a possession? Tap `UNDO RESET` to immediately restore the clock to its previous tick.
3. **Multi-Player Exclusion Trackers**: Cap numbers are tracked with automated 20-second countdowns that visually alert table workers when to wave players back into the pool.
4. **Console Companion Mode**: Optional optocoupler tap connects directly to the 1/4" "Pickle Switch" port of an existing System 6 console.
