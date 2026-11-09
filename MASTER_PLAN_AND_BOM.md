# PoloBridge & PoloPad Pro — Master Product, iOS, Hardware BOM & Engineering Blueprint

> **Enhanced Executive Prompt & System Specification**  
> *"Architect and ship the complete, production-ready PoloBridge & PoloPad Pro ecosystem: a native iOS/iPadOS SwiftUI app and installable iOS Progressive Web App / Capacitor build with full World Aquatics, NCAA, and NFHS rules automation; an interactive Commercial Product Landing Page with ROI calculator; a Ready-to-Order Hardware Bill of Materials (BOM) with exact DigiKey/Mouser/Amazon part numbers, CSV cart export, and 2.5kV isolated schematics; an expanded 3D Product Mockups & CAD Blueprint gallery adhering strictly to the Vibrant Sunlit Olympic Pool Aquatic Design Standard; and a flagship GitHub repository with comprehensive documentation."*

---

## 1. Executive Summary & Product Vision

Aquatic facilities across high schools (NFHS/CIF), universities (NCAA), and clubs (USA Water Polo / 6-8 Sports / World Aquatics) rely on aging, $6,000–$10,000 proprietary desk consoles (**Colorado Time Systems System 6**, **Daktronics All Sport 5000**) and failure-prone wired 1/4" "pickle switch" cords stretched across wet pool decks.

**PoloBridge & PoloPad Pro** replace legacy desk consoles and wired buttons with:
1. **PoloPad Pro (iOS / iPadOS & Web App)**: A dual-thumb handheld ergonomic instrument console designed for wet poolside operation—featuring a giant Left-Thumb **START/STOP** plunger, Right-Thumb **30s / 20s** reset plungers, automatic **Rule WP 20.15** shot-clock blanking, **Rule WP 21** 20-second exclusions with automatic release on goals, **Rule WP 22.3** 3-foul personal cap-out ("Rolled") tracking, **60s/30s Team Timeouts**, **OT1/OT2 & Penalty Shootout (PSO)** scorecards, **6-8 Sports Live Game Desk** telemetry, **OBS Broadcast Scorebug**, and **Printable Official Scoresheets**.
2. **PoloBridge Pro Hardware Dongle (ESP32-S3 + 2.5kV Isolated RS-232)**: A rugged, conformal-coated wireless dongle that pairs with the iPad via sub-5ms Bluetooth Low Energy (BLE 5.0) and plugs directly into the existing **CTS WA-3 wireless adapter**, **System 6 console**, or **pool deck 1/4" wall jack**—speaking native **Colorado Time Systems (9600-8-E-1)** and **Daktronics All Sport 5000 (19200-8-N-1, Code 4498)**.

---

## 2. Architecture & System Data Flow

```mermaid
flowchart LR
    subgraph PoolDeck["Scorer's Table (Wet Pool Deck)"]
        iPad["iPadOS / iOS App\n(PoloPad Pro SwiftUI & PWA)"]
        OBS["Laptop / OBS Studio\n(1080p60 Broadcast Scorebug)"]
        SixEight["6-8 Sports Game Desk\n(Cloud & Local BroadcastChannel)"]
    end

    subgraph Dongle["PoloBridge Pro Dongle (Model PB-S3-ISO)"]
        ESP["ESP32-S3 MCU\n(BLE 5.0 GATT + 10Hz Ticker)"]
        ISO["ADuM1201 + ADM3251E\n(2.5kV Galvanic Isolation)"]
        MAX["MAX3232E Transceiver\n(±12V True RS-232)"]
        OPT["PC817 Optocoupler\n(150ms Pickle Switch Tap)"]
    end

    subgraph Scoreboards["Poolside Display Infrastructure"]
        WA3["CTS WA-3 / System 6\nor Deck Wall Plate (1/4\" TS)"]
        SC500["CTS SC-500 / SC-600\nGoal-Mounted Shot Clocks"]
        DAKT["Daktronics All Sport 5000\n(RTD Code 4498)"]
    end

    iPad <-->|"BLE 5.0 GATT\n4fa10001-... (<5ms)"| ESP
    iPad -->|"WebSocket / URL\n?overlay=1"| OBS
    iPad <-->|"Real-Time JSON\nPlay-by-Play"| SixEight
    ESP --> ISO --> MAX -->|"1/4\" Gold TS Jack\n9600 8-E-1 / 19200 8-N-1"| WA3
    ESP --> OPT -->|"1/4\" Companion Jack"| WA3
    WA3 -->|"2.4 GHz / Deck Cable"| SC500
    MAX -->|"RS-232 RTD"| DAKT
```

---

## 3. Ready-to-Order Hardware Bill of Materials (BOM)

We provide two complete hardware BOM tiers so any school, club, or hardware engineer can order parts today from **DigiKey**, **Mouser**, or **Amazon** and assemble a working PoloBridge dongle in under 45 minutes.

### Tier 1: Quick-Build Field Prototype (~$24.40 Total)
*Ideal for immediate bench testing and indoor/outdoor scorer's table use with a CTS WA-3 transmitter.*

| Item | Category | Component Description | Manufacturer / MPN | Supplier SKU (DigiKey / Amazon) | Qty | Unit Est. | Subtotal |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **1** | **MCU (BLE 5.0)** | ESP32-S3-DevKitC-1-N8R2 (Dual USB-C, 8MB Flash, 2MB PSRAM, PCB Antenna) | Espressif `ESP32-S3-DEVKITC-1-N8R2` | DigiKey: `1965-ESP32-S3-DEVKITC-1-N8R2-ND` | 1 | $7.50 | $7.50 |
| **2** | **RS-232 Driver** | MAX3232CSE 3.3V-to-±12V Dual RS-232 Transceiver Breakout Module (with 0.1µF charge pump caps) | Texas Instruments `MAX3232IDR` / SparkFun `BOB-11189` | DigiKey: `1568-1197-ND` / Amazon: `B07PFB6M6J` | 1 | $3.20 | $3.20 |
| **3** | **1/4" TS Jack** | Neutrik 1/4" (6.35mm) Heavy-Duty Panel Mount Mono Phone Jack (Switched, Sealed) | Neutrik `NRJ4HF` | DigiKey: `NRJ4HF-ND` | 1 | $1.85 | $1.85 |
| **4** | **1/4" TS Cable** | Hosa Pro 1/4" TS Mono Male-to-Male Instrument/Serial Cable (3 ft, 24 AWG Shielded) | Hosa `CPP-103` | Amazon: `B000068O16` | 1 | $5.95 | $5.95 |
| **5** | **Pickle Opto** | Sharp PC817X4NSZ0F Photocoupler (DIP-4, 5kV Isolation) + 1kΩ 1/4W Metal Film Resistor | Sharp `PC817X4NSZ0F` | DigiKey: `425-2831-5-ND` | 1 | $0.65 | $0.65 |
| **6** | **Enclosure** | Hammond 1591XXBSBK ABS Flame-Retardant Instrument Enclosure (112 × 62 × 31 mm, Black/Blue) | Hammond `1591XXBSBU` | DigiKey: `HM1128-ND` | 1 | $5.25 | $5.25 |
| **Total** | | | | | **6** | | **$24.40** |

---

### Tier 2: Pool-Deck Pro Industrial Isolated Edition (~$49.85 Total)
*Engineered for permanent aquatic center deployment: features 2.5kV RMS galvanic isolation against pool pump VFD ground loops, IP67 sealed aluminum enclosure, ENIG gold protection, and trichloramine conformal coating.*

| Item | Category | Component Description | Manufacturer / MPN | Supplier SKU (DigiKey / Mouser) | Qty | Unit Est. | Subtotal |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **1** | **MCU + Antenna** | ESP32-S3-DevKitC-1U-N8R8 (U.FL IPEX external antenna connector) + 2.4GHz IP67 Stub Antenna | Espressif `ESP32-S3-DEVKITC-1U-N8` | DigiKey: `1965-ESP32-S3-DEVKITC-1U-N8-ND` | 1 | $9.20 | $9.20 |
| **2** | **Isolated RS-232** | Analog Devices ADM3251EARWZ 2.5kV Isolated Single-Channel RS-232 Transceiver (integrated isoPower DC-DC) | Analog Devices `ADM3251EARWZ` | DigiKey: `ADM3251EARWZ-ND` | 1 | $11.40 | $11.40 |
| **3** | **Digital Isolator** | Analog Devices ADuM1201ARZ Dual-Channel 2.5kV Digital Isolator (alternative with discrete MAX3232E) | Analog Devices `ADuM1201ARZ-RL7` | DigiKey: `ADUM1201ARZ-RL7CT-ND` | 1 | $3.45 | $3.45 |
| **4** | **ESD Protection** | Bourns CDSOD323-T15SC Bidirectional TVS Diode (±15kV IEC 61000-4-2 ESD on RS-232 Tip/Sleeve) | Bourns `CDSOD323-T15SC` | DigiKey: `CDSOD323-T15SCCT-ND` | 2 | $0.45 | $0.90 |
| **5** | **Gold 1/4" Jack** | Neutrik NRJ6HM-1-AU Gold-Plated 1/4" Panel Jack with EPDM Waterproof Gasket | Neutrik `NRJ6HM-1` | DigiKey: `NRJ6HM-1-ND` | 2 | $2.65 | $5.30 |
| **6** | **Sub-GHz Radio** | Waveshare Core1262-HF Semtech SX1262 915MHz LoRa/FSK Module (Optional Long-Range Deck Link) | Semtech / Waveshare `Core1262-868M` | Amazon: `B089SY2364` | 1 | $6.90 | $6.90 |
| **7** | **Enclosure** | Hammond 1455C801BU Extruded Anodized Aluminum Enclosure (80 × 54 × 23 mm, Blue/Black) | Hammond `1455C801BU` | DigiKey: `HM922-ND` | 1 | $8.90 | $8.90 |
| **8** | **Conformal Coat** | MG Chemicals 419D Premium Acrylic Conformal Coating Pen (Trichloramine $NCl_3$ gas protection) | MG Chemicals `419D-P` | DigiKey: `473-1356-ND` | 1 | $3.80 | $3.80 |
| **Total** | | | | | **10** | | **$49.85** |

---

## 4. iOS & iPadOS Readiness Architecture

### 4.1 Native SwiftUI App (`ipad_app/` + `Package.swift`)
- **Target**: iOS 16.0+ / iPadOS 16.0+ (Landscape First, Full-Screen `statusBarHidden`, `persistentSystemOverlays(.hidden)` to prevent accidental home-bar swipes during live water polo play).
- **CoreBluetooth Driver (`BluetoothManager.swift`)**:
  - Auto-scans for service UUID `4FA10001-B5A3-F393-E0A9-E50E24DCCA9E`.
  - Low-latency `.withoutResponse` GATT writes on `4FA10002-...` and 10Hz live telemetry notifications on `4FA10003-...`.
  - Automatic exponential-backoff reconnect if the operator walks away from the scorer's table.
- **Rules & Timing Engine (`WaterPoloGameModel.swift`)**:
  - 100ms precision Game & Shot clocks.
  - NFHS High School (30s only) vs. NCAA / World Aquatics (20s/30s) ruleset switcher.
  - Rule WP 20.15 automatic shot clock blanking (`gameTimeMs <= shotTimeMs`).
  - Rule WP 21 20s player exclusions with early release (`REL`) and automatic release of defending team penalties when a goal is scored.
  - Rule WP 22.3 personal foul counter per cap (`0/3` -> `3/3 ROLLED OUT`).
  - Full 60s & 30s Team Timeout engine with 45s warning horn.
  - Overtime (`OT1`, `OT2`) and 5-Round + Sudden Death Penalty Shootout (`PSO`) tracker.

### 4.2 iOS Standalone WebApp / Capacitor Hybrid (`react_app/`)
- **PWA Home Screen & Bluefy iOS BLE Support**:
  - `public/manifest.json` and iOS Safari meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style="black-translucent"`, `viewport-fit=cover`) allow any iPad to install PoloPad Pro to the Home Screen as a full-screen standalone app.
  - `capacitor.config.ts` enables 1-command native Xcode project generation (`npx cap add ios && npx cap open ios`) with `@capacitor-community/bluetooth-le` or native WebView integration.

---

## 5. Complete Deliverables Checklist

- [x] **Enhanced Master Plan & BOM Specification** (`MASTER_PLAN_AND_BOM.md`)
- [x] **Commercial Product Landing Page** (`react_app/src/components/landing-page.tsx`) with interactive ROI calculator, feature comparison matrix, RF physics explainer, and live demo triggers
- [x] **Interactive Hardware BOM & Order Sheet** (`react_app/src/components/hardware-bom-panel.tsx`) with Tier 1 & Tier 2 parts, supplier SKUs, 1-click CSV export for DigiKey/Mouser cart upload, and interactive wiring & assembly guide
- [x] **Full Water Polo Rules Engine Upgrade in `react_app`** (`App.tsx`):
  - Team Timeout Engine (60s Full / 30s Short timeouts with countdown banner & 45s warning horn)
  - Overtime (`OT1`, `OT2` 3:00) & Interactive 5-Round Penalty Shootout (`PSO`) Scorecard
  - Rule WP 21 automatic defending exclusion release on Goal + 3-Foul Cap-Out lock
  - Full-State Undo Stack (restores clocks, scores, and exclusions) + Keyboard/Pedal shortcuts (`Space`, `R`, `E`, `H`, `Z`)
  - Live-driven Printable Official Match Scoresheet (quarter progression, player box scores, timeouts, and chronological event log)
- [x] **Vibrant Sunlit Aquatic Mockups Gallery + CAD Blueprint** (`react_app/src/components/mockups-gallery.tsx`)
- [x] **iOS / iPadOS SwiftUI App Upgrade** (`ipad_app/WaterPoloGameModel.swift`, `ipad_app/PoloPadView.swift`, `ipad_app/Info.plist`, `Package.swift`)
- [x] **iOS PWA & Capacitor Configuration** (`react_app/public/manifest.json`, `react_app/capacitor.config.ts`, `react_app/index.html`)
- [x] **Flagship GitHub `README.md` & `firmware/HARDWARE_WIRING.md`**
