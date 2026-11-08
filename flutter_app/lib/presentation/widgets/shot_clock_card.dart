import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/constants/widget_keys.dart';
import '../../core/theme/aquatic_theme.dart';
import '../../state/game_controller.dart';

/// High-visibility shot clock instrument display with
/// dynamic sub-5s color shifts and World Aquatics Rule WP 20.15 auto-blanking badge.
class ShotClockCard extends StatelessWidget {
  final GameController controller;
  final bool isCompact;

  const ShotClockCard({
    super.key,
    required this.controller,
    this.isCompact = false,
  });

  @override
  Widget build(BuildContext context) {
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
      padding: EdgeInsets.symmetric(
        horizontal: isCompact ? 8.0 : 16.0,
        vertical: isCompact ? 6.0 : 12.0,
      ),
      decoration: AquaticTheme.recessedBayDecoration(),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'SHOT CLOCK',
                style: TextStyle(
                  fontSize: isCompact ? 10 : 12,
                  fontWeight: FontWeight.bold,
                  color: AquaticColors.cyan300,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          ),
          SizedBox(height: isCompact ? 2 : 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              state.formattedShotTime,
              key: WidgetKeys.shotClockDisplay,
              style: isCompact
                  ? AquaticTheme.shotClockStyle(shotColor).copyWith(fontSize: 44)
                  : AquaticTheme.shotClockStyle(shotColor),
            ),
          ),
          SizedBox(height: isCompact ? 4 : 6),
          // Rule WP 20.15 Badge
          Container(
            key: WidgetKeys.ruleWpBadge,
            padding: EdgeInsets.symmetric(
              horizontal: isCompact ? 8.0 : 10.0,
              vertical: isCompact ? 2.0 : 3.0,
            ),
            decoration: BoxDecoration(
              color: badgeColor.withOpacity(isBlanked ? 0.2 : 0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: badgeColor, width: 1.0),
            ),
            child: Text(
              isBlanked ? 'WP 20.15 AUTO-BLANKED' : 'WP 20.15 ARMED',
              style: TextStyle(
                fontSize: isCompact ? 9 : 10,
                fontWeight: FontWeight.bold,
                color: badgeColor,
                letterSpacing: 0.5,
              ),
            ),
          ),
          SizedBox(height: isCompact ? 4 : 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                key: WidgetKeys.shotMinusButton,
                icon: const Icon(Icons.remove, size: 18, color: Colors.white70),
                tooltip: '-1 Second',
                onPressed: () => controller.adjustShotClock(-1),
              ),
              const SizedBox(width: 8),
              IconButton(
                key: WidgetKeys.shotPlusButton,
                icon: const Icon(Icons.add, size: 18, color: Colors.white70),
                tooltip: '+1 Second',
                onPressed: () => controller.adjustShotClock(1),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
