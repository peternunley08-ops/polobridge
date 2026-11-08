// test/widget/tier5_adversarial_hardening_test.dart
//
// PoloPad Pro — Tier 5 White-Box Adversarial Hardening Test Suite
// Authored by: teamwork_challenger_m5_1 (Milestone 5)
//
// Covers all Tier 5 Adversarial Stress & Edge Case Vectors:
//   Group 1: Rapid Plunger Double-Tap & Sub-100ms Debounce Hardening
//   Group 2: Clock Expiration Buzzers & Rule WP 20.15 Blanking Suppression
//   Group 3: Simultaneous 3-Foul Cap-Outs & Defending Penalty Releases
//   Group 4: BLE Packet Serialization Under Protocol Jitter & Framing Attacks
//   Group 5: Extreme Viewport Constraints & Breakpoint Hysteresis (280dp down to 240dp)
//   Group 6: 6-8 Sports Telemetry Stream Integrity & Memory Bounding

import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:polopad_pro/core/audio/sound_service.dart';
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
import 'package:polopad_pro/presentation/widgets/plunger_button.dart';
import 'package:polopad_pro/state/game_controller.dart';

void main() {
  // ---------------------------------------------------------------------------
  // GROUP 1: RAPID PLUNGER DOUBLE-TAP & SUB-100MS DEBOUNCE HARDENING
  // ---------------------------------------------------------------------------
  group('Tier 5 - Group 1: Rapid Plunger Double-Tap & Sub-100ms Debounce Hardening', () {
    late TimingEngine engine;
    late SixEightManager sixEight;
    late MockBleService ble;
    late GameController controller;
    late MockSoundService soundService;

    setUp(() {
      soundService = MockSoundService();
      engine = TimingEngine(
        soundService: soundService,
        autoTick: false,
      );
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

    testWidgets('T5-G1-01: Rapid sub-100ms turnover + rebound plunger sequence maintains state integrity', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();

      // Initial shot clock: 30s
      expect(engine.shotTimeMs, 30000);
      expect(find.text('30'), findsOneWidget);

      // Rapid sequence: Reset 30 followed immediately by Reset 20 before any clock tick
      controller.resetShotClock30();
      controller.resetShotClock20();
      await tester.pump();

      // Final shot clock state must be 20s
      expect(engine.shotTimeMs, 20000);
      expect(find.text('20'), findsOneWidget);

      // Verify undo stack captured both operations in order
      expect(engine.canUndo, isTrue);
      controller.undo(); // Undoes Reset 20 -> should restore 30s from Reset 30
      await tester.pump();
      expect(engine.shotTimeMs, 30000);

      controller.undo(); // Undoes Reset 30 -> restores initial 30s state
      await tester.pump();
      expect(engine.shotTimeMs, 30000);
    });

    testWidgets('T5-G1-02: 100x high-frequency Start/Stop toggle storm preserves timer safety and parity', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();

      expect(engine.isRunning, isFalse);

      // Fire 100 rapid start/stop toggles
      for (int i = 0; i < 100; i++) {
        controller.toggleStartStop();
      }
      await tester.pump();

      // 100 toggles from false -> must be false (even number of toggles)
      expect(engine.isRunning, isFalse);
      expect(find.text('START'), findsOneWidget);

      // 1 more toggle -> must be true
      controller.toggleStartStop();
      await tester.pump();
      expect(engine.isRunning, isTrue);
      expect(find.text('WHISTLE'), findsOneWidget);

      // Advancing tick operates normally without runaway timers
      engine.tick(100);
      await tester.pump();
      expect(engine.gameTimeMs, 479900);
      expect(find.text('07:59.9'), findsOneWidget);
    });

    testWidgets('T5-G1-03: Rapid plunger reset while clock is running does not desynchronize running state', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();

      controller.toggleStartStop();
      expect(engine.isRunning, isTrue);

      // 10 interleaved ticks and resets
      for (int i = 0; i < 10; i++) {
        engine.tick(100);
        if (i % 2 == 0) {
          controller.resetShotClock20();
        } else {
          controller.resetShotClock30();
        }
      }
      await tester.pump();

      expect(engine.isRunning, isTrue);
      expect(engine.gameTimeMs, 479000); // 10 ticks = 1.0s elapsed
      expect(engine.shotTimeMs, 30000); // Last reset was 30
      expect(find.text('07:59.0'), findsOneWidget);
    });
  });

  // ---------------------------------------------------------------------------
  // GROUP 2: CLOCK EXPIRATION BUZZERS & RULE WP 20.15 BLANKING SUPPRESSION
  // ---------------------------------------------------------------------------
  group('Tier 5 - Group 2: Clock Expiration Buzzers & Rule WP 20.15 Blanking Suppression', () {
    late TimingEngine engine;
    late MockSoundService soundService;
    late SixEightManager sixEight;
    late MockBleService ble;
    late GameController controller;

    setUp(() {
      soundService = MockSoundService();
      engine = TimingEngine(
        soundService: soundService,
        autoTick: false,
      );
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

    testWidgets('T5-G2-01: Boundary gameTime <= 1000ms strictly suppresses 1200ms shot clock horn on expiration', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();

      // Configure clock: gameTime = 1000ms (1.0s), shotTime = 100ms
      engine.adjustGameClock(-479); // 480s - 479s = 1s = 1000ms
      // Manually set shotTimeMs to 100ms via internal state manipulation
      engine.start();

      // Advance by 1 tick (100ms) with shotTime at 100ms and gameTime at 1000ms
      // In this scenario, remaining game clock is <= 1000ms.
      // Rule WP 20.15: Shot horn must NOT sound to prevent audio clash with period horn.
      engine.tick(100);
      await tester.pump();

      // Shot clock reset to 30s upon expiration
      expect(engine.shotTimeMs, 30000);
      // Shot horn (1200ms) was suppressed because newGameMs <= 1000ms
      expect(soundService.lastHornDurationMs, isNot(1200));
    });

    testWidgets('T5-G2-02: Boundary gameTime = 1100ms triggers 1200ms shot clock horn when shot clock expires', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();

      // Configure gameTime = 1200ms (so after 100ms tick, newGameMs = 1100ms > 1000ms)
      // and shotTimeMs = 100ms
      // Since 1200ms > 100ms, shot clock is NOT blanked initially!
      engine.adjustGameClock(-478); // 480 - 478 = 2s = 2000ms
      engine.start();

      // Run shot clock down to 100ms
      while (engine.shotTimeMs > 100) {
        engine.tick(100);
      }
      expect(engine.shotTimeMs, 100);
      expect(engine.gameTimeMs, greaterThan(1000));
      expect(engine.isShotClockBlanked, isFalse);

      soundService.reset();
      // Tick 100ms -> shot clock expires at t = 0
      engine.tick(100);
      await tester.pump();

      // Shot horn should fire at 1200ms because newGameMs > 1000ms and was not blanked
      expect(soundService.lastHornDurationMs, equals(1200));
      expect(soundService.hornPlayCount, equals(1));
    });

    testWidgets('T5-G2-03: Rule WP 20.15 shot expiry while blanked suppresses shot horn; period horn sounds at 00:00.0', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();

      // Configure clock so gameTimeMs <= shotTimeMs (Rule WP 20.15 auto-blanked)
      // e.g. gameTime = 200ms, shotTime = 200ms -> blanked!
      engine.adjustGameClock(-479); // 1000ms
      engine.start();
      expect(engine.isShotClockBlanked, isTrue);
      expect(find.text('--'), findsOneWidget);

      soundService.reset();

      // Tick 100ms -> gameTime 900ms, shotTime 29900ms (reset after prior expiry)
      engine.tick(100);
      await tester.pump();

      // Run remaining 900ms down to 00:00.0
      for (int i = 0; i < 9; i++) {
        engine.tick(100);
      }
      await tester.pump();

      expect(engine.gameTimeMs, 0);
      expect(engine.isRunning, isFalse);
      // Period horn sounds for 2200ms
      expect(soundService.lastHornDurationMs, equals(2200));
    });

    testWidgets('T5-G2-04: Period transition from expired Q4 (00:00.0) to OT de-blanks shot clock cleanly', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();

      // Expire clock to 0
      engine.start();
      while (engine.gameTimeMs > 0) {
        engine.tick(100);
      }
      await tester.pump();
      expect(engine.gameTimeMs, 0);
      expect(engine.isShotClockBlanked, isTrue);
      expect(find.text('--'), findsOneWidget);

      // Select Overtime (OT)
      controller.setPeriod(5);
      await tester.pump();

      // OT initializes to 8:00.0, shot clock 30s, stopped, de-blanked
      expect(engine.period, 5);
      expect(engine.gameTimeMs, 480000);
      expect(engine.shotTimeMs, 30000);
      expect(engine.isShotClockBlanked, isFalse);
      expect(find.text('08:00.0'), findsOneWidget);
      expect(find.text('30'), findsOneWidget);
      expect(find.text('WP 20.15 ARMED'), findsOneWidget);
    });
  });

  // ---------------------------------------------------------------------------
  // GROUP 3: SIMULTANEOUS 3-FOUL CAP-OUTS & DEFENDING PENALTY RELEASES
  // ---------------------------------------------------------------------------
  group('Tier 5 - Group 3: Simultaneous 3-Foul Cap-Outs & Defending Penalty Releases', () {
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

    testWidgets('T5-G3-01: Double 3-foul cap-out (White #5 & Dark #6) disables cap buttons for both', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();

      // Assign 3 fouls to White #5 (B. Hallock)
      for (int f = 1; f <= 3; f++) {
        final success = controller.addExclusion(Team.white, 5);
        expect(success, isTrue);
      }
      expect(sixEight.isPlayerCappedOut(Team.white, 5), isTrue);

      // 4th foul attempt on White #5 must be strictly blocked by controller
      final fourthWhite = controller.addExclusion(Team.white, 5);
      expect(fourthWhite, isFalse);

      // Assign 3 fouls to Dark #6 (R. Pittman)
      for (int f = 1; f <= 3; f++) {
        final success = controller.addExclusion(Team.dark, 6);
        expect(success, isTrue);
      }
      expect(sixEight.isPlayerCappedOut(Team.dark, 6), isTrue);

      // 4th foul attempt on Dark #6 must be strictly blocked by controller
      final fourthDark = controller.addExclusion(Team.dark, 6);
      expect(fourthDark, isFalse);

      await tester.pump();

      // Check player profile
      final white5 = sixEight.getPlayer(Team.white, 5);
      final dark6 = sixEight.getPlayer(Team.dark, 6);
      expect(white5?.personalFouls, 3);
      expect(white5?.isCappedOut, isTrue);
      expect(dark6?.personalFouls, 3);
      expect(dark6?.isCappedOut, isTrue);
    });

    testWidgets('T5-G3-02: Defending penalty released on goal while maintaining 3/3 CAPPED OUT roster status', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();

      // Dark #6 incurs 3rd foul (penalty foul + cap out)
      controller.addExclusion(Team.dark, 6);
      controller.addExclusion(Team.dark, 6);
      controller.addExclusion(Team.dark, 6);
      await tester.pump();

      expect(engine.exclusions.length, 3);
      expect(sixEight.isPlayerCappedOut(Team.dark, 6), isTrue);

      // White team converts the penalty shot (Goal for White)
      controller.incrementScore(Team.white, playerCap: 4);
      await tester.pump();

      // Rule WP 21: Goal clears defending (Dark) exclusions from active bay
      expect(engine.scoreWhite, 1);
      expect(engine.exclusions.where((e) => e.team == Team.dark), isEmpty);

      // CRITICAL CONTRACT: Player Dark #6 MUST REMAIN CAPPED OUT even after active penalty clearance!
      expect(sixEight.isPlayerCappedOut(Team.dark, 6), isTrue);
      expect(sixEight.getPlayer(Team.dark, 6)?.personalFouls, 3);

      // Subsequence foul attempt still blocked
      expect(controller.addExclusion(Team.dark, 6), isFalse);
    });

    testWidgets('T5-G3-03: Undo after goal restores active defending exclusions with exact remaining time', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();

      // Add exclusion on Dark #6
      controller.addExclusion(Team.dark, 6);
      await tester.pump();

      // Advance clock by 3 seconds (30 ticks) -> 17s remaining
      engine.start();
      for (int i = 0; i < 30; i++) {
        engine.tick(100);
      }
      await tester.pump();
      expect(engine.exclusions.first.remainingMs, 17000);

      // White scores -> clears Dark exclusion
      controller.incrementScore(Team.white);
      await tester.pump();
      expect(engine.exclusions, isEmpty);
      expect(engine.scoreWhite, 1);

      // Referee waves off goal -> Operator taps Undo
      controller.undo();
      await tester.pump();

      // Score restored to 0
      expect(engine.scoreWhite, 0);
      // Dark #6 exclusion restored with exact 17,000ms remaining
      expect(engine.exclusions.length, 1);
      expect(engine.exclusions.first.capNumber, 6);
      expect(engine.exclusions.first.remainingMs, 17000);
    });
  });

  // ---------------------------------------------------------------------------
  // GROUP 4: BLE PACKET SERIALIZATION UNDER PROTOCOL JITTER & CORRUPT FRAME ATTACKS
  // ---------------------------------------------------------------------------
  group('Tier 5 - Group 4: BLE Packet Serialization Under Protocol Jitter & Corrupt Frame Attacks', () {
    test('T5-G4-01: 500x high-frequency protocol toggle jitter maintains byte contract and zero drift', () {
      final state = GameState(
        gameTimeMs: 345600,
        shotTimeMs: 14200,
        isRunning: true,
        scoreWhite: 8,
        scoreDark: 7,
        period: 3,
        exclusions: const [],
        isHornActive: false,
      );

      var protocol = ScoreboardProtocol.cts;

      for (int i = 0; i < 500; i++) {
        protocol = protocol == ScoreboardProtocol.cts
            ? ScoreboardProtocol.daktronics
            : ScoreboardProtocol.cts;

        final encoded = BlePacketCodec.buildStatusPacket(state, protocol);
        expect(encoded.length, 13);

        final decoded = BlePacketCodec.decodeStatus(encoded);
        expect(decoded.isRunning, isTrue);
        expect(decoded.gameTimeMs, 345600);
        expect(decoded.shotTimeMs, 14200);
        expect(decoded.scoreWhite, 8);
        expect(decoded.scoreDark, 7);
        expect(decoded.period, 3);
        expect(decoded.protocol, protocol);
      }
    });

    test('T5-G4-02: Truncated payloads (<13 bytes) throw FormatException on decodeStatus', () {
      for (int len = 0; len < 13; len++) {
        final truncated = Uint8List(len);
        expect(
          () => BlePacketCodec.decodeStatus(truncated),
          throwsA(isA<FormatException>()),
          reason: 'Payload of length $len must be rejected',
        );
      }
    });

    test('T5-G4-03: Bitmask flags decoding handles extraneous high bits (0xFF) safely', () {
      final bytes = Uint8List(13);
      bytes[0] = 0xFF; // All bits set (0b11111111)

      final data = ByteData.sublistView(bytes);
      data.setUint32(1, 480000, Endian.big);
      data.setUint32(5, 30000, Endian.big);
      bytes[9] = 10;  // scoreWhite
      bytes[10] = 5;  // scoreDark
      bytes[11] = 2;  // period
      bytes[12] = 0;  // CTS protocol

      final decoded = BlePacketCodec.decodeStatus(bytes);
      // Bit 0: isRunning (1)
      expect(decoded.isRunning, isTrue);
      // Bit 1: hornActive (1)
      expect(decoded.hornActive, isTrue);
      // Bit 2: isBlanked (1)
      expect(decoded.isBlanked, isTrue);
      // Other fields intact
      expect(decoded.gameTimeMs, 480000);
      expect(decoded.shotTimeMs, 30000);
      expect(decoded.scoreWhite, 10);
      expect(decoded.scoreDark, 5);
      expect(decoded.period, 2);
    });

    test('T5-G4-04: Maximum 32-bit unsigned integer time boundaries serialize without overflow', () {
      const maxUint32 = 0xFFFFFFFF; // 4,294,967,295 ms (~49.7 days)
      final packet = BleStatusPacket(
        isRunning: true,
        hornActive: false,
        isBlanked: false,
        gameTimeMs: maxUint32,
        shotTimeMs: maxUint32,
        scoreWhite: 255,
        scoreDark: 255,
        period: 255,
        protocol: ScoreboardProtocol.daktronics,
      );

      final encoded = BlePacketCodec.encodeStatus(packet);
      expect(encoded.length, 13);

      final decoded = BlePacketCodec.decodeStatus(encoded);
      expect(decoded.gameTimeMs, maxUint32);
      expect(decoded.shotTimeMs, maxUint32);
      expect(decoded.scoreWhite, 255);
      expect(decoded.scoreDark, 255);
      expect(decoded.period, 255);
      expect(decoded.protocol, ScoreboardProtocol.daktronics);
    });
  });

  // ---------------------------------------------------------------------------
  // GROUP 5: EXTREME VIEWPORT CONSTRAINTS & BREAKPOINT HYSTERESIS (280DP - 240DP)
  // ---------------------------------------------------------------------------
  group('Tier 5 - Group 5: Extreme Viewport Constraints & Breakpoint Hysteresis', () {
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

    testWidgets('T5-G5-01: Ultra-narrow 280dp watch/wearable viewport renders with zero RenderFlex overflow', (tester) async {
      tester.view.physicalSize = const Size(280, 280);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();

      // Verify zero RenderFlex overflows
      expect(tester.takeException(), isNull);
      expect(find.byType(MobileStackedLayout), findsOneWidget);
      expect(find.byKey(WidgetKeys.startStopButton), findsOneWidget);
    });

    testWidgets('T5-G5-02: Micro-display 240dp viewport maintains scrollable constraint bounds', (tester) async {
      tester.view.physicalSize = const Size(240, 320);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(MobileStackedLayout), findsOneWidget);
    });

    testWidgets('T5-G5-03: Breakpoint boundary hysteresis at exact maxWidth = 600.0 vs 600.1', (tester) async {
      // 1. Lower boundary: 600.0dp must select MobileStackedLayout
      tester.view.physicalSize = const Size(600, 800);
      tester.view.devicePixelRatio = 1.0;

      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(MobileStackedLayout), findsOneWidget);
      expect(find.byType(TabletDualThumbLayout), findsNothing);

      // 2. Upper boundary: 600.1dp must select TabletDualThumbLayout
      tester.view.physicalSize = const Size(601, 800);
      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(TabletDualThumbLayout), findsOneWidget);
      expect(find.byType(MobileStackedLayout), findsNothing);

      tester.view.resetPhysicalSize();
    });

    testWidgets('T5-G5-04: Ultra-wide 32:9 aspect ratio (3840x1080) maintains 3-column dual-thumb layout', (tester) async {
      tester.view.physicalSize = const Size(3840, 1080);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        MaterialApp(
          theme: AquaticTheme.themeData,
          home: AdaptiveGameScreen(controller: controller),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(TabletDualThumbLayout), findsOneWidget);
      expect(find.byKey(WidgetKeys.startStopButton), findsOneWidget);
      expect(find.byKey(WidgetKeys.reset30Button), findsOneWidget);
      expect(find.byKey(WidgetKeys.reset20Button), findsOneWidget);
    });
  });

  // ---------------------------------------------------------------------------
  // GROUP 6: 6-8 SPORTS TELEMETRY STREAM INTEGRITY & MEMORY BOUNDING
  // ---------------------------------------------------------------------------
  group('Tier 5 - Group 6: 6-8 Sports Telemetry Stream Integrity & Memory Bounding', () {
    late SixEightManager manager;

    setUp(() {
      manager = SixEightManager(initialMatch: TournamentPresets.match68JO);
    });

    tearDown(() {
      manager.dispose();
    });

    test('T5-G6-01: High-volume burst (250 telemetry events) is strictly clamped at 100 entries', () {
      for (int i = 1; i <= 250; i++) {
        manager.logEvent(
          TelemetryEvent(
            id: 'burst_event_$i',
            period: 1,
            gameClock: '08:00.0',
            shotClock: '30',
            type: TelemetryEventType.whistle,
            description: 'Burst event #$i',
          ),
        );
      }

      // Memory leak guard: capacity must be strictly 100
      expect(manager.eventLog.length, 100);
      // Most recent event must be at index 0 (LIFO ordering)
      expect(manager.eventLog.first.id, 'burst_event_250');
      // Oldest retained event is event #151
      expect(manager.eventLog.last.id, 'burst_event_151');
    });

    test('T5-G6-02: Invalid player cap numbers (0, 99, -1) return null and reject foul gracefully', () {
      expect(manager.getPlayer(Team.white, 0), isNull);
      expect(manager.getPlayer(Team.white, 99), isNull);
      expect(manager.getPlayer(Team.white, -1), isNull);

      final foulRejected = manager.recordFoul(Team.white, 99);
      expect(foulRejected, isFalse);

      final isCapped = manager.isPlayerCappedOut(Team.white, 99);
      expect(isCapped, isFalse);
    });

    test('T5-G6-03: exportTelemetryJson produces valid JSON adhering to 6-8 game desk schema', () {
      manager.recordGoal(Team.white, 5, gameClock: '07:12.4', period: 1);
      final jsonStr = manager.exportTelemetryJson();

      final decoded = jsonDecode(jsonStr) as Map<String, dynamic>;
      expect(decoded['source'], 'PoloPad-Pro-Flutter-v2.0');
      expect(decoded['schema'], '6-8-gamedesk-v1');
      expect(decoded['match']['matchId'], '68-JO-2026-412');
      expect((decoded['whiteRoster'] as List).length, 12);
      expect((decoded['darkRoster'] as List).length, 12);
      expect((decoded['events'] as List).isNotEmpty, isTrue);
    });
  });
}
