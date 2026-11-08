import 'package:flutter/material.dart';

/// Vibrant Sunlit Olympic Pool Aquatic Theme Palette
/// In strict accordance with design guidelines: NO pitch-black backgrounds.
class AquaticColors {
  AquaticColors._();

  // --- Background Canvas Gradients ---
  static const Color canvasSky900 = Color(0xFF0C4A6E);
  static const Color canvasBlue900 = Color(0xFF1E3A8A);
  static const Color canvasIndigo950 = Color(0xFF1E1B4B);

  static const LinearGradient backgroundGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [canvasSky900, canvasBlue900, canvasIndigo950],
  );

  // --- Glass & Card Panels ---
  static const Color surfaceSapphire = Color(0x330284C7); // Sapphire 20%
  static const Color surfaceTeal = Color(0x260F766E);     // Teal 15%
  static const Color surfaceDeepBlue = Color(0xCC031326); // Recessed clock bay
  static const Color surfacePanel = Color(0xE6075985);

  // --- Glowing Glass Borders ---
  static const Color borderCyanSubtle = Color(0x4D22D3EE); // cyan-400 at 30%
  static const Color borderCyanGlow = Color(0x8022D3EE);   // cyan-400 at 50%
  static const Color cyan400 = Color(0xFF22D3EE);
  static const Color cyan300 = Color(0xFF67E8F9);

  // --- Clock Digital Readout LED Colors ---
  static const Color gameClockAmber = Color(0xFFFBBF24); // amber-400
  static const Color shotClockGreen = Color(0xFF34D399); // emerald-400 (>=10s)
  static const Color shotClockAmber = Color(0xFFFBBF24); // amber-400 (5s..9.9s)
  static const Color shotClockRed = Color(0xFFF87171);   // rose-400 (<5s warning)
  static const Color clockBlanked = Color(0x730369A1);   // dimmed sky-700/800 for '--'

  // --- 3D Tactile Plungers ---
  // Start / Play Plunger (Emerald)
  static const Color startGreen = Color(0xFF10B981);
  static const Color startGreenDark = Color(0xFF047857);
  static const Color startGreenBevel = Color(0xFF065F46);

  // Stop / Whistle Plunger (Rose)
  static const Color stopRed = Color(0xFFF43F5E);
  static const Color stopRedDark = Color(0xFFBE123C);
  static const Color stopRedBevel = Color(0xFF881337);

  // Reset 30 (Emerald)
  static const Color reset30Green = Color(0xFF059669);
  static const Color reset30GreenDark = Color(0xFF065F46);
  static const Color reset30GreenBevel = Color(0xFF022C22);

  // Reset 20 (Amber/Orange)
  static const Color reset20Amber = Color(0xFFD97706);
  static const Color reset20AmberDark = Color(0xFFB45309);
  static const Color reset20AmberBevel = Color(0xFF92400E);

  // Undo Button (Violet/Purple)
  static const Color undoPurple = Color(0xFF8B5CF6);
  static const Color undoPurpleDark = Color(0xFF6D28D9);
  static const Color undoPurpleBevel = Color(0xFF4C1D95);

  // --- Team Cap & Bay Colors ---
  static const Color teamWhiteCardFrom = Color(0xB30369A1);
  static const Color teamWhiteCardTo = Color(0xE61E3A8A);
  static const Color teamWhiteCap = Color(0xFFFFFFFF);

  static const Color teamDarkCardFrom = Color(0xBF1D4ED8);
  static const Color teamDarkCardTo = Color(0xE61E1B4B);
  static const Color teamDarkCap = Color(0xFF22D3EE);

  // --- Rule Status Badges ---
  static const Color ruleArmed = Color(0xFF22D3EE);
  static const Color ruleBlanked = Color(0xFFF59E0B);

  // --- Linear Gradients for Buttons ---
  static const LinearGradient startPlungerGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF34D399), startGreen, startGreenDark],
  );

  static const LinearGradient stopPlungerGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFFB7185), stopRed, stopRedDark],
  );

  static const LinearGradient reset30PlungerGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF34D399), reset30Green, reset30GreenDark],
  );

  static const LinearGradient reset20PlungerGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFFBBF24), reset20Amber, reset20AmberDark],
  );

  static const LinearGradient undoButtonGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFA78BFA), undoPurple, undoPurpleDark],
  );
}
