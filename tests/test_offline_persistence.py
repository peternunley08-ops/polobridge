#!/usr/bin/env python3
"""
PoloBridge & PoloPad Pro — Offline Resilience & IndexedDB Persistence Verification Suite
========================================================================================
Verifies:
  1. IndexedDB & LocalStorage Mirror Engine (`react_app/src/engine/match-persistence.ts`)
  2. BLE GATT Watchdog & Exponential-Backoff Auto-Reconnect (`react_app/src/engine/bluetooth-manager.ts`)
  3. Offline Resilience & Persistence Vault UI (`react_app/src/components/offline-resilience-panel.tsx`)
  4. Service Worker Precaching & Offline Navigation Fallback (`react_app/public/sw.js`)
  5. App.tsx 100ms Auto-Save & Pagehide Hydration Integration
"""

import os
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class TestOfflinePersistenceAndBleReconnect(unittest.TestCase):
    def setUp(self):
        self.persistence_path = os.path.join(REPO_ROOT, "react_app", "src", "engine", "match-persistence.ts")
        self.ble_path = os.path.join(REPO_ROOT, "react_app", "src", "engine", "bluetooth-manager.ts")
        self.panel_path = os.path.join(REPO_ROOT, "react_app", "src", "components", "offline-resilience-panel.tsx")
        self.sw_path = os.path.join(REPO_ROOT, "react_app", "public", "sw.js")
        self.app_path = os.path.join(REPO_ROOT, "react_app", "src", "App.tsx")
        self.dist_dir = os.path.join(REPO_ROOT, "react_app", "dist")

    def test_01_indexeddb_and_localstorage_mirror_engine(self):
        self.assertTrue(os.path.exists(self.persistence_path), "Missing match-persistence.ts")
        with open(self.persistence_path, encoding="utf-8") as f:
            code = f.read()

        # Check IndexedDB database and stores
        self.assertIn("PoloPadProOfflineDB", code)
        self.assertIn("live_match_state", code)
        self.assertIn("match_checkpoints", code)
        self.assertIn("polopad_pro_live_match_v1", code)

        # Check key persistence methods
        self.assertIn("saveLiveState", code)
        self.assertIn("loadFromIndexedDB", code)
        self.assertIn("loadImmediateMirror", code)
        self.assertIn("createCheckpoint", code)
        self.assertIn("listCheckpoints", code)
        self.assertIn("clearAllPersistedData", code)
        self.assertIn("exportMatchBackupJson", code)

    def test_02_ble_exponential_backoff_auto_reconnect(self):
        self.assertTrue(os.path.exists(self.ble_path), "Missing bluetooth-manager.ts")
        with open(self.ble_path, encoding="utf-8") as f:
            code = f.read()

        # Check reconnecting state and exponential backoff
        self.assertIn("'reconnecting'", code)
        self.assertIn("scheduleAutoReconnect", code)
        self.assertIn("Math.pow(2, this.reconnectAttempt - 1)", code)
        self.assertIn("simulateRfDropAndAutoReconnect", code)
        self.assertIn("establishGattSession", code)

    def test_03_offline_resilience_panel_and_aquatic_compliance(self):
        self.assertTrue(os.path.exists(self.panel_path), "Missing offline-resilience-panel.tsx")
        with open(self.panel_path, encoding="utf-8") as f:
            code = f.read()

        # Check anti-slop aquatic design: zero pitch black
        for forbidden in ["#06080d", "#040508"]:
            self.assertNotIn(forbidden, code.lower(), f"Forbidden pitch-black {forbidden} found in offline-resilience-panel.tsx")

        # Check UI features
        self.assertIn("100ms IndexedDB Auto-Save Engine", code)
        self.assertIn("BLE GATT Watchdog", code)
        self.assertIn("Match Time-Machine Checkpoints", code)
        self.assertIn("handleSimulateCrashRecovery", code)
        self.assertIn("handleSimulateBleDrop", code)

    def test_04_service_worker_precaching_and_navigation_fallback(self):
        self.assertTrue(os.path.exists(self.sw_path), "Missing sw.js")
        with open(self.sw_path, encoding="utf-8") as f:
            sw = f.read()

        self.assertIn("polopad-pro-rev25-v1", sw)
        self.assertIn("PoloBridge_Rev2_4_JLCPCB_Gerbers.zip", sw)
        self.assertIn("polobridge_front_panel_drill_jig.stl", sw)
        self.assertIn("event.request.mode === 'navigate'", sw)

    def test_05_app_integration_and_compiled_bundle(self):
        with open(self.app_path, encoding="utf-8") as f:
            app_code = f.read()

        self.assertIn("import OfflineResiliencePanel from './components/offline-resilience-panel';", app_code)
        self.assertIn("matchPersistence.loadImmediateMirror()", app_code)
        self.assertIn("matchPersistence.saveLiveState", app_code)
        self.assertIn("window.addEventListener('pagehide'", app_code)
        self.assertIn("<OfflineResiliencePanel", app_code)

        assets_dir = os.path.join(self.dist_dir, "assets")
        js_files = [f for f in os.listdir(assets_dir) if f.endswith(".js")]
        self.assertGreater(len(js_files), 0)
        found = False
        for jf in js_files:
            with open(os.path.join(assets_dir, jf), encoding="utf-8") as f:
                txt = f.read()
            if "PoloPadProOfflineDB" in txt and "AUTO-RECONNECT" in txt:
                found = True
                break
        self.assertTrue(found, "Production bundle must contain PoloPadProOfflineDB and BLE AUTO-RECONNECT logic")


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
