import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polopad_pro/core/constants/colors.dart';
import 'package:polopad_pro/core/constants/widget_keys.dart';
import 'package:polopad_pro/domain/models/team.dart';
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
  group('Widget Previews Architecture & Preview Execution Tests', () {
    // -------------------------------------------------------------------------
    // Helper Factory & Theme Scaffolding Tests
    // -------------------------------------------------------------------------
    test('createPreviewController instantiates deterministic controller with autoTick false', () {
      final controller = createPreviewController(
        running: true,
        gameTimeMs: 420000,
        shotTimeMs: 25000,
        whiteScore: 3,
        darkScore: 2,
        period: 2,
      );

      expect(controller.gameState.isRunning, isTrue);
      expect(controller.gameState.gameTimeMs, equals(420000));
      expect(controller.gameState.shotTimeMs, equals(25000));
      expect(controller.gameState.scoreWhite, equals(3));
      expect(controller.gameState.scoreDark, equals(2));
      expect(controller.gameState.period, equals(2));
      expect(controller.engine.isAutoTicking, isFalse);
      expect(controller.ble.isConnected, isFalse);
    });

    test('AquaticPreviewThemeData builds valid aquatic dark theme', () {
      final themeData = aquaticThemeBuilder();
      expect(themeData, isA<AquaticPreviewThemeData>());
    });

    // -------------------------------------------------------------------------
    // Group 1: Layouts & Screens Previews
    // -------------------------------------------------------------------------
    testWidgets('tabletDualThumbLayoutPreview pumps non-null widget tree and renders TabletDualThumbLayout', (tester) async {
      tester.view.physicalSize = const Size(1024, 768);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final widget = tabletDualThumbLayoutPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(TabletDualThumbLayout), findsOneWidget);
      expect(find.byKey(WidgetKeys.startStopButton), findsOneWidget);
      expect(find.byKey(WidgetKeys.reset30Button), findsOneWidget);
      expect(find.byKey(WidgetKeys.reset20Button), findsOneWidget);
    });

    testWidgets('mobileStackedLayoutPreview pumps non-null widget tree and renders MobileStackedLayout', (tester) async {
      tester.view.physicalSize = const Size(375, 812);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final widget = mobileStackedLayoutPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(MobileStackedLayout), findsOneWidget);
      expect(find.byKey(WidgetKeys.startStopButton), findsOneWidget);
    });

    testWidgets('mobileCompactStackedLayoutPreview pumps on 320x568 without exceptions', (tester) async {
      tester.view.physicalSize = const Size(320, 568);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final widget = mobileCompactStackedLayoutPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(MobileStackedLayout), findsOneWidget);
    });

    testWidgets('adaptiveGameScreenTabletPreview pumps full adaptive screen on tablet size', (tester) async {
      tester.view.physicalSize = const Size(1024, 768);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final widget = adaptiveGameScreenTabletPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(AdaptiveGameScreen), findsOneWidget);
      expect(find.byType(TabletDualThumbLayout), findsOneWidget);
    });

    testWidgets('adaptiveGameScreenMobilePreview pumps full adaptive screen on mobile size', (tester) async {
      tester.view.physicalSize = const Size(375, 812);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final widget = adaptiveGameScreenMobilePreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(AdaptiveGameScreen), findsOneWidget);
      expect(find.byType(MobileStackedLayout), findsOneWidget);
    });

    // -------------------------------------------------------------------------
    // Group 2: Tactile 3D Plungers Previews
    // -------------------------------------------------------------------------
    testWidgets('plungerStartIdlePreview and startPlungerPreview pump idle start button', (tester) async {
      final widget1 = plungerStartIdlePreview();
      expect(widget1, isNotNull);
      await tester.pumpWidget(widget1);
      await tester.pumpAndSettle();
      expect(find.text('START'), findsOneWidget);

      final widget2 = startPlungerPreview();
      expect(widget2, isNotNull);
    });

    testWidgets('plungerWhistleRunningPreview and whistlePlungerPreview pump active whistle button', (tester) async {
      final widget = plungerWhistleRunningPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.text('WHISTLE'), findsOneWidget);
      expect(whistlePlungerPreview(), isNotNull);
    });

    testWidgets('plungerReset30Preview and reset30PlungerPreview pump Reset 30 button', (tester) async {
      final widget = plungerReset30Preview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.text('30'), findsOneWidget);
      expect(find.text('TURNOVER'), findsOneWidget);
      expect(reset30PlungerPreview(), isNotNull);
    });

    testWidgets('plungerReset20Preview and reset20PlungerPreview pump Reset 20 button', (tester) async {
      final widget = plungerReset20Preview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.text('20'), findsOneWidget);
      expect(find.text('REBOUND / FOUL'), findsOneWidget);
      expect(reset20PlungerPreview(), isNotNull);
    });

    testWidgets('undoPlungerPreview pumps tactile Undo button', (tester) async {
      final widget = undoPlungerPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.text('UNDO'), findsOneWidget);
      expect(find.text('1-CLICK RESTORE'), findsOneWidget);
    });

    testWidgets('plungerCompactRowPreview pumps horizontal compact trio of plungers', (tester) async {
      tester.view.physicalSize = const Size(375, 200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final widget = plungerCompactRowPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(PlungerButton), findsNWidgets(3));
    });

    // -------------------------------------------------------------------------
    // Group 3: Clocks & WP 20.15 Previews
    // -------------------------------------------------------------------------
    testWidgets('masterClockCardPreview and masterClockNormalPreview pump master game clock card', (tester) async {
      final widget = masterClockCardPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(MasterClockCard), findsOneWidget);
      expect(find.byKey(WidgetKeys.gameClockDisplay), findsOneWidget);
      expect(masterClockNormalPreview(), isNotNull);
    });

    testWidgets('masterClockOvertimePreview pumps overtime master clock card', (tester) async {
      final widget = masterClockOvertimePreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(MasterClockCard), findsOneWidget);
      expect(find.text('OT'), findsOneWidget);
    });

    testWidgets('shotClockNormalPreview and shotClock30sPreview pump standard green shot clock', (tester) async {
      final widget = shotClockNormalPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(ShotClockCard), findsOneWidget);
      expect(find.text('24'), findsOneWidget);
      expect(shotClock30sPreview(), isNotNull);
    });

    testWidgets('shotClock20sPreview pumps 20s reset shot clock', (tester) async {
      final widget = shotClock20sPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(ShotClockCard), findsOneWidget);
      expect(find.text('20'), findsOneWidget);
    });

    testWidgets('shotClockWarningPreview pumps amber warning shot clock with tenths', (tester) async {
      final widget = shotClockWarningPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(ShotClockCard), findsOneWidget);
      expect(find.text('8.4'), findsOneWidget);
    });

    testWidgets('shotClockCriticalPreview pumps red critical shot clock with tenths', (tester) async {
      final widget = shotClockCriticalPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(ShotClockCard), findsOneWidget);
      expect(find.text('3.8'), findsOneWidget);
    });

    testWidgets('shotClockBlankedWp2015Preview and shotClockWP2015BlankedPreview pump Rule WP 20.15 blanked state', (tester) async {
      final widget = shotClockBlankedWp2015Preview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(ShotClockCard), findsOneWidget);
      expect(find.text('--'), findsOneWidget);
      expect(find.text('WP 20.15 AUTO-BLANKED'), findsOneWidget);
      expect(shotClockWP2015BlankedPreview(), isNotNull);
    });

    // -------------------------------------------------------------------------
    // Group 4: Team Bays & Exclusions Previews
    // -------------------------------------------------------------------------
    testWidgets('teamBayWhitePreview and whiteTeamBayPreview pump White Team Bay with Vanguard roster', (tester) async {
      tester.view.physicalSize = const Size(400, 700);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final widget = teamBayWhitePreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(TeamBay), findsOneWidget);
      expect(find.text('WHITE'), findsOneWidget);
      expect(whiteTeamBayPreview(), isNotNull);
    });

    testWidgets('teamBayDarkPreview and darkTeamBayPreview pump Dark Team Bay with Stanford roster', (tester) async {
      tester.view.physicalSize = const Size(400, 700);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final widget = teamBayDarkPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(TeamBay), findsOneWidget);
      expect(find.text('DARK'), findsOneWidget);
      expect(darkTeamBayPreview(), isNotNull);
    });

    testWidgets('exclusionBayPreview and multiExclusionBayPreview pump active exclusion penalties', (tester) async {
      final widget = exclusionBayPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(ExclusionBay), findsOneWidget);
      expect(find.text('REL'), findsWidgets);
      expect(multiExclusionBayPreview(), isNotNull);
    });

    // -------------------------------------------------------------------------
    // Group 5: Match Selector & Telemetry Sheets Previews
    // -------------------------------------------------------------------------
    testWidgets('matchSelectorSheetPreview pumps match selector header bar', (tester) async {
      final widget = matchSelectorSheetPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(MatchSelectorSheet), findsOneWidget);
      expect(find.byKey(WidgetKeys.protocolToggle), findsOneWidget);
    });

    testWidgets('telemetrySheetPreview pumps telemetry log sheet with event stream', (tester) async {
      tester.view.physicalSize = const Size(500, 600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final widget = telemetrySheetPreview();
      expect(widget, isNotNull);

      await tester.pumpWidget(widget);
      await tester.pumpAndSettle();

      expect(find.byType(TelemetrySheet), findsOneWidget);
      expect(find.text('TELEMETRY LOG'), findsOneWidget);
    });
  });
}
