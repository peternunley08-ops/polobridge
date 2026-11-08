import 'package:flutter_test/flutter_test.dart';
import 'package:polopad_pro/core/audio/sound_service.dart';
import 'package:polopad_pro/domain/engine/timing_engine.dart';
import 'package:polopad_pro/domain/engine/undo_stack.dart';
import 'package:polopad_pro/domain/models/clock_snapshot.dart';
import 'package:polopad_pro/domain/models/team.dart';

void main() {
  group('UndoStack Data Structure Tests', () {
    late UndoStack stack;

    setUp(() {
      stack = UndoStack(maxDepth: 10);
    });

    test('Fresh stack is empty with canUndo false', () {
      expect(stack.length, 0);
      expect(stack.canUndo, false);
      expect(stack.pop(), isNull);
      expect(stack.peek, isNull);
    });

    test('Push and pop follows LIFO order', () {
      final snap1 = ClockSnapshot(
        gameTimeMs: 480000,
        shotTimeMs: 30000,
        isRunning: false,
        scoreWhite: 0,
        scoreDark: 0,
        period: 1,
        exclusions: const [],
      );
      final snap2 = ClockSnapshot(
        gameTimeMs: 470000,
        shotTimeMs: 25000,
        isRunning: true,
        scoreWhite: 1,
        scoreDark: 0,
        period: 1,
        exclusions: const [],
      );

      stack.push(snap1);
      expect(stack.length, 1);
      expect(stack.canUndo, true);
      expect(stack.peek, snap1);

      stack.push(snap2);
      expect(stack.length, 2);
      expect(stack.peek, snap2);

      expect(stack.pop(), snap2);
      expect(stack.length, 1);
      expect(stack.pop(), snap1);
      expect(stack.length, 0);
      expect(stack.canUndo, false);
    });

    test('Stack limits depth to maxDepth (oldest dropped)', () {
      for (int i = 0; i < 15; i++) {
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
      }

      expect(stack.length, 10);
      // Top item should be i=14
      expect(stack.peek?.gameTimeMs, 14000);

      // Pop all 10 items
      final poppedGameTimes = <int>[];
      while (stack.canUndo) {
        poppedGameTimes.add(stack.pop()!.gameTimeMs);
      }
      expect(poppedGameTimes.length, 10);
      expect(poppedGameTimes.first, 14000);
      expect(poppedGameTimes.last, 5000); // 0..4 dropped
    });
  });

  group('TimingEngine 1-Click State Undo Tests', () {
    late TimingEngine engine;
    late MockSoundService mockSound;

    setUp(() {
      mockSound = MockSoundService();
      engine = TimingEngine(
        soundService: mockSound,
        autoTick: false,
      );
    });

    tearDown(() {
      engine.dispose();
    });

    test('Undo on empty stack does nothing', () {
      expect(engine.canUndo, false);
      engine.undo();
      expect(engine.gameTimeMs, 480000);
      expect(engine.shotTimeMs, 30000);
    });

    test('Undo restores start/stop state', () {
      expect(engine.isRunning, false);
      engine.toggleStartStop();
      expect(engine.isRunning, true);
      expect(engine.canUndo, true);

      engine.undo();
      expect(engine.isRunning, false);
    });

    test('Undo restores Reset 30 and Reset 20', () {
      engine.start();
      // Tick 5 seconds
      for (int i = 0; i < 50; i++) {
        engine.tick(100);
      }
      expect(engine.shotTimeMs, 25000);

      engine.resetShotClock20();
      expect(engine.shotTimeMs, 20000);

      engine.undo();
      expect(engine.shotTimeMs, 25000);
    });

    test('Undo restores score and exclusions on goal', () {
      engine.addExclusion(Team.dark, 5);
      expect(engine.exclusions.length, 1);
      expect(engine.scoreWhite, 0);

      engine.incrementScore(Team.white);
      expect(engine.scoreWhite, 1);
      expect(engine.exclusions, isEmpty); // Dark exclusion cleared by goal

      // Undo the goal
      engine.undo();
      expect(engine.scoreWhite, 0);
      expect(engine.exclusions.length, 1);
      expect(engine.exclusions.first.capNumber, 5);
    });

    test('Undo restores exclusions on early release (REL)', () {
      engine.addExclusion(Team.white, 4);
      final id = engine.exclusions.first.id;
      expect(engine.exclusions.length, 1);

      engine.releaseExclusion(id);
      expect(engine.exclusions, isEmpty);

      engine.undo();
      expect(engine.exclusions.length, 1);
      expect(engine.exclusions.first.capNumber, 4);
    });
  });
}
