---
title: "05 — Phone Console, Haptic Feedback & Pocket Ergonomics"
tags: [polopad-pro, phone, mobile, haptics, pwa]
status: production-verified
updated: 2026-11-08
---

# Phone Console, Haptic Feedback & Pocket Ergonomics

Back to [[00_PoloBridge_MOC]] | Design System: [[04_Aquatic_Design_System]]

> [!important] Pocket-Ready Pool Deck Operation
> Allows a water polo referee, coach, or parent table volunteer to run official match timing directly from an iPhone or Android phone without needing to bring or mount a full 10.9" iPad.

## 1. Dual Phone Orientations
- **Portrait Mode ("One-Hand Pocket Controller")**:
  - Pinned Olympic Bezel Clocks (Game & Shot) + Period selector
  - Live Scoreboard strip with quick `+1` / `-1` stepper
  - Hero Full-Width `START / STOP` Plunger (80px+ height, tactile 3D plunge)
  - Side-by-side `30s FULL RESET` & `20s EXCL / REBOUND` plungers
  - Quick action bar: `Horn`, `Excl 20s` (Cap Modal), `Time-Out`, `Undo`
  - Zero-scroll layout guaranteed on screens down to iPhone SE (`375x667`)
- **Landscape Mode ("Dual-Thumb Pocket Console")**:
  - Left Thumb: `START / STOP` + `HORN`
  - Center: Recessed Twin Clocks, Period & Scores
  - Right Thumb: `30s RESET` + `20s RESET` + `UNDO`

## 2. Poolside Haptic Engine (`phone-haptics.ts`)
- `tap`: 15ms pulse
- `start`: 25ms pulse
- `stop`: `[35, 30, 35]`ms pulse
- `reset30`: `[20, 30, 20]`ms crisp double pulse (identifies 30s reset without looking)
- `reset20`: `[15, 25, 15, 25, 20]`ms triple pulse (identifies 20s rebound/exclusion)
- `horn`: `[120, 60, 120, 60, 180]`ms heavy resonant burst

## 3. Screen Wake-Lock API
- Calls `navigator.wakeLock.request('screen')` on mount to keep the screen on throughout the match.
- Auto-reacquires wake-lock on `visibilitychange` when returning from another app.

## 4. Dynamic 20s Plunger & Turnover Exclusion Release (Rule WP 21)
- **NFHS 30s Only vs NCAA 20s/30s Mode**:
  - Top masthead ruleset badge is a 1-tap interactive toggle (`onToggle20sReset`).
  - When in High School 30s-only mode (`enable20sReset === false`), the **20s reset plunger goes away** in both Portrait and Landscape orientations, leaving a single full-width/full-height 30s hero plunger (`30s FULL RESET — ALL RESETS 30s`), matching iPad behavior.
- **Turnover / Change of Possession Release**:
  - Hitting `30s RESET` (Turnover / Goal) automatically clears and releases defending team 20s exclusions per World Aquatics Rule WP 21.3 / WP 21.11, immediately dismissing active 20s penalty banners.
