import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/constants/widget_keys.dart';
import '../../core/theme/aquatic_theme.dart';
import '../../state/game_controller.dart';

/// Recessed instrument card for master game clock (MM:SS.d),
/// manual audio horn trigger, and quick 8:00 period clock reset.
class MasterClockCard extends StatelessWidget {
  final GameController controller;
  final bool isCompact;

  const MasterClockCard({
    super.key,
    required this.controller,
    this.isCompact = false,
  });

  @override
  Widget build(BuildContext context) {
    final state = controller.gameState;

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
                'GAME CLOCK (${state.periodDisplay})',
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
              state.formattedGameTime,
              key: WidgetKeys.gameClockDisplay,
              style: isCompact
                  ? AquaticTheme.gameClockStyle.copyWith(fontSize: 34)
                  : AquaticTheme.gameClockStyle,
            ),
          ),
          SizedBox(height: isCompact ? 4 : 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.remove, size: 18, color: Colors.white70),
                tooltip: '-1 Second',
                onPressed: () => controller.adjustGameClock(-1),
              ),
              IconButton(
                key: WidgetKeys.hornButton,
                icon: const Icon(Icons.volume_up, color: Colors.amber, size: 24),
                tooltip: 'Horn Blast',
                onPressed: () => controller.triggerHorn(),
              ),
              IconButton(
                key: WidgetKeys.gameReset800Button,
                icon: const Icon(Icons.refresh, color: AquaticColors.cyan300, size: 20),
                tooltip: 'Reset to 8:00',
                onPressed: () => controller.resetGameClock800(),
              ),
              IconButton(
                icon: const Icon(Icons.add, size: 18, color: Colors.white70),
                tooltip: '+1 Second',
                onPressed: () => controller.adjustGameClock(1),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
