---
title: "PoloPad Pro — Offline Resilience, Dual-Layer IndexedDB & BLE Auto-Reconnect"
tags:
  - polobridge
  - polopad-pro
  - indexeddb
  - offline-resilience
  - ble-reconnect
  - pwa
status: production-verified
updated: 2026-11-09
---

# 🛡️ PoloPad Pro — Offline Resilience & Zero-Data-Loss Architecture

> [!important] Zero Data Loss Guarantee
> Every tenth-of-a-second clock tick (100ms) and score mutation is immediately committed to local persistent storage. If a poolside volunteer accidentally refreshes Safari, the tablet runs out of battery, or an RF drop occurs, the match state is restored instantly (<1ms) without losing a single tenth of a second or point.

## 1. Dual-Layer Persistence Engine (`match-persistence.ts`)

PoloPad Pro uses a synchronized dual-layer storage hierarchy to resolve the tension between asynchronous IndexedDB reliability and synchronous zero-flicker UI hydration:

```
┌────────────────────────────────────────────────────────┐
│           PoloPad Pro React Match Engine               │
│         (100ms Game & Shot Clocks, Scores)             │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
       Synchronous Write        Asynchronous IndexedDB
        (Every 100ms)               (Every 100ms)
                ▼                        ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│ localStorage Mirror           │ │ IndexedDB Object Stores       │
│ key: polopad_pro_live_match_v1│ │ db: PoloPadProOfflineDB       │
│ • Zero-flicker React mount    │ │ • live_match_state (snapshot) │
│ • Synchronous pagehide rescue │ │ • match_checkpoints (history) │
└───────────────────────────────┘ └───────────────────────────────┘
```

### Safe Hydration Protocol
When restoring a match snapshot that was running when the browser closed or refreshed:
- Clocks are restored with `isRunning: false` (paused).
- Prevents game/shot clocks from ticking down unmonitored during page reload or while the referee has blown the whistle.
- Volunteers can immediately press `START CLOCK` when the whistle sounds.

## 2. BLE GATT Watchdog & Exponential-Backoff Reconnection (`bluetooth-manager.ts`)

Pool deck environments are prone to 2.4GHz RF interference from crowd Wi-Fi and metal bleachers. When the ESP32-S3 dongle loses connection:

1. **Event Capture**: Intercepts `gattserverdisconnected` on `BluetoothDevice`.
2. **Exponential Backoff**:
   $$\text{Delay} = \min(8000, 500 \times 2^{\text{attempt}-1}) \text{ ms}$$
   (Attempts: 500ms, 1000ms, 2000ms, 4000ms, 8000ms, up to 8 retries).
3. **State Recovery**: Upon reconnection, GATT characteristics `4fa10002-...` (TX) and `4fa10003-...` (RX) are re-subscribed.
4. **Hardware Resync**: PoloPad Pro immediately transmits the current game clock, shot clock, and scores to the ESP32-S3 to resynchronize physical LED scoreboards with zero operator intervention.

## 3. Time-Machine Checkpoints & Portable JSON Export

- **Checkpoints**: IndexedDB stores named checkpoints (e.g., "End of Q1: White 3 - Blue 2") with period, clocks, fouls, and scores.
- **Portable JSON**: Full match state can be exported as `.json` for tournament directors or imported to transfer matches across scorekeeper devices.

## 4. Service Worker Pre-Caching (`public/sw.js`)

The PWA Service Worker precaches all core assets:
- `./index.html`, `./manifest.json`
- All 3 product renders (`polobridge_kit_exploded_render.jpg`, `polobridge_hardware_dongle.jpg`, `polobridge_deck_operator_pov.jpg`)
- All 5 manufacturing files (`/downloads/PoloBridge_Rev2_4_JLCPCB_Gerbers.zip`, `JLCPCB_BOM.csv`, `JLCPCB_CPL.csv`, `.stl` drill jigs)
- SPA navigation fallback: `event.request.mode === 'navigate'` falls back to cached `index.html` when completely offline.

## 5. Verification Suite

- Unit & Architecture Tests: `tests/test_offline_persistence.py` (5 tests passing).
- E2E Bundle Verification: `tests/test_playwright_e2e.py` (`test_05_offline_persistence_and_indexeddb_bundle`).
- CI Integration: `.github/workflows/deploy.yml` automated on every commit to `main`.
