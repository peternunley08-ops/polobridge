---
title: "PoloPad Pro — Digital Scoresheet, Team Rosters & Rule WP 22.3 Cap-Out"
tags:
  - polobridge
  - polopad-pro
  - scoresheet
  - rosters
  - usawp
  - nfhs
  - rule-wp-22-3
  - box-score
status: production-verified
updated: 2026-11-09
---

# 📋 PoloPad Pro — Digital Scoresheet & Team Rosters Engine

> [!important] Paperless Varsity Desk Workflow
> Standard high school and collegiate water polo games require table workers to manually log pencil-and-paper scoresheets under intense game pressure. PoloPad Pro digitizes this entire process: attributing goals, exclusions, and goalie saves directly to Cap #1–20, enforcing Rule WP 22.3 (3-foul cap-out), and exporting official print-ready PDF/CSV scoresheets with 1 click.

## 1. Data Model & Architecture (`roster-manager.ts`)

Each team roster tracks standard Cap #1 through #20:
- **Goalkeeper Caps**: Cap #1 and Cap #13 are automatically assigned Goalkeeper status (`isGoalie: true`), tracking goalie saves alongside standard stats.
- **Goals by Quarter**: Goals scored in Q1, Q2, Q3, Q4, and Overtime.
- **Personal Fouls**:
  - Ordinary 20-second Exclusion (`E`)
  - 5-meter Penalty Foul (`P`)
  - Major Misconduct / Brutality (`MAM`)
  - Timestamped with game period and clock time (e.g., `E-Q2(04:12.6)`).

## 2. Rule WP 22.3 Enforcement (Three Personal Foul Cap-Out)

Under World Aquatics and USA Water Polo Rule WP 22.3, a player who commits three personal fouls must be excluded for the remainder of the game:
1. **Automatic Detection**: On the 3rd recorded personal foul, `isPlayerCappedOut()` evaluates to `true`.
2. **Visual & Auditory Warning**: The player's cap card turns red with a flashing `CAPPED OUT` badge, accompanied by a distinct buzzer chime.
3. **Desk Guardrail**: Further scoring or field play actions for that cap number are locked out, preventing accidental table errors.

## 3. Fast Cap Touch Logger (`digital-scoresheet-panel.tsx`)

Designed for fast single-touch operation poolside:
- **1-Tap Goal Attribution**: Select Team -> Tap Cap # -> Updates individual goal tally, increments team score, and creates timeline entry.
- **1-Tap Foul Logging**: Select Foul Type (`E`, `P`, `MAM`) -> Tap Cap # -> Records penalty and checks for cap-out.
- **Special Team Actions**: 1-minute Timeouts and Sprint winners per period.

## 4. Multi-Format Export Pipeline

- **Print / PDF Scoresheet**: Formatted for standard Letter/A4 Landscape (`@page { size: landscape; }`) matching USA Water Polo and NFHS paper forms with:
  - Event title, Game #, Date, Pool location.
  - Quarter-by-quarter scoring progression.
  - Side-by-side White and Dark rosters with goal & foul breakdowns.
  - Referee and table worker signature blocks.
- **CSV Box Score**: Clean comma-separated export for tournament directors, MaxPreps, and team websites.
- **Summary Clipboard Copy**: Instant plain-text box score for social media and parent group chats.

## 5. Verification Suite

- **Engine & Rules Tests**: `tests/test_digital_scoresheet.py` (5/5 tests passing).
- **Bundle DRC**: `tests/test_playwright_e2e.py` (`test_06_digital_scoresheet_bundle`).
- **CI Pipeline**: Automated in `.github/workflows/deploy.yml`.
