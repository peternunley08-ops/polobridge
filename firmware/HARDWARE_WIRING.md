# PoloBridge Hardware Wiring & Schematics

This document details how to wire the **PoloBridge ESP32-S3 Dongle** to interface directly with **Colorado Time Systems (CTS)** shot clocks and wireless scoreboard transmitters.

---

## 1. Bill of Materials (BOM)

| Component | Example Part | Approx Cost | Purpose |
| :--- | :--- | :--- | :--- |
| **MCU** | ESP32-S3 DevKitC (or ESP32 NodeMCU) | $5.00 | Bluetooth LE + Timing Engine |
| **RS-232 Transceiver** | MAX3232 Mini Board (3.3V-5V TTL to RS-232) | $2.50 | Converts ESP32 UART to true ±12V RS-232 |
| **Audio Jack** | 1/4" (6.35mm) Mono/Stereo Panel Mount Jack | $1.50 | Standard pool deck & CTS console connector |
| **Optocoupler (Optional)**| PC817 Photocoupler + 1kΩ resistor | $0.50 | Console companion mode (triggers pickle port) |
| **Power** | 18650 Li-Ion (or LiPo 3.7V) + TP4056 USB-C | $4.00 | All-day battery operation on pool deck |
| **LEDs / Switch** | 5mm Green/Blue LEDs + Power Toggle | $0.80 | Power & Bluetooth connection indicator |

---

## 2. Wiring Diagram

```
                 ESP32-S3 DEVKIT
              ┌─────────────────────┐
              │                     │
              │  3.3V ──────────────┼──────► VCC (MAX3232)
              │  GND  ──────────────┼──────► GND (MAX3232)
              │                     │
              │  GPIO 17 (TX1) ─────┼──────► TXD / T1IN (MAX3232)
              │  GPIO 16 (RX1) ─────┼──────► RXD / R1OUT (MAX3232, optional)
              │                     │
              │  GPIO 4 (Pickle) ───┼──────► Anode (PC817 Optocoupler via 1kΩ)
              │  GPIO 2 (LED) ──────┼──────► Status LED
              └─────────────────────┘
                         │
                         ▼
                 MAX3232 MODULE
              ┌─────────────────────┐
              │                     │
              │  TXOUT (RS-232 TX) ─┼──────► TIP of 1/4" Phone Jack (+ Signal)
              │  GND (RS-232 GND) ──┼──────► SLEEVE of 1/4" Phone Jack (Ground)
              └─────────────────────┘
```

---

## 3. The 1/4" (6.35mm) Phone Jack Pinout

Colorado Time Systems uses standard 1/4" mono audio jacks (TS - Tip/Sleeve) for its serial scoreboard runs and shot clock connections:

* **TIP (Tip of the plug)**: RS-232 Data (+ Signal from MAX3232 `TXOUT`)
* **SLEEVE (Base barrel)**: Signal Ground (from MAX3232 `GND`)
* *(If using a stereo TRS plug, leave the RING floating or tie to GND).*

---

## 4. How to Connect to the Pool Setup

### Setup 1: Direct to CTS WA-3 Wireless Adapter (Most Common High School Setup)
1. Most pools have a **CTS WA-3 2.4GHz Wireless Adapter** on the scorer's table.
2. The WA-3 has an **R-DC / Serial Port** (or 1/4" input).
3. Plug your PoloBridge 1/4" cable into the serial input of the WA-3.
4. Set the WA-3 Channel to match the shot clocks (usually Channel 01 or 02).
5. **Result**: Your iPad commands are instantly broadcasted by the WA-3 over 2.4 GHz to the SC-500/SC-600 shot clocks and the main scoreboard!

### Setup 2: Direct to Deck Plate / Shot Clock Cable
1. If the shot clocks are cabled across the pool deck using heavy black or yellow 1/4" cables running into a deck plate junction box:
2. Plug the PoloBridge 1/4" jack directly into the scoreboard feed jack on the deck plate.
3. The MAX3232 drives the serial signal directly down the cable to the shot clock displays.

### Setup 3: Console Companion Mode (Pickle Switch Tap)
If the school requires the official **System 6 Console** to remain powered on at the table:
1. Connect the PC817 optocoupler pins (Emitter/Collector) to a 1/4" mono jack.
2. Plug this jack into the **Pickle Switch / Reset Port** on the back of the System 6.
3. When you tap **Reset** on the iPad, the ESP32 pulses the optocoupler for 150ms, electrically simulating the referee's handheld button press on the official console!
