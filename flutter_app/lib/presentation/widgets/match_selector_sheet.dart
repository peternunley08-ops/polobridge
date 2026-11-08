import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/constants/widget_keys.dart';
import '../../domain/six_eight/models.dart';
import '../../infrastructure/mock_data/tournament_presets.dart';
import '../../state/game_controller.dart';
import 'telemetry_sheet.dart';

/// Top header bar and tournament match switcher with protocol toggling and BLE telemetry status.
class MatchSelectorSheet extends StatelessWidget {
  final GameController controller;
  final bool isCompact;

  const MatchSelectorSheet({
    super.key,
    required this.controller,
    this.isCompact = false,
  });

  static void show(BuildContext context, GameController controller) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AquaticColors.canvasBlue900,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20.0)),
      ),
      builder: (_) => MatchSelectorSheet(controller: controller),
    );
  }

  @override
  Widget build(BuildContext context) {
    final match = controller.activeMatch;
    final protocol = controller.activeProtocol;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isCompact ? 8.0 : 12.0,
        vertical: isCompact ? 4.0 : 6.0,
      ),
      decoration: BoxDecoration(
        color: AquaticColors.surfaceSapphire,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AquaticColors.borderCyanSubtle),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Match description
          Flexible(
            child: Text(
              '${match.matchId} • ${match.whiteTeamName} vs ${match.darkTeamName}',
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AquaticColors.cyan300,
                fontWeight: FontWeight.bold,
                fontSize: isCompact ? 11 : 13,
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Protocol toggle, Preset dropdown, and Telemetry sheet opener
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Protocol Toggle Button
              ElevatedButton(
                key: WidgetKeys.protocolToggle,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AquaticColors.canvasBlue900,
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(
                    horizontal: isCompact ? 8 : 10,
                    vertical: isCompact ? 3 : 5,
                  ),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: () => controller.toggleProtocol(),
                child: Text(
                  protocol.label,
                  style: TextStyle(fontSize: isCompact ? 10 : 11, color: Colors.white),
                ),
              ),
              const SizedBox(width: 6),

              // Match Preset Dropdown Menu
              PopupMenuButton<TournamentMatch>(
                key: WidgetKeys.matchPresetDropdown,
                icon: const Icon(Icons.sports, color: AquaticColors.cyan400, size: 20),
                tooltip: 'Select Match Preset',
                onSelected: (selected) => controller.selectMatch(selected),
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: TournamentPresets.match68JO,
                    child: const Text('68-JO-2026-412 (Vanguard vs Stanford)'),
                  ),
                  PopupMenuItem(
                    value: TournamentPresets.match68ODP,
                    child: const Text('68-ODP-2026-108 (PAC-SW vs Coastal)'),
                  ),
                  PopupMenuItem(
                    value: TournamentPresets.match68KAP7,
                    child: const Text('68-KAP7-2026-889 (Newport vs J-Serra)'),
                  ),
                ],
              ),

              // Telemetry Log Sheet Opener
              IconButton(
                icon: const Icon(Icons.analytics_outlined, color: AquaticColors.cyan300, size: 20),
                tooltip: 'Live Telemetry Log',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () => TelemetrySheet.show(context, controller),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
