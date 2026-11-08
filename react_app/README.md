# PoloPad Pro (React + TypeScript)
**Wireless Water Polo Timing & Shot Clock Console**

Dual-thumb handheld ergonomic console engineered for iPad with live Colorado Time Systems (CTS) and Daktronics serial protocols, 10Hz ticker precision, audio feedback, and OBS streaming overlays.

## Quick Start on PC or Mac

1. Open a terminal in this directory:
   ```bash
   npm install
   npm run dev
   ```
2. Open **[http://localhost:3000](http://localhost:3000)** in any browser.

## Architecture Highlights
- **Far-Left Thumb Pillar**: Giant 3D mechanical START / STOP plunger with tactile grip ridges, spring press physics, and sound synthesis.
- **Far-Right Thumb Pillar**: Stacked 3D mechanical RESET 30s (Turnover) and RESET 20s (Rebound/Foul) actuators.
- **Rule WP 20.15 Automatic Blanking**: Automatically blanks shot clock display and disarms buzzer when Game Time $\le$ Shot Time.
- **Live Serial Sniffer**: Displays real-time 10Hz RS-232 serial byte packets (`0x8A`, `0x20`, `0x33`, `0x30`) for CTS SC-500 displays and Daktronics All Sport 5000 (Code 4498).
- **OBS / Live Stream Scorebug**: Broadcast-ready television overlay at `http://ipad-ip:8080/overlay`.
- **Official Scoresheet Generator**: Formatted match report with print/PDF layout.
