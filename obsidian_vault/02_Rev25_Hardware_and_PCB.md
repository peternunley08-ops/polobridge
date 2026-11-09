---
title: "02 — Rev 2.5 Dual-Mode Hardware, 2.5kV Isolation & 3D CAD"
tags: [polobridge, hardware, jlcpcb, stl, isolation]
status: drc-verified
updated: 2026-11-08
---

# Rev 2.5 Hardware, 2.5kV Isolation & 3D CAD

Back to [[00_PoloBridge_MOC]] | Firmware: [[03_Firmware_and_Protocols]]

## 1. 2.5kV Galvanic Isolation Barrier (`X = 48.00mm`)
- Milled anti-tracking slot from `45.0mm <= X <= 51.0mm` on the `85.0mm x 55.0mm` 4-layer ENIG PCB.
- Only `U2` (`ADuM1201BRZ`), `U4` (`B0303S-1WR3`), and `U7/U8/U9` (`EL817S` 3-Ch Pickle Optocouplers) cross the barrier.

## 2. Triple-Redundant Horn & Lid Fail-Safe
- `Q1` (`AO3400A` on `GPIO 7`) drives a 105dB marine piezo horn (`J6`).
- `SW3/SW4/SW5` (`GPIO 18/19/20`) provide 3 physical waterproof buttons (`Start/Stop`, `30s`, `20s`) on the Hammond `1554C2GYCL` lid.
