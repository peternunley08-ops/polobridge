import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/constants/widget_keys.dart';
import '../../domain/models/team.dart';
import '../../domain/six_eight/models.dart';
import '../../state/game_controller.dart';
import 'exclusion_bay.dart';

/// Team score desk bay displaying team branding, live score +/- buttons,
/// ejection trigger modal, active exclusions, and player foul roster.
class TeamBay extends StatelessWidget {
  final Team team;
  final GameController controller;
  final bool isCompact;

  const TeamBay({
    super.key,
    required this.team,
    required this.controller,
    this.isCompact = false,
  });

  void _openCapPicker(BuildContext context) {
    final isWhite = team == Team.white;
    final roster = isWhite
        ? controller.sixEight.whiteRoster
        : controller.sixEight.darkRoster;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AquaticColors.canvasBlue900,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20.0)),
      ),
      builder: (modalCtx) {
        return Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Eject ${team.displayName} Player',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: roster.map((player) {
                  final key = WidgetKeys.capPickerButton(player.capNumber);
                  final isDisabled = player.isCappedOut;

                  return ElevatedButton(
                    key: key,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isDisabled
                          ? Colors.grey.shade700
                          : (isWhite ? Colors.white : AquaticColors.cyan400),
                      foregroundColor: Colors.black,
                      disabledBackgroundColor: Colors.grey.shade800,
                      disabledForegroundColor: Colors.white38,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                    onPressed: isDisabled
                        ? null
                        : () {
                            controller.addExclusion(team, player.capNumber);
                            Navigator.pop(modalCtx);
                          },
                    child: Text(
                      '#${player.capNumber} ${player.name} (${player.foulDisplay})',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        decoration: isDisabled ? TextDecoration.lineThrough : null,
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isWhite = team == Team.white;
    final match = controller.activeMatch;
    final teamName = isWhite ? match.teamWhiteName : match.teamDarkName;
    final state = controller.gameState;
    final score = isWhite ? state.scoreWhite : state.scoreDark;
    final roster = isWhite
        ? controller.sixEight.whiteRoster
        : controller.sixEight.darkRoster;

    final plusKey = isWhite ? WidgetKeys.whiteScorePlus : WidgetKeys.darkScorePlus;
    final minusKey = isWhite ? WidgetKeys.whiteScoreMinus : WidgetKeys.darkScoreMinus;
    final ejectKey = isWhite ? WidgetKeys.whiteEjectButton : WidgetKeys.darkEjectButton;

    Widget rosterListWidget = ListView.builder(
      shrinkWrap: true,
      physics: isCompact
          ? const NeverScrollableScrollPhysics()
          : const ClampingScrollPhysics(),
      itemCount: roster.length,
      itemBuilder: (context, idx) {
        final player = roster[idx];
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 2.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text(
                  '#${player.capNumber} ${player.name}',
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 10.5,
                    color: player.isCappedOut
                        ? Colors.red.shade300
                        : Colors.white70,
                    decoration:
                        player.isCappedOut ? TextDecoration.lineThrough : null,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              Text(
                player.foulDisplay,
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.bold,
                  color: player.isCappedOut
                      ? Colors.red
                      : (player.personalFouls > 0
                          ? Colors.amber
                          : Colors.white38),
                ),
              ),
            ],
          ),
        );
      },
    );

    return Container(
      padding: EdgeInsets.all(isCompact ? 8.0 : 12.0),
      decoration: BoxDecoration(
        color: isWhite
            ? AquaticColors.teamWhiteCardFrom
            : AquaticColors.teamDarkCardFrom,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isWhite
              ? Colors.white.withOpacity(0.3)
              : AquaticColors.borderCyanGlow,
          width: 1.2,
        ),
        boxShadow: const [
          BoxShadow(
            color: Colors.black38,
            blurRadius: 6,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header: Team Name and Cap Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  teamName.toUpperCase(),
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: isCompact ? 13 : 15,
                    color: Colors.white,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: isWhite ? Colors.white : AquaticColors.cyan400,
                  shape: BoxShape.circle,
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black38,
                      blurRadius: 3,
                      offset: Offset(0, 1),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: isCompact ? 4 : 8),

          // Score Controls
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                key: minusKey,
                icon: const Icon(Icons.remove_circle_outline, color: Colors.white70),
                tooltip: 'Score -1',
                onPressed: () => controller.decrementScore(team),
              ),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: isCompact ? 6.0 : 12.0),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    '$score',
                    style: TextStyle(
                      fontSize: isCompact ? 28 : 34,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              IconButton(
                key: plusKey,
                icon: const Icon(Icons.add_circle, color: Colors.white),
                tooltip: 'Score +1',
                onPressed: () => controller.incrementScore(team),
              ),
            ],
          ),
          SizedBox(height: isCompact ? 4 : 8),

          // Eject Button
          ElevatedButton.icon(
            key: ejectKey,
            icon: const Icon(Icons.warning_amber_rounded, size: 16),
            label: const Text(
              '+ EJECT (20s)',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: isWhite
                  ? AquaticColors.canvasSky900
                  : AquaticColors.canvasIndigo950,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 6),
            ),
            onPressed: () => _openCapPicker(context),
          ),
          const SizedBox(height: 6),

          // Exclusion Bay (Active 20s penalties)
          ExclusionBay(team: team, controller: controller),
          const SizedBox(height: 6),

          // Roster Summary
          if (isCompact)
            rosterListWidget
          else
            Expanded(child: rosterListWidget),
        ],
      ),
    );
  }
}
