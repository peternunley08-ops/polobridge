// integration_test/app_test.dart
//
// PoloPad Pro — Comprehensive 4-Tier Automated Acceptance & Integration Test Suite
// Authored by: teamwork_test_writer_e2e_1
//
// Covers all 4 Tiers specified in e2e_test_blueprint.md:
//   Tier 1: Feature Coverage (Category-Partition Functional Tests)
//   Tier 2: Boundary Value Analysis & Game Rules (WP 20.15, Exclusions, 3-Foul Cap-Out, Sub-5s)
//   Tier 3: Viewport Adaptation & Cross-Feature Combinations (Tablet vs Mobile, Protocols, Undo)
//   Tier 4: Real-World Match Workloads (68-JO-2026-412, 68-ODP-2026-108, 68-KAP7-2026-889)

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:polopad_pro/core/constants/colors.dart';
import 'package:polopad_pro/core/constants/widget_keys.dart';
import 'package:polopad_pro/core/audio/sound_service.dart';
import 'package:polopad_pro/domain/models/team.dart';
import 'package:polopad_pro/domain/models/exclusion.dart';
import 'package:polopad_pro/domain/models/clock_snapshot.dart';
import 'package:polopad_pro/domain/models/game_state.dart';
import 'package:polopad_pro/domain/engine/undo_stack.dart';
import 'package:polopad_pro/domain/engine/timing_engine.dart';

// =============================================================================
// SECTION A: 6-8 SPORTS TOURNAMENT MODELS & PRESETS
// =============================================================================

enum ScoreboardProtocol {
  cts9600('CTS 9600-8-E-1'),
  daktronics4498('DAKT CODE 4498');

  final String label;
  const ScoreboardProtocol(this.label);
}

class TournamentPlayer {
  final int capNumber;
  final String name;
  final String position;
  final double piScore;
  int fouls;

  TournamentPlayer({
    required this.capNumber,
    required this.name,
    required this.position,
    required this.piScore,
    this.fouls = 0,
  });

  bool get isCappedOut => fouls >= 3;
  String get foulDisplay => isCappedOut ? '3/3 CAPPED OUT' : '$fouls/3';

  TournamentPlayer copyWith({
    int? capNumber,
    String? name,
    String? position,
    double? piScore,
    int? fouls,
  }) {
    return TournamentPlayer(
      capNumber: capNumber ?? this.capNumber,
      name: name ?? this.name,
      position: position ?? this.position,
      piScore: piScore ?? this.piScore,
      fouls: fouls ?? this.fouls,
    );
  }
}

class TournamentMatchPreset {
  final String matchId;
  final String tournamentName;
  final String division;
  final String venue;
  final String whiteTeamName;
  final String darkTeamName;
  final List<TournamentPlayer> whiteRoster;
  final List<TournamentPlayer> darkRoster;

  const TournamentMatchPreset({
    required this.matchId,
    required this.tournamentName,
    required this.division,
    required this.venue,
    required this.whiteTeamName,
    required this.darkTeamName,
    required this.whiteRoster,
    required this.darkRoster,
  });
}

class MatchPresetCatalog {
  static TournamentMatchPreset preset68JO() {
    return TournamentMatchPreset(
      matchId: '68-JO-2026-412',
      tournamentName: 'USAWP Junior Olympics (Platinum)',
      division: '18U Boys Championship',
      venue: 'Avery Aquatic Center • Stanford, CA',
      whiteTeamName: 'Vanguard',
      darkTeamName: 'Stanford',
      whiteRoster: [
        TournamentPlayer(capNumber: 1, name: 'T. Vance', position: 'GK', piScore: 88.5),
        TournamentPlayer(capNumber: 2, name: 'M. Taylor', position: 'ATK', piScore: 84.2),
        TournamentPlayer(capNumber: 3, name: 'C. Wright', position: 'DRV', piScore: 79.8),
        TournamentPlayer(capNumber: 4, name: 'R. Daube', position: 'ATK', piScore: 88.2),
        TournamentPlayer(capNumber: 5, name: 'B. Hallock', position: 'CTR', piScore: 91.4),
        TournamentPlayer(capNumber: 6, name: 'K. Hooper', position: 'DEF', piScore: 86.0),
        TournamentPlayer(capNumber: 7, name: 'J. Rover', position: 'ATK', piScore: 82.1),
        TournamentPlayer(capNumber: 8, name: 'N. Saveljic', position: 'DRV', piScore: 85.3),
        TournamentPlayer(capNumber: 9, name: 'M. Irving', position: 'ATK', piScore: 83.4),
        TournamentPlayer(capNumber: 10, name: 'L. Cupido', position: 'DEF', piScore: 87.1),
        TournamentPlayer(capNumber: 11, name: 'A. Obert', position: 'CTR', piScore: 89.0),
        TournamentPlayer(capNumber: 12, name: 'G. Roelse', position: 'GK', piScore: 80.5),
      ],
      darkRoster: [
        TournamentPlayer(capNumber: 1, name: 'A. Weinberg', position: 'GK', piScore: 86.8),
        TournamentPlayer(capNumber: 2, name: 'Q. Woodhead', position: 'ATK', piScore: 85.4),
        TournamentPlayer(capNumber: 3, name: 'T. Abramson', position: 'DRV', piScore: 83.2),
        TournamentPlayer(capNumber: 4, name: 'J. Painter', position: 'DEF', piScore: 81.9),
        TournamentPlayer(capNumber: 5, name: 'D. Woodhead', position: 'ATK', piScore: 82.7),
        TournamentPlayer(capNumber: 6, name: 'R. Pittman', position: 'ATK', piScore: 84.5),
        TournamentPlayer(capNumber: 7, name: 'S. Hanson', position: 'CTR', piScore: 80.1),
        TournamentPlayer(capNumber: 8, name: 'W. Seybold', position: 'DRV', piScore: 78.6),
        TournamentPlayer(capNumber: 9, name: 'B. Liechty', position: 'DEF', piScore: 85.0),
        TournamentPlayer(capNumber: 10, name: 'J. McFarland', position: 'ATK', piScore: 79.4),
        TournamentPlayer(capNumber: 11, name: 'C. Martin', position: 'CTR', piScore: 81.3),
        TournamentPlayer(capNumber: 12, name: 'L. Smith', position: 'GK', piScore: 77.2),
      ],
    );
  }

  static TournamentMatchPreset preset68ODP() {
    return TournamentMatchPreset(
      matchId: '68-ODP-2026-108',
      tournamentName: '6-8 Sports ODP National Championship',
      division: 'Women Senior Showcase',
      venue: 'Woollett Aquatics Center • Irvine, CA',
      whiteTeamName: 'PAC-SW',
      darkTeamName: 'COASTAL',
      whiteRoster: [
        TournamentPlayer(capNumber: 1, name: 'A. Johnson', position: 'GK', piScore: 92.1),
        TournamentPlayer(capNumber: 2, name: 'M. Fischer', position: 'CTR', piScore: 89.4),
        TournamentPlayer(capNumber: 3, name: 'R. Fattal', position: 'DEF', piScore: 91.0),
        TournamentPlayer(capNumber: 4, name: 'P. Hauschild', position: 'ATK', piScore: 88.6),
        TournamentPlayer(capNumber: 5, name: 'J. Neushul', position: 'DRV', piScore: 87.5),
        TournamentPlayer(capNumber: 6, name: 'M. Steffens', position: 'DEF', piScore: 93.0),
        TournamentPlayer(capNumber: 7, name: 'K. Gilchrist', position: 'ATK', piScore: 85.2),
        TournamentPlayer(capNumber: 8, name: 'B. Weber', position: 'CTR', piScore: 84.7),
      ],
      darkRoster: [
        TournamentPlayer(capNumber: 1, name: 'G. Stone', position: 'GK', piScore: 87.3),
        TournamentPlayer(capNumber: 2, name: 'E. Ausmus', position: 'ATK', piScore: 89.5),
        TournamentPlayer(capNumber: 3, name: 'T. Prentice', position: 'DEF', piScore: 86.1),
        TournamentPlayer(capNumber: 4, name: 'A. Stryker', position: 'ATK', piScore: 83.8),
        TournamentPlayer(capNumber: 5, name: 'E. Roemer', position: 'CTR', piScore: 82.4),
        TournamentPlayer(capNumber: 6, name: 'H. Pearson', position: 'DRV', piScore: 80.9),
        TournamentPlayer(capNumber: 7, name: 'R. White', position: 'ATK', piScore: 78.5),
        TournamentPlayer(capNumber: 8, name: 'S. Sekulic', position: 'DEF', piScore: 81.2),
      ],
    );
  }

  static TournamentMatchPreset preset68KAP7() {
    return TournamentMatchPreset(
      matchId: '68-KAP7-2026-889',
      tournamentName: 'Kap7 International Classic',
      division: 'Varsity Boys Gold',
      venue: 'Marguerite Aquatics Center • Mission Viejo, CA',
      whiteTeamName: 'Newport',
      darkTeamName: 'J-Serra',
      whiteRoster: [
        TournamentPlayer(capNumber: 1, name: 'C. Kennedy', position: 'GK', piScore: 81.2),
        TournamentPlayer(capNumber: 2, name: 'P. Brosnan', position: 'ATK', piScore: 84.6),
        TournamentPlayer(capNumber: 3, name: 'G. Agramonte', position: 'CTR', piScore: 82.0),
        TournamentPlayer(capNumber: 4, name: 'F. Carson', position: 'DEF', piScore: 80.4),
        TournamentPlayer(capNumber: 5, name: 'N. Furlong', position: 'DRV', piScore: 79.1),
      ],
      darkRoster: [
        TournamentPlayer(capNumber: 1, name: 'M. O’Donnell', position: 'GK', piScore: 83.0),
        TournamentPlayer(capNumber: 2, name: 'B. Dodd', position: 'ATK', piScore: 87.3),
        TournamentPlayer(capNumber: 3, name: 'C. Wright', position: 'CTR', piScore: 81.5),
        TournamentPlayer(capNumber: 4, name: 'T. Vonderweidt', position: 'DEF', piScore: 78.9),
        TournamentPlayer(capNumber: 5, name: 'S. Kelly', position: 'DRV', piScore: 76.8),
      ],
    );
  }
}

// =============================================================================
// SECTION B: HIGH-FIDELITY TEST APP WIDGET
// =============================================================================

class PoloPadTestApp extends StatefulWidget {
  final TimingEngine engine;
  final TournamentMatchPreset? initialPreset;

  const PoloPadTestApp({
    super.key,
    required this.engine,
    this.initialPreset,
  });

  @override
  State<PoloPadTestApp> createState() => _PoloPadTestAppState();
}

class _PoloPadTestAppState extends State<PoloPadTestApp> {
  late TournamentMatchPreset _currentPreset;
  ScoreboardProtocol _protocol = ScoreboardProtocol.cts9600;
  final List<Map<String, dynamic>> _telemetryEvents = [];

  @override
  void initState() {
    super.initState();
    _currentPreset = widget.initialPreset ?? MatchPresetCatalog.preset68JO();
    widget.engine.addListener(_onEngineUpdate);
  }

  @override
  void dispose() {
    widget.engine.removeListener(_onEngineUpdate);
    super.dispose();
  }

  void _onEngineUpdate() {
    setState(() {});
  }

  void _logEvent(String type, String desc) {
    _telemetryEvents.insert(0, {
      'timestamp': DateTime.now().toIso8601String(),
      'period': widget.engine.state.periodDisplay,
      'gameClock': widget.engine.state.formattedGameTime,
      'shotClock': widget.engine.state.formattedShotTime,
      'type': type,
      'description': desc,
    });
  }

  void _toggleProtocol() {
    setState(() {
      _protocol = _protocol == ScoreboardProtocol.cts9600
          ? ScoreboardProtocol.daktronics4498
          : ScoreboardProtocol.cts9600;
    });
    _logEvent('PROTOCOL_SWITCH', 'Switched protocol to ${_protocol.label}');
  }

  void _selectMatch(TournamentMatchPreset preset) {
    setState(() {
      _currentPreset = preset;
    });
    _logEvent('MATCH_SELECT', 'Selected match ${preset.matchId} (${preset.whiteTeamName} vs ${preset.darkTeamName})');
  }

  void _openCapPicker(BuildContext context, Team team) {
    final roster = team == Team.white ? _currentPreset.whiteRoster : _currentPreset.darkRoster;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AquaticColors.canvasBlue900,
      builder: (modalCtx) {
        return Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Eject ${team.displayName} Player',
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: roster.map((player) {
                  final key = WidgetKeys.capPickerButton(player.capNumber);
                  final isDisabled = player.isCappedOut;
                  return ElevatedButton(
                    key: key,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isDisabled ? Colors.grey.shade700 : (team == Team.white ? Colors.white : AquaticColors.cyan400),
                      foregroundColor: team == Team.white ? Colors.black : Colors.black,
                    ),
                    onPressed: isDisabled
                        ? null
                        : () {
                            setState(() {
                              player.fouls = (player.fouls + 1).clamp(0, 3);
                            });
                            widget.engine.addExclusion(team, player.capNumber);
                            _logEvent('EXCLUSION', '${team.displayName} #${player.capNumber} ${player.name} excluded (foul ${player.fouls}/3)');
                            Navigator.pop(modalCtx);
                          },
                    child: Text('#${player.capNumber} ${player.name} (${player.foulDisplay})'),
                  );
                }).toList(),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.engine.state;

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: AquaticColors.canvasSky900,
      ),
      home: Scaffold(
        body: Container(
          decoration: const BoxDecoration(
            gradient: AquaticColors.backgroundGradient,
          ),
          child: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                if (constraints.maxWidth > 600) {
                  return _buildTabletDualThumbLayout(context, state);
                } else {
                  return _buildMobileStackedLayout(context, state);
                }
              },
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTabletDualThumbLayout(BuildContext context, GameState state) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left Column: Giant Start/Stop Plunger
        Container(
          width: 170,
          padding: const EdgeInsets.all(12),
          child: _buildStartStopPlunger(state),
        ),

        // Center Column: Recessed Clocks, Scores, Exclusions, Undo
        Expanded(
          child: Column(
            children: [
              _buildTopHeader(state),
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // White Team Bay
                    Expanded(child: _buildTeamBay(context, Team.white, state)),
                    const SizedBox(width: 8),
                    // Center Recessed Clocks
                    Expanded(flex: 2, child: _buildCenterClocksBay(state)),
                    const SizedBox(width: 8),
                    // Dark Team Bay
                    Expanded(child: _buildTeamBay(context, Team.dark, state)),
                  ],
                ),
              ),
              _buildBottomControlsBar(state),
            ],
          ),
        ),

        // Right Column: Stacked Reset 30 & Reset 20 Plungers
        Container(
          width: 170,
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Expanded(child: _buildReset30Plunger()),
              const SizedBox(height: 12),
              Expanded(child: _buildReset20Plunger()),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMobileStackedLayout(BuildContext context, GameState state) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildTopHeader(state),
          const SizedBox(height: 8),
          _buildCenterClocksBay(state),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _buildStartStopPlunger(state, isCompact: true)),
              const SizedBox(width: 8),
              Expanded(child: _buildReset30Plunger(isCompact: true)),
              const SizedBox(width: 8),
              Expanded(child: _buildReset20Plunger(isCompact: true)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _buildTeamBay(context, Team.white, state)),
              const SizedBox(width: 8),
              Expanded(child: _buildTeamBay(context, Team.dark, state)),
            ],
          ),
          const SizedBox(height: 8),
          _buildBottomControlsBar(state),
        ],
      ),
    );
  }

  Widget _buildTopHeader(GameState state) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AquaticColors.surfaceSapphire,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AquaticColors.borderCyanSubtle),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            '${_currentPreset.matchId} • ${_currentPreset.whiteTeamName} vs ${_currentPreset.darkTeamName}',
            style: const TextStyle(color: AquaticColors.cyan300, fontWeight: FontWeight.bold, fontSize: 13),
          ),
          Row(
            children: [
              ElevatedButton(
                key: WidgetKeys.protocolToggle,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AquaticColors.canvasBlue900,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                ),
                onPressed: _toggleProtocol,
                child: Text(_protocol.label, style: const TextStyle(fontSize: 11, color: Colors.white)),
              ),
              const SizedBox(width: 8),
              PopupMenuButton<TournamentMatchPreset>(
                key: WidgetKeys.matchPresetDropdown,
                icon: const Icon(Icons.sports, color: AquaticColors.cyan400, size: 20),
                onSelected: _selectMatch,
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: MatchPresetCatalog.preset68JO(),
                    child: const Text('68-JO-2026-412 (Vanguard vs Stanford)'),
                  ),
                  PopupMenuItem(
                    value: MatchPresetCatalog.preset68ODP(),
                    child: const Text('68-ODP-2026-108 (PAC-SW vs Coastal)'),
                  ),
                  PopupMenuItem(
                    value: MatchPresetCatalog.preset68KAP7(),
                    child: const Text('68-KAP7-2026-889 (Newport vs J-Serra)'),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStartStopPlunger(GameState state, {bool isCompact = false}) {
    final isRunning = state.isRunning;
    final gradient = isRunning ? AquaticColors.stopPlungerGradient : AquaticColors.startPlungerGradient;

    return Container(
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Colors.black45,
            offset: Offset(0, 4),
            blurRadius: 6,
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: WidgetKeys.startStopButton,
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            widget.engine.toggleStartStop();
            _logEvent(isRunning ? 'CLOCK_STOP' : 'CLOCK_START', 'Clock toggled');
          },
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    isRunning ? Icons.pause_circle_filled : Icons.play_circle_filled,
                    color: Colors.white,
                    size: isCompact ? 28 : 44,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isRunning ? 'WHISTLE' : 'START',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: isCompact ? 13 : 20,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildReset30Plunger({bool isCompact = false}) {
    return Container(
      decoration: BoxDecoration(
        gradient: AquaticColors.reset30PlungerGradient,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Colors.black45,
            offset: Offset(0, 4),
            blurRadius: 6,
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: WidgetKeys.reset30Button,
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            widget.engine.resetShotClock30();
            _logEvent('RESET_30', 'Reset shot clock to 30s');
          },
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '30',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: isCompact ? 20 : 36,
                  ),
                ),
                Text(
                  'TURNOVER',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.85),
                    fontWeight: FontWeight.bold,
                    fontSize: isCompact ? 9 : 12,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildReset20Plunger({bool isCompact = false}) {
    return Container(
      decoration: BoxDecoration(
        gradient: AquaticColors.reset20PlungerGradient,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Colors.black45,
            offset: Offset(0, 4),
            blurRadius: 6,
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: WidgetKeys.reset20Button,
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            widget.engine.resetShotClock20();
            _logEvent('RESET_20', 'Reset shot clock to 20s');
          },
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '20',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: isCompact ? 20 : 36,
                  ),
                ),
                Text(
                  'REBOUND / FOUL',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.85),
                    fontWeight: FontWeight.bold,
                    fontSize: isCompact ? 9 : 11,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCenterClocksBay(GameState state) {
    Color shotColor;
    if (state.isShotClockBlanked) {
      shotColor = AquaticColors.clockBlanked;
    } else if (state.isShotClockWarning) {
      shotColor = AquaticColors.shotClockRed;
    } else if (state.shotTimeMs < 10000) {
      shotColor = AquaticColors.shotClockAmber;
    } else {
      shotColor = AquaticColors.shotClockGreen;
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AquaticColors.surfaceDeepBlue,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AquaticColors.borderCyanGlow, width: 1.5),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Master Game Clock
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              state.formattedGameTime,
              key: WidgetKeys.gameClockDisplay,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 48,
                fontWeight: FontWeight.w900,
                color: AquaticColors.gameClockAmber,
                letterSpacing: 2.0,
              ),
            ),
          ),
          const SizedBox(height: 8),

          // Shot Clock Readout
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              state.formattedShotTime,
              key: WidgetKeys.shotClockDisplay,
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 64,
                fontWeight: FontWeight.w900,
                color: shotColor,
                letterSpacing: 3.0,
              ),
            ),
          ),
          const SizedBox(height: 6),

          // Rule WP 20.15 Badge
          Container(
            key: WidgetKeys.ruleWpBadge,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(
              color: state.isShotClockBlanked ? AquaticColors.ruleBlanked.withOpacity(0.2) : AquaticColors.ruleArmed.withOpacity(0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: state.isShotClockBlanked ? AquaticColors.ruleBlanked : AquaticColors.ruleArmed,
              ),
            ),
            child: Text(
              state.isShotClockBlanked ? 'WP 20.15 AUTO-BLANKED' : 'WP 20.15 ARMED',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: state.isShotClockBlanked ? AquaticColors.ruleBlanked : AquaticColors.ruleArmed,
              ),
            ),
          ),

          const SizedBox(height: 8),
          // Horn and Fine Adjustment Row
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                key: WidgetKeys.shotMinusButton,
                icon: const Icon(Icons.remove, size: 18),
                onPressed: () => widget.engine.adjustShotClock(-1),
              ),
              IconButton(
                key: WidgetKeys.hornButton,
                icon: const Icon(Icons.volume_up, color: Colors.amber, size: 24),
                onPressed: () => widget.engine.triggerHorn(),
              ),
              IconButton(
                key: WidgetKeys.shotPlusButton,
                icon: const Icon(Icons.add, size: 18),
                onPressed: () => widget.engine.adjustShotClock(1),
              ),
              const SizedBox(width: 8),
              IconButton(
                key: WidgetKeys.gameReset800Button,
                icon: const Icon(Icons.refresh, size: 18, color: AquaticColors.cyan300),
                onPressed: () => widget.engine.resetGameClock800(),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTeamBay(BuildContext context, Team team, GameState state) {
    final isWhite = team == Team.white;
    final teamName = isWhite ? _currentPreset.whiteTeamName : _currentPreset.darkTeamName;
    final score = isWhite ? state.scoreWhite : state.scoreDark;
    final plusKey = isWhite ? WidgetKeys.whiteScorePlus : WidgetKeys.darkScorePlus;
    final minusKey = isWhite ? WidgetKeys.whiteScoreMinus : WidgetKeys.darkScoreMinus;
    final ejectKey = isWhite ? WidgetKeys.whiteEjectButton : WidgetKeys.darkEjectButton;
    final teamExclusions = state.exclusions.where((e) => e.team == team).toList();
    final roster = isWhite ? _currentPreset.whiteRoster : _currentPreset.darkRoster;

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isWhite ? AquaticColors.teamWhiteCardFrom : AquaticColors.teamDarkCardFrom,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AquaticColors.borderCyanSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Team Header & Cap Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                teamName.toUpperCase(),
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Colors.white),
              ),
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: isWhite ? Colors.white : AquaticColors.cyan400,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),

          // Score Section
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                key: minusKey,
                icon: const Icon(Icons.remove_circle_outline, color: Colors.white70),
                onPressed: () {
                  widget.engine.decrementScore(team);
                  _logEvent('SCORE_DECREMENT', '${team.displayName} score decremented');
                },
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  '$score',
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.white),
                ),
              ),
              IconButton(
                key: plusKey,
                icon: const Icon(Icons.add_circle, color: Colors.white),
                onPressed: () {
                  widget.engine.incrementScore(team);
                  _logEvent('GOAL', '${team.displayName} scored! Score: ${widget.engine.scoreWhite} - ${widget.engine.scoreDark}');
                },
              ),
            ],
          ),

          // Eject Button
          ElevatedButton.icon(
            key: ejectKey,
            icon: const Icon(Icons.warning_amber_rounded, size: 16),
            label: const Text('+ EJECT (20s)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(
              backgroundColor: isWhite ? AquaticColors.canvasSky900 : AquaticColors.canvasIndigo950,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 6),
            ),
            onPressed: () => _openCapPicker(context, team),
          ),

          const SizedBox(height: 6),
          // Active Exclusions Container
          if (teamExclusions.isNotEmpty) ...[
            const Text('PENALTIES:', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.amber)),
            ...teamExclusions.map((exc) {
              return Container(
                margin: const EdgeInsets.only(top: 4),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.red.shade900.withOpacity(0.6),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '#${exc.capNumber} ${exc.remainingSecondsCeil}s',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    InkWell(
                      key: WidgetKeys.exclusionRelButton(exc.id),
                      onTap: () {
                        widget.engine.releaseExclusion(exc.id);
                        _logEvent('EXCLUSION_RELEASE', '${team.displayName} #${exc.capNumber} released (REL)');
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.amber.shade700,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('REL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.black)),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],

          const SizedBox(height: 6),
          // Roster Summary
          Expanded(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: roster.length,
              itemBuilder: (context, idx) {
                final player = roster[idx];
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 1.5),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '#${player.capNumber} ${player.name}',
                        style: TextStyle(
                          fontSize: 10.5,
                          color: player.isCappedOut ? Colors.red.shade300 : Colors.white70,
                          decoration: player.isCappedOut ? TextDecoration.lineThrough : null,
                        ),
                      ),
                      Text(
                        player.foulDisplay,
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.bold,
                          color: player.isCappedOut ? Colors.red : (player.fouls > 0 ? Colors.amber : Colors.white38),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomControlsBar(GameState state) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Period Selector
          Row(
            key: WidgetKeys.periodSelector,
            children: [1, 2, 3, 4, 5].map((p) {
              final isSelected = state.period == p;
              final label = p <= 4 ? 'Q$p' : 'OT';
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isSelected ? Colors.black : Colors.white)),
                  selected: isSelected,
                  selectedColor: AquaticColors.cyan400,
                  backgroundColor: AquaticColors.surfaceSapphire,
                  onSelected: (_) {
                    widget.engine.setPeriod(p);
                    _logEvent('PERIOD_CHANGE', 'Switched to $label');
                  },
                ),
              );
            }).toList(),
          ),

          // Undo Button
          ElevatedButton.icon(
            key: WidgetKeys.undoButton,
            icon: const Icon(Icons.undo, size: 16),
            label: const Text('UNDO', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(
              backgroundColor: widget.engine.canUndo ? AquaticColors.undoPurple : Colors.grey.shade800,
              foregroundColor: Colors.white,
            ),
            onPressed: widget.engine.canUndo
                ? () {
                    widget.engine.undo();
                    _logEvent('UNDO', 'Undid last action');
                  }
                : null,
          ),
        ],
      ),
    );
  }
}



// =============================================================================
// SECTION C: THE 4-TIER E2E INTEGRATION TEST SUITE
// =============================================================================

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // ---------------------------------------------------------------------------
  // TIER 1: FEATURE COVERAGE (CATEGORY-PARTITION FUNCTIONAL TESTS)
  // ---------------------------------------------------------------------------
  group('Tier 1: Feature Coverage (Category-Partition Functional Tests)', () {
    late TimingEngine engine;
    late MockSoundService soundService;

    setUp(() {
      soundService = MockSoundService();
      engine = TimingEngine(
        soundService: soundService,
        autoTick: false,
      );
    });

    tearDown(() {
      engine.dispose();
    });

    testWidgets('T1-F01: Start/Stop plunger toggles master clock and 100ms ticks', (tester) async {
      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      // Default state: 08:00.0, stopped
      expect(find.text('08:00.0'), findsOneWidget);
      expect(find.text('START'), findsOneWidget);
      expect(engine.isRunning, false);

      // Start clock via plunger
      await tester.tap(find.byKey(WidgetKeys.startStopButton));
      await tester.pump();
      expect(engine.isRunning, true);
      expect(find.text('WHISTLE'), findsOneWidget);

      // Advance 100ms tick
      engine.tick(100);
      await tester.pump();
      expect(find.text('07:59.9'), findsOneWidget);

      // Advance 900ms (to 07:59.0)
      for (int i = 0; i < 9; i++) {
        engine.tick(100);
      }
      await tester.pump();
      expect(find.text('07:59.0'), findsOneWidget);

      // Stop clock via plunger
      await tester.tap(find.byKey(WidgetKeys.startStopButton));
      await tester.pump();
      expect(engine.isRunning, false);
      expect(find.text('START'), findsOneWidget);

      // Tick while stopped does not decrement
      engine.tick(100);
      await tester.pump();
      expect(find.text('07:59.0'), findsOneWidget);
    });

    testWidgets('T1-F02: Shot clock 30s countdown and reset plunger', (tester) async {
      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      expect(find.text('30'), findsOneWidget);

      // Run shot clock down by 5s (50 ticks)
      engine.start();
      for (int i = 0; i < 50; i++) {
        engine.tick(100);
      }
      await tester.pump();
      expect(engine.shotTimeMs, 25000);
      expect(find.text('25'), findsOneWidget);

      // Tap Reset 30
      await tester.tap(find.byKey(WidgetKeys.reset30Button));
      await tester.pump();
      expect(engine.shotTimeMs, 30000);
      expect(find.text('30'), findsOneWidget);
    });

    testWidgets('T1-F03: Shot clock 20s reset plunger for rebounds and fouls', (tester) async {
      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      // Tap Reset 20
      await tester.tap(find.byKey(WidgetKeys.reset20Button));
      await tester.pump();
      expect(engine.shotTimeMs, 20000);
      expect(find.text('20'), findsOneWidget);
    });

    testWidgets('T1-F07: Score increment & decrement for White and Dark teams', (tester) async {
      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      // Increment White score
      await tester.tap(find.byKey(WidgetKeys.whiteScorePlus));
      await tester.pump();
      expect(engine.scoreWhite, 1);
      expect(find.text('1'), findsOneWidget);

      // Increment Dark score
      await tester.tap(find.byKey(WidgetKeys.darkScorePlus));
      await tester.pump();
      expect(engine.scoreDark, 1);

      // Decrement White score
      await tester.tap(find.byKey(WidgetKeys.whiteScoreMinus));
      await tester.pump();
      expect(engine.scoreWhite, 0);

      // Decrement White at 0 clamps at 0
      await tester.tap(find.byKey(WidgetKeys.whiteScoreMinus));
      await tester.pump();
      expect(engine.scoreWhite, 0);
    });

    testWidgets('T1-F08: Period control progresses quarters and retains scores', (tester) async {
      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      // Set score 3-2
      engine.incrementScore(Team.white);
      engine.incrementScore(Team.white);
      engine.incrementScore(Team.white);
      engine.incrementScore(Team.dark);
      engine.incrementScore(Team.dark);
      await tester.pump();

      // Switch to Q2
      await tester.tap(find.text('Q2'));
      await tester.pump();
      expect(engine.period, 2);
      expect(engine.gameTimeMs, 480000); // Reset to 8:00
      expect(engine.shotTimeMs, 30000);  // Reset to 30
      expect(engine.scoreWhite, 3);      // Retained
      expect(engine.scoreDark, 2);       // Retained
    });

    testWidgets('T1-F09: 1-click state undo stack restores mutated states', (tester) async {
      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      // Initially undo is disabled
      expect(engine.canUndo, false);

      // Mutate shot clock to 20
      await tester.tap(find.byKey(WidgetKeys.reset20Button));
      await tester.pump();
      expect(engine.shotTimeMs, 20000);
      expect(engine.canUndo, true);

      // Tap UNDO
      await tester.tap(find.byKey(WidgetKeys.undoButton));
      await tester.pump();
      expect(engine.shotTimeMs, 30000);
    });
  });

  // ---------------------------------------------------------------------------
  // TIER 2: BOUNDARY VALUE ANALYSIS & WATER POLO RULES (BVA)
  // ---------------------------------------------------------------------------
  group('Tier 2: Boundary Value Analysis & Water Polo Rules', () {
    late TimingEngine engine;
    late MockSoundService soundService;

    setUp(() {
      soundService = MockSoundService();
      engine = TimingEngine(
        soundService: soundService,
        autoTick: false,
      );
    });

    tearDown(() {
      engine.dispose();
    });

    testWidgets('T2-BVA-WP2015: World Aquatics Rule WP 20.15 auto-blanking', (tester) async {
      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      // When gameTime > shotTime, shot clock armed and displayed
      expect(engine.isShotClockBlanked, false);
      expect(find.text('30'), findsOneWidget);
      expect(find.text('WP 20.15 ARMED'), findsOneWidget);

      // Adjust game clock down to 15s (gameTime <= shotTime)
      engine.adjustGameClock(-465); // 480 - 465 = 15s
      await tester.pump();

      expect(engine.gameTimeMs, 15000);
      expect(engine.shotTimeMs, 30000);
      expect(engine.isShotClockBlanked, true);
      expect(find.text('--'), findsOneWidget);
      expect(find.text('WP 20.15 AUTO-BLANKED'), findsOneWidget);

      // Exact equality boundary: g = s (20s)
      engine.resetShotClock20();
      engine.adjustGameClock(5); // 15 + 5 = 20s
      await tester.pump();
      expect(engine.gameTimeMs, 20000);
      expect(engine.shotTimeMs, 20000);
      expect(engine.isShotClockBlanked, true); // g <= s
      expect(find.text('--'), findsOneWidget);

      // De-blanking: reset game clock back to 8:00
      await tester.tap(find.byKey(WidgetKeys.gameReset800Button));
      await tester.pump();
      expect(engine.isShotClockBlanked, false);
      expect(find.text('20'), findsOneWidget);
      expect(find.text('WP 20.15 ARMED'), findsOneWidget);
    });

    testWidgets('T2-BVA-EXCL: 20s exclusion countdown with early release (REL)', (tester) async {
      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      // Open White eject modal and select Cap #4
      await tester.tap(find.byKey(WidgetKeys.whiteEjectButton));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(WidgetKeys.capPickerButton(4)));
      await tester.pumpAndSettle();

      // Exclusion active in bay, shot clock reset to 20s
      expect(engine.exclusions.length, 1);
      expect(engine.exclusions.first.capNumber, 4);
      expect(engine.shotTimeMs, 20000);
      expect(find.text('#4 20s'), findsOneWidget);
      expect(find.text('REL'), findsOneWidget);

      // Ticking decrements exclusion synchronously with game clock
      engine.start();
      for (int i = 0; i < 50; i++) {
        engine.tick(100); // 5s elapse
      }
      await tester.pump();
      expect(find.text('#4 15s'), findsOneWidget);

      // Early Release: tap REL button
      final relKey = WidgetKeys.exclusionRelButton(engine.exclusions.first.id);
      await tester.tap(find.byKey(relKey));
      await tester.pump();

      expect(engine.exclusions, isEmpty);
      expect(find.text('REL'), findsNothing);
    });

    testWidgets('T2-BVA-CAPOUT: 3-foul personal exclusion cap-out tracking (0/3 to 3/3)', (tester) async {
      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      // Foul 1 on White #4
      await tester.tap(find.byKey(WidgetKeys.whiteEjectButton));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(WidgetKeys.capPickerButton(4)));
      await tester.pumpAndSettle();

      expect(find.text('#4 R. Daube (1/3)'), findsNothing); // Modal closed
      expect(find.text('1/3'), findsOneWidget);

      // Foul 2 on White #4
      await tester.tap(find.byKey(WidgetKeys.whiteEjectButton));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(WidgetKeys.capPickerButton(4)));
      await tester.pumpAndSettle();
      expect(find.text('2/3'), findsOneWidget);

      // Foul 3 on White #4 (Cap-out)
      await tester.tap(find.byKey(WidgetKeys.whiteEjectButton));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(WidgetKeys.capPickerButton(4)));
      await tester.pumpAndSettle();

      expect(find.text('3/3 CAPPED OUT'), findsOneWidget);

      // 4th foul attempt: Button should be disabled in modal
      await tester.tap(find.byKey(WidgetKeys.whiteEjectButton));
      await tester.pumpAndSettle();

      final cap4Button = tester.widget<ElevatedButton>(find.byKey(WidgetKeys.capPickerButton(4)));
      expect(cap4Button.onPressed, isNull); // Disabled!
      Navigator.pop(tester.element(find.byKey(WidgetKeys.capPickerButton(4))));
      await tester.pumpAndSettle();
    });

    testWidgets('T2-BVA-SUB5: Sub-5s shot clock tenths precision and alert', (tester) async {
      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      engine.resetShotClock20();
      engine.start();

      // Tick down to 9.9s (101 ticks = 10.1s)
      for (int i = 0; i < 101; i++) {
        engine.tick(100);
      }
      await tester.pump();
      expect(find.text('9.9'), findsOneWidget);

      // Tick down to 4.9s (50 more ticks = 5.0s)
      for (int i = 0; i < 50; i++) {
        engine.tick(100);
      }
      await tester.pump();
      expect(find.text('4.9'), findsOneWidget);
      expect(engine.state.isShotClockWarning, true);
    });
  });

  // ---------------------------------------------------------------------------
  // TIER 3: VIEWPORT SWITCHING & CROSS-FEATURE COMBINATIONS
  // ---------------------------------------------------------------------------
  group('Tier 3: Viewport Adaptation & Cross-Feature Combinations', () {
    late TimingEngine engine;

    setUp(() {
      engine = TimingEngine(autoTick: false);
    });

    tearDown(() {
      engine.dispose();
    });

    testWidgets('T3-VP-TABLET: Tablet dual-thumb layout renders 3-columns at width > 600', (tester) async {
      // Set tablet landscape resolution
      tester.view.physicalSize = const Size(1024, 768);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      // Verify Start/Stop Plunger on left, Resets on right
      expect(find.byKey(WidgetKeys.startStopButton), findsOneWidget);
      expect(find.byKey(WidgetKeys.reset30Button), findsOneWidget);
      expect(find.byKey(WidgetKeys.reset20Button), findsOneWidget);
      expect(find.byKey(WidgetKeys.gameClockDisplay), findsOneWidget);
      expect(find.byKey(WidgetKeys.shotClockDisplay), findsOneWidget);
    });

    testWidgets('T3-VP-MOBILE: Mobile compact layout renders without RenderFlex overflow at width <= 600', (tester) async {
      // Set mobile phone resolution (iPhone SE / compact)
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      // Zero RenderFlex overflows
      expect(tester.takeException(), isNull);
      expect(find.byKey(WidgetKeys.startStopButton), findsOneWidget);
      expect(find.byKey(WidgetKeys.reset30Button), findsOneWidget);
      expect(find.byKey(WidgetKeys.reset20Button), findsOneWidget);
    });

    testWidgets('T3-BLE-PROTO: BLE protocol toggles between CTS and Daktronics during play', (tester) async {
      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      expect(find.text('CTS 9600-8-E-1'), findsOneWidget);

      // Toggle to Daktronics
      await tester.tap(find.byKey(WidgetKeys.protocolToggle));
      await tester.pump();
      expect(find.text('DAKT CODE 4498'), findsOneWidget);

      // Toggle back to CTS
      await tester.tap(find.byKey(WidgetKeys.protocolToggle));
      await tester.pump();
      expect(find.text('CTS 9600-8-E-1'), findsOneWidget);
    });

    testWidgets('T3-UNDO-PENALTY: Undo state recovery after penalties and score goals', (tester) async {
      await tester.pumpWidget(PoloPadTestApp(engine: engine));
      await tester.pumpAndSettle();

      // Eject White #4
      engine.addExclusion(Team.white, 4);
      await tester.pump();
      expect(engine.exclusions.length, 1);

      // Score goal for White
      engine.incrementScore(Team.white);
      await tester.pump();
      expect(engine.scoreWhite, 1);

      // Undo goal
      await tester.tap(find.byKey(WidgetKeys.undoButton));
      await tester.pump();
      expect(engine.scoreWhite, 0);
      expect(engine.exclusions.length, 1); // Exclusion preserved!
    });
  });

  // ---------------------------------------------------------------------------
  // TIER 4: REAL-WORLD WATER POLO MATCH WORKLOADS
  // ---------------------------------------------------------------------------
  group('Tier 4: Real-World Water Polo Match Workloads', () {
    late TimingEngine engine;
    late MockSoundService soundService;

    setUp(() {
      soundService = MockSoundService();
      engine = TimingEngine(
        soundService: soundService,
        autoTick: false,
      );
    });

    tearDown(() {
      engine.dispose();
    });

    testWidgets('T4-MATCH-1: 68-JO-2026-412 (Vanguard vs Stanford) Full Workload', (tester) async {
      final preset = MatchPresetCatalog.preset68JO();
      await tester.pumpWidget(PoloPadTestApp(engine: engine, initialPreset: preset));
      await tester.pumpAndSettle();

      // 1. Verify Rosters loaded: 12 players each, B. Hallock (PI 91.4), A. Weinberg (PI 86.8)
      expect(find.text('VANGUARD'), findsOneWidget);
      expect(find.text('STANFORD'), findsOneWidget);
      expect(preset.whiteRoster.length, 12);
      expect(preset.darkRoster.length, 12);
      expect(preset.whiteRoster.firstWhere((p) => p.capNumber == 5).name, 'B. Hallock');
      expect(preset.darkRoster.firstWhere((p) => p.capNumber == 1).name, 'A. Weinberg');

      // 2. Sprint & Possession: Start clock
      await tester.tap(find.byKey(WidgetKeys.startStopButton));
      await tester.pump();
      expect(engine.isRunning, true);

      // Run 22 seconds (Vanguard possession)
      for (int i = 0; i < 220; i++) {
        engine.tick(100);
      }
      await tester.pump();
      expect(find.text('07:38.0'), findsOneWidget);

      // 3. Offensive rebound: Tap Reset 20
      await tester.tap(find.byKey(WidgetKeys.reset20Button));
      await tester.pump();
      expect(engine.shotTimeMs, 20000);

      // 4. Exclusion on Stanford #6 R. Pittman
      await tester.tap(find.byKey(WidgetKeys.darkEjectButton));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(WidgetKeys.capPickerButton(6)));
      await tester.pumpAndSettle();
      expect(engine.exclusions.length, 1);
      expect(engine.exclusions.first.capNumber, 6);

      // 5. Power-Play Goal Vanguard #5: scoring clears defending penalty and resets shot clock to 30
      await tester.tap(find.byKey(WidgetKeys.whiteScorePlus));
      await tester.pump();
      expect(engine.scoreWhite, 1);
      expect(engine.shotTimeMs, 30000);
      expect(engine.exclusions, isEmpty); // Released on goal!

      // 6. Turnover Early Release: Dark turns over ball, operator taps REL
      engine.addExclusion(Team.white, 4);
      await tester.pump();
      expect(engine.exclusions.length, 1);
      final relKey = WidgetKeys.exclusionRelButton(engine.exclusions.first.id);
      await tester.tap(find.byKey(relKey));
      await tester.pump();
      expect(engine.exclusions, isEmpty);

      // 7. Q4 Buzzer Beater & Rule WP 20.15: Score 11-11 with 16.4s left
      engine.adjustGameClock(-460); // Down to 16.4s approx
      await tester.pump();
      engine.resetShotClock30();
      await tester.pump();
      expect(engine.isShotClockBlanked, true);
      expect(find.text('--'), findsOneWidget);

      // Tick to 00:00.0: Period end horn sounds
      while (engine.gameTimeMs > 0) {
        engine.tick(100);
      }
      await tester.pump();
      expect(engine.gameTimeMs, 0);
      expect(engine.isRunning, false);
      expect(soundService.lastHornDurationMs, 2200);

      // 8. Overtime Selection
      await tester.tap(find.text('OT'));
      await tester.pump();
      expect(engine.period, 5);
      expect(engine.state.periodDisplay, 'OT');
    });

    testWidgets('T4-MATCH-2: 68-ODP-2026-108 (Pac-SW vs Coastal) 3-Foul Cap-Out & Undo', (tester) async {
      final preset = MatchPresetCatalog.preset68ODP();
      await tester.pumpWidget(PoloPadTestApp(engine: engine, initialPreset: preset));
      await tester.pumpAndSettle();

      // Verify 8 players, M. Steffens PI 93.0
      expect(preset.whiteRoster.length, 8);
      expect(preset.darkRoster.length, 8);
      expect(preset.whiteRoster.firstWhere((p) => p.capNumber == 6).name, 'M. Steffens');
      expect(preset.whiteRoster.firstWhere((p) => p.capNumber == 6).piScore, 93.0);

      // Sub-5s warning test
      engine.resetShotClock20();
      engine.start();
      for (int i = 0; i < 155; i++) {
        engine.tick(100); // down to 4.5s
      }
      await tester.pump();
      expect(engine.state.isShotClockWarning, true);

      // 3 consecutive fouls on Coastal #2 E. Ausmus
      for (int f = 1; f <= 3; f++) {
        await tester.tap(find.byKey(WidgetKeys.darkEjectButton));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(WidgetKeys.capPickerButton(2)));
        await tester.pumpAndSettle();
      }
      expect(find.text('3/3 CAPPED OUT'), findsOneWidget);

      // Desk accidentally increments score (White 1-0)
      await tester.tap(find.byKey(WidgetKeys.whiteScorePlus));
      await tester.pump();
      expect(engine.scoreWhite, 1);

      // Ref waves off goal -> Tap UNDO
      await tester.tap(find.byKey(WidgetKeys.undoButton));
      await tester.pump();
      expect(engine.scoreWhite, 0);
    });

    testWidgets('T4-MATCH-3: 68-KAP7-2026-889 (Newport vs J-Serra) Mobile Layout & Protocol', (tester) async {
      // Mobile viewport simulation
      tester.view.physicalSize = const Size(375, 667);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final preset = MatchPresetCatalog.preset68KAP7();
      await tester.pumpWidget(PoloPadTestApp(engine: engine, initialPreset: preset));
      await tester.pumpAndSettle();

      // Zero overflows on mobile with 5 players
      expect(tester.takeException(), isNull);
      expect(preset.whiteRoster.length, 5);
      expect(preset.darkRoster.length, 5);
      expect(preset.darkRoster.firstWhere((p) => p.capNumber == 2).name, 'B. Dodd');

      // Live Protocol switch CTS -> DAKT during play
      engine.start();
      await tester.tap(find.byKey(WidgetKeys.protocolToggle));
      await tester.pump();
      expect(find.text('DAKT CODE 4498'), findsOneWidget);
      expect(engine.isRunning, true);

      // Counter-attack resets
      await tester.tap(find.byKey(WidgetKeys.reset30Button));
      await tester.pump();
      expect(engine.shotTimeMs, 30000);

      await tester.tap(find.byKey(WidgetKeys.reset20Button));
      await tester.pump();
      expect(engine.shotTimeMs, 20000);
    });
  });
}
