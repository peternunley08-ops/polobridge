import '../models/team.dart';

/// Water Polo player field positions.
enum Position {
  gk('GK', 'Goalkeeper'),
  ctr('CTR', 'Center'),
  def('DEF', 'Defender'),
  utl('UTL', 'Utility'),
  atk('ATK', 'Attacker'),
  drv('DRV', 'Driver');

  final String code;
  final String displayName;
  const Position(this.code, this.displayName);

  static Position fromString(String val) {
    final normalized = val.trim().toUpperCase();
    for (final p in Position.values) {
      if (p.code == normalized) return p;
    }
    return Position.utl;
  }
}

/// Represents an individual water polo player with their 6-8 Sports analytics and match foul state.
class RosterPlayer {
  final int capNumber;
  final String name;
  final Position position;
  final double piScore; // 6-8 Performance Indicator (e.g. 91.4)
  final int goals;
  final int personalFouls; // 0 to 3
  final int steals;

  const RosterPlayer({
    required this.capNumber,
    required this.name,
    required this.position,
    required this.piScore,
    this.goals = 0,
    this.personalFouls = 0,
    this.steals = 0,
  });

  /// Convenience alias for personalFouls matching integration test expectations.
  int get fouls => personalFouls;

  /// Official USAWP / World Aquatics Cap-Out rule: 3 personal exclusions.
  bool get isCappedOut => personalFouls >= 3;

  /// Display string for fouls (e.g. "0/3", "1/3", "2/3", or "3/3 CAPPED OUT").
  String get foulDisplay => isCappedOut ? '3/3 CAPPED OUT' : '$personalFouls/3';

  // 3-Dot Visual Indicator Booleans
  bool get hasFirstFoul => personalFouls >= 1;
  bool get hasSecondFoul => personalFouls >= 2;
  bool get hasThirdFoul => personalFouls >= 3;

  RosterPlayer copyWith({
    int? capNumber,
    String? name,
    Position? position,
    double? piScore,
    int? goals,
    int? personalFouls,
    int? steals,
  }) {
    return RosterPlayer(
      capNumber: capNumber ?? this.capNumber,
      name: name ?? this.name,
      position: position ?? this.position,
      piScore: piScore ?? this.piScore,
      goals: goals ?? this.goals,
      personalFouls: personalFouls ?? this.personalFouls,
      steals: steals ?? this.steals,
    );
  }

  Map<String, dynamic> toJson() => {
    'capNumber': capNumber,
    'name': name,
    'position': position.code,
    'piScore': piScore,
    'goals': goals,
    'personalFouls': personalFouls,
    'steals': steals,
  };

  factory RosterPlayer.fromJson(Map<String, dynamic> json) => RosterPlayer(
    capNumber: json['capNumber'] as int,
    name: json['name'] as String,
    position: Position.fromString(json['position'] as String),
    piScore: (json['piScore'] as num).toDouble(),
    goals: (json['goals'] as int?) ?? 0,
    personalFouls: (json['personalFouls'] as int?) ?? (json['fouls'] as int?) ?? 0,
    steals: (json['steals'] as int?) ?? 0,
  );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RosterPlayer &&
          capNumber == other.capNumber &&
          name == other.name &&
          position == other.position &&
          piScore == other.piScore &&
          goals == other.goals &&
          personalFouls == other.personalFouls &&
          steals == other.steals;

  @override
  int get hashCode => Object.hash(
        capNumber,
        name,
        position,
        piScore,
        goals,
        personalFouls,
        steals,
      );
}

/// Represents a pre-loaded or synced 6-8 Sports tournament match.
class TournamentMatch {
  final String matchId;
  final String tournamentName;
  final String venue;
  final String division;
  final String teamWhiteName;
  final String teamWhiteClub;
  final String teamDarkName;
  final String teamDarkClub;
  final List<RosterPlayer> whiteRoster;
  final List<RosterPlayer> darkRoster;

  TournamentMatch({
    required this.matchId,
    required this.tournamentName,
    required this.venue,
    required this.division,
    required this.teamWhiteName,
    required this.teamWhiteClub,
    required this.teamDarkName,
    required this.teamDarkClub,
    required List<RosterPlayer> whiteRoster,
    required List<RosterPlayer> darkRoster,
  })  : whiteRoster = List.unmodifiable(whiteRoster),
        darkRoster = List.unmodifiable(darkRoster);

  String get whiteTeamName => teamWhiteName;
  String get darkTeamName => teamDarkName;

  RosterPlayer? getPlayer(Team team, int capNumber) {
    final roster = team == Team.white ? whiteRoster : darkRoster;
    try {
      return roster.firstWhere((p) => p.capNumber == capNumber);
    } catch (_) {
      return null;
    }
  }

  TournamentMatch copyWith({
    String? matchId,
    String? tournamentName,
    String? venue,
    String? division,
    String? teamWhiteName,
    String? teamWhiteClub,
    String? teamDarkName,
    String? teamDarkClub,
    List<RosterPlayer>? whiteRoster,
    List<RosterPlayer>? darkRoster,
  }) {
    return TournamentMatch(
      matchId: matchId ?? this.matchId,
      tournamentName: tournamentName ?? this.tournamentName,
      venue: venue ?? this.venue,
      division: division ?? this.division,
      teamWhiteName: teamWhiteName ?? this.teamWhiteName,
      teamWhiteClub: teamWhiteClub ?? this.teamWhiteClub,
      teamDarkName: teamDarkName ?? this.teamDarkName,
      teamDarkClub: teamDarkClub ?? this.teamDarkClub,
      whiteRoster: whiteRoster ?? this.whiteRoster,
      darkRoster: darkRoster ?? this.darkRoster,
    );
  }

  Map<String, dynamic> toJson() => {
    'matchId': matchId,
    'tournamentName': tournamentName,
    'venue': venue,
    'division': division,
    'teamWhiteName': teamWhiteName,
    'teamWhiteClub': teamWhiteClub,
    'teamDarkName': teamDarkName,
    'teamDarkClub': teamDarkClub,
    'whiteRoster': whiteRoster.map((p) => p.toJson()).toList(),
    'darkRoster': darkRoster.map((p) => p.toJson()).toList(),
  };

  factory TournamentMatch.fromJson(Map<String, dynamic> json) => TournamentMatch(
    matchId: json['matchId'] as String,
    tournamentName: json['tournamentName'] as String,
    venue: json['venue'] as String,
    division: json['division'] as String,
    teamWhiteName: json['teamWhiteName'] as String,
    teamWhiteClub: json['teamWhiteClub'] as String,
    teamDarkName: json['teamDarkName'] as String,
    teamDarkClub: json['teamDarkClub'] as String,
    whiteRoster: (json['whiteRoster'] as List)
        .map((p) => RosterPlayer.fromJson(p as Map<String, dynamic>))
        .toList(),
    darkRoster: (json['darkRoster'] as List)
        .map((p) => RosterPlayer.fromJson(p as Map<String, dynamic>))
        .toList(),
  );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TournamentMatch &&
          matchId == other.matchId &&
          tournamentName == other.tournamentName &&
          venue == other.venue &&
          division == other.division &&
          teamWhiteName == other.teamWhiteName &&
          teamDarkName == other.teamDarkName;

  @override
  int get hashCode => Object.hash(
        matchId,
        tournamentName,
        venue,
        division,
        teamWhiteName,
        teamDarkName,
      );
}

/// Enumeration of all live game play-by-play telemetry events.
enum TelemetryEventType {
  goal('GOAL'),
  exclusion20s('EXCLUSION_20S'),
  exclusionRelease('EXCLUSION_RELEASE'),
  turnoverReset30('TURNOVER_RESET_30'),
  reboundReset20('REBOUND_RESET_20'),
  periodChange('PERIOD_CHANGE'),
  matchSync('MATCH_SYNC'),
  protocolSwitch('PROTOCOL_SWITCH'),
  clockStart('CLOCK_START'),
  clockStop('CLOCK_STOP'),
  undo('UNDO');

  final String code;
  const TelemetryEventType(this.code);

  static TelemetryEventType fromCode(String code) {
    for (final t in TelemetryEventType.values) {
      if (t.code == code) return t;
    }
    return TelemetryEventType.matchSync;
  }
}

/// Structured play-by-play event matching 6-8 Sports cloud feed.
class TelemetryEvent {
  final String id;
  final DateTime timestamp;
  final String timestampIso;
  final int period;
  final String gameClock;
  final String shotClock;
  final TelemetryEventType type;
  final Team? team;
  final int? capNumber;
  final String? playerName;
  final String scoreSnapshot;
  final String description;
  final bool isSynced;

  TelemetryEvent({
    required this.id,
    DateTime? timestamp,
    String? timestampIso,
    required this.period,
    required this.gameClock,
    required this.shotClock,
    required this.type,
    this.team,
    this.capNumber,
    this.playerName,
    required this.scoreSnapshot,
    required this.description,
    this.isSynced = true,
  })  : timestamp = timestamp ?? DateTime.now(),
        timestampIso = timestampIso ?? (timestamp ?? DateTime.now()).toIso8601String();

  Map<String, dynamic> toJson() => {
    'id': id,
    'timestampIso': timestampIso,
    'period': period,
    'gameClock': gameClock,
    'shotClock': shotClock,
    'type': type.code,
    if (team != null) 'team': team!.name,
    if (capNumber != null) 'capNumber': capNumber,
    if (playerName != null) 'playerName': playerName,
    'scoreSnapshot': scoreSnapshot,
    'description': description,
    'isSynced': isSynced,
  };

  factory TelemetryEvent.fromJson(Map<String, dynamic> json) => TelemetryEvent(
    id: json['id'] as String,
    timestampIso: json['timestampIso'] as String,
    period: json['period'] as int,
    gameClock: json['gameClock'] as String,
    shotClock: json['shotClock'] as String,
    type: TelemetryEventType.fromCode(json['type'] as String),
    team: json['team'] != null ? Team.values.byName(json['team'] as String) : null,
    capNumber: json['capNumber'] as int?,
    playerName: json['playerName'] as String?,
    scoreSnapshot: json['scoreSnapshot'] as String,
    description: json['description'] as String,
    isSynced: (json['isSynced'] as bool?) ?? true,
  );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TelemetryEvent &&
          id == other.id &&
          type == other.type &&
          period == other.period &&
          gameClock == other.gameClock &&
          description == other.description;

  @override
  int get hashCode => Object.hash(id, type, period, gameClock, description);
}
