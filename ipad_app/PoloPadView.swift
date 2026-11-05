import SwiftUI

// =============================================================================
// POLOPAD - FIRST-PARTY APPLE DESIGN SYSTEM FOR IPADOS
// Adheres to Apple Human Interface Guidelines (HIG):
// - Adaptive Material Glassmorphism (.regularMaterial, .ultraThinMaterial)
// - Monospaced Tabular Numerals (.monospacedDigit())
// - Tactile Spring Button Physics with Haptic Audio Engine
// - Semantic System Colors & Squircle Continuous Radii
// =============================================================================

// MARK: - Custom Tactile Button Style (Apple Spring Physics)
struct AppleTactileButtonStyle: ButtonStyle {
    var hapticStyle: UIImpactFeedbackGenerator.FeedbackStyle = .medium
    var scaleDown: CGFloat = 0.96

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scaleDown : 1.0)
            .animation(.spring(response: 0.22, dampingFraction: 0.65), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { isPressed in
                if isPressed {
                    UIImpactFeedbackGenerator(style: hapticStyle).impactOccurred()
                }
            }
    }
}

// MARK: - Main PoloPad View
struct PoloPadView: View {
    @StateObject private var ble = BluetoothManager()
    @StateObject private var game: WaterPoloGameModel

    @State private var showingExclusionSheet: Bool = false
    @State private var exclusionTargetIsWhite: Bool = true
    @State private var showingTimeEditPopover: Bool = false
    @State private var editMinutes: Int = 8
    @State private var editSeconds: Int = 0

    init() {
        let ble = BluetoothManager()
        _ble = StateObject(wrappedValue: ble)
        _game = StateObject(wrappedValue: WaterPoloGameModel(bleManager: ble))
    }

    var body: some View {
        ZStack {
            // Apple Pro Obsidian Gradient Canvas
            LinearGradient(
                colors: [
                    Color(red: 0.06, green: 0.08, blue: 0.12),
                    Color(red: 0.03, green: 0.04, blue: 0.06)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Subtle Background Radial Glow for Live Timer Atmosphere
            RadialGradient(
                colors: [
                    game.shotTimeMs <= 5000 && game.isRunning
                        ? Color.red.opacity(0.18)
                        : (game.isRunning ? Color.blue.opacity(0.10) : Color.clear),
                    Color.clear
                ],
                center: .top,
                startRadius: 50,
                endRadius: 650
            )
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 0.4), value: game.shotTimeMs <= 5000)

            VStack(spacing: 20) {
                // Top Floating Glass HUD Bar
                topGlassNavigationBar

                // Central Command Deck: Hero Clocks
                heroClockDeck

                // Twin Power Actuators: 30s & 20s
                tactileShotButtons

                // Secondary Utility Dock (Undo, Fine Adjust, Horn)
                utilityGlassDock

                // Team Scorecards & Live Exclusion Badges
                teamScorecardsDock
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 20)
        }
        .sheet(isPresented: $showingExclusionSheet) {
            appleExclusionPickerSheet
        }
    }

    // MARK: - 1. Top Glass Navigation HUD
    private var topGlassNavigationBar: some View {
        HStack(spacing: 16) {
            // Period Segmented Controller (Apple HIG Capsule Style)
            HStack(spacing: 4) {
                ForEach([1, 2, 3, 4], id: \.self) { q in
                    Button(action: {
                        withAnimation(.spring(response: 0.28, dampingFraction: 0.75)) {
                            game.setPeriod(q)
                        }
                    }) {
                        Text("Q\(q)")
                            .font(.system(.subheadline, design: .rounded).weight(.bold))
                            .foregroundColor(game.period == q ? .white : .secondary)
                            .frame(width: 48, height: 36)
                            .background(
                                game.period == q
                                    ? AnyView(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.blue))
                                    : AnyView(Color.clear)
                            )
                    }
                    .buttonStyle(AppleTactileButtonStyle(hapticStyle: .light))
                }

                Button(action: {
                    withAnimation(.spring(response: 0.28, dampingFraction: 0.75)) {
                        game.setPeriod(5)
                    }
                }) {
                    Text("OT")
                        .font(.system(.subheadline, design: .rounded).weight(.bold))
                        .foregroundColor(game.period == 5 ? .white : .secondary)
                        .frame(width: 48, height: 36)
                        .background(
                            game.period == 5
                                ? AnyView(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.orange))
                                : AnyView(Color.clear)
                        )
                }
                .buttonStyle(AppleTactileButtonStyle(hapticStyle: .light))
            }
            .padding(4)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
            )

            Spacer()

            // Dynamic Island-Style Bluetooth Status Pill
            HStack(spacing: 8) {
                Circle()
                    .fill(ble.isConnected ? Color.green : Color.orange)
                    .frame(width: 8, height: 8)
                    .shadow(color: (ble.isConnected ? Color.green : Color.orange).opacity(0.6), radius: 4)

                Text(ble.isConnected ? "PoloBridge Connected" : "Searching...")
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundColor(ble.isConnected ? .primary : .secondary)

                if ble.isConnected {
                    Image(systemName: "wave.3.forward.circle.fill")
                        .font(.system(size: 13))
                        .foregroundColor(.green)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(
                Capsule().strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
            )
        }
    }

    // MARK: - 2. Hero Clock Deck
    private var heroClockDeck: some View {
        HStack(spacing: 20) {
            // Master Game Clock Card
            HStack(spacing: 24) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Image(systemName: "stopwatch.fill")
                            .font(.caption2.weight(.bold))
                        Text("GAME CLOCK")
                            .font(.caption2.weight(.bold))
                            .tracking(1.5)
                    }
                    .foregroundColor(.secondary)

                    Text(game.formattedGameTime)
                        .font(.system(size: 68, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(.primary)
                        .contentTransition(.numericText())
                }

                Spacer()

                // Master Toggle Button (Apple Start/Stop Style)
                Button(action: {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        game.toggleStartStop()
                    }
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: game.isRunning ? "pause.fill" : "play.fill")
                            .font(.title2.weight(.black))
                        Text(game.isRunning ? "PAUSE" : "START")
                            .font(.title3.weight(.heavy))
                            .tracking(0.5)
                    }
                    .frame(width: 160, height: 72)
                    .foregroundColor(.white)
                    .background(
                        LinearGradient(
                            colors: game.isRunning
                                ? [Color(uiColor: .systemRed), Color.red.opacity(0.85)]
                                : [Color(uiColor: .systemGreen), Color.green.opacity(0.85)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.2), lineWidth: 1)
                    )
                    .shadow(
                        color: (game.isRunning ? Color.red : Color.green).opacity(0.35),
                        radius: 12, y: 4
                    )
                }
                .buttonStyle(AppleTactileButtonStyle(hapticStyle: .heavy))
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 20)
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
            )

            // Shot Clock Hero Card
            VStack(alignment: .trailing, spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: "timer")
                        .font(.caption2.weight(.bold))
                    Text("SHOT CLOCK")
                        .font(.caption2.weight(.bold))
                        .tracking(1.5)
                }
                .foregroundColor(game.shotTimeMs <= 5000 ? .red : .orange)

                Text(game.formattedShotTime)
                    .font(.system(size: 78, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(game.shotTimeMs <= 5000 ? .red : Color(red: 1.0, green: 0.76, blue: 0.03))
                    .frame(minWidth: 160, alignment: .trailing)
                    .contentTransition(.numericText())
                    .shadow(
                        color: (game.shotTimeMs <= 5000 ? Color.red : Color.orange).opacity(game.isRunning ? 0.35 : 0.0),
                        radius: 12
                    )
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 16)
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .strokeBorder(
                        game.shotTimeMs <= 5000 ? Color.red.opacity(0.5) : Color.white.opacity(0.1),
                        lineWidth: game.shotTimeMs <= 5000 ? 2 : 1
                    )
            )
        }
    }

    // MARK: - 3. Tactile 30s & 20s Power Actuators
    private var tactileShotButtons: some View {
        HStack(spacing: 20) {
            // GIANT 30s BUTTON
            Button(action: { game.reset30() }) {
                VStack(spacing: 6) {
                    Text("30")
                        .font(.system(size: 64, weight: .black, design: .rounded))
                        .monospacedDigit()
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.counterclockwise.circle.fill")
                        Text("POSSESSION TURNOVER")
                            .font(.system(size: 14, weight: .heavy))
                            .tracking(0.8)
                    }
                    .opacity(0.9)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 124)
                .foregroundColor(.white)
                .background(
                    LinearGradient(
                        colors: [Color(red: 0.06, green: 0.72, blue: 0.44), Color(red: 0.03, green: 0.55, blue: 0.33)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.25), lineWidth: 1)
                )
                .shadow(color: Color.green.opacity(0.28), radius: 14, y: 6)
            }
            .buttonStyle(AppleTactileButtonStyle(hapticStyle: .heavy))

            // GIANT 20s BUTTON
            Button(action: { game.reset20() }) {
                VStack(spacing: 6) {
                    Text("20")
                        .font(.system(size: 64, weight: .black, design: .rounded))
                        .monospacedDigit()
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.circle.fill")
                        Text("REBOUND / EXCLUSION")
                            .font(.system(size: 14, weight: .heavy))
                            .tracking(0.8)
                    }
                    .opacity(0.9)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 124)
                .foregroundColor(.white)
                .background(
                    LinearGradient(
                        colors: [Color(red: 0.95, green: 0.58, blue: 0.07), Color(red: 0.85, green: 0.44, blue: 0.03)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.25), lineWidth: 1)
                )
                .shadow(color: Color.orange.opacity(0.28), radius: 14, y: 6)
            }
            .buttonStyle(AppleTactileButtonStyle(hapticStyle: .heavy))
        }
    }

    // MARK: - 4. Utility Glass Dock
    private var utilityGlassDock: some View {
        HStack(spacing: 14) {
            // Undo Reset
            Button(action: {
                withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                    game.undoLastReset()
                }
            }) {
                Label("UNDO RESET", systemImage: "arrow.uturn.backward.circle.fill")
                    .font(.subheadline.bold())
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .foregroundColor(.white)
                    .background(Color.purple.opacity(0.75))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(AppleTactileButtonStyle(hapticStyle: .medium))

            // Adjust -1s
            Button(action: { game.adjustShotClock(bySeconds: -1) }) {
                Text("-1s Shot")
                    .font(.subheadline.bold())
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .foregroundColor(.primary)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
                    )
            }
            .buttonStyle(AppleTactileButtonStyle(hapticStyle: .light))

            // Adjust +1s
            Button(action: { game.adjustShotClock(bySeconds: 1) }) {
                Text("+1s Shot")
                    .font(.subheadline.bold())
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .foregroundColor(.primary)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
                    )
            }
            .buttonStyle(AppleTactileButtonStyle(hapticStyle: .light))

            // Electric Horn
            Button(action: { game.triggerManualHorn() }) {
                Label("HORN", systemImage: "speaker.wave.3.fill")
                    .font(.subheadline.weight(.heavy))
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .foregroundColor(.white)
                    .background(Color(uiColor: .systemRed))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .shadow(color: Color.red.opacity(0.3), radius: 8, y: 2)
            }
            .buttonStyle(AppleTactileButtonStyle(hapticStyle: .heavy))
        }
    }

    // MARK: - 5. Team Scorecards & Exclusion Trackers
    private var teamScorecardsDock: some View {
        HStack(spacing: 20) {
            appleTeamScoreCard(
                teamName: "WHITE TEAM",
                score: game.scoreWhite,
                accentColor: .white,
                isWhite: true
            )

            appleTeamScoreCard(
                teamName: "DARK TEAM",
                score: game.scoreDark,
                accentColor: Color(red: 0.35, green: 0.65, blue: 1.0),
                isWhite: false
            )
        }
    }

    private func appleTeamScoreCard(
        teamName: String,
        score: Int,
        accentColor: Color,
        isWhite: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                HStack(spacing: 8) {
                    Circle()
                        .fill(accentColor)
                        .frame(width: 12, height: 12)
                    Text(teamName)
                        .font(.headline.weight(.heavy))
                        .foregroundColor(accentColor)
                }

                Spacer()

                // Score Stepper
                HStack(spacing: 12) {
                    Button(action: { game.updateScore(isWhite: isWhite, delta: -1) }) {
                        Image(systemName: "minus.circle.fill")
                            .font(.title2)
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(AppleTactileButtonStyle(hapticStyle: .light))

                    Text("\(score)")
                        .font(.system(size: 38, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(.primary)
                        .frame(minWidth: 44)

                    Button(action: { game.updateScore(isWhite: isWhite, delta: 1) }) {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                            .foregroundColor(.green)
                    }
                    .buttonStyle(AppleTactileButtonStyle(hapticStyle: .light))
                }
            }

            Divider().background(Color.white.opacity(0.12))

            // Exclusion Badges Tray
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("20s EXCLUSIONS")
                        .font(.caption2.weight(.bold))
                        .tracking(1.2)
                        .foregroundColor(.secondary)

                    Spacer()

                    Button(action: {
                        exclusionTargetIsWhite = isWhite
                        showingExclusionSheet = true
                    }) {
                        Label("Add Ejection", systemImage: "plus")
                            .font(.caption.weight(.bold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color.red.opacity(0.18))
                            .foregroundColor(.red)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(AppleTactileButtonStyle(hapticStyle: .light))
                }

                let teamExclusions = game.activeExclusions.filter { $0.isWhiteTeam == isWhite }
                if teamExclusions.isEmpty {
                    Text("No active ejections")
                        .font(.footnote)
                        .foregroundColor(.secondary.opacity(0.6))
                        .padding(.vertical, 4)
                } else {
                    HStack(spacing: 8) {
                        ForEach(teamExclusions) { ex in
                            HStack(spacing: 6) {
                                Text("Cap #\(ex.capNumber)")
                                    .fontWeight(.bold)
                                Text("\(ex.remainingSeconds)s")
                                    .font(.system(.body, design: .rounded).weight(.black))
                                    .monospacedDigit()
                                    .foregroundColor(ex.remainingSeconds <= 5 ? .yellow : .white)

                                Button(action: { game.removeExclusion(id: ex.id) }) {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(ex.remainingSeconds == 0 ? Color.green.opacity(0.3) : Color.red.opacity(0.25))
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().strokeBorder(
                                    ex.remainingSeconds <= 5 ? Color.orange : Color.clear,
                                    lineWidth: 1
                                )
                            )
                        }
                    }
                }
            }
        }
        .padding(18)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
        )
    }

    // MARK: - 6. Apple-Grade Exclusion Picker Modal
    private var appleExclusionPickerSheet: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("Select Excluded Player Cap Number")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.top, 8)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: 5), spacing: 14) {
                    ForEach(1...20, id: \.self) { cap in
                        Button(action: {
                            game.addExclusion(capNumber: cap, isWhite: exclusionTargetIsWhite)
                            showingExclusionSheet = false
                        }) {
                            Text("\(cap)")
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .frame(maxWidth: .infinity)
                                .frame(height: 56)
                                .foregroundColor(.primary)
                                .background(.regularMaterial)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
                                )
                        }
                        .buttonStyle(AppleTactileButtonStyle(hapticStyle: .medium))
                    }
                }
                .padding(.horizontal, 24)

                Spacer()
            }
            .navigationTitle("Add 20s Exclusion (\(exclusionTargetIsWhite ? "White" : "Dark"))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingExclusionSheet = false }
                }
            }
            .background(Color(uiColor: .systemGroupedBackground).ignoresSafeArea())
        }
        .presentationDetents([.fraction(0.52)])
        .presentationCornerRadius(28)
    }
}
