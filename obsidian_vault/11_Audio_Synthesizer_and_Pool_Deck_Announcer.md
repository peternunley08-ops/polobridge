---
title: "Audio Synthesizer & Pool Deck Voice Announcer"
tags:
  - polobridge
  - polopad-pro
  - audio-synthesizer
  - web-audio-api
  - web-speech-api
  - horns-and-buzzers
status: production-live
updated: 2026-11-12
---

# 📢 Audio Synthesizer & Pool Deck Voice Announcer

> [!important] Production Specification
> - **Engine Source**: `react_app/src/engine/audio-synthesizer.ts`
> - **UI Component**: `react_app/src/components/audio-announcer-panel.tsx`
> - **Oscillators**: Web Audio API (CTS 220/440 Hz, Daktronics 110/220/330 Hz, European LEN 185/277 Hz, Fox-40 Whistle 2800/3120 Hz)
> - **Voice Engine**: Web Speech API (`SpeechSynthesisUtterance`) with automated queue management
> - **Persistence**: `localStorage` (`polopad_audio_settings`)

---

## 1. Executive Summary & Acoustic Architecture

In noisy aquatic facilities, scoring table volunteers, referees, coaches, and spectators rely heavily on acoustic cues. PoloPad Pro features a broadcast-grade Web Audio API harmonic oscillator engine and an automated voice announcer.

```
       +---------------------------------------------+
       |         PoloPad Pro Pool Deck Console       |
       |  (Goals, Exclusions, 15s Warnings, Period)  |
       +----------------------+----------------------+
                              |
                     audioSynthesizer
                              |
            +-----------------+-----------------+
            |                                   |
            v                                   v
   Web Audio API Oscillators            Web Speech API
   - CTS Olympic (220 + 440 Hz)         - "Goal White Cap 4! Score 8-6"
   - Daktronics Buzz (110-330 Hz)       - "Exclusion Dark Cap 8, 20s"
   - European Foghorn (185 + 277 Hz)    - "Warning, 15s remaining"
   - Fox-40 Whistle (2.8-3.1 kHz)       - "Cap 7 Dark has capped out"
```

---

## 2. Facility Horn Timbres & Frequencies

1. **Colorado Time Systems (CTS) Olympic Dual-Tone**:
   - `220 Hz` fundamental sawtooth wave + `440 Hz` octave square wave.
   - Low-pass biquad filter with resonance at `1800 Hz` for warm, penetrating pool-deck acoustic projection.
2. **Daktronics Omnisport Industrial Harsh Buzz**:
   - Stack of 3 square-wave oscillators at `110 Hz`, `220 Hz`, and `330 Hz`.
   - Distinctive American high school and NCAA indoor pool buzzer signature.
3. **European LEN Pneumatic Foghorn**:
   - Dual sawtooth oscillators forming a minor third chord (`185 Hz` F#3 and `277 Hz` C#4).
   - Low-frequency pneumatic acoustic rumble for massive Olympic stadiums.
4. **Fox-40 Referee Pea-less Whistle**:
   - Beating sine wave oscillation at `2800 Hz` and `3120 Hz` creating a piercing acoustic chirp.

---

## 3. Web Speech API Voice Callout Protocol

Automated speech announcements trigger with zero latency on key match events:
- **Rule WP 21 Goal Release**: *"Goal White Cap 4! Score is White 8, Dark 6."*
- **Rule WP 20.15 Exclusion**: *"Exclusion on Dark, Cap Number 8. 20 seconds."*
- **Rule WP 22.3 Cap-Out (3 Personal Fouls)**: *"Three personal fouls. Cap Number 7 Dark has capped out."*
- **Timeout Warnings (Rule WP 20)**: *"Warning, 15 seconds remaining on timeout."*
- **Shot Clock Expiry**: *"Shot clock violation. Turnover."*
- **Period End**: *"End of Period 2. White 6, Dark 4."*

---

## 4. Quality Assurance & Verification

- **Engine Architecture Tests**: `tests/test_audio_synthesizer.py` (5/5 PASS)
- **Playwright E2E Bundle Verification**: `tests/test_playwright_e2e.py` (`test_09_audio_synthesizer_bundle`, 9/9 PASS)
- **Engine TypeScript Suite**: 250 / 250 PASS (`npm test`)
