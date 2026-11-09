#!/usr/bin/env python3
"""
PoloBridge & PoloPad Pro — WebSerial Flasher & Hardware QC Test Suite
=====================================================================
Verifies:
  1. In-browser WebSerial driver architecture & SLIP protocol framing (react_app/src/engine/webserial-manager.ts)
  2. 5-Point Automated Hardware Self-Test & Diagnostic coverage (RS-232, Pickle, Horn, Buttons, Telemetry)
  3. Aquatic UI Flasher Panel & Anti-Slop Guardrails (react_app/src/components/firmware-flasher-panel.tsx)
  4. App Navigation & Flasher Tab Integration (react_app/src/App.tsx)
  5. Compiled Production JavaScript Bundle Assets (react_app/dist/assets)
"""

import os
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class TestWebSerialFlasher(unittest.TestCase):
    def setUp(self):
        self.engine_path = os.path.join(REPO_ROOT, "react_app", "src", "engine", "webserial-manager.ts")
        self.panel_path = os.path.join(REPO_ROOT, "react_app", "src", "components", "firmware-flasher-panel.tsx")
        self.app_path = os.path.join(REPO_ROOT, "react_app", "src", "App.tsx")
        self.dist_dir = os.path.join(REPO_ROOT, "react_app", "dist")

    def test_01_webserial_manager_architecture_and_bootloader_protocol(self):
        self.assertTrue(os.path.exists(self.engine_path), "Missing webserial-manager.ts")
        with open(self.engine_path, encoding="utf-8") as f:
            code = f.read()

        # Check Espressif USB VID filter
        self.assertIn("0x303a", code, "Must filter for Espressif USB VID 0x303a")

        # Check baud rates
        self.assertIn("115200", code, "Must support standard 115200 bootloader baud")

        # Check SLIP bootloader sync & flashing states
        self.assertIn("connecting", code)
        self.assertIn("syncing", code)
        self.assertIn("erasing", code)
        self.assertIn("writing", code)
        self.assertIn("verifying", code)
        self.assertIn("complete", code)

        # Check 5-point hardware self-test diagnostic logic
        self.assertIn("rs232Loopback", code, "Must check isolated RS-232 loopback")
        self.assertIn("pickleOptos", code, "Must check Pickle optocouplers")
        self.assertIn("piezoHorn", code, "Must check 105dB piezo horn")
        self.assertIn("lidButtons", code, "Must check lid emergency buttons SW3, SW4, SW5")
        self.assertIn("chipInfo", code, "Must query chip telemetry")

        # Check pins documented
        self.assertIn("GPIO 18", code)
        self.assertIn("GPIO 19", code)
        self.assertIn("GPIO 20", code)
        self.assertIn("GPIO 4", code)
        self.assertIn("GPIO 5", code)
        self.assertIn("GPIO 6", code)
        self.assertIn("GPIO 7", code)
        self.assertIn("GPIO16", code)

    def test_02_firmware_flasher_panel_ui_and_aquatic_compliance(self):
        self.assertTrue(os.path.exists(self.panel_path), "Missing firmware-flasher-panel.tsx")
        with open(self.panel_path, encoding="utf-8") as f:
            code = f.read()

        # Check anti-slop aquatic design: zero pitch black
        for forbidden in ["#06080d", "#040508"]:
            self.assertNotIn(forbidden, code.lower(), f"Forbidden pitch-black {forbidden} found in firmware-flasher-panel.tsx")

        # Check flasher UI plungers and cards
        self.assertIn("1-Click ESP32-S3 Firmware Flasher", code)
        self.assertIn("Hardware Self-Test", code)
        self.assertIn("Diagnostic Terminal", code)
        self.assertIn("webSerialManager.flashRev25Firmware", code)
        self.assertIn("webSerialManager.runFullHardwareDiagnostic", code)

        # Check SW3, SW4, SW5 simulator controls
        self.assertIn("SW3", code)
        self.assertIn("SW4", code)
        self.assertIn("SW5", code)

    def test_03_app_tab_navigation_and_rendering(self):
        self.assertTrue(os.path.exists(self.app_path), "Missing App.tsx")
        with open(self.app_path, encoding="utf-8") as f:
            app_code = f.read()

        self.assertIn("import FirmwareFlasherPanel from './components/firmware-flasher-panel';", app_code)
        self.assertIn("'flasher'", app_code)
        self.assertIn("USB Flasher & QC", app_code)
        self.assertIn("<FirmwareFlasherPanel />", app_code)

    def test_04_production_bundle_contains_flasher_assets(self):
        assets_dir = os.path.join(self.dist_dir, "assets")
        self.assertTrue(os.path.exists(assets_dir), "react_app/dist/assets must exist")
        js_files = [f for f in os.listdir(assets_dir) if f.endswith(".js")]
        self.assertGreater(len(js_files), 0, "At least one JS bundle must exist")

        found_flasher = False
        for jf in js_files:
            with open(os.path.join(assets_dir, jf), encoding="utf-8") as f:
                txt = f.read()
            if "ESP32-S3" in txt and "USB Flasher" in txt:
                found_flasher = True
                break
        self.assertTrue(found_flasher, "Production JS bundle must include ESP32-S3 WebSerial Flasher assets")


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
