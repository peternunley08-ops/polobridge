---
title: "03 — ESP32-S3 Firmware, BLE GATT & Scoreboard Protocols"
tags: [polobridge, firmware, esp32, ble, protocols]
status: production-verified
updated: 2026-11-08
---

# ESP32-S3 Firmware & Scoreboard Protocols

Back to [[00_PoloBridge_MOC]] | Hardware: [[02_Rev25_Hardware_and_PCB]]

## 1. Simultaneous Dual-Output Engine
- **Colorado Time Systems (`MODE_CTS`)**: `9600 Baud, 8-E-1`, 11-byte frame (`0x80` header, `0x40` horn bit, `0x20` blanking under Rule WP 20.15).
- **Daktronics All Sport 5000 (`MODE_DAKTRONICS`)**: `19200 Baud, 8-N-1`, 32-byte RTD Water Polo Code 4498 frame.
- **3-Ch Pickle Companion**: `150ms` optocoupler pulses on `GPIO 4` (`30s`), `GPIO 5` (`20s`), and `GPIO 6` (`Start/Stop`).

## 2. Official Timing Rules Enforced
- **0.0s Shot-Clock Auto-Stop**: Stops both Game and Shot clocks immediately and fires a `1500ms` violation horn.
- **Rule WP 20.15 Auto-Blanking**: Blanks shot clock (`0x20 0x20`) when `gameTimeMs < shotTimeMs`.
