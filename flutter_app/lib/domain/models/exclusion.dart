import 'team.dart';

/// Represents an active 20-second player exclusion (ejection) under World Aquatics Rule WP 21.
class Exclusion {
  final String id;
  final Team team;
  final int capNumber;
  final int remainingMs; // Countdown in milliseconds (e.g. 20000 down to 0)

  const Exclusion({
    required this.id,
    required this.team,
    required this.capNumber,
    this.remainingMs = 20000,
  });

  /// Remaining seconds as a double (e.g. 14.2)
  double get remainingSeconds => remainingMs / 1000.0;

  /// Remaining seconds rounded up for display (e.g. 15s)
  int get remainingSecondsCeil => (remainingMs / 1000.0).ceil();

  /// Formatted seconds string (e.g. "14.2" or "14s")
  String get formattedTime => (remainingMs / 1000.0).toStringAsFixed(1);

  /// True when the exclusion timer has reached 0
  bool get isExpired => remainingMs <= 0;

  Exclusion copyWith({
    String? id,
    Team? team,
    int? capNumber,
    int? remainingMs,
  }) {
    return Exclusion(
      id: id ?? this.id,
      team: team ?? this.team,
      capNumber: capNumber ?? this.capNumber,
      remainingMs: remainingMs ?? this.remainingMs,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Exclusion &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          team == other.team &&
          capNumber == other.capNumber &&
          remainingMs == other.remainingMs;

  @override
  int get hashCode => Object.hash(id, team, capNumber, remainingMs);

  @override
  String toString() => 'Exclusion($id, ${team.displayName} #$capNumber, ${remainingMs}ms)';
}
