import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Undo2,
  Bluetooth,
  Shield,
  Clock,
  Compass,
  Trophy,
  Users,
  Settings,
  Eye,
  EyeOff,
  Maximize2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Zap,
  Timer,
  AlertTriangle,
} from 'lucide-react';
import { bleManager, BleConnectionStatus } from '../engine/bluetooth-manager';
import { phoneHaptics } from '../engine/phone-haptics';
import { SixEightPlayer, SixEightMatchPreset } from '../engine/six-eight-sports';

export interface PhoneConsoleProps {
  gameTimeMs: number;
  shotTimeMs: number;
  period: number;
  isRunning: boolean;
  isBlanked: boolean;
  scoreWhite: number;
  scoreDark: number;
  teamWhiteName: string;
  teamDarkName: string;
  protocol: 'cts' | 'daktronics';
  enable20sReset: boolean;
  onToggle20sReset?: () => void;
  bleStatus: BleConnectionStatus;
  bleDeviceName: string;
  bleError: string | null;
  exclusions: Array<{ id: string; team: 'white' | 'dark'; cap: number; remaining: number }>;
  undoStackLength: number;
  whiteRoster: SixEightPlayer[];
  darkRoster: SixEightPlayer[];
  activeTimeout: { team: 'white' | 'dark'; type: '60s' | '30s'; remainingMs: number; warned15s: boolean } | null;
  onToggleStartStop: () => void;
  onReset30: () => void;
  onReset20: () => void;
  onAdjustGameTime: (deltaSeconds: number) => void;
  onAdjustShotTime: (deltaSeconds: number) => void;
  onFireHorn: (durationMs?: number) => void;
  onUndo: () => void;
  onScoreDelta: (team: 'white' | 'dark', delta: number) => void;
  onSetPeriod: (period: number) => void;
  onAddExclusion: (team: 'white' | 'dark', cap: number) => void;
  onReleaseExclusion: (id: string) => void;
  onStartTimeout: (team: 'white' | 'dark', type: '60s' | '30s') => void;
  onEndTimeout: () => void;
  onToggleBle: () => void;
  onSwitchToDesktopMode: () => void;
  onOpenAutoFinder: () => void;
}

export default function PhoneConsole(props: PhoneConsoleProps) {
  const {
    gameTimeMs,
    shotTimeMs,
    period,
    isRunning,
    isBlanked,
    scoreWhite,
    scoreDark,
    teamWhiteName,
    teamDarkName,
    protocol,
    enable20sReset,
    onToggle20sReset,
    bleStatus,
    bleDeviceName,
    bleError,
    exclusions,
    undoStackLength,
    whiteRoster,
    darkRoster,
    activeTimeout,
    onToggleStartStop,
    onReset30,
    onReset20,
    onAdjustGameTime,
    onAdjustShotTime,
    onFireHorn,
    onUndo,
    onScoreDelta,
    onSetPeriod,
    onAddExclusion,
    onReleaseExclusion,
    onStartTimeout,
    onEndTimeout,
    onToggleBle,
    onSwitchToDesktopMode,
    onOpenAutoFinder,
  } = props;

  // Viewport Orientation Tracking (Portrait vs Landscape on Phone)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    }
    return 'portrait';
  });

  // Mobile Bottom Navigation Tab
  const [mobileTab, setMobileTab] = useState<'deck' | 'fouls' | 'timeouts' | 'adjust'>('deck');

  // Cap Modal Ejection Sheet
  const [capModalTeam, setCapModalTeam] = useState<'white' | 'dark' | null>(null);

  // Screen Wake-Lock state
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Auto-request screen wake-lock on mount
  useEffect(() => {
    phoneHaptics.requestWakeLock().then((active) => setWakeLockActive(active));
    const onVisibility = () => {
      phoneHaptics.handleVisibilityChange();
      setWakeLockActive(phoneHaptics.isWakeLockActive());
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      phoneHaptics.releaseWakeLock();
    };
  }, []);

  const toggleWakeLock = async () => {
    phoneHaptics.trigger('tap');
    if (wakeLockActive) {
      await phoneHaptics.releaseWakeLock();
      setWakeLockActive(false);
    } else {
      const ok = await phoneHaptics.requestWakeLock();
      setWakeLockActive(ok);
    }
  };

  // Format Helpers
  const formatTime = (ms: number): string => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);
    if (mins === 0 && totalSec < 60) {
      return `${secs}.${tenths}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const shotSec = Math.max(0, Math.ceil(shotTimeMs / 1000));
  const shotDisplay = isBlanked ? '--' : shotSec.toString();

  const handleStartStop = () => {
    phoneHaptics.trigger(isRunning ? 'stop' : 'start');
    onToggleStartStop();
  };

  const handleReset30 = () => {
    phoneHaptics.trigger('reset30');
    onReset30();
  };

  const handleReset20 = () => {
    phoneHaptics.trigger('reset20');
    onReset20();
  };

  const handleHorn = () => {
    phoneHaptics.trigger('horn');
    onFireHorn(1200);
  };

  const handleUndoWithHaptic = () => {
    phoneHaptics.trigger('undo');
    onUndo();
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-between select-none overflow-hidden touch-manipulation pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      
      {/* ======================================================== */}
      {/* 1. TOP MOBILE MASTHEAD (COMPACT STATUS & CONTROLS)       */}
      {/* ======================================================== */}
      <div className="bg-sky-950/85 backdrop-blur-md border-b border-cyan-400/30 px-3 py-1.5 flex items-center justify-between text-xs z-20">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleBle}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-bold text-[10px] border transition cursor-pointer ${
              bleStatus === 'connected'
                ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/50 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                : bleStatus === 'connecting'
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 animate-pulse'
                : 'bg-cyan-500/15 text-cyan-200 border-cyan-400/35'
            }`}
          >
            <Bluetooth size={10} className={bleStatus === 'connected' ? 'text-emerald-300' : 'text-cyan-300'} />
            <span className="truncate max-w-[90px]">
              {bleStatus === 'connected' ? (bleDeviceName || 'PB-PRO') : 'PAIR BLE'}
            </span>
          </button>

          <span className="px-1.5 py-0.5 rounded bg-sky-900/80 border border-cyan-400/25 font-mono text-[9px] text-cyan-200 font-bold uppercase">
            {protocol === 'cts' ? 'CTS 9600' : 'DAKT 19200'}
          </span>
        </div>

        {/* Center: Ruleset Toggle (NCAA 20s/30s vs NFHS 30s Only) */}
        {onToggle20sReset ? (
          <button
            onClick={() => {
              phoneHaptics.trigger('tap');
              onToggle20sReset();
            }}
            className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
              enable20sReset
                ? 'bg-amber-400/25 text-amber-200 border-amber-300/40 hover:bg-amber-400/35'
                : 'bg-emerald-400/25 text-emerald-200 border-emerald-300/40 hover:bg-emerald-400/35'
            }`}
            title="Tap to toggle: NCAA (20s & 30s Resets) vs NFHS High School (30s Reset Only)"
          >
            <span>{enable20sReset ? 'NCAA 20s/30s' : 'NFHS 30s ONLY'}</span>
          </button>
        ) : (
          <div className="hidden xs:flex items-center gap-1 text-[10px] font-mono text-cyan-200/90 font-bold">
            <span>{enable20sReset ? 'NCAA 20s' : 'HS 30s'}</span>
          </div>
        )}

        {/* Right Tools: Auto-Finder, WakeLock & Switch to iPad */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { phoneHaptics.trigger('tap'); onOpenAutoFinder(); }}
            className="p-1 rounded-lg bg-sky-900/80 hover:bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 text-[10px] flex items-center gap-1 cursor-pointer"
            title="1-Click Scoreboard Auto-Finder"
          >
            <Compass size={12} className="text-cyan-300" />
            <span className="hidden sm:inline font-mono">Scan</span>
          </button>

          <button
            onClick={toggleWakeLock}
            className={`p-1 rounded-lg border text-[10px] transition cursor-pointer flex items-center gap-1 ${
              wakeLockActive
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40 shadow-sm'
                : 'bg-sky-900/80 text-sky-300 border-cyan-400/20 opacity-70'
            }`}
            title={wakeLockActive ? 'Screen Wake-Lock Active (Screen will not dim)' : 'Screen Wake-Lock Off'}
          >
            {wakeLockActive ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>

          <button
            onClick={() => { phoneHaptics.trigger('tap'); onSwitchToDesktopMode(); }}
            className="p-1 rounded-lg bg-sky-900/80 hover:bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 text-[10px] flex items-center gap-1 cursor-pointer"
            title="Switch to 10.9-inch iPad Full Varsity Desk View"
          >
            <Maximize2 size={12} className="text-cyan-300" />
            <span className="hidden sm:inline font-mono">iPad</span>
          </button>
        </div>
      </div>

      {/* Active Timeout Emergency Alert Banner */}
      {activeTimeout && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 px-3 py-1.5 flex items-center justify-between text-xs font-mono font-black animate-pulse shadow-md">
          <div className="flex items-center gap-2">
            <Timer size={14} className="text-white" />
            <span>
              {activeTimeout.type} TIMEOUT &bull; {activeTimeout.team === 'white' ? teamWhiteName : teamDarkName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tabular-nums text-white">
              {(activeTimeout.remainingMs / 1000).toFixed(1)}s
            </span>
            <button
              onClick={() => { phoneHaptics.trigger('tap'); onEndTimeout(); }}
              className="px-2 py-0.5 rounded bg-white text-sky-950 text-[10px] font-bold"
            >
              END
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MAIN ACTIVE VIEWPORT: PORTRAIT OR LANDSCAPE           */}
      {/* ======================================================== */}
      {orientation === 'portrait' ? (
        /* ---------------------------------------------------- */
        /* PORTRAIT ONE-HAND POCKET CONTROLLER                  */
        /* ---------------------------------------------------- */
        <div className="flex-1 flex flex-col justify-between p-2.5 sm:p-3 gap-2 overflow-y-auto">
          
          {/* A. Period Selector Pill Bar */}
          <div className="flex items-center justify-between gap-1 bg-sky-950/70 p-1 rounded-xl border border-cyan-400/30 text-xs font-mono font-bold">
            <span className="text-[10px] text-cyan-300 uppercase px-1">Period:</span>
            {[1, 2, 3, 4, 5, 6, 7].map((p) => {
              const label = p <= 4 ? `Q${p}` : p === 5 ? 'OT1' : p === 6 ? 'OT2' : 'PSO';
              const active = period === p;
              return (
                <button
                  key={p}
                  onClick={() => { phoneHaptics.trigger('tap'); onSetPeriod(p); }}
                  className={`flex-1 py-1 rounded-lg text-center text-xs font-black transition cursor-pointer ${
                    active
                      ? 'bg-cyan-400 text-sky-950 shadow-md font-extrabold'
                      : 'text-cyan-200/80 hover:text-white hover:bg-sky-800/60'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* B. Hero Dual Olympic Bezel Clocks */}
          <div className="grid grid-cols-2 gap-2 bg-gradient-to-b from-sky-950/95 via-blue-950/90 to-indigo-950/90 border-2 border-cyan-400/40 rounded-2xl p-2.5 shadow-xl">
            {/* Game Clock */}
            <div className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-sky-900/40 border border-cyan-400/20">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider text-cyan-300">
                GAME CLOCK
              </span>
              <div className="text-4xl sm:text-5xl font-black font-mono text-amber-300 tracking-tight tabular-nums mt-0.5 drop-shadow-[0_0_12px_rgba(251,191,36,0.3)]">
                {formatTime(gameTimeMs)}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <button
                  onClick={() => { phoneHaptics.trigger('tap'); onAdjustGameTime(-1); }}
                  className="px-2 py-0.5 rounded bg-sky-950/80 hover:bg-sky-800 text-[10px] font-mono text-cyan-200 border border-cyan-400/25"
                >
                  -1s
                </button>
                <button
                  onClick={() => { phoneHaptics.trigger('tap'); onAdjustGameTime(1); }}
                  className="px-2 py-0.5 rounded bg-sky-950/80 hover:bg-sky-800 text-[10px] font-mono text-cyan-200 border border-cyan-400/25"
                >
                  +1s
                </button>
                <button
                  onClick={() => { phoneHaptics.trigger('tap'); onAdjustGameTime(60); }}
                  className="px-2 py-0.5 rounded bg-sky-950/80 hover:bg-sky-800 text-[10px] font-mono text-cyan-200 border border-cyan-400/25"
                >
                  +1m
                </button>
              </div>
            </div>

            {/* Shot Clock */}
            <div className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-sky-900/40 border border-cyan-400/20">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider text-rose-300">
                {isBlanked ? 'WP 20.15 BLANK' : 'SHOT CLOCK'}
              </span>
              <div
                className={`text-4xl sm:text-5xl font-black font-mono tracking-tight tabular-nums mt-0.5 drop-shadow-[0_0_12px_rgba(244,63,94,0.35)] ${
                  isBlanked
                    ? 'text-cyan-300/40'
                    : shotSec <= 5
                    ? 'text-rose-400 animate-pulse'
                    : 'text-rose-400'
                }`}
              >
                {shotDisplay}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <button
                  onClick={() => { phoneHaptics.trigger('tap'); onAdjustShotTime(-1); }}
                  className="px-2 py-0.5 rounded bg-sky-950/80 hover:bg-sky-800 text-[10px] font-mono text-rose-200 border border-rose-400/25"
                >
                  -1s
                </button>
                <button
                  onClick={() => { phoneHaptics.trigger('tap'); onAdjustShotTime(1); }}
                  className="px-2 py-0.5 rounded bg-sky-950/80 hover:bg-sky-800 text-[10px] font-mono text-rose-200 border border-rose-400/25"
                >
                  +1s
                </button>
              </div>
            </div>
          </div>

          {/* C. Live Scoreboard Strip */}
          <div className="grid grid-cols-2 gap-2">
            {/* White Team */}
            <div className="p-2 rounded-xl bg-sky-950/80 border border-cyan-400/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-black uppercase text-cyan-200 block truncate max-w-[90px]">
                  ⚪ {teamWhiteName}
                </span>
                <span className="text-2xl font-black font-mono text-white tabular-nums">
                  {scoreWhite}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { phoneHaptics.trigger('tap'); onScoreDelta('white', -1); }}
                  className="w-7 h-7 rounded-lg bg-sky-900 hover:bg-sky-800 border border-cyan-400/30 text-xs font-black text-cyan-200 flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <button
                  onClick={() => { phoneHaptics.trigger('tap'); onScoreDelta('white', 1); }}
                  className="w-8 h-8 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-sky-950 font-black text-sm flex items-center justify-center shadow cursor-pointer"
                >
                  +1
                </button>
              </div>
            </div>

            {/* Dark Team */}
            <div className="p-2 rounded-xl bg-sky-950/80 border border-cyan-400/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-black uppercase text-amber-200 block truncate max-w-[90px]">
                  🔵 {teamDarkName}
                </span>
                <span className="text-2xl font-black font-mono text-white tabular-nums">
                  {scoreDark}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { phoneHaptics.trigger('tap'); onScoreDelta('dark', -1); }}
                  className="w-7 h-7 rounded-lg bg-sky-900 hover:bg-sky-800 border border-cyan-400/30 text-xs font-black text-amber-200 flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <button
                  onClick={() => { phoneHaptics.trigger('tap'); onScoreDelta('dark', 1); }}
                  className="w-8 h-8 rounded-lg bg-amber-400 hover:bg-amber-300 text-sky-950 font-black text-sm flex items-center justify-center shadow cursor-pointer"
                >
                  +1
                </button>
              </div>
            </div>
          </div>

          {/* D. Active Exclusions Mini-Ticker (if any 20s penalties active) */}
          {exclusions.length > 0 && (
            <div className="bg-sky-950/90 border border-amber-400/40 rounded-xl p-1.5 flex items-center justify-between text-xs font-mono">
              <span className="text-[10px] text-amber-300 font-bold uppercase">
                20s Exclusions ({exclusions.length}):
              </span>
              <div className="flex items-center gap-2 overflow-x-auto">
                {exclusions.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => { phoneHaptics.trigger('tap'); onReleaseExclusion(e.id); }}
                    className="px-2 py-0.5 rounded-md bg-rose-500/30 hover:bg-rose-500/50 border border-rose-400/50 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
                    title="Click to release (Re-entry on Goal/Turnover)"
                  >
                    <span>{e.team === 'white' ? '⚪' : '🔵'} #{e.cap}</span>
                    <span className="text-amber-200 font-black">{e.remaining}s</span>
                    <span className="text-[9px] opacity-75">✕</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* E. HERO START / STOP PLUNGER (MASSIVE FULL-WIDTH BEZEL) */}
          <button
            onClick={handleStartStop}
            className={`w-full min-h-[78px] xs:min-h-[86px] rounded-2xl p-4 flex items-center justify-center gap-3 border-t-2 border-white/50 shadow-2xl transition-all select-none cursor-pointer ${
              isRunning
                ? 'bg-gradient-to-b from-rose-500 via-red-500 to-red-700 shadow-[0_8px_0_#881337,0_16px_30px_rgba(244,63,94,0.45)] active:translate-y-1.5'
                : 'bg-gradient-to-b from-emerald-400 via-teal-500 to-emerald-600 shadow-[0_8px_0_#065f46,0_16px_30px_rgba(16,185,129,0.45)] active:translate-y-1.5'
            }`}
          >
            {isRunning ? (
              <Pause size={32} className="fill-white text-white shrink-0" />
            ) : (
              <Play size={32} className="fill-white text-white translate-x-0.5 shrink-0" />
            )}
            <div className="text-left font-mono">
              <div className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {isRunning ? 'PAUSE CLOCK' : 'START CLOCK'}
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-white/90 uppercase tracking-widest">
                {isRunning ? 'Whistle Stop &bull; In Play' : 'Tap to Start &bull; Ball In Play'}
              </div>
            </div>
          </button>

          {/* F. DYNAMIC SHOT RESET PLUNGER(S) — 20s GOES AWAY IN 30s ONLY MODE */}
          {enable20sReset ? (
            <div className="grid grid-cols-2 gap-2 min-h-[84px] xs:min-h-[92px]">
              {/* 30s Full Reset Plunger */}
              <button
                onClick={handleReset30}
                className="rounded-2xl p-3 flex flex-col items-center justify-center gap-1 border-t-2 border-white/60 bg-gradient-to-b from-teal-300 via-emerald-400 to-emerald-600 text-sky-950 shadow-[0_6px_0_#115e59,0_12px_20px_rgba(16,185,129,0.3)] active:translate-y-1 transition cursor-pointer"
              >
                <div className="text-2xl sm:text-3xl font-black font-mono leading-none">
                  30s RESET
                </div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-tight text-sky-950/90 text-center leading-none">
                  Turnover &bull; Goal
                </div>
              </button>

              {/* 20s Rebound / Exclusion Reset Plunger */}
              <button
                onClick={handleReset20}
                className="rounded-2xl p-3 flex flex-col items-center justify-center gap-1 border-t-2 border-white/60 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 text-sky-950 shadow-[0_6px_0_#92400e,0_12px_20px_rgba(245,158,11,0.3)] active:translate-y-1 transition cursor-pointer"
              >
                <div className="text-2xl sm:text-3xl font-black font-mono leading-none">
                  20s RESET
                </div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-tight text-sky-950/90 text-center leading-none">
                  Rebound &bull; Excl
                </div>
              </button>
            </div>
          ) : (
            /* SINGLE GIANT FULL-WIDTH 30s PLUNGER (HIGH SCHOOL NFHS MODE — 20s GOES AWAY) */
            <button
              onClick={handleReset30}
              className="w-full min-h-[84px] xs:min-h-[92px] rounded-2xl p-3.5 flex items-center justify-between px-5 border-t-2 border-white/60 bg-gradient-to-b from-teal-300 via-emerald-400 to-emerald-600 text-sky-950 shadow-[0_6px_0_#115e59,0_14px_24px_rgba(16,185,129,0.35)] active:translate-y-1 transition cursor-pointer"
            >
              <div className="flex flex-col text-left">
                <div className="text-2xl sm:text-3xl font-black font-mono leading-none">
                  30s FULL RESET
                </div>
                <div className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-tight text-sky-950/90 mt-1">
                  Turnover &bull; Goal &bull; All Resets 30s
                </div>
              </div>
              <span className="text-[10px] font-mono font-extrabold uppercase px-2.5 py-1 rounded-full bg-sky-950/20 border border-sky-950/30">
                NFHS 30s ONLY
              </span>
            </button>
          )}

          {/* G. QUICK ACTION BAR: HORN, EXCLUSION, TIMEOUT, UNDO */}
          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
            <button
              onClick={handleHorn}
              className="py-2.5 rounded-xl bg-gradient-to-b from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-mono font-black text-xs shadow-md border-t border-rose-300/40 flex flex-col items-center justify-center gap-0.5 cursor-pointer active:translate-y-0.5"
            >
              <Volume2 size={16} />
              <span className="text-[10px] uppercase">Horn</span>
            </button>

            <button
              onClick={() => { phoneHaptics.trigger('tap'); setCapModalTeam('dark'); }}
              className="py-2.5 rounded-xl bg-sky-900 hover:bg-sky-800 text-cyan-200 border border-cyan-400/30 font-mono font-bold text-xs flex flex-col items-center justify-center gap-0.5 cursor-pointer active:translate-y-0.5"
            >
              <Shield size={16} className="text-amber-300" />
              <span className="text-[10px] uppercase">Excl 20s</span>
            </button>

            <button
              onClick={() => {
                phoneHaptics.trigger('tap');
                onStartTimeout('white', '60s');
              }}
              className="py-2.5 rounded-xl bg-sky-900 hover:bg-sky-800 text-cyan-200 border border-cyan-400/30 font-mono font-bold text-xs flex flex-col items-center justify-center gap-0.5 cursor-pointer active:translate-y-0.5"
            >
              <Timer size={16} className="text-cyan-300" />
              <span className="text-[10px] uppercase">Time-Out</span>
            </button>

            <button
              onClick={handleUndoWithHaptic}
              disabled={undoStackLength === 0}
              className="py-2.5 rounded-xl bg-sky-950 hover:bg-sky-900 text-cyan-200 border border-cyan-400/30 font-mono font-bold text-xs flex flex-col items-center justify-center gap-0.5 disabled:opacity-40 cursor-pointer active:translate-y-0.5"
            >
              <Undo2 size={16} />
              <span className="text-[10px] uppercase">Undo ({undoStackLength})</span>
            </button>
          </div>

        </div>
      ) : (
        /* ---------------------------------------------------- */
        /* LANDSCAPE DUAL-THUMB POCKET CONSOLE                  */
        /* ---------------------------------------------------- */
        <div className="flex-1 grid grid-cols-[140px_1fr_140px] sm:grid-cols-[170px_1fr_170px] gap-2 p-2 overflow-hidden">
          
          {/* Left Thumb Pillar: Start/Stop Plunger + Horn */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleStartStop}
              className={`flex-1 rounded-2xl p-3 flex flex-col items-center justify-center gap-1 border-t-2 border-white/50 shadow-xl transition-all select-none cursor-pointer ${
                isRunning
                  ? 'bg-gradient-to-b from-rose-500 via-red-500 to-red-700 shadow-[0_6px_0_#881337] active:translate-y-1'
                  : 'bg-gradient-to-b from-emerald-400 via-teal-500 to-emerald-600 shadow-[0_6px_0_#065f46] active:translate-y-1'
              }`}
            >
              {isRunning ? <Pause size={36} className="fill-white" /> : <Play size={36} className="fill-white translate-x-1" />}
              <span className="text-xl sm:text-2xl font-black font-mono text-white leading-none">
                {isRunning ? 'STOP' : 'START'}
              </span>
              <span className="text-[9px] font-mono text-white/80 uppercase">
                {isRunning ? 'Whistle' : 'In Play'}
              </span>
            </button>

            <button
              onClick={handleHorn}
              className="py-2.5 rounded-xl bg-gradient-to-b from-rose-500 to-red-600 text-white font-mono font-black text-xs shadow-md border-t border-rose-300/40 flex items-center justify-center gap-1.5 cursor-pointer active:translate-y-0.5"
            >
              <Volume2 size={14} />
              <span>HORN</span>
            </button>
          </div>

          {/* Center Stage: Clocks, Scores & Period */}
          <div className="flex flex-col justify-between gap-1.5 bg-sky-950/85 border border-cyan-400/35 rounded-2xl p-2.5 shadow-xl">
            {/* Period Selector */}
            <div className="flex items-center justify-between gap-1 bg-sky-900/60 p-1 rounded-xl border border-cyan-400/25">
              {[1, 2, 3, 4, 5, 6, 7].map((p) => {
                const label = p <= 4 ? `Q${p}` : p === 5 ? 'OT1' : p === 6 ? 'OT2' : 'PSO';
                const active = period === p;
                return (
                  <button
                    key={p}
                    onClick={() => { phoneHaptics.trigger('tap'); onSetPeriod(p); }}
                    className={`flex-1 py-0.5 rounded-md text-[10px] font-mono font-black transition ${
                      active ? 'bg-cyan-400 text-sky-950 shadow' : 'text-cyan-200/80 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Twin Clocks */}
            <div className="grid grid-cols-2 gap-2 text-center my-auto">
              <div>
                <span className="text-[9px] font-mono uppercase text-cyan-300 font-bold block">
                  GAME CLOCK
                </span>
                <span className="text-3xl sm:text-4xl font-black font-mono text-amber-300 tabular-nums">
                  {formatTime(gameTimeMs)}
                </span>
              </div>
              <div className="border-l border-cyan-400/20">
                <span className="text-[9px] font-mono uppercase text-rose-300 font-bold block">
                  {isBlanked ? 'WP 20.15' : 'SHOT CLOCK'}
                </span>
                <span className={`text-3xl sm:text-4xl font-black font-mono tabular-nums ${isBlanked ? 'text-cyan-200/40' : 'text-rose-400'}`}>
                  {shotDisplay}
                </span>
              </div>
            </div>

            {/* Score Strip */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-cyan-400/20">
              <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-sky-900/50">
                <span className="text-xs font-black truncate max-w-[70px]">⚪ {teamWhiteName}</span>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-black font-mono">{scoreWhite}</span>
                  <button onClick={() => { phoneHaptics.trigger('tap'); onScoreDelta('white', 1); }} className="px-1.5 py-0.5 bg-cyan-400 text-sky-950 rounded text-xs font-black">+</button>
                </div>
              </div>

              <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-sky-900/50">
                <span className="text-xs font-black truncate max-w-[70px]">🔵 {teamDarkName}</span>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-black font-mono">{scoreDark}</span>
                  <button onClick={() => { phoneHaptics.trigger('tap'); onScoreDelta('dark', 1); }} className="px-1.5 py-0.5 bg-amber-400 text-sky-950 rounded text-xs font-black">+</button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Thumb Pillar: Dynamic Shot Reset Plunger(s) + Undo */}
          <div className="flex flex-col gap-2">
            {enable20sReset ? (
              <>
                <button
                  onClick={handleReset30}
                  className="flex-1 rounded-2xl p-2 flex flex-col items-center justify-center gap-0.5 border-t-2 border-white/60 bg-gradient-to-b from-teal-300 to-emerald-600 text-sky-950 shadow-[0_5px_0_#115e59] active:translate-y-1 transition cursor-pointer"
                >
                  <span className="text-lg sm:text-xl font-black font-mono leading-none">30s RESET</span>
                  <span className="text-[9px] font-bold uppercase opacity-85">Turnover</span>
                </button>

                <button
                  onClick={handleReset20}
                  className="flex-1 rounded-2xl p-2 flex flex-col items-center justify-center gap-0.5 border-t-2 border-white/60 bg-gradient-to-b from-amber-300 to-amber-600 text-sky-950 shadow-[0_5px_0_#92400e] active:translate-y-1 transition cursor-pointer"
                >
                  <span className="text-lg sm:text-xl font-black font-mono leading-none">20s RESET</span>
                  <span className="text-[9px] font-bold uppercase opacity-85">Rebound</span>
                </button>
              </>
            ) : (
              /* SINGLE GIANT 30s PLUNGER IN LANDSCAPE WHEN 20s IS DISABLED */
              <button
                onClick={handleReset30}
                className="flex-1 rounded-2xl p-3 flex flex-col items-center justify-center gap-1 border-t-2 border-white/60 bg-gradient-to-b from-teal-300 to-emerald-600 text-sky-950 shadow-[0_5px_0_#115e59] active:translate-y-1 transition cursor-pointer"
              >
                <span className="text-2xl font-black font-mono leading-none">30s RESET</span>
                <span className="text-[9px] font-bold uppercase opacity-85">All Resets 30s</span>
              </button>
            )}

            <button
              onClick={handleUndoWithHaptic}
              disabled={undoStackLength === 0}
              className="py-1.5 rounded-xl bg-sky-950 border border-cyan-400/30 text-cyan-200 text-xs font-mono font-bold flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
            >
              <Undo2 size={12} />
              <span>Undo ({undoStackLength})</span>
            </button>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 3. CAP NUMBER PICKER MODAL (RULE WP 22.3 ENFORCED)       */}
      {/* ======================================================== */}
      {capModalTeam && (
        <div className="fixed inset-0 bg-sky-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-sky-800 to-indigo-950 border-2 border-cyan-300/50 p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-300/30">
              <div>
                <span className="text-xs font-black text-white uppercase tracking-wider block">
                  Select {capModalTeam === 'white' ? teamWhiteName : teamDarkName} Cap #
                </span>
                <span className="text-[10px] font-mono text-cyan-200">
                  Rule WP 22.3 (3-Foul Cap-Out Lock Enforced)
                </span>
              </div>
              <button
                onClick={() => setCapModalTeam(null)}
                className="px-2 py-0.5 rounded bg-white/10 text-cyan-200 text-xs font-mono"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto p-0.5">
              {Array.from({ length: 16 }, (_, i) => i + 1).map((cap) => {
                const roster = capModalTeam === 'white' ? whiteRoster : darkRoster;
                const player = roster.find((p) => p.cap === cap);
                const fouls = player ? player.exclusions : 0;
                const isCappedOut = fouls >= 3;
                return (
                  <button
                    key={cap}
                    disabled={isCappedOut}
                    onClick={() => {
                      phoneHaptics.trigger('tap');
                      onAddExclusion(capModalTeam, cap);
                      setCapModalTeam(null);
                    }}
                    className={`p-2 rounded-xl border font-mono transition flex flex-col items-center justify-between ${
                      isCappedOut
                        ? 'bg-rose-950/80 border-rose-400/60 text-rose-300 opacity-50 cursor-not-allowed'
                        : 'bg-sky-900/70 hover:bg-rose-500 hover:text-white border-cyan-400/30 text-white cursor-pointer active:scale-95'
                    }`}
                  >
                    <span className="text-base font-black leading-none">#{cap}</span>
                    <span className="text-[9px] font-sans truncate max-w-full opacity-90 mt-0.5">
                      {player ? player.name.split(' ')[0] : `Cap ${cap}`}
                    </span>
                    <span
                      className={`text-[8px] px-1 py-0.2 rounded-full mt-0.5 font-bold ${
                        isCappedOut
                          ? 'bg-rose-600 text-white'
                          : fouls >= 2
                          ? 'bg-rose-500/40 text-amber-200'
                          : 'bg-sky-950/60 text-cyan-200'
                      }`}
                    >
                      {isCappedOut ? 'OUT' : `${fouls}/3`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
