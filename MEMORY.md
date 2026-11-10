# 🧠 Claude-Mem: PoloBridge & PoloPad Pro Persistent Memory Bank

> **Auto-Loaded Session Context (`thedotmack/claude-mem` Protocol)**
> Last Updated: `2026-11-10` | Active Release: **`Rev 2.5 (Commit cab8759)`**
> Live Production PWA: **[https://peternunley08-ops.github.io/polobridge/](https://peternunley08-ops.github.io/polobridge/)**

---

## 1. Locked Product & Architectural Decisions (`/grill-me` Verified)
1. **Dual-Mode Field Pilot Hardware (`Rev 2.5`)**:
   - Simultaneously outputs **RS-232 serial** (`GPIO 17` -> `ADuM1201BRZ` 2.5kV isolator -> `MAX3232ESE` $\pm 12\text{V}$ driver) AND **3-Channel Isolated Optocoupler Pickle Switch closures** (`EL817S` `U7/U8/U9` on `GPIO 4 = 30s Reset`, `GPIO 5 = 20s Reset`, `GPIO 6 = Start/Stop`).
2. **Triple-Redundant Pool Deck Horn**:
   - Asserts RS-232 horn bit `0x40` (CTS/Daktronics), drives onboard `AO3400A` N-MOSFET (`Q1` on `GPIO 7`) for a 105dB marine piezo/auxiliary horn (`J6`), and triggers zero-latency WebAudio synthesis on the iPad via BLE `0x4FA10003`.
3. **Shot-Clock Expiration (`0.0s`) & Hardware Fail-Safe**:
   - Reaching `0.0s` on the shot clock automatically stops **both** Game and Shot clocks immediately and fires a `1500ms` violation horn.
   - Includes **3 waterproof emergency fail-safe buttons** (`SW3/SW4/SW5` on `GPIO 18/19/20`) on the Hammond `1554C2GYCL` enclosure lid so table workers can operate `Start/Stop`, `30s Reset`, and `20s Reset` even if the iPad battery dies mid-quarter.
4. **Parent Volunteer & Phone UX**:
   - **Dedicated Phone Console (`phone-console.tsx`)**: Auto-detects phone viewports or manually toggles between **"📱 Phone"** and **"🖥️ iPad/Desktop"**.
   - **Dual Phone Orientations**:
     - **Portrait Mode ("One-Hand Pocket Controller")**: Hero full-width `START / STOP` plunger (80px+), side-by-side `30s` & `20s` plungers, Quick Action row (`Horn`, `Exclusion`, `Timeout`, `Undo`), and zero-scroll unscrollable layout for iPhone SE up to 16 Pro Max.
     - **Landscape Mode ("Dual-Thumb Pocket Console")**: Left thumb `START / STOP` + `Horn`, Center clocks & scores, Right thumb `30s` + `20s` + `Undo`.
   - **Poolside Haptic Vibration Engine (`phone-haptics.ts`)**: Custom tactile vibration pulses for start, stop, 30s reset, 20s reset, horn, and 0.0s violation.
   - **Screen Wake-Lock API**: Keeps phone screen awake poolside throughout the match.
   - 1-Click toggle in the console header between **"Full Varsity Desk"** and **"Simple Volunteer (4-Button)"** mode (`80%` screen area plungers).
   - **1-Click Universal Pool Scoreboard Auto-Finder** (`tournament-hub-panel.tsx`) cycles through CTS (`9600 8-E-1`), Daktronics (`19200 8-N-1`), and 3-Ch Pickle pulses so volunteers never touch DIP switches or baud rates.
5. **Commercial Pricing Tiers**:
   - **Tier 1 — Open-Hardware DIY**: \$24.40–\$49.85 (Free Gerbers/BOM/CPL/Firmware/STL)
   - **Tier 2 — High School Turnkey Kit**: \$279 One-Time (Assembled IP67 Rev 2.5 Dongle + Cables + Free iOS App, zero recurring fees)
   - **Tier 3 — Tournament & 6-8 Cloud Pro**: +\$99/yr Optional (4-Pool Multi-Course Hub + Live 6-8 Sports Cloud Box Score Sync)
6. **Browser-Based WebSerial ESP32-S3 Firmware Flasher & Hardware QC (`webserial-manager.ts` & `firmware-flasher-panel.tsx`)**:
   - **In-Browser 1-Click Flasher**: Connects over WebSerial USB-C (`0x303a` Espressif VID, 115200 initial bootloader sync, 921600 baud flashing) using SLIP protocol framing (`0xC0` delimiters, `0x08` sync opcode). Erases partition `0x10000`, writes the official 842KB Rev 2.5 binary, verifies MD5 checksum, and hard-resets into application mode without Arduino IDE or Python.
   - **Automated 5-Point Hardware Self-Test**:
     1. Isolated RS-232 Loopback (`GPIO 17 TX` -> `GPIO 16 RX` through `ADuM1201` + `MAX3232`).
     2. 3-Channel Pickle Optocouplers (`EL817S` `GPIO 4/5/6`).
     3. 105dB Piezo Horn Driver (`AO3400A` `GPIO 7`).
     4. Lid Emergency Fail-Safe Buttons (`SW3/SW4/SW5` on `GPIO 18/19/20`, active-low readouts).
     5. Chip Telemetry & Rail Voltage (`ESP32-S3 WROOM-1U-N8`, 8MB Flash, 3.32V rail).
   - **Interactive Fallback Simulation**: Automatically enables transparent simulation mode on non-Chromium browsers (iOS Safari, iPadOS) so coaches can test workflows anywhere.
7. **Dual-Layer IndexedDB Match Persistence & BLE GATT Auto-Reconnect (`match-persistence.ts` & `offline-resilience-panel.tsx`)**:
   - **Continuous 100ms Persistence**: Every clock tick and score mutation writes synchronously to `localStorage` mirror (`polopad_pro_live_match_v1`) and asynchronously to IndexedDB (`PoloPadProOfflineDB`, object stores `live_match_state` and `match_checkpoints`).
   - **Safe Hydration**: Reloading or restoring after a tab crash rehydrates in <1ms with `isRunning: false` to ensure clocks never tick unobserved during browser mount.
   - **BLE Exponential-Backoff Watchdog**: Recovers automatically from pool deck 2.4GHz RF drops (retries at 500ms, 1s, 2s, 4s, 8s up to 8 attempts) and immediately flushes the live clock/score state to physical LED scoreboards upon reconnection.
   - **Time-Machine Checkpoints & JSON Portable Backups**: Named checkpoint snapshots and 1-click JSON match backup download/upload.
8. **Digital Scoresheet, Custom Team Rosters & Rule WP 22.3 Cap-Out (`roster-manager.ts` & `digital-scoresheet-panel.tsx`)**:
   - **Cap #1–20 Attribution**: Tracks individual goals by quarter, goalie saves, personal fouls (`E`, `P`, `MAM`), timeouts, and sprints for White and Blue teams.
   - **Rule WP 22.3 Cap-Out Guardrail**: Automatically flags and rolls players on their 3rd personal foul, alerting the desk and locking further scoring actions for that cap number.
   - **Multi-Format Export**: 1-Click Print / PDF Scoresheet formatted for Letter/A4 Landscape matching USA Water Polo / NFHS official forms, CSV Box Score download, and clipboard summary generator.
9. **Tournament Director 4-Court Dashboard & Court Link (`court-link.ts`, `tournament-director-hub.tsx`, `cloudflare/court-relay`)**:
   - **Read-Only Dashboard**: Shows Courts A to D. Nothing received can start, stop or reset a clock on any desk; the desk remains the official clock.
   - **Snapshot Plus Projection**: Each desk publishes full match snapshots. The director projects both clocks between them, with a `1 Hz` heartbeat and an immediate frame on every real change. A desk transmits only when the projection would be wrong (whistle, reset, goal, manual clock edit), limited to `10` frames/s with `150 ms` tolerance.
   - **Link Health Thresholds**: `LIVE` under `3 s` silence; `LAGGING` from `3 s` to under `8 s` (amber, clocks still projected); `LINK LOST` at `8 s` or more (projection stops, last confirmed values shown); `DESK SIGNED OFF` shows final values immediately.
   - **Court Ownership & Conflicts**: The first desk heard owns a court. A second device is flagged as a conflict after `2` frames within `5 s`. Takeover only when the owner has signed off, gone stale, or is a newer page load of the same device. Same browser, two tabs: Web Lock `polopad-court-desk:<room>:<court>`.
   - **Two Transports**: BroadcastChannel `polopad_court_link_v1:<room>` for the same device (no setup); WebSocket relay for different devices (needs the relay deployed and its address pasted into Director → Link Setup).
   - **Relay Not Yet Deployed**: Verified locally under `wrangler dev` only. To deploy, run `npx wrangler deploy` in `cloudflare/court-relay` (Node.js `22.12`+), then paste the address into Director → Link Setup.
   - **Tests**: `react_app` `npm test` (217 engine tests), `cloudflare/court-relay` `npm test` (20 protocol tests), `tests/e2e/director-dashboard.e2e.cjs` (Chromium; set `COURT_RELAY_URL` for the two-device scenario), and `tests/test_tournament_director.py`.

---

## 2. Hardware DRC & Manufacturing Invariants
- **PCB Outline**: `85.0mm x 55.0mm` 4-layer FR4 ENIG (`1.6mm` thickness).
- **2.5kV Galvanic Isolation Barrier**: `45.0mm <= X <= 51.0mm` milled anti-tracking slot. Only `U2` (`ADuM1201`), `U4` (`B0303S-1WR3`), and `U7/U8/U9` (`EL817S` optocouplers) may straddle `X = 48.00mm`.
- **JLCPCB Turnkey Pack**: `hardware/jlcpcb_production/` (`47` SMD components across `20` verified LCSC `C#` part numbers).
- **3D Printable Poolside CAD**: `hardware/enclosure_cad/polobridge_front_panel_drill_jig.stl` (`120x65x12mm`) and `polopad_poolside_sunhood_stand.stl` (`260x185x145mm`, 25° anti-glare visor).

---

## 3. Environment & Toolchain Guardrails
- **Sunlit Olympic Pool Palette**: Always use `from-sky-900 via-blue-900 to-indigo-950`, translucent sapphire cards, and `border-cyan-400/30`. Never use `#06080d`, `#040508`, or `bg-black`.
- **GitHub Pages Relative Paths**: Always keep `base: './'` in `react_app/vite.config.ts` and `./assets/...` relative paths so assets resolve under `/polobridge/`.
- **Sandbox `gh` CLI**: Prefix `gh` commands with `TAR_OPTIONS="-m"` if the plugin wrapper extracts in the container sandbox.
