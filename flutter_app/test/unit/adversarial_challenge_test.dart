import 'package:flutter_test/flutter_test.dart';
import 'package:polopad_pro/core/audio/sound_service.dart';
import 'package:polopad_pro/domain/engine/timing_engine.dart';
import 'package:polopad_pro/domain/engine/undo_stack.dart';
import 'package:polopad_pro/domain/models/clock_snapshot.dart';
import 'package:polopad_pro/domain/models/exclusion.dart';
import 'package:polopad_pro/domain/models/game_state.dart';
import 'package:polopad_pro/domain/models/team.dart';

void main() {
  group('Adversarial Stress Test: Immutability & CopyWith Contract', () {
    test('GameState.exclusions is strictly unmodifiable', () {
      final state = GameState.initial();
      expect(state.exclusions, isEmpty);
      expect(
        () => state.exclusions.add(
          const Exclusion(id: 'bad', team: Team.white, capNumber: 1),
        ),
        throwsA(isA<UnsupportedError>()),
      );
    });

    test('External mutations to list passed to GameState constructor do not mutate GameState', () {
      final externalList = <Exclusion>[
        const Exclusion(id: 'e1', team: Team.white, capNumber: 2, remainingMs: 20000),
      ];
      final state = GameState(
        gameTimeMs: 480000,
        shotTimeMs: 30000,
        isRunning: false,
        scoreWhite: 0,
        scoreDark: 0,
        period: 1,
        exclusions: externalList,
      );

      // Mutate external list
      externalList.add(
        const Exclusion(id: 'e2', team: Team.dark, capNumber: 3, remainingMs: 20000),
      );

      expect(state.exclusions.length, 1);
      expect(state.exclusions.first.id, 'e1');
    });

    test('GameState.copyWith yields a fresh, distinct instance', () {
      final state1 = GameState.initial();
      final state2 = state1.copyWith(scoreWhite: 1);

      expect(identical(state1, state2), false);
      expect(state1.scoreWhite, 0);
      expect(state2.scoreWhite, 1);
      expect(state1.gameTimeMs, state2.gameTimeMs);
    });

    test('Exclusion model is strictly immutable and copyWith yields distinct instance', () {
      const exc1 = Exclusion(id: '1', team: Team.white, capNumber: 7, remainingMs: 20000);
      final exc2 = exc1.copyWith(remainingMs: 19900);

      expect(identical(exc1, exc2), false);
      expect(exc1.remainingMs, 20000);
      expect(exc2.remainingMs, 19900);
      expect(exc2.id, exc1.id);
      expect(exc2.capNumber, exc1.capNumber);
      expect(exc2.team, exc1.team);
    });

    test('ClockSnapshot.exclusions is strictly unmodifiable', () {
      final snapshot = ClockSnapshot(
        gameTimeMs: 480000,
        shotTimeMs: 30000,
        isRunning: false,
        scoreWhite: 0,
        scoreDark: 0,
        period: 1,
        exclusions: const [],
      );

      expect(
        () => snapshot.exclusions.add(
          const Exclusion(id: 'bad', team: Team.white, capNumber: 1),
        ),
        throwsA(isA<UnsupportedError>()),
      );
    });
  });

  group('Adversarial Stress Test: Penalty Cancellation Rules', () {
    late TimingEngine engine;
    late MockSoundService mockSound;

    setUp(() {
      mockSound = MockSoundService();
      engine = TimingEngine(soundService: mockSound, autoTick: false);
    });

    tearDown(() {
      engine.dispose();
    });

    test('White goal terminates all Dark defending exclusions while White attacking exclusions remain active', () {
      // Add multiple exclusions to both teams
      engine.addExclusion(Team.white, 2); // White attacking
      engine.addExclusion(Team.white, 4); // White attacking
      engine.addExclusion(Team.dark, 3);  // Dark defending
      engine.addExclusion(Team.dark, 5);  // Dark defending

      expect(engine.exclusions.length, 4);

      // White scores
      engine.incrementScore(Team.white);

      expect(engine.scoreWhite, 1);
      expect(engine.scoreDark, 0);
      expect(engine.shotTimeMs, 30000); // Reset to 30s

      // Dark exclusions MUST be terminated
      final darkExclusions = engine.exclusions.where((e) => e.team == Team.dark).toList();
      expect(darkExclusions, isEmpty, reason: 'Defending Dark team exclusions must be terminated on White goal');

      // White exclusions MUST remain active
      final whiteExclusions = engine.exclusions.where((e) => e.team == Team.white).toList();
      expect(whiteExclusions.length, 2, reason: 'Attacking White team exclusions must remain active on White goal');
      expect(whiteExclusions.map((e) => e.capNumber), containsAll([2, 4]));
    });

    test('Dark goal terminates all White defending exclusions while Dark attacking exclusions remain active', () {
      // Add multiple exclusions to both teams
      engine.addExclusion(Team.white, 6); // White defending
      engine.addExclusion(Team.white, 8); // White defending
      engine.addExclusion(Team.dark, 7);  // Dark attacking

      expect(engine.exclusions.length, 3);

      // Dark scores
      engine.incrementScore(Team.dark);

      expect(engine.scoreDark, 1);
      expect(engine.scoreWhite, 0);
      expect(engine.shotTimeMs, 30000);

      // White exclusions MUST be terminated
      final whiteExclusions = engine.exclusions.where((e) => e.team == Team.white).toList();
      expect(whiteExclusions, isEmpty, reason: 'Defending White team exclusions must be terminated on Dark goal');

      // Dark exclusions MUST remain active
      final darkExclusions = engine.exclusions.where((e) => e.team == Team.dark).toList();
      expect(darkExclusions.length, 1, reason: 'Attacking Dark team exclusions must remain active on Dark goal');
      expect(darkExclusions.first.capNumber, 7);
    });

    test('Sequential goals by opposing teams correctly cancel defending penalties in sequence', () {
      engine.addExclusion(Team.dark, 2);
      engine.addExclusion(Team.white, 3);

      // 1. White scores -> Dark #2 cancelled, White #3 remains
      engine.incrementScore(Team.white);
      expect(engine.exclusions.length, 1);
      expect(engine.exclusions.first.team, Team.white);
      expect(engine.exclusions.first.capNumber, 3);

      // Dark gets another exclusion
      engine.addExclusion(Team.dark, 4);
      expect(engine.exclusions.length, 2);

      // 2. Dark scores -> White #3 cancelled, Dark #4 remains
      engine.incrementScore(Team.dark);
      expect(engine.exclusions.length, 1);
      expect(engine.exclusions.first.team, Team.dark);
      expect(engine.exclusions.first.capNumber, 4);
    });
  });

  group('Adversarial Stress Test: Shot Clock Reset on Exclusion', () {
    late TimingEngine engine;
    late MockSoundService mockSound;

    setUp(() {
      mockSound = MockSoundService();
      engine = TimingEngine(soundService: mockSound, autoTick: false);
    });

    tearDown(() {
      engine.dispose();
    });

    test('Adding exclusion resets shot clock from 30s to exactly 20s', () {
      expect(engine.shotTimeMs, 30000);
      engine.addExclusion(Team.white, 3);
      expect(engine.shotTimeMs, 20000);
      expect(engine.state.formattedShotTime, '20');
    });

    test('Adding exclusion resets shot clock from arbitrary elapsed time to exactly 20s', () {
      engine.start();
      // Tick 7.5 seconds (75 ticks)
      for (int i = 0; i < 75; i++) {
        engine.tick(100);
      }
      expect(engine.shotTimeMs, 22500);

      engine.addExclusion(Team.dark, 5);
      expect(engine.shotTimeMs, 20000);
      expect(engine.state.formattedShotTime, '20');
    });

    test('Adding exclusion resets shot clock from under 5s warning to 20s and clears warning', () {
      engine.resetShotClock20();
      engine.start();
      // Tick down to 3.2s
      for (int i = 0; i < 168; i++) {
        engine.tick(100);
      }
      expect(engine.shotTimeMs, 3200);
      expect(engine.state.isShotClockWarning, true);

      // Whistle blown for exclusion
      engine.addExclusion(Team.white, 9);
      expect(engine.shotTimeMs, 20000);
      expect(engine.state.isShotClockWarning, false);
      expect(engine.state.formattedShotTime, '20');
    });
  });

  group('Adversarial Stress Test: 1,000 Tick Numerical Precision & Zero Drift', () {
    late TimingEngine engine;
    late MockSoundService mockSound;

    setUp(() {
      mockSound = MockSoundService();
      engine = TimingEngine(soundService: mockSound, autoTick: false);
    });

    tearDown(() {
      engine.dispose();
    });

    test('1,000 tick cycles (100.0s) maintain exact integer precision and zero drift', () {
      engine.start();
      const initialGameMs = 480000;
      const initialShotMs = 30000;

      // Add an exclusion at tick 100
      // It should count down from 20000 to 0 and expire at tick 300
      bool exclusionAdded = false;

      for (int tick = 1; tick <= 1000; tick++) {
        if (tick == 100) {
          engine.addExclusion(Team.dark, 11);
          exclusionAdded = true;
          expect(engine.shotTimeMs, 20000);
        }

        engine.tick(100);

        // Verification of Game Clock precision at every single tick
        final expectedGameMs = initialGameMs - (tick * 100);
        expect(
          engine.gameTimeMs,
          expectedGameMs,
          reason: 'Game clock numerical drift detected at tick $tick',
        );

        // Verification of Exclusion decrement and natural expiration
        if (exclusionAdded && tick >= 100 && tick <= 299) {
          final ticksSinceAddition = tick - 100 + 1; // 1 tick at tick 100
          final expectedRem = 20000 - (ticksSinceAddition * 100);
          if (expectedRem > 0) {
            expect(engine.exclusions.length, 1);
            expect(engine.exclusions.first.remainingMs, expectedRem);
          } else {
            // Expired exactly after 200 ticks (20.0s) at tick 299
            expect(engine.exclusions, isEmpty);
          }
        } else if (tick >= 300) {
          expect(engine.exclusions, isEmpty);
        }
      }

      // Checkpoint at Tick 1000:
      // Exactly 100.0s elapsed (480,000ms - 100,000ms = 380,000ms = 6:20.0)
      expect(engine.gameTimeMs, 380000);
      expect(engine.state.formattedGameTime, '06:20.0');

      // Shot clock started at 20,000 at tick 100.
      // Ticks 100..299 (200 ticks = 20s): expires at tick 299 -> resets to 30,000ms.
      // Ticks 300..599 (300 ticks = 30s): expires at tick 599 -> resets to 30,000ms.
      // Ticks 600..899 (300 ticks = 30s): expires at tick 899 -> resets to 30,000ms.
      // Ticks 900..1000 (101 ticks = 10.1s): 30,000 - 10,100 = 19,900ms (19s).
      expect(engine.shotTimeMs, 19900);
      expect(engine.state.formattedShotTime, '19');

      // Expirations triggered horns at tick 299, 599, 899 -> 3 horns
      expect(mockSound.hornCount, 3);
    });
  });

  group('Adversarial Stress Test: Edge Cases and Invariants', () {
    test('Rule WP 20.15 sharp boundary check at exact equality', () {
      // 20000ms game vs 20000ms shot -> blanked
      final sEqual = GameState.initial().copyWith(gameTimeMs: 20000, shotTimeMs: 20000);
      expect(sEqual.isShotClockBlanked, true);
      expect(sEqual.formattedShotTime, '--');

      // 20100ms game vs 20000ms shot -> NOT blanked
      final sAbove = GameState.initial().copyWith(gameTimeMs: 20100, shotTimeMs: 20000);
      expect(sAbove.isShotClockBlanked, false);
      expect(sAbove.formattedShotTime, '20');

      // 19900ms game vs 20000ms shot -> blanked
      final sBelow = GameState.initial().copyWith(gameTimeMs: 19900, shotTimeMs: 20000);
      expect(sBelow.isShotClockBlanked, true);
      expect(sBelow.formattedShotTime, '--');
    });

    test('Undo stack strictly caps at depth 10 under burst load of 50 actions', () {
      final stack = UndoStack(maxDepth: 10);
      for (int i = 1; i <= 50; i++) {
        stack.push(
          ClockSnapshot(
            gameTimeMs: i * 1000,
            shotTimeMs: 30000,
            isRunning: false,
            scoreWhite: 0,
            scoreDark: 0,
            period: 1,
            exclusions: const [],
          ),
        );
        expect(stack.length <= 10, true);
      }
      expect(stack.length, 10);
      expect(stack.peek?.gameTimeMs, 50000);

      // Verify popped values are strictly 50000 down to 41000
      for (int i = 50; i >= 41; i--) {
        expect(stack.pop()?.gameTimeMs, i * 1000);
      }
      expect(stack.canUndo, false);
      expect(stack.pop(), isNull);
    });
  });
}
