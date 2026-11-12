#!/usr/bin/env python3
"""
PoloBridge & PoloPad Pro — Live OBS & vMix Broadcast Scorebug Suite Test Suite

Verifies:
1. BroadcastManager architecture, singleton export, and settings schema
2. URL query parameter parsing for OBS browser source transparent embedding
3. 4 Graphics themes (Olympic Ribbon, ESPN Lower-Third, Hudl Stream Pill, Minimal Bug)
4. BroadcastOverlayPanel aquatic UI compliance (no pitch-black)
5. Production bundle contains broadcast overlay tokens
"""

import os
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ENGINE_FILE = os.path.join(REPO_ROOT, "react_app", "src", "engine", "broadcast-manager.ts")
PANEL_FILE = os.path.join(REPO_ROOT, "react_app", "src", "components", "broadcast-overlay-panel.tsx")
APP_FILE = os.path.join(REPO_ROOT, "react_app", "src", "App.tsx")
DIST_ASSETS_DIR = os.path.join(REPO_ROOT, "react_app", "dist", "assets")


class TestBroadcastOverlaySuite(unittest.TestCase):

    def test_01_broadcast_manager_architecture_and_exports(self):
        """Verify BroadcastManager, broadcastManager singleton, and settings schema."""
        self.assertTrue(os.path.exists(ENGINE_FILE), f"Missing engine file: {ENGINE_FILE}")
        with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            code = f.read()

        self.assertIn("export class BroadcastManager", code)
        self.assertIn("export const broadcastManager", code)
        self.assertIn("export const DEFAULT_BROADCAST_SETTINGS", code)
        self.assertIn("export const BROADCAST_CHANNEL_NAME", code)
        self.assertIn("polopad_broadcast_stream", code)
        self.assertIn("polopad_broadcast_settings", code)

    def test_02_url_query_parameter_parser(self):
        """Verify parseUrlParams extracts overlay mode, theme, and chroma transparency."""
        with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            code = f.read()

        self.assertIn("static parseUrlParams", code)
        self.assertIn("URLSearchParams", code)
        self.assertIn("isOverlayMode", code)
        self.assertIn("generateObsUrl", code)

    def test_03_theme_and_display_configuration_invariants(self):
        """Verify support for Olympic Ribbon, ESPN, Hudl, and Minimal bug themes."""
        with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            code = f.read()

        for theme in ["olympic", "espn", "hudl", "minimal"]:
            self.assertIn(f"'{theme}'", code, f"Theme '{theme}' must be defined in broadcast-manager.ts")

        for chroma in ["transparent", "green", "blue"]:
            self.assertIn(f"'{chroma}'", code, f"Chroma mode '{chroma}' must be supported")

    def test_04_broadcast_overlay_panel_aquatic_compliance(self):
        """Verify broadcast-overlay-panel.tsx follows Sunlit Olympic Pool aquatic theme and no pitch-black."""
        self.assertTrue(os.path.exists(PANEL_FILE), f"Missing panel file: {PANEL_FILE}")
        with open(PANEL_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("from-sky-900 via-blue-900 to-indigo-950", content)
        self.assertIn("border-cyan-400", content)

        # Prohibit pitch-black backgrounds
        pitch_black_patterns = ["#06080d", "#040508", "bg-black"]
        for p in pitch_black_patterns:
            self.assertNotIn(p, content, f"Pitch black pattern '{p}' found in {PANEL_FILE}")

        self.assertIn("Olympic Ribbon", content)
        self.assertIn("ESPN Lower-Third", content)
        self.assertIn("Hudl Stream Pill", content)
        self.assertIn("Minimal Bug", content)

    def test_05_production_bundle_contains_broadcast_tokens(self):
        """Verify broadcast scorebug tokens are compiled into production dist bundle."""
        self.assertTrue(os.path.exists(DIST_ASSETS_DIR), f"Dist assets dir missing: {DIST_ASSETS_DIR}")
        js_files = [f for f in os.listdir(DIST_ASSETS_DIR) if f.endswith(".js")]
        self.assertGreater(len(js_files), 0, "No compiled JS bundle found in dist/assets")

        found_broadcast_tokens = False
        for jf in js_files:
            filepath = os.path.join(DIST_ASSETS_DIR, jf)
            with open(filepath, "r", encoding="utf-8") as f:
                code = f.read()
            if "polopad_broadcast_stream" in code and "Olympic Ribbon" in code:
                found_broadcast_tokens = True
                break

        self.assertTrue(
            found_broadcast_tokens,
            "Production JS bundle must contain 'polopad_broadcast_stream' and 'Olympic Ribbon'"
        )


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
