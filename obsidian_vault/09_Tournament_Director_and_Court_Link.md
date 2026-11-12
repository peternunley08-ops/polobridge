---
title: "PoloPad Pro — Tournament Director 4-Court Dashboard & Court Link"
tags:
  - polobridge
  - polopad-pro
  - tournament-director
  - court-link
  - multi-court
  - cloudflare-relay
status: verified-locally-relay-not-deployed
updated: 2026-11-12
---

# PoloPad Pro — Tournament Director 4-Court Dashboard & Court Link

## What it does

The Director tab shows four pool courses (Courts A to D) on one screen. Each court tile shows:

- the teams and scores
- the period and the game clock
- the shot clock
- active exclusions
- timeouts and cap-outs
- the last play
- the health of the link to that court's desk

The dashboard is read-only. Nothing it receives can start, stop or reset a clock on any desk. The desk remains the official clock.

Other parts of the feature:

- Full-screen mode hides the app masthead so all four courts fit on an iPad or phone. Digits scale up on a large display.
- A tournament ticker, with an optional chime and vibration.
- A landscape print summary.
- The Auto-Finder & Hub tab shows a live four-row list (`court-summary-list.tsx`) in place of the earlier hard-coded sample games.
- A demo of four simulated courts. Every demo tile is labelled DEMO. Demo data is never sent to other devices.

Related notes: [[07_Offline_Resilience_and_IndexedDB]] and [[03_Firmware_and_Protocols]].

## How the link works

Every scoring desk publishes a full snapshot of its match. The director projects (dead-reckons) both clocks between snapshots. A **1 Hz** heartbeat plus an immediate frame on every real change gives tenth-of-a-second clocks on the dashboard.

A desk transmits only when the director's projection would be wrong. The cases are a whistle, a reset, a goal, or a manual clock edit. Transmission is limited to **10 frames per second**, with a **150 ms** tolerance.

The clock offset between a desk and the director is estimated with a one-way minimum-delay filter.

## Files

- `react_app/src/engine/court-link.ts`: wire format with a strict bounded parser, clock projection, one-way minimum-delay clock offset filter, `CourtDirectory` (director side), and `CourtPublisher` (desk side).
- `react_app/src/engine/court-link-transports.ts`: BroadcastChannel transport (same device), WebSocket relay transport (cross-device), relay URL validation, per-device config, and invite links.
- `react_app/src/engine/court-link-session.ts`: the object the UI talks to. Transports run only while a court is published or a dashboard is open.
- `react_app/src/engine/court-simulator.ts`: four scripted matches for the labelled demo mode.
- `react_app/src/components/tournament-director-hub.tsx`: the dashboard (Director tab).
- `react_app/src/components/court-summary-list.tsx`: the live four-row list in the Auto-Finder & Hub tab.
- `react_app/src/components/use-court-link.ts`: React hooks.
- `cloudflare/court-relay/`: Cloudflare Worker and Durable Object relay for cross-device use.

## Rules carried over the link

- **WP 20.15**: the shot clock is blanked when the game clock is less than or equal to the shot clock. Projection does not change this relation, because both clocks lose the same amount.
- A shot clock reaching **0.0** stops both clocks, so a projection stops after the smaller of the game clock and the shot clock.
- **WP 21**: exclusions released on a goal are sent immediately.
- **WP 22.3**: capped-out players are listed per team, and a cap-out raises a warning alert.
- **NFHS**: the 30-second-only ruleset is flagged on the tile.

## Link health

Health is judged by the silence since the last frame from a desk.

| State | Silence since last frame | Behaviour |
|---|---|---|
| LIVE | under 3 s | clocks projected |
| LAGGING | 3 s to under 8 s | clocks still projected, amber badge |
| LINK LOST | 8 s or more | projection stops, last confirmed values shown |
| DESK SIGNED OFF | desk page closed | final values shown immediately |

## Court ownership and duplicate devices

- The first desk heard owns a court.
- A second device claiming the same court is not shown. After **2 frames within 5 s**, it is flagged as a conflict on the tile and in the ticker.
- Takeover happens only when the owner has signed off, has gone stale, or the claimant is a newer page load of the same device.
- Same browser, two tabs: a Web Lock named `polopad-court-desk:<room>:<court>` lets only one tab publish a court. A second tab shows as blocked and only watches.

## Transports and relay

| Transport | Reach | Needs |
|---|---|---|
| BroadcastChannel `polopad_court_link_v1:<room>` | same browser on the same device | nothing |
| WebSocket relay | different devices | the relay deployed, address pasted in Link Setup |

Relay client behaviour:

- Reconnect backoff: **500 ms**, **1 s**, **2 s**, **4 s**, then **8 s** for every later attempt. Retries continue indefinitely.
- Ping every **5 s**. The socket is treated as dead after **12 s** without a pong.

Relay limits:

- A frame may be at most **16 KB**.
- **30 frames per second** per socket.
- **24 sockets** per room.
- Frames must be JSON addressed to the room.
- Browser connections are limited to an origin allowlist.
- The room code is the only credential. Room codes generated by the app are 8 symbols from a 31-symbol alphabet, in the form `XXXX-XXXX`.

Stored settings and invite links:

- The key `polopad_pro_court_link_v1` in localStorage holds the room, court, device label, relay address and device id.
- The tab's own court is also remembered in sessionStorage.
- Invite links carry `pp-room`, `pp-court` and `pp-relay` in the URL fragment. The fragment is not sent to the web server.

## Setup for a tournament

1. Open Director, then Link Setup.
2. Choose New Private Room.
3. For cross-device use, deploy the relay and paste its address into Link Setup. Deployment needs Node.js **22.12** or newer. From `cloudflare/court-relay`, run:

   ```bash
   npx wrangler deploy
   ```

4. Copy the Desk A to Desk D invite links and give each one to the volunteer at that desk.

Same-device linking needs none of these steps.

## Status and limits

- Same-device linking works with no setup.
- Cross-device linking needs the relay deployed. **The relay has not been deployed.**
- The relay was verified locally under the Workers runtime (`wrangler dev`). It has not been verified on Cloudflare's network.
- The dashboard is informational. The desk remains the official clock.

## Shared clock engine

The scoring console and the director's projection use one clock function, `advanceMatchClocks`, in `react_app/src/engine/match-clock.ts`.

- The console counts whole 100 ms ticks against the wall clock and carries the remainder, so a late timer or a tablet that slept is caught up on the next callback.
- `useLiveState` (`react_app/src/components/use-live-state.ts`) keeps each clock value in React state and in a ref that is written first, so the timer loop reads current values without being restarted on every tick.
- The previous loop subtracted 100 ms per timer callback and ran slow: about 0.4 s lost in 20 s in headless Chromium.
- Shared stop rule: a 0.0 shot clock stops both clocks, and a 0.0 game clock ends the period. Desk and dashboard apply the same rule.
- Intended difference: after a pause, the clock jumps forward by the time that really passed.
- Tests: 33 in `react_app/tests/match-clock.test.ts`, including a comparison with the previous tick loop over 36,000 start states and tick counts (identical results).
- Not yet checked on a physical iPad or phone.

## Verification

Verification commands and results from 2026-11-10, except where a later date is given:

- **Engine tests**: **250** TypeScript tests on the engine source, using the Node built-in test runner. Result: 250/250 on 2026-11-12, made up of **217** court-link tests plus **33** clock tests in `match-clock.test.ts`. Run in `react_app/`:

  ```bash
  npm test
  ```

- **Relay tests**: **20** protocol tests against the real Worker under `wrangler dev`. Result: 20/20. Run in `cloudflare/court-relay/`:

  ```bash
  npm test
  ```

- **Browser end-to-end suite** in Chromium. Run from the repository root:

  ```bash
  node tests/e2e/director-dashboard.e2e.cjs
  ```

  Set `COURT_RELAY_URL` to include the two-device relay scenario:

  ```bash
  COURT_RELAY_URL=<relay-address> node tests/e2e/director-dashboard.e2e.cjs
  ```

- **Presence and wiring checks**, following the repository's other Python suites. Run from the repository root:

  ```bash
  python3 tests/test_tournament_director.py
  ```
