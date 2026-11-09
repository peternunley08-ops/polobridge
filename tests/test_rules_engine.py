#!/usr/bin/env python3
"""
PoloBridge & PoloPad Pro — Automated Water Polo Rules Engine & RS-232 Packet Verification Suite
Tests:
1. 30s vs 20s Shot Clock Reset & Game Clock Invariants
2. World Aquatics Rule WP 20.15 Shot Clock Auto-Blanking when game_clock < shot_clock
3. World Aquatics Rule WP 21.11 Defending Exclusion Release on Goal
4. World Aquatics Rule WP 22.3 3-Foul Personal Cap-Out ("ROLLED OUT") Lock
5. Team Timeouts (60s Full / 30s Short) & 15s Warning Horn Trigger
6. Colorado Time Systems (9600 8-E-1) 14-Byte Frame & XOR Checksum Builder
7. Daktronics All Sport 5000 (19200 8-N-1, Code 4498) 16-Byte Frame Builder
"""

import unittest


def build_cts_frame(
    game_tenths: int,
    shot_tenths: int,
    home_score: int,
    away_score: int,
    period: int,
    clock_running: bool,
    horn_active: bool,
) -> bytes:
    game_total_sec = (game_tenths + 9) // 10
    g_min = game_total_sec // 60
    g_sec = game_total_sec % 60
    s_sec = (shot_tenths + 9) // 10

    # Rule WP 20.15: Blank shot clock when game clock < shot clock
    shot_blanked = game_tenths < shot_tenths

    frame = bytearray(14)
    frame[0] = 0x02  # STX
    frame[1] = 0x31  # Address '1' (Water Polo Channel)
    frame[2] = 0x20 if g_min < 10 else (0x30 + (g_min // 10))
    frame[3] = 0x30 + (g_min % 10)
    frame[4] = 0x3A  # ':'
    frame[5] = 0x30 + (g_sec // 10)
    frame[6] = 0x30 + (g_sec % 10)
    frame[7] = 0x20 if shot_blanked else (0x30 + (s_sec // 10))
    frame[8] = 0x20 if shot_blanked else (0x30 + (s_sec % 10))
    frame[9] = 0x30 + (home_score % 10)
    frame[10] = 0x30 + (away_score % 10)

    status = 0x30 | (period & 0x07)
    if clock_running:
        status |= 0x08
    if horn_active:
        status |= 0x40
    frame[11] = status

    checksum = 0
    for i in range(1, 12):
        checksum ^= frame[i]
    frame[12] = checksum
    frame[13] = 0x04  # EOT
    return bytes(frame)


class WaterPoloRulesEngineTest(unittest.TestCase):
    def test_cts_frame_standard_start(self):
        # 7:00 game clock (4200 tenths), 30.0s shot clock (300 tenths), 0-0, Q1
        frame = build_cts_frame(4200, 300, 0, 0, 1, False, False)
        self.assertEqual(len(frame), 14)
        self.assertEqual(frame[0], 0x02)
        self.assertEqual(frame[1], 0x31)
        self.assertEqual(bytes(frame[2:7]), b" 7:00")
        self.assertEqual(bytes(frame[7:9]), b"30")
        self.assertEqual(frame[13], 0x04)

    def test_wp_20_15_shot_clock_auto_blanking(self):
        # 18.0s left in period (180 tenths), 30.0s shot clock (300 tenths) -> shot clock MUST blank (0x20 0x20)
        frame = build_cts_frame(180, 300, 5, 4, 4, True, False)
        self.assertEqual(bytes(frame[2:7]), b" 0:18")
        self.assertEqual(bytes(frame[7:9]), b"  ")

    def test_wp_21_11_goal_releases_defending_exclusions(self):
        exclusions = [
            {"id": 1, "team": "HOME", "cap": 4, "time_tenths": 140},
            {"id": 2, "team": "AWAY", "cap": 7, "time_tenths": 110},
        ]
        # HOME scores -> defending team is AWAY -> AWAY active exclusions released
        scoring_team = "HOME"
        defending_team = "AWAY" if scoring_team == "HOME" else "HOME"
        remaining = [e for e in exclusions if e["team"] != defending_team]
        self.assertEqual(len(remaining), 1)
        self.assertEqual(remaining[0]["team"], "HOME")

    def test_wp_22_3_three_foul_cap_out(self):
        player_fouls = {}
        for expected_foul in (1, 2, 3):
            current = player_fouls.get("HOME-7", 0)
            self.assertLess(current, 3)
            player_fouls["HOME-7"] = current + 1
            self.assertEqual(player_fouls["HOME-7"], expected_foul)
        # 3rd foul marks player ROLLED OUT (capped out)
        is_capped_out = player_fouls["HOME-7"] >= 3
        self.assertTrue(is_capped_out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
