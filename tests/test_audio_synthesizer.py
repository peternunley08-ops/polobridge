#!/usr/bin/env python3
"""
PoloBridge & PoloPad Pro — Audio Synthesizer & Pool Deck Voice Announcer Test Suite

Verifies:
1. AudioSynthesizerManager architecture, singleton export, and settings schema
2. Acoustic frequency parameters for CTS (220/440 Hz), Daktronics (110/220/330 Hz), European, and Fox-40 whistle
3. Speech announcer formatting and priority callout functions
4. AudioAnnouncerPanel aquatic UI compliance (no pitch-black)
5. Production bundle contains audio synthesizer tokens
"""

import os
import re
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ENGINE_FILE = os.path.join(REPO_ROOT, "react_app", "src", "engine", "audio-synthesizer.ts")
PANEL_FILE = os.path.join(REPO_ROOT, "react_app", "src", "components", "audio-announcer-panel.tsx")
APP_FILE = os.path.join(REPO_ROOT, "react_app", "src", "App.tsx")
DIST_ASSETS_DIR = os.path.join(REPO_ROOT, "react_app", "dist", "assets")


class TestAudioSynthesizerSuite(unittest.TestCase):

    def test_01_audio_synthesizer_manager_architecture_and_exports(self):
        """Verify AudioSynthesizerManager, audioSynthesizer singleton, and settings schema."""
        self.assertTrue(os.path.exists(ENGINE_FILE), f"Missing engine file: {ENGINE_FILE}")
        with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            code = f.read()

        self.assertIn("export class AudioSynthesizerManager", code)
        self.assertIn("export const audioSynthesizer", code)
        self.assertIn("export const DEFAULT_AUDIO_SETTINGS", code)
        self.assertIn("polopad_audio_settings", code)
        self.assertIn("masterVolume", code)
        self.assertIn("voiceAnnouncerEnabled", code)

    def test_02_frequency_and_oscillator_parameters(self):
        """Verify exact acoustic frequency parameters for CTS, Daktronics, European, and Fox-40 whistle."""
        with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            code = f.read()

        # CTS Olympic dual-tone (220 Hz fundamental + 440 Hz octave harmonic)
        self.assertIn("220", code, "CTS must use 220 Hz fundamental frequency")
        self.assertIn("440", code, "CTS must use 440 Hz octave harmonic")

        # Daktronics industrial buzzer (110, 220, 330 Hz stack)
        self.assertIn("110", code, "Daktronics must include 110 Hz sub-harmonic")
        self.assertIn("330", code, "Daktronics must include 330 Hz stack")

        # European LEN Foghorn (185 Hz + 277 Hz minor third)
        self.assertIn("185", code, "European foghorn must include 185 Hz")
        self.assertIn("277", code, "European foghorn must include 277 Hz")

        # Fox-40 Referee Whistle (2800 Hz + 3120 Hz beating pair)
        self.assertIn("2800", code, "Whistle must use ~2800 Hz")
        self.assertIn("3120", code, "Whistle must use ~3120 Hz beating frequency")

    def test_03_speech_announcements_and_callout_formatting(self):
        """Verify pre-engineered water polo speech callouts for goals, exclusions, timeouts, and cap-outs."""
        with open(ENGINE_FILE, "r", encoding="utf-8") as f:
            code = f.read()

        self.assertIn("announceGoal", code)
        self.assertIn("announceExclusion", code)
        self.assertIn("announceTimeout", code)
        self.assertIn("announceTimeoutWarning", code)
        self.assertIn("announceShotClockViolation", code)
        self.assertIn("announcePeriodEnd", code)
        self.assertIn("announceCapOut", code)
        self.assertIn("SpeechSynthesisUtterance", code)

    def test_04_audio_announcer_panel_aquatic_compliance(self):
        """Verify audio-announcer-panel.tsx uses Sunlit Olympic Pool aquatic palette and no pitch-black."""
        self.assertTrue(os.path.exists(PANEL_FILE), f"Missing panel file: {PANEL_FILE}")
        with open(PANEL_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        # Check for aquatic palette
        self.assertIn("from-sky-900 via-blue-900 to-indigo-950", content)
        self.assertIn("border-cyan-400", content)

        # Prohibit pitch-black backgrounds
        pitch_black_patterns = ["#06080d", "#040508", "bg-black"]
        for p in pitch_black_patterns:
            self.assertNotIn(p, content, f"Pitch black pattern '{p}' found in {PANEL_FILE}")

        # Check controls
        self.assertIn("CTS Olympic Horn", content)
        self.assertIn("Daktronics Buzzer", content)
        self.assertIn("European Foghorn", content)
        self.assertIn("Fox-40 Whistle", content)

    def test_05_production_bundle_contains_audio_tokens(self):
        """Verify audio synthesizer tokens are compiled into production dist bundle."""
        self.assertTrue(os.path.exists(DIST_ASSETS_DIR), f"Dist assets dir missing: {DIST_ASSETS_DIR}")
        js_files = [f for f in os.listdir(DIST_ASSETS_DIR) if f.endswith(".js")]
        self.assertGreater(len(js_files), 0, "No compiled JS bundle found in dist/assets")

        found_audio_tokens = False
        for jf in js_files:
            filepath = os.path.join(DIST_ASSETS_DIR, jf)
            with open(filepath, "r", encoding="utf-8") as f:
                code = f.read()
            if "polopad_audio_settings" in code and "CTS Olympic" in code:
                found_audio_tokens = True
                break

        self.assertTrue(
            found_audio_tokens,
            "Production JS bundle must contain 'polopad_audio_settings' and 'CTS Olympic'"
        )


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
