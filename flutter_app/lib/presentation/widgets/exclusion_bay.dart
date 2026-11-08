import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/constants/widget_keys.dart';
import '../../domain/models/team.dart';
import '../../state/game_controller.dart';

/// Active 20-second player exclusion penalty track with early release (REL) trigger.
class ExclusionBay extends StatelessWidget {
  final Team team;
  final GameController controller;

  const ExclusionBay({
    super.key,
    required this.team,
    required this.controller,
  });

  @override
  Widget build(BuildContext context) {
    final teamExclusions = controller.gameState.exclusions
        .where((e) => e.team == team)
        .toList();

    if (teamExclusions.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Padding(
          padding: EdgeInsets.only(bottom: 4.0),
          child: Text(
            'PENALTIES:',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: Colors.amber,
              letterSpacing: 0.5,
            ),
          ),
        ),
        ...teamExclusions.map((exc) {
          return Container(
            margin: const EdgeInsets.only(bottom: 4.0),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.red.shade900.withOpacity(0.65),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: AquaticColors.stopRed.withOpacity(0.5),
                width: 1.0,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '#${exc.capNumber} ${exc.remainingSecondsCeil}s',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    key: WidgetKeys.exclusionRelButton(exc.id),
                    borderRadius: BorderRadius.circular(4),
                    onTap: () => controller.releaseExclusion(exc.id),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade700,
                        borderRadius: BorderRadius.circular(4),
                        boxShadow: const [
                          BoxShadow(
                            color: Colors.black26,
                            blurRadius: 2,
                            offset: Offset(0, 1),
                          ),
                        ],
                      ),
                      child: const Text(
                        'REL',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: Colors.black,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}
