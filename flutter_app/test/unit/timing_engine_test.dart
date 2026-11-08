import 'package:flutter_test/flutter_test.dart';
import 'package:polopad_pro/core/audio/sound_service.dart';
import 'package:polopad_pro/domain/engine/timing_engine.dart';
import 'package:polopad_pro/domain/models/team.dart';

void main() {
  group('TimingEngine Unit Tests', () {
    late TimingEngine engine;
    late MockSoundService mockSound;

    setUp(() {
      mockSound = MockSoundService();
      engine = TimingEngine(
        soundService: mockSound,
        autoTick: false, // Deterministic synchronous testing
      );
    });

    tearDown(() {
      engine.dispose();
    });

    test('Initial state defaults to 8:00.0, 30s shot clock, Q1, score 0-0', () {
      expect(engine.gameTimeMs, 480000);
      expect(engine.shotTimeMs, 30000);
      expect(engine.isRunning, false);
      expect(engine.scoreWhite, 0);
      expect(engine.scoreDark, 0);
      expect(engine.period, 1);
      expect(engine.exclusions, isEmpty);
      expect(engine.state.formattedGameTime, '08:00.0');
      expect(engine.state.formattedShotTime, '30');
      expect(engine.isShotClockBlanked, false);
    });

    test('Start and stop toggles isRunning and decrements clocks by 100ms per tick', () {
      engine.start();
      expect(engine.isRunning, true);
      expect(mockSound.clickCount, 1);

      // Single tick of 100ms
      engine.tick(100);
      expect(engine.gameTimeMs, 479900);
      expect(engine.shotTimeMs, 29900);
      expect(engine.state.formattedGameTime, '07:59.9');

      // 10 ticks = 1 second
      for (int i = 0; i < 9; i++) {
        engine.tick(100);
      }
      expect(engine.gameTimeMs, 479000); // 7:59.0
      expect(engine.shotTimeMs, 29000);  // 29s
      expect(engine.state.formattedShotTime, '29');

      engine.stop();
      expect(engine.isRunning, false);

      // Ticking while stopped does nothing
      engine.tick(100);
      expect(engine.gameTimeMs, 479000);
    });

    test('Reset 30 sets shot clock to 30,000ms', () {
      engine.start();
      for (int i = 0; i < 50; i++) {
        engine.tick(100); // 5s elapse
      }
      expect(engine.shotTimeMs, 25000);

      engine.resetShotClock30();
      expect(engine.shotTimeMs, 30000);
      expect(engine.state.formattedShotTime, '30');
    });

    test('Reset 20 sets shot clock to 20,000ms', () {
      engine.resetShotClock20();
      expect(engine.shotTimeMs, 20000);
      expect(engine.state.formattedShotTime, '20');
    });

    test('Sub-10s shot clock displays tenths (e.g. 9.4s)', () {
      engine.resetShotClock20();
      engine.start();
      // Tick down to 9.4s (106 ticks = 10.6s)
      for (int i = 0; i < 106; i++) {
        engine.tick(100);
      }
      expect(engine.shotTimeMs, 9400);
      expect(engine.state.formattedShotTime, '9.4');
    });

    test('Shot clock warning triggers below 5s', () {
      engine.resetShotClock20();
      engine.start();
      // Tick down to 4.9s (151 ticks = 15.1s)
      for (int i = 0; i < 151; i++) {
        engine.tick(100);
      }
      expect(engine.shotTimeMs, 4900);
      expect(engine.state.isShotClockWarning, true);
    });

    test('Shot clock expiration triggers shot horn and resets to 30s', () {
      engine.resetShotClock20();
      engine.start();
      // Tick 200 times (20.0s)
      for (int i = 0; i < 200; i++) {
        engine.tick(100);
      }
      expect(mockSound.hornCount, 1);
      expect(mockSound.lastHornDurationMs, 1200);
      expect(engine.shotTimeMs, 30000);
    });

    test('Period expiration stops clock and triggers 2200ms horn', () {
      // Set game clock near zero
      engine.adjustGameClock(-479); // 480 - 479 = 1s = 1000ms
      expect(engine.gameTimeMs, 1000);

      engine.start();
      for (int i = 0; i < 10; i++) {
        engine.tick(100);
      }

      expect(engine.gameTimeMs, 0);
      expect(engine.isRunning, false);
      expect(mockSound.hornCount, 1);
      expect(mockSound.lastHornDurationMs, 2200);
    });

    test('Adding exclusion resets shot clock to 20s and decrements on tick', () {
      engine.addExclusion(Team.white, 4);
      expect(engine.exclusions.length, 1);
      expect(engine.exclusions.first.capNumber, 4);
      expect(engine.exclusions.first.team, Team.white);
      expect(engine.exclusions.first.remainingMs, 20000);
      expect(engine.shotTimeMs, 20000); // Automatic reset 20s on ejection

      engine.start();
      engine.tick(100);
      expect(engine.exclusions.first.remainingMs, 19900);
    });

    test('Exclusion early release removes penalty immediately', () {
      engine.addExclusion(Team.dark, 2);
      final id = engine.exclusions.first.id;
      expect(engine.exclusions.length, 1);

      engine.releaseExclusion(id);
      expect(engine.exclusions, isEmpty);
    });

    test('Goal scored increments score, releases defending exclusions, and resets shot clock to 30s', () {
      engine.addExclusion(Team.dark, 3); // White has advantage
      expect(engine.exclusions.length, 1);

      engine.incrementScore(Team.white);
      expect(engine.scoreWhite, 1);
      expect(engine.shotTimeMs, 30000);
      expect(engine.exclusions, isEmpty); // Dark exclusion released on White goal
    });

    test('Score decrement clamps at zero', () {
      engine.decrementScore(Team.white);
      expect(engine.scoreWhite, 0);
    });

    test('Period change resets clocks, stops running, and clears exclusions', () {
      engine.start();
      engine.addExclusion(Team.white, 5);
      engine.setPeriod(2);

      expect(engine.period, 2);
      expect(engine.gameTimeMs, 480000);
      expect(engine.shotTimeMs, 30000);
      expect(engine.isRunning, false);
      expect(engine.exclusions, isEmpty);
      expect(engine.state.periodDisplay, 'Q2');
    });
  });
}
