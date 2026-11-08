import 'package:flutter/foundation.dart';

/// Centralized ValueKey identifiers for UI interaction and integration testing.
/// Matches acceptance criteria and test automation drivers.
class WidgetKeys {
  WidgetKeys._();

  static const ValueKey<String> startStopButton = ValueKey('start_stop_button');
  static const ValueKey<String> reset30Button = ValueKey('reset_30_button');
  static const ValueKey<String> reset20Button = ValueKey('reset_20_button');
  static const ValueKey<String> undoButton = ValueKey('undo_button');

  static const ValueKey<String> whiteScorePlus = ValueKey('white_score_plus');
  static const ValueKey<String> whiteScoreMinus = ValueKey('white_score_minus');
  static const ValueKey<String> darkScorePlus = ValueKey('dark_score_plus');
  static const ValueKey<String> darkScoreMinus = ValueKey('dark_score_minus');

  static const ValueKey<String> gameClockDisplay = ValueKey('game_clock_display');
  static const ValueKey<String> shotClockDisplay = ValueKey('shot_clock_display');

  static const ValueKey<String> whiteEjectButton = ValueKey('white_eject_button');
  static const ValueKey<String> darkEjectButton = ValueKey('dark_eject_button');

  static const ValueKey<String> hornButton = ValueKey('horn_button');
  static const ValueKey<String> shotMinusButton = ValueKey('shot_minus_button');
  static const ValueKey<String> shotPlusButton = ValueKey('shot_plus_button');
  static const ValueKey<String> gameReset800Button = ValueKey('game_reset_800_button');

  static const ValueKey<String> periodSelector = ValueKey('period_selector');
  static const ValueKey<String> ruleWpBadge = ValueKey('rule_wp_badge');
  static const ValueKey<String> matchPresetDropdown = ValueKey('match_preset_dropdown');
  static const ValueKey<String> protocolToggle = ValueKey('protocol_toggle');

  /// Dynamic key generator for exclusion early release buttons
  static ValueKey<String> exclusionRelButton(String id) => ValueKey('exclusion_rel_button_$id');

  /// Dynamic key generator for cap picker modal buttons
  static ValueKey<String> capPickerButton(int cap) => ValueKey('cap_picker_button_$cap');
}
