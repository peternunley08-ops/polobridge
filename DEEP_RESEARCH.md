# Deep Technical Research & Engineering Dossier: Water Polo Timing Systems
**Author:** Antigravity Engineering & Aquatics Architecture Group  
**Project:** PoloBridge & PoloPad Pro  
**Target Systems:** Colorado Time Systems (System 6 / System 5 / Gen7 / WA-3 / SC-500), Daktronics (All Sport 5000 / OmniSport 2000), Swiss Timing / OMEGA (Quantum Aquatic)

---

## 1. RF Physics of the Aquatic Environment: Why 2.4 GHz Fails & Why Sub-GHz is Required

### 1.1 The Dielectric Attenuation of Chlorinated Water
A major reason commercial tablets cannot talk directly to wireless pool scoreboards is the **dielectric absorption spectrum of liquid water**:
* Liquid water ($H_2O$) has an electric dipole relaxation frequency centered directly in the **2.45 GHz S-band** (the exact physics exploited by domestic microwave ovens).
* In a competitive aquatic venue (chlorinated pool water with dissolved salt ions $Na^+, Cl^-$), electrical conductivity increases radio wave attenuation:
  $$\alpha = \omega \sqrt{\frac{\mu \epsilon}{2} \left[ \sqrt{1 + \left(\frac{\sigma}{\omega \epsilon}\right)^2} - 1 \right]}$$
* Across an Olympic 50-meter pool surrounded by concrete walls and elevated bleachers, 2.4 GHz RF suffers **18 dB to 28 dB higher path loss** than 900 MHz Sub-GHz signals. When 200 spectators fill the metal stands and 30 wet athletes are in the water, multipath reflections on 2.4 GHz create severe spatial nulls.

### 1.2 CTS WA-1 (900 MHz) vs. WA-3 (2.4 GHz DSSS)
* **Colorado Time Systems WA-1 (Legacy)**: Operated in the **902–928 MHz ISM band** using Frequency-Hopping Spread Spectrum (FHSS). It penetrated chlorinated humidity and concrete decks effortlessly.
* **CTS WA-3 (Modern)**: Operates on 2.4 GHz using direct-sequence channels (PAN IDs 0–15), but transmits at +18 dBm with directional high-gain antennas.
* **PoloBridge Architecture Solution**:
  1. **iPad to PoloBridge Link**: Placed on the scorer's table directly next to the operator (< 2 meters). Operates over BLE 5.0 (LE 2M PHY or Coded PHY) where attenuation is negligible.
  2. **PoloBridge to Displays**: Bypasses RF entirely by injecting clean RS-232 into the CTS WA-3 transmitter or pool deck wall plates, or employs an onboard **Semtech SX1262 Sub-GHz radio** for 915 MHz over-the-air broadcasting.

---

## 2. World Aquatics (FINA), USAWP & NCAA Rule Quirks

Table workers and referees frequently dispute timing because of obscure edge-case rules. PoloPad automates these rules to eliminate human error:

### 2.1 The Mandatory "Blanking" Rule (Rule WP 20.15)
* **The Rule**: When a new period of possession is awarded and the **Game Clock has less time remaining than the applicable shot clock** (i.e., $< 30$ seconds, or $< 20$ seconds after a rebound/ejection), the **shot clock display MUST BLANK (shut off completely)**.
* **Failure Mode on System 6**: Inexperienced table workers allow the shot clock to reset to 30 with 14 seconds left in the 4th quarter. Players hear the 30-second horn buzz during live play, causing false whistles.
* **PoloPad Automation**: If `gameTimeMs <= shotTimeMs`, PoloPad automatically sends ASCII space bytes (`"        "`) to the physical shot clock and disables the shot clock horn.

### 2.2 The 3 Conditions for Ending a 20-Second Exclusion (Rule WP 21)
An exclusion does **not** always last 20 seconds. Under official rules, an excluded player may re-enter upon the **earliest** of three events:
1. **Expiration of 20 seconds** of actual play (timer counts down to zero, table waves green flag).
2. **A goal is scored** (all exclusions terminate immediately).
3. **The defending team regains possession of the ball** (if the excluded player's team steals the ball or intercepts a pass during the 20 seconds, the exclusion terminates *instantly*, and the table worker must immediately wave the player into the pool).

*PoloPad Feature*: Every active exclusion badge features an **"Early Release (Turnover/Goal)"** button that terminates the penalty instantly and logs the event.

### 2.3 The Whistle vs. Ball-in-Play Distinction
* When a referee blows an ordinary foul whistle, the shot clock STOPS.
* The shot clock does **not** resume when the whistle blows—it only resumes when the ball is visibly **put in play** (swum with, passed, or thrown).
* PoloPad features a single-tap **Pause on Whistle** with an illuminated **"Ball in Play"** trigger.

---

## 3. Electrical & Deck Environmental Realities

### 3.1 Trichloramine ($NCl_3$) Gas Corrosion
* Indoor swimming pools accumulate trichloramines (formed when chlorine reacts with nitrogen compounds in sweat/urine). Trichloramine gas is heavier than air and settles within 12 inches of the water surface and deck tables.
* It rapidly tarnishes copper, corrodes solder joints, and oxidizes nickel-plated audio jacks within 6 months.
* **PoloBridge Hardware Mitigation**:
  * Immersion Gold (ENIG) PCB surface finish.
  * **Conformal Coating**: MG Chemicals 419D Acrylic or 422B Silicone conformal coating over all SMD components.
  * Connectors: Gold-plated Neutrik 1/4" heavy-duty jacks with sealed EPDM internal gaskets.

### 3.2 Ground Loops & Variable Frequency Drive (VFD) Inverter Noise
* Aquatic centers run massive 10HP to 50HP pool filtration pumps modulated by Variable Frequency Drives (VFDs).
* The electrical potential between the pool deck drain rebar, building AC neutral, and timing console ground can oscillate with up to **15V peak-to-peak AC ripple**.
* Plugging an unisolated serial microcontroller directly into a pool wall jack can corrupt the UART data or damage the chip.
* **PoloBridge Hardware Mitigation**:
  * **Galvanic Isolation**: ADI **ADuM1201** or **ADM3251E** isolated RS-232 transceiver providing **2.5 kV RMS isolation** between the ESP32 logic and the pool deck wiring.

---

## 4. Multi-Protocol Engine: Colorado Time Systems vs. Daktronics

While Colorado Time Systems commands 85% of high school pools, Daktronics accounts for 15% (especially in multi-sport venues):

| Specification | Colorado Time Systems (CTS) | Daktronics (All Sport 5000) |
| :--- | :--- | :--- |
| **Baud Rate** | 9600 Baud (Fast) / 2400 Baud (Slow) | 19,200 Baud / 4800 Baud |
| **Framing** | 8 Data Bits, **EVEN Parity**, 1 Stop Bit (8-E-1) | 8 Data Bits, **NO Parity**, 1 Stop Bit (8-N-1) |
| **Physical Layer** | RS-232 ($\pm 12\text{V}$) on 1/4" TS Phono Jack | 20mA Current Loop or RS-422/RS-232 |
| **Addressing** | Bit-packed Channel header byte (`> 0x7F`) | Real-Time Data (RTD) Packet Framing (`0x16 0x01` + Sport Code) |
| **Water Polo Code** | Sport Loader: Water Polo Module | Sport Code: **`4498`** (Insert `0G-178439`) |
| **Shot Clock Channel** | Channel `0x05` (SC-500/600, WA-3) | Item `2101` / `2102` (BB-2123, TI-2000) |

PoloBridge supports dual-engine firmware: a physical micro-switch or BLE command toggles between **CTS Mode (9600-8-E-1)** and **Daktronics Mode (19200-8-N-1)**.

---

## 5. Built-in Broadcast Overlay Engine (OBS / NDI Scorebug)

High schools and aquatic clubs are required by CIF/NFHS to live-stream matches over YouTube, Hudl, or the NFHS Network.
* Traditional hardware character generators (like the Daktronics CG or CTS All Sport CG) cost **$2,500 – $4,000**.
* **PoloPad Innovation**: The iPad app includes a lightweight local HTTP/WebSocket broadcast server (`http://ipad-ip:8080/overlay`).
* Any laptop on the pool deck running OBS Studio, vMix, or a browser can add this URL as an **HTML5 Browser Source** to render a real-time television broadcast scorebug with zero additional hardware.
