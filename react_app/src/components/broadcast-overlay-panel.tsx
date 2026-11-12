import React, { useState, useEffect } from 'react';
import {
  broadcastManager,
  BroadcastOverlaySettings,
  BroadcastTheme,
  ChromaMode,
  BroadcastSyncState,
} from '../engine/broadcast-manager';

interface BroadcastOverlayPanelProps {
  currentGameState: BroadcastSyncState;
  onBackToConsole: () => void;
}

export const BroadcastOverlayPanel: React.FC<BroadcastOverlayPanelProps> = ({
  currentGameState,
  onBackToConsole,
}) => {
  const [settings, setSettings] = useState<BroadcastOverlaySettings>(broadcastManager.getSettings());
  const [copied, setCopied] = useState(false);
  const [testGoalSplash, setTestGoalSplash] = useState(false);

  useEffect(() => {
    // Sync current console game state to broadcast channel continuously
    broadcastManager.broadcastState(currentGameState);
  }, [currentGameState]);

  const handleUpdate = (partial: Partial<BroadcastOverlaySettings>) => {
    broadcastManager.updateSettings(partial);
    setSettings(broadcastManager.getSettings());
  };

  const copyObsUrl = () => {
    const url = broadcastManager.generateObsUrl(window.location.href);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formatMinSec = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const shotSec = Math.floor(currentGameState.shotTimeMs / 1000);
  const isBlanked = currentGameState.gameTimeMs <= currentGameState.shotTimeMs;

  const triggerMockGoalSplash = () => {
    setTestGoalSplash(true);
    setTimeout(() => setTestGoalSplash(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-900 via-blue-900 to-indigo-950 text-sky-100 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl flex flex-col gap-6">
        {/* Header Bar */}
        <header className="bg-sky-950/70 backdrop-blur-md border-2 border-cyan-400/40 rounded-2xl p-4 md:p-6 shadow-2xl flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-rose-600 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/40">
              📺
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase">
                Live Broadcast Scorebug Suite (OBS & vMix)
              </h1>
              <p className="text-xs md:text-sm text-cyan-300 font-medium">
                Transparent Browser Source HUD • Olympic & ESPN Graphic Themes • Power-Play Trackers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={copyObsUrl}
              className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all border shadow-lg flex items-center gap-2 ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-950'
                  : 'bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white border-rose-400/40 shadow-rose-950'
              }`}
            >
              <span>{copied ? '✓ Copied URL!' : '🔗 Copy OBS Browser Source URL'}</span>
            </button>

            <button
              onClick={onBackToConsole}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-900/50 transition-all border border-cyan-300/40"
            >
              ← Return to Console
            </button>
          </div>
        </header>

        {/* Live Broadcast Television Preview Sandbox */}
        <section className="bg-sky-950/80 backdrop-blur-md border-2 border-cyan-400/30 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
          <div className="flex justify-between items-center pb-2 border-b border-cyan-400/20">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span>
              <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                Live Television Stream Preview (Simulated Camera Feed)
              </span>
            </div>
            <span className="text-xs text-sky-300 font-mono">
              OBS Resolution: 1920x1080 • Theme: <strong className="text-cyan-300 uppercase">{settings.theme}</strong>
            </span>
          </div>

          {/* TV Camera Frame Container */}
          <div
            className={`relative w-full h-80 rounded-xl overflow-hidden flex flex-col items-center justify-start p-6 border border-cyan-400/30 shadow-inner ${
              settings.chromaMode === 'green'
                ? 'bg-[#00FF00]'
                : settings.chromaMode === 'blue'
                ? 'bg-[#0000FF]'
                : 'bg-gradient-to-b from-sky-950/90 via-blue-950/95 to-slate-950'
            }`}
            style={{
              backgroundImage:
                settings.chromaMode === 'transparent'
                  ? 'radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.15) 0%, rgba(15, 23, 42, 0.85) 100%)'
                  : undefined,
            }}
          >
            {/* Camera feed placeholder grid lines */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#38bdf8_1px,transparent_1px),linear-gradient(to_bottom,#38bdf8_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

            {/* Scorebug Graphics Element based on Theme */}
            <div
              className="relative z-10 transition-transform duration-200"
              style={{ transform: `scale(${settings.scalePercent / 100})` }}
            >
              {/* THEME 1: OLYMPIC RIBBON */}
              {settings.theme === 'olympic' && (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-14 rounded-2xl bg-gradient-to-r from-sky-950 via-blue-900 to-indigo-950 border-2 border-cyan-300/60 shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex items-center overflow-hidden font-mono">
                    {/* White Team */}
                    <div className="flex items-center px-4 gap-3 bg-white/10 h-full border-r border-cyan-400/20">
                      <span className="w-3.5 h-3.5 rounded-full bg-white shadow-md shadow-white/50" />
                      <span className="font-black text-sm text-white tracking-wider">
                        {currentGameState.teamWhiteName.toUpperCase()}
                      </span>
                      <span className="text-2xl font-black text-white px-2.5 py-0.5 rounded-lg bg-sky-950/80 border border-white/20">
                        {currentGameState.scoreWhite}
                      </span>
                    </div>

                    {/* Period Badge */}
                    <div className="px-3 bg-sky-950 text-xs font-black text-cyan-300 h-full flex items-center border-r border-cyan-400/20">
                      P{currentGameState.period}
                    </div>

                    {/* Dark Team */}
                    <div className="flex items-center px-4 gap-3 bg-blue-900/40 h-full border-r border-cyan-400/20">
                      <span className="text-2xl font-black text-cyan-300 px-2.5 py-0.5 rounded-lg bg-sky-950/80 border border-cyan-400/30">
                        {currentGameState.scoreDark}
                      </span>
                      <span className="font-black text-sm text-cyan-200 tracking-wider">
                        {currentGameState.teamDarkName.toUpperCase()}
                      </span>
                      <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-md shadow-cyan-400/50" />
                    </div>

                    {/* Game Clock */}
                    <div className="px-4 text-cyan-300 text-lg font-black bg-sky-950/90 h-full flex items-center border-r border-cyan-400/20">
                      {formatMinSec(currentGameState.gameTimeMs)}
                    </div>

                    {/* Shot Clock (Rule WP 20.15) */}
                    {settings.showShotClock && (
                      <div
                        className={`px-4 text-xl font-black h-full flex items-center ${
                          isBlanked
                            ? 'text-sky-600 bg-sky-950'
                            : shotSec <= 5
                            ? 'text-rose-400 bg-rose-950/80 animate-pulse'
                            : 'text-amber-300 bg-amber-950/60'
                        }`}
                      >
                        :{isBlanked ? '--' : shotSec.toString().padStart(2, '0')}
                      </div>
                    )}
                  </div>

                  {/* Power-Play Sub-Bar */}
                  {settings.showPowerPlay && currentGameState.exclusions.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-rose-600/90 border border-rose-300/50 text-xs font-mono font-bold text-white shadow-lg animate-pulse">
                      <span>⚡ POWER PLAY:</span>
                      {currentGameState.exclusions.map((e) => (
                        <span key={e.id} className="bg-rose-950/70 px-2 py-0.5 rounded">
                          {e.team === 'white' ? currentGameState.teamWhiteName : currentGameState.teamDarkName} #
                          {e.cap} ({e.remaining.toFixed(0)}s)
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Sponsor Banner */}
                  {settings.showSponsorBanner && (
                    <div className="text-[11px] font-mono text-cyan-300/80 tracking-widest uppercase bg-sky-950/60 px-3 py-0.5 rounded-full border border-cyan-400/20">
                      {settings.sponsorText}
                    </div>
                  )}
                </div>
              )}

              {/* THEME 2: ESPN LOWER-THIRD */}
              {settings.theme === 'espn' && (
                <div className="flex flex-col items-center gap-1.5 font-sans">
                  <div className="h-12 bg-slate-900 border-b-4 border-red-600 shadow-2xl flex items-center rounded-lg overflow-hidden border border-slate-700">
                    <div className="bg-red-600 px-3 h-full flex items-center font-black text-white text-xs tracking-wider">
                      LIVE
                    </div>
                    <div className="flex items-center px-4 gap-2 bg-slate-800 h-full font-bold text-white text-sm">
                      <span>{currentGameState.teamWhiteName}</span>
                      <span className="font-mono text-lg font-black bg-slate-950 px-2 py-0.5 rounded text-yellow-400">
                        {currentGameState.scoreWhite}
                      </span>
                    </div>
                    <div className="flex items-center px-4 gap-2 bg-slate-900 h-full font-bold text-white text-sm border-l border-slate-700">
                      <span className="font-mono text-lg font-black bg-slate-950 px-2 py-0.5 rounded text-yellow-400">
                        {currentGameState.scoreDark}
                      </span>
                      <span>{currentGameState.teamDarkName}</span>
                    </div>
                    <div className="px-3 bg-slate-950 text-sky-400 font-mono font-bold text-xs h-full flex items-center border-l border-slate-700">
                      Q{currentGameState.period} &bull; {formatMinSec(currentGameState.gameTimeMs)}
                    </div>
                    {settings.showShotClock && (
                      <div className="px-3 bg-red-950 text-red-400 font-mono font-bold text-sm h-full flex items-center border-l border-slate-700">
                        SHOT :{isBlanked ? '--' : shotSec}
                      </div>
                    )}
                  </div>
                  {settings.showSponsorBanner && (
                    <div className="bg-slate-900/90 text-[10px] font-bold text-slate-300 px-4 py-0.5 rounded border border-slate-700">
                      {settings.sponsorText}
                    </div>
                  )}
                </div>
              )}

              {/* THEME 3: HUDL STREAM PILL */}
              {settings.theme === 'hudl' && (
                <div className="flex items-center bg-slate-950/90 rounded-full p-1.5 border-2 border-cyan-400 shadow-2xl font-mono text-xs">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white text-slate-950 rounded-full font-black">
                    <span>{currentGameState.teamWhiteName.substring(0, 3).toUpperCase()}</span>
                    <span className="text-sm">{currentGameState.scoreWhite}</span>
                  </div>
                  <span className="px-2 text-cyan-300 font-bold">vs</span>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-full font-black">
                    <span className="text-sm">{currentGameState.scoreDark}</span>
                    <span>{currentGameState.teamDarkName.substring(0, 3).toUpperCase()}</span>
                  </div>
                  <div className="px-3 text-cyan-300 font-bold">
                    P{currentGameState.period} &bull; {formatMinSec(currentGameState.gameTimeMs)}
                  </div>
                  {settings.showShotClock && (
                    <div className="px-2.5 py-1 bg-amber-500 text-slate-950 font-black rounded-full">
                      :{isBlanked ? '--' : shotSec}
                    </div>
                  )}
                </div>
              )}

              {/* THEME 4: MINIMAL CORNER BUG */}
              {settings.theme === 'minimal' && (
                <div className="bg-slate-950/80 backdrop-blur-md rounded-xl p-3 border border-white/20 shadow-xl font-mono text-xs flex flex-col gap-1 w-52">
                  <div className="flex justify-between items-center text-white font-bold">
                    <span>{currentGameState.teamWhiteName}</span>
                    <span className="text-base font-black text-cyan-300">{currentGameState.scoreWhite}</span>
                  </div>
                  <div className="flex justify-between items-center text-white font-bold">
                    <span>{currentGameState.teamDarkName}</span>
                    <span className="text-base font-black text-cyan-300">{currentGameState.scoreDark}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-sky-400 border-t border-white/10 pt-1">
                    <span>PERIOD {currentGameState.period}</span>
                    <span>{formatMinSec(currentGameState.gameTimeMs)}</span>
                    <span className="text-amber-300">:{isBlanked ? '--' : shotSec}</span>
                  </div>
                </div>
              )}

              {/* Goal Splash Animation Trigger */}
              {testGoalSplash && (
                <div className="mt-4 px-6 py-2 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-600 to-amber-500 text-white font-black text-lg tracking-wider uppercase shadow-2xl animate-bounce border-2 border-white">
                  ⚡ GOAL! {currentGameState.teamWhiteName.toUpperCase()} CAP #4
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Configuration Matrix */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Graphics Theme & Layout */}
          <div className="bg-sky-950/60 backdrop-blur-md border border-cyan-400/30 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <h2 className="text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
              <span>🎨</span> Graphic Overlay Theme & Style
            </h2>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'olympic', label: 'Olympic Ribbon', desc: 'Aquatic glass & gold' },
                { id: 'espn', label: 'ESPN Lower-Third', desc: 'Modern sports ticker' },
                { id: 'hudl', label: 'Hudl Stream Pill', desc: 'Compact high-school pill' },
                { id: 'minimal', label: 'Minimal Bug', desc: 'Corner floating widget' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleUpdate({ theme: t.id as BroadcastTheme })}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    settings.theme === t.id
                      ? 'bg-cyan-500/30 text-white border-cyan-400 shadow-md shadow-cyan-950 font-black'
                      : 'bg-sky-900/30 text-sky-300/70 border-sky-800 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="text-xs font-bold">{t.label}</div>
                  <div className="text-[10px] text-cyan-400/80 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>

            {/* Chroma Key Selector */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-cyan-400/20">
              <label className="text-xs font-bold text-sky-200 uppercase tracking-wider">
                Chroma Key / Background Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'transparent', label: 'Transparent Alpha', color: 'bg-slate-800' },
                  { id: 'green', label: 'Green Screen (#00FF00)', color: 'bg-green-600' },
                  { id: 'blue', label: 'Blue Screen (#0000FF)', color: 'bg-blue-600' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleUpdate({ chromaMode: c.id as ChromaMode })}
                    className={`p-2 rounded-lg text-xs font-bold text-center border transition-all ${
                      settings.chromaMode === c.id
                        ? 'bg-cyan-500/40 text-white border-cyan-400 shadow-sm'
                        : 'bg-sky-950/40 text-sky-300/70 border-sky-800'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scale Slider */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-cyan-400/20">
              <div className="flex justify-between items-center text-xs font-bold text-sky-200">
                <span className="uppercase tracking-wider">Overlay Graphic Scale</span>
                <span className="font-mono text-cyan-300">{settings.scalePercent}%</span>
              </div>
              <input
                type="range"
                min="75"
                max="125"
                step="5"
                value={settings.scalePercent}
                onChange={(e) => handleUpdate({ scalePercent: parseInt(e.target.value) })}
                className="w-full h-2 bg-sky-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>

          {/* Broadcast Elements & Features */}
          <div className="bg-sky-950/60 backdrop-blur-md border border-cyan-400/30 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <h2 className="text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
              <span>⚡</span> Broadcast Display Elements & Toggles
            </h2>

            {/* Toggle Power-Play Sub-Bar */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-sky-900/40 border border-cyan-400/20">
              <div>
                <div className="text-sm font-bold text-white">Power-Play Exclusion Tracker</div>
                <div className="text-xs text-sky-300/80">Shows 20s penalties & cap numbers below scorebug</div>
              </div>
              <button
                onClick={() => handleUpdate({ showPowerPlay: !settings.showPowerPlay })}
                className={`px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider transition-all border ${
                  settings.showPowerPlay
                    ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/50'
                    : 'bg-slate-500/30 text-slate-300 border-slate-400/50'
                }`}
              >
                {settings.showPowerPlay ? 'Active' : 'Off'}
              </button>
            </div>

            {/* Toggle Shot Clock */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-sky-900/40 border border-cyan-400/20">
              <div>
                <div className="text-sm font-bold text-white">Shot Clock & WP 20.15 Auto-Blanking</div>
                <div className="text-xs text-sky-300/80">Includes warning colors under 5 seconds</div>
              </div>
              <button
                onClick={() => handleUpdate({ showShotClock: !settings.showShotClock })}
                className={`px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider transition-all border ${
                  settings.showShotClock
                    ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400/50'
                    : 'bg-slate-500/30 text-slate-300 border-slate-400/50'
                }`}
              >
                {settings.showShotClock ? 'Active' : 'Off'}
              </button>
            </div>

            {/* Sponsor Text Input */}
            <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-sky-900/40 border border-cyan-400/20">
              <div className="flex justify-between items-center text-xs font-bold text-sky-200 uppercase tracking-wider">
                <span>Sponsor / Tournament Headline Banner</span>
                <button
                  onClick={() => handleUpdate({ showSponsorBanner: !settings.showSponsorBanner })}
                  className="text-[10px] text-cyan-300 hover:underline"
                >
                  {settings.showSponsorBanner ? 'Hide Banner' : 'Show Banner'}
                </button>
              </div>
              <input
                type="text"
                value={settings.sponsorText}
                onChange={(e) => handleUpdate({ sponsorText: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-sky-950 border border-cyan-400/30 text-xs text-white outline-none focus:border-cyan-300"
                placeholder="e.g. CIF State Finals • Live on PoloStream"
              />
            </div>

            {/* Interactive Testing Button */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={triggerMockGoalSplash}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all"
              >
                ⚡ Trigger Goal Splash Banner
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
