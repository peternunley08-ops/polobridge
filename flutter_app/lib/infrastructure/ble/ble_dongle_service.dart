import 'dart:async';
import 'dart:typed_data';
import '../../domain/models/game_state.dart';
import 'ble_packet_codec.dart';

/// Supported hardware scoreboard serial output protocols.
enum ScoreboardProtocol {
  cts('CTS 9600-8-E-1', 0),
  daktronics('DAKT CODE 4498', 1);

  final String label;
  final int code;
  const ScoreboardProtocol(this.label, this.code);
}

/// BLE hardware connection lifecycle states.
enum BleConnectionState {
  disconnected,
  connecting,
  connected,
  error;
}

/// Abstract contract for Bluetooth Low Energy hardware dongle communication.
/// Matches Service UUID `4fa10001-b5a3-f393-e0a9-e50e24dcca9e`,
/// Command Characteristic `4fa10002-...`, and Status Characteristic `4fa10003-...`.
abstract class BleDongleService {
  static const String serviceUuidStr = '4fa10001-b5a3-f393-e0a9-e50e24dcca9e';
  static const String commandCharUuidStr = '4fa10002-b5a3-f393-e0a9-e50e24dcca9e';
  static const String statusCharUuidStr = '4fa10003-b5a3-f393-e0a9-e50e24dcca9e';

  // Interface getters matching PROJECT.md
  String get serviceUuid => serviceUuidStr;
  String get commandUuid => commandCharUuidStr;
  String get statusUuid => statusCharUuidStr;

  BleConnectionState get connectionState;
  ScoreboardProtocol get activeProtocol;
  Stream<BleConnectionState> get connectionStateStream;
  Stream<BleStatusPacket> get statusStream;
  Stream<Uint8List> get rawStatusStream;

  Future<bool> connect();
  Future<void> disconnect();
  Future<void> sendCommand(Uint8List commandBytes);
  void setProtocol(ScoreboardProtocol protocol);

  Uint8List buildStatusPacket(GameState state);

  void sendStart();
  void sendStop();
  void sendReset30();
  void sendReset20();
  void sendShotClock(int shotTimeMs);
  void sendGameClock(int gameTimeMs);
  void sendHorn(int durationMs);
  void sendScores(int white, int dark, int period);
  void dispose();
}
