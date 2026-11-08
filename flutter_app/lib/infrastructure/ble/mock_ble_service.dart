import 'dart:async';
import 'dart:typed_data';
import '../../domain/models/game_state.dart';
import 'ble_dongle_service.dart';
import 'ble_packet_codec.dart';

/// Deterministic, zero-hardware software simulator of the ESP32-S3 BLE Scoreboard Dongle.
/// Emulates 10Hz status notifications, Command Characteristic writes, and Protocol switching.
class MockBleService implements BleDongleService {
  BleConnectionState _state = BleConnectionState.disconnected;
  ScoreboardProtocol _protocol = ScoreboardProtocol.cts;
  final StreamController<BleConnectionState> _connectionController =
      StreamController<BleConnectionState>.broadcast();
  final StreamController<BleStatusPacket> _statusController =
      StreamController<BleStatusPacket>.broadcast();
  final StreamController<Uint8List> _rawStatusController =
      StreamController<Uint8List>.broadcast();

  Timer? _ticker;
  final List<Uint8List> _commandHistory = [];

  // Internal mock dongle state
  bool _isRunning = false;
  bool _hornActive = false;
  int _gameTimeMs = 8 * 60 * 1000;
  int _shotTimeMs = 30 * 1000;
  int _scoreWhite = 0;
  int _scoreDark = 0;
  int _period = 1;

  MockBleService({bool autoConnect = false}) {
    if (autoConnect) {
      connect();
    }
  }

  @override
  String get serviceUuid => BleDongleService.serviceUuidStr;

  @override
  String get commandUuid => BleDongleService.commandCharUuidStr;

  @override
  String get statusUuid => BleDongleService.statusCharUuidStr;

  @override
  BleConnectionState get connectionState => _state;

  @override
  ScoreboardProtocol get activeProtocol => _protocol;

  @override
  Stream<BleConnectionState> get connectionStateStream =>
      _connectionController.stream;

  @override
  Stream<BleStatusPacket> get statusStream => _statusController.stream;

  @override
  Stream<Uint8List> get rawStatusStream => _rawStatusController.stream;

  List<Uint8List> get sentCommands => List.unmodifiable(_commandHistory);

  void clearSentCommands() => _commandHistory.clear();

  // State inspection getters for testing
  bool get isRunning => _isRunning;
  bool get isHornActive => _hornActive;
  int get gameTimeMs => _gameTimeMs;
  int get shotTimeMs => _shotTimeMs;
  int get scoreWhite => _scoreWhite;
  int get scoreDark => _scoreDark;
  int get period => _period;

  @override
  Future<bool> connect() async {
    _state = BleConnectionState.connecting;
    _connectionController.add(_state);

    // Simulate instant connection in test / mock environment
    _state = BleConnectionState.connected;
    _connectionController.add(_state);
    _startTicker();
    return true;
  }

  @override
  Future<void> disconnect() async {
    _ticker?.cancel();
    _ticker = null;
    _state = BleConnectionState.disconnected;
    _connectionController.add(_state);
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(milliseconds: 100), (_) {
      if (_state != BleConnectionState.connected) return;

      if (_isRunning) {
        if (_gameTimeMs <= 100) {
          _gameTimeMs = 0;
          _isRunning = false;
        } else {
          _gameTimeMs -= 100;
        }

        if (_shotTimeMs <= 100) {
          _shotTimeMs = 30 * 1000;
        } else {
          _shotTimeMs -= 100;
        }
      }

      emitCurrentStatus();
    });
  }

  void emitCurrentStatus() {
    final isBlanked = _gameTimeMs <= _shotTimeMs;
    final pkt = BleStatusPacket(
      isRunning: _isRunning,
      hornActive: _hornActive,
      isBlanked: isBlanked,
      gameTimeMs: _gameTimeMs,
      shotTimeMs: _shotTimeMs,
      scoreWhite: _scoreWhite,
      scoreDark: _scoreDark,
      period: _period,
      protocol: _protocol,
    );
    _statusController.add(pkt);
    _rawStatusController.add(BlePacketCodec.encodeStatus(pkt));
  }

  @override
  Uint8List buildStatusPacket(GameState state) {
    return BlePacketCodec.buildStatusPacket(state, _protocol);
  }

  @override
  Future<void> sendCommand(Uint8List commandBytes) async {
    _commandHistory.add(commandBytes);
    if (commandBytes.isEmpty) return;

    final opcode = commandBytes[0];
    switch (opcode) {
      case 0x01: // STOP
        _isRunning = false;
        break;
      case 0x02: // START
        _isRunning = true;
        break;
      case 0x03: // RESET 30
        _shotTimeMs = 30 * 1000;
        break;
      case 0x04: // RESET 20
        _shotTimeMs = 20 * 1000;
        break;
      case 0x05: // SET SHOT CLOCK
        if (commandBytes.length >= 3) {
          final sec = commandBytes[1];
          final tenths = commandBytes[2];
          _shotTimeMs = sec * 1000 + tenths * 100;
        }
        break;
      case 0x06: // SET GAME CLOCK
        if (commandBytes.length >= 4) {
          final min = commandBytes[1];
          final sec = commandBytes[2];
          final tenths = commandBytes[3];
          _gameTimeMs = min * 60000 + sec * 1000 + tenths * 100;
        }
        break;
      case 0x07: // HORN
        _hornActive = true;
        emitCurrentStatus();
        Timer(const Duration(milliseconds: 300), () {
          _hornActive = false;
          emitCurrentStatus();
        });
        break;
      case 0x08: // SET SCORES & PERIOD
        if (commandBytes.length >= 4) {
          _scoreWhite = commandBytes[1];
          _scoreDark = commandBytes[2];
          _period = commandBytes[3];
        }
        break;
      case 0x09: // PULSE PICKLE
        // Auxiliary trigger
        break;
      case 0x0B: // PROTOCOL SWITCH
        if (commandBytes.length >= 2) {
          _protocol = commandBytes[1] == 1
              ? ScoreboardProtocol.daktronics
              : ScoreboardProtocol.cts;
        }
        break;
    }
    emitCurrentStatus();
  }

  @override
  void setProtocol(ScoreboardProtocol protocol) {
    _protocol = protocol;
    sendCommand(BlePacketCodec.encodeSetProtocol(protocol));
  }

  @override
  void sendStart() => sendCommand(BlePacketCodec.encodeStart());

  @override
  void sendStop() => sendCommand(BlePacketCodec.encodeStop());

  @override
  void sendReset30() => sendCommand(BlePacketCodec.encodeReset30());

  @override
  void sendReset20() => sendCommand(BlePacketCodec.encodeReset20());

  @override
  void sendShotClock(int shotTimeMs) =>
      sendCommand(BlePacketCodec.encodeSetShotClock(shotTimeMs));

  @override
  void sendGameClock(int gameTimeMs) =>
      sendCommand(BlePacketCodec.encodeSetGameClock(gameTimeMs));

  @override
  void sendHorn(int durationMs) =>
      sendCommand(BlePacketCodec.encodeTriggerHorn(durationMs));

  @override
  void sendScores(int white, int dark, int period) =>
      sendCommand(BlePacketCodec.encodeSetScores(white, dark, period));

  /// Injects an arbitrary simulated status packet from an external source or test.
  void simulateInboundPacket(Uint8List packet) {
    final decoded = BlePacketCodec.decodeStatus(packet);
    _isRunning = decoded.isRunning;
    _hornActive = decoded.hornActive;
    _gameTimeMs = decoded.gameTimeMs;
    _shotTimeMs = decoded.shotTimeMs;
    _scoreWhite = decoded.scoreWhite;
    _scoreDark = decoded.scoreDark;
    _period = decoded.period;
    _protocol = decoded.protocol;
    _statusController.add(decoded);
    _rawStatusController.add(packet);
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _connectionController.close();
    _statusController.close();
    _rawStatusController.close();
  }
}
