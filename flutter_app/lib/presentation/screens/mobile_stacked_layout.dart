import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/constants/widget_keys.dart';
import '../../domain/models/team.dart';
import '../../state/game_controller.dart';
import '../widgets/match_selector_sheet.dart';
import '../widgets/plunger_button.dart';
import '../widgets/team_bay.dart';

/// Compact, overflow-free stacked layout for mobile screens (maxWidth <= 600).
/// Utilizes FittedBox scaling, flexible wrapping, and bounded scrolling
/// to eliminate RenderFlex overflow errors down to 320dp viewport width.
class MobileStackedLayout extends StatelessWidget {
  final GameController controller;

  const MobileStackedLayout({super.key, required this.controller});

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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AquaticColors.surfaceDeepBlue,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AquaticColors.borderCyanGlow, width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Colors.black45,
            blurRadius: 8,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Master Game Clock
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              state.formattedGameTime,
              key: WidgetKeys.gameClockDisplay,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 42,
                fontWeight: FontWeight.w900,
                color: AquaticColors.gameClockAmber,
                letterSpacing: 2.0,
              ),
            ),
          ),
          const SizedBox(height: 4),

          // Shot Clock Readout
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              state.formattedShotTime,
              key: WidgetKeys.shotClockDisplay,
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 52,
                fontWeight: FontWeight.w900,
                color: shotColor,
                letterSpacing: 2.5,
              ),
            ),
          ),
          const SizedBox(height: 4),

          // Rule WP 20.15 Badge
          Container(
            key: WidgetKeys.ruleWpBadge,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: badgeColor.withOpacity(isBlanked ? 0.2 : 0.15),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: badgeColor, width: 1.0),
            ),
            child: Text(
              isBlanked ? 'WP 20.15 AUTO-BLANKED' : 'WP 20.15 ARMED',
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.bold,
                color: badgeColor,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(height: 6),

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
                icon: const Icon(Icons.volume_up, color: Colors.amber, size: 22),
                tooltip: 'Horn',
                onPressed: () => controller.triggerHorn(),
              ),
              IconButton(
                key: WidgetKeys.shotPlusButton,
                icon: const Icon(Icons.add, size: 18, color: Colors.white70),
                tooltip: 'Shot +1s',
                onPressed: () => controller.adjustShotClock(1),
              ),
              const SizedBox(width: 6),
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
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Period Selector Chips (horizontally scrollable if viewport is tiny)
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                key: WidgetKeys.periodSelector,
                children: [1, 2, 3, 4, 5].map((p) {
                  final isSelected = state.period == p;
                  final label = p <= 4 ? 'Q$p' : 'OT';
                  return Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: ChoiceChip(
                      label: Text(
                        label,
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                          color: isSelected ? Colors.black : Colors.white,
                        ),
                      ),
                      selected: isSelected,
                      selectedColor: AquaticColors.cyan400,
                      backgroundColor: AquaticColors.surfaceSapphire,
                      side: const BorderSide(color: AquaticColors.borderCyanSubtle),
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      visualDensity: VisualDensity.compact,
                      onSelected: (_) => controller.setPeriod(p),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          const SizedBox(width: 8),

          // 1-Click State Undo Button
          ElevatedButton.icon(
            key: WidgetKeys.undoButton,
            icon: const Icon(Icons.undo, size: 14),
            label: const Text(
              'UNDO',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: controller.engine.canUndo
                  ? AquaticColors.undoPurple
                  : Colors.grey.shade800,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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

    return SingleChildScrollView(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Top Header Bar
          MatchSelectorSheet(controller: controller, isCompact: true),
          const SizedBox(height: 8),

          // 2. Recessed Clocks Bay
          _buildCenterClocksBay(context),
          const SizedBox(height: 12),

          // 3. Compact Plungers Row (Start/Stop, Reset 30, Reset 20)
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 75,
                  child: PlungerButton.startStop(
                    isRunning: state.isRunning,
                    onTap: () => controller.toggleStartStop(),
                    isCompact: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: 75,
                  child: PlungerButton.reset30(
                    onTap: () => controller.resetShotClock30(),
                    isCompact: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: 75,
                  child: PlungerButton.reset20(
                    onTap: () => controller.resetShotClock20(),
                    isCompact: true,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 4. Team Bays Row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TeamBay(
                  team: Team.white,
                  controller: controller,
                  isCompact: true,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TeamBay(
                  team: Team.dark,
                  controller: controller,
                  isCompact: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // 5. Bottom Controls Bar (Period Chips & Undo)
          _buildBottomControlsBar(),
        ],
      ),
    );
  }
}
