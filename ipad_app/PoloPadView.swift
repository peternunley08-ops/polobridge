import SwiftUI

// =============================================================================
// POLOPAD PRO (iOS / iPadOS) - SUNLIT OLYMPIC POOL AQUATIC DESIGN SYSTEM
// Optimized for holding the iPad with two hands on a wet pool deck:
// - FAR LEFT THUMB PILLAR: Massive Full-Height START / STOP Actuator
// - FAR RIGHT THUMB PILLAR: Dynamic NFHS (30s) or NCAA/WA (30s & 20s) Plungers
// - CENTER STAGE: Recessed Sapphire Clocks, Period/OT/PSO Rack, Timeouts & Fouls
// =============================================================================

// MARK: - 3D Mechanical Thumb Actuator Style
struct MechanicalThumbButtonStyle: ButtonStyle {
    var primaryColor: Color
    var shadowColor: Color
    var extrusionHeight: CGFloat = 8
    var haptic: UIImpactFeedbackGenerator.FeedbackStyle = .heavy

    func makeBody(configuration: Configuration) -> some View {
        let isPressed = configuration.isPressed

        configuration.label
            .offset(y: isPressed ? extrusionHeight - 2 : 0)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(shadowColor)
                        .offset(y: extrusionHeight)

                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    primaryColor.opacity(isPressed ? 0.85 : 1.0),
                                    shadowColor
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .offset(y: isPressed ? extrusionHeight - 2 : 0)
                        .overlay(
                            RoundedRectangle(cornerRadius: 24, style: .continuous)
                                .stroke(
                                    LinearGradient(
                                        colors: [Color.white.opacity(0.55), Color.white.opacity(0.1)],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    ),
                                    lineWidth: 1.5
                                )
                                .offset(y: isPressed ? extrusionHeight - 2 : 0)
                        )
                }
            )
            .shadow(
                color: primaryColor.opacity(isPressed ? 0.25 : 0.45),
                radius: isPressed ? 6 : 18,
                y: isPressed ? 4 : 12
            )
            .animation(.spring(response: 0.16, dampingFraction: 0.55), value: isPressed)
            .onChange(of: isPressed) { pressed in
                if pressed {
                    UIImpactFeedbackGenerator(style: haptic).impactOccurred()
                }
            }
    }
}

// MARK: - Sunlit Sapphire Recessed Instrument Bay Modifier
struct RecessedBayModifier: ViewModifier {
    var cornerRadius: CGFloat = 20

    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(red: 0.05, green: 0.22, blue: 0.42),
                                    Color(red: 0.08, green: 0.14, blue: 0.34)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )

                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [Color.cyan.opacity(0.45), Color.white.opacity(0.18)],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            lineWidth: 2
                        )
                }
            )
            .shadow(color: Color.cyan.opacity(0.2), radius: 14, x: 0, y: 6)
    }
}

extension View {
    func recessedBay(cornerRadius: CGFloat = 20) -> some View {
        self.modifier(RecessedBayModifier(cornerRadius: cornerRadius))
    }
}

// MARK: - Main PoloPad View
struct PoloPadView: View {
    @StateObject private var ble = BluetoothManager()
    @StateObject private var game: WaterPoloGameModel

    @State private var showingExclusionSheet: Bool = false
    @State private var exclusionTargetIsWhite: Bool = true

    init() {
        let ble = BluetoothManager()
        _ble = StateObject(wrappedValue: ble)
        _game = StateObject(wrappedValue: WaterPoloGameModel(bleManager: ble))
    }

    var body: some View {
        ZStack {
            // Vibrant Sunlit Olympic Pool Aquatic Gradient (Sky-900 -> Blue-900 -> Indigo-950)
            LinearGradient(
                colors: [
                    Color(red: 0.05, green: 0.29, blue: 0.43),
                    Color(red: 0.12, green: 0.23, blue: 0.54),
                    Color(red: 0.12, green: 0.11, blue: 0.29)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // 3-COLUMN ERGONOMIC HANDHELD LAYOUT
            HStack(spacing: 20) {
                // 1. LEFT THUMB PILLAR (START / STOP)
                leftThumbStartStopPillar
                    .frame(width: 175)

                // 2. CENTER STAGE (INSTRUMENTS & STATS)
                VStack(spacing: 14) {
                    if game.activeTimeoutRemainingMs > 0 {
                        activeTimeoutBanner
                    }
                    centerHeaderBar
                    heroClocksDeck
                    tactileUtilityBar
                    teamInstrumentBays
                }
                .frame(maxWidth: .infinity)

                // 3. RIGHT THUMB PILLAR (RESET 30 & 20)
                rightThumbResetPillar
                    .frame(width: 175)
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 16)
        }
        .statusBar(hidden: true)
        .sheet(isPresented: $showingExclusionSheet) {
            tactileExclusionPicker
        }
    }

    // MARK: - Active Timeout Countdown Banner
    private var activeTimeoutBanner: some View {
        HStack {
            Label(
                "ACTIVE TIMEOUT (\(game.activeTimeoutIsWhite ? "WHITE" : "DARK"))",
                systemImage: "timer"
            )
            .font(.system(size: 12, weight: .black, design: .monospaced))
            .foregroundColor(.yellow)

            Spacer()

            Text(String(format: "%.1fs", Double(game.activeTimeoutRemainingMs) / 1000.0))
                .font(.system(size: 24, weight: .black, design: .monospaced))
                .foregroundColor(.white)

            Button("RESUME") {
                game.endTimeout()
            }
            .font(.system(size: 11, weight: .black, design: .monospaced))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.green)
            .foregroundColor(.black)
            .clipShape(Capsule())
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.orange.opacity(0.28))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.yellow.opacity(0.6), lineWidth: 1.5)
        )
    }

    // MARK: - Left Thumb Grip Pillar: Giant START / STOP
    private var leftThumbStartStopPillar: some View {
        VStack(spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: "hand.raised.fill")
                    .font(.caption2.bold())
                Text("LEFT THUMB")
                    .font(.system(size: 10, weight: .black, design: .monospaced))
                    .tracking(1.2)
            }
            .foregroundColor(Color.cyan.opacity(0.85))

            Button(action: {
                withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                    game.toggleStartStop()
                }
            }) {
                VStack(spacing: 14) {
                    VStack(spacing: 4) {
                        ForEach(0..<3, id: \.self) { _ in
                            Capsule()
                                .fill(Color.white.opacity(0.45))
                                .frame(width: 32, height: 3)
                        }
                    }

                    Spacer()

                    Image(systemName: game.isRunning ? "pause.fill" : "play.fill")
                        .font(.system(size: 58, weight: .black))

                    Text(game.isRunning ? "STOP" : "START")
                        .font(.system(size: 34, weight: .black, design: .rounded))
                        .tracking(1.5)

                    Text(game.isRunning ? "WHISTLE" : "IN PLAY")
                        .font(.system(size: 12, weight: .heavy, design: .monospaced))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.blue.opacity(0.45))
                        .clipShape(Capsule())

                    Spacer()

                    VStack(spacing: 4) {
                        ForEach(0..<3, id: \.self) { _ in
                            Capsule()
                                .fill(Color.white.opacity(0.45))
                                .frame(width: 32, height: 3)
                        }
                    }
                }
                .padding(.vertical, 24)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .foregroundColor(.white)
            }
            .buttonStyle(
                MechanicalThumbButtonStyle(
                    primaryColor: game.isRunning ? Color(red: 0.96, green: 0.25, blue: 0.37) : Color(red: 0.06, green: 0.73, blue: 0.51),
                    shadowColor: game.isRunning ? Color(red: 0.53, green: 0.07, blue: 0.22) : Color(red: 0.02, green: 0.37, blue: 0.27),
                    extrusionHeight: 10,
                    haptic: .heavy
                )
            )
        }
    }

    // MARK: - Right Thumb Grip Pillar: Dynamic NFHS (30s) or NCAA/WA (30s & 20s)
    private var rightThumbResetPillar: some View {
        VStack(spacing: 12) {
            HStack(spacing: 6) {
                Text("RIGHT THUMB")
                    .font(.system(size: 10, weight: .black, design: .monospaced))
                    .tracking(1.2)
                Button(game.enable20sReset ? "20s/30s" : "30s ONLY") {
                    game.enable20sReset.toggle()
                }
                .font(.system(size: 9, weight: .black, design: .monospaced))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.cyan.opacity(0.25))
                .foregroundColor(.white)
                .clipShape(Capsule())
            }
            .foregroundColor(Color.cyan.opacity(0.85))

            Button(action: { game.reset30() }) {
                VStack(spacing: 6) {
                    Text("30")
                        .font(.system(size: 54, weight: .black, design: .rounded))
                        .monospacedDigit()
                    Text("RESET 30")
                        .font(.system(size: 14, weight: .black, design: .rounded))
                    Text("TURNOVER")
                        .font(.system(size: 10, weight: .heavy, design: .monospaced))
                        .opacity(0.9)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .foregroundColor(.white)
            }
            .buttonStyle(
                MechanicalThumbButtonStyle(
                    primaryColor: Color(red: 0.06, green: 0.73, blue: 0.51),
                    shadowColor: Color(red: 0.02, green: 0.37, blue: 0.27),
                    extrusionHeight: 8,
                    haptic: .heavy
                )
            )

            if game.enable20sReset {
                Button(action: { game.reset20() }) {
                    VStack(spacing: 6) {
                        Text("20")
                            .font(.system(size: 54, weight: .black, design: .rounded))
                            .monospacedDigit()
                        Text("RESET 20")
                            .font(.system(size: 14, weight: .black, design: .rounded))
                        Text("REBOUND/FOUL")
                            .font(.system(size: 10, weight: .heavy, design: .monospaced))
                            .opacity(0.9)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .foregroundColor(.white)
                }
                .buttonStyle(
                    MechanicalThumbButtonStyle(
                        primaryColor: Color(red: 0.96, green: 0.62, blue: 0.04),
                        shadowColor: Color(red: 0.57, green: 0.25, blue: 0.05),
                        extrusionHeight: 8,
                        haptic: .heavy
                    )
                )
            }
        }
    }

    // MARK: - Center Stage: Header Bar
    private var centerHeaderBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 4) {
                ForEach([1, 2, 3, 4, 5, 6], id: \.self) { p in
                    let label = p <= 4 ? "Q\(p)" : "OT\(p - 4)"
                    Button(action: { game.setPeriod(p) }) {
                        Text(label)
                            .font(.system(size: 12, weight: .heavy, design: .monospaced))
                            .foregroundColor(game.period == p ? Color(red: 0.03, green: 0.18, blue: 0.29) : .white)
                            .frame(width: 40, height: 32)
                            .background(game.period == p ? Color.cyan : Color.blue.opacity(0.35))
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                }
            }
            .padding(4)
            .background(Color(red: 0.03, green: 0.18, blue: 0.29).opacity(0.8))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            Spacer()

            HStack(spacing: 8) {
                Circle()
                    .fill(ble.isConnected ? Color.green : Color.cyan)
                    .frame(width: 8, height: 8)
                Text(game.isShotClockBlanked ? "WP 20.15 AUTO-BLANKED" : (ble.isConnected ? "POLOBRIDGE LIVE" : "RULE WP 20.15 ARMED"))
                    .font(.system(size: 11, weight: .black, design: .monospaced))
                    .foregroundColor(game.isShotClockBlanked ? Color.yellow : Color.cyan)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(red: 0.03, green: 0.18, blue: 0.29).opacity(0.85))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color.cyan.opacity(0.35), lineWidth: 1))
        }
    }

    // MARK: - Center Stage: Hero Clocks Deck
    private var heroClocksDeck: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text("MASTER GAME CLOCK (100ms)")
                    .font(.system(size: 10, weight: .heavy, design: .monospaced))
                    .tracking(1.2)
                    .foregroundColor(Color.cyan.opacity(0.85))

                Text(game.formattedGameTime)
                    .font(.system(size: 54, weight: .black, design: .monospaced))
                    .monospacedDigit()
                    .foregroundColor(.white)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .recessedBay(cornerRadius: 18)

            VStack(alignment: .trailing, spacing: 2) {
                Text("SHOT CLOCK")
                    .font(.system(size: 10, weight: .heavy, design: .monospaced))
                    .tracking(1.2)
                    .foregroundColor(game.isShotClockBlanked ? Color.cyan.opacity(0.4) : (game.shotTimeMs <= 5000 ? Color.red : Color.yellow))

                Text(game.formattedShotTime)
                    .font(.system(size: 64, weight: .black, design: .monospaced))
                    .monospacedDigit()
                    .foregroundColor(
                        game.isShotClockBlanked
                            ? Color.cyan.opacity(0.25)
                            : (game.shotTimeMs <= 5000 ? Color(red: 0.98, green: 0.35, blue: 0.45) : Color(red: 0.99, green: 0.83, blue: 0.30))
                    )
                    .frame(minWidth: 130, alignment: .trailing)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .recessedBay(cornerRadius: 18)
        }
    }

    // MARK: - Center Stage: Tactile Utility Bar
    private var tactileUtilityBar: some View {
        HStack(spacing: 12) {
            Button(action: { game.undoLastReset() }) {
                Label("UNDO", systemImage: "arrow.uturn.backward.circle.fill")
                    .font(.system(size: 13, weight: .heavy))
                    .frame(maxWidth: .infinity)
                    .frame(height: 42)
                    .foregroundColor(.white)
                    .background(Color.cyan.opacity(0.35))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            Button(action: { game.adjustShotClock(bySeconds: -1) }) {
                Text("-1s Shot")
                    .font(.system(size: 13, weight: .heavy, design: .monospaced))
                    .frame(maxWidth: .infinity)
                    .frame(height: 42)
                    .foregroundColor(.white)
                    .background(Color.blue.opacity(0.45))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            Button(action: { game.adjustShotClock(bySeconds: 1) }) {
                Text("+1s Shot")
                    .font(.system(size: 13, weight: .heavy, design: .monospaced))
                    .frame(maxWidth: .infinity)
                    .frame(height: 42)
                    .foregroundColor(.white)
                    .background(Color.blue.opacity(0.45))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            Button(action: { game.triggerManualHorn() }) {
                Label("BUZZER", systemImage: "speaker.wave.3.fill")
                    .font(.system(size: 13, weight: .black))
                    .frame(maxWidth: .infinity)
                    .frame(height: 42)
                    .foregroundColor(.white)
                    .background(Color(red: 0.95, green: 0.22, blue: 0.32))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
    }

    // MARK: - Center Stage: Recessed Team Instrument Bays
    private var teamInstrumentBays: some View {
        HStack(spacing: 16) {
            tactileTeamBay(
                teamName: "WHITE TEAM",
                score: game.scoreWhite,
                fullTO: game.fullTimeoutsWhite,
                shortTO: game.shortTimeoutsWhite,
                accentColor: .white,
                isWhite: true
            )

            tactileTeamBay(
                teamName: "DARK TEAM",
                score: game.scoreDark,
                fullTO: game.fullTimeoutsDark,
                shortTO: game.shortTimeoutsDark,
                accentColor: Color.cyan,
                isWhite: false
            )
        }
    }

    private func tactileTeamBay(
        teamName: String,
        score: Int,
        fullTO: Int,
        shortTO: Int,
        accentColor: Color,
        isWhite: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                HStack(spacing: 6) {
                    Circle()
                        .fill(accentColor)
                        .frame(width: 10, height: 10)
                    Text(teamName)
                        .font(.system(size: 14, weight: .black))
                        .foregroundColor(accentColor)
                }

                Spacer()

                HStack(spacing: 8) {
                    Button(action: { game.updateScore(isWhite: isWhite, delta: -1) }) {
                        Text("−")
                            .font(.system(size: 20, weight: .black))
                            .frame(width: 30, height: 30)
                            .foregroundColor(.white)
                            .background(Color.white.opacity(0.2))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }

                    Text("\(score)")
                        .font(.system(size: 30, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(.white)
                        .frame(minWidth: 34)

                    Button(action: { game.updateScore(isWhite: isWhite, delta: 1) }) {
                        Text("+")
                            .font(.system(size: 20, weight: .black))
                            .frame(width: 30, height: 30)
                            .foregroundColor(.white)
                            .background(Color.cyan.opacity(0.4))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }

            // Timeouts Row
            HStack {
                Text("TO: \(fullTO)F • \(shortTO)S")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundColor(Color.cyan.opacity(0.9))
                Spacer()
                Button("60s TO") {
                    game.callTimeout(isWhite: isWhite, durationSeconds: 60)
                }
                .font(.system(size: 9, weight: .heavy, design: .monospaced))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.orange.opacity(0.35))
                .foregroundColor(.yellow)
                .clipShape(Capsule())

                Button("30s TO") {
                    game.callTimeout(isWhite: isWhite, durationSeconds: 30)
                }
                .font(.system(size: 9, weight: .heavy, design: .monospaced))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.cyan.opacity(0.3))
                .foregroundColor(.white)
                .clipShape(Capsule())
            }

            Divider().background(Color.cyan.opacity(0.25))

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("20s EXCLUSIONS")
                        .font(.system(size: 9, weight: .black, design: .monospaced))
                        .foregroundColor(Color.cyan.opacity(0.85))

                    Spacer()

                    Button(action: {
                        exclusionTargetIsWhite = isWhite
                        showingExclusionSheet = true
                    }) {
                        Text("+ EJECT")
                            .font(.system(size: 10, weight: .heavy))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.red.opacity(0.35))
                            .foregroundColor(.white)
                            .clipShape(Capsule())
                    }
                }

                let teamExclusions = game.activeExclusions.filter { $0.isWhiteTeam == isWhite }
                if teamExclusions.isEmpty {
                    Text("FULL STRENGTH (6-on-6)")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(Color.cyan.opacity(0.6))
                } else {
                    HStack(spacing: 6) {
                        ForEach(teamExclusions) { ex in
                            HStack(spacing: 4) {
                                Text("#\(ex.capNumber)")
                                    .fontWeight(.heavy)
                                Text("\(ex.remainingSeconds)s")
                                    .font(.system(.caption, design: .rounded).weight(.black))
                                    .foregroundColor(.yellow)

                                Button(action: { game.earlyReleaseExclusion(id: ex.id) }) {
                                    Text("REL")
                                        .font(.system(size: 8, weight: .black))
                                        .padding(.horizontal, 4)
                                        .padding(.vertical, 2)
                                        .background(Color.white.opacity(0.25))
                                        .clipShape(RoundedRectangle(cornerRadius: 4))
                                }
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.red.opacity(0.65))
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
            }
        }
        .padding(14)
        .recessedBay(cornerRadius: 18)
    }

    // MARK: - Slotted Ejection Picker Sheet with 3-Foul Cap-Out Enforcement
    private var tactileExclusionPicker: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("SELECT CAP # FOR 20s EXCLUSION (RULE WP 22.3 3-FOUL CAP-OUT)")
                    .font(.system(size: 11, weight: .black, design: .monospaced))
                    .foregroundColor(.cyan)
                    .padding(.top, 10)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 12) {
                    ForEach(1...16, id: \.self) { cap in
                        let fouls = game.foulCount(forCap: cap, isWhite: exclusionTargetIsWhite)
                        let cappedOut = fouls >= 3
                        Button(action: {
                            game.addExclusion(capNumber: cap, isWhite: exclusionTargetIsWhite)
                            showingExclusionSheet = false
                        }) {
                            VStack(spacing: 4) {
                                Text("#\(cap)")
                                    .font(.system(size: 22, weight: .black, design: .rounded))
                                Text(cappedOut ? "3/3 ROLLED" : "\(fouls)/3 Fouls")
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundColor(cappedOut ? .red : .cyan)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 58)
                            .foregroundColor(.white)
                            .background(cappedOut ? Color.red.opacity(0.25) : Color.blue.opacity(0.45))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .disabled(cappedOut)
                    }
                }
                .padding(.horizontal, 24)

                Spacer()
            }
            .navigationTitle("Major Foul Ejection (\(exclusionTargetIsWhite ? "White" : "Dark"))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingExclusionSheet = false }
                }
            }
            .background(
                LinearGradient(
                    colors: [
                        Color(red: 0.05, green: 0.29, blue: 0.43),
                        Color(red: 0.12, green: 0.11, blue: 0.29)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
            )
        }
        .presentationDetents([.fraction(0.6)])
    }
}
