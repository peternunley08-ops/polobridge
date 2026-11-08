import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../core/audio/sound_service.dart';
import '../models/clock_snapshot.dart';
import '../models/exclusion.dart';
import '../models/game_state.dart';
import '../models/team.dart';
import 'undo_stack.dart';

/// The core Water Polo timing and rules engine.
/// Operates at 100ms precision, enforcing World Aquatics Rule WP 20.15 auto-blanking,
/// Rule WP 21 20-second exclusions with early release (REL), score updating,
/// and a 1-click state undo stack.
class TimingEngine extends ChangeNotifier {
  GameState _state;
  final UndoStack _undoStack;
  final SoundService _soundService;
  final StreamController<GameState> _stateController =
      StreamController<GameState>.broadcast();
  Timer? _ticker;

  TimingEngine({
    GameState? initialState,
    SoundService? soundService,
    bool autoTick = true,
    int maxUndoDepth = 10,
  })  : _state = initialState ?? GameState.initial(),
        _soundService = soundService ?? MockSoundService(),
        _undoStack = UndoStack(maxDepth: maxUndoDepth) {
    if (autoTick) {
      _startTicker();
    }
  }

  // --- Getters ---
  GameState get state => _state;
  bool get isRunning => _state.isRunning;
  int get gameTimeMs => _state.gameTimeMs;
  int get shotTimeMs => _state.shotTimeMs;
  int get scoreWhite => _state.scoreWhite;
  int get scoreDark => _state.scoreDark;
  int get period => _state.period;
  List<Exclusion> get exclusions => _state.exclusions;
  bool get isShotClockBlanked => _state.isShotClockBlanked;

  /// Convenience alias for `isShotClockBlanked` satisfying `PROJECT.md` interface contract.
  bool get isBlanked => isShotClockBlanked;

  /// Creates a point-in-time immutable snapshot of the timing state.
  ClockSnapshot createSnapshot() => _state.toSnapshot();

  bool get canUndo => _undoStack.canUndo;
  int get undoStackLength => _undoStack.length;
  Stream<GameState> get stateStream => _stateController.stream;

  // --- 100ms Periodic Ticker ---
  void _startTicker() {
    _ticker = Timer.periodic(const Duration(milliseconds: 100), (_) {
      tick(100);
    });
  }

  /// Advances the match clocks by [deltaMs] milliseconds (defaults to 100ms).
  /// Synchronously callable in unit tests for deterministic testing.
  void tick([int deltaMs = 100]) {
    if (!_state.isRunning) return;

    var newGameMs = _state.gameTimeMs;
    var newShotMs = _state.shotTimeMs;
    var newRunning = _state.isRunning;

    // 1. Advance Game Clock
    if (newGameMs <= deltaMs) {
      newGameMs = 0;
      newRunning = false;
      _soundService.playHorn(durationMs: 2200); // Period end horn
    } else {
      newGameMs -= deltaMs;
    }

    // 2. Advance Shot Clock
    if (newShotMs <= deltaMs) {
      // Expiration: fire shot horn only if game clock has > 1s and NOT blanked
      if (newGameMs > 1000 && !(_state.isShotClockBlanked)) {
        _soundService.playHorn(durationMs: 1200);
      }
      // Reset shot clock to 30s upon expiration
      newShotMs = 30 * 1000;
    } else {
      newShotMs -= deltaMs;
    }

    // 3. Advance Active Exclusions
    final updatedExclusions = <Exclusion>[];
    for (final exc in _state.exclusions) {
      final rem = exc.remainingMs - deltaMs;
      if (rem > 0) {
        updatedExclusions.add(exc.copyWith(remainingMs: rem));
      }
      // Rule WP 21: Exclusions reaching 0 naturally expire and are cleared
    }

    _updateState(
      _state.copyWith(
        gameTimeMs: newGameMs,
        shotTimeMs: newShotMs,
        isRunning: newRunning,
        exclusions: updatedExclusions,
      ),
    );
  }

  // --- User Actions with Automatic Undo Snapshot ---

  void _pushSnapshot() {
    _undoStack.push(_state.toSnapshot());
  }

  /// Toggles master clock running state.
  void toggleStartStop() {
    _soundService.playClick();
    _pushSnapshot();
    _updateState(_state.copyWith(isRunning: !_state.isRunning));
  }

  void start() {
    if (!_state.isRunning) toggleStartStop();
  }

  void stop() {
    if (_state.isRunning) toggleStartStop();
  }

  /// Resets shot clock to 30.0s (defensive turnover / full change of possession).
  void resetShotClock30() {
    _soundService.playClick();
    _pushSnapshot();
    _updateState(_state.copyWith(shotTimeMs: 30 * 1000));
  }

  /// Resets shot clock to 20.0s (offensive rebound, exclusion, or corner throw).
  void resetShotClock20() {
    _soundService.playClick();
    _pushSnapshot();
    _updateState(_state.copyWith(shotTimeMs: 20 * 1000));
  }

  /// Manual adjustment of shot clock by [deltaSeconds] (+1s or -1s), clamped to [0, 35s].
  void adjustShotClock(int deltaSeconds) {
    _soundService.playClick();
    _pushSnapshot();
    final currentSec = _state.shotTimeMs ~/ 1000;
    final newSec = (currentSec + deltaSeconds).clamp(0, 35);
    _updateState(_state.copyWith(shotTimeMs: newSec * 1000));
  }

  /// Manual adjustment of game clock by [deltaSeconds] (+1s or -1s), clamped at 0.
  void adjustGameClock(int deltaSeconds) {
    _soundService.playClick();
    _pushSnapshot();
    final currentSec = _state.gameTimeMs ~/ 1000;
    final newSec = (currentSec + deltaSeconds).clamp(0, 99 * 60);
    _updateState(_state.copyWith(gameTimeMs: newSec * 1000));
  }

  /// Resets game clock to standard 8 minutes (08:00.0).
  void resetGameClock800() {
    _soundService.playClick();
    _pushSnapshot();
    _updateState(_state.copyWith(gameTimeMs: 8 * 60 * 1000));
  }

  // --- Exclusions Management (Rule WP 21) ---

  /// Adds a 20s exclusion for [team] and [capNumber].
  /// Per World Aquatics rules, assigning an exclusion automatically resets shot clock to 20s.
  void addExclusion(Team team, int capNumber) {
    _soundService.playClick();
    _pushSnapshot();
    final newExclusion = Exclusion(
      id: '${DateTime.now().microsecondsSinceEpoch}_${team.name}_$capNumber',
      team: team,
      capNumber: capNumber,
      remainingMs: 20 * 1000,
    );
    final updatedList = List<Exclusion>.from(_state.exclusions)..add(newExclusion);
    _updateState(
      _state.copyWith(
        exclusions: updatedList,
        shotTimeMs: 20 * 1000, // Automatic reset 20s
      ),
    );
  }

  /// Early Release (`REL`) of a specific exclusion by [id].
  void releaseExclusion(String id) {
    _soundService.playClick();
    _pushSnapshot();
    final updatedList = _state.exclusions.where((e) => e.id != id).toList();
    _updateState(_state.copyWith(exclusions: updatedList));
  }

  /// Releases all active exclusions for a given team.
  void releaseAllExclusionsForTeam(Team team) {
    _soundService.playClick();
    _pushSnapshot();
    final updatedList = _state.exclusions.where((e) => e.team != team).toList();
    _updateState(_state.copyWith(exclusions: updatedList));
  }

  // --- Score Management & Goal Automation ---

  /// Increments score for [team].
  /// Per World Aquatics Rule WP 21, scoring a goal:
  /// 1. Releases all active exclusions of the defending (opposite) team.
  /// 2. Resets shot clock to 30.0s for fresh possession.
  void incrementScore(Team team) {
    _soundService.playClick();
    _pushSnapshot();

    final newWhite = team == Team.white ? _state.scoreWhite + 1 : _state.scoreWhite;
    final newDark = team == Team.dark ? _state.scoreDark + 1 : _state.scoreDark;

    // Goal releases defending team's penalties
    final defendingTeam = team.opposite;
    final updatedExclusions =
        _state.exclusions.where((e) => e.team != defendingTeam).toList();

    _updateState(
      _state.copyWith(
        scoreWhite: newWhite,
        scoreDark: newDark,
        shotTimeMs: 30 * 1000, // Fresh 30s possession
        exclusions: updatedExclusions,
      ),
    );
  }

  /// Decrements score for [team], clamped to zero.
  void decrementScore(Team team) {
    _soundService.playClick();
    _pushSnapshot();
    final newWhite =
        team == Team.white ? (_state.scoreWhite - 1).clamp(0, 999) : _state.scoreWhite;
    final newDark =
        team == Team.dark ? (_state.scoreDark - 1).clamp(0, 999) : _state.scoreDark;

    _updateState(_state.copyWith(scoreWhite: newWhite, scoreDark: newDark));
  }

  // --- Period Control ---

  /// Sets match period (1 to 4 for regulation, 5 for OT).
  /// Resets game clock to 8:00, shot clock to 30s, stops clock, and clears exclusions.
  void setPeriod(int newPeriod) {
    _soundService.playClick();
    _pushSnapshot();
    _updateState(
      _state.copyWith(
        period: newPeriod,
        gameTimeMs: 8 * 60 * 1000,
        shotTimeMs: 30 * 1000,
        isRunning: false,
        exclusions: const [],
      ),
    );
  }

  // --- Manual Horn Trigger ---

  void triggerHorn({int durationMs = 1200}) {
    _soundService.playHorn(durationMs: durationMs);
    _updateState(_state.copyWith(isHornActive: true));
    Future.delayed(Duration(milliseconds: durationMs), () {
      if (!hasListeners) return;
      _updateState(_state.copyWith(isHornActive: false));
    });
  }

  // --- 1-Click State Undo Stack Restoration ---

  /// Restores the most recent snapshot from the undo stack.
  void undo() {
    if (!_undoStack.canUndo) return;
    _soundService.playClick();
    final last = _undoStack.pop();
    if (last == null) return;

    _updateState(
      _state.copyWith(
        gameTimeMs: last.gameTimeMs,
        shotTimeMs: last.shotTimeMs,
        isRunning: last.isRunning,
        scoreWhite: last.scoreWhite,
        scoreDark: last.scoreDark,
        period: last.period,
        exclusions: last.exclusions,
      ),
    );
  }

  void _updateState(GameState newState) {
    _state = newState;
    _stateController.add(_state);
    notifyListeners();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _stateController.close();
    super.dispose();
  }
}
