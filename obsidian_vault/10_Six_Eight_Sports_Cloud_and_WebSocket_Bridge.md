---
title: "Live 6-8 Sports Cloud Sync & WebSocket Bridge (Protocol 6-8-gamedesk-v2)"
tags:
  - polobridge
  - polopad-pro
  - six-eight-sports
  - websockets
  - tournament-bracket
  - water-polo
status: production-live
updated: 2026-11-12
---

# ⚡ Live 6-8 Sports Cloud Sync & WebSocket Bridge

> [!important] Production Specification
> - **Engine Source**: `react_app/src/engine/six-eight-bridge.ts`
> - **UI Component**: `react_app/src/components/six-eight-panel.tsx`
> - **Sub-Protocol**: `6-8-gamedesk-v2`
> - **BroadcastChannel**: `polopad_68sports_bridge`
> - **Persistence**: IndexedDB queue (`PoloPadProOfflineDB` -> `six_eight_event_queue`)

---

## 1. Executive Summary & Architecture

The **6-8 Sports Cloud Sync & WebSocket Bridge** establishes an ultra-low-latency, resilient bi-directional telemetry link between the pool deck PoloPad Pro console, the 6-8 Sports Game Desk cloud, and 4-court tournament bracket directors.

```
       +---------------------------------------------+
       |           PoloPad Pro Pool Deck Console     |
       |  (100ms Clocks, WP 20.15 Blanking, Audio)   |
       +----------------------+----------------------+
                              |
                     logSixEightEvent()
                              |
                              v
       +---------------------------------------------+
       |   SixEightBridgeManager (Protocol v2)       |
       |  - Exponential Backoff (500ms -> 8000ms)    |
       |  - Persistent Offline Queue (Zero Loss)     |
       +--------------+---------------+--------------+
                      |               |
     BroadcastChannel |               | WSS Secure Stream
   'polopad_68sports' |               | (6-8-gamedesk-v2)
                      v               v
           +------------------+  +-------------------+
           | Multi-Tab Courts |  |  6-8 Sports Cloud |
           | Local Relay Bus  |  |  & Live Brackets  |
           +------------------+  +-------------------+
```

---

## 2. Exponential Backoff & Chaos Recovery

Pool deck Wi-Fi is notoriously unstable. The bridge implements strict exponential backoff reconnect policy:

- **Initial retry delay**: 500 ms
- **Multiplier**: `Math.min(8000, currentDelay * 2)`
- **Cap**: 8,000 ms (8 seconds)
- **Offline Buffer Guarantee**: When disconnected or socket state is not `OPEN`, incoming telemetry packets (`desk.pi_event`, `desk.score_update`, `desk.exclusion_issued`, etc.) are queued into `offlineQueue` and mirrored to storage.
- **Auto-Replay Flush**: Upon successful socket handshake (`wss.connect_ack`), queued events are replayed in chronological sequence with preserved sequence IDs.

---

## 3. Multi-Court Tournament Bracket Synchronization

The `TournamentBracket` data model manages 4-court championship pipelines:
1. **Quarterfinals (4 Matches)**: Courts 1 through 4 run simultaneous quarterfinals. Court 1 scores directly synchronize with the active PoloPad Pro desk.
2. **Semifinals (2 Matches)**: Winners of QF-1/QF-2 advance to SF-1, QF-3/QF-4 advance to SF-2.
3. **Consolation & Finals**:
   - **3rd Place Final**: Bronze medal match.
   - **Championship Final**: Gold medal match.

---

## 4. Team Rosters & 6-8 Performance Index (PI)

The bridge streams player-level actions to compute real-time 6-8 Performance Index (PI) metrics:
- **Goals & Shot Quality**: +0.8 to +1.2 PI
- **Goalkeeper Saves**: +0.6 to +1.5 PI
- **Steals & Field Blocks**: +0.5 to +0.9 PI
- **Earned Exclusions / Penalties**: +0.6 PI
- **Turnovers / Exclusions Conceded**: -0.5 to -0.8 PI

---

## 5. Automated Verification & Quality Assurance

The bridge is guarded by 5 dedicated Python architecture tests (`tests/test_six_eight_bridge.py`), Playwright E2E bundle verification (`tests/test_playwright_e2e.py` `test_08_six_eight_bridge_bundle`), and TypeScript strict checking:

```bash
# Verify bridge architecture
python3 tests/test_six_eight_bridge.py

# Verify E2E bundle tokens
python3 tests/test_playwright_e2e.py
```
