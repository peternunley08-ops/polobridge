# PoloPad Pro — Wireless Water Polo Timing & Shot Clock Console

[![Flutter CI](https://github.com/peternunley/polobridge/actions/workflows/ci.yml/badge.svg)](https://github.com/peternunley/polobridge/actions/workflows/ci.yml)
[![Flutter SDK](https://img.shields.io/badge/Flutter-%3E%3D3.16.0-02569B?logo=flutter)](https://flutter.dev)
[![Dart SDK](https://img.shields.io/badge/Dart-%3E%3D3.2.0-0175C2?logo=dart)](https://dart.dev)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**PoloPad Pro** is a high-performance, native Flutter tablet and mobile application designed for professional water polo desk operations. It replaces bulky aquatic scoring desk consoles (Colorado Time Systems System 6, Daktronics All Sport 5000) and fragile wired "pickle switch" remotes with an ergonomic, wet-deck-optimized wireless touch interface connecting directly to an ESP32-S3 BLE hardware dongle.

---

## Key Features

1. **Ergonomic Dual-Thumb Handheld Architecture**:
   - Adaptive responsive layout powered by `LayoutBuilder` with an explicit breakpoint at `600dp`.
   - **Tablet / Large Screen (`> 600dp`)**: 3-column dual-thumb layout featuring a giant left-thumb Start/Stop tactile plunger, center recessed instrument bay (master game clock, shot clock, score controls, exclusion management, 1-click state undo), and right-thumb stacked Reset 30 (turnover) and Reset 20 (rebound/foul) tactile plungers.
   - **Mobile / Compact Screen (`<= 600dp`)**: Overflow-free vertical layout with `FittedBox` scaling, bounded scrolling, and horizontal dual-thumb plunger row for single-operator handheld timing.

2. **Sunlit Olympic Pool Aquatic Design System**:
   - High-contrast, glare-resistant palette engineered for wet outdoor and indoor pool decks under intense lighting.
   - Strictly **NO pitch-black backgrounds** (`#000000`, `#06080d`); built on aquatic gradients from `sky-900` via `blue-900` to `indigo-950`.
   - Glowing cyan glass borders (`#22D3EE`), translucent sapphire/teal cards, and high-visibility 3D tactile plungers with responsive bevels.

3. **100ms Timing Engine & World Aquatics Rule WP 20.15 Auto-Blanking**:
   - 100ms precision master game clock (`MM:SS.d`) and shot clock (`30s` / `20s`).
   - **Rule WP 20.15 Auto-Blanking**: Automatically blanks shot clock display (`--`) whenever remaining game time is less than or equal to shot time ($gameTimeMs \le shotTimeMs$), eliminating buzzer confusion and suppressing shot horn triggers during final possession.
   - **Rule WP 21 Exclusions**: 20-second exclusion countdowns with 1-click early release (`REL`) on turnover or defending penalty release on goal.
   - **1-Click State Undo**: Rolling snapshot buffer (depth 10) restoring game clock, shot clock, scores, exclusions, and period state.

4. **6-8 Sports Tournament Desk & Roster Sync**:
   - Pre-loaded tournament profiles: `68-JO-2026-412` (USAWP Junior Olympics Platinum), `68-ODP-2026-108` (ODP Regional Championship), and `68-KAP7-2026-889` (KAP7 Classic).
   - Live roster sync with player cap numbers, field positions, and 6-8 Performance Indicator (PI) ratings.
   - **3-Foul Personal Exclusion Tracking**: Real-time personal foul tracking (`0/3` to `3/3 CAPPED OUT`) with 3-dot visual indicators and cap-out enforcement.
   - Structured JSON play-by-play telemetry event logging.

5. **Bluetooth Low Energy (BLE) Hardware Dongle Service**:
   - GATT Service matching Service UUID `4fa10001-b5a3-f393-e0a9-e50e24dcca9e`.
   - Command Characteristic (Write): `4fa10002-b5a3-f393-e0a9-e50e24dcca9e`.
   - Status Characteristic (Notify): `4fa10003-b5a3-f393-e0a9-e50e24dcca9e`.
   - 13-byte binary status packet codec with Big-Endian encoding.
   - Live protocol hot-swapping between Colorado Time Systems (`CTS 9600-8-E-1`) and Daktronics (`DAKT CODE 4498`) RS-232 serial framing.
   - Built-in software `MockBleService` for hardware-free automated testing.

---

## Architectural Overview

PoloPad Pro follows a clean, decoupled layered architecture:

```
lib/
├── core/
│   ├── audio/              # SoundService & tone generator abstractions
│   ├── constants/          # AquaticColors palette & WidgetKeys ValueKey constants
│   └── theme/              # AquaticTheme ThemeData & glassmorphism decorations
├── domain/
│   ├── engine/             # TimingEngine (100ms ticker, WP 20.15) & UndoStack
│   ├── models/             # Immutable GameState, ClockSnapshot, Exclusion, Team
│   └── six_eight/          # 6-8 Sports manager, tournament models & telemetry
├── infrastructure/
│   ├── ble/                # BleDongleService, 13-byte BlePacketCodec & MockBleService
│   └── mock_data/          # TournamentPresets (68-JO, 68-ODP, 68-KAP7)
├── state/
│   └── game_controller.dart# High-level ChangeNotifier coordinating engine, desk & BLE
├── presentation/
│   ├── screens/            # AdaptiveGameScreen, TabletDualThumbLayout, MobileStackedLayout
│   └── widgets/            # PlungerButton, MasterClockCard, ShotClockCard, TeamBay, etc.
├── widget_previews.dart    # Isolated @Preview functions for Flutter Widget Previewer
└── main.dart               # PoloPadApp entry point & GameControllerScope injection
```

---

## Sunlit Olympic Pool Aquatic Theme & Palette

| Category | Token / Name | Hex / Value | Visual Description |
|:---|:---|:---|:---|
| **Canvas Gradient** | `canvasSky900` | `#0C4A6E` | Deep sky blue top-left gradient anchor |
| | `canvasBlue900` | `#1E3A8A` | Deep royal blue gradient midpoint |
| | `canvasIndigo950`| `#1E1B4B` | Deep indigo bottom-right gradient anchor |
| **Glass Borders** | `cyan400` | `#22D3EE` | Bright cyan primary accent |
| | `borderCyanSubtle` | `0x4D22D3EE` | 30% alpha glass border |
| | `borderCyanGlow` | `0x8022D3EE` | 50% alpha glowing recessed border |
| **Surfaces** | `surfaceSapphire` | `0x330284C7` | 20% alpha sapphire translucent card |
| | `surfaceTeal` | `0x260F766E` | 15% alpha teal translucent card |
| | `surfaceDeepBlue` | `0xCC031326` | High-contrast recessed clock bay |
| **LED Readouts** | `gameClockAmber` | `#FBBF24` | 7-segment master game clock LED (`MM:SS.d`) |
| | `shotClockGreen` | `#34D399` | Emerald LED for possession time $\ge 10\text{s}$ |
| | `shotClockAmber` | `#FBBF24` | Amber LED for possession time between $5\text{s}$ and $9.9\text{s}$ |
| | `shotClockRed` | `#F87171` | Rose warning LED for possession time $< 5\text{s}$ |
| | `clockBlanked` | `0x730369A1` | Dimmed sky blue for Rule WP 20.15 blanked `--` |
| **3D Plungers** | Start / Play | `#34D399` $\to$ `#10B981` $\to$ `#047857` | Emerald bevel (`#065F46`), 3D tactile plunger |
| | Stop / Whistle | `#FB7185` $\to$ `#F43F5E` $\to$ `#BE123C` | Rose bevel (`#881337`), 3D tactile plunger |
| | Reset 30 | `#34D399` $\to$ `#059669` $\to$ `#065F46` | Emerald bevel (`#022C22`), turnover reset |
| | Reset 20 | `#FBBF24` $\to$ `#D97706` $\to$ `#B45309` | Amber bevel (`#92400E`), rebound/foul reset |
| | Undo | `#A78BFA` $\to$ `#8B5CF6` $\to$ `#6D28D9` | Violet bevel (`#4C1D95`), 1-click state undo |

> **Design Guardrail**: Strict prohibition of pitch-black canvas backgrounds (`#000000`, `#06080d`, `Colors.black`). All surfaces and containers are styled using the sunlit aquatic color system.

---

## Responsive Dual-Thumb Handheld Ergonomics

PoloPad Pro uses `LayoutBuilder` to continuously adapt to the available window constraints:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TABLET DUAL-THUMB LAYOUT (> 600dp)              │
├──────────────┬──────────────────────────────────────────┬──────────────┤
│  LEFT THUMB  │               CENTER STAGE               │ RIGHT THUMB  │
│  (170dp)     │                                          │ (170dp)      │
│              │  ┌────────────────────────────────────┐  │              │
│ ┌──────────┐ │  │ Match Header & Telemetry Actions   │  │ ┌──────────┐ │
│ │          │ │  └────────────────────────────────────┘  │ │          │ │
│ │          │ │  ┌───────────────┐  ┌───────────────┐ │  │ │ RESET 30  │ │
│ │  START   │ │  │ White Team    │  │ Dark Team     │ │  │ │ Turnover │ │
│ │    /     │ │  │ Bay (Caps/Ex) │  │ Bay (Caps/Ex) │ │  │ │          │ │
│ │  STOP    │ │  └───────────────┘  └───────────────┘ │  │ └──────────┘ │
│ │          │ │  ┌──────────────────────────────────┐ │  │ ┌──────────┐ │
│ │ (Giant)  │ │  │ Recessed Master Clocks & WP 20.15│ │  │ │ RESET 20  │ │
│ │          │ │  └──────────────────────────────────┘ │  │ │ Rebound/ │ │
│ │          │ │  ┌──────────────────────────────────┐ │  │ │ Foul     │ │
│ └──────────┘ │  │ Period Selector & 1-Click Undo   │ │  │ └──────────┘ │
│              │  └──────────────────────────────────┘ │  │              │
└──────────────┴──────────────────────────────────────────┴──────────────┘
```

- **Tablet Mode (`maxWidth > 600`)**: Keeps primary action zones under the thumbs while table workers hold the tablet with both hands. The left thumb operates start/stop, while the right thumb operates stacked reset 30 and reset 20 plungers.
- **Mobile Mode (`maxWidth <= 600`)**: Compact, single-column stacked layout with `SingleChildScrollView` and `FittedBox` font scaling. Guarantees zero `RenderFlex` overflows down to 320dp width.

---

## World Aquatics Rule WP 20.15 Auto-Blanking

Under World Aquatics Rule WP 20.15:
> *"The shot clock shall be blanked when less than 30 or 20 seconds remain in any period, whichever applies."*

PoloPad Pro continuously evaluates:
$$\text{isBlanked} = (\text{gameTimeMs} \le \text{shotTimeMs})$$

When `isBlanked` is `true`:
1. The shot clock digits transition from countdown numbers to dimmed `--` (`AquaticColors.clockBlanked`).
2. The `WP 20.15 AUTO-BLANKED` status badge activates in amber.
3. Automated shot clock expiration horns are suppressed, allowing the definitive period end horn (2.2-second blast) to sound cleanly without conflicting acoustic signals.

---

## Bluetooth Low Energy (BLE) BLE GATT Profile

PoloPad Pro connects wirelessly to the ESP32-S3 PoloBridge hardware dongle using the BLE GATT profile:

- **Service UUID**: `4fa10001-b5a3-f393-e0a9-e50e24dcca9e`
- **Command Characteristic**: `4fa10002-b5a3-f393-e0a9-e50e24dcca9e` (Write)
- **Status Characteristic**: `4fa10003-b5a3-f393-e0a9-e50e24dcca9e` (Notify / Read)

### 13-Byte Binary Status Packet Format

| Byte Offset | Field Name | Type / Encoding | Description |
|:---|:---|:---|:---|
| `0` | Flags | uint8 bitfield | Bit 0: `isRunning`, Bit 1: `hornActive`, Bit 2: `isBlanked` |
| `1..4` | Game Time | uint32 Big-Endian | Remaining game clock time in milliseconds |
| `5..8` | Shot Time | uint32 Big-Endian | Remaining shot clock time in milliseconds |
| `9` | White Score | uint8 | White team score tally ($0..255$) |
| `10` | Dark Score | uint8 | Dark team score tally ($0..255$) |
| `11` | Period | uint8 | Match period ($1..4$ regulation, $5$ OT) |
| `12` | Protocol | uint8 | `0` = Colorado Time Systems (`CTS 9600-8-E-1`), `1` = Daktronics (`DAKT CODE 4498`) |

---

## Running Widget Previews

PoloPad Pro incorporates isolated `@Preview` widgets in `lib/widget_previews.dart` using `package:flutter/widget_previews.dart`.

### In IDE (Android Studio / VS Code):
1. Open the project in your IDE with Flutter support.
2. Open `lib/widget_previews.dart`.
3. Open the **Flutter Widget Preview** tab in the sidebar to inspect:
   - Tablet Dual-Thumb Layout (`Size(1024, 768)`)
   - Mobile Stacked Layout (`Size(375, 812)`)
   - Mobile Compact Stacked Layout (`Size(320, 568)`)
   - 3D Tactile Plungers (Start/Stop, Reset 30, Reset 20, Undo)
   - Master Game Clock & Shot Clock (Normal, Warning, Critical, WP 20.15 Blanked)
   - Team Bay & Active Exclusion Bay
   - Match Selector & Telemetry Feed Sheets

### Via CLI:
```bash
cd flutter_app
export PATH=/opt/homebrew/bin:$PATH
flutter widget-preview start
```

---

## Testing & Quality Assurance Suites

PoloPad Pro includes comprehensive unit, widget, empirical stress, and 4-tier E2E acceptance test suites.

### 1. Unit & Widget Tests
```bash
cd flutter_app
export PATH=/opt/homebrew/bin:$PATH

# Run all unit tests
flutter test test/unit/

# Run widget layout and interaction tests
flutter test test/widget/

# Run complete test suite with coverage
flutter test --coverage
```

### 2. 4-Tier Automated Acceptance Tests (E2E)
```bash
cd flutter_app
export PATH=/opt/homebrew/bin:$PATH

# Headless integration test execution
flutter test integration_test/app_test.dart

# Host-driven execution via Flutter Driver
flutter drive \
  --driver=test_driver/integration_test.dart \
  --target=integration_test/app_test.dart
```

### 3. Empirical Stress & Verification Scripts
```bash
cd flutter_app
export PATH=/opt/homebrew/bin:$PATH

# 1,000-tick numerical precision and immutability stress harness
node test/run_stress_harness.js

# 4-Tier static test suite validator
node ../.agents/teamwork/teamwork_test_writer_e2e_1/verify_test_suite.js
```

---

## Toolchain & Environment Setup

### Prerequisites
- **Flutter SDK**: `>= 3.16.0` (channel `stable`)
- **Dart SDK**: `>= 3.2.0 < 4.0.0`
- **Node.js**: `>= 18.0.0` (for local test harness execution)

### macOS Toolchain Guardrails
To prevent hanging on unaccepted Apple Command Line Tools license shims, always prepend `/opt/homebrew/bin` to `PATH` and avoid calling `/usr/bin/git` or `/usr/bin/python3`:

```bash
# Add to ~/.zshrc or execute in active shell:
export PATH=/opt/homebrew/bin:$PATH

# Verify Homebrew binaries
which git    # Should resolve to /opt/homebrew/bin/git
which node   # Should resolve to /opt/homebrew/bin/node
```

---

## License

This project is licensed under the MIT License — see the LICENSE file for details.
