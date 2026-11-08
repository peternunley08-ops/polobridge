import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../domain/six_eight/models.dart';
import '../../state/game_controller.dart';

/// Modal bottom sheet displaying chronological play-by-play telemetry event log
/// with formatted JSON export capability.
class TelemetrySheet extends StatelessWidget {
  final GameController controller;

  const TelemetrySheet({super.key, required this.controller});

  static void show(BuildContext context, GameController controller) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AquaticColors.canvasBlue900,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20.0)),
      ),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.75,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        expand: false,
        builder: (ctx, scrollController) => TelemetrySheet(controller: controller),
      ),
    );
  }

  void _showExportDialog(BuildContext context) {
    final jsonStr = controller.sixEight.exportTelemetryJson();
    showDialog<void>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        backgroundColor: AquaticColors.canvasBlue900,
        title: const Text('6-8 Sports Telemetry JSON', style: TextStyle(color: Colors.white)),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(
            child: SelectableText(
              jsonStr,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: AquaticColors.cyan300),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Close', style: TextStyle(color: AquaticColors.cyan400)),
          ),
        ],
      ),
    );
  }

  Color _badgeColorForType(TelemetryEventType type) {
    switch (type) {
      case TelemetryEventType.goal:
        return AquaticColors.shotClockGreen;
      case TelemetryEventType.exclusion20s:
        return AquaticColors.stopRed;
      case TelemetryEventType.exclusionRelease:
        return AquaticColors.reset20Amber;
      case TelemetryEventType.turnoverReset30:
        return AquaticColors.cyan400;
      case TelemetryEventType.reboundReset20:
        return AquaticColors.reset20Amber;
      case TelemetryEventType.undo:
        return AquaticColors.undoPurple;
      case TelemetryEventType.periodChange:
        return AquaticColors.cyan300;
      default:
        return Colors.white70;
    }
  }

  @override
  Widget build(BuildContext context) {
    final match = controller.activeMatch;
    final events = controller.eventLog;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.white30,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${match.matchId} Telemetry Log',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      '${match.teamWhiteName} vs ${match.teamDarkName} • ${events.length} Events',
                      style: const TextStyle(fontSize: 12, color: AquaticColors.cyan300),
                    ),
                  ],
                ),
              ),
              ElevatedButton.icon(
                icon: const Icon(Icons.code, size: 16),
                label: const Text('JSON', style: TextStyle(fontSize: 11)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AquaticColors.canvasSky900,
                  foregroundColor: AquaticColors.cyan300,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                ),
                onPressed: () => _showExportDialog(context),
              ),
            ],
          ),
          const Divider(color: AquaticColors.borderCyanSubtle, height: 20),

          // Events list
          Expanded(
            child: events.isEmpty
                ? const Center(
                    child: Text('No telemetry events recorded yet.', style: TextStyle(color: Colors.white54)),
                  )
                : ListView.separated(
                    itemCount: events.length,
                    separatorBuilder: (_, __) => const Divider(color: Colors.white12, height: 1),
                    itemBuilder: (context, idx) {
                      final e = events[idx];
                      final badgeColor = _badgeColorForType(e.type);

                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8.0),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                              decoration: BoxDecoration(
                                color: badgeColor.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: badgeColor, width: 1.0),
                              ),
                              child: Text(
                                e.type.code,
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w900,
                                  color: badgeColor,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    e.description,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.white,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'P${e.period} • Clock: ${e.gameClock} | Shot: ${e.shotClock} • ${e.scoreSnapshot}',
                                    style: const TextStyle(fontSize: 10, color: Colors.white54),
                                  ),
                                ],
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
}
