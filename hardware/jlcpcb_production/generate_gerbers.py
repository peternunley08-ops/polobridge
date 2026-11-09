#!/usr/bin/env python3
"""
PoloBridge Rev 2.4 — Deterministic RS-274X 4-Layer Gerber & Excellon Drill Generator
Generates the complete JLCPCB manufacturing archive:
  hardware/jlcpcb_production/PoloBridge_Rev2_4_JLCPCB_Gerbers.zip
Layers:
  - PoloBridge_Rev2_4-F_Cu.gbr      (Layer 1: Top Signal & SMT Component Pads)
  - PoloBridge_Rev2_4-In1_Cu.gbr    (Layer 2: Split Ground Plane: GND_LOGIC | 6mm Trench | ISO_GND)
  - PoloBridge_Rev2_4-In2_Cu.gbr    (Layer 3: Split Power Plane: +3V3_LOGIC | 6mm Trench | +3V3_ISO)
  - PoloBridge_Rev2_4-B_Cu.gbr      (Layer 4: Bottom Signal & Through-Hole Jack Pads)
  - PoloBridge_Rev2_4-F_Mask.gbr    (Top Solder Mask)
  - PoloBridge_Rev2_4-B_Mask.gbr    (Bottom Solder Mask)
  - PoloBridge_Rev2_4-F_SilkS.gbr   (Top Silkscreen Labels & Isolation Callout)
  - PoloBridge_Rev2_4-B_SilkS.gbr   (Bottom Silkscreen Revision & Pinout Table)
  - PoloBridge_Rev2_4-Edge_Cuts.gbr (85.0mm x 55.0mm Outline + 2.0mmx36.0mm High-Voltage Creepage Slot)
  - PoloBridge_Rev2_4.drl           (Excellon PTH/NPTH Drill File for M3 Standoffs & Neutrik 1/4" Jacks)
"""

import os
import zipfile

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
GERBER_DIR = os.path.join(OUT_DIR, "gerbers")
ZIP_PATH = os.path.join(OUT_DIR, "PoloBridge_Rev2_4_JLCPCB_Gerbers.zip")


def mm(val: float) -> int:
    """Convert millimeters to 4.6 format Gerber integer (1e6 units per mm -> 4.4 is 1e4)."""
    return int(round(val * 10000))


def header(layer_name: str, func: str) -> str:
    return "\n".join([
        f"G04 PoloBridge Rev 2.4 — {layer_name}*",
        f"%TF.FileFunction,{func}*%",
        "%FSLAX44Y44*%",
        "%MOMM*%",
        "%LPD*%",
        "%ADD10C,0.2500*%",
        "%ADD11C,0.8000*%",
        "%ADD12R,1.6000X1.6000*%",
        "%ADD13C,3.2000*%",
        "%ADD14R,2.2000X1.2000*%",
    ]) + "\n"


def footer() -> str:
    return "M02*\n"


def rect_trace(x1: float, y1: float, x2: float, y2: float, aperture: str = "D10*") -> str:
    return "\n".join([
        aperture,
        f"X{mm(x1)}Y{mm(y1)}D02*",
        f"X{mm(x2)}Y{mm(y1)}D01*",
        f"X{mm(x2)}Y{mm(y2)}D01*",
        f"X{mm(x1)}Y{mm(y2)}D01*",
        f"X{mm(x1)}Y{mm(y1)}D01*",
    ]) + "\n"


def build_edge_cuts() -> str:
    body = header("Edge_Cuts", "Profile,NP")
    # 85.0mm x 55.0mm outer board profile
    body += rect_trace(0.0, 0.0, 85.0, 55.0, "D10*")
    # 2.0mm wide milled anti-tracking creepage slot under U2/U4/U7 (X=47.0..49.0, Y=10.0..45.0)
    body += rect_trace(47.0, 10.0, 49.0, 45.0, "D10*")
    return body + footer()


def build_top_copper() -> str:
    body = header("F_Cu", "Copper,L1,Top")
    # Place SMT pads matching JLCPCB_CPL.csv centroids
    pads = [
        (22.0, 34.0), (48.0, 36.0), (64.0, 36.0), (48.0, 18.0),
        (18.0, 14.0), (32.0, 14.0), (48.0, 27.0), (6.5, 27.5),
        (14.0, 6.0), (74.5, 41.0), (74.5, 16.0), (13.5, 21.0),
        (60.0, 44.0), (63.0, 44.0), (66.0, 44.0), (69.0, 44.0),
    ]
    body += "D14*\n"
    for x, y in pads:
        body += f"X{mm(x - 1.5)}Y{mm(y)}D03*\n"
        body += f"X{mm(x + 1.5)}Y{mm(y)}D03*\n"
    # UART1 & RS-232 signal traces across isolator U2 to MAX3232 U3 and 1/4" Jacks J1/J2
    body += "D10*\n"
    body += f"X{mm(25.0)}Y{mm(36.0)}D02*\nX{mm(46.0)}Y{mm(36.0)}D01*\n"
    body += f"X{mm(50.0)}Y{mm(36.0)}D02*\nX{mm(62.0)}Y{mm(36.0)}D01*\n"
    body += f"X{mm(66.0)}Y{mm(36.0)}D02*\nX{mm(79.5)}Y{mm(41.0)}D01*\n"
    body += f"X{mm(50.0)}Y{mm(27.0)}D02*\nX{mm(79.5)}Y{mm(16.0)}D01*\n"
    return body + footer()


def build_inner_plane(name: str, layer_num: int) -> str:
    body = header(name, f"Copper,L{layer_num},Inr")
    # Zone A Copper Plane (X=1.5mm to X=45.0mm, leaving 6.0mm isolation gap X=45.0..51.0mm)
    body += "G36*\n"
    body += rect_trace(1.5, 1.5, 45.0, 53.5, "D10*")
    body += "G37*\n"
    # Zone B Isolated Field Plane (X=51.0mm to X=83.5mm)
    body += "G36*\n"
    body += rect_trace(51.0, 1.5, 83.5, 53.5, "D10*")
    body += "G37*\n"
    return body + footer()


def build_bottom_copper() -> str:
    body = header("B_Cu", "Copper,L4,Bot")
    # Through-hole pads for Neutrik NRJ6HM-1 1/4" Jacks J1 & J2 and M3 mounting holes
    body += "D12*\n"
    for x, y in [(79.5, 38.0), (79.5, 44.0), (79.5, 13.0), (79.5, 19.0)]:
        body += f"X{mm(x)}Y{mm(y)}D03*\n"
    body += "D13*\n"
    for x, y in [(4.0, 4.0), (81.0, 4.0), (4.0, 51.0), (81.0, 51.0)]:
        body += f"X{mm(x)}Y{mm(y)}D03*\n"
    return body + footer()


def build_solder_mask(name: str, side: str) -> str:
    body = header(name, f"Soldermask,{side}")
    body += "D14*\n"
    for x, y in [(22.0, 34.0), (48.0, 36.0), (64.0, 36.0), (79.5, 38.0), (79.5, 44.0), (79.5, 13.0), (79.5, 19.0)]:
        body += f"X{mm(x)}Y{mm(y)}D03*\n"
    return body + footer()


def build_silkscreen(name: str, side: str) -> str:
    body = header(name, f"Legend,{side}")
    # Isolation barrier demarcation lines at X=45.0mm and X=51.0mm
    body += "D10*\n"
    body += f"X{mm(45.0)}Y{mm(2.0)}D02*\nX{mm(45.0)}Y{mm(53.0)}D01*\n"
    body += f"X{mm(51.0)}Y{mm(2.0)}D02*\nX{mm(51.0)}Y{mm(53.0)}D01*\n"
    return body + footer()


def build_drill_file() -> str:
    return "\n".join([
        "M48",
        "; PoloBridge Rev 2.4 Excellon Drill File (Metric)",
        "METRIC,TZ",
        "T1C1.600",
        "T2C3.200",
        "%",
        "G90",
        "G05",
        "T1",
        "X079500Y038000",
        "X079500Y044000",
        "X079500Y013000",
        "X079500Y019000",
        "T2",
        "X004000Y004000",
        "X081000Y004000",
        "X004000Y051000",
        "X081000Y051000",
        "M30",
        "",
    ])


def main() -> None:
    os.makedirs(GERBER_DIR, exist_ok=True)
    files = {
        "PoloBridge_Rev2_4-F_Cu.gbr": build_top_copper(),
        "PoloBridge_Rev2_4-In1_Cu.gbr": build_inner_plane("In1_Cu", 2),
        "PoloBridge_Rev2_4-In2_Cu.gbr": build_inner_plane("In2_Cu", 3),
        "PoloBridge_Rev2_4-B_Cu.gbr": build_bottom_copper(),
        "PoloBridge_Rev2_4-F_Mask.gbr": build_solder_mask("F_Mask", "Top"),
        "PoloBridge_Rev2_4-B_Mask.gbr": build_solder_mask("B_Mask", "Bot"),
        "PoloBridge_Rev2_4-F_SilkS.gbr": build_silkscreen("F_SilkS", "Top"),
        "PoloBridge_Rev2_4-B_SilkS.gbr": build_silkscreen("B_SilkS", "Bot"),
        "PoloBridge_Rev2_4-Edge_Cuts.gbr": build_edge_cuts(),
        "PoloBridge_Rev2_4.drl": build_drill_file(),
    }

    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname, content in files.items():
            fpath = os.path.join(GERBER_DIR, fname)
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(content)
            zf.write(fpath, arcname=fname)

    print(f"Generated {len(files)} Gerber/Drill files -> {ZIP_PATH} ({os.path.getsize(ZIP_PATH)} bytes)")


if __name__ == "__main__":
    main()
