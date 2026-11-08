import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/constants/widget_keys.dart';
import '../../domain/models/team.dart';
import '../../state/game_controller.dart';
import '../widgets/match_selector_sheet.dart';
import '../widgets/plunger_button.dart';
import '../widgets/team_bay.dart';

/// 3-Column Ergonomic Dual-Thumb Layout for tablets and desktop displays (maxWidth > 600).
/// Left: Giant thumb Start/Stop plunger.
/// Center: Match info, white/dark team bays, recessed instrument clock cluster, period chips, undo.
/// Right: Stacked thumb Reset 30 and Reset 20 plungers.
class TabletDualThumbLayout extends StatelessWidget {
  final GameController controller;

  const TabletDualThumbLayout({super.key, required this.controller});

  Widget _buildCenterClocksBay(BuildContext context) {
    final state = controller.gameState;

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

    final isBlanked = state.isShotClockBlanked;
    final badgeColor = isBlanked ? AquaticColors.ruleBlanked : AquaticColors.ruleArmed;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AquaticColors.surfaceDeepBlue,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AquaticColors.borderCyanGlow, width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: Colors.black45,
            blurRadius: 10,
            offset: Offset(0, 6),
          ),
        ],
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
          const SizedBox(height: 6),

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
              color: badgeColor.withOpacity(isBlanked ? 0.2 : 0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: badgeColor, width: 1.0),
            ),
            child: Text(
              isBlanked ? 'WP 20.15 AUTO-BLANKED' : 'WP 20.15 ARMED',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: badgeColor,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(height: 8),

          // Horn, Reset 8:00, and Shot Adjustment Row
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                key: WidgetKeys.shotMinusButton,
                icon: const Icon(Icons.remove, size: 18, color: Colors.white70),
                tooltip: 'Shot -1s',
                onPressed: () => controller.adjustShotClock(-1),
              ),
              IconButton(
                key: WidgetKeys.hornButton,
                icon: const Icon(Icons.volume_up, color: Colors.amber, size: 24),
                tooltip: 'Horn',
                onPressed: () => controller.triggerHorn(),
              ),
              IconButton(
                key: WidgetKeys.shotPlusButton,
                icon: const Icon(Icons.add, size: 18, color: Colors.white70),
                tooltip: 'Shot +1s',
                onPressed: () => controller.adjustShotClock(1),
              ),
              const SizedBox(width: 8),
              IconButton(
                key: WidgetKeys.gameReset800Button,
                icon: const Icon(Icons.refresh, size: 18, color: AquaticColors.cyan300),
                tooltip: 'Reset 8:00',
                onPressed: () => controller.resetGameClock800(),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottomControlsBar() {
    final state = controller.gameState;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Period Selector Chips
          Row(
            key: WidgetKeys.periodSelector,
            children: [1, 2, 3, 4, 5].map((p) {
              final isSelected = state.period == p;
              final label = p <= 4 ? 'Q$p' : 'OT';
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(
                    label,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: isSelected ? Colors.black : Colors.white,
                    ),
                  ),
                  selected: isSelected,
                  selectedColor: AquaticColors.cyan400,
                  backgroundColor: AquaticColors.surfaceSapphire,
                  side: const BorderSide(color: AquaticColors.borderCyanSubtle),
                  onSelected: (_) => controller.setPeriod(p),
                ),
              );
            }).toList(),
          ),

          // 1-Click State Undo Button
          ElevatedButton.icon(
            key: WidgetKeys.undoButton,
            icon: const Icon(Icons.undo, size: 16),
            label: const Text(
              'UNDO',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: controller.engine.canUndo
                  ? AquaticColors.undoPurple
                  : Colors.grey.shade800,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            ),
            onPressed: controller.engine.canUndo ? () => controller.undo() : null,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = controller.gameState;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left Column: Giant Start/Stop Plunger (Thumb zone)
        Container(
          width: 170,
          padding: const EdgeInsets.all(12),
          child: PlungerButton.startStop(
            isRunning: state.isRunning,
            onTap: () => controller.toggleStartStop(),
          ),
        ),

        // Center Column: Clocks, Team bays, Roster, Match Selector, Period, Undo
        Expanded(
          child: Column(
            children: [
              MatchSelectorSheet(controller: controller),
              const SizedBox(height: 8),
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // White Team Bay
                    Expanded(
                      child: TeamBay(team: Team.white, controller: controller),
                    ),
                    const SizedBox(width: 8),

                    // Center Clocks Cluster
                    Expanded(
                      flex: 2,
                      child: _buildCenterClocksBay(context),
                    ),
                    const SizedBox(width: 8),

                    // Dark Team Bay
                    Expanded(
                      child: TeamBay(team: Team.dark, controller: controller),
                    ),
                  ],
                ),
              ),
              _buildBottomControlsBar(),
            ],
          ),
        ),

        // Right Column: Stacked Reset 30 / Reset 20 (NCAA) or Single Full-Height Reset 30 (High School)
        Container(
          width: 170,
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              // Ruleset Switcher Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Right Thumb 👉',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: AquaticColors.textSecondary,
                    ),
                  ),
                  InkWell(
                    onTap: () => controller.toggleRuleset(),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: controller.enable20sReset
                            ? AquaticColors.shotClockAmber.withOpacity(0.2)
                            : AquaticColors.startGreen.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: controller.enable20sReset
                              ? AquaticColors.shotClockAmber.withOpacity(0.5)
                              : AquaticColors.startGreen.withOpacity(0.5),
                        ),
                      ),
                      child: Text(
                        controller.enable20sReset ? 'NCAA 20s' : 'NFHS 30s',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          color: controller.enable20sReset
                              ? AquaticColors.shotClockAmber
                              : AquaticColors.startGreen,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (controller.enable20sReset) ...[
                Expanded(
                  child: PlungerButton.reset30(
                    onTap: () => controller.resetShotClock30(),
                  ),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: PlungerButton.reset20(
                    onTap: () => controller.resetShotClock20(),
                  ),
                ),
              ] else ...[
                Expanded(
                  child: PlungerButton.reset30(
                    onTap: () => controller.resetShotClock30(),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
