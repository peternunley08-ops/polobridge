#!/usr/bin/env python3
"""
PoloBridge & PoloPad Pro — Phone Version Automated Verification Suite
=====================================================================
Verifies:
  1. Phone Console Architecture & Ergonomics (react_app/src/components/phone-console.tsx)
  2. Phone Haptics & Screen Wake-Lock Engine (react_app/src/engine/phone-haptics.ts)
  3. Responsive Orientation & Safe-Area Inset Support (portrait & landscape)
  4. Web App Manifest Phone Agility (orientation: any, standalone, relative ./ start_url)
  5. Aquatic Design System Compliance (Zero pitch-black #06080d or #040508)
"""

import json
import os
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class TestPhoneVersionArchitecture(unittest.TestCase):
    def setUp(self):
        self.phone_console_path = os.path.join(REPO_ROOT, "react_app", "src", "components", "phone-console.tsx")
        self.phone_haptics_path = os.path.join(REPO_ROOT, "react_app", "src", "engine", "phone-haptics.ts")
        self.manifest_path = os.path.join(REPO_ROOT, "react_app", "public", "manifest.json")
        self.app_path = os.path.join(REPO_ROOT, "react_app", "src", "App.tsx")

    def test_01_phone_console_component_exists_and_implements_ergonomics(self):
        self.assertTrue(os.path.exists(self.phone_console_path), "Missing phone-console.tsx")
        with open(self.phone_console_path, encoding="utf-8") as f:
            code = f.read()

        # Check orientation support
        self.assertIn("portrait", code)
        self.assertIn("landscape", code)
        self.assertIn("safe-area-inset-top", code)
        self.assertIn("safe-area-inset-bottom", code)

        # Check hero plungers
        self.assertIn("START CLOCK", code)
        self.assertIn("PAUSE CLOCK", code)
        self.assertIn("30s RESET", code)
        self.assertIn("20s RESET", code)
        self.assertIn("phoneHaptics.trigger", code)

        # Check Rule WP 22.3 Cap-out lock in phone cap modal
        self.assertIn("Rule WP 22.3", code)
        self.assertIn("isCappedOut", code)

        # Check anti-slop aquatic design: zero pitch black
        for forbidden in ["#06080d", "#040508"]:
            self.assertNotIn(forbidden, code.lower(), f"Forbidden pitch-black {forbidden} found in phone-console.tsx")

    def test_02_phone_haptics_and_wake_lock_engine(self):
        self.assertTrue(os.path.exists(self.phone_haptics_path), "Missing phone-haptics.ts")
        with open(self.phone_haptics_path, encoding="utf-8") as f:
            code = f.read()

        # Check vibration patterns
        self.assertIn("navigator.vibrate", code)
        self.assertIn("reset30", code)
        self.assertIn("reset20", code)
        self.assertIn("horn", code)

        # Check wake-lock API
        self.assertIn("wakeLock.request('screen')", code)
        self.assertIn("handleVisibilityChange", code)

    def test_03_manifest_phone_agility(self):
        self.assertTrue(os.path.exists(self.manifest_path), "Missing manifest.json")
        with open(self.manifest_path, encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("orientation"), "any", "Phone PWA manifest orientation must be 'any'")
        self.assertEqual(manifest.get("display"), "standalone", "PWA display must be 'standalone'")
        self.assertEqual(manifest.get("start_url"), "./", "start_url must be relative './' for subpath support")

    def test_04_app_integration_and_mode_switching(self):
        self.assertTrue(os.path.exists(self.app_path), "Missing App.tsx")
        with open(self.app_path, encoding="utf-8") as f:
            app_code = f.read()

        self.assertIn("import PhoneConsole from './components/phone-console';", app_code)
        self.assertIn("isPhoneMode", app_code)
        self.assertIn("deviceViewMode", app_code)
        self.assertIn("<PhoneConsole", app_code)
        self.assertIn("onToggle20sReset", app_code)
        self.assertIn("setExclusions([]);", app_code, "reset30 must release active exclusions on turnover per Rule WP 21")

    def test_05_dynamic_20s_reset_visibility_and_turnover_release(self):
        with open(self.phone_console_path, encoding="utf-8") as f:
            code = f.read()

        # Check enable20sReset conditional hiding logic in phone console
        self.assertIn("enable20sReset ?", code)
        self.assertIn("NFHS 30s ONLY", code)
        self.assertIn("onToggle20sReset", code)


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
