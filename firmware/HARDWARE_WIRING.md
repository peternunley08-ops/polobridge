# PoloBridge Hardware Wiring, Schematics & Ready-to-Order BOM

This engineering reference details how to order and assemble the **PoloBridge Wireless BLE-to-RS232 Hardware Dongle** to interface directly with **Colorado Time Systems (CTS)** `System 6` / `WA-3` / `SC-500` / `SC-600` and **Daktronics** `All Sport 5000` (Sport Code `4498`) scoreboards and shot clocks.

---

## 1. Ready-to-Order Bill of Materials (BOM)

We provide two verified hardware configurations:
- **Tier 1: Prototype / High School DIY Build ($24.40 total)** — Breadboard/proto-board assembly using pre-soldered breakout modules. Assembles in ~30 minutes.
- **Tier 2: Commercial Pro Pool-Deck Build ($49.85 total)** — Adds **2,500V RMS Galvanic Isolation** (`ADuM1201ARZ`), **±15kV IEC 61000-4-2 ESD TVS clamp** (`CDSOD323-T15SC`), an external **+5dBi RP-SMA antenna** (`ESP32-S3-WROOM-1U-N8R2`) to penetrate wet pool-deck Fresnel zones, and a rugged **Hammond `1554C2GYCL` IP67 waterproof polycarbonate enclosure**.

### Tier 1: DIY Prototype Dongle ($24.40 Total)

| Category | Component Name | Manufacturer & MPN | Supplier & Order SKU | Qty | Est. Cost |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **MCU & BLE 5.0** | ESP32-S3-DevKitC-1-N8R2 (Dual USB-C) | Espressif `ESP32-S3-DEVKITC-1-N8R2` | DigiKey: `1965-ESP32-S3-DEVKITC-1-N8R2-ND`<br>Mouser: `356-ESP32S3DEVKITC1N8` | 1 | $8.00 |
| **RS-232 Transceiver** | MAX3232CSE+ 3.3V-to-±12V RS-232 Breakout | Texas Instruments / SparkFun `BOB-11189` | DigiKey: `1568-1197-ND`<br>Amazon: `B07PFB4M65` | 1 | $2.50 |
| **Pickle Optocoupler** | PC817C Photocoupler + 1kΩ 1/4W Resistor | Sharp / Lite-On `LTV-817C` | DigiKey: `160-1366-5-ND`<br>Amazon: `B07P8P67LC` | 1 | $0.60 |
| **1/4" TS Jacks** | 6.35mm (1/4") Panel Mount Mono Phone Jack | Switchcraft `11` (or Neutrik `NMJ4HCD2`) | DigiKey: `SC1092-ND`<br>Mouser: `502-11` | 2 | $3.80 |
| **Power & Charger** | TP4056 USB-C Charger + 2000mAh 103450 LiPo | MakerFocus `TP4056-103450` | DigiKey: `1528-1844-ND`<br>Amazon: `B08214DJLJ` | 1 | $5.50 |
| **Enclosure & Switch** | ABS Project Box + Latching Pushbutton + LED | Hammond `1591XXBSBK` | DigiKey: `HM1151-ND`<br>Mouser: `546-1591XXBSBK` | 1 | $4.00 |
| **TOTAL (Tier 1)** | | | | **7** | **$24.40** |

---

### Tier 2: Pro 2.5kV Galvanically Isolated IP67 Build ($49.85 Total)

| Category | Component Name | Manufacturer & MPN | Supplier & Order SKU | Qty | Est. Cost |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **MCU + External RF** | ESP32-S3-DevKitC-1U-N8 (U.FL) + 2.4GHz +5dBi RP-SMA Antenna | Espressif `ESP32-S3-DEVKITC-1U-N8` + Taoglas `GW.11.A153` | DigiKey: `1965-ESP32-S3-DEVKITC-1U-N8-ND` + `931-1122-ND` | 1 | $14.50 |
| **2.5kV Isolator + RS-232** | 2.5kV Isolated RS-232 (`ADM3251EARWZ` or `ADuM1201ARZ` + `MAX3232EIDR` + `B0303S-1WR3`) | Analog Devices `ADM3251EARWZ` / TI `MAX3232EIDR` | DigiKey: `ADM3251EARWZ-ND` (`296-19851-1-ND`) | 1 | $9.80 |
| **±15kV TVS ESD Array** | Bidirectional 15V RS-232 Surge & Lightning Clamp | Bourns `CDSOD323-T15SC` | DigiKey: `CDSOD323-T15SCCT-ND`<br>Mouser: `652-CDSOD323-T15SC` | 2 | $1.10 |
| **Pickle Solid-State Relay**| PhotoMOS Optically Isolated Relay (60V, 500mA, 2.5Ω) | Toshiba `TLP175A(TPL,E` | DigiKey: `TLP175A(TPL,ECT-ND`<br>Mouser: `757-TLP175ATPLE` | 1 | $1.45 |
| **1/4" Locking Jacks** | Heavy-Duty 1/4" Chassis Jack + IP65 Silicone Boot | Neutrik `NRJ6HM-1` | DigiKey: `2092-NRJ6HM-1-ND`<br>Mouser: `550-NRJ6HM-1` | 2 | $4.20 |
| **Battery Management** | Adafruit USB-C LiIon/LiPoly Charger + 2500mAh 3.7V LiPo | Adafruit `4410` + `328` | DigiKey: `1528-4410-ND` + `1528-1838-ND` | 1 | $7.90 |
| **IP67 Enclosure** | Polycarbonate IP67 Waterproof Box w/ Smoked Clear Lid | Hammond `1554C2GYCL` | DigiKey: `HM3175-ND`<br>Mouser: `546-1554C2GYCL` | 1 | $10.90 |
| **TOTAL (Tier 2 Pro)** | | | | **9** | **$49.85** |

---

## 2. 2.5kV Galvanically Isolated Schematic (`Tier 2 Pro` & `Tier 1 DIY`)

Swimming pool scoreboards and deck plates frequently develop **ground-potential differences (20V–120V AC hum)** relative to scorer's table power outlets. Using a 2.5kV isolation barrier (`ADM3251E` or `ADuM1201` + `B0303S-1WR3`) prevents ground loops and protects the operator and iPad.

```
   [3.3V LOGIC DOMAIN — BATTERY / ESP32-S3]       ║  [ISOLATED FIELD DOMAIN — POOL DECK PLATE]
  ┌─────────────────────────────────────────┐     ║  ┌──────────────────────────────────────────┐
  │ ESP32-S3-WROOM-1U-N8R2                  │     ║  │                                          │
  │                                         │     ║  │  MAX3232EIDR (±12V True RS-232)          │
  │  3.3V ───────► B0303S-1WR3 (Iso DC-DC) ─┼─────╫──┼─► ISO_VCC (3.3V) + 4x 100nF Charge Pump  │
  │  GND  ───────► B0303S GND               │     ║  │                                          │
  │                                         │     ║  │                Bourns CDSOD323-T15SC     │
  │  GPIO 17 (TX1) ──► ADuM1201 (Ch A) ─────┼─────╫──┼─► T1IN ──► T1OUT ──┬──► TIP (1/4" TS)    │
  │  GPIO 16 (RX1) ◄── ADuM1201 (Ch B) ◄────┼─────╫──┼── R1OUT ◄── R1IN ◄─┼─── RING (Optional)  │
  │                                         │     ║  │                    ┴ (TVS to ISO_GND)    │
  │  GPIO 4 (Pickle) ─► 330Ω ─► TLP175A LED─┼─────╫──┼─► Drain/Source ────────► PICKLE 1/4" TIP │
  │  GPIO 2 (Status) ─► 220Ω ─► Cyan LED    │     ║  │  ISO_GND ──────────────► SLEEVE (GND)    │
  └─────────────────────────────────────────┘     ║  └──────────────────────────────────────────┘
                                                  ║
                                       2,500V RMS GALVANIC BARRIER
                                       (6.0mm Creepage / Clearance)
```

---

## 3. The 1/4" (6.35mm) Phone Jack Pinout

Colorado Time Systems uses standard 1/4" mono audio jacks (TS - Tip/Sleeve) for its serial scoreboard runs and shot clock connections:

* **PORT 1 — RS-232 DATA OUT (`CTS / DAKTRONICS`)**:
  * **TIP**: RS-232 Data (`+` Signal from `MAX3232E T1OUT`, swings `±12V`)
  * **SLEEVE**: Isolated Signal Ground (`ISO_GND`)
  * *(If using a stereo TRS jack like Neutrik `NRJ6HM-1`, leave the RING floating or wire to `R1IN` for diagnostic loopback).*
* **PORT 2 — PICKLE SWITCH COMPANION (`SYSTEM 6 PICKLE TAP`)**:
  * **TIP**: Optocoupler / PhotoMOS Collector (`TLP175A` Pin 4 / `PC817` Pin 4)
  * **SLEEVE**: Optocoupler / PhotoMOS Emitter (`TLP175A` Pin 3 / `PC817` Pin 3)

---

## 4. 5-Step Hardware Assembly Checklist

1. **Step 1 — Flash ESP32-S3 Firmware (`polobridge_firmware.ino`)**:
   - Connect the ESP32-S3 USB-C port to your computer.
   - Using PlatformIO (`pio run -t upload`) or Arduino IDE, compile and flash [`firmware/polobridge_firmware.ino`](./polobridge_firmware.ino).
   - Verify the onboard status LED blinks cyan at 1Hz (BLE advertising as `PoloBridge-S3`).
2. **Step 2 — Wire UART1 (`GPIO 17` / `GPIO 16`) to RS-232 Transceiver**:
   - Connect `ESP32 3.3V` → `VCC` and `ESP32 GND` → `GND` (via `B0303S-1WR3` + `ADuM1201` if building Tier 2 Pro).
   - Connect `GPIO 17 (TX1)` → `T1IN` and `GPIO 16 (RX1)` → `R1OUT`.
   - Verify four `0.1µF (100nF)` ceramic capacitors are populated across `C1+/C1-` and `C2+/C2-` on the `MAX3232` so the charge pump reaches at least `±9.5V`.
3. **Step 3 — Wire 1/4" TS Output Jack & TVS Protection**:
   - Solder `MAX3232 T1OUT` to the **TIP** lug of the primary 1/4" jack, and `GND` (`ISO_GND`) to the **SLEEVE** lug.
   - Solder a `Bourns CDSOD323-T15SC` bidirectional 15V TVS diode directly between **TIP** and **SLEEVE** on the jack terminals.
4. **Step 4 — Wire Pickle Switch Optocoupler (`GPIO 4`)**:
   - Connect `GPIO 4` through a `1kΩ` (or `330Ω`) resistor to the Anode (`Pin 1`) of the `PC817` / `TLP175A`, and `Pin 2` to `ESP32 GND`.
   - Wire `Pin 4` and `Pin 3` to the **TIP** and **SLEEVE** of the secondary 1/4" Pickle Companion jack.
5. **Step 5 — Connect LiPo Battery & Seal IP67 Enclosure**:
   - Mount the `TP4056` / `Adafruit 4410` USB-C charger and `2000mAh–2500mAh LiPo` cell inside the Hammond `1554C2GYCL` enclosure with 3M VHB foam tape.
   - Drill two `11.2mm (7/16")` panel holes for the 1/4" jacks, tighten the knurled nuts over silicone O-rings, and torque the 4 stainless steel lid screws.

---

## 5. Pool Deck Connection Modes

### Mode A: Direct to CTS WA-3 Wireless Adapter (Most Common High School & College Setup)
1. Locate the **CTS WA-3 2.4GHz Wireless Adapter** at the scorer's table.
2. Plug the PoloBridge **RS-232 Out** 1/4" cable into the serial input jack of the WA-3.
3. Confirm the WA-3 channel thumbwheel matches the shot clocks (`CH 01` – `CH 16`).
4. **Result**: Your iPad commands are broadcasted by the WA-3 at 10Hz to the SC-500/SC-600 shot clocks and the main matrix scoreboard.

### Mode B: Direct to Pool Deck Wall Plate / Shot Clock Harness
1. Plug the PoloBridge **RS-232 Out** 1/4" cable directly into the `R-DC / SCOREBOARD` jack on the pool deck brass junction plate.
2. The `MAX3232E` drives true `±12V` RS-232 directly down up to 250 ft of shielded pool-deck cable.

### Mode C: System 6 Console Companion (Pickle Switch Tap)
1. If tournament regulations require the physical **CTS System 6 Console** to stay active at the table, plug a 1/4" patch cable from the PoloBridge **Pickle Port** into the `PICKLE / SHOT RESET` jack on the back of the System 6.
2. Every time you press `30s RESET` or `20s RESET` on the iPad, the ESP32 triggers a 150ms isolated solid-state relay closure—electrically identical to pressing the referee's wired handheld button.
