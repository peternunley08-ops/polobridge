import Foundation
import CoreBluetooth
import Combine

/// Manages Bluetooth Low Energy communication with the PoloBridge ESP32 Dongle
class BluetoothManager: NSObject, ObservableObject {
    @Published var isConnected: Bool = false
    @Published var connectionStatus: String = "Disconnected"
    @Published var peripheralName: String = ""

    // Observable Hardware State streamed from PoloBridge
    @Published var hardwareIsRunning: Bool = false
    @Published var hardwareGameMs: UInt32 = 480000 // 8:00
    @Published var hardwareShotMs: UInt32 = 30000  // 30.0s
    @Published var hardwareHornActive: Bool = false

    private var centralManager: CBCentralManager!
    private var poloPeripheral: CBPeripheral?
    private var commandCharacteristic: CBCharacteristic?
    private var statusCharacteristic: CBCharacteristic?

    // UUIDs matching PoloBridge ESP32 Firmware
    private let serviceUUID        = CBUUID(string: "4FA10001-B5A3-F393-E0A9-E50E24DCCA9E")
    private let commandCharUUID    = CBUUID(string: "4FA10002-B5A3-F393-E0A9-E50E24DCCA9E")
    private let statusCharUUID     = CBUUID(string: "4FA10003-B5A3-F393-E0A9-E50E24DCCA9E")

    override init() {
        super.init()
        centralManager = CBCentralManager(delegate: self, queue: .main)
    }

    func startScan() {
        guard centralManager.state == .poweredOn else { return }
        connectionStatus = "Scanning for PoloBridge..."
        centralManager.scanForPeripherals(withServices: [serviceUUID], options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
    }

    func disconnect() {
        if let peripheral = poloPeripheral {
            centralManager.cancelPeripheralConnection(peripheral)
        }
    }

    // MARK: - Outgoing Commands to Dongle

    func sendStart() {
        sendCommand(bytes: [0x02])
    }

    func sendStop() {
        sendCommand(bytes: [0x01])
    }

    func sendReset30() {
        sendCommand(bytes: [0x03])
    }

    func sendReset20() {
        sendCommand(bytes: [0x04])
    }

    func sendSetShotClock(seconds: UInt8, tenths: UInt8) {
        sendCommand(bytes: [0x05, seconds, tenths])
    }

    func sendSetGameClock(minutes: UInt8, seconds: UInt8, tenths: UInt8) {
        sendCommand(bytes: [0x06, minutes, seconds, tenths])
    }

    func sendTriggerHorn(durationMs: UInt16 = 1200) {
        let hi = UInt8((durationMs >> 8) & 0xFF)
        let lo = UInt8(durationMs & 0xFF)
        sendCommand(bytes: [0x07, hi, lo])
    }

    func sendSetScores(white: UInt8, dark: UInt8, period: UInt8) {
        sendCommand(bytes: [0x08, white, dark, period])
    }

    func sendPulsePickle(durationMs: UInt8 = 150) {
        sendCommand(bytes: [0x09, durationMs])
    }

    private func sendCommand(bytes: [UInt8]) {
        guard let peripheral = poloPeripheral,
              let characteristic = commandCharacteristic else {
            return
        }
        let data = Data(bytes)
        peripheral.writeValue(data, for: characteristic, type: .withoutResponse)
    }
}

// MARK: - CBCentralManagerDelegate
extension BluetoothManager: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            startScan()
        case .poweredOff:
            connectionStatus = "Bluetooth Powered Off"
            isConnected = false
        case .unauthorized:
            connectionStatus = "Bluetooth Unauthorized"
            isConnected = false
        case .unsupported:
            connectionStatus = "Bluetooth Unsupported"
            isConnected = false
        default:
            connectionStatus = "Bluetooth Initializing..."
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        connectionStatus = "Discovered \(peripheral.name ?? "PoloBridge"). Connecting..."
        poloPeripheral = peripheral
        poloPeripheral?.delegate = self
        centralManager.stopScan()
        centralManager.connect(peripheral, options: nil)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        isConnected = true
        peripheralName = peripheral.name ?? "PoloBridge"
        connectionStatus = "Connected to \(peripheralName)"
        peripheral.discoverServices([serviceUUID])
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        isConnected = false
        commandCharacteristic = nil
        statusCharacteristic = nil
        connectionStatus = "Disconnected. Reconnecting..."
        startScan()
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        isConnected = false
        connectionStatus = "Connection Failed. Retrying..."
        startScan()
    }
}

// MARK: - CBPeripheralDelegate
extension BluetoothManager: CBPeripheralDelegate {
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let services = peripheral.services else { return }
        for service in services where service.uuid == serviceUUID {
            peripheral.discoverCharacteristics([commandCharUUID, statusCharUUID], for: service)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard let characteristics = service.characteristics else { return }
        for characteristic in characteristics {
            if characteristic.uuid == commandCharUUID {
                commandCharacteristic = characteristic
            } else if characteristic.uuid == statusCharUUID {
                statusCharacteristic = characteristic
                peripheral.setNotifyValue(true, for: characteristic)
            }
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard characteristic.uuid == statusCharUUID,
              let data = characteristic.value,
              data.count >= 12 else { return }

        // Parse 12-byte status notification payload
        let flags = data[0]
        hardwareIsRunning = (flags & 0x01) != 0
        hardwareHornActive = (flags & 0x02) != 0

        hardwareGameMs = (UInt32(data[1]) << 24) | (UInt32(data[2]) << 16) | (UInt32(data[3]) << 8) | UInt32(data[4])
        hardwareShotMs = (UInt32(data[5]) << 24) | (UInt32(data[6]) << 16) | (UInt32(data[7]) << 8) | UInt32(data[8])
    }
}
