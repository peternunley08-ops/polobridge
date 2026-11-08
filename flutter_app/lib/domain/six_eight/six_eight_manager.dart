import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../models/team.dart';
import '../../infrastructure/mock_data/tournament_presets.dart';
import 'models.dart';

/// Central 6-8 Sports Live Game Desk and Roster Sync Manager.
/// Tracks active match, player rosters, personal foul cap-outs (3-foul rule),
/// and live play-by-play telemetry stream.
class SixEightManager extends ChangeNotifier {
  TournamentMatch _activeMatch;
  List<RosterPlayer> _whiteRoster;
  List<RosterPlayer> _darkRoster;
  final List<TelemetryEvent> _eventLog = [];
  String _syncMode = 'cloud_live'; // 'cloud_live', 'local_bridge', 'disconnected'

  SixEightManager({TournamentMatch? initialMatch})
      : _activeMatch = initialMatch ?? TournamentPresets.defaultMatch,
        _whiteRoster = (initialMatch ?? TournamentPresets.defaultMatch)
            .whiteRoster
            .map((p) => p.copyWith())
            .toList(),
        _darkRoster = (initialMatch ?? TournamentPresets.defaultMatch)
            .darkRoster
            .map((p) => p.copyWith())
            .toList() {
    _logMatchSyncEvent(_activeMatch);
  }

  TournamentMatch get activeMatch => _activeMatch;
  List<RosterPlayer> get whiteRoster => List.unmodifiable(_whiteRoster);
  List<RosterPlayer> get darkRoster => List.unmodifiable(_darkRoster);
  List<TelemetryEvent> get eventLog => List.unmodifiable(_eventLog);
  String get syncMode => _syncMode;

  set syncMode(String mode) {
    _syncMode = mode;
    notifyListeners();
  }

  List<TournamentMatch> getAvailableMatches() => TournamentPresets.allMatches;

  void selectMatch(TournamentMatch match) {
    _activeMatch = match;
    _whiteRoster = match.whiteRoster.map((p) => p.copyWith()).toList();
    _darkRoster = match.darkRoster.map((p) => p.copyWith()).toList();
    _logMatchSyncEvent(match);
    notifyListeners();
  }

  void selectMatchById(String matchId) {
    final match = TournamentPresets.getMatchById(matchId);
    if (match != null) {
      selectMatch(match);
    }
  }

  RosterPlayer? getPlayer(Team team, int capNumber) {
    final roster = team == Team.white ? _whiteRoster : _darkRoster;
    try {
      return roster.firstWhere((p) => p.capNumber == capNumber);
    } catch (_) {
      return null;
    }
  }

  bool isPlayerCappedOut(Team team, int capNumber) {
    final player = getPlayer(team, capNumber);
    return player != null && player.isCappedOut;
  }

  /// Records an exclusion foul for [team] player #[capNumber].
  /// Returns `false` if the player is already capped out (3 fouls), preventing further ejections.
  /// Returns `true` if foul was recorded successfully.
  bool recordFoul(
    Team team,
    int capNumber, {
    String gameClock = '',
    String shotClock = '',
    int period = 1,
    String scoreSnapshot = '',
  }) {
    final roster = team == Team.white ? _whiteRoster : _darkRoster;
    final idx = roster.indexWhere((p) => p.capNumber == capNumber);
    if (idx == -1) return false;

    final current = roster[idx];
    if (current.isCappedOut) {
      return false; // Already 3/3 capped out; reject further foul additions
    }

    final newFouls = current.personalFouls + 1;
    final updated = current.copyWith(personalFouls: newFouls);
    if (team == Team.white) {
      _whiteRoster[idx] = updated;
    } else {
      _darkRoster[idx] = updated;
    }

    final teamName = team == Team.white ? _activeMatch.teamWhiteName : _activeMatch.teamDarkName;
    final cappedOutSuffix = newFouls >= 3 ? ' — CAPPED OUT' : '';
    final desc = '20s Exclusion on $teamName #$capNumber ${current.name} ($newFouls/3 Personal Fouls$cappedOutSuffix)';

    logEvent(
      TelemetryEvent(
        id: '${DateTime.now().microsecondsSinceEpoch}_excl_$capNumber',
        period: period,
        gameClock: gameClock,
        shotClock: shotClock,
        type: TelemetryEventType.exclusion20s,
        team: team,
        capNumber: capNumber,
        playerName: current.name,
        scoreSnapshot: scoreSnapshot,
        description: desc,
      ),
    );

    notifyListeners();
    return true;
  }

  /// Records a goal scored by [team] player #[capNumber].
  void recordGoal(
    Team team,
    int capNumber, {
    String gameClock = '',
    String shotClock = '',
    int period = 1,
    String scoreSnapshot = '',
  }) {
    final roster = team == Team.white ? _whiteRoster : _darkRoster;
    final idx = roster.indexWhere((p) => p.capNumber == capNumber);
    String playerName = 'Cap #$capNumber';
    if (idx != -1) {
      final current = roster[idx];
      playerName = current.name;
      final updated = current.copyWith(goals: current.goals + 1);
      if (team == Team.white) {
        _whiteRoster[idx] = updated;
      } else {
        _darkRoster[idx] = updated;
      }
    }

    final teamName = team == Team.white ? _activeMatch.teamWhiteName : _activeMatch.teamDarkName;
    logEvent(
      TelemetryEvent(
        id: '${DateTime.now().microsecondsSinceEpoch}_goal_$capNumber',
        period: period,
        gameClock: gameClock,
        shotClock: shotClock,
        type: TelemetryEventType.goal,
        team: team,
        capNumber: capNumber,
        playerName: playerName,
        scoreSnapshot: scoreSnapshot,
        description: 'GOAL by $teamName #$capNumber $playerName',
      ),
    );
    notifyListeners();
  }

  /// Appends an event to the top of the telemetry log (LIFO, max 100 entries).
  void logEvent(TelemetryEvent event) {
    _eventLog.insert(0, event);
    if (_eventLog.length > 100) {
      _eventLog.removeLast();
    }
    notifyListeners();
  }

  void _logMatchSyncEvent(TournamentMatch match) {
    logEvent(
      TelemetryEvent(
        id: '${DateTime.now().microsecondsSinceEpoch}_sync',
        period: 1,
        gameClock: '08:00.0',
        shotClock: '30',
        type: TelemetryEventType.matchSync,
        scoreSnapshot: '${match.teamWhiteName} 0 - 0 ${match.teamDarkName}',
        description: 'Imported 6-8 Sports Match ${match.matchId}: ${match.teamWhiteName} vs. ${match.teamDarkName}',
      ),
    );
  }

  /// Exports match data, rosters, and play-by-play telemetry as formatted JSON.
  String exportTelemetryJson() {
    final payload = {
      'source': 'PoloPad-Pro-Flutter-v2.0',
      'schema': '6-8-gamedesk-v1',
      'match': _activeMatch.toJson(),
      'whiteRoster': _whiteRoster.map((p) => p.toJson()).toList(),
      'darkRoster': _darkRoster.map((p) => p.toJson()).toList(),
      'events': _eventLog.map((e) => e.toJson()).toList(),
    };
    return const JsonEncoder.withIndent('  ').convert(payload);
  }
}
