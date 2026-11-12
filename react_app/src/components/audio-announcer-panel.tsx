import React, { useState, useEffect } from 'react';
import {
  audioSynthesizer,
  AudioSettings,
  HornTimbre,
} from '../engine/audio-synthesizer';

interface AudioAnnouncerPanelProps {
  onBackToConsole: () => void;
}

export const AudioAnnouncerPanel: React.FC<AudioAnnouncerPanelProps> = ({
  onBackToConsole,
}) => {
  const [settings, setSettings] = useState<AudioSettings>(audioSynthesizer.getSettings());
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [visualizerActive, setVisualizerActive] = useState(false);

  useEffect(() => {
    setSettings(audioSynthesizer.getSettings());
  }, []);

  const handleUpdate = (partial: Partial<AudioSettings>) => {
    audioSynthesizer.updateSettings(partial);
    setSettings(audioSynthesizer.getSettings());
  };

  const triggerVisualizer = () => {
    setVisualizerActive(true);
    setTimeout(() => setVisualizerActive(false), 1400);
  };

  const testHorn = (timbre: HornTimbre, name: string) => {
    setActiveTest(`horn-${timbre}`);
    triggerVisualizer();
    audioSynthesizer.playHorn(1200, timbre);
    setTimeout(() => setActiveTest(null), 1200);
  };

  const testWhistle = () => {
    setActiveTest('whistle');
    triggerVisualizer();
    audioSynthesizer.playWhistle(400);
    setTimeout(() => setActiveTest(null), 400);
  };

  const testCallout = (type: string, action: () => void) => {
    setActiveTest(type);
    triggerVisualizer();
    action();
    setTimeout(() => setActiveTest(null), 1600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-900 via-blue-900 to-indigo-950 text-sky-100 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl flex flex-col gap-6">
        {/* Header Bar */}
        <header className="bg-sky-950/70 backdrop-blur-md border-2 border-cyan-400/40 rounded-2xl p-4 md:p-6 shadow-2xl flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/40">
              📢
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase">
                Audio Synthesizer & Voice Announcer
              </h1>
              <p className="text-xs md:text-sm text-cyan-300 font-medium">
                Broadcast-Grade Web Audio Oscillators & Automated Pool Deck Speech Synthesis
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              audioSynthesizer.playClick();
              onBackToConsole();
            }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-cyan-900/50 transition-all active:translate-y-0.5 border border-cyan-300/40"
          >
            ← Return to Console
          </button>
        </header>

        {/* Status Strip & Sound Waveform Meter */}
        <section className="bg-sky-900/50 backdrop-blur-md border border-cyan-400/30 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 border ${
                settings.soundEnabled
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/40'
                  : 'bg-rose-500/20 text-rose-400 border-rose-400/40'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  settings.soundEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              {settings.soundEnabled ? 'Audio Engine Online' : 'Audio Engine Muted'}
            </div>

            <div
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                settings.voiceAnnouncerEnabled
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                  : 'bg-slate-500/20 text-slate-400 border-slate-400/40'
              }`}
            >
              Voice Announcer: {settings.voiceAnnouncerEnabled ? 'Active' : 'Disabled'}
            </div>

            <div className="px-3 py-1 rounded-full text-xs font-bold bg-blue-950/60 text-sky-200 border border-blue-400/30">
              Timbre: <span className="text-cyan-300 uppercase">{settings.buzzerTimbre}</span>
            </div>
          </div>

          {/* Animated Frequency Bars */}
          <div className="flex items-end gap-1.5 h-8 px-4 py-1 bg-sky-950/80 rounded-xl border border-cyan-500/20">
            {[40, 75, 95, 60, 85, 100, 70, 90, 50, 80].map((h, i) => (
              <div
                key={i}
                className={`w-1.5 rounded-full transition-all duration-150 ${
                  visualizerActive
                    ? 'bg-gradient-to-t from-cyan-400 to-emerald-400'
                    : 'bg-sky-800'
                }`}
                style={{
                  height: visualizerActive ? `${h}%` : '20%',
                }}
              />
            ))}
          </div>
        </section>

        {/* Master Configuration Controls */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Audio Engine Configuration */}
          <div className="bg-sky-950/60 backdrop-blur-md border border-cyan-400/30 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <h2 className="text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
              <span>🎛️</span> Master Audio & Buzzer Settings
            </h2>

            {/* Toggle Master Sound */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-sky-900/40 border border-cyan-400/20">
              <div>
                <div className="text-sm font-bold text-white">Synthesizer Sound Effects</div>
                <div className="text-xs text-sky-300/80">Play horns, whistles, chimes, and plunger clicks</div>
              </div>
              <button
                onClick={() => {
                  audioSynthesizer.playClick();
                  handleUpdate({ soundEnabled: !settings.soundEnabled });
                }}
                className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all border ${
                  settings.soundEnabled
                    ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/50 shadow-md shadow-emerald-950'
                    : 'bg-rose-500/30 text-rose-300 border-rose-400/50'
                }`}
              >
                {settings.soundEnabled ? 'Enabled' : 'Muted'}
              </button>
            </div>

            {/* Horn Timbre Selector */}
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-sky-900/40 border border-cyan-400/20">
              <label className="text-xs font-bold text-sky-200 uppercase tracking-wider">
                Aquatic Facility Horn Timbre
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cts', label: 'CTS Olympic', desc: '220/440 Hz' },
                  { id: 'daktronics', label: 'Daktronics', desc: '110/220/330 Hz' },
                  { id: 'european', label: 'LEN Foghorn', desc: '185/277 Hz' },
                ].map((timbre) => (
                  <button
                    key={timbre.id}
                    onClick={() => {
                      audioSynthesizer.playClick();
                      handleUpdate({ buzzerTimbre: timbre.id as HornTimbre });
                    }}
                    className={`p-2.5 rounded-xl text-center border transition-all ${
                      settings.buzzerTimbre === timbre.id
                        ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400 shadow-md shadow-cyan-950 font-black'
                        : 'bg-sky-950/40 text-sky-300/70 border-sky-800 hover:border-cyan-500/40 font-semibold'
                    }`}
                  >
                    <div className="text-xs">{timbre.label}</div>
                    <div className="text-[10px] text-cyan-400/80 font-mono mt-0.5">{timbre.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Master Volume Slider */}
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-sky-900/40 border border-cyan-400/20">
              <div className="flex justify-between items-center text-xs font-bold text-sky-200">
                <span className="uppercase tracking-wider">Master Facility Volume</span>
                <span className="font-mono text-cyan-300">{Math.round(settings.masterVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.masterVolume}
                onChange={(e) => handleUpdate({ masterVolume: parseFloat(e.target.value) })}
                className="w-full h-2 bg-sky-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>

          {/* Voice Announcer Configuration */}
          <div className="bg-sky-950/60 backdrop-blur-md border border-cyan-400/30 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <h2 className="text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
              <span>🗣️</span> Pool Deck Voice Announcer Settings
            </h2>

            {/* Toggle Voice Announcer */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-sky-900/40 border border-cyan-400/20">
              <div>
                <div className="text-sm font-bold text-white">Automated Speech Callouts</div>
                <div className="text-xs text-sky-300/80">Announce exclusions, goals, timeouts, & cap-outs</div>
              </div>
              <button
                onClick={() => {
                  audioSynthesizer.playClick();
                  handleUpdate({ voiceAnnouncerEnabled: !settings.voiceAnnouncerEnabled });
                }}
                className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all border ${
                  settings.voiceAnnouncerEnabled
                    ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400/50 shadow-md shadow-cyan-950'
                    : 'bg-slate-500/30 text-slate-300 border-slate-400/50'
                }`}
              >
                {settings.voiceAnnouncerEnabled ? 'Active' : 'Muted'}
              </button>
            </div>

            {/* Voice Speech Rate Slider */}
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-sky-900/40 border border-cyan-400/20">
              <div className="flex justify-between items-center text-xs font-bold text-sky-200">
                <span className="uppercase tracking-wider">Announcer Speech Cadence</span>
                <span className="font-mono text-cyan-300">{settings.voiceRate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.3"
                step="0.05"
                value={settings.voiceRate}
                onChange={(e) => handleUpdate({ voiceRate: parseFloat(e.target.value) })}
                className="w-full h-2 bg-sky-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="flex justify-between text-[10px] text-sky-400 font-medium">
                <span>0.8x (Deliberate)</span>
                <span>1.05x (Athletic)</span>
                <span>1.3x (Rapid)</span>
              </div>
            </div>

            {/* Voice Pitch Slider */}
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-sky-900/40 border border-cyan-400/20">
              <div className="flex justify-between items-center text-xs font-bold text-sky-200">
                <span className="uppercase tracking-wider">Announcer Vocal Pitch</span>
                <span className="font-mono text-cyan-300">{settings.voicePitch.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.05"
                value={settings.voicePitch}
                onChange={(e) => handleUpdate({ voicePitch: parseFloat(e.target.value) })}
                className="w-full h-2 bg-sky-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>
        </section>

        {/* Interactive Sound Test Bench */}
        <section className="bg-sky-950/60 backdrop-blur-md border border-cyan-400/30 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
              <span>🔊</span> Interactive Acoustic & Voice Test Bench
            </h2>
            <span className="text-xs text-sky-400 font-semibold">Click any test trigger to preview facility audio</span>
          </div>

          {/* Plunger Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => testHorn('cts', 'CTS Olympic Dual-Tone')}
              className={`p-3.5 rounded-xl font-black text-xs uppercase tracking-wider text-white border transition-all shadow-lg active:translate-y-0.5 flex flex-col items-center justify-center gap-1 ${
                activeTest === 'horn-cts'
                  ? 'bg-rose-600 border-rose-300 ring-2 ring-rose-400 scale-[0.98]'
                  : 'bg-gradient-to-b from-rose-500 to-rose-700 hover:from-rose-400 hover:to-rose-600 border-rose-400/40 shadow-rose-950/60'
              }`}
            >
              <span className="text-lg">🚨</span>
              <span>CTS Olympic Horn</span>
              <span className="text-[10px] text-rose-200 font-mono font-normal">220 + 440 Hz (1.2s)</span>
            </button>

            <button
              onClick={() => testHorn('daktronics', 'Daktronics Omnisport')}
              className={`p-3.5 rounded-xl font-black text-xs uppercase tracking-wider text-white border transition-all shadow-lg active:translate-y-0.5 flex flex-col items-center justify-center gap-1 ${
                activeTest === 'horn-daktronics'
                  ? 'bg-amber-600 border-amber-300 ring-2 ring-amber-400 scale-[0.98]'
                  : 'bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 border-amber-400/40 shadow-amber-950/60'
              }`}
            >
              <span className="text-lg">⚡</span>
              <span>Daktronics Buzzer</span>
              <span className="text-[10px] text-amber-200 font-mono font-normal">110-330 Hz Stack</span>
            </button>

            <button
              onClick={() => testHorn('european', 'European LEN Foghorn')}
              className={`p-3.5 rounded-xl font-black text-xs uppercase tracking-wider text-white border transition-all shadow-lg active:translate-y-0.5 flex flex-col items-center justify-center gap-1 ${
                activeTest === 'horn-european'
                  ? 'bg-blue-600 border-blue-300 ring-2 ring-blue-400 scale-[0.98]'
                  : 'bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 border-blue-400/40 shadow-blue-950/60'
              }`}
            >
              <span className="text-lg">🚢</span>
              <span>European Foghorn</span>
              <span className="text-[10px] text-blue-200 font-mono font-normal">185 + 277 Hz Minor</span>
            </button>

            <button
              onClick={testWhistle}
              className={`p-3.5 rounded-xl font-black text-xs uppercase tracking-wider text-white border transition-all shadow-lg active:translate-y-0.5 flex flex-col items-center justify-center gap-1 ${
                activeTest === 'whistle'
                  ? 'bg-emerald-600 border-emerald-300 ring-2 ring-emerald-400 scale-[0.98]'
                  : 'bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 border-emerald-400/40 shadow-emerald-950/60'
              }`}
            >
              <span className="text-lg">📯</span>
              <span>Fox-40 Whistle</span>
              <span className="text-[10px] text-emerald-200 font-mono font-normal">2.8-3.1 kHz Beating</span>
            </button>
          </div>

          {/* Voice Announcement Callout Bench */}
          <div className="mt-2 border-t border-cyan-400/20 pt-4 flex flex-col gap-2">
            <span className="text-xs font-bold text-sky-200 uppercase tracking-wider">
              Automated Pool Deck Voice Callouts
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() =>
                  testCallout('callout-goal', () =>
                    audioSynthesizer.announceGoal('White', 4, { white: 11, dark: 9 })
                  )
                }
                className="p-3 rounded-xl bg-sky-900/40 hover:bg-sky-800/60 border border-cyan-400/30 text-left transition-all flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-black text-emerald-400 uppercase">Goal Callout</div>
                  <div className="text-[11px] text-sky-200">"Goal White, Cap 4! Score White 11, Dark 9"</div>
                </div>
                <span className="text-base">🤽‍♂️</span>
              </button>

              <button
                onClick={() =>
                  testCallout('callout-excl', () =>
                    audioSynthesizer.announceExclusion('Dark', 8, 20)
                  )
                }
                className="p-3 rounded-xl bg-sky-900/40 hover:bg-sky-800/60 border border-cyan-400/30 text-left transition-all flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-black text-rose-400 uppercase">Exclusion Callout</div>
                  <div className="text-[11px] text-sky-200">"Exclusion on Dark, Cap 8. 20 seconds."</div>
                </div>
                <span className="text-base">⏱️</span>
              </button>

              <button
                onClick={() =>
                  testCallout('callout-to', () =>
                    audioSynthesizer.announceTimeoutWarning(15)
                  )
                }
                className="p-3 rounded-xl bg-sky-900/40 hover:bg-sky-800/60 border border-cyan-400/30 text-left transition-all flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-black text-amber-400 uppercase">Timeout 15s Warning</div>
                  <div className="text-[11px] text-sky-200">"Warning, 15 seconds on timeout."</div>
                </div>
                <span className="text-base">🔔</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
