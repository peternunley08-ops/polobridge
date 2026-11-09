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

struct StateSnapshot {
    let shotTimeMs: UInt32
    let gameTimeMs: UInt32
    let isRunning: Bool
    let scoreWhite: Int
    let scoreDark: Int
    let activeExclusions: [Exclusion]
}

enum ScoreboardProtocol: UInt8 {
    case coloradoTimeSystems = 0
    case daktronicsAllSport = 1
}

class WaterPoloGameModel: ObservableObject {
    @Published var isRunning: Bool = false
    @Published var gameTimeMs: UInt32 = 8 * 60 * 1000 // 8 minutes default
    @Published var shotTimeMs: UInt32 = 30 * 1000     // 30 seconds default
    @Published var scoreWhite: Int = 0
    @Published var scoreDark: Int = 0
    @Published var period: Int = 1 // 1-4 = Q1-Q4, 5 = OT1, 6 = OT2, 7 = PSO
    @Published var activeExclusions: [Exclusion] = []

    // Ruleset Toggle: true = NCAA / World Aquatics (20s/30s), false = NFHS High School (30s only)
    @Published var enable20sReset: Bool = true

    // Rule WP 22.3: Personal Foul Tracking (3 fouls = Capped Out / Rolled)
    @Published var personalFoulsWhite: [Int: Int] = [:]
    @Published var personalFoulsDark: [Int: Int] = [:]

    // Team Timeouts Engine (3 Full 60s + 1 Short 30s)
    @Published var fullTimeoutsWhite: Int = 3
    @Published var shortTimeoutsWhite: Int = 1
    @Published var fullTimeoutsDark: Int = 3
    @Published var shortTimeoutsDark: Int = 1
    @Published var activeTimeoutRemainingMs: UInt32 = 0
    @Published var activeTimeoutIsWhite: Bool = true

    @Published var currentProtocol: ScoreboardProtocol = .coloradoTimeSystems

    // Rule WP 20.15: Computed blanking state when game time <= shot time
    var isShotClockBlanked: Bool {
        return gameTimeMs <= shotTimeMs
    }

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

    private func startLocalTick() {
        localTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self = self else { return }

            // Timeout countdown tick (with 15s remaining warning horn)
            if self.activeTimeoutRemainingMs >= 100 {
                self.activeTimeoutRemainingMs -= 100
                if self.activeTimeoutRemainingMs == 15000 {
                    self.bleManager?.sendTriggerHorn(durationMs: 600)
                } else if self.activeTimeoutRemainingMs == 0 {
                    self.bleManager?.sendTriggerHorn(durationMs: 1400)
                }
            }

            guard self.isRunning else { return }

            if self.bleManager?.isConnected != true {
                if self.gameTimeMs >= 100 {
                    self.gameTimeMs -= 100
                } else {
                    self.gameTimeMs = 0
                    self.isRunning = false
                    self.bleManager?.sendTriggerHorn(durationMs: 2000)
                }

                if self.shotTimeMs >= 100 {
                    self.shotTimeMs -= 100
                } else {
                    if self.gameTimeMs > 1000 {
                        self.bleManager?.sendTriggerHorn(durationMs: 1200)
                    }
                    self.shotTimeMs = 30 * 1000
                }
            }

            // Decrement active exclusions and remove expired penalties
            for i in self.activeExclusions.indices.reversed() {
                if self.activeExclusions[i].remainingSeconds > 0 {
                    if self.gameTimeMs % 1000 < 100 {
                        self.activeExclusions[i].remainingSeconds -= 1
                    }
                } else {
                    self.activeExclusions.remove(at: i)
                }
            }
        }
    }

    // MARK: - Core Water Polo Actions

    func toggleStartStop() {
        saveSnapshot()
        activeTimeoutRemainingMs = 0
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

    func undoLastReset() {
        guard let last = undoStack.popLast() else { return }
        shotTimeMs = last.shotTimeMs
        gameTimeMs = last.gameTimeMs
        isRunning = last.isRunning
        scoreWhite = last.scoreWhite
        scoreDark = last.scoreDark
        activeExclusions = last.activeExclusions

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

    // MARK: - Team Timeouts (60s Full / 30s Short)

    func callTimeout(isWhite: Bool, durationSeconds: Int) {
        saveSnapshot()
        isRunning = false
        bleManager?.sendStop()
        bleManager?.sendTriggerHorn(durationMs: 800)

        if isWhite {
            if durationSeconds == 60 && fullTimeoutsWhite > 0 {
                fullTimeoutsWhite -= 1
            } else if durationSeconds == 30 && shortTimeoutsWhite > 0 {
                shortTimeoutsWhite -= 1
            }
        } else {
            if durationSeconds == 60 && fullTimeoutsDark > 0 {
                fullTimeoutsDark -= 1
            } else if durationSeconds == 30 && shortTimeoutsDark > 0 {
                shortTimeoutsDark -= 1
            }
        }

        activeTimeoutIsWhite = isWhite
        activeTimeoutRemainingMs = UInt32(durationSeconds * 1000)
    }

    func endTimeout() {
        activeTimeoutRemainingMs = 0
    }

    // MARK: - Official Rule WP 21 & WP 22.3: Exclusions, Cap-Out & Early Releases

    func foulCount(forCap capNumber: Int, isWhite: Bool) -> Int {
        return isWhite ? (personalFoulsWhite[capNumber] ?? 0) : (personalFoulsDark[capNumber] ?? 0)
    }

    func isPlayerCappedOut(capNumber: Int, isWhite: Bool) -> Bool {
        return foulCount(forCap: capNumber, isWhite: isWhite) >= 3
    }

    func addExclusion(capNumber: Int, isWhite: Bool) {
        guard !isPlayerCappedOut(capNumber: capNumber, isWhite: isWhite) else { return }
        saveSnapshot()
        let exclusion = Exclusion(capNumber: capNumber, isWhiteTeam: isWhite, remainingSeconds: 20)
        activeExclusions.append(exclusion)

        if isWhite {
            personalFoulsWhite[capNumber, default: 0] += 1
        } else {
            personalFoulsDark[capNumber, default: 0] += 1
        }

        if enable20sReset {
            shotTimeMs = 20 * 1000
            bleManager?.sendReset20()
        } else {
            shotTimeMs = 30 * 1000
            bleManager?.sendReset30()
        }
    }

    /// Official Rule WP 21: Early Release when a goal is scored or ball possession is regained
    func earlyReleaseExclusion(id: UUID) {
        saveSnapshot()
        activeExclusions.removeAll { $0.id == id }
    }

    func releaseAllExclusionsForTeam(isWhite: Bool) {
        activeExclusions.removeAll { $0.isWhiteTeam == isWhite }
    }

    // MARK: - Scores & Automatic Goal Rules

    func updateScore(isWhite: Bool, delta: Int) {
        saveSnapshot()
        if isWhite {
            scoreWhite = max(0, scoreWhite + delta)
            if delta > 0 {
                // Rule WP 21: Goal scored releases defending team's excluded players
                releaseAllExclusionsForTeam(isWhite: false)
                shotTimeMs = 30 * 1000
                bleManager?.sendReset30()
            }
        } else {
            scoreDark = max(0, scoreDark + delta)
            if delta > 0 {
                releaseAllExclusionsForTeam(isWhite: true)
                shotTimeMs = 30 * 1000
                bleManager?.sendReset30()
            }
        }
        bleManager?.sendSetScores(white: UInt8(scoreWhite), dark: UInt8(scoreDark), period: UInt8(period))
    }

    func setPeriod(_ newPeriod: Int) {
        saveSnapshot()
        period = newPeriod
        // Periods 1-4 are 8:00 quarters; Periods 5-6 (OT1/OT2) are 3:00 overtime periods
        gameTimeMs = (newPeriod >= 5) ? (3 * 60 * 1000) : (8 * 60 * 1000)
        shotTimeMs = 30 * 1000
        isRunning = false
        activeExclusions.removeAll()
        bleManager?.sendStop()
        bleManager?.sendSetScores(white: UInt8(scoreWhite), dark: UInt8(scoreDark), period: UInt8(period))
    }

    func setProtocol(_ mode: ScoreboardProtocol) {
        currentProtocol = mode
        bleManager?.sendPulsePickle(durationMs: mode.rawValue)
    }

    private func saveSnapshot() {
        undoStack.append(
            StateSnapshot(
                shotTimeMs: shotTimeMs,
                gameTimeMs: gameTimeMs,
                isRunning: isRunning,
                scoreWhite: scoreWhite,
                scoreDark: scoreDark,
                activeExclusions: activeExclusions
            )
        )
        if undoStack.count > 15 {
            undoStack.removeFirst()
        }
    }

    var formattedGameTime: String {
        let min = gameTimeMs / 60000
        let sec = (gameTimeMs % 60000) / 1000
        let tenths = (gameTimeMs % 1000) / 100
        if min > 0 {
            return String(format: "%02d:%02d.%01d", min, sec, tenths)
        } else {
            return String(format: "00:%02d.%01d", sec, tenths)
        }
    }

    var formattedShotTime: String {
        if isShotClockBlanked {
            return "--" // Rule WP 20.15 Blanking representation
        }
        let sec = shotTimeMs / 1000
        let tenths = (shotTimeMs % 1000) / 100
        if sec >= 10 {
            return "\(sec)"
        } else {
            return "\(sec).\(tenths)"
        }
    }
}
