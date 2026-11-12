#!/usr/bin/env python3
"""
PoloBridge & PoloPad Pro — Volunteer Table Quick-Start & Training Suite Test Suite

Verifies:
1. VolunteerTrainingManager architecture, singleton export, and rules models
2. Referee whistle and hand signal definitions (Ordinary, Turnover, Exclusion, Goal, Corner, Penalty)
3. 30s vs 20s Shot Clock Reset Decision Matrix rules
4. Training scenarios covering 6 pool deck match situations
5. VolunteerTrainingPanel aquatic UI compliance (no pitch-black)
6. Production bundle contains volunteer training tokens
"""

import os
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ENGINE_FILE = os.path.join(REPO_ROOT, "react_app", "src", "engine", "volunteer-training.ts")
PANEL_FILE = os.path.join(REPO_ROOT, "react_app", "src", "components", "volunteer-training-panel.tsx")
APP_FILE = os.path.join(REPO_ROOT, "react_app", "src", "App.tsx")
DIST_ASSETS_DIR = os.path.join(REPO_ROOT, "react_app", "dist", "assets")


class TestVolunteerTrainingSuite(unittest.TestCase):

    def test_01_training_manager_architecture_and_exports(self):
        """Verify VolunteerTrainingManager, singleton, and data structures."""
        self.assertTrue(os.path.exists(ENGINE_FILE), f"Missing engine file: {ENGINE_FILE}")
        with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            code = f.read()

        self.assertIn("export class VolunteerTrainingManager", code)
        self.assertIn("export const volunteerTrainingManager", code)
        self.assertIn("export const REFEREE_WHISTLE_SIGNALS", code)
        self.assertIn("export const SHOT_CLOCK_DECISION_MATRIX", code)
        self.assertIn("export const TRAINING_SCENARIOS", code)

    def test_02_referee_whistle_and_hand_signal_definitions(self):
        """Verify whistle signal specs for all 6 core water polo calls."""
        with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            code = f.read()

        self.assertIn("ordinary-foul", code)
        self.assertIn("turnover-foul", code)
        self.assertIn("exclusion-foul", code)
        self.assertIn("goal-scored", code)
        self.assertIn("corner-throw", code)
        self.assertIn("penalty-foul", code)

    def test_03_shot_clock_decision_matrix_rules(self):
        """Verify 30s vs 20s rules (WP 20.16 offensive rebound, corner throw, turnovers)."""
        with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            code = f.read()

        self.assertIn("Change of Possession", code)
        self.assertIn("Corner Throw", code)
        self.assertIn("Hits Goalpost", code)
        self.assertIn("No Reset", code)

    def test_04_training_scenarios_coverage(self):
        """Verify interactive quiz scenarios contain valid keys and explanations."""
        with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            code = f.read()

        self.assertIn("scen-1", code)
        self.assertIn("scen-2", code)
        self.assertIn("scen-3", code)
        self.assertIn("RESET_30", code)
        self.assertIn("RESET_20", code)
        self.assertIn("HOLD_CLOCK", code)

    def test_05_volunteer_training_panel_aquatic_compliance(self):
        """Verify volunteer-training-panel.tsx follows Sunlit Olympic Pool aquatic theme and no pitch-black."""
        self.assertTrue(os.path.exists(PANEL_FILE), f"Missing panel file: {PANEL_FILE}")
        with open(PANEL_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("from-sky-900 via-blue-900 to-indigo-950", content)
        self.assertIn("border-cyan-400", content)

        # Prohibit pitch-black backgrounds
        pitch_black_patterns = ["#06080d", "#040508", "bg-black"]
        for p in pitch_black_patterns:
            self.assertNotIn(p, content, f"Pitch black pattern '{p}' found in {PANEL_FILE}")

        self.assertIn("Water Polo Table Operator Cheat-Sheet", content)
        self.assertIn("Referee Whistle & Hand Signal Decoder", content)
        self.assertIn("Shot Clock Reset Decision Matrix", content)
        self.assertIn("Situation Training Quiz", content)

    def test_06_production_bundle_contains_volunteer_tokens(self):
        """Verify volunteer cheat sheet tokens are compiled into production dist bundle."""
        self.assertTrue(os.path.exists(DIST_ASSETS_DIR), f"Dist assets dir missing: {DIST_ASSETS_DIR}")
        js_files = [f for f in os.listdir(DIST_ASSETS_DIR) if f.endswith(".js")]
        self.assertGreater(len(js_files), 0, "No compiled JS bundle found in dist/assets")

        found_tokens = False
        for jf in js_files:
            filepath = os.path.join(DIST_ASSETS_DIR, jf)
            with open(filepath, "r", encoding="utf-8") as f:
                code = f.read()
            if "Water Polo Table Operator Cheat-Sheet" in code and "Decision Matrix" in code:
                found_tokens = True
                break

        self.assertTrue(
            found_tokens,
            "Production JS bundle must contain 'Water Polo Table Operator Cheat-Sheet' and 'Decision Matrix'"
        )


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
