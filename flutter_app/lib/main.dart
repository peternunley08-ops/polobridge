import 'package:flutter/material.dart';
import 'core/audio/sound_service.dart';
import 'core/theme/aquatic_theme.dart';
import 'domain/engine/timing_engine.dart';
import 'domain/six_eight/six_eight_manager.dart';
import 'infrastructure/ble/mock_ble_service.dart';
import 'infrastructure/mock_data/tournament_presets.dart';
import 'presentation/screens/adaptive_game_screen.dart';
import 'state/game_controller.dart';

/// Top-level InheritedNotifier providing zero-dependency dependency injection
/// of [GameController] throughout the widget hierarchy.
class GameControllerScope extends InheritedNotifier<GameController> {
  final GameController controller;

  const GameControllerScope({
    super.key,
    required this.controller,
    required super.child,
  }) : super(notifier: controller);

  static GameController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<GameControllerScope>();
    assert(scope != null, 'No GameControllerScope found in context');
    return scope!.controller;
  }

  static GameController? maybeOf(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<GameControllerScope>();
    return scope?.controller;
  }
}

/// Root widget of the PoloPad Pro water polo game desk system.
class PoloPadApp extends StatelessWidget {
  final GameController? controller;

  const PoloPadApp({super.key, this.controller});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PoloPad Pro',
      debugShowCheckedModeBanner: false,
      theme: AquaticTheme.themeData,
      home: AdaptiveGameScreen(controller: controller),
    );
  }
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  final soundService = SoundService();
  final engine = TimingEngine(
    soundService: soundService,
    autoTick: true,
  );
  final sixEight = SixEightManager(
    initialMatch: TournamentPresets.match68JO,
  );
  final ble = MockBleService(autoConnect: true);

  final controller = GameController(
    engine: engine,
    sixEight: sixEight,
    ble: ble,
  );

  runApp(
    GameControllerScope(
      controller: controller,
      child: const PoloPadApp(),
    ),
  );
}
