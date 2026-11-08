import 'package:flutter_test/flutter_test.dart';
import 'package:polopad_pro/core/audio/sound_service.dart';
import 'package:polopad_pro/domain/engine/timing_engine.dart';
import 'package:polopad_pro/domain/models/game_state.dart';

void main() {
  group('World Aquatics Rule WP 20.15 Auto-Blanking Tests', () {
    late TimingEngine engine;
    late MockSoundService mockSound;

    setUp(() {
      mockSound = MockSoundService();
    });

    test('Shot clock displays normally when gameTimeMs > shotTimeMs', () {
      // 35s remaining in game, 30s shot clock
      final state = GameState.initial().copyWith(
        gameTimeMs: 35000,
        shotTimeMs: 30000,
      );
      expect(state.isShotClockBlanked, false);
      expect(state.formattedShotTime, '30');
    });

    test('Shot clock blanks (--) when gameTimeMs == shotTimeMs', () {
      // Exactly 20s remaining in game, 20s shot clock
      final state = GameState.initial().copyWith(
        gameTimeMs: 20000,
        shotTimeMs: 20000,
      );
      expect(state.isShotClockBlanked, true);
      expect(state.formattedShotTime, '--');
    });

    test('Shot clock blanks (--) when gameTimeMs < shotTimeMs', () {
      // 15s remaining in game, 30s shot clock
      final state = GameState.initial().copyWith(
        gameTimeMs: 15000,
        shotTimeMs: 30000,
      );
      expect(state.isShotClockBlanked, true);
      expect(state.formattedShotTime, '--');
    });

    test('Reset 30 at 15s game time triggers immediate blanking', () {
      engine = TimingEngine(
        initialState: GameState.initial().copyWith(gameTimeMs: 15000),
        soundService: mockSound,
        autoTick: false,
      );

      engine.resetShotClock30();
      expect(engine.shotTimeMs, 30000);
      expect(engine.isShotClockBlanked, true);
      expect(engine.state.formattedShotTime, '--');
    });

    test('Reset 20 at 18s game time triggers immediate blanking', () {
      engine = TimingEngine(
        initialState: GameState.initial().copyWith(gameTimeMs: 18000),
        soundService: mockSound,
        autoTick: false,
      );

      engine.resetShotClock20();
      expect(engine.shotTimeMs, 20000);
      expect(engine.isShotClockBlanked, true);
      expect(engine.state.formattedShotTime, '--');
    });

    test('Reset 20 at 25s game time does NOT blank', () {
      engine = TimingEngine(
        initialState: GameState.initial().copyWith(gameTimeMs: 25000),
        soundService: mockSound,
        autoTick: false,
      );

      engine.resetShotClock20();
      expect(engine.shotTimeMs, 20000);
      expect(engine.isShotClockBlanked, false);
      expect(engine.state.formattedShotTime, '20');
    });

    test('De-blanking occurs when game clock is adjusted above shot clock', () {
      engine = TimingEngine(
        initialState: GameState.initial().copyWith(
          gameTimeMs: 15000,
          shotTimeMs: 30000,
        ),
        soundService: mockSound,
        autoTick: false,
      );
      expect(engine.isShotClockBlanked, true);

      // Referee resets game clock to 8:00
      engine.resetGameClock800();
      expect(engine.gameTimeMs, 480000);
      expect(engine.isShotClockBlanked, false);
      expect(engine.state.formattedShotTime, '30');
    });

    test('Shot clock horn is SUPPRESSED upon expiry when game time < 1000ms', () {
      // 800ms left in game, 100ms left in shot clock (gameTimeMs > shotTimeMs)
      engine = TimingEngine(
        initialState: GameState.initial().copyWith(
          gameTimeMs: 800,
          shotTimeMs: 100,
          isRunning: true,
        ),
        soundService: mockSound,
        autoTick: false,
      );

      expect(engine.isShotClockBlanked, false);

      // Tick 100ms: shot clock expires
      engine.tick(100);
      // Shot horn must NOT sound because game time < 1000ms
      expect(mockSound.hornCount, 0);
    });

    test('Shot clock horn is SUPPRESSED upon expiry when blanked', () {
      // 100ms left in game, 100ms left in shot clock (gameTimeMs <= shotTimeMs)
      engine = TimingEngine(
        initialState: GameState.initial().copyWith(
          gameTimeMs: 100,
          shotTimeMs: 100,
          isRunning: true,
        ),
        soundService: mockSound,
        autoTick: false,
      );

      expect(engine.isShotClockBlanked, true);

      // Tick 100ms: shot clock and game clock expire
      engine.tick(100);
      // Shot horn (1200ms) is suppressed; period horn (2200ms) sounds
      expect(mockSound.hornCount, 1);
      expect(mockSound.lastHornDurationMs, 2200);
    });
  });
}

