import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/theme/aquatic_theme.dart';
import '../../main.dart';
import '../../state/game_controller.dart';
import 'mobile_stacked_layout.dart';
import 'tablet_dual_thumb_layout.dart';

/// Adaptive master screen that dynamically transitions between
/// 3-column dual-thumb layout (> 600dp) and mobile stacked layout (<= 600dp).
class AdaptiveGameScreen extends StatelessWidget {
  final GameController? controller;

  const AdaptiveGameScreen({super.key, this.controller});

  @override
  Widget build(BuildContext context) {
    final effectiveController = controller ?? GameControllerScope.maybeOf(context);

    if (effectiveController == null) {
      return Scaffold(
        backgroundColor: AquaticColors.canvasSky900,
        body: const Center(
          child: Text(
            'Error: No GameController provided in AdaptiveGameScreen',
            style: TextStyle(color: Colors.white),
          ),
        ),
      );
    }

    return ListenableBuilder(
      listenable: effectiveController,
      builder: (context, _) {
        return Scaffold(
          backgroundColor: AquaticColors.canvasSky900,
          body: Container(
            decoration: AquaticTheme.backgroundDecoration,
            child: SafeArea(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  if (constraints.maxWidth > 600) {
                    return TabletDualThumbLayout(controller: effectiveController);
                  } else {
                    return MobileStackedLayout(controller: effectiveController);
                  }
                },
              ),
            ),
          ),
        );
      },
    );
  }
}
