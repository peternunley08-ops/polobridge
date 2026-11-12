---
title: "Volunteer Table Quick-Start Cheat-Sheet & Training Simulator"
tags:
  - polobridge
  - polopad-pro
  - volunteer-training
  - referee-signals
  - shot-clock-matrix
  - water-polo-rules
status: production-live
updated: 2026-11-12
---

# 📋 Volunteer Table Quick-Start Cheat-Sheet & Training Simulator

> [!important] Production Specification
> - **Engine Source**: `react_app/src/engine/volunteer-training.ts`
> - **UI Component**: `react_app/src/components/volunteer-training-panel.tsx`
> - **Whistle Decoder**: Interactive audio preview via Web Audio acoustic synthesis
> - **Rules Coverage**: USAWP, NCAA, NFHS High School, World Aquatics WP 20-22
> - **Print Layout**: 1-page printable poolside reference (`@media print` optimized)

---

## 1. Executive Summary & Volunteer Challenges

The single largest source of timing errors and coach frustration at high school and club water polo tournaments is untrained parent volunteers operating the desk console.

The **PoloPad Pro Volunteer Suite** resolves this by providing:
1. **1-Page Printable Poolside Cheat-Sheet**: Clear, high-contrast, zero-ambiguity reference card designed to sit directly on the table.
2. **Referee Whistle & Hand Signal Decoder**: Acoustic audio playback of referee whistle cadences (1 short, 2 short + 1 long, 1 long blast, 2 long blasts).
3. **30s vs 20s Shot Clock Decision Matrix**: Step-by-step logic covering offensive rebounds (Rule WP 20.16), corner throws, turnovers, and exclusion resets.
4. **Interactive Situation Training Simulator**: 6 realistic pool-deck game situations testing volunteer decision-making with immediate corrective coaching.

---

## 2. The Three Golden Rules for Scoring Volunteers

1. **Rule 1: Start / Stop Clock**
   - **START**: On the referee’s whistle when a player puts the ball into play, or when a player clearly puts the ball in play with a visible hand pass.
   - **STOP**: On **ANY** referee whistle blast, goal, exclusion, or official timeout.
2. **Rule 2: When to Reset 30s**
   - **30s RESET**: Whenever the **OTHER** team clearly gains ball control (turnover, steal, offensive foul, goal scored).
   - **NEVER**: On an ordinary foul outside 6 meters!
3. **Rule 3: When to Reset 20s**
   - **20s RESET**: Attacking team rebounds shot off goalpost or goalie save (Rule WP 20.16), corner throws, and defending exclusions with less than 20 seconds remaining.

---

## 3. Referee Whistle & Hand Signal Decoder

| Signal Meaning | Whistle Pattern | Referee Hand Gesture | Required Table Action |
| :--- | :--- | :--- | :--- |
| **Ordinary Foul** | 1 Short Blast (📯) | Arm pointing in attack direction | **DO NOT RESET** shot clock. Keep running on pass. |
| **Turnover / Steal** | 1 Sharp Blast (📯) | Arm pointing opposite direction | **Tap [30s RESET]** immediately. Possession changed. |
| **20s Exclusion** | 2 Short + 1 Long (📯📯—📯) | Points to cap #, sweeps to corner | Stop clock -> enter cap # -> **resets to 20s** (30s HS). |
| **Goal Scored** | 1 Long Blast (📯———) | Arm lowered toward pool center | Stop clock -> **[+1 Goal]** -> resets 30s & releases penalties. |
| **Corner Throw** | 1 Short Blast (📯) | Points to 2m corner cone | **Tap [20s RESET]** (30s in NFHS High School). |
| **5-Meter Penalty** | 2 Long Blasts (📯——📯——) | Raises 5 fingers vertically | Stop clock. If missed & offense rebounds, **reset 20s**. |

---

## 4. Automated Verification & Quality Assurance

- **Unit Test Suite**: `tests/test_volunteer_training.py` (6/6 PASS)
- **Playwright E2E Verification**: `tests/test_playwright_e2e.py` (`test_11_volunteer_training_bundle`, 11/11 PASS)
- **Engine TypeScript Suite**: 250 / 250 PASS (`npm test`)
