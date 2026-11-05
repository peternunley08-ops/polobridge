import SwiftUI

// =============================================================================
// POLOPAD PRO - TWO-HANDED HANDHELD THUMB ERGONOMICS
// Optimized for holding the iPad with two hands on the pool deck:
// - FAR LEFT THUMB PILLAR: Massive Full-Height START / STOP Actuator
// - FAR RIGHT THUMB PILLAR: Stacked Giant RESET 30 & RESET 20 Thumb Triggers
// - CENTER STAGE: Recessed Instrument Clocks, Period Rack, Scores & Ejections
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
                    // 3D Extrusion Foundation
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(shadowColor)
                        .offset(y: extrusionHeight)

                    // Button Surface with Specular Rim
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
                                        colors: [Color.white.opacity(0.45), Color.white.opacity(0.05)],
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
                color: Color.black.opacity(isPressed ? 0.35 : 0.7),
                radius: isPressed ? 4 : 16,
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

// MARK: - Recessed Instrument Bay Modifier
struct RecessedBayModifier: ViewModifier {
    var cornerRadius: CGFloat = 20

    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(Color(red: 0.03, green: 0.04, blue: 0.06))

                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [Color.black.opacity(0.85), Color.white.opacity(0.12)],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            lineWidth: 2
                        )
                }
            )
            .shadow(color: Color.black.opacity(0.7), radius: 14, x: 0, y: 6)
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.black.opacity(0.6), lineWidth: 2)
                    .blur(radius: 1.5)
            )
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
            // Dark Carbon/Slate Canvas
            LinearGradient(
                colors: [
                    Color(red: 0.08, green: 0.10, blue: 0.15),
                    Color(red: 0.03, green: 0.04, blue: 0.07)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            // 3-COLUMN ERGONOMIC HANDHELD LAYOUT
            HStack(spacing: 20) {
                // ==========================================
                // 1. LEFT THUMB PILLAR (START / STOP)
                // ==========================================
                leftThumbStartStopPillar
                    .frame(width: 175)

                // ==========================================
                // 2. CENTER STAGE (INSTRUMENTS & STATS)
                // ==========================================
                VStack(spacing: 16) {
                    centerHeaderBar
                    heroClocksDeck
                    tactileUtilityBar
                    teamInstrumentBays
                }
                .frame(maxWidth: .infinity)

                // ==========================================
                // 3. RIGHT THUMB PILLAR (RESET 30 & 20)
                // ==========================================
                rightThumbResetPillar
                    .frame(width: 175)
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 16)
        }
        .sheet(isPresented: $showingExclusionSheet) {
            tactileExclusionPicker
        }
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
            .foregroundColor(Color.white.opacity(0.35))

            Button(action: {
                withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                    game.toggleStartStop()
                }
            }) {
                VStack(spacing: 14) {
                    // Tactile Thumb Grip Ridges
                    VStack(spacing: 4) {
                        ForEach(0..<3) { _ in
                            Capsule()
                                .fill(Color.white.opacity(0.3))
                                .frame(width: 32, height: 3)
                        }
                    }

                    Spacer()

                    Image(systemName: game.isRunning ? "pause.fill" : "play.fill")
                        .font(.system(size: 58, weight: .black))
                        .shadow(color: Color.black.opacity(0.4), radius: 6, y: 3)

                    Text(game.isRunning ? "STOP" : "START")
                        .font(.system(size: 34, weight: .black, design: .rounded))
                        .tracking(1.5)

                    Text(game.isRunning ? "WHISTLE" : "IN PLAY")
                        .font(.system(size: 12, weight: .heavy, design: .monospaced))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.black.opacity(0.35))
                        .clipShape(Capsule())

                    Spacer()

                    // Bottom Grip Ridges
                    VStack(spacing: 4) {
                        ForEach(0..<3) { _ in
                            Capsule()
                                .fill(Color.white.opacity(0.3))
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
                    primaryColor: game.isRunning ? Color(red: 0.95, green: 0.20, blue: 0.20) : Color(red: 0.10, green: 0.80, blue: 0.44),
                    shadowColor: game.isRunning ? Color(red: 0.52, green: 0.08, blue: 0.08) : Color(red: 0.04, green: 0.45, blue: 0.24),
                    extrusionHeight: 10,
                    haptic: .heavy
                )
            )
        }
    }

    // MARK: - Right Thumb Grip Pillar: Stacked RESET 30 & RESET 20
    private var rightThumbResetPillar: some View {
        VStack(spacing: 12) {
            HStack(spacing: 6) {
                Text("RIGHT THUMB")
                    .font(.system(size: 10, weight: .black, design: .monospaced))
                    .tracking(1.2)
                Image(systemName: "hand.raised.fill")
                    .font(.caption2.bold())
            }
            .foregroundColor(Color.white.opacity(0.35))

            // TOP BUTTON: RESET 30s (Turnover)
            Button(action: { game.reset30() }) {
                VStack(spacing: 6) {
                    Text("30")
                        .font(.system(size: 54, weight: .black, design: .rounded))
                        .monospacedDigit()
                    Text("RESET 30")
                        .font(.system(size: 14, weight: .black, design: .rounded))
                    Text("TURNOVER")
                        .font(.system(size: 10, weight: .heavy, design: .monospaced))
                        .opacity(0.8)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .foregroundColor(.white)
            }
            .buttonStyle(
                MechanicalThumbButtonStyle(
                    primaryColor: Color(red: 0.08, green: 0.75, blue: 0.44),
                    shadowColor: Color(red: 0.03, green: 0.42, blue: 0.24),
                    extrusionHeight: 8,
                    haptic: .heavy
                )
            )

            // BOTTOM BUTTON: RESET 20s (Rebound / Ejection)
            Button(action: { game.reset20() }) {
                VStack(spacing: 6) {
                    Text("20")
                        .font(.system(size: 54, weight: .black, design: .rounded))
                        .monospacedDigit()
                    Text("RESET 20")
                        .font(.system(size: 14, weight: .black, design: .rounded))
                    Text("REBOUND/FOUL")
                        .font(.system(size: 10, weight: .heavy, design: .monospaced))
                        .opacity(0.8)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .foregroundColor(.white)
            }
            .buttonStyle(
                MechanicalThumbButtonStyle(
                    primaryColor: Color(red: 1.0, green: 0.58, blue: 0.05),
                    shadowColor: Color(red: 0.65, green: 0.32, blue: 0.0),
                    extrusionHeight: 8,
                    haptic: .heavy
                )
            )
        }
    }

    // MARK: - Center Stage: Header Bar
    private var centerHeaderBar: some View {
        HStack(spacing: 14) {
            // Period Rack
            HStack(spacing: 6) {
                ForEach([1, 2, 3, 4], id: \.self) { q in
                    Button(action: { game.setPeriod(q) }) {
                        Text("Q\(q)")
                            .font(.system(.subheadline, design: .rounded).weight(.heavy))
                            .foregroundColor(game.period == q ? .white : Color(white: 0.6))
                            .frame(width: 44, height: 34)
                            .background(game.period == q ? Color.blue : Color.black.opacity(0.4))
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                }
                Button(action: { game.setPeriod(5) }) {
                    Text("OT")
                        .font(.system(.subheadline, design: .rounded).weight(.heavy))
                        .foregroundColor(game.period == 5 ? .white : Color(white: 0.6))
                        .frame(width: 44, height: 34)
                        .background(game.period == 5 ? Color.orange : Color.black.opacity(0.4))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
            }
            .padding(4)
            .background(Color.black.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            Spacer()

            // Status Capsule
            HStack(spacing: 8) {
                Circle()
                    .fill(ble.isConnected ? Color.green : Color.orange)
                    .frame(width: 8, height: 8)
                Text(game.isShotClockBlanked ? "RULE WP 20.15 BLANKED" : (ble.isConnected ? "POLOBRIDGE CONNECTED" : "DONGLE STANDBY"))
                    .font(.system(size: 11, weight: .black, design: .monospaced))
                    .foregroundColor(game.isShotClockBlanked ? Color.orange : (ble.isConnected ? Color.green : Color.gray))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Color.black.opacity(0.5))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color.white.opacity(0.1), lineWidth: 1))
        }
    }

    // MARK: - Center Stage: Hero Clocks Deck
    private var heroClocksDeck: some View {
        HStack(spacing: 16) {
            // Master Game Clock Chamber
            VStack(alignment: .leading, spacing: 2) {
                Text("MASTER GAME CLOCK")
                    .font(.system(size: 10, weight: .heavy, design: .monospaced))
                    .tracking(1.4)
                    .foregroundColor(Color.white.opacity(0.4))

                Text(game.formattedGameTime)
                    .font(.system(size: 60, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(.white)
                    .shadow(color: Color.blue.opacity(game.isRunning ? 0.35 : 0.0), radius: 8)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .recessedBay(cornerRadius: 18)

            // Shot Clock Recessed Chamber
            VStack(alignment: .trailing, spacing: 2) {
                Text("SHOT CLOCK")
                    .font(.system(size: 10, weight: .heavy, design: .monospaced))
                    .tracking(1.4)
                    .foregroundColor(game.isShotClockBlanked ? Color.gray : (game.shotTimeMs <= 5000 ? Color.red : Color.orange))

                Text(game.formattedShotTime)
                    .font(.system(size: 68, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(
                        game.isShotClockBlanked
                            ? Color(white: 0.25)
                            : (game.shotTimeMs <= 5000 ? Color(red: 1.0, green: 0.25, blue: 0.25) : Color(red: 1.0, green: 0.82, blue: 0.12))
                    )
                    .frame(minWidth: 140, alignment: .trailing)
                    .shadow(
                        color: game.isShotClockBlanked ? Color.clear : (game.shotTimeMs <= 5000 ? Color.red : Color.yellow).opacity(0.4),
                        radius: 12
                    )
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 10)
            .recessedBay(cornerRadius: 18)
        }
    }

    // MARK: - Center Stage: Tactile Utility Bar
    private var tactileUtilityBar: some View {
        HStack(spacing: 12) {
            Button(action: { game.undoLastReset() }) {
                Label("UNDO RESET", systemImage: "arrow.uturn.backward.circle.fill")
                    .font(.system(size: 13, weight: .heavy))
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .foregroundColor(.white)
                    .background(Color(red: 0.58, green: 0.22, blue: 0.88))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            Button(action: { game.adjustShotClock(bySeconds: -1) }) {
                Text("-1s")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .foregroundColor(.white)
                    .background(Color(white: 0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            Button(action: { game.adjustShotClock(bySeconds: 1) }) {
                Text("+1s")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .foregroundColor(.white)
                    .background(Color(white: 0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            Button(action: { game.triggerManualHorn() }) {
                Label("HORN", systemImage: "speaker.wave.3.fill")
                    .font(.system(size: 14, weight: .black))
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .foregroundColor(.white)
                    .background(Color(red: 0.90, green: 0.15, blue: 0.15))
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
                accentColor: .white,
                isWhite: true
            )

            tactileTeamBay(
                teamName: "DARK TEAM",
                score: game.scoreDark,
                accentColor: Color(red: 0.40, green: 0.70, blue: 1.0),
                isWhite: false
            )
        }
    }

    private func tactileTeamBay(
        teamName: String,
        score: Int,
        accentColor: Color,
        isWhite: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                HStack(spacing: 6) {
                    Circle()
                        .fill(accentColor)
                        .frame(width: 10, height: 10)
                    Text(teamName)
                        .font(.system(size: 15, weight: .black))
                        .foregroundColor(accentColor)
                }

                Spacer()

                HStack(spacing: 8) {
                    Button(action: { game.updateScore(isWhite: isWhite, delta: -1) }) {
                        Text("−")
                            .font(.system(size: 20, weight: .black))
                            .frame(width: 32, height: 32)
                            .foregroundColor(.white)
                            .background(Color(white: 0.2))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }

                    Text("\(score)")
                        .font(.system(size: 32, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(.white)
                        .frame(minWidth: 36)

                    Button(action: { game.updateScore(isWhite: isWhite, delta: 1) }) {
                        Text("+")
                            .font(.system(size: 20, weight: .black))
                            .frame(width: 32, height: 32)
                            .foregroundColor(.white)
                            .background(Color(red: 0.10, green: 0.65, blue: 0.35))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }

            Divider().background(Color.white.opacity(0.08))

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("20s EXCLUSIONS")
                        .font(.system(size: 9, weight: .black, design: .monospaced))
                        .tracking(1)
                        .foregroundColor(Color.white.opacity(0.4))

                    Spacer()

                    Button(action: {
                        exclusionTargetIsWhite = isWhite
                        showingExclusionSheet = true
                    }) {
                        Text("+ EJECT")
                            .font(.system(size: 10, weight: .heavy))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.red.opacity(0.2))
                            .foregroundColor(.red)
                            .clipShape(Capsule())
                    }
                }

                let teamExclusions = game.activeExclusions.filter { $0.isWhiteTeam == isWhite }
                if teamExclusions.isEmpty {
                    Text("FULL STRENGTH")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(Color.white.opacity(0.2))
                        .padding(.vertical, 2)
                } else {
                    HStack(spacing: 6) {
                        ForEach(teamExclusions) { ex in
                            HStack(spacing: 4) {
                                Text("#\(ex.capNumber)")
                                    .fontWeight(.heavy)
                                Text("\(ex.remainingSeconds)s")
                                    .font(.system(.caption, design: .rounded).weight(.black))
                                    .foregroundColor(ex.remainingSeconds <= 5 ? .yellow : .white)

                                Button(action: { game.earlyReleaseExclusion(id: ex.id) }) {
                                    Text("REL")
                                        .font(.system(size: 8, weight: .black))
                                        .padding(.horizontal, 4)
                                        .padding(.vertical, 2)
                                        .background(Color.white.opacity(0.2))
                                        .clipShape(RoundedRectangle(cornerRadius: 4))
                                }
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.red.opacity(0.3))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
            }
        }
        .padding(14)
        .recessedBay(cornerRadius: 18)
    }

    // MARK: - Slotted Ejection Picker Sheet
    private var tactileExclusionPicker: some View {
        NavigationStack {
            VStack(spacing: 18) {
                Text("SELECT EXCLUDED CAP NUMBER")
                    .font(.system(size: 12, weight: .black, design: .monospaced))
                    .foregroundColor(.secondary)
                    .padding(.top, 10)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 5), spacing: 14) {
                    ForEach(1...20, id: \.self) { cap in
                        Button(action: {
                            game.addExclusion(capNumber: cap, isWhite: exclusionTargetIsWhite)
                            showingExclusionSheet = false
                        }) {
                            Text("\(cap)")
                                .font(.system(size: 24, weight: .black, design: .rounded))
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                                .foregroundColor(.white)
                                .background(Color(white: 0.18))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
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
            .background(Color(red: 0.08, green: 0.10, blue: 0.14).ignoresSafeArea())
        }
        .presentationDetents([.fraction(0.55)])
    }
}
