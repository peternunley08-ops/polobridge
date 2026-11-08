import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:polopad_pro/core/constants/colors.dart';
import 'package:polopad_pro/core/constants/widget_keys.dart';
import 'package:polopad_pro/core/theme/aquatic_theme.dart';
import 'package:polopad_pro/domain/engine/timing_engine.dart';
import 'package:polopad_pro/domain/engine/undo_stack.dart';
import 'package:polopad_pro/domain/models/clock_snapshot.dart';
import 'package:polopad_pro/domain/models/exclusion.dart';
import 'package:polopad_pro/domain/models/game_state.dart';
import 'package:polopad_pro/domain/models/team.dart';
import 'package:polopad_pro/domain/six_eight/models.dart';
import 'package:polopad_pro/domain/six_eight/six_eight_manager.dart';
import 'package:polopad_pro/infrastructure/ble/ble_dongle_service.dart';
import 'package:polopad_pro/infrastructure/ble/ble_packet_codec.dart';
import 'package:polopad_pro/infrastructure/ble/mock_ble_service.dart';
import 'package:polopad_pro/infrastructure/mock_data/tournament_presets.dart';
import 'package:polopad_pro/main.dart';
import 'package:polopad_pro/presentation/screens/adaptive_game_screen.dart';
import 'package:polopad_pro/presentation/screens/mobile_stacked_layout.dart';
import 'package:polopad_pro/presentation/screens/tablet_dual_thumb_layout.dart';
import 'package:polopad_pro/state/game_controller.dart';

void main() {
  group('M5 White-Box Adversarial Stress Suite (teamwork_challenger_m5_2)', () {
    // =========================================================================
    // 1. GameTime & ShotClock Boundary Conditions
    // =========================================================================
    group('1. GameTime & ShotClock Boundaries & Number Representations', () {
      test('Standard 8:00 and 30s formats string representations correctly', () {
        final state = GameState.initial();
        expect(state.formattedGameTime, equals('08:00.0'));
        expect(state.formattedShotTime, equals('30'));
        expect(state.isShotClockBlanked, isFalse);
        expect(state.isShotClockWarning, isFalse);
      });

      test('Sub-10s and sub-5s precision formatting', () {
        final state99 = GameState.initial().copyWith(shotTimeMs: 9900);
        expect(state99.formattedShotTime, equals('9.9'));
        expect(state99.isShotClockWarning, isFalse);

        final state48 = GameState.initial().copyWith(shotTimeMs: 4800);
        expect(state48.formattedShotTime, equals('4.8'));
        expect(state48.isShotClockWarning, isTrue);

        final state05 = GameState.initial().copyWith(shotTimeMs: 500);
        expect(state05.formattedShotTime, equals('0.5'));
        expect(state05.isShotClockWarning, isTrue);
      });

      test('Rule WP 20.15 exact boundary equality (g == s, g < s, g > s)', () {
        // g == s: MUST be blanked
        final stateEqual = GameState.initial().copyWith(
          gameTimeMs: 20000,
          shotTimeMs: 20000,
        );
        expect(stateEqual.isShotClockBlanked, isTrue);
        expect(stateEqual.formattedShotTime, equals('--'));
        expect(stateEqual.isShotClockWarning, isFalse);

        // g = s - 100ms: MUST be blanked
        final stateBelow = GameState.initial().copyWith(
          gameTimeMs: 19900,
          shotTimeMs: 20000,
        );
        expect(stateBelow.isShotClockBlanked, isTrue);
        expect(stateBelow.formattedShotTime, equals('--'));

        // g = s + 100ms: NOT blanked (minimal de-blanking margin)
        final stateAbove = GameState.initial().copyWith(
          gameTimeMs: 20100,
          shotTimeMs: 20000,
        );
        expect(stateAbove.isShotClockBlanked, isFalse);
        expect(stateAbove.formattedShotTime, equals('20'));
      });

      test('Upper boundary: maximum duration up to 99:00.0 does not overflow', () {
        final stateMax = GameState.initial().copyWith(gameTimeMs: 99 * 60 * 1000);
        expect(stateMax.formattedGameTime, equals('99:00.0'));
      });

      test('TimingEngine tick clamps game clock at 0 and does not permit negative clock', () {
        final engine = TimingEngine(autoTick: false);
        engine.start();

        // Adjust game clock down near zero
        engine.adjustGameClock(-479); // 8:00 - 479s = 1s = 1000ms
        expect(engine.gameTimeMs, equals(1000));

        // Tick by 1500ms (exceeds remaining 1000ms)
        engine.tick(1500);
        expect(engine.gameTimeMs, equals(0));
        expect(engine.isRunning, isFalse);
        expect(engine.state.formattedGameTime, equals('00:00.0'));
        engine.dispose();
      });

      test('adjustGameClock and adjustShotClock clamp to non-negative ranges', () {
        final engine = TimingEngine(autoTick: false);

        // Adjust downwards past zero
        engine.adjustShotClock(-100);
        expect(engine.shotTimeMs, equals(0));

        engine.adjustGameClock(-10000);
        expect(engine.gameTimeMs, equals(0));

        // Adjust upwards past max
        engine.adjustShotClock(100);
        expect(engine.shotTimeMs, equals(35 * 1000)); // Clamped at 35s

        engine.dispose();
      });
    });

    // =========================================================================
    // 2. Undo Stack Saturation & Stress
    // =========================================================================
    group('2. Undo Stack Saturation & Eviction Under Pressure', () {
      test('UndoStack caps buffer size at maxDepth and drops oldest entries in FIFO order', () {
        final stack = UndoStack(maxDepth: 10);
        expect(stack.canUndo, isFalse);
        expect(stack.length, equals(0));
        expect(stack.pop(), isNull);

        // Push 50 snapshots
        for (int i = 1; i <= 50; i++) {
          stack.push(
            ClockSnapshot(
              gameTimeMs: i * 1000,
              shotTimeMs: 30000,
              isRunning: false,
              scoreWhite: i,
              scoreDark: 0,
              period: 1,
              exclusions: const [],
            ),
          );
        }

        // Must be capped at exactly maxDepth = 10
        expect(stack.length, equals(10));
        expect(stack.canUndo, isTrue);

        // Popping must yield entries 50 down to 41 in strict LIFO order
        for (int expected = 50; expected >= 41; expected--) {
          final popped = stack.pop();
          expect(popped, isNotNull);
          expect(popped!.scoreWhite, equals(expected));
          expect(popped.gameTimeMs, equals(expected * 1000));
        }

        // Stack must now be completely empty
        expect(stack.length, equals(0));
        expect(stack.canUndo, isFalse);
        expect(stack.pop(), isNull);
        expect(stack.peek, isNull);
      });

      test('TimingEngine multi-step undo restores historical states accurately', () {
        final engine = TimingEngine(autoTick: false);

        // Step 1: Start
        engine.start();
        expect(engine.isRunning, isTrue);

        // Step 2: Score White
        engine.incrementScore(Team.white);
        expect(engine.scoreWhite, equals(1));

        // Step 3: Score Dark
        engine.incrementScore(Team.dark);
        expect(engine.scoreDark, equals(1));

        // Step 4: Reset 20
        engine.resetShotClock20();
        expect(engine.shotTimeMs, equals(20000));

        // Undo Step 4 -> shot clock restored
        engine.undo();
        expect(engine.shotTimeMs, equals(30000));

        // Undo Step 3 -> score dark restored to 0
        engine.undo();
        expect(engine.scoreDark, equals(0));

        // Undo Step 2 -> score white restored to 0
        engine.undo();
        expect(engine.scoreWhite, equals(0));

        // Undo Step 1 -> stopped
        engine.undo();
        expect(engine.isRunning, isFalse);

        // Extra undo when empty: safe no-op
        engine.undo();
        expect(engine.canUndo, isFalse);

        engine.dispose();
      });
    });

    // =========================================================================
    // 3. SixEightManager Personal Exclusion Cap-Out Edge Cases
    // =========================================================================
    group('3. SixEightManager Cap-Outs, Roster Mutations & Event Stream', () {
      late SixEightManager manager;

      setUp(() {
        manager = SixEightManager(initialMatch: TournamentPresets.match68JO);
      });

      tearDown(() {
        manager.dispose();
      });

      test('Player cap-out progression: 0/3 -> 1/3 -> 2/3 -> 3/3 CAPPED OUT', () {
        const team = Team.white;
        const cap = 5; // B. Hallock

        expect(manager.isPlayerCappedOut(team, cap), isFalse);
        var player = manager.getPlayer(team, cap)!;
        expect(player.personalFouls, equals(0));
        expect(player.foulDisplay, equals('0/3'));

        // Foul 1
        expect(manager.recordFoul(team, cap), isTrue);
        player = manager.getPlayer(team, cap)!;
        expect(player.personalFouls, equals(1));
        expect(player.foulDisplay, equals('1/3'));
        expect(manager.isPlayerCappedOut(team, cap), isFalse);

        // Foul 2
        expect(manager.recordFoul(team, cap), isTrue);
        player = manager.getPlayer(team, cap)!;
        expect(player.personalFouls, equals(2));
        expect(player.foulDisplay, equals('2/3'));
        expect(manager.isPlayerCappedOut(team, cap), isFalse);

        // Foul 3 (Cap-out threshold)
        expect(manager.recordFoul(team, cap), isTrue);
        player = manager.getPlayer(team, cap)!;
        expect(player.personalFouls, equals(3));
        expect(player.foulDisplay, equals('3/3 CAPPED OUT'));
        expect(manager.isPlayerCappedOut(team, cap), isTrue);

        // Foul 4 attempted on capped out player: MUST return false and remain 3
        expect(manager.recordFoul(team, cap), isFalse);
        player = manager.getPlayer(team, cap)!;
        expect(player.personalFouls, equals(3));
        expect(manager.isPlayerCappedOut(team, cap), isTrue);

        // Foul 5 attempted: also returns false
        expect(manager.recordFoul(team, cap), isFalse);
      });

      test('Recording fouls on non-existent cap numbers safely returns false', () {
        expect(manager.recordFoul(Team.white, 99), isFalse);
        expect(manager.recordFoul(Team.dark, -1), isFalse);
        expect(manager.recordFoul(Team.white, 0), isFalse);
        expect(manager.isPlayerCappedOut(Team.white, 99), isFalse);
      });

      test('Rosters are unmodifiable views and reject external mutation', () {
        expect(
          () => manager.whiteRoster.add(
            const RosterPlayer(
              capNumber: 99,
              name: 'Injected',
              position: Position.utl,
              piScore: 50.0,
            ),
          ),
          throwsA(isA<UnsupportedError>()),
        );

        expect(
          () => manager.darkRoster.clear(),
          throwsA(isA<UnsupportedError>()),
        );
      });

      test('Switching matches resets foul state and maintains roster isolation', () {
        // Add 2 fouls to Vanguard #5
        manager.recordFoul(Team.white, 5);
        expect(manager.getPlayer(Team.white, 5)!.personalFouls, equals(1));

        // Switch to match ODP
        manager.selectMatch(TournamentPresets.match68ODP);
        expect(manager.activeMatch.matchId, equals('68-ODP-2026-108'));

        // In new match, cap #5 has 0 fouls
        final odpPlayer5 = manager.getPlayer(Team.white, 5);
        if (odpPlayer5 != null) {
          expect(odpPlayer5.personalFouls, equals(0));
        }

        // Switch back to match 68-JO
        manager.selectMatch(TournamentPresets.match68JO);
        // Cleanly reloaded from preset
        expect(manager.getPlayer(Team.white, 5)!.personalFouls, equals(0));
      });
    });

    // =========================================================================
    // 4. BLE Dongle Service: Packet Fuzzing, Corruption & Stream Teardown
    // =========================================================================
    group('4. BLE Hardware Dongle Packet Fuzzing & Teardown', () {
      test('BlePacketCodec throws FormatException on truncated buffers (< 13 bytes)', () {
        expect(() => BlePacketCodec.decodeStatus(Uint8List(0)), throwsFormatException);
        expect(() => BlePacketCodec.decodeStatus(Uint8List(5)), throwsFormatException);
        expect(() => BlePacketCodec.decodeStatus(Uint8List(12)), throwsFormatException);
      });

      test('BlePacketCodec decodes buffer >= 13 bytes without error', () {
        final buffer13 = Uint8List(13);
        final packet = BlePacketCodec.decodeStatus(buffer13);
        expect(packet.isRunning, isFalse);
        expect(packet.gameTimeMs, equals(0));

        final buffer20 = Uint8List(20);
        final packet20 = BlePacketCodec.decodeStatus(buffer20);
        expect(packet20.isRunning, isFalse);
      });

      test('BlePacketCodec roundtrip serialization preserves exact byte representation', () {
        const original = BleStatusPacket(
          isRunning: true,
          hornActive: true,
          isBlanked: true,
          gameTimeMs: 421500, // 7:01.5
          shotTimeMs: 16800,  // 16.8s
          scoreWhite: 14,
          scoreDark: 11,
          period: 4,
          protocol: ScoreboardProtocol.daktronics,
        );

        final encoded = BlePacketCodec.encodeStatus(original);
        expect(encoded.length, equals(13));

        final decoded = BlePacketCodec.decodeStatus(encoded);
        expect(decoded, equals(original));
        expect(decoded.isRunning, isTrue);
        expect(decoded.hornActive, isTrue);
        expect(decoded.isBlanked, isTrue);
        expect(decoded.gameTimeMs, equals(421500));
        expect(decoded.shotTimeMs, equals(16800));
        expect(decoded.scoreWhite, equals(14));
        expect(decoded.scoreDark, equals(11));
        expect(decoded.period, equals(4));
        expect(decoded.protocol, equals(ScoreboardProtocol.daktronics));
      });

      test('MockBleService safely handles unknown opcodes and empty payloads', () async {
        final ble = MockBleService(autoConnect: false);
        await ble.connect();

        // Send empty command: must not crash
        await ble.sendCommand(Uint8List(0));

        // Send unknown opcodes: 0x00, 0xFF, 0x42
        await ble.sendCommand(Uint8List.fromList([0x00]));
        await ble.sendCommand(Uint8List.fromList([0xFF, 0x01, 0x02]));
        await ble.sendCommand(Uint8List.fromList([0x42]));

        // Send truncated opcodes
        await ble.sendCommand(Uint8List.fromList([0x05])); // SET SHOT without length
        await ble.sendCommand(Uint8List.fromList([0x06, 0x01])); // SET GAME without length
        await ble.sendCommand(Uint8List.fromList([0x08, 0x01])); // SET SCORES without length
        await ble.sendCommand(Uint8List.fromList([0x0B])); // PROTOCOL without byte

        expect(ble.sentCommands.length, equals(8));
        ble.dispose();
      });

      test('MockBleService stream teardown completes cleanly without leaks', () async {
        final ble = MockBleService(autoConnect: false);
        bool receivedStatus = false;

        final sub = ble.statusStream.listen((_) {
          receivedStatus = true;
        });

        await ble.connect();
        ble.emitCurrentStatus();
        expect(receivedStatus, isTrue);

        await sub.cancel();
        ble.dispose();
        // Subsequent emission should not cause unhandled errors
        expect(ble.connectionState, equals(BleConnectionState.connected));
      });
    });

    // =========================================================================
    // 5. Adaptive Layout: Viewport Floating-Point Boundary & Accessibility
    // =========================================================================
    group('5. Adaptive Layout Floating-Point Boundary & Accessibility', () {
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

      Widget createTestApp({double textScale = 1.0}) {
        return MaterialApp(
          theme: AquaticTheme.themeData,
          home: MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
            child: GameControllerScope(
              controller: controller,
              child: AdaptiveGameScreen(controller: controller),
            ),
          ),
        );
      }

      testWidgets('Exact 600.0dp floating-point boundary selects MobileStackedLayout', (tester) async {
        tester.view.physicalSize = const Size(600.0, 800.0);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);

        await tester.pumpWidget(createTestApp());
        await tester.pumpAndSettle();

        expect(find.byType(MobileStackedLayout), findsOneWidget);
        expect(find.byType(TabletDualThumbLayout), findsNothing);
      });

      testWidgets('Boundary +0.001dp (600.001dp) selects TabletDualThumbLayout', (tester) async {
        tester.view.physicalSize = const Size(600.001, 800.0);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);

        await tester.pumpWidget(createTestApp());
        await tester.pumpAndSettle();

        expect(find.byType(TabletDualThumbLayout), findsOneWidget);
        expect(find.byType(MobileStackedLayout), findsNothing);
      });

      testWidgets('Boundary -0.001dp (599.999dp) selects MobileStackedLayout', (tester) async {
        tester.view.physicalSize = const Size(599.999, 800.0);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);

        await tester.pumpWidget(createTestApp());
        await tester.pumpAndSettle();

        expect(find.byType(MobileStackedLayout), findsOneWidget);
        expect(find.byType(TabletDualThumbLayout), findsNothing);
      });

      testWidgets('Phone Orientation: Portrait (390x844) to Landscape (844x390)', (tester) async {
        // Portrait (390 <= 600 -> Mobile)
        tester.view.physicalSize = const Size(390, 844);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);

        await tester.pumpWidget(createTestApp());
        await tester.pumpAndSettle();
        expect(find.byType(MobileStackedLayout), findsOneWidget);
        expect(tester.takeException(), isNull);

        // Landscape (844 > 600 -> Tablet dual-thumb)
        tester.view.physicalSize = const Size(844, 390);
        await tester.pumpAndSettle();
        expect(find.byType(TabletDualThumbLayout), findsOneWidget);
        expect(tester.takeException(), isNull);
      });

      testWidgets('Extreme text scaling: 0.8x to 2.5x without RenderFlex overflow', (tester) async {
        tester.view.physicalSize = const Size(360, 640);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);

        // 0.8x compact
        await tester.pumpWidget(createTestApp(textScale: 0.8));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);

        // 2.5x enlarged accessibility
        await tester.pumpWidget(createTestApp(textScale: 2.5));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.byType(MobileStackedLayout), findsOneWidget);
      });

      testWidgets('Ultra-narrow 280dp foldable outer screen renders without crash', (tester) async {
        tester.view.physicalSize = const Size(280, 653);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);

        await tester.pumpWidget(createTestApp());
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.byType(MobileStackedLayout), findsOneWidget);
      });
    });
  });
}
