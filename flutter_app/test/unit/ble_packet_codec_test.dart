import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:polopad_pro/domain/models/game_state.dart';
import 'package:polopad_pro/infrastructure/ble/ble_dongle_service.dart';
import 'package:polopad_pro/infrastructure/ble/ble_packet_codec.dart';

void main() {
  group('BLE Binary Status Packet Serialization (13 Bytes)', () {
    test('Encodes standard 8:00 game clock, 30s shot clock, CTS protocol, 0-0 score', () {
      const packet = BleStatusPacket(
        isRunning: true,
        hornActive: false,
        isBlanked: false,
        gameTimeMs: 480000, // 8 * 60 * 1000 = 0x00075300
        shotTimeMs: 30000,  // 30 * 1000 = 0x00007530
        scoreWhite: 0,
        scoreDark: 0,
        period: 1,
        protocol: ScoreboardProtocol.cts,
      );

      final bytes = BlePacketCodec.encodeStatus(packet);

      expect(bytes.length, 13);
      // Byte 0: Flags (bit 0 = 1, bit 1 = 0, bit 2 = 0)
      expect(bytes[0], 0x01);

      // Bytes 1..4: gameTimeMs big-endian (480,000)
      expect(bytes[1], 0x00);
      expect(bytes[2], 0x07);
      expect(bytes[3], 0x53);
      expect(bytes[4], 0x00);

      // Bytes 5..8: shotTimeMs big-endian (30,000)
      expect(bytes[5], 0x00);
      expect(bytes[6], 0x00);
      expect(bytes[7], 0x75);
      expect(bytes[8], 0x30);

      // Byte 9: scoreWhite, Byte 10: scoreDark, Byte 11: period
      expect(bytes[9], 0);
      expect(bytes[10], 0);
      expect(bytes[11], 1);

      // Byte 12: protocol (0 = CTS)
      expect(bytes[12], 0);
    });

    test('Encodes flags combinations correctly (isRunning, hornActive, isBlanked)', () {
      // All flags true -> 0x01 | 0x02 | 0x04 = 0x07
      const p1 = BleStatusPacket(
        isRunning: true,
        hornActive: true,
        isBlanked: true,
        gameTimeMs: 15000,
        shotTimeMs: 20000,
        scoreWhite: 10,
        scoreDark: 8,
        period: 4,
        protocol: ScoreboardProtocol.daktronics,
      );
      final b1 = BlePacketCodec.encodeStatus(p1);
      expect(b1[0], 0x07);
      expect(b1[12], 1); // Daktronics = 1

      // Only isBlanked true -> 0x04
      const p2 = BleStatusPacket(
        isRunning: false,
        hornActive: false,
        isBlanked: true,
        gameTimeMs: 5000,
        shotTimeMs: 10000,
        scoreWhite: 5,
        scoreDark: 6,
        period: 2,
        protocol: ScoreboardProtocol.cts,
      );
      final b2 = BlePacketCodec.encodeStatus(p2);
      expect(b2[0], 0x04);
      expect(b2[12], 0); // CTS = 0
    });

    test('Round-trip decode restores all fields identically', () {
      const original = BleStatusPacket(
        isRunning: true,
        hornActive: false,
        isBlanked: true,
        gameTimeMs: 275400,
        shotTimeMs: 18200,
        scoreWhite: 12,
        scoreDark: 11,
        period: 3,
        protocol: ScoreboardProtocol.daktronics,
      );

      final encoded = BlePacketCodec.encodeStatus(original);
      final decoded = BlePacketCodec.decodeStatus(encoded);

      expect(decoded.isRunning, original.isRunning);
      expect(decoded.hornActive, original.hornActive);
      expect(decoded.isBlanked, original.isBlanked);
      expect(decoded.gameTimeMs, original.gameTimeMs);
      expect(decoded.shotTimeMs, original.shotTimeMs);
      expect(decoded.scoreWhite, original.scoreWhite);
      expect(decoded.scoreDark, original.scoreDark);
      expect(decoded.period, original.period);
      expect(decoded.protocol, original.protocol);
      expect(decoded, equals(original));
    });

    test('Throws FormatException when payload is truncated (< 13 bytes)', () {
      final truncated = Uint8List(12);
      expect(
        () => BlePacketCodec.decodeStatus(truncated),
        throwsFormatException,
      );
    });

    test('buildStatusPacket from GameState matches direct encoding', () {
      final state = GameState.initial().copyWith(
        isRunning: true,
        scoreWhite: 4,
        scoreDark: 3,
        period: 2,
      );

      final bytes = BlePacketCodec.buildStatusPacket(state, ScoreboardProtocol.daktronics);
      final decoded = BlePacketCodec.decodeStatus(bytes);

      expect(decoded.isRunning, isTrue);
      expect(decoded.scoreWhite, 4);
      expect(decoded.scoreDark, 3);
      expect(decoded.period, 2);
      expect(decoded.protocol, ScoreboardProtocol.daktronics);
    });
  });

  group('Outbound BLE Command Opcodes', () {
    test('Stop, Start, Reset 30, and Reset 20 opcodes', () {
      expect(BlePacketCodec.encodeStop(), equals(Uint8List.fromList([0x01])));
      expect(BlePacketCodec.encodeStart(), equals(Uint8List.fromList([0x02])));
      expect(BlePacketCodec.encodeReset30(), equals(Uint8List.fromList([0x03])));
      expect(BlePacketCodec.encodeReset20(), equals(Uint8List.fromList([0x04])));
    });

    test('Set Shot Clock (0x05, sec, tenths)', () {
      // 14.5 seconds = 14500ms
      final bytes = BlePacketCodec.encodeSetShotClock(14500);
      expect(bytes, equals(Uint8List.fromList([0x05, 14, 5])));
    });

    test('Set Game Clock (0x06, min, sec, tenths)', () {
      // 7:30.2 = 7*60*1000 + 30*1000 + 200 = 450200ms
      final bytes = BlePacketCodec.encodeSetGameClock(450200);
      expect(bytes, equals(Uint8List.fromList([0x06, 7, 30, 2])));
    });

    test('Trigger Horn (0x07, durationHi, durationLo)', () {
      // 1200ms = 0x04B0 -> hi = 0x04, lo = 0xB0
      final bytes = BlePacketCodec.encodeTriggerHorn(1200);
      expect(bytes, equals(Uint8List.fromList([0x07, 0x04, 0xB0])));
    });

    test('Set Scores & Period (0x08, white, dark, period)', () {
      final bytes = BlePacketCodec.encodeSetScores(12, 10, 3);
      expect(bytes, equals(Uint8List.fromList([0x08, 12, 10, 3])));
    });

    test('Pulse Pickle Auxiliary (0x09, durationMs)', () {
      final bytes = BlePacketCodec.encodePulsePickle(150);
      expect(bytes, equals(Uint8List.fromList([0x09, 150])));
    });

    test('Set Scoreboard Protocol (0x0B, protocolByte)', () {
      expect(
        BlePacketCodec.encodeSetProtocol(ScoreboardProtocol.cts),
        equals(Uint8List.fromList([0x0B, 0])),
      );
      expect(
        BlePacketCodec.encodeSetProtocol(ScoreboardProtocol.daktronics),
        equals(Uint8List.fromList([0x0B, 1])),
      );
    });
  });
}
