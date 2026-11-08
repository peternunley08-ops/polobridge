import '../models/clock_snapshot.dart';

/// Rolling LIFO Undo Stack retaining up to [maxDepth] historical snapshots.
class UndoStack {
  final int maxDepth;
  final List<ClockSnapshot> _stack = [];

  UndoStack({this.maxDepth = 10});

  /// Pushes a snapshot to the top of the stack.
  /// If the stack exceeds [maxDepth], the oldest entry is removed.
  void push(ClockSnapshot snapshot) {
    _stack.add(snapshot);
    if (_stack.length > maxDepth) {
      _stack.removeAt(0); // Drop oldest
    }
  }

  /// Pops and returns the most recent snapshot, or null if the stack is empty.
  ClockSnapshot? pop() {
    if (_stack.isEmpty) return null;
    return _stack.removeLast();
  }

  /// Peeks at the top snapshot without removing it.
  ClockSnapshot? get peek => _stack.isNotEmpty ? _stack.last : null;

  /// True if there is at least one snapshot available to restore.
  bool get canUndo => _stack.isNotEmpty;

  /// Current number of snapshots in the stack.
  int get length => _stack.length;

  /// Clears all snapshots.
  void clear() => _stack.clear();
}
