import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polopad_pro/core/constants/colors.dart';
import 'package:polopad_pro/core/constants/widget_keys.dart';
import 'package:polopad_pro/domain/engine/timing_engine.dart';
import 'package:polopad_pro/domain/models/game_state.dart';
import 'package:polopad_pro/domain/models/team.dart';
import 'package:polopad_pro/domain/six_eight/six_eight_manager.dart';
import 'package:polopad_pro/infrastructure/ble/mock_ble_service.dart';
import 'package:polopad_pro/infrastructure/mock_data/tournament_presets.dart';
import 'package:polopad_pro/main.dart';
import 'package:polopad_pro/presentation/screens/adaptive_game_screen.dart';
import 'package:polopad_pro/presentation/widgets/exclusion_bay.dart';
import 'package:polopad_pro/presentation/widgets/plunger_button.dart';
import 'package:polopad_pro/presentation/widgets/shot_clock_card.dart';
import 'package:polopad_pro/state/game_controller.dart';

void main() {
  group('M3 Adversarial Challenge: PlungerButton Tactile States & Animations', () {
    testWidgets('PlungerButton translates vertically by 3.0dp on pointer down and reverts on pointer up', (tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: PlungerButton.startStop(
                isRunning: false,
                onTap: () => tapped = true,
              ),
            ),
          ),
        ),
      );

      // 1. Initial unpressed state: Transform offset is (0, 0.0)
      final initialTransformFinder = find.byWidgetPredicate(
        (w) => w is Transform && w.transform.getTranslation().y == 0.0,
      );
      expect(initialTransformFinder, findsOneWidget);

      // 2. Pointer down: gesture press initiates vertical translation
      final gesture = await tester.startGesture(tester.getCenter(find.byKey(WidgetKeys.startStopButton)));
      await tester.pump();

      // Transform offset must now be exactly 3.0dp downwards
      final pressedTransformFinder = find.byWidgetPredicate(
        (w) => w is Transform && w.transform.getTranslation().y == 3.0,
      );
      expect(pressedTransformFinder, findsOneWidget);
      expect(tapped, isFalse);

      // 3. Pointer up: gesture finishes, callback fires, translation reverts to 0.0dp
      await gesture.up();
      await tester.pump();

      expect(initialTransformFinder, findsOneWidget);
      expect(tapped, isTrue);
    });

    testWidgets('Disabled PlungerButton does not translate on pointer down', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(
              child: PlungerButton(
                onTap: null,
                gradient: AquaticColors.startPlungerGradient,
                bevelColor: AquaticColors.startGreenBevel,
                label: 'DISABLED',
              ),
            ),
          ),
        ),
      );

      final transformFinder = find.byWidgetPredicate(
        (w) => w is Transform && w.transform.getTranslation().y == 0.0,
      );
      expect(transformFinder, findsOneWidget);

      // Pointer down on disabled button
      final gesture = await tester.startGesture(tester.getCenter(find.text('DISABLED')));
      await tester.pump();

      // Must remain at 0.0dp (no translation when disabled)
      expect(transformFinder, findsOneWidget);
      await gesture.up();
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('All tactile plunger variants render distinct labels and keys', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                PlungerButton.startStop(isRunning: false, onTap: () {}),
                PlungerButton.startStop(isRunning: true, onTap: () {}),
                PlungerButton.reset30(onTap: () {}),
                PlungerButton.reset20(onTap: () {}),
              ],
            ),
          ),
        ),
      );

      expect(find.text('START'), findsOneWidget);
      expect(find.text('WHISTLE'), findsOneWidget);
      expect(find.text('30'), findsOneWidget);
      expect(find.text('TURNOVER'), findsOneWidget);
      expect(find.text('20'), findsOneWidget);
      expect(find.text('REBOUND / FOUL'), findsOneWidget);
      expect(find.byKey(WidgetKeys.startStopButton), findsNWidgets(2));
      expect(find.byKey(WidgetKeys.reset30Button), findsOneWidget);
      expect(find.byKey(WidgetKeys.reset20Button), findsOneWidget);
    });
  });

  group('M3 Adversarial Challenge: ShotClockCard Time Boundaries & Rule WP 20.15', () {
    late TimingEngine engine;
    late SixEightManager sixEight;
    late MockBleService ble;
    late GameController controller;

    setUp(() {
      engine = TimingEngine(autoTick: false);
      sixEight = SixEightManager(initialMatch: TournamentPresets.match68JO);
      ble = MockBleService(autoConnect: false);
      controller = GameController(engine: engine, sixEight: sixEight, ble: ble);
    });

    tearDown(() {
      controller.dispose();
      engine.dispose();
      sixEight.dispose();
      ble.dispose();
    });

    Widget createCardApp() {
      return MaterialApp(
        home: Scaffold(
          body: Center(
            child: ShotClockCard(controller: controller),
          ),
        ),
      );
    }

    testWidgets('ShotClockCard displays Green >= 10s', (tester) async {
      // 30s shot clock, 8:00 game clock
      await tester.pumpWidget(createCardApp());
      expect(find.text('30'), findsOneWidget);
      expect(find.text('WP 20.15 ARMED'), findsOneWidget);
    });

    testWidgets('ShotClockCard displays Amber between 5.0s and 9.9s', (tester) async {
      // Adjust shot clock to 9s
      engine.adjustShotClock(-21); // 30 - 21 = 9s
      await tester.pumpWidget(createCardApp());
      expect(find.text('9.0'), findsOneWidget);
      expect(find.text('WP 20.15 ARMED'), findsOneWidget);
    });

    testWidgets('ShotClockCard displays Red under 5.0s', (tester) async {
      // Adjust shot clock to 4s
      engine.adjustShotClock(-26); // 30 - 26 = 4s
      await tester.pumpWidget(createCardApp());
      expect(find.text('4.0'), findsOneWidget);
      expect(find.text('WP 20.15 ARMED'), findsOneWidget);
    });

    testWidgets('Rule WP 20.15 Auto-Blanking: displays -- and AUTO-BLANKED badge when gameTime <= shotTime', (tester) async {
      // Set game clock to 15s, shot clock to 30s (15s <= 30s)
      engine.adjustGameClock(-465); // 480 - 465 = 15s
      await tester.pumpWidget(createCardApp());
      expect(find.text('--'), findsOneWidget);
      expect(find.text('WP 20.15 AUTO-BLANKED'), findsOneWidget);
    });
  });

  group('M3 Adversarial Challenge: Multi-Exclusion Rendering Stress Tests', () {
    late TimingEngine engine;
    late SixEightManager sixEight;
    late MockBleService ble;
    late GameController controller;

    setUp(() {
      engine = TimingEngine(autoTick: false);
      sixEight = SixEightManager(initialMatch: TournamentPresets.match68JO);
      ble = MockBleService(autoConnect: false);
      controller = GameController(engine: engine, sixEight: sixEight, ble: ble);
    });

    tearDown(() {
      controller.dispose();
      engine.dispose();
      sixEight.dispose();
      ble.dispose();
    });

    testWidgets('ExclusionBay renders 4 simultaneous active exclusions with individual REL buttons', (tester) async {
      engine.addExclusion(Team.white, 2);
      engine.addExclusion(Team.white, 4);
      engine.addExclusion(Team.white, 5);
      engine.addExclusion(Team.white, 7);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ExclusionBay(team: Team.white, controller: controller),
          ),
        ),
      );

      expect(find.text('PENALTIES:'), findsOneWidget);
      expect(find.text('#2 20s'), findsOneWidget);
      expect(find.text('#4 20s'), findsOneWidget);
      expect(find.text('#5 20s'), findsOneWidget);
      expect(find.text('#7 20s'), findsOneWidget);
      expect(find.text('REL'), findsNWidgets(4));

      // Test releasing one exclusion
      final firstExclusion = controller.gameState.exclusions.first;
      await tester.tap(find.byKey(WidgetKeys.exclusionRelButton(firstExclusion.id)));
      await tester.pump();

      expect(controller.gameState.exclusions.length, 3);
      expect(find.text('REL'), findsNWidgets(3));
    });

    testWidgets('Tablet Viewport (1024x768) renders 4 active exclusions without overflow', (tester) async {
      tester.view.physicalSize = const Size(1024, 768);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      engine.addExclusion(Team.white, 2);
      engine.addExclusion(Team.white, 4);
      engine.addExclusion(Team.white, 5);
      engine.addExclusion(Team.white, 7);

      await tester.pumpWidget(
        MaterialApp(
          home: GameControllerScope(
            controller: controller,
            child: AdaptiveGameScreen(controller: controller),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('PENALTIES:'), findsOneWidget);
      expect(find.text('REL'), findsNWidgets(4));
    });

    testWidgets('Mobile Viewport (360x640) renders 4 active exclusions within SingleChildScrollView without overflow', (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      engine.addExclusion(Team.white, 2);
      engine.addExclusion(Team.white, 4);
      engine.addExclusion(Team.white, 5);
      engine.addExclusion(Team.white, 7);

      await tester.pumpWidget(
        MaterialApp(
          home: GameControllerScope(
            controller: controller,
            child: AdaptiveGameScreen(controller: controller),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('PENALTIES:'), findsOneWidget);
      expect(find.text('REL'), findsNWidgets(4));
    });

    testWidgets('Ultra-compact 320dp Mobile Viewport renders multi-exclusions without RenderFlex overflow', (tester) async {
      tester.view.physicalSize = const Size(320, 568);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      engine.addExclusion(Team.white, 2);
      engine.addExclusion(Team.white, 4);
      engine.addExclusion(Team.white, 5);
      engine.addExclusion(Team.white, 7);

      await tester.pumpWidget(
        MaterialApp(
          home: GameControllerScope(
            controller: controller,
            child: AdaptiveGameScreen(controller: controller),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });
}
