import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import 'core/constants/colors.dart';
import 'core/theme/aquatic_theme.dart';
import 'domain/engine/timing_engine.dart';
import 'domain/models/exclusion.dart';
import 'domain/models/game_state.dart';
import 'domain/models/team.dart';
import 'domain/six_eight/models.dart';
import 'domain/six_eight/six_eight_manager.dart';
import 'infrastructure/ble/ble_dongle_service.dart';
import 'infrastructure/ble/mock_ble_service.dart';
import 'infrastructure/mock_data/tournament_presets.dart';
import 'main.dart';
import 'presentation/screens/adaptive_game_screen.dart';
import 'presentation/screens/mobile_stacked_layout.dart';
import 'presentation/screens/tablet_dual_thumb_layout.dart';
import 'presentation/widgets/exclusion_bay.dart';
import 'presentation/widgets/master_clock_card.dart';
import 'presentation/widgets/match_selector_sheet.dart';
import 'presentation/widgets/plunger_button.dart';
import 'presentation/widgets/shot_clock_card.dart';
import 'presentation/widgets/team_bay.dart';
import 'presentation/widgets/telemetry_sheet.dart';
import 'state/game_controller.dart';

// =============================================================================
// PREVIEW THEME INJECTION & ANNOTATION SCAFFOLDING (SKILL COMPLIANT)
// =============================================================================

/// Aquatic preview theme injector applying the official Sunlit Olympic Pool Aquatic Theme.
final class AquaticPreviewThemeData extends PreviewThemeData {
  const AquaticPreviewThemeData({this.brightness = Brightness.dark});

  final Brightness? brightness;

  @override
  Widget apply(BuildContext context, Widget child) {
    return Theme(
      data: AquaticTheme.themeData,
      child: child,
    );
  }
}

/// Constant theme builder callback for @Preview annotations.
PreviewThemeData aquaticThemeBuilder() => const AquaticPreviewThemeData();

/// Top-level environment wrapper providing MaterialApp, Aquatic theme,
/// canvas gradient background, and GameControllerScope.
Widget buildPreviewWrapper(
  Widget child, {
  GameController? controller,
  bool center = true,
  bool useSafeArea = true,
}) {
  final effectiveController = controller ?? standardRunningController();
  return MaterialApp(
    title: 'PoloPad Pro Preview',
    theme: AquaticTheme.themeData,
    debugShowCheckedModeBanner: false,
    home: Scaffold(
      backgroundColor: AquaticColors.canvasSky900,
      body: Container(
        decoration: AquaticTheme.backgroundDecoration,
        child: GameControllerScope(
          controller: effectiveController,
          child: useSafeArea
              ? SafeArea(child: center ? Center(child: child) : child)
              : (center ? Center(child: child) : child),
        ),
      ),
    ),
  );
}

/// Alias for buildPreviewWrapper to support existing blueprints.
Widget buildPreviewEnvironment({
  required GameController controller,
  required Widget child,
  bool center = true,
  bool useSafeArea = true,
}) =>
    buildPreviewWrapper(
      child,
      controller: controller,
      center: center,
      useSafeArea: useSafeArea,
    );

// =============================================================================
// DETERMINISTIC MOCK CONTROLLER FACTORIES
// =============================================================================

/// Creates an isolated mock GameController with deterministic state and zero background timers.
GameController _createMockController({
  GameState? gameState,
  TournamentMatch? match,
  ScoreboardProtocol protocol = ScoreboardProtocol.cts,
}) {
  final engine = TimingEngine(
    initialState: gameState ?? GameState.initial(),
    autoTick: false,
  );
  final sixEight = SixEightManager(
    initialMatch: match ?? TournamentPresets.match68JO,
  );
  final ble = MockBleService(autoConnect: false);
  if (protocol != ScoreboardProtocol.cts) {
    ble.setProtocol(protocol);
  }
  return GameController(
    engine: engine,
    sixEight: sixEight,
    ble: ble,
  );
}

/// Helper mock controller factory with autoTick: false and autoConnect: false.
GameController createPreviewController({
  bool running = false,
  int gameTimeMs = 8 * 60 * 1000,
  int shotTimeMs = 30 * 1000,
  int whiteScore = 0,
  int darkScore = 0,
  int period = 1,
  List<Exclusion> exclusions = const [],
  bool isHornActive = false,
  TournamentMatch? match,
  ScoreboardProtocol protocol = ScoreboardProtocol.cts,
}) {
  final state = GameState(
    gameTimeMs: gameTimeMs,
    shotTimeMs: shotTimeMs,
    isRunning: running,
    scoreWhite: whiteScore,
    scoreDark: darkScore,
    period: period,
    exclusions: exclusions,
    isHornActive: isHornActive,
  );
  return _createMockController(
    gameState: state,
    match: match,
    protocol: protocol,
  );
}

/// Standard active game state: Q2, 7:42.3 master clock, 24s shot clock, Vanguard 5 - 4 Stanford.
GameController standardRunningController() {
  return createPreviewController(
    running: true,
    gameTimeMs: 7 * 60 * 1000 + 42 * 1000 + 300, // 07:42.3
    shotTimeMs: 24 * 1000,                       // 24s
    whiteScore: 5,
    darkScore: 4,
    period: 2,
    match: TournamentPresets.match68JO,
  );
}

/// Overtime active game state: Period 5 (OT), 03:00.0 master clock, 30s shot clock.
GameController overtimeRunningController() {
  return createPreviewController(
    running: true,
    gameTimeMs: 3 * 60 * 1000, // 03:00.0
    shotTimeMs: 30 * 1000,     // 30s
    whiteScore: 11,
    darkScore: 11,
    period: 5,
    match: TournamentPresets.match68JO,
  );
}

/// Shot clock warning state: Q3, 4:18.5 master clock, 8.4s amber shot clock (< 10s).
GameController shotClockWarningController() {
  return createPreviewController(
    running: true,
    gameTimeMs: 4 * 60 * 1000 + 18 * 1000 + 500, // 04:18.5
    shotTimeMs: 8 * 1000 + 400,                  // 8.4s
    whiteScore: 7,
    darkScore: 6,
    period: 3,
    match: TournamentPresets.match68JO,
  );
}

/// Shot clock critical state: Q4, 2:12.1 master clock, 3.8s red shot clock (< 5s).
GameController shotClockCriticalController() {
  return createPreviewController(
    running: true,
    gameTimeMs: 2 * 60 * 1000 + 12 * 1000 + 100, // 02:12.1
    shotTimeMs: 3 * 1000 + 800,                  // 3.8s
    whiteScore: 8,
    darkScore: 8,
    period: 4,
    match: TournamentPresets.match68JO,
  );
}

/// World Aquatics Rule WP 20.15 Auto-Blanked state:
/// Game clock remaining (14.2s) <= Shot clock remaining (20.0s).
/// Shot clock display is automatically blanked to '--'.
GameController wp2015BlankedController() {
  return createPreviewController(
    running: true,
    gameTimeMs: 14 * 1000 + 200, // 00:14.2 remaining
    shotTimeMs: 20 * 1000,       // 20s shot clock reset
    whiteScore: 9,
    darkScore: 10,
    period: 4,
    match: TournamentPresets.match68JO,
  );
}

/// Active exclusions controller: multiple players excluded on both White and Dark teams.
GameController multipleExclusionsController() {
  return createPreviewController(
    running: true,
    gameTimeMs: 5 * 60 * 1000 + 10 * 1000,
    shotTimeMs: 18 * 1000,
    whiteScore: 6,
    darkScore: 5,
    period: 2,
    exclusions: const [
      Exclusion(
        id: 'exc_white_4',
        team: Team.white,
        capNumber: 4,
        remainingMs: 14200, // 15s display
      ),
      Exclusion(
        id: 'exc_white_9',
        team: Team.white,
        capNumber: 9,
        remainingMs: 18500, // 19s display
      ),
      Exclusion(
        id: 'exc_dark_7',
        team: Team.dark,
        capNumber: 7,
        remainingMs: 8900,  // 9s display
      ),
    ],
    match: TournamentPresets.match68JO,
  );
}

// =============================================================================
// GROUP: LAYOUTS & SCREENS
// =============================================================================

/// 3-Column Ergonomic Dual-Thumb Tablet Layout (1024x768).
@Preview(
  name: 'Tablet Dual-Thumb Layout (1024x768)',
  group: 'Layouts',
  size: Size(1024, 768),
)
Widget tabletDualThumbLayoutPreview() {
  final controller = standardRunningController();
  return buildPreviewWrapper(
    TabletDualThumbLayout(controller: controller),
    controller: controller,
    center: false,
  );
}

/// Compact Mobile Stacked Layout (375x812).
@Preview(
  name: 'Mobile Stacked Layout (375x812)',
  group: 'Layouts',
  size: Size(375, 812),
)
Widget mobileStackedLayoutPreview() {
  final controller = standardRunningController();
  return buildPreviewWrapper(
    MobileStackedLayout(controller: controller),
    controller: controller,
    center: false,
  );
}

/// Ultra-Compact Mobile Stacked Layout (320x568).
@Preview(
  name: 'Mobile Compact Stacked Layout (320x568)',
  group: 'Layouts',
  size: Size(320, 568),
)
Widget mobileCompactStackedLayoutPreview() {
  final controller = standardRunningController();
  return buildPreviewWrapper(
    MobileStackedLayout(controller: controller),
    controller: controller,
    center: false,
  );
}

/// Adaptive Game Screen on Tablet Viewport (1024x768).
@Preview(
  name: 'Adaptive Game Screen - Tablet',
  group: 'Screens',
  size: Size(1024, 768),
)
Widget adaptiveGameScreenTabletPreview() {
  final controller = standardRunningController();
  return buildPreviewWrapper(
    AdaptiveGameScreen(controller: controller),
    controller: controller,
    center: false,
    useSafeArea: false,
  );
}

/// Adaptive Game Screen on Mobile Viewport (375x812).
@Preview(
  name: 'Adaptive Game Screen - Mobile',
  group: 'Screens',
  size: Size(375, 812),
)
Widget adaptiveGameScreenMobilePreview() {
  final controller = standardRunningController();
  return buildPreviewWrapper(
    AdaptiveGameScreen(controller: controller),
    controller: controller,
    center: false,
    useSafeArea: false,
  );
}

// =============================================================================
// GROUP: TACTILE 3D PLUNGER BUTTONS
// =============================================================================

/// Giant Left-Thumb Start Plunger (Idle / Ready state).
@Preview(
  name: 'Plunger Button - Start (Idle)',
  group: 'Plungers',
  size: Size(180, 220),
)
Widget plungerStartIdlePreview() {
  return buildPreviewWrapper(
    SizedBox(
      width: 160,
      height: 200,
      child: PlungerButton.startStop(
        isRunning: false,
        onTap: () {},
      ),
    ),
  );
}

/// Start Plunger preview matching DISPATCH.md name.
@Preview(
  name: 'Start Plunger',
  group: 'Plungers',
  size: Size(180, 220),
)
Widget startPlungerPreview() => plungerStartIdlePreview();

/// Giant Left-Thumb Whistle Plunger (Running / Whistle state).
@Preview(
  name: 'Plunger Button - Whistle (Running)',
  group: 'Plungers',
  size: Size(180, 220),
)
Widget plungerWhistleRunningPreview() {
  return buildPreviewWrapper(
    SizedBox(
      width: 160,
      height: 200,
      child: PlungerButton.startStop(
        isRunning: true,
        onTap: () {},
      ),
    ),
  );
}

/// Whistle Plunger preview matching DISPATCH.md name.
@Preview(
  name: 'Whistle Plunger',
  group: 'Plungers',
  size: Size(180, 220),
)
Widget whistlePlungerPreview() => plungerWhistleRunningPreview();

/// Right-Thumb Reset 30 Plunger (Turnover).
@Preview(
  name: 'Plunger Button - Reset 30 (Turnover)',
  group: 'Plungers',
  size: Size(180, 160),
)
Widget plungerReset30Preview() {
  return buildPreviewWrapper(
    SizedBox(
      width: 160,
      height: 130,
      child: PlungerButton.reset30(
        onTap: () {},
      ),
    ),
  );
}

/// Reset 30 Plunger preview matching DISPATCH.md name.
@Preview(
  name: 'Reset 30 Plunger',
  group: 'Plungers',
  size: Size(180, 160),
)
Widget reset30PlungerPreview() => plungerReset30Preview();

/// Right-Thumb Reset 20 Plunger (Rebound / Foul).
@Preview(
  name: 'Plunger Button - Reset 20 (Rebound/Foul)',
  group: 'Plungers',
  size: Size(180, 160),
)
Widget plungerReset20Preview() {
  return buildPreviewWrapper(
    SizedBox(
      width: 160,
      height: 130,
      child: PlungerButton.reset20(
        onTap: () {},
      ),
    ),
  );
}

/// Reset 20 Plunger preview matching DISPATCH.md name.
@Preview(
  name: 'Reset 20 Plunger',
  group: 'Plungers',
  size: Size(180, 160),
)
Widget reset20PlungerPreview() => plungerReset20Preview();

/// Tactile 3D Undo Plunger Button.
@Preview(
  name: 'Undo Plunger',
  group: 'Plungers',
  size: Size(180, 160),
)
Widget undoPlungerPreview() {
  return buildPreviewWrapper(
    SizedBox(
      width: 160,
      height: 130,
      child: PlungerButton(
        onTap: () {},
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AquaticColors.undoPurple,
            Color(0xFF8B5CF6),
            Color(0xFF6D28D9),
          ],
        ),
        bevelColor: const Color(0xFF4C1D95),
        label: 'UNDO',
        subtitle: '1-CLICK RESTORE',
        icon: Icons.undo,
      ),
    ),
  );
}

/// Compact Mobile Plungers Row (Horizontal trio).
@Preview(
  name: 'Plungers - Compact Mobile Row',
  group: 'Plungers',
  size: Size(375, 100),
)
Widget plungerCompactRowPreview() {
  return buildPreviewWrapper(
    SizedBox(
      height: 75,
      child: Row(
        children: [
          Expanded(
            child: PlungerButton.startStop(
              isRunning: true,
              onTap: () {},
              isCompact: true,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: PlungerButton.reset30(
              onTap: () {},
              isCompact: true,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: PlungerButton.reset20(
              onTap: () {},
              isCompact: true,
            ),
          ),
        ],
      ),
    ),
  );
}

// =============================================================================
// GROUP: CLOCKS & RULE WP 20.15 STATES
// =============================================================================

/// Recessed Master Game Clock Card (MM:SS.d readout and controls).
@Preview(
  name: 'Master Game Clock Card (MM:SS.d)',
  group: 'Clocks',
  size: Size(340, 190),
)
Widget masterClockCardPreview() {
  final controller = standardRunningController();
  return buildPreviewWrapper(
    SizedBox(
      width: 320,
      child: MasterClockCard(controller: controller),
    ),
    controller: controller,
  );
}

/// Master Clock Normal preview matching DISPATCH.md name.
@Preview(
  name: 'Master Clock - Normal',
  group: 'Clocks',
  size: Size(340, 190),
)
Widget masterClockNormalPreview() => masterClockCardPreview();

/// Master Clock Overtime preview (Period 5 OT).
@Preview(
  name: 'Master Clock - Overtime',
  group: 'Clocks',
  size: Size(340, 190),
)
Widget masterClockOvertimePreview() {
  final controller = overtimeRunningController();
  return buildPreviewWrapper(
    SizedBox(
      width: 320,
      child: MasterClockCard(controller: controller),
    ),
    controller: controller,
  );
}

/// Shot Clock Normal State (>= 10s: Emerald Green display).
@Preview(
  name: 'Shot Clock - Normal (>=10s Emerald)',
  group: 'Clocks',
  size: Size(300, 220),
)
Widget shotClockNormalPreview() {
  final controller = standardRunningController();
  return buildPreviewWrapper(
    SizedBox(
      width: 260,
      child: ShotClockCard(controller: controller),
    ),
    controller: controller,
  );
}

/// Shot Clock 30s preview matching DISPATCH.md name.
@Preview(
  name: 'Shot Clock - 30s',
  group: 'Clocks',
  size: Size(300, 220),
)
Widget shotClock30sPreview() => shotClockNormalPreview();

/// Shot Clock 20s preview.
@Preview(
  name: 'Shot Clock - 20s',
  group: 'Clocks',
  size: Size(300, 220),
)
Widget shotClock20sPreview() {
  final controller = createPreviewController(
    running: true,
    gameTimeMs: 6 * 60 * 1000,
    shotTimeMs: 20 * 1000,
  );
  return buildPreviewWrapper(
    SizedBox(
      width: 260,
      child: ShotClockCard(controller: controller),
    ),
    controller: controller,
  );
}

/// Shot Clock Warning State (5.0s .. 9.9s: Amber display with tenths).
@Preview(
  name: 'Shot Clock - Warning (5s..9.9s Amber)',
  group: 'Clocks',
  size: Size(300, 220),
)
Widget shotClockWarningPreview() {
  final controller = shotClockWarningController();
  return buildPreviewWrapper(
    SizedBox(
      width: 260,
      child: ShotClockCard(controller: controller),
    ),
    controller: controller,
  );
}

/// Shot Clock Critical State (< 5.0s: Rose Red warning display with tenths).
@Preview(
  name: 'Shot Clock - Critical (<5s Rose)',
  group: 'Clocks',
  size: Size(300, 220),
)
Widget shotClockCriticalPreview() {
  final controller = shotClockCriticalController();
  return buildPreviewWrapper(
    SizedBox(
      width: 260,
      child: ShotClockCard(controller: controller),
    ),
    controller: controller,
  );
}

/// Shot Clock World Aquatics Rule WP 20.15 Auto-Blanked State ('--').
@Preview(
  name: 'Shot Clock - WP 20.15 Auto-Blanked (--)',
  group: 'Clocks',
  size: Size(300, 220),
)
Widget shotClockBlankedWp2015Preview() {
  final controller = wp2015BlankedController();
  return buildPreviewWrapper(
    SizedBox(
      width: 260,
      child: ShotClockCard(controller: controller),
    ),
    controller: controller,
  );
}

/// Shot Clock WP 20.15 Blanked matching DISPATCH.md name.
@Preview(
  name: 'Shot Clock WP 20.15 Blanked',
  group: 'Clocks',
  size: Size(300, 220),
)
Widget shotClockWP2015BlankedPreview() => shotClockBlankedWp2015Preview();

// =============================================================================
// GROUP: TEAM BAYS & EXCLUSION PENALTY TRACK
// =============================================================================

/// White Team Bay (Vanguard) with score, eject trigger, and penalty track.
@Preview(
  name: 'Team Bay - White (Vanguard)',
  group: 'Team Bays',
  size: Size(320, 520),
)
Widget teamBayWhitePreview() {
  final controller = multipleExclusionsController();
  return buildPreviewWrapper(
    SizedBox(
      width: 300,
      height: 480,
      child: TeamBay(team: Team.white, controller: controller),
    ),
    controller: controller,
  );
}

/// White Team Bay matching DISPATCH.md name and group 'Bays'.
@Preview(
  name: 'White Team Bay',
  group: 'Bays',
  size: Size(320, 520),
)
Widget whiteTeamBayPreview() => teamBayWhitePreview();

/// Dark Team Bay (Stanford) with score, eject trigger, and penalty track.
@Preview(
  name: 'Team Bay - Dark (Stanford)',
  group: 'Team Bays',
  size: Size(320, 520),
)
Widget teamBayDarkPreview() {
  final controller = multipleExclusionsController();
  return buildPreviewWrapper(
    SizedBox(
      width: 300,
      height: 480,
      child: TeamBay(team: Team.dark, controller: controller),
    ),
    controller: controller,
  );
}

/// Dark Team Bay matching DISPATCH.md name and group 'Bays'.
@Preview(
  name: 'Dark Team Bay',
  group: 'Bays',
  size: Size(320, 520),
)
Widget darkTeamBayPreview() => teamBayDarkPreview();

/// Active 20-second Exclusion Bay with early release (REL) buttons.
@Preview(
  name: 'Exclusion Bay - Penalties & Early Release',
  group: 'Team Bays',
  size: Size(280, 160),
)
Widget exclusionBayPreview() {
  final controller = multipleExclusionsController();
  return buildPreviewWrapper(
    SizedBox(
      width: 260,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: AquaticTheme.glassCardDecoration(),
        child: ExclusionBay(team: Team.white, controller: controller),
      ),
    ),
    controller: controller,
  );
}

/// Multi Exclusion Bay matching DISPATCH.md name and group 'Bays'.
@Preview(
  name: 'Multi Exclusion Bay',
  group: 'Bays',
  size: Size(280, 160),
)
Widget multiExclusionBayPreview() => exclusionBayPreview();

// =============================================================================
// GROUP: MATCH SELECTOR & TELEMETRY FEEDS
// =============================================================================

/// Match Selector Header Bar with protocol toggle (CTS vs DAKT) and presets.
@Preview(
  name: 'Match Selector Bar & Preset Switcher',
  group: 'Sheets',
  size: Size(500, 60),
)
Widget matchSelectorSheetPreview() {
  final controller = standardRunningController();
  return buildPreviewWrapper(
    SizedBox(
      width: 480,
      child: MatchSelectorSheet(controller: controller),
    ),
    controller: controller,
  );
}

/// Live Play-by-Play Telemetry Log Sheet.
@Preview(
  name: 'Telemetry Sheet - Live Event Feed',
  group: 'Sheets & Navigation',
  size: Size(450, 500),
)
Widget telemetrySheetPreview() {
  final controller = standardRunningController();
  controller.sixEight.logEvent(
    const TelemetryEvent(
      id: 'preview_ev_1',
      period: 1,
      gameClock: '08:00.0',
      shotClock: '30',
      type: TelemetryEventType.matchStart,
      scoreSnapshot: 'Vanguard 0 - 0 Stanford',
      description: 'Match started: 68-JO-2026-412',
    ),
  );
  controller.sixEight.logEvent(
    const TelemetryEvent(
      id: 'preview_ev_2',
      period: 1,
      gameClock: '07:15.2',
      shotClock: '12',
      type: TelemetryEventType.goal,
      team: Team.white,
      capNumber: 7,
      scoreSnapshot: 'Vanguard 1 - 0 Stanford',
      description: 'GOAL by Vanguard #7 Ryder Dodd',
    ),
  );
  controller.sixEight.logEvent(
    const TelemetryEvent(
      id: 'preview_ev_3',
      period: 1,
      gameClock: '06:44.0',
      shotClock: '20',
      type: TelemetryEventType.exclusion,
      team: Team.dark,
      capNumber: 4,
      scoreSnapshot: 'Vanguard 1 - 0 Stanford',
      description: 'EXCLUSION (20s): Stanford #4 Chase McFarland',
    ),
  );

  return buildPreviewWrapper(
    SizedBox(
      width: 420,
      height: 460,
      child: TelemetrySheet(controller: controller),
    ),
    controller: controller,
  );
}
