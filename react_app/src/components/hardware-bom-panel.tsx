import React, { useState } from 'react';
import {
  Cpu, ShoppingCart, Download, CheckCircle2, ExternalLink,
  Shield, Zap, Radio, Wrench, Copy, Check, Layers, AlertTriangle, Package
} from 'lucide-react';

export interface BomPart {
  id: string;
  category: string;
  name: string;
  manufacturer: string;
  mpn: string;
  supplier: 'DigiKey' | 'Mouser' | 'Amazon';
  sku: string;
  orderUrl: string;
  qty: number;
  unitPrice: number;
  notes: string;
  requiredFor: 'both' | 'tier1' | 'tier2';
}

export const DONGLE_BOM_PARTS: BomPart[] = [
  // TIER 1 & SHARED CORE PARTS
  {
    id: 'mcu-s3-devkit',
    category: 'Microcontroller (BLE 5.0)',
    name: 'ESP32-S3-DevKitC-1-N8R2 (Dual USB-C, 8MB Flash, 2MB PSRAM)',
    manufacturer: 'Espressif Systems',
    mpn: 'ESP32-S3-DEVKITC-1-N8R2',
    supplier: 'DigiKey',
    sku: '1965-ESP32-S3-DEVKITC-1-N8R2-ND',
    orderUrl: 'https://www.digikey.com/en/products/result?keywords=ESP32-S3-DEVKITC-1-N8R2',
    qty: 1,
    unitPrice: 7.50,
    notes: 'Core 240MHz dual-core MCU running BLE 5.0 GATT server & 10Hz UART frame generator',
    requiredFor: 'tier1',
  },
  {
    id: 'rs232-max3232-breakout',
    category: 'RS-232 Transceiver',
    name: 'MAX3232CSE 3.3V-to-±12V RS-232 Breakout Module (with 0.1µF Charge Caps)',
    manufacturer: 'Texas Instruments / SparkFun',
    mpn: 'BOB-11189 / MAX3232IDR',
    supplier: 'DigiKey',
    sku: '1568-1197-ND',
    orderUrl: 'https://www.digikey.com/en/products/result?keywords=1568-1197-ND',
    qty: 1,
    unitPrice: 3.20,
    notes: 'Steps up 3.3V ESP32 UART1 (GPIO 17 TX) to true ±12V RS-232 for CTS WA-3 & System 6',
    requiredFor: 'tier1',
  },
  {
    id: 'jack-neutrik-standard',
    category: '1/4" Scoreboard Jack',
    name: 'Neutrik 1/4" (6.35mm) Heavy-Duty Panel Mount Mono TS Phone Jack',
    manufacturer: 'Neutrik',
    mpn: 'NRJ4HF',
    supplier: 'DigiKey',
    sku: 'NRJ4HF-ND',
    orderUrl: 'https://www.digikey.com/en/products/result?keywords=NRJ4HF',
    qty: 1,
    unitPrice: 1.85,
    notes: 'Tip = RS-232 TX Data (+), Sleeve = Isolated Signal Ground',
    requiredFor: 'tier1',
  },
  {
    id: 'cable-14-ts',
    category: 'Deck Interconnect Cable',
    name: 'Hosa Pro 1/4" TS Mono Male-to-Male Shielded Serial Patch Cable (3 ft)',
    manufacturer: 'Hosa Technology',
    mpn: 'CPP-103',
    supplier: 'Amazon',
    sku: 'B000068O16',
    orderUrl: 'https://www.amazon.com/s?k=Hosa+CPP-103',
    qty: 1,
    unitPrice: 5.95,
    notes: 'Connects PoloBridge dongle directly to CTS WA-3 wireless transmitter or deck wall plate',
    requiredFor: 'both',
  },
  {
    id: 'opto-pc817',
    category: 'Pickle Switch Companion Tap',
    name: 'Sharp PC817X4NSZ0F Photocoupler (5kV Isolation) + 1kΩ 1/4W Resistor',
    manufacturer: 'Sharp Microelectronics',
    mpn: 'PC817X4NSZ0F',
    supplier: 'DigiKey',
    sku: '425-2831-5-ND',
    orderUrl: 'https://www.digikey.com/en/products/result?keywords=PC817X4NSZ0F',
    qty: 1,
    unitPrice: 0.65,
    notes: 'Optional Console Companion Mode: simulates 150ms physical pickle button press on System 6',
    requiredFor: 'both',
  },
  {
    id: 'enclosure-abs-tier1',
    category: 'Enclosure',
    name: 'Hammond 1591XXBSBU Flame-Retardant ABS Instrument Enclosure (Blue)',
    manufacturer: 'Hammond Manufacturing',
    mpn: '1591XXBSBU',
    supplier: 'DigiKey',
    sku: 'HM1128-ND',
    orderUrl: 'https://www.digikey.com/en/products/result?keywords=1591XXBSBU',
    qty: 1,
    unitPrice: 5.25,
    notes: '112 × 62 × 31 mm handheld splash-resistant enclosure with brass machine screw inserts',
    requiredFor: 'tier1',
  },

  // TIER 2 INDUSTRIAL ISOLATED PRO PARTS
  {
    id: 'mcu-s3-u-antenna',
    category: 'Microcontroller + Ext Antenna',
    name: 'ESP32-S3-DevKitC-1U-N8R8 (U.FL IPEX Connector) + +5dBi 2.4GHz Stub Antenna',
    manufacturer: 'Espressif Systems',
    mpn: 'ESP32-S3-DEVKITC-1U-N8R8',
    supplier: 'DigiKey',
    sku: '1965-ESP32-S3-DEVKITC-1U-N8R8-ND',
    orderUrl: 'https://www.digikey.com/en/products/result?keywords=ESP32-S3-DEVKITC-1U-N8R8',
    qty: 1,
    unitPrice: 9.20,
    notes: 'External SMA/IPEX antenna bypasses CNC aluminum enclosure Faraday shielding',
    requiredFor: 'tier2',
  },
  {
    id: 'iso-adm3251e',
    category: '2.5kV Isolated RS-232',
    name: 'Analog Devices ADM3251EARWZ 2.5kV Isolated RS-232 Transceiver (w/ isoPower DC-DC)',
    manufacturer: 'Analog Devices',
    mpn: 'ADM3251EARWZ',
    supplier: 'DigiKey',
    sku: 'ADM3251EARWZ-ND',
    orderUrl: 'https://www.digikey.com/en/products/result?keywords=ADM3251EARWZ',
    qty: 1,
    unitPrice: 11.40,
    notes: 'Eliminates 15V AC pool pump VFD ground loops; single-chip 2.5kV RMS galvanic isolation',
    requiredFor: 'tier2',
  },
  {
    id: 'iso-adum1201',
    category: 'Digital Isolator (Backup/Dual)',
    name: 'Analog Devices ADuM1201ARZ Dual-Channel 2.5kV Digital Isolator (SOIC-8)',
    manufacturer: 'Analog Devices',
    mpn: 'ADuM1201ARZ-RL7',
    supplier: 'DigiKey',
    sku: 'ADUM1201ARZ-RL7CT-ND',
    orderUrl: 'https://www.digikey.com/en/products/result?keywords=ADuM1201ARZ',
    qty: 1,
    unitPrice: 3.45,
    notes: 'Isolates UART TX/RX lines when paired with a discrete MAX3232E transceiver',
    requiredFor: 'tier2',
  },
  {
    id: 'tvs-esd-diode',
    category: 'Surge & ESD Protection',
    name: 'Bourns CDSOD323-T15SC Bidirectional TVS Diode (±15kV IEC 61000-4-2 ESD)',
    manufacturer: 'Bourns',
    mpn: 'CDSOD323-T15SC',
    supplier: 'DigiKey',
    sku: 'CDSOD323-T15SCCT-ND',
    orderUrl: 'https://www.digikey.com/en/products/result?keywords=CDSOD323-T15SC',
    qty: 2,
    unitPrice: 0.45,
    notes: 'Clamps static discharge and lightning induced surges on long pool deck cables',
    requiredFor: 'tier2',
  },
  {
    id: 'jack-neutrik-gold',
    category: 'Gold Sealed 1/4" Jacks',
    name: 'Neutrik NRJ6HM-1 Gold-Plated 1/4" Panel Jack with EPDM Waterproof Gasket',
    manufacturer: 'Neutrik',
    mpn: 'NRJ6HM-1',
    supplier: 'DigiKey',
    sku: 'NRJ6HM-1-ND',
    orderUrl: 'https://www.digikey.com/en/products/result?keywords=NRJ6HM-1',
    qty: 2,
    unitPrice: 2.65,
    notes: 'Gold plating resists trichloramine gas corrosion; 1x RS-232 Main Out + 1x Pickle Companion Out',
    requiredFor: 'tier2',
  },
  {
    id: 'subghz-sx1262',
    category: '915MHz Sub-GHz Radio',
    name: 'Waveshare Core1262-HF Semtech SX1262 915MHz Transceiver + Helical Antenna',
    manufacturer: 'Semtech / Waveshare',
    mpn: 'Core1262-868M / SX1262',
    supplier: 'Amazon',
    sku: 'B089SY2364',
    orderUrl: 'https://www.amazon.com/s?k=SX1262+915MHz+Module',
    qty: 1,
    unitPrice: 6.90,
    notes: 'Penetrates chlorinated pool humidity with 22dB less path loss than 2.4GHz Wi-Fi',
    requiredFor: 'tier2',
  },
  {
    id: 'enclosure-cnc-alu',
    category: 'Anodized Aluminum Chassis',
    name: 'Hammond 1455C801BU Extruded Anodized Aluminum Enclosure (80 × 54 × 23 mm, Blue)',
    manufacturer: 'Hammond Manufacturing',
    mpn: '1455C801BU',
    supplier: 'DigiKey',
    sku: 'HM922-ND',
    orderUrl: 'https://www.digikey.com/en/products/result?keywords=1455C801BU',
    qty: 1,
    unitPrice: 8.90,
    notes: 'Marine-grade anodized aluminum shell with slide-in PCB card slots and end panels',
    requiredFor: 'tier2',
  },
  {
    id: 'conformal-coating',
    category: 'Chlorine Gas Protection',
    name: 'MG Chemicals 419D Premium Acrylic Conformal Coating Pen (IPC-CC-830B)',
    manufacturer: 'MG Chemicals',
    mpn: '419D-P',
    supplier: 'DigiKey',
    sku: '473-1356-ND',
    orderUrl: 'https://www.digikey.com/en/products/result?keywords=473-1356-ND',
    qty: 1,
    unitPrice: 3.80,
    notes: 'Protects solder joints against heavy indoor pool trichloramine (NCl3) vapor corrosion',
    requiredFor: 'tier2',
  },
];

const ASSEMBLY_STEPS = [
  {
    step: 1,
    title: 'Flash PoloBridge Dual-Engine Firmware',
    detail: 'Connect ESP32-S3 via USB-C and run `pio run -t upload` inside `firmware/` (or flash `polobridge_firmware.ino` in Arduino IDE). Verify "PoloBridge-Pro" BLE advertisement appears on your iPad.',
  },
  {
    step: 2,
    title: 'Wire UART1 (GPIO 17 TX / GPIO 16 RX) to Isolated RS-232 Stage',
    detail: 'Connect ESP32-S3 3.3V, GND, and GPIO 17 (TX1) to the MAX3232CSE breakout (Tier 1) or ADM3251E 2.5kV isolated transceiver (Tier 2).',
  },
  {
    step: 3,
    title: 'Solder Neutrik 1/4" Mono Phone Jack (Tip = TX, Sleeve = GND)',
    detail: 'Solder RS-232 TXOUT (±12V swing) to the TIP terminal of the Neutrik 1/4" jack, and isolated RS-232 GND to the SLEEVE lug. Install the Bourns 15V TVS diode across Tip and Sleeve.',
  },
  {
    step: 4,
    title: 'Wire Optional PC817 Pickle Switch Companion Port (GPIO 4)',
    detail: 'Connect GPIO 4 through a 1kΩ resistor to PC817 Pin 1 (Anode), Pin 2 (Cathode) to ESP32 GND, and Pins 3/4 (Emitter/Collector) to the secondary 1/4" Pickle Jack.',
  },
  {
    step: 5,
    title: 'Apply Conformal Coating & Seal Enclosure',
    detail: 'Coat all exposed PCB pads with MG Chemicals 419D conformal coating (leave USB-C and 1/4" jack contacts masked), slide into the Hammond anodized blue chassis, and test on CTS Channel 0x05.',
  },
];

export default function HardwareBomPanel() {
  const [selectedTier, setSelectedTier] = useState<'tier1' | 'tier2'>('tier2');
  const [checkedSteps, setCheckedSteps] = useState<number[]>([1, 2]);
  const [copiedBom, setCopiedBom] = useState(false);

  const activeParts = DONGLE_BOM_PARTS.filter(
    (p) => p.requiredFor === 'both' || p.requiredFor === selectedTier
  );

  const totalCost = activeParts.reduce((sum, p) => sum + p.qty * p.unitPrice, 0);

  const handleExportCsv = () => {
    const headers = ['Quantity', 'Manufacturer Part Number', 'DigiKey/Supplier SKU', 'Manufacturer', 'Description', 'Unit Price USD', 'Line Total USD'];
    const rows = activeParts.map((p) => [
      p.qty,
      `"${p.mpn}"`,
      `"${p.sku}"`,
      `"${p.manufacturer}"`,
      `"${p.name}"`,
      p.unitPrice.toFixed(2),
      (p.qty * p.unitPrice).toFixed(2),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polobridge_dongle_bom_${selectedTier}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyQuickOrder = () => {
    const lines = activeParts.map((p) => `${p.qty}, ${p.mpn}, ${p.sku}`).join('\n');
    navigator.clipboard?.writeText(lines);
    setCopiedBom(true);
    setTimeout(() => setCopiedBom(false), 3000);
  };

  const handleExportJlcpcbBom = () => {
    const jlcpcbBom = [
      'Comment,Designator,Footprint,LCSC Part #',
      'ESP32-S3-WROOM-1U-N8 (BLE 5.0 + U.FL External Antenna),U1,ESP32-S3-WROOM-1U,C2980297',
      'ADUM1201BRZ-RL7 (2.5kV Dual-Channel Digital Isolator),U2,SOIC-8_150mil,C87626',
      'MAX3232ESE+T (3V-5.5V True RS-232 Transceiver +-12V),U3,SOIC-16_150mil,C18261',
      'B0303S-1WR3 (Isolated 3.3V-to-3.3V 1W DC-DC Converter),U4,SIP-4_11.6x6.0mm,C5358212',
      'TP4056-42-ESOP8 (1A USB-C LiPo Battery Charger IC),U5,ESOP-8_150mil,C16581',
      'AMS1117-3.3 (3.3V 1A LDO Voltage Regulator),U6,SOT-223,C6186',
      'EL817S(C)(TU)-F (Optocoupler for System 6 Pickle Port),U7,SMD-4_P2.54mm,C5353',
      'HRO TYPE-C-31-M-12 (16-Pin USB-C Receptacle),J5,USB-C-SMD_TYPE-C-31-M-12,C165948',
      'SMBJ15CA (Bidirectional 15V TVS ESD Surge Clamp),"D1,D2",DO-214AA_SMB,C19242',
      'SS34 (3A 40V Schottky Power Or-ing Diode),D3,DO-214AB_SMC,C8678',
      '100nF 50V X7R 10% (Charge Pump & Decoupling Caps),"C1,C2,C3,C4,C5,C6,C7,C8",0603,C14663',
      '10uF 25V X5R 10% (Bulk Power Rail Capacitors),"C9,C10,C11,C12",0805,C15850',
      '5.1kOhm 1% (USB-C CC1/CC2 Pull-Down Resistors),"R1,R2",0603,C23186',
      '1kOhm 1% (Optocoupler & Charge Prog Resistors),"R3,R4",0603,C21190',
      '10kOhm 1% (ESP32 EN & GPIO0 Pull-Up Resistors),"R5,R6",0603,C25804',
      '330Ohm 1% (Status LED Current Limiting Resistors),"R7,R8",0603,C23138',
      'Green/Emerald SMD Status LED (BLE / Power),"LED1,LED2",0603,C72043',
      'TS-1187A-B-A-B (SMD Tactile Pushbutton RESET/BOOT),"SW1,SW2",SW-SMD_5.1x5.1mm,C318884',
      'JST-PH 2-Pin SMD Battery Header (2.0mm Pitch),J4,JST-PH-2A-SMD,C131337',
    ].join('\n');
    const blob = new Blob([jlcpcbBom], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'JLCPCB_BOM.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJlcpcbCpl = () => {
    const jlcpcbCpl = [
      'Designator,Mid X,Mid Y,Layer,Rotation',
      'U1,22.00mm,34.00mm,Top,0.0',
      'U2,48.00mm,36.00mm,Top,90.0',
      'U3,64.00mm,36.00mm,Top,0.0',
      'U4,48.00mm,18.00mm,Top,0.0',
      'U5,18.00mm,14.00mm,Top,0.0',
      'U6,32.00mm,14.00mm,Top,0.0',
      'U7,48.00mm,27.00mm,Top,0.0',
      'J5,6.50mm,27.50mm,Top,270.0',
      'J4,14.00mm,6.00mm,Top,180.0',
      'D1,74.50mm,41.00mm,Top,90.0',
      'D2,74.50mm,16.00mm,Top,90.0',
      'D3,13.50mm,21.00mm,Top,0.0',
      'C1,60.00mm,44.00mm,Top,0.0',
      'C2,63.00mm,44.00mm,Top,0.0',
      'C3,66.00mm,44.00mm,Top,0.0',
      'C4,69.00mm,44.00mm,Top,0.0',
      'C5,22.00mm,21.50mm,Top,0.0',
      'C6,43.00mm,36.00mm,Top,90.0',
      'C7,53.00mm,36.00mm,Top,90.0',
      'C8,64.00mm,28.00mm,Top,0.0',
      'C9,18.00mm,20.00mm,Top,0.0',
      'C10,32.00mm,20.00mm,Top,0.0',
      'C11,43.00mm,18.00mm,Top,0.0',
      'C12,53.00mm,18.00mm,Top,0.0',
      'R1,11.50mm,25.00mm,Top,0.0',
      'R2,11.50mm,30.00mm,Top,0.0',
      'R3,42.00mm,27.00mm,Top,90.0',
      'R4,18.00mm,9.50mm,Top,0.0',
      'R5,34.00mm,32.00mm,Top,0.0',
      'R6,34.00mm,35.00mm,Top,0.0',
      'R7,26.00mm,48.00mm,Top,0.0',
      'R8,32.00mm,48.00mm,Top,0.0',
      'LED1,26.00mm,51.00mm,Top,0.0',
      'LED2,32.00mm,51.00mm,Top,0.0',
      'SW1,10.00mm,44.00mm,Top,0.0',
      'SW2,10.00mm,49.50mm,Top,0.0',
    ].join('\n');
    const blob = new Blob([jlcpcbCpl], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'JLCPCB_CPL.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleStep = (step: number) => {
    setCheckedSteps((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    );
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/30 via-sky-900 to-indigo-950 space-y-6">
      
      {/* Top Hero Banner & Tier Selector */}
      <div className="max-w-6xl mx-auto rounded-3xl bg-gradient-to-r from-sky-800/90 via-blue-900/95 to-indigo-950/95 border-2 border-cyan-400/50 p-6 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-400/30 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-400 via-teal-400 to-emerald-400 flex items-center justify-center text-sky-950 shadow-lg shadow-cyan-400/30 border border-white/50">
              <Cpu size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-black tracking-tight text-white">
                  PoloBridge Hardware Dongle — Ready-to-Order Bill of Materials (BOM)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/50">
                  IN STOCK AT DIGIKEY &amp; JLCPCB / LCSC
                </span>
              </div>
              <p className="text-xs text-cyan-200/90 mt-1">
                Complete parts list with exact Manufacturer Part Numbers (MPNs), DigiKey/Amazon SKUs, JLCPCB Turnkey SMT `BOM.csv` + `CPL.csv`, and 2.5kV isolated wiring guide.
              </p>
            </div>
          </div>

          {/* Export & Quick-Order Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyQuickOrder}
              className="px-3 py-2 rounded-xl bg-sky-900/80 hover:bg-sky-800 border border-cyan-400/40 text-cyan-100 text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Copy Qty, MPN, SKU lines for DigiKey Quick-Order Paste"
            >
              {copiedBom ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
              <span>{copiedBom ? 'Copied!' : 'Copy DigiKey List'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:brightness-110 text-sky-950 text-xs font-mono font-black flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition cursor-pointer"
            >
              <Download size={14} />
              <span>DigiKey CSV</span>
            </button>

            <button
              onClick={handleExportJlcpcbBom}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-sky-950 text-xs font-mono font-black flex items-center gap-1.5 shadow-lg shadow-cyan-500/25 transition cursor-pointer"
              title="Download JLCPCB SMT Factory Assembly BOM with LCSC C# Part Numbers"
            >
              <Download size={14} />
              <span>JLCPCB BOM.csv</span>
            </button>

            <button
              onClick={handleExportJlcpcbCpl}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 hover:brightness-110 text-sky-950 text-xs font-mono font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/25 transition cursor-pointer"
              title="Download JLCPCB SMT Pick-and-Place Centroid Positions (CPL.csv)"
            >
              <Download size={14} />
              <span>JLCPCB CPL.csv</span>
            </button>
          </div>
        </div>

        {/* Two Hardware Build Tiers Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setSelectedTier('tier1')}
            className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer flex items-center justify-between ${
              selectedTier === 'tier1'
                ? 'bg-gradient-to-r from-emerald-500/25 to-teal-600/30 border-emerald-300 shadow-lg shadow-emerald-500/20'
                : 'bg-sky-950/60 hover:bg-sky-900/70 border-cyan-400/25'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-black uppercase px-2 py-0.5 rounded bg-emerald-400/25 text-emerald-200 border border-emerald-300/40">
                  Tier 1 Build
                </span>
                <span className="text-sm font-black text-white">Quick-Build Breadboard / DevKit Edition</span>
              </div>
              <p className="text-xs text-cyan-100/80 mt-1">
                6 off-the-shelf modules &bull; No SMD soldering required &bull; Assembles in 20 minutes for CTS WA-3 table transmitters.
              </p>
            </div>
            <div className="text-right pl-4">
              <div className="text-2xl font-black font-mono text-emerald-300">$24.40</div>
              <div className="text-[10px] font-mono text-sky-200">Total BOM</div>
            </div>
          </button>

          <button
            onClick={() => setSelectedTier('tier2')}
            className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer flex items-center justify-between ${
              selectedTier === 'tier2'
                ? 'bg-gradient-to-r from-cyan-500/30 to-blue-600/35 border-cyan-300 shadow-lg shadow-cyan-500/25'
                : 'bg-sky-950/60 hover:bg-sky-900/70 border-cyan-400/25'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-black uppercase px-2 py-0.5 rounded bg-amber-400/25 text-amber-200 border border-amber-300/40">
                  Tier 2 Pro (Recommended)
                </span>
                <span className="text-sm font-black text-white">Pool-Deck Pro 2.5kV Isolated Aluminum Edition</span>
              </div>
              <p className="text-xs text-cyan-100/80 mt-1">
                2.5kV ADM3251E galvanic isolation &bull; 15kV ESD TVS diodes &bull; 915MHz Sub-GHz &bull; Anodized CNC aluminum + conformal coat.
              </p>
            </div>
            <div className="text-right pl-4">
              <div className="text-2xl font-black font-mono text-amber-300">$49.85</div>
              <div className="text-[10px] font-mono text-sky-200">Total BOM</div>
            </div>
          </button>
        </div>
      </div>

      {/* Main BOM Parts Table */}
      <div className="max-w-6xl mx-auto rounded-3xl bg-gradient-to-b from-sky-800/85 via-blue-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-cyan-300" />
            <h2 className="text-base font-black text-white">
              {selectedTier === 'tier2'
                ? 'Tier 2: Pool-Deck Pro Industrial Isolated Parts List (10 Line Items)'
                : 'Tier 1: Quick-Build Field Prototype Parts List (6 Line Items)'}
            </h2>
          </div>
          <div className="text-sm font-mono font-bold text-cyan-200">
            Estimated Unit Build Cost: <span className="text-emerald-300 text-base font-black">${totalCost.toFixed(2)} USD</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-cyan-400/30 bg-sky-950/80">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-cyan-400/30 bg-sky-900/80 font-mono text-[10px] uppercase tracking-wider text-cyan-200">
                <th className="p-3">Category</th>
                <th className="p-3">Component &amp; Purpose</th>
                <th className="p-3">Manufacturer / MPN</th>
                <th className="p-3">Supplier SKU</th>
                <th className="p-3 text-center">Qty</th>
                <th className="p-3 text-right">Unit</th>
                <th className="p-3 text-right">Subtotal</th>
                <th className="p-3 text-center">Order Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-400/15">
              {activeParts.map((part) => (
                <tr key={part.id} className="hover:bg-sky-800/40 transition">
                  <td className="p-3 font-mono font-bold text-amber-300 whitespace-nowrap">
                    {part.category}
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-white">{part.name}</div>
                    <div className="text-[11px] text-sky-200/80 mt-0.5">{part.notes}</div>
                  </td>
                  <td className="p-3 font-mono">
                    <div className="text-cyan-200 font-bold">{part.mpn}</div>
                    <div className="text-[10px] text-sky-300/80">{part.manufacturer}</div>
                  </td>
                  <td className="p-3 font-mono text-emerald-200 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30">
                      {part.supplier}: {part.sku}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-black text-center text-white">{part.qty}</td>
                  <td className="p-3 font-mono text-right text-sky-200">${part.unitPrice.toFixed(2)}</td>
                  <td className="p-3 font-mono font-bold text-right text-white">
                    ${(part.qty * part.unitPrice).toFixed(2)}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    <a
                      href={part.orderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-400/20 hover:bg-cyan-400/35 border border-cyan-300/40 text-cyan-100 font-mono font-bold text-[10px] transition"
                    >
                      <ShoppingCart size={11} />
                      <span>Order</span>
                      <ExternalLink size={10} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom 2-Column Grid: Wiring Schematic & Step-by-Step Build Checklist */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Pinout & Galvanic Isolation Schematic */}
        <div className="rounded-3xl bg-gradient-to-b from-sky-800/85 via-blue-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-cyan-400/30 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Zap size={17} className="text-amber-300" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  ESP32-S3 to 2.5kV Isolated 1/4&quot; TS Jack Pinout
                </h3>
              </div>
              <span className="text-[10px] font-mono text-cyan-200 bg-cyan-400/20 px-2 py-0.5 rounded border border-cyan-400/30">
                9600 8-E-1 / 19200 8-N-1
              </span>
            </div>

            <pre className="p-4 rounded-2xl bg-sky-950/90 border border-cyan-400/30 font-mono text-[11px] text-cyan-100 overflow-x-auto leading-relaxed shadow-inner">
{`ESP32-S3 DEVKITC-1             ADM3251E / MAX3232E            NEUTRIK 1/4" TS JACK
┌──────────────────┐          ┌────────────────────┐         ┌────────────────────┐
│ 3.3V        Pin 1├─────────►│ VCC1     V+ / V-   │         │                    │
│ GND         Pin 2├─────────►│ GND1     (±12V)    │         │   ╔════════════╗   │
│                  │          │          │         │         │   ║  TIP (+TX) ║◄──┼─ TXOUT
│ GPIO 17 (UART TX)├─────────►│ TIN      TOUT (±12V├─────────┼──►║  Data Line ║   │
│ GPIO 16 (UART RX)│◄─────────┤ ROUT     RIN       │         │   ╠════════════╣   │
│                  │  2.5kV   │          GND2 (ISO)├─────────┼──►║ SLEEVE GND ║   │
│ GPIO 4  (Pickle) ├──┐       └────────────────────┘         │   ╚════════════╝   │
│ GPIO 5  (Mode SW)│  │                                      └─────────┬──────────┘
└──────────────────┘  │        PC817 OPTOCOUPLER                       │
                      └─[1kΩ]─► Pin 1 (Anode)   Pin 4 (Col) ──► Pickle Tip
                       GND ───► Pin 2 (Cathode) Pin 3 (Emit)──► Pickle Sleeve`}
            </pre>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-sky-950/70 border border-cyan-400/25">
              <div className="font-mono font-bold text-emerald-300 text-[11px]">CTS WA-3 / System 6 Mode</div>
              <div className="text-sky-200/90 text-[11px] mt-0.5">
                GPIO 5 HIGH (Default): 9600 Baud, 8 Data Bits, EVEN Parity, 1 Stop Bit (`SERIAL_8E1`).
              </div>
            </div>
            <div className="p-3 rounded-xl bg-sky-950/70 border border-cyan-400/25">
              <div className="font-mono font-bold text-amber-300 text-[11px]">Daktronics All Sport 5000</div>
              <div className="text-sky-200/90 text-[11px] mt-0.5">
                GPIO 5 LOW or BLE Toggle: 19,200 Baud, 8 Data Bits, NO Parity (`SERIAL_8N1`, Code 4498).
              </div>
            </div>
          </div>
        </div>

        {/* Right: Interactive Assembly & Bench Verification Checklist */}
        <div className="rounded-3xl bg-gradient-to-b from-sky-800/85 via-blue-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-cyan-400/30 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Wrench size={17} className="text-emerald-300" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  5-Step Dongle Build &amp; Pool-Deck Verification Checklist
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-200 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                {checkedSteps.length} / {ASSEMBLY_STEPS.length} Completed
              </span>
            </div>

            <div className="space-y-2.5">
              {ASSEMBLY_STEPS.map((item) => {
                const isDone = checkedSteps.includes(item.step);
                return (
                  <button
                    key={item.step}
                    onClick={() => toggleStep(item.step)}
                    className={`w-full p-3 rounded-2xl border text-left transition flex items-start gap-3 cursor-pointer ${
                      isDone
                        ? 'bg-emerald-500/20 border-emerald-400/50'
                        : 'bg-sky-950/65 hover:bg-sky-900/75 border-cyan-400/25'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg font-mono font-black text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                        isDone
                          ? 'bg-emerald-400 text-sky-950'
                          : 'bg-sky-900 text-cyan-200 border border-cyan-400/40'
                      }`}
                    >
                      {isDone ? '✓' : item.step}
                    </div>
                    <div>
                      <div className="text-xs font-black text-white">{item.title}</div>
                      <div className="text-[11px] text-sky-200/90 mt-0.5 leading-relaxed">
                        {item.detail}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-400/15 border border-amber-300/40 flex items-center gap-3 text-xs text-amber-100">
            <AlertTriangle size={18} className="text-amber-300 shrink-0" />
            <span>
              <strong>Poolside Safety Tip:</strong> Always use a USB-C battery bank or isolated 5V medical/industrial adapter when plugging into older pool deck wall plates to maintain 2.5kV isolation.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
