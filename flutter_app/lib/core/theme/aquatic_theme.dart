import 'package:flutter/material.dart';
import '../constants/colors.dart';

/// Vibrant Sunlit Olympic Pool Aquatic Theme.
/// In strict accordance with core constraints: STRICTLY NO pitch-black backgrounds.
class AquaticTheme {
  AquaticTheme._();

  static ThemeData get themeData {
    final base = ThemeData.dark(useMaterial3: true);

    return base.copyWith(
      scaffoldBackgroundColor: AquaticColors.canvasSky900,
      primaryColor: AquaticColors.cyan400,
      colorScheme: ColorScheme.dark(
        primary: AquaticColors.cyan400,
        secondary: AquaticColors.cyan300,
        surface: AquaticColors.surfaceDeepBlue,
        error: AquaticColors.stopRed,
        onPrimary: Colors.black,
        onSecondary: Colors.black,
        onSurface: Colors.white,
        onError: Colors.white,
      ),
      cardTheme: CardTheme(
        color: AquaticColors.surfaceSapphire,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16.0),
          side: const BorderSide(
            color: AquaticColors.borderCyanSubtle,
            width: 1.0,
          ),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: AquaticColors.surfaceSapphire,
        selectedColor: AquaticColors.cyan400,
        side: const BorderSide(color: AquaticColors.borderCyanSubtle),
        labelStyle: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AquaticColors.canvasBlue900,
          foregroundColor: Colors.white,
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10.0),
            side: const BorderSide(color: AquaticColors.borderCyanSubtle),
          ),
        ),
      ),
      dialogTheme: DialogTheme(
        backgroundColor: AquaticColors.canvasBlue900,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16.0),
          side: const BorderSide(color: AquaticColors.borderCyanGlow),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AquaticColors.canvasBlue900,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20.0)),
        ),
      ),
    );
  }

  // --- Background Canvas Gradient ---
  static const BoxDecoration backgroundDecoration = BoxDecoration(
    gradient: AquaticColors.backgroundGradient,
  );

  // --- Translucent Glass Card Decoration ---
  static BoxDecoration glassCardDecoration({
    Color? color,
    Color? borderColor,
    double borderRadius = 16.0,
  }) {
    return BoxDecoration(
      color: color ?? AquaticColors.surfaceSapphire,
      borderRadius: BorderRadius.circular(borderRadius),
      border: Border.all(
        color: borderColor ?? AquaticColors.borderCyanSubtle,
        width: 1.0,
      ),
      boxShadow: const [
        BoxShadow(
          color: Colors.black26,
          blurRadius: 8,
          offset: Offset(0, 4),
        ),
      ],
    );
  }

  // --- Recessed Instrument Bay Decoration ---
  static BoxDecoration recessedBayDecoration({
    Color? borderColor,
    double borderRadius = 16.0,
  }) {
    return BoxDecoration(
      color: AquaticColors.surfaceDeepBlue,
      borderRadius: BorderRadius.circular(borderRadius),
      border: Border.all(
        color: borderColor ?? AquaticColors.borderCyanGlow,
        width: 1.5,
      ),
      boxShadow: const [
        BoxShadow(
          color: Colors.black45,
          blurRadius: 10,
          offset: Offset(0, 6),
        ),
      ],
    );
  }

  // --- Monospace Digital Readout Text Styles ---
  static const TextStyle gameClockStyle = TextStyle(
    fontFamily: 'monospace',
    fontSize: 48,
    fontWeight: FontWeight.w900,
    color: AquaticColors.gameClockAmber,
    letterSpacing: 2.0,
  );

  static TextStyle shotClockStyle(Color color) {
    return TextStyle(
      fontFamily: 'monospace',
      fontSize: 64,
      fontWeight: FontWeight.w900,
      color: color,
      letterSpacing: 3.0,
    );
  }
}
