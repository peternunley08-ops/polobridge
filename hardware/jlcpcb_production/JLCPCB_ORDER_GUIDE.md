# PoloBridge Rev 2.4 — Turnkey JLCPCB SMT Factory Ordering Guide

This directory contains everything needed to have **JLCPCB** fabricate and factory-assemble the **PoloBridge Rev 2.4 (`85mm × 55mm` 4-Layer 2.5kV Isolated PCB)** using automated surface-mount (SMT) pick-and-place robots.

---

## 1. Files Included in `hardware/jlcpcb_production/`

| File Name | Purpose | Upload Step on JLCPCB |
| :--- | :--- | :--- |
| **`PoloBridge_Rev2_4_JLCPCB_Gerbers.zip`** | 4-Layer RS-274X Gerber + Excellon Drill archive (`F_Cu`, `In1_Cu`, `In2_Cu`, `B_Cu`, `F_Mask`, `B_Mask`, `F_SilkS`, `B_SilkS`, `Edge_Cuts`, `.drl`) | Step 1: **Add Gerber File** |
| **`JLCPCB_BOM.csv`** | Bill of Materials with verified LCSC Part Numbers (`C2980297`, `C87626`, `C18261`, `C5358212`, `C16581`, etc.) | Step 2: **Add BOM File** |
| **`JLCPCB_CPL.csv`** | Pick-and-Place Centroid (`Mid X`, `Mid Y`, `Layer`, `Rotation`) for all 36 SMD components | Step 2: **Add CPL (Positions) File** |
| **`polobridge_rev2_4.kicad_sch`** | KiCad 7/8 S-Expression Schematic source file | Local CAD / Customization |
| **`generate_gerbers.py`** | Deterministic Python Gerber & Drill generator (rebuilds the `.zip` if board dimensions are modified) | Build Script |

---

## 2. How to Order 5 Assembled Boards on JLCPCB (~$65 Total, ~$13/board)

### Step A: PCB Fabrication Settings (`https://cart.jlcpcb.com/quote`)
1. Click **Add Gerber File** and upload `PoloBridge_Rev2_4_JLCPCB_Gerbers.zip`.
2. Verify the auto-detected settings:
   - **Base Material**: `FR-4`
   - **Layers**: `4 Layers`
   - **Dimensions**: `85.0 mm × 55.0 mm`
   - **PCB Qty**: `5` (or `10` for multi-pool school districts)
   - **PCB Thickness**: `1.6 mm`
   - **PCB Color**: `Blue` (or `Matte Black` / `Green`)
   - **Surface Finish**: `ENIG` (Recommended for marine/pool-deck corrosion resistance) or `LeadFree HASL`
   - **Layer Stackup**: `JLC04161H-7628` (Standard 4-layer stackup)

### Step B: Enable SMT PCB Assembly (PCBA)
1. Scroll down and toggle **PCB Assembly** to **ON**.
2. Set **Assembly Side**: `Top Side Only` (all 36 SMD parts are placed on the Top layer to minimize stencil & reflow cost).
3. Set **PCBA Qty**: `5`.
4. Click **Confirm** to advance to the Parts Placement screen.
5. Upload **`JLCPCB_BOM.csv`** as the BOM file and **`JLCPCB_CPL.csv`** as the CPL file.
6. Review the 3D Component Placement Preview:
   - Confirm `U1` (`ESP32-S3-WROOM-1U-N8`, `C2980297`) has its U.FL antenna connector facing the top-left edge.
   - Confirm `U2` (`ADUM1201BRZ-RL7`, `C87626`), `U4` (`B0303S-1WR3`, `C5358212`), and `U7` (`EL817S`, `C5353`) straddle the `X = 48.0mm` isolation trench.
   - Confirm `J5` (`TYPE-C-31-M-12`, `C165948`) overhangs the left board edge (`X = 6.5mm`).

---

## 3. Final 3-Minute Final Assembly (When Boards Arrive)

Because JLCPCB pre-solders all 36 surface-mount chips, resistors, capacitors, TVS diodes, isolators, and the USB-C port, your only remaining assembly steps are:

1. **Solder the Two 1/4" Phone Jacks (`J1` & `J2`)**:
   - Insert two **Neutrik `NRJ6HM-1`** (or Switchcraft `11`) 1/4" jacks into the plated through-holes on the right edge (`X = 79.5mm`) and solder the 6 through-hole lugs.
2. **Snap on the U.FL-to-RP-SMA Pigtail & +5dBi Antenna (`J3`)**:
   - Press the U.FL coax connector onto `U1` (`ESP32-S3-WROOM-1U`) and mount the RP-SMA bulkhead into the **Hammond `1554C2GYCL` IP67** enclosure wall.
3. **Plug in the 3.7V LiPo Battery (`J4`)**:
   - Plug a standard 2000mAh–2500mAh 3.7V LiPo battery into the pre-soldered 2-pin JST-PH connector (`J4`).
4. **Flash Firmware over USB-C (`J5`)**:
   - Connect a USB-C cable to `J5` and run `pio run -t upload` in [`firmware/`](../../firmware) to flash `polobridge_firmware.ino`.
