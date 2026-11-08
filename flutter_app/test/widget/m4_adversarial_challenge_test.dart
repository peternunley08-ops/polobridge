import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polopad_pro/core/constants/colors.dart';
import 'package:polopad_pro/core/constants/widget_keys.dart';
import 'package:polopad_pro/core/theme/aquatic_theme.dart';
import 'package:polopad_pro/domain/models/exclusion.dart';
import 'package:polopad_pro/domain/models/team.dart';
import 'package:polopad_pro/infrastructure/ble/ble_dongle_service.dart';
import 'package:polopad_pro/presentation/screens/adaptive_game_screen.dart';
import 'package:polopad_pro/presentation/screens/mobile_stacked_layout.dart';
import 'package:polopad_pro/presentation/screens/tablet_dual_thumb_layout.dart';
import 'package:polopad_pro/presentation/widgets/exclusion_bay.dart';
import 'package:polopad_pro/presentation/widgets/master_clock_card.dart';
import 'package:polopad_pro/presentation/widgets/match_selector_sheet.dart';
import 'package:polopad_pro/presentation/widgets/plunger_button.dart';
import 'package:polopad_pro/presentation/widgets/shot_clock_card.dart';
import 'package:polopad_pro/presentation/widgets/team_bay.dart';
import 'package:polopad_pro/presentation/widgets/telemetry_sheet.dart';
import 'package:polopad_pro/widget_previews.dart';

void main() {
  group('M4 Adversarial Challenge: Widget Previews & Isolation Stress', () {
    // -------------------------------------------------------------------------
    // Challenge 1: Deterministic Controller Isolation & Leak Prevention
    // -------------------------------------------------------------------------
    test('createPreviewController guarantees zero timer drift and zero BLE auto-connect', () {
      final controller = createPreviewController(
        running: true,
        gameTimeMs: 120000,
        shotTimeMs: 20000,
        whiteScore: 10,
        darkScore: 9,
        period: 3,
        protocol: ScoreboardProtocol.dakt,
      );

      // Verify controller does not start an active background ticker
      expect(controller.engine.isAutoTicking, isFalse);
      expect(controller.ble.isConnected, isFalse);
      expect(controller.ble.currentProtocol, equals(ScoreboardProtocol.dakt));

      // Verify state reflects assigned parameters
      expect(controller.gameState.isRunning, isTrue);
      expect(controller.gameState.gameTimeMs, equals(120000));
      expect(controller.gameState.shotTimeMs, equals(20000));
      expect(controller.gameState.scoreWhite, equals(10));
      expect(controller.gameState.scoreDark, equals(9));
      expect(controller.gameState.period, equals(3));
    });

    test('AquaticPreviewThemeData wraps child in ThemeData without pitch-black background', () {
      const themeData = AquaticPreviewThemeData(brightness: Brightness.dark);
      expect(themeData.brightness, equals(Brightness.dark));

      final applied = themeData.apply(
        // Mock BuildContext by building a minimal test tree
        null as dynamic,
        const SizedBox(key: ValueKey('test_child')),
      );

      expect(applied, isA<Theme>());
      final theme = applied as Theme;
      expect(theme.data.scaffoldBackgroundColor, equals(AquaticColors.canvasSky900));
      expect(theme.data.scaffoldBackgroundColor, isNot(equals(Colors.black)));
    });

    // -------------------------------------------------------------------------
    // Challenge 2: Viewport Boundary Conditions & Overflow Stress
    // -------------------------------------------------------------------------
    testWidgets('mobileCompactStackedLayoutPreview survives ultra-compact 320x568 without RenderFlex overflow', (tester) async {
      tester.view.physicalSize = const Size(320, 568);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final preview = mobileCompactStackedLayoutPreview();
      expect(preview, isNotNull);

      await tester.pumpWidget(preview);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(MobileStackedLayout), findsOneWidget);
    });

    testWidgets('tabletDualThumbLayoutPreview renders 3-column layout on 1024x768 and wide 1366x1024', (tester) async {
      for (final size in [const Size(1024, 768), const Size(1366, 1024)]) {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);

        final preview = tabletDualThumbLayoutPreview();
        await tester.pumpWidget(preview);
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(find.byType(TabletDualThumbLayout), findsOneWidget);
        expect(find.byKey(WidgetKeys.startStopButton), findsOneWidget);
        expect(find.byKey(WidgetKeys.reset30Button), findsOneWidget);
        expect(find.byKey(WidgetKeys.reset20Button), findsOneWidget);
      }
    });

    testWidgets('adaptiveGameScreen switches cleanly between tablet and mobile at 600dp breakpoint', (tester) async {
      // 1. Tablet breakpoint: 601x800
      tester.view.physicalSize = const Size(601, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(adaptiveGameScreenTabletPreview());
      await tester.pumpAndSettle();

      expect(find.byType(TabletDualThumbLayout), findsOneWidget);
      expect(find.byType(MobileStackedLayout), findsNothing);

      // 2. Mobile breakpoint: 600x800
      tester.view.physicalSize = const Size(600, 800);
      await tester.pumpWidget(adaptiveGameScreenMobilePreview());
      await tester.pumpAndSettle();

      expect(find.byType(MobileStackedLayout), findsOneWidget);
      expect(find.byType(TabletDualThumbLayout), findsNothing);
    });

    // -------------------------------------------------------------------------
    // Challenge 3: World Aquatics Rule WP 20.15 Auto-Blanking Preview State
    // -------------------------------------------------------------------------
    testWidgets('shotClockBlankedWp2015Preview renders auto-blanked state with dashed LED', (tester) async {
      final preview = shotClockBlankedWp2015Preview();
      expect(preview, isNotNull);

      await tester.pumpWidget(preview);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(ShotClockCard), findsOneWidget);
      expect(find.text('--'), findsOneWidget);
      expect(find.text('WP 20.15 AUTO-BLANKED'), findsOneWidget);
    });

    // -------------------------------------------------------------------------
    // Challenge 4: High Exclusion Penalty Saturation in Previews
    // -------------------------------------------------------------------------
    testWidgets('multiExclusionBayPreview handles saturated penalty roster without crash', (tester) async {
      final saturatedController = createPreviewController(
        running: true,
        exclusions: [
          for (int i = 1; i <= 6; i++)
            Exclusion(
              id: 'exc_w_$i',
              team: Team.white,
              capNumber: i + 1,
              remainingMs: (20 - i) * 1000,
            ),
        ],
      );

      final preview = buildPreviewWrapper(
        ExclusionBay(team: Team.white, controller: saturatedController),
        controller: saturatedController,
      );

      await tester.pumpWidget(preview);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(ExclusionBay), findsOneWidget);
      expect(find.text('REL'), findsWidgets);
    });

    // -------------------------------------------------------------------------
    // Challenge 5: Zero Pitch-Black Canvas Verification
    // -------------------------------------------------------------------------
    testWidgets('buildPreviewWrapper provides non-black aquatic gradient canvas', (tester) async {
      await tester.pumpWidget(
        buildPreviewWrapper(
          const Text('Aquatic Palette Verification'),
        ),
      );
      await tester.pumpAndSettle();

      final scaffoldFinder = find.byType(Scaffold);
      expect(scaffoldFinder, findsOneWidget);

      final scaffold = tester.widget<Scaffold>(scaffoldFinder);
      expect(scaffold.backgroundColor, equals(AquaticColors.canvasSky900));
      expect(scaffold.backgroundColor == Colors.black, isFalse);
      expect(scaffold.backgroundColor == Colors.transparent, isFalse);
    });

    // -------------------------------------------------------------------------
    // Challenge 6: Previews Function Integrity (All 33 Non-Null)
    // -------------------------------------------------------------------------
    test('All 33 preview functions instantiate non-null Widget instances', () {
      final previewFunctions = <Widget Function()>[
        tabletDualThumbLayoutPreview,
        mobileStackedLayoutPreview,
        mobileCompactStackedLayoutPreview,
        adaptiveGameScreenTabletPreview,
        adaptiveGameScreenMobilePreview,
        plungerStartIdlePreview,
        startPlungerPreview,
        plungerWhistleRunningPreview,
        whistlePlungerPreview,
        plungerReset30Preview,
        reset30PlungerPreview,
        plungerReset20Preview,
        reset20PlungerPreview,
        undoPlungerPreview,
        plungerCompactRowPreview,
        masterClockCardPreview,
        masterClockNormalPreview,
        masterClockOvertimePreview,
        shotClockNormalPreview,
        shotClock30sPreview,
        shotClock20sPreview,
        shotClockWarningPreview,
        shotClockCriticalPreview,
        shotClockBlankedWp2015Preview,
        shotClockWP2015BlankedPreview,
        teamBayWhitePreview,
        whiteTeamBayPreview,
        teamBayDarkPreview,
        darkTeamBayPreview,
        exclusionBayPreview,
        multiExclusionBayPreview,
        matchSelectorSheetPreview,
        telemetrySheetPreview,
      ];

      expect(previewFunctions.length, equals(33));
      for (final fn in previewFunctions) {
        final widget = fn();
        expect(widget, isNotNull);
      }
    });
  });
}
