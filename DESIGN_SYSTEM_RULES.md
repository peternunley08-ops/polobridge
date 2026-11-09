# PoloBridge & PoloPad Pro — Figma MCP Design System Rules

This document defines the authoritative design system rules, token architecture, component conventions, and styling guardrails for integrating Figma designs into the **PoloBridge & PoloPad Pro** codebase (`react_app/` and `ipad_app/`).

---

## 1. Token Definitions

### Where Design Tokens Are Defined
1. **Tailwind Theme Tokens**: [`react_app/tailwind.config.js`](./react_app/tailwind.config.js)
   - Defines the `aquatic.*` color palette (`pool`, `sapphire`, `indigo`, `cyan`, `emerald`, `amber`, `rose`), typography families (`sans`, `mono`), and 3D mechanical plunger elevation shadows (`shadow-plunger-emerald`, `shadow-plunger-amber`, `shadow-plunger-rose`).
2. **Global CSS Custom Properties**: [`react_app/src/index.css`](./react_app/src/index.css)
   - Defines root surface variables (`--aquatic-bg-start`, `--aquatic-bg-mid`, `--aquatic-bg-end`, `--card-glass`, `--border-subtle`, `--border-active`).
3. **SwiftUI Native Color & Surface Tokens**: [`ipad_app/PoloPadView.swift`](./ipad_app/PoloPadView.swift)
   - Mirrors the exact RGB values for iPadOS native rendering (`Color(red: 0.05, green: 0.29, blue: 0.43)` sky-900 through `Color(red: 0.12, green: 0.11, blue: 0.29)` indigo-950).

### Strict Color Guardrail (No Pitch-Black Surfaces)
Per [`AGENTS.md`](./AGENTS.md), **never** map Figma dark frames to pitch-black (`#000000`, `#06080d`, `#040508`, `bg-black`). Always translate dark Figma surfaces into the **Sunlit Olympic Pool Aquatic Palette**:

| Semantic Token | Tailwind Class | Hex / Value | Usage |
| :--- | :--- | :--- | :--- |
| **App Canvas Gradient** | `bg-gradient-to-br from-sky-900 via-blue-900 to-indigo-950` | `#0c4a6e → #1e3a8a → #1e1b4b` | Root viewport & poolside background |
| **Primary Card Surface** | `bg-sky-950/75 backdrop-blur-xl` | `rgba(8, 47, 73, 0.75)` | Score cards, BOM panels, modals |
| **Optical Clock Chamber** | `bg-indigo-950/90` | `rgba(30, 27, 75, 0.90)` | Recessed high-contrast LED clock readouts |
| **Glass Border** | `border-cyan-400/30` (active: `border-cyan-300/60`) | `rgba(34, 211, 238, 0.30)` | All cards, headers, and interactive groups |
| **Start / 30s Action** | `from-emerald-400 to-emerald-600` | `#34d399 → #059669` | `START CLOCK` and `30s FULL RESET` plungers |
| **20s Rebound / Clock Digit** | `from-amber-300 to-amber-500` / `text-amber-300` | `#fcd34d → #f59e0b` | `20s REBOUND / EXCL` plunger & Game Clock digits |
| **Stop / Shot Clock / Horn** | `from-rose-500 to-red-700` / `text-rose-400` | `#f43f5e → #b91c1c` | `STOP CLOCK`, `AIR HORN`, & Shot Clock digits |

---

## 2. Component Library & Architecture

### Where UI Components Are Defined
- **Web / iOS PWA Components**: [`react_app/src/components/`](./react_app/src/components/)
  - [`landing-page.tsx`](./react_app/src/components/landing-page.tsx) — Commercial product showcase, RF/isolation cards, multi-pool ROI calculator, and school pricing tiers.
  - [`hardware-bom-panel.tsx`](./react_app/src/components/hardware-bom-panel.tsx) — Ready-to-order Tier 1 & Tier 2 BOM table, DigiKey/JLCPCB CSV exporters, and 5-step assembly checklist.
  - [`mockups-gallery.tsx`](./react_app/src/components/mockups-gallery.tsx) — 4K studio renders, iPad vs. Dongle split-view, 4-layer 2.5kV isolated PCB CAD blueprint, and deck topology diagram.
  - [`six-eight-panel.tsx`](./react_app/src/components/six-eight-panel.tsx) — 6-8 Sports Game Desk roster import, cap-number editor, and live play-by-play cloud telemetry.
- **Core Operator Console**: [`react_app/src/App.tsx`](./react_app/src/App.tsx)
  - Houses the Dual-Thumb Varsity Console, **1-Click Simple Volunteer Plunger Mode**, 1080p60 OBS Broadcast Scorebug Overlay, Virtual LED Scoreboard Rack, and Official Printable Match Scoresheet.
- **Native SwiftUI View Layer**: [`ipad_app/PoloPadView.swift`](./ipad_app/PoloPadView.swift)

### Naming & Architecture Convention
- **Filename Rule**: Every file in `react_app/src/components/` and `react_app/src/utils/` MUST use **lowercase, hyphen-separated names** (`kebab-case.tsx` / `kebab-case.ts`).
- **Component Pattern**: Functional React 18 components with TypeScript interfaces for props, localized UI state, and deterministic callbacks passed down from `App.tsx`.

---

## 3. Frameworks, Libraries & Build System

- **UI Framework**: React `^18.3.1` with TypeScript `^5.4.5` (`react_app/`) + SwiftUI (`ipad_app/`).
- **Styling Engine**: Tailwind CSS `^3.4.4` with `clsx` (`^2.1.1`) and `tailwind-merge` (`^2.3.0`).
- **Animation & State**: `framer-motion` (`^11.2.10`), `zustand` (`^4.5.2`), `zundo` (`^2.1.0`).
- **Build & Bundler**: Vite `^5.3.1` (`npm run dev` on port `3000`, `npm run build` running `tsc && vite build`).
- **iOS Native Packaging**: Capacitor (`react_app/capacitor.config.ts`), iOS WebApp Manifest (`react_app/public/manifest.json`), and Swift Package Manager (`Package.swift`).

---

## 4. Asset Management

- **Canonical Asset Locations**:
  - Repository-level documentation renders: [`assets/`](./assets/)
  - Web app static public assets: [`react_app/public/assets/`](./react_app/public/assets/)
    - `polobridge_hardware_dongle.jpg` — IP67 waterproof dongle studio render
    - `polobridge_deck_operator_pov.jpg` — Poolside operator POV render
    - `polobridge_kit_exploded_render.jpg` — Exploded CAD kit render (PCB, LiPo, antenna, Neutrik jacks)
- **Referencing Pattern**: Reference static images in React components via root-relative paths (`/assets/<filename>.jpg`) so Vite resolves them identically in dev and production builds.

---

## 5. Icon System

- **Library**: `lucide-react` (`^0.395.0`) in React; **SF Symbols** (`play.fill`, `pause.fill`, `speaker.wave.3.fill`, `arrow.uturn.backward`) in SwiftUI.
- **Usage Pattern**:
  ```tsx
  import { Bluetooth, Cpu, Download, Play, Pause, RotateCcw, Shield, Trophy, Volume2 } from 'lucide-react';

  <Bluetooth size={14} className="text-emerald-300" />
  ```
- **Sizing Convention**:
  - Compact pill / badge icons: `size={11}` to `size={14}`
  - Card & section header icons: `size={18}` to `size={26}`
  - Primary 3D plunger actuator icons: `size={48}` to `size={56}`

---

## 6. Styling Approach & 3D Tactile Plunger Pattern

- **Methodology**: Utility-first Tailwind CSS combined with physical 3D button shadows (`shadow-[0_10px_0_#065f46] active:translate-y-2`) to simulate waterproof mechanical deck switches under wet fingers.
- **Canonical 3D Plunger Snippet**:
  ```tsx
  <button
    onClick={reset30}
    className="rounded-3xl p-6 flex flex-col items-center justify-center gap-2 border-t-2 border-white/50 bg-gradient-to-b from-teal-400 to-emerald-600 text-sky-950 shadow-[0_10px_0_#115e59] active:translate-y-2 cursor-pointer transition select-none"
  >
    <span className="text-3xl sm:text-4xl font-black font-mono">30s FULL RESET</span>
    <span className="text-xs font-mono font-bold uppercase">Turnover / New Possession [R]</span>
  </button>
  ```
- **Typography Rules**:
  - All numeric clocks (`07:00.0`, `30.0`), RS-232 hex bytes (`0x8A`), and cap numbers (`#7`) MUST use `font-mono tabular-nums font-black` so digits never jitter during 100ms countdown ticks.
  - Maintain a minimum `12px` (`text-xs`) floor for field-operator legibility in bright sunlight.

---

## 7. Project Structure Overview

```text
polobridge/
├── AGENTS.md                        # Workspace guardrails & aquatic palette rules
├── DESIGN_SYSTEM_RULES.md           # Figma MCP design system specification
├── MASTER_PLAN_AND_BOM.md           # Full engineering & protocol blueprint
├── Package.swift                    # SwiftPM manifest for native iOS/macOS
├── assets/                          # 4K Studio Hardware & Deck Renders
├── firmware/
│   ├── polobridge_firmware.ino      # Rev 2.5 ESP32-S3 BLE + Dual RS-232 + 3-Ch Pickle + 105dB Horn
│   └── HARDWARE_WIRING.md           # Tier 1 ($24.40) & Tier 2 ($49.85) BOM + 2.5kV Schematic
├── hardware/jlcpcb_production/      # Turnkey JLCPCB Gerbers, LCSC BOM.csv & Pick-and-Place CPL.csv
├── ipad_app/                        # Native SwiftUI iPadOS App
└── react_app/                       # React 18 + TypeScript + Tailwind WebBLE / iOS PWA
    ├── tailwind.config.js           # Aquatic color & shadow tokens
    └── src/
        ├── App.tsx                  # Varsity Console, Simple Volunteer Mode, Scorebug & Scoresheet
        ├── index.css                # Aquatic root CSS variables & glass-panel utilities
        ├── components/              # Modular kebab-case UI panels
        └── utils/                   # BLE GATT driver, WebAudio synth & 6-8 Sports client
```
