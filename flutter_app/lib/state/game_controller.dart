import 'package:flutter/foundation.dart';
import '../domain/engine/timing_engine.dart';
import '../domain/models/exclusion.dart';
import '../domain/models/game_state.dart';
import '../domain/models/team.dart';
import '../domain/six_eight/models.dart';
import '../domain/six_eight/six_eight_manager.dart';
import '../infrastructure/ble/ble_dongle_service.dart';

/// Central game controller binding TimingEngine, SixEightManager, and BleDongleService.
/// Coordinates clock operations, penalty tracking, match metadata, and Bluetooth telemetry.
class GameController extends ChangeNotifier {
  final TimingEngine _engine;
  final SixEightManager _sixEight;
  final BleDongleService _ble;
  bool _enable20sReset = false; // NFHS High School 30s only by default

  GameController({
    required TimingEngine engine,
    required SixEightManager sixEight,
    required BleDongleService ble,
    bool enable20sReset = false,
  })  : _engine = engine,
        _sixEight = sixEight,
        _ble = ble,
        _enable20sReset = enable20sReset {
    _engine.addListener(_onEngineChanged);
    _sixEight.addListener(_onSixEightChanged);
  }

  bool get enable20sReset => _enable20sReset;
  set enable20sReset(bool val) {
    if (_enable20sReset != val) {
      _enable20sReset = val;
      notifyListeners();
    }
  }

  void toggleRuleset() {
    _enable20sReset = !_enable20sReset;
    notifyListeners();
  }

  TimingEngine get engine => _engine;
  SixEightManager get sixEight => _sixEight;
  BleDongleService get ble => _ble;

  GameState get gameState => _engine.state;
  TournamentMatch get activeMatch => _sixEight.activeMatch;
  ScoreboardProtocol get activeProtocol => _ble.activeProtocol;
  List<TelemetryEvent> get eventLog => _sixEight.eventLog;

  String get scoreSnapshot =>
      '${activeMatch.teamWhiteName} ${_engine.scoreWhite} - ${_engine.scoreDark} ${activeMatch.teamDarkName}';

  void _onEngineChanged() {
    notifyListeners();
  }

  void _onSixEightChanged() {
    notifyListeners();
  }

  // --- Clock Controls ---

  void toggleStartStop() {
    _engine.toggleStartStop();
    if (_engine.isRunning) {
      _ble.sendStart();
      _sixEight.logEvent(
        TelemetryEvent(
          id: '${DateTime.now().microsecondsSinceEpoch}_start',
          period: _engine.period,
          gameClock: _engine.state.formattedGameTime,
          shotClock: _engine.state.formattedShotTime,
          type: TelemetryEventType.clockStart,
          scoreSnapshot: scoreSnapshot,
          description: 'Game clock started',
        ),
      );
    } else {
      _ble.sendStop();
      _sixEight.logEvent(
        TelemetryEvent(
          id: '${DateTime.now().microsecondsSinceEpoch}_stop',
          period: _engine.period,
          gameClock: _engine.state.formattedGameTime,
          shotClock: _engine.state.formattedShotTime,
          type: TelemetryEventType.clockStop,
          scoreSnapshot: scoreSnapshot,
          description: 'Game clock stopped (whistle)',
        ),
      );
    }
  }

  void resetShotClock30() {
    _engine.resetShotClock30();
    _ble.sendReset30();
    _sixEight.logEvent(
      TelemetryEvent(
        id: '${DateTime.now().microsecondsSinceEpoch}_rst30',
        period: _engine.period,
        gameClock: _engine.state.formattedGameTime,
        shotClock: '30',
        type: TelemetryEventType.turnoverReset30,
        scoreSnapshot: scoreSnapshot,
        description: 'Reset shot clock to 30s (turnover)',
      ),
    );
  }

  void resetShotClock20() {
    _engine.resetShotClock20();
    _ble.sendReset20();
    _sixEight.logEvent(
      TelemetryEvent(
        id: '${DateTime.now().microsecondsSinceEpoch}_rst20',
        period: _engine.period,
        gameClock: _engine.state.formattedGameTime,
        shotClock: '20',
        type: TelemetryEventType.reboundReset20,
        scoreSnapshot: scoreSnapshot,
        description: 'Reset shot clock to 20s (rebound / foul)',
      ),
    );
  }

  void adjustShotClock(int deltaSeconds) {
    _engine.adjustShotClock(deltaSeconds);
    _ble.sendShotClock(_engine.shotTimeMs);
  }

  void adjustGameClock(int deltaSeconds) {
    _engine.adjustGameClock(deltaSeconds);
    _ble.sendGameClock(_engine.gameTimeMs);
  }

  void resetGameClock800() {
    _engine.resetGameClock800();
    _ble.sendGameClock(_engine.gameTimeMs);
  }

  void triggerHorn({int durationMs = 1200}) {
    _engine.triggerHorn(durationMs: durationMs);
    _ble.sendHorn(durationMs);
  }

  // --- Score Management ---

  void incrementScore(Team team, {int? playerCap}) {
    _engine.incrementScore(team);
    _ble.sendScores(_engine.scoreWhite, _engine.scoreDark, _engine.period);

    if (playerCap != null) {
      _sixEight.recordGoal(
        team,
        playerCap,
        gameClock: _engine.state.formattedGameTime,
        shotClock: _engine.state.formattedShotTime,
        period: _engine.period,
        scoreSnapshot: scoreSnapshot,
      );
    } else {
      final teamName = team == Team.white ? activeMatch.teamWhiteName : activeMatch.teamDarkName;
      _sixEight.logEvent(
        TelemetryEvent(
          id: '${DateTime.now().microsecondsSinceEpoch}_goal',
          period: _engine.period,
          gameClock: _engine.state.formattedGameTime,
          shotClock: _engine.state.formattedShotTime,
          type: TelemetryEventType.goal,
          team: team,
          scoreSnapshot: scoreSnapshot,
          description: 'GOAL by $teamName',
        ),
      );
    }
  }

  void decrementScore(Team team) {
    _engine.decrementScore(team);
    _ble.sendScores(_engine.scoreWhite, _engine.scoreDark, _engine.period);
  }

  // --- Exclusion Management ---

  bool addExclusion(Team team, int capNumber) {
    if (_sixEight.isPlayerCappedOut(team, capNumber)) {
      return false; // Prevent further exclusions on 3rd foul
    }

    _sixEight.recordFoul(
      team,
      capNumber,
      gameClock: _engine.state.formattedGameTime,
      shotClock: _engine.state.formattedShotTime,
      period: _engine.period,
      scoreSnapshot: scoreSnapshot,
    );

    _engine.addExclusion(team, capNumber);
    if (_enable20sReset) {
      _ble.sendReset20();
    } else {
      _engine.resetShotClock30();
      _ble.sendReset30();
    }
    return true;
  }

  void releaseExclusion(String id) {
    final exc = _engine.exclusions.cast<Exclusion?>().firstWhere(
          (e) => e?.id == id,
          orElse: () => null,
        );
    _engine.releaseExclusion(id);

    if (exc != null) {
      final teamName = exc.team == Team.white ? activeMatch.teamWhiteName : activeMatch.teamDarkName;
      _sixEight.logEvent(
        TelemetryEvent(
          id: '${DateTime.now().microsecondsSinceEpoch}_rel_${exc.capNumber}',
          period: _engine.period,
          gameClock: _engine.state.formattedGameTime,
          shotClock: _engine.state.formattedShotTime,
          type: TelemetryEventType.exclusionRelease,
          team: exc.team,
          capNumber: exc.capNumber,
          scoreSnapshot: scoreSnapshot,
          description: 'Early Release ($teamName #${exc.capNumber}) — Re-entry',
        ),
      );
    }
  }

  void releaseAllExclusionsForTeam(Team team) {
    _engine.releaseAllExclusionsForTeam(team);
  }

  void setPeriod(int newPeriod) {
    _engine.setPeriod(newPeriod);
    _ble.sendScores(_engine.scoreWhite, _engine.scoreDark, _engine.period);
    _ble.sendGameClock(_engine.gameTimeMs);
    _ble.sendReset30();

    final label = newPeriod <= 4 ? 'Q$newPeriod' : 'OT';
    _sixEight.logEvent(
      TelemetryEvent(
        id: '${DateTime.now().microsecondsSinceEpoch}_period_$newPeriod',
        period: newPeriod,
        gameClock: _engine.state.formattedGameTime,
        shotClock: _engine.state.formattedShotTime,
        type: TelemetryEventType.periodChange,
        scoreSnapshot: scoreSnapshot,
        description: 'Switched to $label',
      ),
    );
  }

  // --- Undo ---

  void undo() {
    if (!_engine.canUndo) return;
    _engine.undo();
    _ble.sendGameClock(_engine.gameTimeMs);
    _ble.sendShotClock(_engine.shotTimeMs);
    _ble.sendScores(_engine.scoreWhite, _engine.scoreDark, _engine.period);
    if (_engine.isRunning) {
      _ble.sendStart();
    } else {
      _ble.sendStop();
    }

    _sixEight.logEvent(
      TelemetryEvent(
        id: '${DateTime.now().microsecondsSinceEpoch}_undo',
        period: _engine.period,
        gameClock: _engine.state.formattedGameTime,
        shotClock: _engine.state.formattedShotTime,
        type: TelemetryEventType.undo,
        scoreSnapshot: scoreSnapshot,
        description: 'Undid last timing/score action',
      ),
    );
  }

  // --- Protocol Toggle ---

  void toggleProtocol() {
    final nextProto = _ble.activeProtocol == ScoreboardProtocol.cts
        ? ScoreboardProtocol.daktronics
        : ScoreboardProtocol.cts;
    _ble.setProtocol(nextProto);

    _sixEight.logEvent(
      TelemetryEvent(
        id: '${DateTime.now().microsecondsSinceEpoch}_proto',
        period: _engine.period,
        gameClock: _engine.state.formattedGameTime,
        shotClock: _engine.state.formattedShotTime,
        type: TelemetryEventType.protocolSwitch,
        scoreSnapshot: scoreSnapshot,
        description: 'Switched protocol to ${nextProto.label}',
      ),
    );
  }

  void selectMatch(TournamentMatch match) {
    _sixEight.selectMatch(match);
  }

  void selectMatchById(String matchId) {
    _sixEight.selectMatchById(matchId);
  }

  @override
  void dispose() {
    _engine.removeListener(_onEngineChanged);
    _sixEight.removeListener(_onSixEightChanged);
    super.dispose();
  }
}
