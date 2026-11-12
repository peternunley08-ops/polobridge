---
title: "Live OBS & vMix Broadcast Scorebug Stream Overlay Suite"
tags:
  - polobridge
  - polopad-pro
  - broadcast-scorebug
  - obs-studio
  - vmix
  - hudl
  - graphics-overlay
status: production-live
updated: 2026-11-12
---

# 📺 Live OBS & vMix Broadcast Scorebug Stream Overlay Suite

> [!important] Production Specification
> - **Engine Source**: `react_app/src/engine/broadcast-manager.ts`
> - **UI Component**: `react_app/src/components/broadcast-overlay-panel.tsx`
> - **Broadcast Channel**: `polopad_broadcast_stream`
> - **Supported Graphic Themes**: Olympic Ribbon, ESPN Lower-Third, Hudl Stream Pill, Minimal Corner Bug
> - **Chroma Modes**: Transparent Alpha, Green Screen (`#00FF00`), Blue Screen (`#0000FF`)
> - **Direct OBS URL**: `https://peternunley08-ops.github.io/polobridge/?mode=overlay&theme=olympic&chroma=transparent`

---

## 1. Executive Summary & Broadcast Architecture

For high school, club, and collegiate water polo livestreams (YouTube Live, Twitch, Hudl TV, ESPNU), having a clean, transparent, real-time scorebug is vital. The **PoloPad Pro Broadcast Scorebug Suite** turns any laptop or tablet running PoloPad Pro into an automated television broadcast graphics generator.

```
       +---------------------------------------------+
       |         PoloPad Pro Pool Deck Console       |
       |     (Clocks, Goals, Exclusions, Timeouts)   |
       +----------------------+----------------------+
                              |
               broadcastManager.broadcastState()
                              |
                     BroadcastChannel
               'polopad_broadcast_stream'
                              |
                              v
       +---------------------------------------------+
       |   OBS Studio / vMix Browser Source HUD      |
       |  (?mode=overlay&theme=olympic&chroma=alpha) |
       |  - 100ms Synchronized Clocks                |
       |  - Rule WP 20.15 Auto-Blanking              |
       |  - Power-Play Exclusion Sub-Bar             |
       |  - Sponsor / Tournament Headline Banner     |
       |  - Animated Goal Splash Badges              |
       +---------------------------------------------+
```

---

## 2. Graphic Overlay Themes

1. **Olympic Ribbon**:
   - High-visibility aquatic cyan & sapphire glass banner with gold medal trims and glowing period badge.
   - Built for major tournament championship finals and FINA/World Aquatics streams.
2. **ESPN Lower-Third**:
   - Sleek modern horizontal broadcast ribbon with team primary/secondary blocks, tabbed clocks, and sharp athletic typography.
3. **Hudl Stream Pill**:
   - Compact stadium pill designed for high school live feeds with minimal screen footprint and high readability on mobile devices.
4. **Minimal Corner Bug**:
   - Non-intrusive floating corner widget ideal for multi-camera streams where water view must remain unobstructed.

---

## 3. Broadcast Rules & Compliance

- **Rule WP 20.15 Shot Clock Blanking**: When the game clock is less than or equal to the shot clock, the shot clock automatically blanks to `:--`.
- **Under-5-Second Urgency**: Shot clock pulses red/amber when below 5.0 seconds.
- **Power Play Tracking**: Live exclusions automatically render in a sub-bar below the scorebug with the cap number, team name, and remaining seconds countdown.
- **Sponsor & Headline Ticker**: Real-time ticker for local high school boosters, USAWP event titles, or pool sponsors.

---

## 4. Quality Assurance & Verification

- **Engine Architecture Tests**: `tests/test_broadcast_overlay.py` (5/5 PASS)
- **Playwright E2E Bundle Verification**: `tests/test_playwright_e2e.py` (`test_10_broadcast_overlay_bundle`, 10/10 PASS)
- **Engine TypeScript Suite**: 250 / 250 PASS (`npm test`)
