import SwiftUI

struct PoloPadView: View {
    @StateObject private var ble = BluetoothManager()
    @StateObject private var game: WaterPoloGameModel

    @State private var showingExclusionSheet: Bool = false
    @State private var exclusionTargetIsWhite: Bool = true
    @State private var showingTimeEditSheet: Bool = false
    @State private var tempGameMinutes: String = "8"
    @State private var tempGameSeconds: String = "00"

    init() {
        let ble = BluetoothManager()
        _ble = StateObject(wrappedValue: ble)
        _game = StateObject(wrappedValue: WaterPoloGameModel(bleManager: ble))
    }

    var body: some View {
        ZStack {
            Color(red: 0.08, green: 0.09, blue: 0.12).ignoresSafeArea()

            VStack(spacing: 16) {
                // MARK: - TOP BAR: Header & Connection
                topBar

                // MARK: - MAIN CLOCK SECTION (Master Game & Shot Clocks)
                mainClocksSection

                // MARK: - GIANT SHOT CLOCK CONTROL BUTTONS (30s & 20s)
                giantShotButtons

                // MARK: - SECONDARY CONTROLS (Undo, Adjust, Horn)
                quickControlBar

                // MARK: - BOTTOM TEAMS & EXCLUSIONS SECTION
                teamsSection
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)
        }
        .sheet(isPresented: $showingExclusionSheet) {
            exclusionInputSheet
        }
    }

    // MARK: - Top Bar
    private var topBar: some View {
        HStack {
            // Period / Quarter Selector
            HStack(spacing: 8) {
                ForEach([1, 2, 3, 4], id: \.self) { q in
                    Button(action: { game.setPeriod(q) }) {
                        Text("Q\(q)")
                            .font(.system(size: 20, weight: .bold))
                            .frame(width: 54, height: 44)
                            .background(game.period == q ? Color.blue : Color.white.opacity(0.1))
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                }
                Button(action: { game.setPeriod(5) }) {
                    Text("OT")
                        .font(.system(size: 18, weight: .bold))
                        .frame(width: 54, height: 44)
                        .background(game.period == 5 ? Color.orange : Color.white.opacity(0.1))
                        .foregroundColor(.white)
                        .cornerRadius(10)
                }
            }

            Spacer()

            // Bluetooth Connection Status Badge
            HStack(spacing: 8) {
                Circle()
                    .fill(ble.isConnected ? Color.green : Color.red)
                    .frame(width: 12, height: 12)
                Text(ble.isConnected ? "PoloBridge Connected" : "Searching for Dongle...")
                    .font(.system(size: 15, weight: .medium, design: .monospaced))
                    .foregroundColor(ble.isConnected ? .green : .gray)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color.black.opacity(0.4))
            .cornerRadius(20)
        }
    }

    // MARK: - Main Clock Section
    private var mainClocksSection: some View {
        HStack(spacing: 24) {
            // Game Clock Display & Master Toggle
            VStack(alignment: .leading, spacing: 4) {
                Text("GAME CLOCK")
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .foregroundColor(.gray)

                HStack(spacing: 16) {
                    Text(game.formattedGameTime)
                        .font(.system(size: 72, weight: .black, design: .monospaced))
                        .foregroundColor(.white)

                    Button(action: { game.toggleStartStop() }) {
                        HStack {
                            Image(systemName: game.isRunning ? "pause.fill" : "play.fill")
                            Text(game.isRunning ? "STOP" : "START")
                        }
                        .font(.system(size: 28, weight: .heavy))
                        .frame(width: 170, height: 74)
                        .background(game.isRunning ? Color.red : Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(14)
                        .shadow(color: (game.isRunning ? Color.red : Color.green).opacity(0.4), radius: 10)
                    }
                }
            }
            .padding(16)
            .background(Color.white.opacity(0.05))
            .cornerRadius(18)

            Spacer()

            // Shot Clock Readout Display
            VStack(alignment: .trailing, spacing: 4) {
                Text("SHOT CLOCK")
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .foregroundColor(.yellow.opacity(0.8))

                Text(game.formattedShotTime)
                    .font(.system(size: 88, weight: .black, design: .monospaced))
                    .foregroundColor(game.shotTimeMs <= 5000 ? .red : .yellow)
                    .frame(minWidth: 150, alignment: .trailing)
            }
            .padding(16)
            .background(Color.yellow.opacity(0.08))
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(game.shotTimeMs <= 5000 ? Color.red : Color.yellow.opacity(0.3), lineWidth: 2)
            )
            .cornerRadius(18)
        }
    }

    // MARK: - Giant Shot Clock Buttons
    private var giantShotButtons: some View {
        HStack(spacing: 20) {
            // RESET 30 BUTTON
            Button(action: {
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                game.reset30()
            }) {
                VStack(spacing: 6) {
                    Text("30")
                        .font(.system(size: 58, weight: .black, design: .rounded))
                    Text("FULL RESET (Turnover)")
                        .font(.system(size: 16, weight: .bold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 120)
                .background(Color.green.opacity(0.85))
                .foregroundColor(.white)
                .cornerRadius(18)
                .shadow(color: Color.green.opacity(0.3), radius: 8)
            }

            // RESET 20 BUTTON
            Button(action: {
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                game.reset20()
            }) {
                VStack(spacing: 6) {
                    Text("20")
                        .font(.system(size: 58, weight: .black, design: .rounded))
                    Text("REBOUND / EXCLUSION")
                        .font(.system(size: 16, weight: .bold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 120)
                .background(Color.orange)
                .foregroundColor(.white)
                .cornerRadius(18)
                .shadow(color: Color.orange.opacity(0.3), radius: 8)
            }
        }
    }

    // MARK: - Quick Control Bar
    private var quickControlBar: some View {
        HStack(spacing: 12) {
            // Undo Button (Crucial lifesaver)
            Button(action: { game.undoLastReset() }) {
                Label("UNDO RESET", systemImage: "arrow.uturn.backward.circle.fill")
                    .font(.system(size: 16, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Color.purple.opacity(0.7))
                    .foregroundColor(.white)
                    .cornerRadius(10)
            }

            // -1 Sec
            Button(action: { game.adjustShotClock(bySeconds: -1) }) {
                Text("-1s Shot")
                    .font(.system(size: 16, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Color.white.opacity(0.12))
                    .foregroundColor(.white)
                    .cornerRadius(10)
            }

            // +1 Sec
            Button(action: { game.adjustShotClock(bySeconds: 1) }) {
                Text("+1s Shot")
                    .font(.system(size: 16, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Color.white.opacity(0.12))
                    .foregroundColor(.white)
                    .cornerRadius(10)
            }

            // Manual Horn Buzzer
            Button(action: {
                UINotificationFeedbackGenerator().notificationOccurred(.warning)
                game.triggerManualHorn()
            }) {
                Label("HORN", systemImage: "speaker.wave.3.fill")
                    .font(.system(size: 16, weight: .black))
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Color.red.opacity(0.8))
                    .foregroundColor(.white)
                    .cornerRadius(10)
            }
        }
    }

    // MARK: - Teams, Scores & Exclusions
    private var teamsSection: some View {
        HStack(spacing: 20) {
            // WHITE TEAM CARD
            teamCard(
                teamName: "WHITE TEAM",
                score: game.scoreWhite,
                isWhite: true,
                onAddScore: { game.updateScore(isWhite: true, delta: 1) },
                onMinusScore: { game.updateScore(isWhite: true, delta: -1) }
            )

            // DARK / BLUE TEAM CARD
            teamCard(
                teamName: "DARK TEAM",
                score: game.scoreDark,
                isWhite: false,
                onAddScore: { game.updateScore(isWhite: false, delta: 1) },
                onMinusScore: { game.updateScore(isWhite: false, delta: -1) }
            )
        }
    }

    private func teamCard(
        teamName: String,
        score: Int,
        isWhite: Bool,
        onAddScore: @escaping () -> Void,
        onMinusScore: @escaping () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(teamName)
                    .font(.system(size: 18, weight: .black))
                    .foregroundColor(isWhite ? .white : Color(red: 0.3, green: 0.6, blue: 1.0))

                Spacer()

                // Score Controls
                HStack(spacing: 12) {
                    Button(action: onMinusScore) {
                        Image(systemName: "minus.circle.fill")
                            .font(.system(size: 28))
                            .foregroundColor(.gray)
                    }
                    Text("\(score)")
                        .font(.system(size: 38, weight: .black, design: .monospaced))
                        .foregroundColor(.white)
                        .frame(minWidth: 44)
                    Button(action: onAddScore) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 28))
                            .foregroundColor(.green)
                    }
                }
            }

            Divider().background(Color.white.opacity(0.1))

            // Exclusion Tracker Header
            HStack {
                Text("20s EXCLUSIONS")
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundColor(.gray)
                Spacer()
                Button(action: {
                    exclusionTargetIsWhite = isWhite
                    showingExclusionSheet = true
                }) {
                    Label("Add Ejection", systemImage: "plus")
                        .font(.system(size: 13, weight: .bold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.red.opacity(0.3))
                        .foregroundColor(.red)
                        .cornerRadius(6)
                }
            }

            // Active Exclusions Chips
            let exclusions = game.activeExclusions.filter { $0.isWhiteTeam == isWhite }
            if exclusions.isEmpty {
                Text("No active ejections")
                    .font(.system(size: 14))
                    .foregroundColor(.white.opacity(0.3))
                    .padding(.vertical, 4)
            } else {
                HStack(spacing: 8) {
                    ForEach(exclusions) { ex in
                        HStack(spacing: 6) {
                            Text("Cap #\(ex.capNumber):")
                                .fontWeight(.bold)
                            Text("\(ex.remainingSeconds)s")
                                .font(.system(.body, design: .monospaced))
                                .fontWeight(.black)
                                .foregroundColor(ex.remainingSeconds <= 5 ? .orange : .white)
                            Button(action: { game.removeExclusion(id: ex.id) }) {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.system(size: 14))
                            }
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(ex.remainingSeconds == 0 ? Color.green.opacity(0.4) : Color.red.opacity(0.2))
                        .cornerRadius(8)
                    }
                }
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.04))
        .cornerRadius(16)
    }

    // MARK: - Exclusion Cap Picker Sheet
    private var exclusionInputSheet: some View {
        VStack(spacing: 20) {
            Text("Add 20s Exclusion (\(exclusionTargetIsWhite ? "White" : "Dark") Team)")
                .font(.title2.bold())
                .padding(.top, 20)

            Text("Select Excluded Player Cap Number:")
                .foregroundColor(.gray)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 5), spacing: 12) {
                ForEach(1...20, id: \.self) { cap in
                    Button(action: {
                        game.addExclusion(capNumber: cap, isWhite: exclusionTargetIsWhite)
                        showingExclusionSheet = false
                    }) {
                        Text("\(cap)")
                            .font(.system(size: 22, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.blue.opacity(0.2))
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                }
            }
            .padding(.horizontal, 24)

            Spacer()
        }
        .presentationDetents([.fraction(0.55)])
    }
}
