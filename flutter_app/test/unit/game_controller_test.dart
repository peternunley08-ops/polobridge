import 'package:flutter_test/flutter_test.dart';
import 'package:polopad_pro/core/audio/sound_service.dart';
import 'package:polopad_pro/domain/engine/timing_engine.dart';
import 'package:polopad_pro/domain/models/team.dart';
import 'package:polopad_pro/domain/six_eight/models.dart';
import 'package:polopad_pro/domain/six_eight/six_eight_manager.dart';
import 'package:polopad_pro/infrastructure/ble/ble_dongle_service.dart';
import 'package:polopad_pro/infrastructure/ble/mock_ble_service.dart';
import 'package:polopad_pro/infrastructure/mock_data/tournament_presets.dart';
import 'package:polopad_pro/state/game_controller.dart';

void main() {
  group('GameController Central State Orchestration', () {
    late TimingEngine engine;
    late SixEightManager sixEight;
    late MockBleService ble;
    late GameController controller;

    setUp(() {
      engine = TimingEngine(
        soundService: MockSoundService(),
        autoTick: false,
      );
      sixEight = SixEightManager(initialMatch: TournamentPresets.match68JO);
      ble = MockBleService(autoConnect: true);
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

    test('Initial controller state binds default match, clocks, and CTS protocol', () {
      expect(controller.gameState.formattedGameTime, '08:00.0');
      expect(controller.gameState.formattedShotTime, '30');
      expect(controller.activeMatch.matchId, '68-JO-2026-412');
      expect(controller.activeProtocol, ScoreboardProtocol.cts);
      expect(controller.scoreSnapshot, 'VANGUARD 0 - 0 STANFORD');
    });

    test('toggleStartStop controls engine, logs telemetry, and dispatches BLE commands', () {
      ble.clearSentCommands();

      // Start Clock
      controller.toggleStartStop();
      expect(controller.engine.isRunning, isTrue);
      expect(ble.sentCommands.last, equals([0x02])); // 0x02 = START
      expect(controller.eventLog.first.type, TelemetryEventType.clockStart);

      // Stop Clock
      controller.toggleStartStop();
      expect(controller.engine.isRunning, isFalse);
      expect(ble.sentCommands.last, equals([0x01])); // 0x01 = STOP
      expect(controller.eventLog.first.type, TelemetryEventType.clockStop);
    });

    test('resetShotClock30 and resetShotClock20 dispatch opcodes 0x03 and 0x04', () {
      ble.clearSentCommands();

      controller.resetShotClock30();
      expect(controller.engine.shotTimeMs, 30000);
      expect(ble.sentCommands.last, equals([0x03]));
      expect(controller.eventLog.first.type, TelemetryEventType.turnoverReset30);

      controller.resetShotClock20();
      expect(controller.engine.shotTimeMs, 20000);
      expect(ble.sentCommands.last, equals([0x04]));
      expect(controller.eventLog.first.type, TelemetryEventType.reboundReset20);
    });

    test('Score increment with playerCap updates player stats, BLE scores, and logs GOAL', () {
      ble.clearSentCommands();
      final initialGoals = sixEight.getPlayer(Team.white, 5)!.goals;

      // Cap #5 scores goal
      controller.incrementScore(Team.white, playerCap: 5);

      expect(controller.engine.scoreWhite, 1);
      expect(sixEight.getPlayer(Team.white, 5)!.goals, initialGoals + 1);
      // BLE set scores: opcode 0x08, white=1, dark=0, period=1
      expect(ble.sentCommands.last, equals([0x08, 1, 0, 1]));
      expect(controller.eventLog.first.type, TelemetryEventType.goal);
      expect(controller.eventLog.first.description, contains('B. Hallock'));
    });

    test('Exclusion flow enforces 3-foul cap-out and prevents 4th ejection', () {
      ble.clearSentCommands();

      // Cap #5 B. Hallock starts with 0 fouls
      expect(sixEight.getPlayer(Team.white, 5)!.personalFouls, 0);

      // 1st foul
      final ok1 = controller.addExclusion(Team.white, 5);
      expect(ok1, isTrue);
      expect(controller.engine.exclusions.length, 1);
      expect(sixEight.getPlayer(Team.white, 5)!.personalFouls, 1);
      expect(ble.sentCommands.last, equals([0x04])); // Resets shot clock to 20s

      // 2nd foul
      final ok2 = controller.addExclusion(Team.white, 5);
      expect(ok2, isTrue);
      expect(controller.engine.exclusions.length, 2);
      expect(sixEight.getPlayer(Team.white, 5)!.personalFouls, 2);

      // 3rd foul (Cap-Out)
      final ok3 = controller.addExclusion(Team.white, 5);
      expect(ok3, isTrue);
      expect(controller.engine.exclusions.length, 3);
      expect(sixEight.getPlayer(Team.white, 5)!.personalFouls, 3);
      expect(sixEight.isPlayerCappedOut(Team.white, 5), isTrue);

      // 4th foul attempt on capped out player -> rejected
      final ok4 = controller.addExclusion(Team.white, 5);
      expect(ok4, isFalse);
      expect(controller.engine.exclusions.length, 3); // No new exclusion added
      expect(sixEight.getPlayer(Team.white, 5)!.personalFouls, 3);
    });

    test('Early release (REL) removes exclusion and logs telemetry', () {
      controller.addExclusion(Team.dark, 2);
      expect(controller.engine.exclusions.length, 1);
      final excId = controller.engine.exclusions.first.id;

      controller.releaseExclusion(excId);
      expect(controller.engine.exclusions, isEmpty);
      expect(controller.eventLog.first.type, TelemetryEventType.exclusionRelease);
      expect(controller.eventLog.first.description, contains('Early Release'));
    });

    test('Period change resets clocks, clears exclusions, and notifies BLE', () {
      controller.addExclusion(Team.white, 2);
      expect(controller.engine.exclusions.isNotEmpty, isTrue);

      ble.clearSentCommands();
      controller.setPeriod(2);

      expect(controller.engine.period, 2);
      expect(controller.engine.exclusions, isEmpty);
      expect(controller.engine.gameTimeMs, 480000);
      expect(controller.engine.shotTimeMs, 30000);
      expect(controller.eventLog.first.type, TelemetryEventType.periodChange);
    });

    test('1-Click State Undo reverts timing engine and synchronizes BLE', () {
      controller.incrementScore(Team.white);
      expect(controller.engine.scoreWhite, 1);

      controller.undo();
      expect(controller.engine.scoreWhite, 0);
      expect(controller.eventLog.first.type, TelemetryEventType.undo);
    });

    test('Protocol toggle alternates between CTS and Daktronics with telemetry logging', () {
      expect(controller.activeProtocol, ScoreboardProtocol.cts);

      controller.toggleProtocol();
      expect(controller.activeProtocol, ScoreboardProtocol.daktronics);
      expect(ble.sentCommands.last, equals([0x0B, 1]));
      expect(controller.eventLog.first.type, TelemetryEventType.protocolSwitch);
      expect(controller.eventLog.first.description, contains('DAKT CODE 4498'));

      controller.toggleProtocol();
      expect(controller.activeProtocol, ScoreboardProtocol.cts);
      expect(ble.sentCommands.last, equals([0x0B, 0]));
      expect(controller.eventLog.first.description, contains('CTS 9600-8-E-1'));
    });
  });
}
