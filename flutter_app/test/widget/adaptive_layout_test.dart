import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polopad_pro/core/constants/widget_keys.dart';
import 'package:polopad_pro/core/theme/aquatic_theme.dart';
import 'package:polopad_pro/domain/engine/timing_engine.dart';
import 'package:polopad_pro/domain/six_eight/six_eight_manager.dart';
import 'package:polopad_pro/infrastructure/ble/mock_ble_service.dart';
import 'package:polopad_pro/infrastructure/mock_data/tournament_presets.dart';
import 'package:polopad_pro/main.dart';
import 'package:polopad_pro/presentation/screens/adaptive_game_screen.dart';
import 'package:polopad_pro/presentation/screens/mobile_stacked_layout.dart';
import 'package:polopad_pro/presentation/screens/tablet_dual_thumb_layout.dart';
import 'package:polopad_pro/state/game_controller.dart';

void main() {
  group('Adaptive Layout & Viewport Transition Widget Tests', () {
    late TimingEngine engine;
    late SixEightManager sixEight;
    late MockBleService ble;
    late GameController controller;

    setUp(() {
      engine = TimingEngine(autoTick: false);
      sixEight = SixEightManager(initialMatch: TournamentPresets.match68JO);
      ble = MockBleService(autoConnect: false);
      controller = GameController(
        engine: engine,
        sixEight: sixEight,
        ble: ble,
      );
    });

    tearDown(() {
      controller.dispose();
      engine.dispose();
      sixEight.dispose();
      ble.dispose();
    });

    Widget createTestApp() {
      return MaterialApp(
        theme: AquaticTheme.themeData,
        home: GameControllerScope(
          controller: controller,
          child: AdaptiveGameScreen(controller: controller),
        ),
      );
    }

    testWidgets('Tablet Viewport (> 600dp): Renders 3-column TabletDualThumbLayout', (tester) async {
      tester.view.physicalSize = const Size(1024, 768);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      // Tablet dual-thumb layout active
      expect(find.byType(TabletDualThumbLayout), findsOneWidget);
      expect(find.byType(MobileStackedLayout), findsNothing);

      // Verify 3-column key landmarks
      expect(find.byKey(WidgetKeys.startStopButton), findsOneWidget);
      expect(find.byKey(WidgetKeys.reset30Button), findsOneWidget);
      expect(find.byKey(WidgetKeys.reset20Button), findsOneWidget);
      expect(find.byKey(WidgetKeys.gameClockDisplay), findsOneWidget);
      expect(find.byKey(WidgetKeys.shotClockDisplay), findsOneWidget);
      expect(find.byKey(WidgetKeys.ruleWpBadge), findsOneWidget);
      expect(find.byKey(WidgetKeys.whiteScorePlus), findsOneWidget);
      expect(find.byKey(WidgetKeys.darkScorePlus), findsOneWidget);
      expect(find.byKey(WidgetKeys.periodSelector), findsOneWidget);
      expect(find.byKey(WidgetKeys.undoButton), findsOneWidget);
      expect(find.byKey(WidgetKeys.protocolToggle), findsOneWidget);
    });

    testWidgets('Mobile Viewport (<= 600dp): Renders compact MobileStackedLayout without overflow', (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      // Mobile stacked layout active
      expect(find.byType(MobileStackedLayout), findsOneWidget);
      expect(find.byType(TabletDualThumbLayout), findsNothing);

      // Zero RenderFlex exceptions
      expect(tester.takeException(), isNull);

      // Verify all required interactive elements present
      expect(find.byKey(WidgetKeys.startStopButton), findsOneWidget);
      expect(find.byKey(WidgetKeys.reset30Button), findsOneWidget);
      expect(find.byKey(WidgetKeys.reset20Button), findsOneWidget);
      expect(find.byKey(WidgetKeys.gameClockDisplay), findsOneWidget);
      expect(find.byKey(WidgetKeys.shotClockDisplay), findsOneWidget);
      expect(find.byKey(WidgetKeys.ruleWpBadge), findsOneWidget);
      expect(find.byKey(WidgetKeys.whiteScorePlus), findsOneWidget);
      expect(find.byKey(WidgetKeys.darkScorePlus), findsOneWidget);
      expect(find.byKey(WidgetKeys.periodSelector), findsOneWidget);
      expect(find.byKey(WidgetKeys.undoButton), findsOneWidget);
    });

    testWidgets('Ultra-compact 320dp Mobile Viewport: Zero RenderFlex overflow errors', (tester) async {
      tester.view.physicalSize = const Size(320, 568); // iPhone 5/SE 1st gen viewport
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(MobileStackedLayout), findsOneWidget);
    });

    testWidgets('Responsive breakpoint dynamic transition: 599dp (Mobile) to 601dp (Tablet)', (tester) async {
      // 1. Start at 599dp width (Mobile layout)
      tester.view.physicalSize = const Size(599, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();
      expect(find.byType(MobileStackedLayout), findsOneWidget);
      expect(find.byType(TabletDualThumbLayout), findsNothing);

      // 2. Resize to 601dp width (Tablet layout)
      tester.view.physicalSize = const Size(601, 800);
      await tester.pumpAndSettle();
      expect(find.byType(TabletDualThumbLayout), findsOneWidget);
      expect(find.byType(MobileStackedLayout), findsNothing);
    });
  });
}
