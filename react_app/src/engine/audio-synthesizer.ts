/**
 * PoloBridge & PoloPad Pro — Audio Synthesizer & Pool Deck Voice Announcer
 *
 * Implements broadcast-grade Web Audio API harmonic oscillators (CTS Olympic dual-tone,
 * Daktronics Omnisport industrial buzz, European LEN pneumatic foghorn, Fox-40 whistle)
 * and Web Speech API automated voice announcer for noisy aquatic facilities.
 */

export type HornTimbre = 'cts' | 'daktronics' | 'european';

export interface AudioSettings {
  soundEnabled: boolean;
  voiceAnnouncerEnabled: boolean;
  buzzerTimbre: HornTimbre;
  masterVolume: number; // 0.0 to 1.0
  voiceRate: number;    // 0.8 to 1.3
  voicePitch: number;   // 0.8 to 1.2
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  soundEnabled: true,
  voiceAnnouncerEnabled: true,
  buzzerTimbre: 'cts',
  masterVolume: 0.85,
  voiceRate: 1.05,
  voicePitch: 1.0,
};

const STORAGE_KEY = 'polopad_audio_settings';

export class AudioSynthesizerManager {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings;
  private speechQueue: string[] = [];
  private isSpeaking = false;

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): AudioSettings {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          return { ...DEFAULT_AUDIO_SETTINGS, ...JSON.parse(saved) };
        }
      }
    } catch {
      // Fallback to default
    }
    return { ...DEFAULT_AUDIO_SETTINGS };
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...partial };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      }
    } catch {
      // Storage unavailable
    }
  }

  private initContext() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Play tactile click feedback on plungers & buttons
   */
  public playClick() {
    if (!this.settings.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.015);

      gain.gain.setValueAtTime(0.25 * this.settings.masterVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.015);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Play Official Pool Horn / Buzzer based on selected facility timbre
   * @param durationMs Duration of horn blast in milliseconds
   * @param overrideTimbre Optional timbre override
   */
  public playHorn(durationMs = 1200, overrideTimbre?: HornTimbre) {
    if (!this.settings.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const timbre = overrideTimbre || this.settings.buzzerTimbre;
      const dur = durationMs / 1000;
      const t = this.ctx.currentTime;
      const masterVol = this.settings.masterVolume;

      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.4 * masterVol, t);
      masterGain.gain.exponentialRampToValueAtTime(0.01 * masterVol, t + dur);
      masterGain.connect(this.ctx.destination);

      if (timbre === 'cts') {
        // Colorado Time Systems Olympic Dual-Tone (220 Hz fundamental + 440 Hz octave harmonic)
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'square';

        osc1.frequency.setValueAtTime(220, t);
        osc1.frequency.linearRampToValueAtTime(215, t + dur);

        osc2.frequency.setValueAtTime(440, t);
        osc2.frequency.linearRampToValueAtTime(430, t + dur);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, t);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(masterGain);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + dur);
        osc2.stop(t + dur);

      } else if (timbre === 'daktronics') {
        // Daktronics Omnisport Industrial Harsh Buzz (110 Hz + 220 Hz + 330 Hz harmonic stack)
        const freqs = [110, 220, 330];
        freqs.forEach((f) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(f, t);
          osc.connect(masterGain);
          osc.start(t);
          osc.stop(t + dur);
        });

      } else {
        // European LEN Pneumatic Foghorn (185 Hz + 277 Hz minor third chord)
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';

        osc1.frequency.setValueAtTime(185, t);
        osc2.frequency.setValueAtTime(277, t);

        osc1.connect(masterGain);
        osc2.connect(masterGain);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + dur);
        osc2.stop(t + dur);
      }
    } catch {
      // Audio fallback
    }
  }

  /**
   * Play Referee Fox-40 pea-less acoustic whistle burst
   */
  public playWhistle(durationMs = 400) {
    if (!this.settings.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const dur = durationMs / 1000;
      const masterVol = this.settings.masterVolume;

      // Fox-40 acoustic whistle operates around 2800 Hz and 3100 Hz beating
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(2800, t);
      osc2.frequency.setValueAtTime(3120, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.3 * masterVol, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + dur);
      osc2.stop(t + dur);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Play multi-frequency attention chime
   */
  public playChime(tone: 'info' | 'warn' = 'info') {
    if (!this.settings.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const notes = tone === 'warn' ? [392, 311] : [659, 880];
      const masterVol = this.settings.masterVolume;

      notes.forEach((frequency, index) => {
        const startAt = ctx.currentTime + index * 0.14;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = tone === 'warn' ? 'square' : 'sine';
        osc.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime((tone === 'warn' ? 0.14 : 0.22) * masterVol, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.13);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + 0.14);
      });
    } catch {
      // Audio fallback
    }
  }

  // =========================================================================
  // Web Speech API Automated Voice Announcer
  // =========================================================================

  /**
   * Speak announcement using Web Speech API synthesis
   */
  public speak(text: string, priority: 'normal' | 'urgent' = 'normal') {
    if (!this.settings.voiceAnnouncerEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (priority === 'urgent') {
      window.speechSynthesis.cancel();
      this.speechQueue = [];
      this.isSpeaking = false;
    }

    this.speechQueue.push(text);
    this.processSpeechQueue();
  }

  private processSpeechQueue() {
    if (this.isSpeaking || this.speechQueue.length === 0) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const nextText = this.speechQueue.shift();
    if (!nextText) return;

    try {
      const utterance = new SpeechSynthesisUtterance(nextText);
      utterance.rate = this.settings.voiceRate;
      utterance.pitch = this.settings.voicePitch;
      utterance.volume = this.settings.masterVolume;

      utterance.onend = () => {
        this.isSpeaking = false;
        this.processSpeechQueue();
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        this.processSpeechQueue();
      };

      this.isSpeaking = true;
      window.speechSynthesis.speak(utterance);
    } catch {
      this.isSpeaking = false;
    }
  }

  // --- Voice Announcer Pre-Engineered Water Polo Calls ---

  public announceGoal(team: 'White' | 'Dark', cap?: number, newScore?: { white: number; dark: number }) {
    let msg = `Goal ${team}!`;
    if (cap) {
      msg = `Goal ${team}, Cap Number ${cap}!`;
    }
    if (newScore) {
      msg += ` Score is White ${newScore.white}, Dark ${newScore.dark}.`;
    }
    this.speak(msg, 'normal');
  }

  public announceExclusion(team: 'White' | 'Dark', cap: number, durationSec = 20) {
    const msg = `Exclusion on ${team}, Cap Number ${cap}. ${durationSec} seconds.`;
    this.speak(msg, 'urgent');
  }

  public announceTimeout(team: 'White' | 'Dark', is30s = false) {
    const duration = is30s ? '30 seconds' : '1 minute';
    const msg = `Timeout called by ${team} team, ${duration}.`;
    this.speak(msg, 'urgent');
  }

  public announceTimeoutWarning(secondsRemaining = 15) {
    const msg = `Warning, ${secondsRemaining} seconds remaining on timeout.`;
    this.speak(msg, 'urgent');
  }

  public announceShotClockViolation() {
    this.speak('Shot clock violation. Turnover.', 'urgent');
  }

  public announcePeriodEnd(period: number, whiteScore: number, darkScore: number) {
    const msg = `End of Period ${period}. White ${whiteScore}, Dark ${darkScore}.`;
    this.speak(msg, 'normal');
  }

  public announceCapOut(team: 'White' | 'Dark', cap: number) {
    const msg = `Three personal fouls. Cap Number ${cap} ${team} has capped out.`;
    this.speak(msg, 'urgent');
  }
}

export const audioSynthesizer = new AudioSynthesizerManager();
