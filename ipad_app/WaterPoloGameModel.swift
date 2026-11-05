import Foundation
import Combine
import SwiftUI

/// Represents an active 20-second exclusion / ejection for a specific player
struct Exclusion: Identifiable, Equatable {
    let id = UUID()
    let capNumber: Int
    let isWhiteTeam: Bool
    var remainingSeconds: Int = 20
}

/// Snapshot of the game state for instant "Undo" recovery
struct StateSnapshot {
    let shotTimeMs: UInt32
    let gameTimeMs: UInt32
    let isRunning: Bool
}

class WaterPoloGameModel: ObservableObject {
    @Published var isRunning: Bool = false
    @Published var gameTimeMs: UInt32 = 8 * 60 * 1000 // 8 minutes default
    @Published var shotTimeMs: UInt32 = 30 * 1000     // 30 seconds default
    @Published var scoreWhite: Int = 0
    @Published var scoreDark: Int = 0
    @Published var period: Int = 1
    @Published var activeExclusions: [Exclusion] = []
    @Published var timeoutsRemainingWhite: Int = 3
    @Published var timeoutsRemainingDark: Int = 3

    // History stack for instant Undo
    private var undoStack: [StateSnapshot] = []

    private var cancellables = Set<AnyCancellable>()
    private var bleManager: BluetoothManager?
    private var localTimer: Timer?

    init(bleManager: BluetoothManager? = nil) {
        self.bleManager = bleManager
        setupBleSync()
        startLocalTick()
    }

    private func setupBleSync() {
        guard let ble = bleManager else { return }

        // Sync local view with live Dongle reports when connected
        ble.$hardwareShotMs
            .receive(on: RunLoop.main)
            .sink { [weak self] ms in
                guard let self = self, self.bleManager?.isConnected == true else { return }
                self.shotTimeMs = ms
            }
            .store(in: &cancellables)

        ble.$hardwareGameMs
            .receive(on: RunLoop.main)
            .sink { [weak self] ms in
                guard let self = self, self.bleManager?.isConnected == true else { return }
                self.gameTimeMs = ms
            }
            .store(in: &cancellables)

        ble.$hardwareIsRunning
            .receive(on: RunLoop.main)
            .sink { [weak self] running in
                guard let self = self, self.bleManager?.isConnected == true else { return }
                self.isRunning = running
            }
            .store(in: &cancellables)
    }

    // Local 100ms clock engine (used when running standalone or as optimistic UI)
    private func startLocalTick() {
        localTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self = self, self.isRunning else { return }

            // If connected to dongle, the dongle is the master; only update local exclusions
            if self.bleManager?.isConnected != true {
                if self.gameTimeMs >= 100 {
                    self.gameTimeMs -= 100
                } else {
                    self.gameTimeMs = 0
                    self.isRunning = false
                }

                if self.shotTimeMs >= 100 {
                    self.shotTimeMs -= 100
                } else {
                    self.shotTimeMs = 30 * 1000
                }
            }

            // Decrement active player exclusion timers (100ms ticks)
            for i in 0..<self.activeExclusions.count {
                if self.activeExclusions[i].remainingSeconds > 0 {
                    // Update approximately once per second
                    if self.gameTimeMs % 1000 < 100 {
                        self.activeExclusions[i].remainingSeconds -= 1
                    }
                }
            }
        }
    }

    // MARK: - Core Water Polo Actions

    func toggleStartStop() {
        saveSnapshot()
        isRunning.toggle()
        if isRunning {
            bleManager?.sendStart()
        } else {
            bleManager?.sendStop()
        }
    }

    /// Reset to 30 Seconds (Defensive turnover, full change of possession)
    func reset30() {
        saveSnapshot()
        shotTimeMs = 30 * 1000
        bleManager?.sendReset30()
    }

    /// Reset to 20 Seconds (World Aquatics / USAWP rule: offensive rebound, exclusion, corner throw)
    func reset20() {
        saveSnapshot()
        shotTimeMs = 20 * 1000
        bleManager?.sendReset20()
    }

    /// Lifesaver feature: Undo accidental shot clock reset
    func undoLastReset() {
        guard let last = undoStack.popLast() else { return }
        shotTimeMs = last.shotTimeMs
        gameTimeMs = last.gameTimeMs
        isRunning = last.isRunning

        let sec = UInt8(shotTimeMs / 1000)
        let tenths = UInt8((shotTimeMs % 1000) / 100)
        bleManager?.sendSetShotClock(seconds: sec, tenths: tenths)
    }

    func adjustShotClock(bySeconds delta: Int) {
        saveSnapshot()
        let currentSec = Int(shotTimeMs / 1000)
        let newSec = max(0, min(35, currentSec + delta))
        shotTimeMs = UInt32(newSec * 1000)
        bleManager?.sendSetShotClock(seconds: UInt8(newSec), tenths: 0)
    }

    func adjustGameClock(bySeconds delta: Int) {
        saveSnapshot()
        let currentTotalSec = Int(gameTimeMs / 1000)
        let newTotalSec = max(0, currentTotalSec + delta)
        gameTimeMs = UInt32(newTotalSec * 1000)

        let min = UInt8(newTotalSec / 60)
        let sec = UInt8(newTotalSec % 60)
        bleManager?.sendSetGameClock(minutes: min, seconds: sec, tenths: 0)
    }

    func triggerManualHorn() {
        bleManager?.sendTriggerHorn(durationMs: 1200)
    }

    // MARK: - Exclusions & Ejections

    func addExclusion(capNumber: Int, isWhite: Bool) {
        let exclusion = Exclusion(capNumber: capNumber, isWhiteTeam: isWhite, remainingSeconds: 20)
        activeExclusions.append(exclusion)
        // Water Polo Rule: Ejection automatically resets shot clock to 20s
        reset20()
    }

    func removeExclusion(id: UUID) {
        activeExclusions.removeAll { $0.id == id }
    }

    // MARK: - Scores & Period

    func updateScore(isWhite: Bool, delta: Int) {
        if isWhite {
            scoreWhite = max(0, scoreWhite + delta)
        } else {
            scoreDark = max(0, scoreDark + delta)
        }
        bleManager?.sendSetScores(white: UInt8(scoreWhite), dark: UInt8(scoreDark), period: UInt8(period))
    }

    func setPeriod(_ newPeriod: Int) {
        period = newPeriod
        gameTimeMs = 8 * 60 * 1000 // Reset to 8:00 for new quarter
        shotTimeMs = 30 * 1000
        isRunning = false
        bleManager?.sendStop()
        bleManager?.sendSetScores(white: UInt8(scoreWhite), dark: UInt8(scoreDark), period: UInt8(period))
    }

    private func saveSnapshot() {
        undoStack.append(StateSnapshot(shotTimeMs: shotTimeMs, gameTimeMs: gameTimeMs, isRunning: isRunning))
        if undoStack.count > 10 {
            undoStack.removeFirst()
        }
    }

    // Helper formatting
    var formattedGameTime: String {
        let min = gameTimeMs / 60000
        let sec = (gameTimeMs % 60000) / 1000
        let tenths = (gameTimeMs % 1000) / 100
        if min > 0 {
            return String(format: "%02d:%02d", min, sec)
        } else {
            return String(format: "%02d.%01d", sec, tenths)
        }
    }

    var formattedShotTime: String {
        let sec = shotTimeMs / 1000
        let tenths = (shotTimeMs % 1000) / 100
        if sec >= 10 {
            return "\(sec)"
        } else {
            return "\(sec).\(tenths)"
        }
    }
}
