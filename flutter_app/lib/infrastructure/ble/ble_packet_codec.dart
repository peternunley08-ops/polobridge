import 'dart:typed_data';
import '../../domain/models/game_state.dart';
import 'ble_dongle_service.dart';

/// 13-byte deserialized representation of status notification packet.
class BleStatusPacket {
  final bool isRunning;
  final bool hornActive;
  final bool isBlanked;
  final int gameTimeMs;
  final int shotTimeMs;
  final int scoreWhite;
  final int scoreDark;
  final int period;
  final ScoreboardProtocol protocol;

  const BleStatusPacket({
    required this.isRunning,
    required this.hornActive,
    required this.isBlanked,
    required this.gameTimeMs,
    required this.shotTimeMs,
    required this.scoreWhite,
    required this.scoreDark,
    required this.period,
    required this.protocol,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BleStatusPacket &&
          isRunning == other.isRunning &&
          hornActive == other.hornActive &&
          isBlanked == other.isBlanked &&
          gameTimeMs == other.gameTimeMs &&
          shotTimeMs == other.shotTimeMs &&
          scoreWhite == other.scoreWhite &&
          scoreDark == other.scoreDark &&
          period == other.period &&
          protocol == other.protocol;

  @override
  int get hashCode => Object.hash(
        isRunning,
        hornActive,
        isBlanked,
        gameTimeMs,
        shotTimeMs,
        scoreWhite,
        scoreDark,
        period,
        protocol,
      );

  @override
  String toString() =>
      'BleStatusPacket(running: $isRunning, horn: $hornActive, blanked: $isBlanked, '
      'gameTime: ${gameTimeMs}ms, shotTime: ${shotTimeMs}ms, '
      'score: $scoreWhite-$scoreDark, period: $period, protocol: ${protocol.label})';
}

/// Binary serialization and deserialization codec for the ESP32-S3 BLE hardware dongle.
class BlePacketCodec {
  BlePacketCodec._();

  static const int statusPacketLength = 13;

  /// Serializes a [BleStatusPacket] into a 13-byte binary payload.
  static Uint8List encodeStatus(BleStatusPacket packet) {
    final bytes = Uint8List(statusPacketLength);
    final data = ByteData.sublistView(bytes);

    // Byte 0: Flags (Bit 0: isRunning, Bit 1: hornActive, Bit 2: isBlanked)
    int flags = 0;
    if (packet.isRunning) flags |= 0x01;
    if (packet.hornActive) flags |= 0x02;
    if (packet.isBlanked) flags |= 0x04;
    bytes[0] = flags;

    // Bytes 1..4: gameTimeMs (Big-Endian uint32)
    data.setUint32(1, packet.gameTimeMs, Endian.big);

    // Bytes 5..8: shotTimeMs (Big-Endian uint32)
    data.setUint32(5, packet.shotTimeMs, Endian.big);

    // Byte 9: scoreWhite
    bytes[9] = packet.scoreWhite & 0xFF;

    // Byte 10: scoreDark
    bytes[10] = packet.scoreDark & 0xFF;

    // Byte 11: period
    bytes[11] = packet.period & 0xFF;

    // Byte 12: protocol (0 = CTS, 1 = Daktronics)
    bytes[12] = packet.protocol == ScoreboardProtocol.daktronics ? 1 : 0;

    return bytes;
  }

  /// Deserializes a 13-byte binary payload into a [BleStatusPacket].
  static BleStatusPacket decodeStatus(Uint8List bytes) {
    if (bytes.length < statusPacketLength) {
      throw FormatException(
        'BLE status packet too short: expected $statusPacketLength bytes, got ${bytes.length}',
      );
    }

    final data = ByteData.sublistView(bytes);
    final flags = bytes[0];
    final isRunning = (flags & 0x01) != 0;
    final hornActive = (flags & 0x02) != 0;
    final isBlanked = (flags & 0x04) != 0;

    final gameTimeMs = data.getUint32(1, Endian.big);
    final shotTimeMs = data.getUint32(5, Endian.big);
    final scoreWhite = bytes[9];
    final scoreDark = bytes[10];
    final period = bytes[11];
    final protoByte = bytes[12];
    final protocol = protoByte == 1 ? ScoreboardProtocol.daktronics : ScoreboardProtocol.cts;

    return BleStatusPacket(
      isRunning: isRunning,
      hornActive: hornActive,
      isBlanked: isBlanked,
      gameTimeMs: gameTimeMs,
      shotTimeMs: shotTimeMs,
      scoreWhite: scoreWhite,
      scoreDark: scoreDark,
      period: period,
      protocol: protocol,
    );
  }

  /// Builds a 13-byte binary status packet directly from current [GameState].
  static Uint8List buildStatusPacket(GameState state, [ScoreboardProtocol protocol = ScoreboardProtocol.cts]) {
    final packet = BleStatusPacket(
      isRunning: state.isRunning,
      hornActive: state.isHornActive,
      isBlanked: state.isShotClockBlanked,
      gameTimeMs: state.gameTimeMs,
      shotTimeMs: state.shotTimeMs,
      scoreWhite: state.scoreWhite,
      scoreDark: state.scoreDark,
      period: state.period,
      protocol: protocol,
    );
    return encodeStatus(packet);
  }

  // --- Outbound Command Packet Encoders ---

  static Uint8List encodeStop() => Uint8List.fromList([0x01]);
  static Uint8List encodeStart() => Uint8List.fromList([0x02]);
  static Uint8List encodeReset30() => Uint8List.fromList([0x03]);
  static Uint8List encodeReset20() => Uint8List.fromList([0x04]);

  static Uint8List encodeSetShotClock(int shotTimeMs) {
    final sec = (shotTimeMs ~/ 1000) & 0xFF;
    final tenths = ((shotTimeMs % 1000) ~/ 100) & 0xFF;
    return Uint8List.fromList([0x05, sec, tenths]);
  }

  static Uint8List encodeSetGameClock(int gameTimeMs) {
    final min = (gameTimeMs ~/ 60000) & 0xFF;
    final sec = ((gameTimeMs % 60000) ~/ 1000) & 0xFF;
    final tenths = ((gameTimeMs % 1000) ~/ 100) & 0xFF;
    return Uint8List.fromList([0x06, min, sec, tenths]);
  }

  static Uint8List encodeTriggerHorn(int durationMs) {
    final hi = (durationMs >> 8) & 0xFF;
    final lo = durationMs & 0xFF;
    return Uint8List.fromList([0x07, hi, lo]);
  }

  static Uint8List encodeSetScores(int white, int dark, int period) {
    return Uint8List.fromList([0x08, white & 0xFF, dark & 0xFF, period & 0xFF]);
  }

  static Uint8List encodePulsePickle(int durationMs) {
    return Uint8List.fromList([0x09, durationMs & 0xFF]);
  }

  static Uint8List encodeSetProtocol(ScoreboardProtocol protocol) {
    return Uint8List.fromList([0x0B, protocol == ScoreboardProtocol.daktronics ? 1 : 0]);
  }
}
