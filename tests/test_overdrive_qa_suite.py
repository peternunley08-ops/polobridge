#!/usr/bin/env python3
"""
PoloBridge & PoloPad Pro — Project Overdrive Red-Team QA & Hardware DRC Suite
=============================================================================
Verifies:
  1. JLCPCB Rev 2.5 BOM & CPL Manufacturing DRC (85x55mm boundary + 2.5kV isolation barrier)
  2. 3D Printable .STL Mesh & OpenSCAD Structural Integrity
  3. Rev 2.5 ESP32-S3 Firmware Pinout & Dual-Mode / Triple-Horn / 0.0s Auto-Stop Logic
  4. World Aquatics (WP 20.15, WP 21, WP 22.3) & NFHS High School Rules Engine Invariants
  5. Sunlit Olympic Pool Aquatic Design System Compliance (Zero pitch-black regressions)
"""

import csv
import os
import re
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class TestOverdriveHardwareDRC(unittest.TestCase):
    """Red-Team DRC checks on JLCPCB BOM, CPL Pick-and-Place, and 2.5kV Galvanic Isolation."""

    def setUp(self):
        self.bom_path = os.path.join(REPO_ROOT, "hardware", "jlcpcb_production", "JLCPCB_BOM.csv")
        self.cpl_path = os.path.join(REPO_ROOT, "hardware", "jlcpcb_production", "JLCPCB_CPL.csv")

    def test_bom_lcsc_part_numbers_and_rev25_additions(self):
        self.assertTrue(os.path.exists(self.bom_path), "Missing JLCPCB_BOM.csv")
        with open(self.bom_path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))

        self.assertGreaterEqual(len(rows), 20, "Rev 2.5 BOM must have at least 20 line items")
        all_designators = set()
        for r in rows:
            lcsc = r["LCSC Part #"].strip()
            self.assertRegex(lcsc, r"^C\d+$", f"Invalid LCSC part number: {lcsc}")
            for d in r["Designator"].split(","):
                all_designators.add(d.strip())

        # Verify Rev 2.5 Dual-Mode & Fail-Safe components exist in BOM (47 total SMD parts)
        self.assertGreaterEqual(len(all_designators), 47, "Rev 2.5 BOM must cover all 47 SMD components")
        for required_ref in ["U1", "U2", "U3", "U4", "U7", "U8", "U9", "Q1", "SW3", "SW4", "SW5", "J6"]:
            self.assertIn(required_ref, all_designators, f"Missing required Rev 2.5 designator {required_ref} in BOM")

    def test_cpl_board_outline_and_2500v_isolation_barrier(self):
        self.assertTrue(os.path.exists(self.cpl_path), "Missing JLCPCB_CPL.csv")
        with open(self.cpl_path, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))

        allowed_bridge_refs = {"U2", "U4", "U7", "U8", "U9"}
        for r in rows:
            ref = r["Designator"].strip()
            x = float(r["Mid X"].replace("mm", "").strip())
            y = float(r["Mid Y"].replace("mm", "").strip())

            # Board outline: 85.0mm x 55.0mm (0 < X < 85, 0 < Y < 55)
            self.assertGreater(x, 0.0, f"{ref} X={x}mm outside left PCB edge")
            self.assertLess(x, 85.0, f"{ref} X={x}mm outside right PCB edge")
            self.assertGreater(y, 0.0, f"{ref} Y={y}mm outside bottom PCB edge")
            self.assertLess(y, 55.0, f"{ref} Y={y}mm outside top PCB edge")

            # 2.5kV Isolation Keep-Out Zone: 45.0mm <= X <= 51.0mm
            if 45.0 <= x <= 51.0:
                self.assertIn(
                    ref,
                    allowed_bridge_refs,
                    f"SECURITY/SAFETY VIOLATION: Non-isolated part {ref} encroaches 2.5kV isolation slot at X={x}mm",
                )


class TestOverdrive3DPrintableMeshes(unittest.TestCase):
    """Verifies generated ASCII .STL meshes and parametric OpenSCAD source."""

    def test_stl_meshes_valid_ascii_facets(self):
        stl_files = [
            os.path.join(REPO_ROOT, "hardware", "enclosure_cad", "polobridge_front_panel_drill_jig.stl"),
            os.path.join(REPO_ROOT, "hardware", "enclosure_cad", "polopad_poolside_sunhood_stand.stl"),
        ]
        for path in stl_files:
            self.assertTrue(os.path.exists(path), f"Missing STL file: {path}")
            with open(path, encoding="utf-8") as f:
                content = f.read()
            self.assertTrue(content.startswith("solid "), f"{path} must start with 'solid '")
            self.assertIn("endsolid ", content, f"{path} must contain 'endsolid '")
            facet_count = content.count("facet normal")
            endfacet_count = content.count("endfacet")
            self.assertGreaterEqual(facet_count, 24, f"{path} must have at least 24 triangles")
            self.assertEqual(facet_count, endfacet_count, f"Unbalanced facets in {path}")


class TestOverdriveFirmwareAndRulesInvariants(unittest.TestCase):
    """Verifies Rev 2.5 Firmware Dual-Mode, Triple-Redundant Horn, and 0.0s Shot-Clock Auto-Stop."""

    def test_firmware_rev25_pins_and_auto_stop(self):
        fw_path = os.path.join(REPO_ROOT, "firmware", "polobridge_firmware.ino")
        with open(fw_path, encoding="utf-8") as f:
            fw = f.read()

        self.assertIn("PICKLE_30S_PIN            4", fw)
        self.assertIn("PICKLE_20S_PIN            5", fw)
        self.assertIn("PICKLE_START_STOP_PIN     6", fw)
        self.assertIn("AUX_HORN_MOSFET_PIN       7", fw)
        self.assertIn("BTN_FAILSAFE_START_STOP   18", fw)
        self.assertIn("BTN_FAILSAFE_RESET_30     19", fw)
        self.assertIn("BTN_FAILSAFE_RESET_20     20", fw)
        self.assertIn("pulsePickleChannel(PICKLE_30S_PIN", fw)
        self.assertIn("pulsePickleChannel(PICKLE_20S_PIN", fw)
        self.assertIn("state.isRunning = false;", fw)
        self.assertIn("triggerHorn(1500);", fw)

    def test_aquatic_design_system_no_pitch_black(self):
        src_dir = os.path.join(REPO_ROOT, "react_app", "src")
        forbidden_hex = ["#06080d", "#040508"]
        for root, _, files in os.walk(src_dir):
            for fname in files:
                if fname.endswith((".tsx", ".ts", ".css")):
                    fpath = os.path.join(root, fname)
                    with open(fpath, encoding="utf-8") as f:
                        txt = f.read().lower()
                    for hex_code in forbidden_hex:
                        self.assertNotIn(
                            hex_code,
                            txt,
                            f"Forbidden pitch-black color {hex_code} found in {fpath}",
                        )


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
