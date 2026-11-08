import 'exclusion.dart';

/// Immutable point-in-time snapshot of the game desk state for the 1-click undo stack.
class ClockSnapshot {
  final int gameTimeMs;
  final int shotTimeMs;
  final bool isRunning;
  final int scoreWhite;
  final int scoreDark;
  final int period;
  final List<Exclusion> exclusions;

  ClockSnapshot({
    required this.gameTimeMs,
    required this.shotTimeMs,
    required this.isRunning,
    required this.scoreWhite,
    required this.scoreDark,
    required this.period,
    required List<Exclusion> exclusions,
  }) : exclusions = List.unmodifiable(exclusions);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClockSnapshot &&
          runtimeType == other.runtimeType &&
          gameTimeMs == other.gameTimeMs &&
          shotTimeMs == other.shotTimeMs &&
          isRunning == other.isRunning &&
          scoreWhite == other.scoreWhite &&
          scoreDark == other.scoreDark &&
          period == other.period &&
          _listEquals(exclusions, other.exclusions);

  @override
  int get hashCode => Object.hash(
        gameTimeMs,
        shotTimeMs,
        isRunning,
        scoreWhite,
        scoreDark,
        period,
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
