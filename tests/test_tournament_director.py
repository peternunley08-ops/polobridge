#!/usr/bin/env python3
"""
PoloPad Pro — Tournament Director Dashboard & Court Link Verification Suite
============================================================================
This file only checks that the pieces are present and wired together: the
court-link engine, transports and session modules exist with their key
contracts, the Tournament Director dashboard UI is mounted in the app, the
aquatic palette guardrails hold, the Cloudflare relay worker is declared, and
the production bundle contains the dashboard.

It does NOT test runtime behaviour. Behaviour is tested by:
  - the TypeScript suite:   cd react_app && npm test
  - the relay suite:        cd cloudflare/court-relay && npm test
  - the browser suite:      node tests/e2e/director-dashboard.e2e.cjs
"""

import json
import os
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DIST_DIR = os.path.join(REPO_ROOT, "react_app", "dist")
ENGINE_DIR = os.path.join(REPO_ROOT, "react_app", "src", "engine")
COMPONENTS_DIR = os.path.join(REPO_ROOT, "react_app", "src", "components")

COURT_LINK = os.path.join(ENGINE_DIR, "court-link.ts")
COURT_LINK_TRANSPORTS = os.path.join(ENGINE_DIR, "court-link-transports.ts")
COURT_LINK_SESSION = os.path.join(ENGINE_DIR, "court-link-session.ts")
COURT_SIMULATOR = os.path.join(ENGINE_DIR, "court-simulator.ts")
DIRECTOR_HUB = os.path.join(COMPONENTS_DIR, "tournament-director-hub.tsx")
COURT_SUMMARY_LIST = os.path.join(COMPONENTS_DIR, "court-summary-list.tsx")
USE_COURT_LINK = os.path.join(COMPONENTS_DIR, "use-court-link.ts")
TOURNAMENT_HUB_PANEL = os.path.join(COMPONENTS_DIR, "tournament-hub-panel.tsx")
APP_TSX = os.path.join(REPO_ROOT, "react_app", "src", "App.tsx")
PACKAGE_JSON = os.path.join(REPO_ROOT, "react_app", "package.json")
RELAY_INDEX = os.path.join(REPO_ROOT, "cloudflare", "court-relay", "src", "index.ts")
RELAY_WRANGLER = os.path.join(REPO_ROOT, "cloudflare", "court-relay", "wrangler.toml")


class TestTournamentDirectorDashboard(unittest.TestCase):
    def test_01_court_link_engine(self):
        with open(COURT_LINK, encoding="utf-8") as f:
            code = f.read()

        self.assertIn("COURT_LINK_PROTOCOL_VERSION = 1", code, "court-link.ts must declare protocol version 1")
        self.assertIn("export function projectSnapshot", code, "court-link.ts must export projectSnapshot")
        self.assertIn("export class CourtDirectory", code, "court-link.ts must export CourtDirectory")
        self.assertIn("export class CourtPublisher", code, "court-link.ts must export CourtPublisher")
        self.assertIn("export class ClockOffsetFilter", code, "court-link.ts must export ClockOffsetFilter")
        self.assertIn("HEARTBEAT_INTERVAL_MS = 1000", code, "Heartbeat interval must be 1000 ms")
        self.assertIn("STALE_AFTER_MS = 8000", code, "Stale-court threshold must be 8000 ms")

    def test_02_rules_invariants_in_engine(self):
        with open(COURT_LINK, encoding="utf-8") as f:
            link_code = f.read()
        with open(COURT_SIMULATOR, encoding="utf-8") as f:
            sim_code = f.read()

        # WP 20.15 auto-blanking uses an inclusive comparison
        self.assertIn("return gameTimeMs <= shotTimeMs;", link_code, "WP 20.15 comparison must use <=")
        # WP 22.3 personal foul limit
        self.assertIn("PERSONAL_FOUL_LIMIT = 3", link_code, "WP 22.3 personal foul limit must be 3")

        self.assertIn("export class CourtSimulator", sim_code, "court-simulator.ts must export CourtSimulator")
        self.assertIn("Rule WP 21", sim_code, "Simulator must reference Rule WP 21")
        self.assertIn("NFHS", sim_code, "Simulator must reference NFHS rules")

    def test_03_transports_and_session(self):
        with open(COURT_LINK_TRANSPORTS, encoding="utf-8") as f:
            transports = f.read()
        with open(COURT_LINK_SESSION, encoding="utf-8") as f:
            session = f.read()

        self.assertIn("RELAY_BACKOFF_BASE_MS = 500", transports, "Relay backoff base must be 500 ms")
        self.assertIn("RELAY_BACKOFF_CAP_MS = 8000", transports, "Relay backoff cap must be 8000 ms")
        self.assertIn("polopad_court_link_v1", transports, "Transport must use polopad_court_link_v1 protocol tag")
        self.assertIn("polopad_pro_court_link_v1", transports, "Transport must use polopad_pro_court_link_v1 protocol tag")
        self.assertIn("export function normalizeRelayUrl", transports, "transports must export normalizeRelayUrl")
        self.assertIn("export function parseInviteHash", transports, "transports must export parseInviteHash")

        self.assertIn("export class CourtLinkSession", session, "court-link-session.ts must export CourtLinkSession")
        self.assertIn("polopad-court-desk:", session, "Session must use the polopad-court-desk: prefix")
        self.assertIn("DEMO_ROOM", session, "Session must define DEMO_ROOM")

    def test_04_director_dashboard_ui(self):
        with open(DIRECTOR_HUB, encoding="utf-8") as f:
            ui = f.read()

        self.assertIn("Tournament Director — 4-Court Live Dashboard", ui, "Dashboard title is missing")
        self.assertIn("DEMO DATA", ui, "Dashboard must label demo data")
        self.assertIn("window.print()", ui, "Dashboard must offer window.print() output")
        self.assertIn("@page { size: landscape;", ui, "Dashboard print CSS must set landscape page size")
        self.assertIn("WP 20.15", ui, "Dashboard must reference WP 20.15")
        self.assertIn("CAP-OUT", ui, "Dashboard must show CAP-OUT status")
        self.assertIn('data-testid="court-grid"', ui, "Dashboard must expose the court-grid test id")
        self.assertIn("phoneHaptics.trigger", ui, "Dashboard must trigger phone haptics")

    def test_05_aquatic_palette_no_pitch_black(self):
        files = [
            COURT_LINK,
            COURT_LINK_TRANSPORTS,
            COURT_LINK_SESSION,
            COURT_SIMULATOR,
            DIRECTOR_HUB,
            COURT_SUMMARY_LIST,
            USE_COURT_LINK,
            TOURNAMENT_HUB_PANEL,
        ]
        forbidden = ["#06080d", "#040508", "#000000", "bg-black"]
        for path in files:
            with open(path, encoding="utf-8") as f:
                text = f.read().lower()
            name = os.path.basename(path)
            for token in forbidden:
                self.assertNotIn(
                    token,
                    text,
                    f"{name} contains pitch-black token {token!r}; use the aquatic palette instead",
                )

    def test_06_app_integration(self):
        with open(APP_TSX, encoding="utf-8") as f:
            app = f.read()
        with open(TOURNAMENT_HUB_PANEL, encoding="utf-8") as f:
            panel = f.read()

        self.assertIn(
            "import TournamentDirectorHub from './components/tournament-director-hub';",
            app,
            "App.tsx must import TournamentDirectorHub",
        )
        self.assertIn("courtLinkSession.publishDeskState", app, "App.tsx must publish desk state via courtLinkSession")
        self.assertIn("'director'", app, "App.tsx must include the 'director' view")
        self.assertIn("<TournamentDirectorHub", app, "App.tsx must render <TournamentDirectorHub")
        self.assertIn("parseInviteHash(window.location.hash)", app, "App.tsx must parse the invite hash")

        self.assertIn("CourtSummaryList", panel, "tournament-hub-panel.tsx must use CourtSummaryList")
        self.assertNotIn(
            "INITIAL_GAMES",
            panel,
            "tournament-hub-panel.tsx must not contain the removed hard-coded INITIAL_GAMES sample data",
        )

    def test_07_typescript_test_suite_is_wired(self):
        for rel in [
            "react_app/tests/court-link.test.ts",
            "react_app/tests/court-link-transports.test.ts",
            "react_app/tests/court-link-session.test.ts",
            "react_app/tests/court-simulator.test.ts",
            "react_app/scripts/run-tests.mjs",
        ]:
            path = os.path.join(REPO_ROOT, *rel.split("/"))
            self.assertTrue(os.path.exists(path), f"Missing TypeScript test file: {rel}")

        with open(PACKAGE_JSON, encoding="utf-8") as f:
            pkg = json.load(f)
        self.assertEqual(
            pkg["scripts"]["test"],
            "node scripts/run-tests.mjs",
            "react_app package.json 'test' script must run scripts/run-tests.mjs",
        )

    def test_08_court_relay_worker(self):
        with open(RELAY_INDEX, encoding="utf-8") as f:
            worker = f.read()
        with open(RELAY_WRANGLER, encoding="utf-8") as f:
            wrangler = f.read()

        self.assertIn("export class CourtRoom", worker, "Relay worker must export the CourtRoom Durable Object")
        self.assertIn("MAX_SOCKETS_PER_ROOM = 24", worker, "Relay must cap sockets per room at 24")
        self.assertIn("setWebSocketAutoResponse", worker, "Relay must use setWebSocketAutoResponse")
        self.assertIn(
            'new_sqlite_classes = ["CourtRoom"]',
            wrangler,
            "wrangler.toml must declare CourtRoom as a SQLite-backed Durable Object class",
        )

    def test_09_production_bundle_contains_director_dashboard(self):
        assets_dir = os.path.join(DIST_DIR, "assets")
        self.assertTrue(os.path.exists(assets_dir), "Missing compiled assets directory")
        js_files = [f for f in os.listdir(assets_dir) if f.endswith(".js")]
        self.assertGreater(len(js_files), 0, "No compiled JS bundle found")

        found_director = False
        for jf in js_files:
            with open(os.path.join(assets_dir, jf), encoding="utf-8") as f:
                bundle = f.read()
            if "Tournament Director" in bundle and "polopad_court_link_v1" in bundle:
                found_director = True
                break

        self.assertTrue(
            found_director,
            "Tournament Director dashboard and court link must be compiled into production bundle",
        )


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
