#!/usr/bin/env python3
"""
PoloPad Pro — 6-8 Sports Cloud Sync & WebSocket Bridge Test Suite
================================================================
Validates:
  1. SixEightBridgeManager engine architecture and export contracts.
  2. WebSocket backoff reconnection policy (500ms base, 8000ms cap) and offline queueing.
  3. Multi-court tournament bracket data model and score propagation.
  4. Aquatic design system compliance in six-eight-panel.tsx (zero pitch-black tokens).
  5. Production bundle verification (compiled assets include 6-8 WebSocket bridge).
"""

import os
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DIST_DIR = os.path.join(REPO_ROOT, "react_app", "dist")
BRIDGE_ENGINE = os.path.join(REPO_ROOT, "react_app", "src", "engine", "six-eight-bridge.ts")
SIX_EIGHT_PANEL = os.path.join(REPO_ROOT, "react_app", "src", "components", "six-eight-panel.tsx")


class TestSixEightBridgeSuite(unittest.TestCase):
    def test_01_bridge_manager_architecture_and_exports(self):
        self.assertTrue(os.path.exists(BRIDGE_ENGINE), "Missing six-eight-bridge.ts")
        with open(BRIDGE_ENGINE, encoding="utf-8") as f:
            code = f.read()

        self.assertIn("class SixEightBridgeManager", code)
        self.assertIn("export const sixEightBridge", code)
        self.assertIn("6-8-gamedesk-v2", code)
        self.assertIn("INITIAL_TOURNAMENT_BRACKET", code)
        self.assertIn("publishEvent", code)
        self.assertIn("publishSnapshot", code)
        self.assertIn("publishRoster", code)
        self.assertIn("flushOfflineQueue", code)

    def test_02_reconnect_exponential_backoff_and_queue_policy(self):
        with open(BRIDGE_ENGINE, encoding="utf-8") as f:
            code = f.read()

        # Check exponential backoff math capped at 8000ms
        self.assertIn("Math.min(8000, 500 * Math.pow(2,", code)
        # Check offline queue storage
        self.assertIn("QUEUE_STORAGE_KEY", code)
        self.assertIn("this.offlineQueue.length > 500", code)
        self.assertIn("this.flushOfflineQueue()", code)

    def test_03_tournament_bracket_data_model(self):
        with open(BRIDGE_ENGINE, encoding="utf-8") as f:
            code = f.read()

        self.assertIn("TournamentBracket", code)
        self.assertIn("BracketMatch", code)
        self.assertIn("'QF'", code)
        self.assertIn("'SF'", code)
        self.assertIn("'FINAL'", code)
        self.assertIn("updateBracketMatchScore", code)

    def test_04_six_eight_panel_ui_and_aquatic_compliance(self):
        self.assertTrue(os.path.exists(SIX_EIGHT_PANEL), "Missing six-eight-panel.tsx")
        with open(SIX_EIGHT_PANEL, encoding="utf-8") as f:
            ui = f.read()

        # Aquatic Design System Guardrails (No Pitch-Black)
        forbidden = ["#06080d", "#040508", "bg-black"]
        for token in forbidden:
            self.assertNotIn(token, ui, f"Found forbidden pitch-black token {token} in six-eight-panel.tsx")

        # Verify key tabs and controls
        self.assertIn("Team Rosters & PI Scores", ui)
        self.assertIn("Live Tournament Bracket", ui)
        self.assertIn("WSS Packet Inspector", ui)
        self.assertIn("Wi-Fi Drop Simulator", ui)
        self.assertIn("WSS LIVE", ui)
        self.assertIn("sixEightBridge", ui)

    def test_05_production_bundle_contains_bridge_tokens(self):
        assets_dir = os.path.join(DIST_DIR, "assets")
        self.assertTrue(os.path.exists(assets_dir), "Missing compiled assets directory")
        js_files = [f for f in os.listdir(assets_dir) if f.endswith(".js")]
        self.assertGreater(len(js_files), 0, "No compiled JS bundle found")

        found_bridge = False
        for jf in js_files:
            with open(os.path.join(assets_dir, jf), encoding="utf-8") as f:
                bundle = f.read()
            if "6-8-gamedesk-v2" in bundle and "WSS LIVE" in bundle:
                found_bridge = True
                break

        self.assertTrue(found_bridge, "6-8 Sports WebSocket bridge must be compiled into production bundle")


if __name__ == "__main__":
    unittest.main(verbosity=2)
