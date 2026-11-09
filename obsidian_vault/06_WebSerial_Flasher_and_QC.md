---
title: "06 — WebSerial Firmware Flasher & Hardware Self-Test"
tags: [polobridge, webserial, firmware, flasher, testing, esp32-s3]
status: production-verified
updated: 2026-11-09
---

# WebSerial Firmware Flasher & Hardware Self-Test

Back to [[00_PoloBridge_MOC]] | Hardware: [[02_Rev25_Hardware_and_PCB]] | Firmware: [[03_Firmware_and_Protocols]]

> [!important] 1-Click Zero-Dependency USB Poolside Diagnostics
> Eliminates the requirement for coaches or tournament organizers to install Python, `esptool.py`, or the Arduino IDE. Flashes production firmware directly over Chromium WebSerial and runs an automated 5-point hardware self-test in under 30 seconds.

## 1. WebSerial Bootloader Protocol (`webserial-manager.ts`)
- **Espressif USB VID Filter**: `0x303a`
- **Bootloader Baud Rate**: `115200` initial sync $\rightarrow$ `921600` high-speed flashing
- **SLIP Framing**: `0xC0` frame delimiters with byte-stuffing (`0xDB 0xDC`, `0xDB 0xDD`)
- **Sync Opcode**: `0x08` (ROM bootloader handshake)
- **Target Partition**: `0x10000` (842,100 bytes binary payload) with MD5 hash validation
- **Transparent Fallback**: Auto-enables simulation mode on Safari/iOS devices so UI workflows can be previewed without WebSerial API errors.

## 2. Automated 5-Point Hardware Self-Test
1. **Isolated RS-232 Driver Loopback**:
   - `GPIO 17 (TX)` $\rightarrow$ `GPIO 16 (RX)` through `ADuM1201` isolator + `MAX3232` $\pm 12\text{V}$ transceiver.
   - Transmits CTS framing byte sequence and verifies 100% bit-exact echo.
2. **3-Channel Pickle Optocouplers**:
   - Pulses `GPIO 4 (30s Reset)`, `GPIO 5 (20s Reset)`, and `GPIO 6 (Start/Stop)` for 150ms through `EL817S` optocouplers.
3. **105dB Piezo Horn Driver**:
   - Pulses `AO3400A` N-MOSFET gate on `GPIO 7` for 150ms and plays audible synthesized chime.
4. **Lid Emergency Pushbuttons**:
   - Interactively monitors active-low inputs `SW3 (GPIO 18)`, `SW4 (GPIO 19)`, and `SW5 (GPIO 20)`.
5. **Chip Telemetry & Voltage**:
   - Queries silicon MAC address (`7C:DF:A1:88:4B:20`), chip revision (`v0.2`), SPI flash size (`8MB GD25Q64C`), and 3.3V rail voltage (`3.32V`).

## 3. Flasher Panel UI (`firmware-flasher-panel.tsx`)
- Pinned to top masthead tab **"USB Flasher & QC"**.
- Sunlit Olympic Pool aquatic theme (`from-sky-900 via-blue-900 to-indigo-950`).
- Dual action cards (1-Click Flash + 5-Point Self-Test) with animated progress bar.
- Live 115200 baud terminal stream with color-coded RX/TX/INFO lines, quick-command chips, and log copy/clear.
