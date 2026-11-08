import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:polopad_pro/domain/models/team.dart';
import 'package:polopad_pro/domain/six_eight/models.dart';
import 'package:polopad_pro/domain/six_eight/six_eight_manager.dart';
import 'package:polopad_pro/infrastructure/mock_data/tournament_presets.dart';

void main() {
  group('6-8 Sports Tournament Presets & Models', () {
    test('Preset 68-JO-2026-412 contains 12 players per team with accurate PI ratings', () {
      final match = TournamentPresets.match68JO;
      expect(match.matchId, '68-JO-2026-412');
      expect(match.teamWhiteName, 'VANGUARD');
      expect(match.teamDarkName, 'STANFORD');
      expect(match.whiteRoster.length, 12);
      expect(match.darkRoster.length, 12);

      // Verify star player PI ratings
      final hallock = match.getPlayer(Team.white, 5);
      expect(hallock, isNotNull);
      expect(hallock!.name, 'B. Hallock');
      expect(hallock.position, Position.ctr);
      expect(hallock.piScore, 91.4);

      final weinberg = match.getPlayer(Team.dark, 1);
      expect(weinberg, isNotNull);
      expect(weinberg!.name, 'A. Weinberg');
      expect(weinberg.position, Position.gk);
      expect(weinberg.piScore, 86.8);
    });

    test('Preset 68-ODP-2026-108 contains 8 players per team', () {
      final match = TournamentPresets.match68ODP;
      expect(match.matchId, '68-ODP-2026-108');
      expect(match.teamWhiteName, 'PAC-SW');
      expect(match.teamDarkName, 'COASTAL');
      expect(match.whiteRoster.length, 8);
      expect(match.darkRoster.length, 8);

      final steffens = match.getPlayer(Team.white, 6);
      expect(steffens, isNotNull);
      expect(steffens!.name, 'M. Steffens');
      expect(steffens.position, Position.def);
      expect(steffens.piScore, 93.0);
    });

    test('Preset 68-KAP7-2026-889 contains 5 players per team', () {
      final match = TournamentPresets.match68KAP7;
      expect(match.matchId, '68-KAP7-2026-889');
      expect(match.teamWhiteName, 'NEWPORT');
      expect(match.teamDarkName, 'J-SERRA');
      expect(match.whiteRoster.length, 5);
      expect(match.darkRoster.length, 5);

      final dodd = match.getPlayer(Team.dark, 2);
      expect(dodd, isNotNull);
      expect(dodd!.name, 'B. Dodd');
      expect(dodd.position, Position.atk);
      expect(dodd.piScore, 87.3);
    });

    test('TournamentPresets lookup by ID and allMatches catalog', () {
      expect(TournamentPresets.allMatches.length, 3);
      expect(TournamentPresets.getMatchById('68-ODP-2026-108'), isNotNull);
      expect(TournamentPresets.getMatchById('nonexistent'), isNull);
    });

    test('Position parsing handles case insensitivity and fallback', () {
      expect(Position.fromString('gk'), Position.gk);
      expect(Position.fromString('ATK'), Position.atk);
      expect(Position.fromString('unknown'), Position.utl);
    });
  });

  group('3-Foul Personal Exclusion Tracking & 3-Dot Visual Indicators', () {
    test('Player foul progression: 0/3, 1/3, 2/3, up to 3/3 CAPPED OUT', () {
      var player = const RosterPlayer(
        capNumber: 7,
        name: 'Test Player',
        position: Position.atk,
        piScore: 85.0,
        personalFouls: 0,
      );

      // 0 Fouls
      expect(player.personalFouls, 0);
      expect(player.fouls, 0);
      expect(player.hasFirstFoul, isFalse);
      expect(player.hasSecondFoul, isFalse);
      expect(player.hasThirdFoul, isFalse);
      expect(player.isCappedOut, isFalse);
      expect(player.foulDisplay, '0/3');

      // 1 Foul
      player = player.copyWith(personalFouls: 1);
      expect(player.hasFirstFoul, isTrue);
      expect(player.hasSecondFoul, isFalse);
      expect(player.hasThirdFoul, isFalse);
      expect(player.isCappedOut, isFalse);
      expect(player.foulDisplay, '1/3');

      // 2 Fouls
      player = player.copyWith(personalFouls: 2);
      expect(player.hasFirstFoul, isTrue);
      expect(player.hasSecondFoul, isTrue);
      expect(player.hasThirdFoul, isFalse);
      expect(player.isCappedOut, isFalse);
      expect(player.foulDisplay, '2/3');

      // 3 Fouls -> CAPPED OUT
      player = player.copyWith(personalFouls: 3);
      expect(player.hasFirstFoul, isTrue);
      expect(player.hasSecondFoul, isTrue);
      expect(player.hasThirdFoul, isTrue);
      expect(player.isCappedOut, isTrue);
      expect(player.foulDisplay, '3/3 CAPPED OUT');
    });

    test('RosterPlayer serialization to and from JSON', () {
      const original = RosterPlayer(
        capNumber: 5,
        name: 'B. Hallock',
        position: Position.ctr,
        piScore: 91.4,
        goals: 2,
        personalFouls: 1,
        steals: 1,
      );

      final json = original.toJson();
      final deserialized = RosterPlayer.fromJson(json);

      expect(deserialized.capNumber, original.capNumber);
      expect(deserialized.name, original.name);
      expect(deserialized.position, original.position);
      expect(deserialized.piScore, original.piScore);
      expect(deserialized.goals, original.goals);
      expect(deserialized.personalFouls, original.personalFouls);
      expect(deserialized.steals, original.steals);
      expect(deserialized, equals(original));
    });
  });

  group('SixEightManager Roster and Foul Management', () {
    late SixEightManager manager;

    setUp(() {
      manager = SixEightManager(initialMatch: TournamentPresets.match68JO);
    });

    tearDown(() {
      manager.dispose();
    });

    test('Initial match setup loads rosters and logs match sync event', () {
      expect(manager.activeMatch.matchId, '68-JO-2026-412');
      expect(manager.whiteRoster.length, 12);
      expect(manager.darkRoster.length, 12);
      expect(manager.eventLog.isNotEmpty, isTrue);
      expect(manager.eventLog.first.type, TelemetryEventType.matchSync);
    });

    test('Foul recording up to 3 fouls, and rejecting 4th ejection (Cap-Out Guard)', () {
      // Cap #5 B. Hallock starts with 0 fouls
      expect(manager.isPlayerCappedOut(Team.white, 5), isFalse);

      // Foul 1
      final foul1Ok = manager.recordFoul(Team.white, 5, gameClock: '07:30.0', shotClock: '20');
      expect(foul1Ok, isTrue);
      expect(manager.getPlayer(Team.white, 5)!.personalFouls, 1);
      expect(manager.isPlayerCappedOut(Team.white, 5), isFalse);

      // Foul 2
      final foul2Ok = manager.recordFoul(Team.white, 5, gameClock: '05:15.0', shotClock: '20');
      expect(foul2Ok, isTrue);
      expect(manager.getPlayer(Team.white, 5)!.personalFouls, 2);
      expect(manager.isPlayerCappedOut(Team.white, 5), isFalse);

      // Foul 3: Triggers cap-out
      final foul3Ok = manager.recordFoul(Team.white, 5, gameClock: '03:00.0', shotClock: '20');
      expect(foul3Ok, isTrue);
      expect(manager.getPlayer(Team.white, 5)!.personalFouls, 3);
      expect(manager.isPlayerCappedOut(Team.white, 5), isTrue);

      // Verify telemetry event for 3rd foul notes CAPPED OUT
      expect(manager.eventLog.first.type, TelemetryEventType.exclusion20s);
      expect(manager.eventLog.first.description, contains('CAPPED OUT'));

      // Foul 4: Attempting to eject an already capped-out player must return false and NOT increment fouls
      final foul4Ok = manager.recordFoul(Team.white, 5, gameClock: '02:00.0', shotClock: '20');
      expect(foul4Ok, isFalse);
      expect(manager.getPlayer(Team.white, 5)!.personalFouls, 3);
      expect(manager.isPlayerCappedOut(Team.white, 5), isTrue);
    });

    test('Goal recording increments player goal tally and logs event', () {
      final initialGoals = manager.getPlayer(Team.white, 3)!.goals;
      manager.recordGoal(Team.white, 3, gameClock: '06:45.2', shotClock: '14');

      expect(manager.getPlayer(Team.white, 3)!.goals, initialGoals + 1);
      expect(manager.eventLog.first.type, TelemetryEventType.goal);
      expect(manager.eventLog.first.capNumber, 3);
      expect(manager.eventLog.first.description, contains('C. Dodd'));
    });

    test('Match selection updates rosters and active match', () {
      manager.selectMatchById('68-KAP7-2026-889');
      expect(manager.activeMatch.matchId, '68-KAP7-2026-889');
      expect(manager.whiteRoster.length, 5);
      expect(manager.darkRoster.length, 5);
      expect(manager.eventLog.first.type, TelemetryEventType.matchSync);
      expect(manager.eventLog.first.description, contains('68-KAP7-2026-889'));
    });

    test('Telemetry log is capped at 100 entries', () {
      for (int i = 0; i < 120; i++) {
        manager.logEvent(
          TelemetryEvent(
            id: 'ev_$i',
            period: 1,
            gameClock: '08:00.0',
            shotClock: '30',
            type: TelemetryEventType.undo,
            scoreSnapshot: '0 - 0',
            description: 'Test event $i',
          ),
        );
      }
      expect(manager.eventLog.length, 100);
      expect(manager.eventLog.first.description, 'Test event 119');
    });

    test('JSON export produces valid schema and structure', () {
      final jsonStr = manager.exportTelemetryJson();
      final parsed = jsonDecode(jsonStr) as Map<String, dynamic>;

      expect(parsed['source'], 'PoloPad-Pro-Flutter-v2.0');
      expect(parsed['schema'], '6-8-gamedesk-v1');
      expect(parsed['match'], isNotNull);
      expect(parsed['whiteRoster'], isList);
      expect(parsed['darkRoster'], isList);
      expect(parsed['events'], isList);
    });
  });
}
