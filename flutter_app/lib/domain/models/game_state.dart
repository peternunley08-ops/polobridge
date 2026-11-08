import 'clock_snapshot.dart';
import 'exclusion.dart';

/// Complete immutable state of the water polo match, clocks, and score desk.
class GameState {
  final int gameTimeMs;
  final int shotTimeMs;
  final bool isRunning;
  final int scoreWhite;
  final int scoreDark;
  final int period;
  final List<Exclusion> exclusions;
  final bool isHornActive;

  GameState({
    required this.gameTimeMs,
    required this.shotTimeMs,
    required this.isRunning,
    required this.scoreWhite,
    required this.scoreDark,
    required this.period,
    required List<Exclusion> exclusions,
    this.isHornActive = false,
  }) : exclusions = List.unmodifiable(exclusions);

  /// Standard initial state: 8:00 game clock, 30s shot clock, Q1, score 0-0.
  factory GameState.initial() {
    return GameState(
      gameTimeMs: 8 * 60 * 1000, // 480,000 ms
      shotTimeMs: 30 * 1000,     // 30,000 ms
      isRunning: false,
      scoreWhite: 0,
      scoreDark: 0,
      period: 1,
      exclusions: const [],
      isHornActive: false,
    );
  }

  /// World Aquatics Rule WP 20.15:
  /// Automatic shot clock blanking whenever remaining game time is less than
  /// or equal to shot time (gameTimeMs <= shotTimeMs).
  bool get isShotClockBlanked => gameTimeMs <= shotTimeMs;

  /// Formatted master game clock string (MM:SS.d, e.g. "08:00.0" or "00:04.2")
  String get formattedGameTime {
    final min = (gameTimeMs ~/ 60000).toString().padLeft(2, '0');
    final sec = ((gameTimeMs % 60000) ~/ 1000).toString().padLeft(2, '0');
    final tenths = ((gameTimeMs % 1000) ~/ 100).toString();
    return '$min:$sec.$tenths';
  }

  /// Formatted shot clock display string.
  /// Displays "--" when blanked under Rule WP 20.15.
  /// Displays integer seconds when >= 10s (e.g. "28").
  /// Displays seconds and tenths when < 10s (e.g. "9.4" or "4.8").
  String get formattedShotTime {
    if (isShotClockBlanked) {
      return '--';
    }
    final sec = shotTimeMs ~/ 1000;
    if (sec >= 10) {
      return '$sec';
    }
    final tenths = (shotTimeMs % 1000) ~/ 100;
    return '$sec.$tenths';
  }

  /// Warning indicator active when shot clock is below 5 seconds (and not blanked)
  bool get isShotClockWarning =>
      !isShotClockBlanked && shotTimeMs < 5000 && shotTimeMs > 0;

  /// Period display string ("Q1", "Q2", "Q3", "Q4", or "OT")
  String get periodDisplay => period <= 4 ? 'Q$period' : 'OT';

  GameState copyWith({
    int? gameTimeMs,
    int? shotTimeMs,
    bool? isRunning,
    int? scoreWhite,
    int? scoreDark,
    int? period,
    List<Exclusion>? exclusions,
    bool? isHornActive,
  }) {
    return GameState(
      gameTimeMs: gameTimeMs ?? this.gameTimeMs,
      shotTimeMs: shotTimeMs ?? this.shotTimeMs,
      isRunning: isRunning ?? this.isRunning,
      scoreWhite: scoreWhite ?? this.scoreWhite,
      scoreDark: scoreDark ?? this.scoreDark,
      period: period ?? this.period,
      exclusions: exclusions ?? this.exclusions,
      isHornActive: isHornActive ?? this.isHornActive,
    );
  }

  ClockSnapshot toSnapshot() {
    return ClockSnapshot(
      gameTimeMs: gameTimeMs,
      shotTimeMs: shotTimeMs,
      isRunning: isRunning,
      scoreWhite: scoreWhite,
      scoreDark: scoreDark,
      period: period,
      exclusions: exclusions,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is GameState &&
          runtimeType == other.runtimeType &&
          gameTimeMs == other.gameTimeMs &&
          shotTimeMs == other.shotTimeMs &&
          isRunning == other.isRunning &&
          scoreWhite == other.scoreWhite &&
          scoreDark == other.scoreDark &&
          period == other.period &&
          isHornActive == other.isHornActive &&
          _listEquals(exclusions, other.exclusions);

  @override
  int get hashCode => Object.hash(
        gameTimeMs,
        shotTimeMs,
        isRunning,
        scoreWhite,
        scoreDark,
        period,
        isHornActive,
        Object.hashAll(exclusions),
      );

  static bool _listEquals(List<Exclusion> a, List<Exclusion> b) {
    if (a.length != b.length) return false;
    for (int i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}
