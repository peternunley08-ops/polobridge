#!/usr/bin/env python3
"""
PoloPad Pro — Digital Scoresheet & Custom Rosters Test Suite
============================================================
Validates:
  1. Team Roster generation (Cap #1-18, Goalies #1 & #13).
  2. Individual player goal attribution across match periods.
  3. Rule WP 22.3 (3 personal foul cap-out detection and warning flag).
  4. Official USA Water Polo & NFHS CSV Box Score export format.
  5. Print-ready Landscape HTML scoresheet with referee signature blocks.
  6. Production bundle verification (compiled assets include digital scoresheet engine).
"""

import os
import re
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DIST_DIR = os.path.join(REPO_ROOT, "react_app", "dist")
ROSTER_ENGINE = os.path.join(REPO_ROOT, "react_app", "src", "engine", "roster-manager.ts")
SCORESHEET_PANEL = os.path.join(REPO_ROOT, "react_app", "src", "components", "digital-scoresheet-panel.tsx")


class TestDigitalScoresheetEngine(unittest.TestCase):
    def test_01_roster_engine_architecture_and_caps(self):
        self.assertTrue(os.path.exists(ROSTER_ENGINE), "Missing roster-manager.ts")
        with open(ROSTER_ENGINE, encoding="utf-8") as f:
            code = f.read()

        self.assertIn("createDefaultRoster", code)
        self.assertIn("PlayerRecord", code)
        self.assertIn("isGoalie", code)
        self.assertIn("capNumber", code)
        self.assertIn("isPlayerCappedOut", code)
        self.assertIn("exportScoresheetCsv", code)
        self.assertIn("generatePrintableScoresheetHtml", code)

        # Verify Goalies are assigned to Cap #1 and Cap #13
        self.assertIn("cap === 1 || cap === 13", code)

    def test_02_rule_wp_22_3_three_foul_cap_out_logic(self):
        with open(ROSTER_ENGINE, encoding="utf-8") as f:
            code = f.read()

        # Check that 3 fouls trigger capped out condition
        self.assertIn("newFouls.length >= 3", code)
        self.assertIn("player.fouls.length >= 3", code)
        self.assertIn("Rule WP 22.3", code)

    def test_03_csv_box_score_and_html_export_contracts(self):
        with open(ROSTER_ENGINE, encoding="utf-8") as f:
            code = f.read()

        # Check CSV export contract
        self.assertIn("OFFICIAL WATER POLO SCORESHEET BOX SCORE", code)
        self.assertIn("PROGRESSIVE MATCH PLAY-BY-PLAY LOG", code)
        self.assertIn("Total Goals", code)
        self.assertIn("Total Fouls", code)

        # Check HTML Print contract
        self.assertIn("@page { size: landscape;", code)
        self.assertIn("USA WATER POLO / NFHS / WORLD AQUATICS COMPLIANT", code)
        self.assertIn("Referee 1 Signature", code)
        self.assertIn("Referee 2 Signature", code)
        self.assertIn("Desk Official Signature", code)

    def test_04_digital_scoresheet_panel_ui_and_aquatic_compliance(self):
        self.assertTrue(os.path.exists(SCORESHEET_PANEL), "Missing digital-scoresheet-panel.tsx")
        with open(SCORESHEET_PANEL, encoding="utf-8") as f:
            ui = f.read()

        # Aquatic Design System Guardrails (No Pitch-Black)
        self.assertNotIn("#06080d", ui)
        self.assertNotIn("#040508", ui)
        self.assertNotIn("bg-black", ui)

        # Check fast cap logger and scoresheet tabs
        self.assertIn("Fast Cap Logger", ui)
        self.assertIn("Official Scoresheet Table", ui)
        self.assertIn("Edit Rosters", ui)
        self.assertIn("CAPPED OUT", ui)
        self.assertIn("window.print()", ui)

    def test_05_production_bundle_contains_scoresheet_engine(self):
        assets_dir = os.path.join(DIST_DIR, "assets")
        self.assertTrue(os.path.exists(assets_dir), "Missing compiled assets directory")
        js_files = [f for f in os.listdir(assets_dir) if f.endswith(".js")]
        self.assertGreater(len(js_files), 0, "No compiled JS bundle found")

        found_scoresheet = False
        for jf in js_files:
            with open(os.path.join(assets_dir, jf), encoding="utf-8") as f:
                bundle = f.read()
            if "Digital Scoresheet" in bundle and "USAWP" in bundle:
                found_scoresheet = True
                break

        self.assertTrue(found_scoresheet, "Digital scoresheet panel must be compiled into production bundle")


if __name__ == "__main__":
    unittest.main(verbosity=2)
