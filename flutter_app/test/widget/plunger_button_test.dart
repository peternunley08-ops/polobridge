import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polopad_pro/core/constants/colors.dart';
import 'package:polopad_pro/core/constants/widget_keys.dart';
import 'package:polopad_pro/presentation/widgets/plunger_button.dart';

void main() {
  group('PlungerButton Widget Tests', () {
    testWidgets('PlungerButton.startStop renders stopped state correctly and responds to tap', (tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PlungerButton.startStop(
              isRunning: false,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      // Verify label, icon, and ValueKey
      expect(find.byKey(WidgetKeys.startStopButton), findsOneWidget);
      expect(find.text('START'), findsOneWidget);
      expect(find.byIcon(Icons.play_circle_filled), findsOneWidget);

      // Tap button
      await tester.tap(find.byKey(WidgetKeys.startStopButton));
      await tester.pump();
      expect(tapped, isTrue);
    });

    testWidgets('PlungerButton.startStop renders running state with WHISTLE and pause icon', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PlungerButton.startStop(
              isRunning: true,
              onTap: () {},
            ),
          ),
        ),
      );

      expect(find.byKey(WidgetKeys.startStopButton), findsOneWidget);
      expect(find.text('WHISTLE'), findsOneWidget);
      expect(find.byIcon(Icons.pause_circle_filled), findsOneWidget);
    });

    testWidgets('PlungerButton.reset30 renders 30 and TURNOVER', (tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PlungerButton.reset30(
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.byKey(WidgetKeys.reset30Button), findsOneWidget);
      expect(find.text('30'), findsOneWidget);
      expect(find.text('TURNOVER'), findsOneWidget);

      await tester.tap(find.byKey(WidgetKeys.reset30Button));
      await tester.pump();
      expect(tapped, isTrue);
    });

    testWidgets('PlungerButton.reset20 renders 20 and REBOUND / FOUL', (tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PlungerButton.reset20(
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.byKey(WidgetKeys.reset20Button), findsOneWidget);
      expect(find.text('20'), findsOneWidget);
      expect(find.text('REBOUND / FOUL'), findsOneWidget);

      await tester.tap(find.byKey(WidgetKeys.reset20Button));
      await tester.pump();
      expect(tapped, isTrue);
    });

    testWidgets('PlungerButton compact mode renders without overflow', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Row(
              children: [
                Expanded(
                  child: PlungerButton.startStop(
                    isRunning: false,
                    onTap: () {},
                    isCompact: true,
                  ),
                ),
                Expanded(
                  child: PlungerButton.reset30(
                    onTap: () {},
                    isCompact: true,
                  ),
                ),
                Expanded(
                  child: PlungerButton.reset20(
                    onTap: () {},
                    isCompact: true,
                  ),
                ),
              ],
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('START'), findsOneWidget);
      expect(find.text('30'), findsOneWidget);
      expect(find.text('20'), findsOneWidget);
    });

    testWidgets('Disabled PlungerButton does not invoke onTap', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: PlungerButton(
              onTap: null,
              gradient: AquaticColors.startPlungerGradient,
              bevelColor: AquaticColors.startGreenBevel,
              label: 'DISABLED',
            ),
          ),
        ),
      );

      expect(find.text('DISABLED'), findsOneWidget);
      await tester.tap(find.text('DISABLED'));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  });
}
