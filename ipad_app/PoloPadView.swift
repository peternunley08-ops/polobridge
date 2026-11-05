import SwiftUI

// =============================================================================
// POLOPAD PRO - TACTILE INSTRUMENT INTERFACE
// Deep 3D Physical Architecture:
// - Extruded Tactile Pushbuttons with Mechanical Key Travel & Beveled Bezels
// - Recessed Optical-Glass Instrument Chambers with Inset Ambient Shadows
// - Machine-Milled Studio Switcher Design with Anodized Highlights
// - Dual-Layer Segment Backlighting & Acoustic Click Engine
// =============================================================================

// MARK: - 3D Mechanical Key Actuator Button Style
struct Mechanical3DButtonStyle: ButtonStyle {
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
                    // Bottom 3D Extrusion Shadow Block (The "Body" of the button)
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .fill(shadowColor)
                        .offset(y: extrusionHeight)

                    // Button Surface with Specular Bevel Highlight
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
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
                            // 1px Razor Bevel Edge Light
                            RoundedRectangle(cornerRadius: 22, style: .continuous)
                                .stroke(
                                    LinearGradient(
                                        colors: [Color.white.opacity(0.4), Color.white.opacity(0.05)],
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
                color: Color.black.opacity(isPressed ? 0.3 : 0.65),
                radius: isPressed ? 4 : 14,
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

// MARK: - Tactile Studio Toggle Pill Style
struct StudioToggleButtonStyle: ButtonStyle {
    var isSelected: Bool
    var activeColor: Color = .blue

    func makeBody(configuration: Configuration) -> some View {
        let isPressed = configuration.isPressed

        configuration.label
            .offset(y: isPressed ? 2 : (isSelected ? 1 : 0))
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(
                        isSelected
                            ? LinearGradient(colors: [activeColor, activeColor.opacity(0.8)], startPoint: .top, endPoint: .bottom)
                            : LinearGradient(colors: [Color(white: 0.18), Color(white: 0.12)], startPoint: .top, endPoint: .bottom)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(
                                LinearGradient(
                                    colors: isSelected
                                        ? [Color.white.opacity(0.45), Color.clear]
                                        : [Color.white.opacity(0.15), Color.black.opacity(0.4)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                ),
                                lineWidth: 1
                            )
                    )
            )
            .shadow(
                color: isSelected ? activeColor.opacity(0.4) : Color.black.opacity(0.4),
                radius: isSelected ? 8 : 4,
                y: isSelected ? 3 : 2
            )
            .animation(.easeOut(duration: 0.12), value: isPressed)
    }
}

// MARK: - Recessed Instrument Chamber View Modifier
struct RecessedChamberModifier: ViewModifier {
    var cornerRadius: CGFloat = 24

    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    // Deep optical chamber floor
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(Color(red: 0.03, green: 0.04, blue: 0.06))

                    // Machine-Milled Outer Chamfer (Bottom light bounce + Top inner shadow)
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
            // Outer drop shadow on the bezel
            .shadow(color: Color.black.opacity(0.7), radius: 16, x: 0, y: 8)
            .overlay(
                // Inset Ambient Cavity Rim
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.black.opacity(0.6), lineWidth: 3)
                    .blur(radius: 2)
            )
    }
}

extension View {
    func recessedChamber(cornerRadius: CGFloat = 24) -> some View {
        self.modifier(RecessedChamberModifier(cornerRadius: cornerRadius))
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
            // Anodized Slate Chassis Canvas with Carbon Depth
            LinearGradient(
                colors: [
                    Color(red: 0.09, green: 0.11, blue: 0.16),
                    Color(red: 0.04, green: 0.05, blue: 0.08)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 22) {
                // Machined Header HUD
                machinedTopHeader

                // Hero Clock Deck (Recessed Optical Glass Bays)
                heroClockDeck

                // Deep 3D Key Actuators (30s & 20s)
                giant3DActuators

                // Heavy Tactile Control Dock
                tactileUtilityDock

                // Recessed Team Bays & Ejections
                teamInstrumentBays
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 20)
        }
        .sheet(isPresented: $showingExclusionSheet) {
            tactileExclusionPicker
        }
    }

    // MARK: - 1. Machined Top Header
    private var machinedTopHeader: some View {
        HStack(spacing: 16) {
            // Recessed Period Switcher Rack
            HStack(spacing: 6) {
                ForEach([1, 2, 3, 4], id: \.self) { q in
                    Button(action: { game.setPeriod(q) }) {
                        Text("Q\(q)")
                            .font(.system(.subheadline, design: .rounded).weight(.heavy))
                            .foregroundColor(game.period == q ? .white : Color(white: 0.6))
                            .frame(width: 48, height: 38)
                    }
                    .buttonStyle(StudioToggleButtonStyle(isSelected: game.period == q, activeColor: Color(red: 0.0, green: 0.48, blue: 1.0)))
                }

                Button(action: { game.setPeriod(5) }) {
                    Text("OT")
                        .font(.system(.subheadline, design: .rounded).weight(.heavy))
                        .foregroundColor(game.period == 5 ? .white : Color(white: 0.6))
                        .frame(width: 48, height: 38)
                }
                .buttonStyle(StudioToggleButtonStyle(isSelected: game.period == 5, activeColor: Color.orange))
            }
            .padding(6)
            .background(Color.black.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            )

            Spacer()

            // Hardware Dongle Link Status Capsule (Illuminated Jewel Beacon)
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(ble.isConnected ? Color.green : Color.orange)
                        .frame(width: 10, height: 10)
                        .blur(radius: 2)
                    Circle()
                        .fill(Color.white.opacity(0.8))
                        .frame(width: 4, height: 4)
                }

                Text(ble.isConnected ? "POLOBRIDGE 9600-8-E-1" : "CONNECTING DONGLE...")
                    .font(.system(size: 12, weight: .black, design: .monospaced))
                    .foregroundColor(ble.isConnected ? Color(red: 0.4, green: 1.0, blue: 0.6) : .orange)

                Image(systemName: "antenna.radiowaves.left.and.right")
                    .font(.caption.bold())
                    .foregroundColor(ble.isConnected ? .green : .orange)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.black.opacity(0.6))
            .clipShape(Capsule())
            .overlay(
                Capsule().stroke(Color.white.opacity(0.12), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.5), radius: 6, y: 3)
        }
    }

    // MARK: - 2. Hero Clock Deck (Recessed Optical Glass Bays)
    private var heroClockDeck: some View {
        HStack(spacing: 20) {
            // Master Game Clock Chamber
            HStack(spacing: 24) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Image(systemName: "stopwatch.fill")
                            .font(.caption.weight(.bold))
                        Text("MASTER GAME TIMER")
                            .font(.system(size: 11, weight: .heavy, design: .monospaced))
                            .tracking(1.8)
                    }
                    .foregroundColor(Color.white.opacity(0.45))

                    Text(game.formattedGameTime)
                        .font(.system(size: 64, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(.white)
                        .shadow(color: Color.blue.opacity(game.isRunning ? 0.35 : 0.0), radius: 10)
                }

                Spacer()

                // 3D Master Start/Stop Plunger Button
                Button(action: { game.toggleStartStop() }) {
                    HStack(spacing: 10) {
                        Image(systemName: game.isRunning ? "pause.fill" : "play.fill")
                            .font(.title3.weight(.black))
                        Text(game.isRunning ? "STOP" : "START")
                            .font(.title3.weight(.heavy))
                            .tracking(1)
                    }
                    .frame(width: 154, height: 68)
                    .foregroundColor(.white)
                }
                .buttonStyle(
                    Mechanical3DButtonStyle(
                        primaryColor: game.isRunning ? Color(red: 0.95, green: 0.22, blue: 0.22) : Color(red: 0.12, green: 0.78, blue: 0.42),
                        shadowColor: game.isRunning ? Color(red: 0.55, green: 0.08, blue: 0.08) : Color(red: 0.05, green: 0.42, blue: 0.22),
                        extrusionHeight: 6,
                        haptic: .heavy
                    )
                )
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 18)
            .recessedChamber(cornerRadius: 24)

            // Shot Clock Recessed Chamber
            VStack(alignment: .trailing, spacing: 2) {
                HStack(spacing: 6) {
                    Image(systemName: "bolt.fill")
                        .font(.caption.bold())
                    Text("SHOT CLOCK")
                        .font(.system(size: 11, weight: .heavy, design: .monospaced))
                        .tracking(1.8)
                }
                .foregroundColor(game.shotTimeMs <= 5000 ? Color.red : Color.orange)

                Text(game.formattedShotTime)
                    .font(.system(size: 76, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(
                        game.shotTimeMs <= 5000
                            ? Color(red: 1.0, green: 0.25, blue: 0.25)
                            : Color(red: 1.0, green: 0.82, blue: 0.12)
                    )
                    .frame(minWidth: 155, alignment: .trailing)
                    .shadow(
                        color: (game.shotTimeMs <= 5000 ? Color.red : Color.yellow).opacity(0.4),
                        radius: 14
                    )
            }
            .padding(.horizontal, 26)
            .padding(.vertical, 14)
            .recessedChamber(cornerRadius: 24)
        }
    }

    // MARK: - 3. Deep 3D Key Actuators (30s & 20s)
    private var giant3DActuators: some View {
        HStack(spacing: 22) {
            // 30 SECONDS ACTUATOR (Full Possession Change)
            Button(action: { game.reset30() }) {
                VStack(spacing: 4) {
                    Text("30")
                        .font(.system(size: 66, weight: .black, design: .rounded))
                        .monospacedDigit()
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.counterclockwise.circle.fill")
                        Text("RESET 30s (Turnover)")
                            .font(.system(size: 14, weight: .heavy))
                            .tracking(0.6)
                    }
                    .opacity(0.95)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 120)
                .foregroundColor(.white)
            }
            .buttonStyle(
                Mechanical3DButtonStyle(
                    primaryColor: Color(red: 0.08, green: 0.75, blue: 0.44),
                    shadowColor: Color(red: 0.03, green: 0.42, blue: 0.24),
                    extrusionHeight: 8,
                    haptic: .heavy
                )
            )

            // 20 SECONDS ACTUATOR (Rebound / Exclusion / Penalty)
            Button(action: { game.reset20() }) {
                VStack(spacing: 4) {
                    Text("20")
                        .font(.system(size: 66, weight: .black, design: .rounded))
                        .monospacedDigit()
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.triangle.fill")
                        Text("RESET 20s (Rebound/Eject)")
                            .font(.system(size: 14, weight: .heavy))
                            .tracking(0.6)
                    }
                    .opacity(0.95)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 120)
                .foregroundColor(.white)
            }
            .buttonStyle(
                Mechanical3DButtonStyle(
                    primaryColor: Color(red: 1.0, green: 0.58, blue: 0.05),
                    shadowColor: Color(red: 0.65, green: 0.32, blue: 0.0),
                    extrusionHeight: 8,
                    haptic: .heavy
                )
            )
        }
    }

    // MARK: - 4. Heavy Tactile Utility Dock
    private var tactileUtilityDock: some View {
        HStack(spacing: 14) {
            // Undo Reset Key
            Button(action: { game.undoLastReset() }) {
                Label("UNDO RESET", systemImage: "arrow.uturn.backward.circle.fill")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .foregroundColor(.white)
            }
            .buttonStyle(
                Mechanical3DButtonStyle(
                    primaryColor: Color(red: 0.62, green: 0.24, blue: 0.92),
                    shadowColor: Color(red: 0.35, green: 0.10, blue: 0.55),
                    extrusionHeight: 5,
                    haptic: .medium
                )
            )

            // -1s Nudge
            Button(action: { game.adjustShotClock(bySeconds: -1) }) {
                Text("-1s Shot")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .foregroundColor(Color.white.opacity(0.9))
            }
            .buttonStyle(
                Mechanical3DButtonStyle(
                    primaryColor: Color(red: 0.22, green: 0.25, blue: 0.33),
                    shadowColor: Color(red: 0.10, green: 0.12, blue: 0.17),
                    extrusionHeight: 5,
                    haptic: .light
                )
            )

            // +1s Nudge
            Button(action: { game.adjustShotClock(bySeconds: 1) }) {
                Text("+1s Shot")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .foregroundColor(Color.white.opacity(0.9))
            }
            .buttonStyle(
                Mechanical3DButtonStyle(
                    primaryColor: Color(red: 0.22, green: 0.25, blue: 0.33),
                    shadowColor: Color(red: 0.10, green: 0.12, blue: 0.17),
                    extrusionHeight: 5,
                    haptic: .light
                )
            )

            // Emergency Aquatic Horn Slammer
            Button(action: { game.triggerManualHorn() }) {
                Label("HORN", systemImage: "speaker.wave.3.fill")
                    .font(.system(size: 15, weight: .black))
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .foregroundColor(.white)
            }
            .buttonStyle(
                Mechanical3DButtonStyle(
                    primaryColor: Color(red: 0.92, green: 0.15, blue: 0.15),
                    shadowColor: Color(red: 0.50, green: 0.05, blue: 0.05),
                    extrusionHeight: 5,
                    haptic: .heavy
                )
            )
        }
    }

    // MARK: - 5. Recessed Team Instrument Bays
    private var teamInstrumentBays: some View {
        HStack(spacing: 20) {
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
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                HStack(spacing: 8) {
                    Circle()
                        .fill(accentColor)
                        .frame(width: 12, height: 12)
                        .shadow(color: accentColor.opacity(0.6), radius: 4)
                    Text(teamName)
                        .font(.system(size: 16, weight: .black))
                        .foregroundColor(accentColor)
                }

                Spacer()

                // Mechanical Score Knobs
                HStack(spacing: 10) {
                    Button(action: { game.updateScore(isWhite: isWhite, delta: -1) }) {
                        Text("−")
                            .font(.system(size: 22, weight: .black))
                            .frame(width: 38, height: 38)
                            .foregroundColor(.white)
                    }
                    .buttonStyle(
                        Mechanical3DButtonStyle(
                            primaryColor: Color(white: 0.25),
                            shadowColor: Color(white: 0.12),
                            extrusionHeight: 4,
                            haptic: .medium
                        )
                    )

                    Text("\(score)")
                        .font(.system(size: 36, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(.white)
                        .frame(minWidth: 44)
                        .shadow(color: accentColor.opacity(0.3), radius: 6)

                    Button(action: { game.updateScore(isWhite: isWhite, delta: 1) }) {
                        Text("+")
                            .font(.system(size: 22, weight: .black))
                            .frame(width: 38, height: 38)
                            .foregroundColor(.white)
                    }
                    .buttonStyle(
                        Mechanical3DButtonStyle(
                            primaryColor: Color(red: 0.10, green: 0.65, blue: 0.35),
                            shadowColor: Color(red: 0.04, green: 0.35, blue: 0.18),
                            extrusionHeight: 4,
                            haptic: .medium
                        )
                    )
                }
            }

            Divider().background(Color.white.opacity(0.08))

            // Slotted Exclusion Deck
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("20s MAJOR FOULS")
                        .font(.system(size: 10, weight: .black, design: .monospaced))
                        .tracking(1.2)
                        .foregroundColor(Color.white.opacity(0.4))

                    Spacer()

                    Button(action: {
                        exclusionTargetIsWhite = isWhite
                        showingExclusionSheet = true
                    }) {
                        Label("EJECT CAP", systemImage: "plus")
                            .font(.system(size: 11, weight: .heavy))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color.red.opacity(0.2))
                            .foregroundColor(.red)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(Color.red.opacity(0.4), lineWidth: 1))
                    }
                }

                let teamExclusions = game.activeExclusions.filter { $0.isWhiteTeam == isWhite }
                if teamExclusions.isEmpty {
                    Text("FULL STRENGTH")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundColor(Color.white.opacity(0.2))
                        .padding(.vertical, 2)
                } else {
                    HStack(spacing: 8) {
                        ForEach(teamExclusions) { ex in
                            HStack(spacing: 6) {
                                Text("#\(ex.capNumber)")
                                    .fontWeight(.heavy)
                                Text("\(ex.remainingSeconds)s")
                                    .font(.system(.body, design: .rounded).weight(.black))
                                    .monospacedDigit()
                                    .foregroundColor(ex.remainingSeconds <= 5 ? .yellow : .white)

                                Button(action: { game.removeExclusion(id: ex.id) }) {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.caption)
                                        .foregroundColor(Color.white.opacity(0.6))
                                }
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(
                                ex.remainingSeconds == 0
                                    ? Color.green.opacity(0.35)
                                    : Color.red.opacity(0.3)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(ex.remainingSeconds <= 5 ? Color.orange : Color.clear, lineWidth: 1.5)
                            )
                        }
                    }
                }
            }
        }
        .padding(18)
        .recessedChamber(cornerRadius: 22)
    }

    // MARK: - 6. Slotted Ejection Picker Sheet
    private var tactileExclusionPicker: some View {
        NavigationStack {
            VStack(spacing: 20) {
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
                                .frame(height: 54)
                                .foregroundColor(.white)
                        }
                        .buttonStyle(
                            Mechanical3DButtonStyle(
                                primaryColor: Color(red: 0.18, green: 0.22, blue: 0.30),
                                shadowColor: Color(red: 0.08, green: 0.10, blue: 0.14),
                                extrusionHeight: 5,
                                haptic: .medium
                            )
                        )
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
