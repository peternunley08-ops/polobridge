import 'package:flutter/material.dart';
import '../../core/constants/colors.dart';
import '../../core/constants/widget_keys.dart';

/// Tactile 3D Plunger Button engineered for aquatic deck operations.
/// Features multi-layered bevels, outer glow, inner depth shadow,
/// and interactive press translation for true physical tactile feedback.
class PlungerButton extends StatefulWidget {
  final Key? buttonKey;
  final VoidCallback? onTap;
  final Gradient gradient;
  final Color bevelColor;
  final String label;
  final String? subtitle;
  final IconData? icon;
  final bool isCompact;
  final double? width;
  final double? height;

  const PlungerButton({
    super.key,
    this.buttonKey,
    required this.onTap,
    required this.gradient,
    required this.bevelColor,
    required this.label,
    this.subtitle,
    this.icon,
    this.isCompact = false,
    this.width,
    this.height,
  });

  /// Factory constructor for the Giant Left-Thumb Start/Stop Whistle Plunger.
  factory PlungerButton.startStop({
    Key? key,
    Key? buttonKey,
    required bool isRunning,
    required VoidCallback onTap,
    bool isCompact = false,
    double? width,
    double? height,
  }) {
    return PlungerButton(
      key: key,
      buttonKey: buttonKey ?? WidgetKeys.startStopButton,
      onTap: onTap,
      gradient: isRunning
          ? AquaticColors.stopPlungerGradient
          : AquaticColors.startPlungerGradient,
      bevelColor: isRunning
          ? AquaticColors.stopRedBevel
          : AquaticColors.startGreenBevel,
      label: isRunning ? 'WHISTLE' : 'START',
      icon: isRunning ? Icons.pause_circle_filled : Icons.play_circle_filled,
      isCompact: isCompact,
      width: width,
      height: height,
    );
  }

  /// Factory constructor for the Right-Thumb Reset 30 Turnover Plunger.
  factory PlungerButton.reset30({
    Key? key,
    Key? buttonKey,
    required VoidCallback onTap,
    bool isCompact = false,
    double? width,
    double? height,
  }) {
    return PlungerButton(
      key: key,
      buttonKey: buttonKey ?? WidgetKeys.reset30Button,
      onTap: onTap,
      gradient: AquaticColors.reset30PlungerGradient,
      bevelColor: AquaticColors.reset30GreenBevel,
      label: '30',
      subtitle: 'TURNOVER',
      isCompact: isCompact,
      width: width,
      height: height,
    );
  }

  /// Factory constructor for the Right-Thumb Reset 20 Rebound/Foul Plunger.
  factory PlungerButton.reset20({
    Key? key,
    Key? buttonKey,
    required VoidCallback onTap,
    bool isCompact = false,
    double? width,
    double? height,
  }) {
    return PlungerButton(
      key: key,
      buttonKey: buttonKey ?? WidgetKeys.reset20Button,
      onTap: onTap,
      gradient: AquaticColors.reset20PlungerGradient,
      bevelColor: AquaticColors.reset20AmberBevel,
      label: '20',
      subtitle: 'REBOUND / FOUL',
      isCompact: isCompact,
      width: width,
      height: height,
    );
  }

  @override
  State<PlungerButton> createState() => _PlungerButtonState();
}

class _PlungerButtonState extends State<PlungerButton> {
  bool _isPressed = false;

  void _handleTapDown(TapDownDetails _) {
    if (widget.onTap != null) {
      setState(() => _isPressed = true);
    }
  }

  void _handleTapUp(TapUpDetails _) {
    if (_isPressed) {
      setState(() => _isPressed = false);
    }
  }

  void _handleTapCancel() {
    if (_isPressed) {
      setState(() => _isPressed = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEnabled = widget.onTap != null;
    final borderRadius = BorderRadius.circular(widget.isCompact ? 12.0 : 16.0);

    return Container(
      width: widget.width,
      height: widget.height,
      decoration: BoxDecoration(
        color: widget.bevelColor,
        borderRadius: borderRadius,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(_isPressed ? 0.3 : 0.5),
            offset: Offset(0, _isPressed ? 1.0 : 4.0),
            blurRadius: _isPressed ? 2.0 : 6.0,
          ),
          if (!_isPressed)
            BoxShadow(
              color: AquaticColors.borderCyanGlow.withOpacity(0.2),
              offset: const Offset(0, -1),
              blurRadius: 4,
            ),
        ],
      ),
      child: Transform.translate(
        offset: Offset(0, _isPressed ? 3.0 : 0.0),
        child: Container(
          decoration: BoxDecoration(
            gradient: widget.gradient,
            borderRadius: borderRadius,
            border: Border.all(
              color: Colors.white.withOpacity(0.35),
              width: 1.5,
            ),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              key: widget.buttonKey,
              borderRadius: borderRadius,
              onTap: widget.onTap,
              onTapDown: _handleTapDown,
              onTapUp: _handleTapUp,
              onTapCancel: _handleTapCancel,
              splashColor: Colors.white24,
              highlightColor: Colors.transparent,
              child: Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: widget.isCompact ? 6.0 : 12.0,
                    vertical: widget.isCompact ? 6.0 : 10.0,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (widget.icon != null) ...[
                        Icon(
                          widget.icon,
                          color: Colors.white,
                          size: widget.isCompact ? 28 : 44,
                        ),
                        SizedBox(height: widget.isCompact ? 2 : 4),
                      ],
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          widget.label,
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: widget.isCompact
                                ? (widget.icon != null ? 13 : 20)
                                : (widget.icon != null ? 20 : 36),
                            letterSpacing: 1.0,
                          ),
                        ),
                      ),
                      if (widget.subtitle != null) ...[
                        const SizedBox(height: 2),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            widget.subtitle!,
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.9),
                              fontWeight: FontWeight.bold,
                              fontSize: widget.isCompact ? 9 : 12,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
