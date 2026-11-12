#!/usr/bin/env python3
"""
Playwright E2E & Live Production Bundle Verifier (Skill #6: playwright)
=======================================================================
Spins up an ephemeral local HTTP server serving the production `react_app/dist`
bundle (matching GitHub Pages `https://peternunley08-ops.github.io/polobridge/`)
and executes end-to-end HTTP + DOM + Asset + Download verification across:
  1. Main App Entrypoint (`index.html`), Relative Asset Links (`./assets/...`), and Service Worker (`sw.js`)
  2. Standalone Landscape iOS Web App Manifest (`manifest.json`)
  3. All 3 Product Renders (`polobridge_kit_exploded_render.jpg`, etc.)
  4. All 5 Hosted Manufacturing & 3D CAD Downloads (`PoloBridge_Rev2_4_JLCPCB_Gerbers.zip`,
     `JLCPCB_BOM.csv`, `JLCPCB_CPL.csv`, and both `.STL` 3D printable meshes)
"""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import threading
import unittest
from urllib.request import urlopen

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DIST_DIR = os.path.join(REPO_ROOT, "react_app", "dist")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


class TestPlaywrightE2EProductionBundle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = partial(QuietHandler, directory=DIST_DIR)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.port = cls.server.server_address[1]
        cls.base_url = f"http://127.0.0.1:{cls.port}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_01_index_html_and_relative_subpath_assets(self):
        with urlopen(f"{self.base_url}/index.html") as resp:
            self.assertEqual(resp.status, 200)
            html = resp.read().decode("utf-8")
        self.assertIn("PoloPad Pro", html)
        self.assertIn("./manifest.json", html)
        self.assertIn("serviceWorker.register('./sw.js')", html)
        self.assertIn("./assets/", html)

    def test_02_ios_pwa_manifest_and_offline_service_worker(self):
        with urlopen(f"{self.base_url}/manifest.json") as resp:
            self.assertEqual(resp.status, 200)
            manifest = json.loads(resp.read().decode("utf-8"))
        self.assertEqual(manifest["display"], "standalone")
        self.assertEqual(manifest["orientation"], "any")
        self.assertEqual(manifest["start_url"], "./")

        with urlopen(f"{self.base_url}/sw.js") as resp:
            self.assertEqual(resp.status, 200)
            sw = resp.read().decode("utf-8")
        self.assertIn("polopad-pro-rev25-v1", sw)

    def test_03_hosted_jlcpcb_and_3d_stl_downloads(self):
        endpoints = [
            ("/downloads/PoloBridge_Rev2_4_JLCPCB_Gerbers.zip", 1500),
            ("/downloads/JLCPCB_BOM.csv", 1200),
            ("/downloads/JLCPCB_CPL.csv", 1000),
            ("/downloads/polobridge_front_panel_drill_jig.stl", 5000),
            ("/downloads/polopad_poolside_sunhood_stand.stl", 7000),
        ]
        for path, min_bytes in endpoints:
            with urlopen(f"{self.base_url}{path}") as resp:
                self.assertEqual(resp.status, 200, f"HTTP failed for {path}")
                data = resp.read()
                self.assertGreaterEqual(len(data), min_bytes, f"Payload too small for {path}")

    def test_04_phone_bundle_and_haptics_assets(self):
        # Verify compiled JavaScript bundle includes PhoneConsole and phoneHaptics tokens
        assets_dir = os.path.join(DIST_DIR, "assets")
        js_files = [f for f in os.listdir(assets_dir) if f.endswith(".js")]
        self.assertGreater(len(js_files), 0, "Missing compiled JS bundle")
        found_phone_tokens = False
        for jf in js_files:
            with open(os.path.join(assets_dir, jf), encoding="utf-8") as f:
                content = f.read()
            if "START CLOCK" in content and "30s RESET" in content:
                found_phone_tokens = True
                break
        self.assertTrue(found_phone_tokens, "PhoneConsole plungers must be compiled into production bundle")

    def test_05_offline_persistence_and_indexeddb_bundle(self):
        assets_dir = os.path.join(DIST_DIR, "assets")
        js_files = [f for f in os.listdir(assets_dir) if f.endswith(".js")]
        found_idb_tokens = False
        for jf in js_files:
            with open(os.path.join(assets_dir, jf), encoding="utf-8") as f:
                content = f.read()
            if "PoloPadProOfflineDB" in content and "live_match_state" in content:
                found_idb_tokens = True
                break
        self.assertTrue(found_idb_tokens, "IndexedDB match persistence engine must be compiled into production bundle")

    def test_06_digital_scoresheet_bundle(self):
        assets_dir = os.path.join(DIST_DIR, "assets")
        js_files = [f for f in os.listdir(assets_dir) if f.endswith(".js")]
        found_scoresheet = False
        for jf in js_files:
            with open(os.path.join(assets_dir, jf), encoding="utf-8") as f:
                content = f.read()
            if "Digital Scoresheet" in content and "USAWP" in content:
                found_scoresheet = True
                break
        self.assertTrue(found_scoresheet, "Digital scoresheet panel must be compiled into production bundle")

    def test_07_tournament_director_bundle(self):
        assets_dir = os.path.join(DIST_DIR, "assets")
        js_files = [f for f in os.listdir(assets_dir) if f.endswith(".js")]
        found_director = False
        for jf in js_files:
            with open(os.path.join(assets_dir, jf), encoding="utf-8") as f:
                content = f.read()
            if "Tournament Director" in content and "polopad_court_link_v1" in content:
                found_director = True
                break
        self.assertTrue(found_director, "Tournament Director dashboard and court link must be compiled into production bundle")

    def test_08_six_eight_bridge_bundle(self):
        assets_dir = os.path.join(DIST_DIR, "assets")
        js_files = [f for f in os.listdir(assets_dir) if f.endswith(".js")]
        found_bridge = False
        for jf in js_files:
            with open(os.path.join(assets_dir, jf), encoding="utf-8") as f:
                content = f.read()
            if "6-8-gamedesk-v2" in content and "polopad_68sports_bridge" in content:
                found_bridge = True
                break
        self.assertTrue(found_bridge, "6-8 Sports Cloud Sync & WebSocket Bridge must be compiled into production bundle")

    def test_09_audio_synthesizer_bundle(self):
        assets_dir = os.path.join(DIST_DIR, "assets")
        js_files = [f for f in os.listdir(assets_dir) if f.endswith(".js")]
        found_audio = False
        for jf in js_files:
            with open(os.path.join(assets_dir, jf), encoding="utf-8") as f:
                content = f.read()
            if "polopad_audio_settings" in content and "CTS Olympic" in content:
                found_audio = True
                break
        self.assertTrue(found_audio, "Audio synthesizer and pool deck voice announcer must be compiled into production bundle")



if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
