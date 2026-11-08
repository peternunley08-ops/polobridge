import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Volume2, Shield, Flag, Tv, 
  Radio, Settings, FileText, Check, Copy, ExternalLink, 
  Plus, Minus, AlertTriangle, Printer, Layers, Clock,
  ArrowRight, Undo2, Award, Zap, Sparkles, Bluetooth, Trophy
} from 'lucide-react';
import MockupsGallery from './components/mockups-gallery';
import SixEightPanel from './components/six-eight-panel';
import { bleManager, BleConnectionStatus } from './engine/bluetooth-manager';
import {
  PRESET_68_MATCHES,
  SixEightMatchPreset,
  SixEightPlayer,
  SixEightGameEvent,
  SixEightEventType,
  SixEightSyncMode,
  sixEightClient,
} from './engine/six-eight-sports';

// --- Web Audio Synthesizer (Pool Horn & Mechanical Clicks) ---
class SoundEngine {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.015);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.015);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.015);
    } catch {
      // Audio fallback
    }
  }

  playHorn(durationMs = 1200) {
    try {
      this.init();
      if (!this.ctx) return;
      const dur = durationMs / 1000;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(265, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(250, this.ctx.currentTime + dur);
      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch {
      // Audio fallback
    }
  }
}

const sounds = new SoundEngine();

// --- Types ---
type Protocol = 'cts' | 'daktronics';
type ActiveTab = 'console' | 'sixeight' | 'mockups' | 'overlay' | 'rack' | 'scoresheet';

interface Exclusion {
  id: string;
  team: 'white' | 'dark';
  cap: number;
  remaining: number;
}

interface ClockSnapshot {
  gameTimeMs: number;
  shotTimeMs: number;
  isRunning: boolean;
}

export default function App() {
  // Navigation & Protocol State
  const [activeTab, setActiveTab] = useState<ActiveTab>('console');
  const [protocol, setProtocol] = useState<Protocol>('cts');

  // Web Bluetooth Dongle Connection State
  const [bleStatus, setBleStatus] = useState<BleConnectionStatus>('disconnected');
  const [bleDeviceName, setBleDeviceName] = useState<string>('');
  const [bleError, setBleError] = useState<string | null>(null);

  // Match Clocks & State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [gameTimeMs, setGameTimeMs] = useState<number>(8 * 60 * 1000); // 8 minutes in ms
  const [shotTimeMs, setShotTimeMs] = useState<number>(30 * 1000);    // 30 seconds in ms
  const [period, setPeriod] = useState<number>(1);
  const [isHornActive, setIsHornActive] = useState<boolean>(false);

  // Teams & Scores
  const [teamWhiteName, setTeamWhiteName] = useState<string>('Stanford');
  const [teamDarkName, setTeamDarkName] = useState<string>('USC');
  const [scoreWhite, setScoreWhite] = useState<number>(11);
  const [scoreDark, setScoreDark] = useState<number>(9);
  const [exclusions, setExclusions] = useState<Exclusion[]>([
    { id: '1', team: 'dark', cap: 4, remaining: 14 }
  ]);

  // Modal for quick cap ejection
  const [showCapModal, setShowCapModal] = useState<'white' | 'dark' | null>(null);

  // Ruleset: High School (NFHS 30s only) vs. College / International (NCAA / World Aquatics 20s reset)
  const [enable20sReset, setEnable20sReset] = useState<boolean>(false); // High school 30s by default

  // 6-8 Sports Live Integration State
  const [sixEightMode, setSixEightMode] = useState<SixEightSyncMode>('cloud_live');
  const [active68Match, setActive68Match] = useState<SixEightMatchPreset>(PRESET_68_MATCHES[0]);
  const [whiteRoster, setWhiteRoster] = useState<SixEightPlayer[]>(PRESET_68_MATCHES[0].whiteRoster);
  const [darkRoster, setDarkRoster] = useState<SixEightPlayer[]>(PRESET_68_MATCHES[0].darkRoster);
  const [sixEightEvents, setSixEightEvents] = useState<SixEightGameEvent[]>([]);

  // Undo History Stack
  const [undoStack, setUndoStack] = useState<ClockSnapshot[]>([]);

  // Bus Monitor Log
  const [busLog, setBusLog] = useState<Array<{ time: string; header: string; ascii: string; protocol: string }>>([]);

  // Subscribe to Web Bluetooth GATT notifications & connection state
  useEffect(() => {
    bleManager.onConnectionChange((status, name, err) => {
      setBleStatus(status);
      if (name) setBleDeviceName(name);
      if (err) setBleError(err);
      else setBleError(null);
    });

    bleManager.onStatusUpdate((pkt) => {
      setIsRunning(pkt.isRunning);
      setIsHornActive(pkt.hornActive);
      setGameTimeMs(pkt.gameTimeMs);
      setShotTimeMs(pkt.shotTimeMs);
      setScoreWhite(pkt.scoreWhite);
      setScoreDark(pkt.scoreDark);
      setPeriod(pkt.period);
      setProtocol(pkt.protocol);
    });
  }, []);

  // Sync score & period updates to physical BLE dongle when paired
  useEffect(() => {
    if (bleStatus === 'connected') {
      bleManager.sendScores(scoreWhite, scoreDark, period);
    }
  }, [scoreWhite, scoreDark, period, bleStatus]);

  const handleToggleBlePair = async () => {
    sounds.playClick();
    if (bleStatus === 'connected') {
      bleManager.disconnect();
    } else {
      await bleManager.connect();
    }
  };

  // Auto-save snapshot before changing clock
  const pushSnapshot = () => {
    setUndoStack(prev => [{ gameTimeMs, shotTimeMs, isRunning }, ...prev.slice(0, 9)]);
  };

  const handleUndo = () => {
    sounds.playClick();
    if (undoStack.length === 0) return;
    const [last, ...rest] = undoStack;
    setGameTimeMs(last.gameTimeMs);
    setShotTimeMs(last.shotTimeMs);
    setIsRunning(last.isRunning);
    setUndoStack(rest);
    bleManager.sendGameClock(last.gameTimeMs);
    bleManager.sendShotClock(last.shotTimeMs);
    if (last.isRunning) bleManager.sendStart();
    else bleManager.sendStop();
  };

  // Start / Stop Toggle
  const toggleStartStop = () => {
    sounds.playClick();
    pushSnapshot();
    setIsRunning(prev => {
      const next = !prev;
      if (next) bleManager.sendStart();
      else bleManager.sendStop();
      return next;
    });
  };

  // Shot Resets
  const reset30 = () => {
    sounds.playClick();
    pushSnapshot();
    setShotTimeMs(30 * 1000);
    bleManager.sendReset30();
  };

  const reset20 = () => {
    sounds.playClick();
    pushSnapshot();
    setShotTimeMs(20 * 1000);
    bleManager.sendReset20();
  };

  const adjustShot = (delta: number) => {
    sounds.playClick();
    pushSnapshot();
    setShotTimeMs(prev => {
      const next = Math.max(0, Math.min(35 * 1000, prev + delta * 1000));
      bleManager.sendShotClock(next);
      return next;
    });
  };

  const fireHornManual = (dur = 1200) => {
    sounds.playHorn(dur);
    setIsHornActive(true);
    bleManager.sendHorn(dur);
    setTimeout(() => setIsHornActive(false), dur);
  };

  // Rule WP 20.15: Automatic Shot Clock Blanking
  const isBlanked = gameTimeMs <= shotTimeMs;

  // Clock Ticker Engine (10Hz / 100ms)
  useEffect(() => {
    const timer = setInterval(() => {
      if (isRunning) {
        // Game Clock
        setGameTimeMs(g => {
          if (g <= 100) {
            setIsRunning(false);
            fireHornManual(2200);
            return 0;
          }
          return g - 100;
        });

        // Shot Clock
        setShotTimeMs(s => {
          if (s <= 100) {
            // Shot clock expired
            if (gameTimeMs > 1000) {
              fireHornManual(1200);
            }
            return 30 * 1000;
          }
          return s - 100;
        });

        // Exclusions
        setExclusions(prev => 
          prev.map(e => ({
            ...e,
            remaining: Math.max(0, e.remaining - 0.1)
          }))
        );
      }
    }, 100);

    return () => clearInterval(timer);
  }, [isRunning, gameTimeMs]);

  // Serial Bus Frame Logger (10Hz Emulation)
  useEffect(() => {
    const busInterval = setInterval(() => {
      const now = new Date().toISOString().substring(11, 23);
      const shotSec = Math.floor(shotTimeMs / 1000);
      
      if (protocol === 'cts') {
        const txt = isBlanked ? '        ' : (shotSec >= 10 ? `   ${shotSec}   ` : `   ${shotSec}.${Math.floor((shotTimeMs % 1000) / 100)}  `);
        const headerByte = '0x8A'; // Channel 0x05 for SC-500
        setBusLog(prev => [{
          time: now,
          header: headerByte,
          ascii: txt,
          protocol: 'CTS'
        }, ...prev.slice(0, 18)]);
      } else {
        const shotTxt = isBlanked ? '   ' : `${String(shotSec).padStart(2, ' ')} `;
        setBusLog(prev => [{
          time: now,
          header: '0x16 0x01 [4498]',
          ascii: `SHOT:${shotTxt} W:${scoreWhite} D:${scoreDark}`,
          protocol: 'DAKT'
        }, ...prev.slice(0, 18)]);
      }
    }, 600);

    return () => clearInterval(busInterval);
  }, [protocol, shotTimeMs, isBlanked, scoreWhite, scoreDark]);

  // Formatted Clock Strings
  const formatMinSecTenths = (ms: number) => {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${tenths}`;
  };

  const formatMinSec = (ms: number) => {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const shotSec = Math.floor(shotTimeMs / 1000);
  const shotTenths = Math.floor((shotTimeMs % 1000) / 100);
  const shotDisplay = isBlanked ? '--' : (shotSec >= 10 ? `${shotSec}` : `${shotSec}.${shotTenths}`);

  // Ejections early release
  const logSixEightEvent = (
    type: SixEightEventType,
    description: string,
    team?: 'white' | 'dark',
    cap?: number,
    playerName?: string,
    overrideWhiteScore?: number,
    overrideDarkScore?: number
  ) => {
    const wScore = overrideWhiteScore ?? scoreWhite;
    const dScore = overrideDarkScore ?? scoreDark;
    const newEvt: SixEightGameEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestampIso: new Date().toISOString(),
      period,
      gameClock: formatMinSecTenths(gameTimeMs),
      shotClock: shotDisplay,
      type,
      team,
      cap,
      playerName,
      scoreSnapshot: `${teamWhiteName} ${wScore} - ${dScore} ${teamDarkName}`,
      description,
      synced: sixEightMode !== 'disconnected',
    };
    setSixEightEvents(prev => [newEvt, ...prev.slice(0, 49)]);
    sixEightClient.dispatchEvent(newEvt, active68Match.gameId, sixEightMode);
  };

  const handleSelect68Match = (preset: SixEightMatchPreset) => {
    sounds.playClick();
    setActive68Match(preset);
    setTeamWhiteName(preset.teamWhiteName);
    setTeamDarkName(preset.teamDarkName);
    setWhiteRoster(preset.whiteRoster);
    setDarkRoster(preset.darkRoster);
    const wGoals = preset.whiteRoster.reduce((acc, p) => acc + p.goals, 0);
    const dGoals = preset.darkRoster.reduce((acc, p) => acc + p.goals, 0);
    setScoreWhite(wGoals);
    setScoreDark(dGoals);
    logSixEightEvent(
      'MATCH_SYNC',
      `Imported 6-8 Sports Match ${preset.gameId}: ${preset.teamWhiteName} vs. ${preset.teamDarkName}`,
      undefined,
      undefined,
      undefined,
      wGoals,
      dGoals
    );
  };

  const handleRecord68Goal = (team: 'white' | 'dark', cap: number) => {
    sounds.playClick();
    const roster = team === 'white' ? whiteRoster : darkRoster;
    const player = roster.find(p => p.cap === cap);
    const pName = player ? player.name : `Cap #${cap}`;
    if (team === 'white') {
      const nextScore = scoreWhite + 1;
      setScoreWhite(nextScore);
      setWhiteRoster(prev => prev.map(p => (p.cap === cap ? { ...p, goals: p.goals + 1 } : p)));
      reset30();
      logSixEightEvent('GOAL', `GOAL by ${teamWhiteName} #${cap} ${pName}`, 'white', cap, pName, nextScore, scoreDark);
    } else {
      const nextScore = scoreDark + 1;
      setScoreDark(nextScore);
      setDarkRoster(prev => prev.map(p => (p.cap === cap ? { ...p, goals: p.goals + 1 } : p)));
      reset30();
      logSixEightEvent('GOAL', `GOAL by ${teamDarkName} #${cap} ${pName}`, 'dark', cap, pName, scoreWhite, nextScore);
    }
  };

  const releaseExclusion = (id: string) => {
    sounds.playClick();
    const target = exclusions.find(e => e.id === id);
    setExclusions(prev => prev.filter(e => e.id !== id));
    if (target) {
      const tName = target.team === 'white' ? teamWhiteName : teamDarkName;
      logSixEightEvent('EXCLUSION_RELEASE', `Early Release (${tName} #${target.cap}) — Re-entry`, target.team, target.cap);
    }
  };

  const addExclusion = (team: 'white' | 'dark', cap: number) => {
    sounds.playClick();
    setExclusions(prev => [...prev, { id: Date.now().toString(), team, cap, remaining: 20 }]);
    setShowCapModal(null);
    if (enable20sReset) {
      reset20(); // Automatic reset to 20s upon exclusion (NCAA / World Aquatics)
    } else {
      reset30(); // NFHS High School: 30s reset on exclusion
    }

    const roster = team === 'white' ? whiteRoster : darkRoster;
    const player = roster.find(p => p.cap === cap);
    const pName = player ? player.name : `Cap #${cap}`;
    const newFoulCount = (player ? player.exclusions : 0) + 1;
    const tName = team === 'white' ? teamWhiteName : teamDarkName;

    if (team === 'white') {
      setWhiteRoster(prev => prev.map(p => (p.cap === cap ? { ...p, exclusions: p.exclusions + 1 } : p)));
    } else {
      setDarkRoster(prev => prev.map(p => (p.cap === cap ? { ...p, exclusions: p.exclusions + 1 } : p)));
    }

    logSixEightEvent(
      'EXCLUSION_20S',
      `20s Exclusion on ${tName} #${cap} ${pName} (${newFoulCount}/3 Personal Fouls${newFoulCount >= 3 ? ' — CAPPED OUT' : ''})`,
      team,
      cap,
      pName
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-900 via-blue-900 to-indigo-950 text-white flex flex-col font-sans selection:bg-cyan-400/30 selection:text-cyan-200">
      
      {/* ======================================================== */}
      {/* 1. PROFESSIONAL AQUATIC MASTHEAD HEADER                  */}
      {/* ======================================================== */}
      <header className="h-14 border-b border-cyan-400/30 bg-gradient-to-r from-sky-900/95 via-blue-900/95 to-indigo-900/95 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-50 shadow-[0_4px_25px_rgba(6,182,212,0.2)]">
        
        {/* Brand & Connection Status */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 via-teal-300 to-amber-300 flex items-center justify-center font-black text-sm text-sky-950 shadow-lg shadow-cyan-400/30">
            🤽
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold tracking-tight text-white drop-shadow-sm">PoloPad Pro</span>
              <button
                onClick={handleToggleBlePair}
                title={bleError || 'Click to pair with ESP32 PoloBridge-Pro dongle via Web Bluetooth'}
                className={`flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full border font-mono font-bold transition cursor-pointer ${
                  bleStatus === 'connected'
                    ? 'bg-emerald-400/20 text-emerald-200 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                    : bleStatus === 'connecting'
                    ? 'bg-amber-400/20 text-amber-200 border-amber-400/50 animate-pulse'
                    : 'bg-cyan-400/20 hover:bg-cyan-400/30 text-cyan-200 border-cyan-300/40'
                }`}
              >
                <Bluetooth size={11} className={bleStatus === 'connected' ? 'text-emerald-300' : 'text-cyan-300'} />
                <span>
                  {bleStatus === 'connected'
                    ? `${bleDeviceName || 'PoloBridge-Pro'} LIVE`
                    : bleStatus === 'connecting'
                    ? 'PAIRING BLE...'
                    : 'PAIR BLE DONGLE'}
                </span>
              </button>

              {/* 6-8 Sports Live Connection Pill */}
              <button
                onClick={() => { sounds.playClick(); setActiveTab('sixeight'); }}
                title="Open 6-8 Sports Live Game Desk & Roster Sync"
                className={`flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full border font-mono font-bold transition cursor-pointer ${
                  sixEightMode !== 'disconnected'
                    ? 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border-amber-300/50 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                    : 'bg-sky-800/50 hover:bg-sky-700/60 text-sky-200 border-cyan-400/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${sixEightMode !== 'disconnected' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                <span>
                  {sixEightMode !== 'disconnected'
                    ? `6-8 SPORTS: ${active68Match.gameId}`
                    : 'CONNECT 6-8 SPORTS'}
                </span>
              </button>
            </div>
            <div className="text-[10px] text-cyan-200/80 font-mono">
              {bleError ? (
                <span className="text-amber-300">{bleError}</span>
              ) : (
                <span>{enable20sReset ? 'NCAA / World Aquatics (20s Reset Enabled)' : 'NFHS High School (30s Resets Only)'} &bull; 6-8 Game Desk Linked</span>
              )}
            </div>
          </div>
        </div>

        {/* View Switchers (Console, 6-8 Sports, Mockups, OBS Overlay, Hardware Rack, Scoresheet) */}
        <div className="flex items-center gap-1 bg-sky-950/70 p-1 rounded-xl border border-cyan-400/30 shadow-inner">
          {[
            { id: 'console', label: 'Operator Console', icon: Layers },
            { id: 'sixeight', label: '6-8 Sports', icon: Trophy },
            { id: 'mockups', label: 'Product Mockups', icon: Sparkles },
            { id: 'overlay', label: 'OBS Scorebug', icon: Tv },
            { id: 'rack', label: 'Deck Hardware (LED)', icon: Radio },
            { id: 'scoresheet', label: 'Official Sheet', icon: FileText },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { sounds.playClick(); setActiveTab(tab.id as ActiveTab); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30 border border-cyan-300/40' 
                    : 'text-sky-200/80 hover:text-white hover:bg-cyan-400/15'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Ruleset & Protocol Selectors & Global Horn */}
        <div className="flex items-center gap-2.5">
          {/* Ruleset Mode Selector */}
          <div className="flex items-center bg-sky-950/70 p-0.5 rounded-lg border border-cyan-400/30 text-xs">
            <button
              onClick={() => { sounds.playClick(); setEnable20sReset(false); }}
              className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition ${
                !enable20sReset ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 shadow-sm' : 'text-sky-300/60 hover:text-sky-100'
              }`}
              title="NFHS High School Mode: All shot clock resets are 30 seconds (no 20s reset)"
            >
              HS (30s)
            </button>
            <button
              onClick={() => { sounds.playClick(); setEnable20sReset(true); }}
              className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition ${
                enable20sReset ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40 shadow-sm' : 'text-sky-300/60 hover:text-sky-100'
              }`}
              title="NCAA / World Aquatics Mode: 20s reset on rebound and exclusion"
            >
              NCAA (20s)
            </button>
          </div>

          {/* Hardware Protocol Selector */}
          <div className="flex items-center bg-sky-950/70 p-0.5 rounded-lg border border-cyan-400/30 text-xs">
            <button
              onClick={() => { sounds.playClick(); setProtocol('cts'); bleManager.sendProtocol('cts'); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition ${
                protocol === 'cts' ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/40' : 'text-sky-300/60 hover:text-sky-100'
              }`}
            >
              CTS 9600-8-E-1
            </button>
            <button
              onClick={() => { sounds.playClick(); setProtocol('daktronics'); bleManager.sendProtocol('daktronics'); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition ${
                protocol === 'daktronics' ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40' : 'text-sky-300/60 hover:text-sky-100'
              }`}
            >
              DAKT CODE 4498
            </button>
          </div>

          <button
            onMouseDown={() => fireHornManual(1400)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition shadow-lg ${
              isHornActive
                ? 'bg-rose-500 text-white shadow-rose-500/50 scale-95 ring-2 ring-amber-300'
                : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-rose-600/30 border border-rose-300/30'
            }`}
          >
            <Volume2 size={13} className={isHornActive ? 'animate-bounce' : ''} />
            <span>Horn</span>
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. MAIN ACTIVE VIEWPORT                                  */}
      {/* ======================================================== */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* VIEW A: DUAL-THUMB HANDHELD CONSOLE */}
        {activeTab === 'console' && (
          <div className="flex-1 p-6 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/30 via-sky-800/90 to-blue-950 overflow-y-auto">
            
            {/* Handheld iPad Chassis — Vibrant Anodized Marine Sapphire */}
            <div className="w-full max-w-6xl rounded-[36px] bg-gradient-to-b from-sky-800/90 via-blue-900/95 to-indigo-950/95 border-2 border-cyan-400/50 p-6 shadow-[0_24px_70px_rgba(6,182,212,0.3)] backdrop-blur-xl flex flex-col gap-5">
              
              {/* Three-Column Thumb Layout */}
              <div className="grid grid-cols-[180px_1fr_180px] gap-6 min-h-[520px]">
                
                {/* -------------------------------------------------- */}
                {/* 1. LEFT THUMB PILLAR: GIANT 3D START / STOP PLUNGER */}
                {/* -------------------------------------------------- */}
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] font-mono font-black tracking-widest text-cyan-200 flex items-center justify-center gap-1 uppercase">
                    <span>👈</span> Left Thumb
                  </div>

                  <button
                    onClick={toggleStartStop}
                    className={`flex-1 w-full rounded-3xl p-5 flex flex-col items-center justify-between transition-all duration-100 select-none relative group border-t-2 border-white/50 shadow-2xl ${
                      isRunning
                        ? 'bg-gradient-to-b from-rose-500 via-red-500 to-red-700 shadow-[0_12px_0_#881337,0_20px_35px_rgba(244,63,94,0.45)] active:translate-y-2 active:shadow-[0_4px_0_#881337]'
                        : 'bg-gradient-to-b from-emerald-400 via-teal-500 to-emerald-600 shadow-[0_12px_0_#065f46,0_20px_35px_rgba(16,185,129,0.45)] active:translate-y-2 active:shadow-[0_4px_0_#065f46]'
                    }`}
                  >
                    {/* Top Grip Ridges */}
                    <div className="w-12 flex flex-col gap-1.5 opacity-50">
                      <div className="h-1 rounded-full bg-white" />
                      <div className="h-1 rounded-full bg-white" />
                      <div className="h-1 rounded-full bg-white" />
                    </div>

                    {/* Center Icon & Action */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-white drop-shadow-md">
                        {isRunning ? <Pause size={56} className="fill-white" /> : <Play size={56} className="fill-white translate-x-1" />}
                      </div>
                      <div className="text-3xl font-black tracking-wider text-white font-mono leading-none">
                        {isRunning ? 'STOP' : 'START'}
                      </div>
                      <div className="text-[11px] font-black tracking-widest uppercase font-mono px-3 py-1 rounded-full bg-sky-950/50 border border-white/20 text-white">
                        {isRunning ? 'WHISTLE' : 'IN PLAY'}
                      </div>
                    </div>

                    {/* Bottom Grip Ridges */}
                    <div className="w-12 flex flex-col gap-1.5 opacity-50">
                      <div className="h-1 rounded-full bg-white" />
                      <div className="h-1 rounded-full bg-white" />
                      <div className="h-1 rounded-full bg-white" />
                    </div>
                  </button>
                </div>

                {/* -------------------------------------------------- */}
                {/* 2. CENTER STAGE: RECESSED CLOCKS & MATCH COMMAND   */}
                {/* -------------------------------------------------- */}
                <div className="flex flex-col gap-4">
                  
                  {/* Top Bar: Period Selector & WP 20.15 Status */}
                  <div className="flex items-center justify-between bg-sky-950/75 p-2 rounded-2xl border border-cyan-400/30 shadow-inner">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-cyan-200 px-2 uppercase">Period:</span>
                      {[1, 2, 3, 4, 5].map(p => (
                        <button
                          key={p}
                          onClick={() => { sounds.playClick(); setPeriod(p); }}
                          className={`px-3 py-1 rounded-lg text-xs font-mono font-black transition ${
                            period === p 
                              ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-sky-950 shadow-md shadow-cyan-400/30' 
                              : 'bg-sky-900/60 text-sky-200 hover:bg-sky-800 hover:text-white border border-cyan-400/20'
                          }`}
                        >
                          {p === 5 ? 'OT' : `Q${p}`}
                        </button>
                      ))}
                    </div>

                    {/* Rule WP 20.15 Badge */}
                    <div className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-black flex items-center gap-1.5 ${
                      isBlanked 
                        ? 'bg-amber-400/25 text-amber-200 border border-amber-300/50' 
                        : 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                    }`}>
                      <AlertTriangle size={11} className={isBlanked ? 'text-amber-300' : 'text-cyan-300'} />
                      <span>{isBlanked ? 'WP 20.15 AUTO-BLANKED' : 'RULE WP 20.15 ARMED'}</span>
                    </div>
                  </div>

                  {/* Recessed Master Clocks Bay */}
                  <div className="grid grid-cols-[1.4fr_1fr] gap-4">
                    
                    {/* Game Clock */}
                    <div className="rounded-2xl p-4 bg-gradient-to-b from-sky-950/90 via-blue-950/95 to-indigo-950/95 border-2 border-cyan-400/40 shadow-[inset_0_4px_20px_rgba(6,182,212,0.2)] flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[10px] font-mono font-extrabold tracking-widest text-cyan-200">
                        <span>MASTER GAME CLOCK</span>
                        <span className="text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30">100ms TICK</span>
                      </div>
                      <div className="text-5xl font-black font-mono tracking-tight text-white py-1 tabular-nums drop-shadow-[0_0_24px_rgba(34,211,238,0.45)]">
                        {formatMinSecTenths(gameTimeMs)}
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-cyan-400/20">
                        <button 
                          onClick={() => setGameTimeMs(g => Math.max(0, g - 1000))} 
                          className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/30 text-[10px] font-mono font-bold text-cyan-100 transition"
                        >
                          -1s
                        </button>
                        <button 
                          onClick={() => setGameTimeMs(g => g + 1000)} 
                          className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/30 text-[10px] font-mono font-bold text-cyan-100 transition"
                        >
                          +1s
                        </button>
                        <button 
                          onClick={() => setGameTimeMs(8 * 60 * 1000)} 
                          className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/30 text-[10px] font-mono font-bold text-cyan-100 ml-auto transition"
                        >
                          Reset 8:00
                        </button>
                      </div>
                    </div>

                    {/* Shot Clock */}
                    <div className="rounded-2xl p-4 bg-gradient-to-b from-indigo-950/90 via-blue-950/95 to-sky-950/95 border-2 border-amber-400/50 shadow-[inset_0_4px_20px_rgba(245,158,11,0.2)] flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[10px] font-mono font-extrabold tracking-widest text-amber-200">
                        <span>SHOT CLOCK</span>
                        <span className={isBlanked ? 'text-sky-400/60' : (shotSec <= 5 ? 'text-rose-300 bg-rose-500/25 px-2 py-0.5 rounded-full animate-pulse' : 'text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/30')}>
                          {isBlanked ? 'BLANK' : `${shotSec}s`}
                        </span>
                      </div>
                      <div className={`text-6xl font-black font-mono tracking-tight py-1 tabular-nums leading-none ${
                        isBlanked
                          ? 'text-sky-800/70'
                          : (shotSec <= 5
                              ? 'text-rose-400 drop-shadow-[0_0_25px_rgba(244,63,94,0.85)]'
                              : 'text-amber-300 drop-shadow-[0_0_24px_rgba(251,191,36,0.7)]')
                      }`}>
                        {shotDisplay}
                      </div>
                      <div className="text-[10px] font-mono text-sky-200/80 pt-2 border-t border-amber-400/20">
                        {isBlanked ? 'Blanked by WP 20.15' : 'Colorado SC-500 Sync'}
                      </div>
                    </div>

                  </div>

                  {/* Tactical Quick Dock: Undo & Adjustments */}
                  <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-3">
                    <button
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      className="h-11 rounded-xl bg-gradient-to-b from-violet-500 to-fuchsia-600 border-t border-white/40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_4px_0_#6b21a8] active:translate-y-1 active:shadow-none disabled:opacity-35 disabled:pointer-events-none transition"
                    >
                      <RotateCcw size={14} />
                      <span>UNDO RESET</span>
                    </button>

                    <button
                      onClick={() => adjustShot(-1)}
                      className="h-11 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 border-t border-cyan-200/40 text-white font-mono font-bold text-sm shadow-[0_4px_0_#0369a1] active:translate-y-1 active:shadow-none transition"
                    >
                      -1s Shot
                    </button>

                    <button
                      onClick={() => adjustShot(1)}
                      className="h-11 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 border-t border-cyan-200/40 text-white font-mono font-bold text-sm shadow-[0_4px_0_#0369a1] active:translate-y-1 active:shadow-none transition"
                    >
                      +1s Shot
                    </button>

                    <button
                      onClick={() => fireHornManual(1000)}
                      className="h-11 rounded-xl bg-gradient-to-b from-rose-500 to-red-600 border-t border-white/40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_4px_0_#9f1239] active:translate-y-1 active:shadow-none transition"
                    >
                      <Volume2 size={14} />
                      <span>BUZZER</span>
                    </button>
                  </div>

                  {/* Team Bays: Scores & 20-Second Exclusion Trackers */}
                  <div className="grid grid-cols-2 gap-4">
                    
                    {/* WHITE TEAM — Sunlit Frosty Aqua Card */}
                    <div className="rounded-2xl p-4 bg-gradient-to-b from-sky-700/70 via-sky-800/80 to-blue-900/90 border-2 border-white/40 flex flex-col justify-between shadow-xl">
                      <div className="flex items-center justify-between pb-3 border-b border-white/20">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_12px_#ffffff]" />
                          <input
                            type="text"
                            value={teamWhiteName}
                            onChange={e => setTeamWhiteName(e.target.value)}
                            className="bg-transparent border-0 text-white font-black text-sm tracking-tight focus:outline-none w-28"
                          />
                        </div>

                        {/* Score Stepper */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { sounds.playClick(); setScoreWhite(s => Math.max(0, s - 1)); }}
                            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 font-black text-white text-base flex items-center justify-center transition"
                          >
                            -
                          </button>
                          <span className="text-3xl font-black font-mono text-white min-w-[32px] text-center tabular-nums drop-shadow">
                            {scoreWhite}
                          </span>
                          <button
                            onClick={() => { sounds.playClick(); setScoreWhite(s => s + 1); reset30(); }}
                            className="w-8 h-8 rounded-lg bg-cyan-400/30 hover:bg-cyan-400/45 border border-cyan-200/40 font-black text-white text-base flex items-center justify-center transition"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* White Exclusions */}
                      <div className="pt-3">
                        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-cyan-100 mb-2">
                          <span>20s PENALTIES</span>
                          <button
                            onClick={() => setShowCapModal('white')}
                            className="px-2.5 py-0.5 rounded-md bg-rose-500/35 text-rose-100 border border-rose-300/50 text-[10px] font-bold hover:bg-rose-500/50 transition"
                          >
                            + EJECT
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[32px]">
                          {exclusions.filter(e => e.team === 'white').length === 0 ? (
                            <span className="text-[11px] text-sky-200/70 font-mono italic">No active penalties</span>
                          ) : (
                            exclusions.filter(e => e.team === 'white').map(e => (
                              <div key={e.id} className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-rose-600/80 border border-rose-300/60 text-xs font-mono shadow">
                                <span className="font-bold text-white">#{e.cap}</span>
                                <span className="text-amber-200 font-extrabold">{e.remaining.toFixed(0)}s</span>
                                <button
                                  onClick={() => releaseExclusion(e.id)}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white"
                                  title="Early release (Goal / Turnover)"
                                >
                                  REL
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* DARK TEAM — Electric Cobalt & Indigo Card */}
                    <div className="rounded-2xl p-4 bg-gradient-to-b from-blue-700/75 via-indigo-800/85 to-indigo-950/90 border-2 border-cyan-400/50 flex flex-col justify-between shadow-xl">
                      <div className="flex items-center justify-between pb-3 border-b border-cyan-400/25">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
                          <input
                            type="text"
                            value={teamDarkName}
                            onChange={e => setTeamDarkName(e.target.value)}
                            className="bg-transparent border-0 text-cyan-200 font-black text-sm tracking-tight focus:outline-none w-28"
                          />
                        </div>

                        {/* Score Stepper */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { sounds.playClick(); setScoreDark(s => Math.max(0, s - 1)); }}
                            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 font-black text-white text-base flex items-center justify-center transition"
                          >
                            -
                          </button>
                          <span className="text-3xl font-black font-mono text-cyan-300 min-w-[32px] text-center tabular-nums drop-shadow">
                            {scoreDark}
                          </span>
                          <button
                            onClick={() => { sounds.playClick(); setScoreDark(s => s + 1); reset30(); }}
                            className="w-8 h-8 rounded-lg bg-cyan-400/30 hover:bg-cyan-400/45 border border-cyan-200/40 font-black text-white text-base flex items-center justify-center transition"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Dark Exclusions */}
                      <div className="pt-3">
                        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-cyan-100 mb-2">
                          <span>20s PENALTIES</span>
                          <button
                            onClick={() => setShowCapModal('dark')}
                            className="px-2.5 py-0.5 rounded-md bg-rose-500/35 text-rose-100 border border-rose-300/50 text-[10px] font-bold hover:bg-rose-500/50 transition"
                          >
                            + EJECT
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[32px]">
                          {exclusions.filter(e => e.team === 'dark').length === 0 ? (
                            <span className="text-[11px] text-indigo-200/70 font-mono italic">No active penalties</span>
                          ) : (
                            exclusions.filter(e => e.team === 'dark').map(e => (
                              <div key={e.id} className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-rose-600/80 border border-rose-300/60 text-xs font-mono shadow">
                                <span className="font-bold text-white">#{e.cap}</span>
                                <span className="text-amber-200 font-extrabold">{e.remaining.toFixed(0)}s</span>
                                <button
                                  onClick={() => releaseExclusion(e.id)}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white"
                                  title="Early release (Goal / Turnover)"
                                >
                                  REL
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

                {/* -------------------------------------------------- */}
                {/* 3. RIGHT THUMB PILLAR: DYNAMIC RESET PLUNGER(S)   */}
                {/* -------------------------------------------------- */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-0.5">
                    <div className="text-[10px] font-mono font-black tracking-widest text-cyan-200 flex items-center gap-1 uppercase">
                      Right Thumb <span>👉</span>
                    </div>
                    <button
                      onClick={() => { sounds.playClick(); setEnable20sReset(prev => !prev); }}
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border transition cursor-pointer ${
                        enable20sReset
                          ? 'bg-amber-400/25 text-amber-200 border-amber-300/40 hover:bg-amber-400/35'
                          : 'bg-emerald-400/25 text-emerald-200 border-emerald-300/40 hover:bg-emerald-400/35'
                      }`}
                      title={enable20sReset ? "Currently: NCAA/WA (20s reset enabled). Click to switch to High School Mode (30s only)" : "Currently: High School Mode (30s only). Click to switch to NCAA/WA Mode"}
                    >
                      {enable20sReset ? 'NCAA: 20s/30s' : 'NFHS: 30s ONLY'}
                    </button>
                  </div>

                  <div className="flex-1 flex flex-col gap-4">
                    {enable20sReset ? (
                      <>
                        {/* RESET 30s (Turnover) */}
                        <button
                          onClick={reset30}
                          className="flex-1 w-full rounded-3xl p-4 bg-gradient-to-b from-emerald-400 via-teal-500 to-emerald-600 border-t-2 border-white/50 shadow-[0_10px_0_#065f46,0_16px_28px_rgba(16,185,129,0.35)] active:translate-y-2 active:shadow-[0_2px_0_#065f46] text-white flex flex-col items-center justify-center transition-all select-none group"
                        >
                          <span className="text-5xl font-black font-mono leading-none tracking-tight">30</span>
                          <span className="text-sm font-black tracking-wider uppercase mt-1">RESET 30</span>
                          <span className="text-[10px] font-mono font-extrabold text-emerald-950 bg-emerald-200/80 px-2.5 py-0.5 rounded-full mt-1">
                            TURNOVER
                          </span>
                        </button>

                        {/* RESET 20s (Rebound / Exclusion) */}
                        <button
                          onClick={reset20}
                          className="flex-1 w-full rounded-3xl p-4 bg-gradient-to-b from-amber-400 via-orange-500 to-amber-600 border-t-2 border-white/50 shadow-[0_10px_0_#92400e,0_16px_28px_rgba(245,158,11,0.35)] active:translate-y-2 active:shadow-[0_2px_0_#92400e] text-white flex flex-col items-center justify-center transition-all select-none group"
                        >
                          <span className="text-5xl font-black font-mono leading-none tracking-tight">20</span>
                          <span className="text-sm font-black tracking-wider uppercase mt-1">RESET 20</span>
                          <span className="text-[10px] font-mono font-extrabold text-amber-950 bg-amber-200/80 px-2.5 py-0.5 rounded-full mt-1">
                            REBOUND / FOUL
                          </span>
                        </button>
                      </>
                    ) : (
                      /* SINGLE GIANT FULL-HEIGHT 30s PLUNGER (HIGH SCHOOL NFHS MODE) */
                      <button
                        onClick={reset30}
                        className="flex-1 w-full rounded-3xl p-5 bg-gradient-to-b from-emerald-400 via-teal-500 to-emerald-600 border-t-2 border-white/50 shadow-[0_12px_0_#065f46,0_20px_35px_rgba(16,185,129,0.45)] active:translate-y-2 active:shadow-[0_4px_0_#065f46] text-white flex flex-col items-center justify-between transition-all select-none group"
                      >
                        {/* Top Grip Ridges */}
                        <div className="w-12 flex flex-col gap-1.5 opacity-50">
                          <div className="h-1 rounded-full bg-white" />
                          <div className="h-1 rounded-full bg-white" />
                          <div className="h-1 rounded-full bg-white" />
                        </div>

                        {/* Center Numeral & Action */}
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-6xl font-black font-mono leading-none tracking-tight drop-shadow-md">30</span>
                          <span className="text-2xl font-black tracking-wider uppercase font-mono">RESET 30</span>
                          <span className="text-[10px] font-black tracking-widest uppercase font-mono px-3 py-1 rounded-full bg-sky-950/60 border border-emerald-300/40 text-emerald-100">
                            ALL RESETS 30s
                          </span>
                        </div>

                        {/* Bottom Grip Ridges */}
                        <div className="w-12 flex flex-col gap-1.5 opacity-50">
                          <div className="h-1 rounded-full bg-white" />
                          <div className="h-1 rounded-full bg-white" />
                          <div className="h-1 rounded-full bg-white" />
                        </div>
                      </button>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* VIEW B: LIVE OBS BROADCAST SCOREBUG OVERLAY */}
        {activeTab === 'overlay' && (
          <div className="flex-1 p-8 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-600/30 via-sky-900 to-indigo-950 space-y-6">
            <div className="w-full max-w-4xl p-6 rounded-2xl bg-sky-950/80 backdrop-blur-xl border-2 border-cyan-400/40 shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-cyan-400/25">
                <span className="text-xs font-mono text-cyan-300 font-bold uppercase tracking-wider">
                  🔴 Live Broadcast Scorebug Stream Overlay (OBS / vMix / Hudl)
                </span>
                <span className="text-xs font-mono text-sky-200">http://ipad-ip:8080/overlay</span>
              </div>

              {/* Television Graphic Representation */}
              <div className="p-8 rounded-2xl bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/30 via-blue-900 to-indigo-950 border border-cyan-300/30 flex items-center justify-center">
                
                <div className="h-14 rounded-2xl bg-gradient-to-r from-sky-900/95 via-blue-950/95 to-indigo-950/95 border-2 border-cyan-300/50 shadow-2xl flex items-center overflow-hidden font-mono">
                  {/* White Team */}
                  <div className="flex items-center px-4 gap-3 bg-white/15">
                    <span className="w-3 h-3 rounded-full bg-white shadow-md" />
                    <span className="font-black text-sm text-white">{teamWhiteName.toUpperCase()}</span>
                    <span className="text-2xl font-black text-white px-2 py-0.5 rounded bg-sky-950/60">{scoreWhite}</span>
                  </div>

                  {/* Period */}
                  <div className="px-3 bg-sky-950/80 text-xs font-bold text-cyan-300">
                    Q{period}
                  </div>

                  {/* Dark Team */}
                  <div className="flex items-center px-4 gap-3 bg-blue-800/50">
                    <span className="text-2xl font-black text-cyan-300 px-2 py-0.5 rounded bg-sky-950/60">{scoreDark}</span>
                    <span className="font-black text-sm text-cyan-200">{teamDarkName.toUpperCase()}</span>
                    <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-md" />
                  </div>

                  {/* Master Game Clock */}
                  <div className="px-4 text-cyan-300 text-lg font-black bg-sky-950/90">
                    {formatMinSec(gameTimeMs)}
                  </div>

                  {/* Shot Clock */}
                  <div className={`px-4 text-xl font-black ${isBlanked ? 'text-sky-700 bg-sky-950' : (shotSec <= 5 ? 'text-rose-400 bg-rose-950/80' : 'text-amber-300 bg-amber-900/50')}`}>
                    :{isBlanked ? '--' : `${shotSec}`}
                  </div>
                </div>

              </div>

              <p className="text-xs text-sky-200 leading-relaxed text-center">
                Add this URL directly into OBS Studio or vMix as a <strong>Browser Source</strong> with transparent background.
              </p>
            </div>
          </div>
        )}

        {/* VIEW C: PHYSICAL DECK HARDWARE SIMULATOR & RS-232 BUS */}
        {activeTab === 'rack' && (
          <div className="flex-1 p-8 grid grid-cols-2 gap-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-600/30 via-sky-900 to-indigo-950 overflow-y-auto">
            
            {/* Colorado SC-500 Physical LED Enclosure */}
            <div className="rounded-2xl p-6 bg-gradient-to-b from-sky-900/90 to-indigo-950/95 border-2 border-cyan-400/40 shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-3 border-b border-cyan-400/25 mb-6">
                  <span className="text-xs font-mono font-bold text-cyan-200">
                    CTS SC-500 / SC-600 PHYSICAL SHOT CLOCK
                  </span>
                  <span className="text-xs font-mono text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">9600 BAUD RS-232</span>
                </div>

                <div className="rounded-xl p-8 bg-sky-950/90 border-2 border-cyan-400/30 flex items-center justify-around shadow-inner">
                  <div className="text-center">
                    <div className="text-[10px] font-mono text-cyan-300/80 mb-2">SHOT TIME</div>
                    <div className={`text-8xl font-mono font-black tracking-widest ${
                      isBlanked 
                        ? 'text-sky-900' 
                        : (shotSec <= 5 ? 'text-rose-400 drop-shadow-[0_0_30px_#f43f5e]' : 'text-amber-300 drop-shadow-[0_0_25px_#f59e0b]')
                    }`}>
                      {isBlanked ? '  ' : `${shotSec}`}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[10px] font-mono text-cyan-300/80 mb-2">GAME TIME</div>
                    <div className="text-6xl font-mono font-black text-cyan-300 drop-shadow-[0_0_20px_#38bdf8]">
                      {formatMinSec(gameTimeMs)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-cyan-400/25 text-xs font-mono text-cyan-200">
                <span>WHITE: {scoreWhite} | DARK: {scoreDark}</span>
                <span className={isHornActive ? 'text-rose-400 font-bold animate-pulse' : 'text-sky-300/70'}>
                  {isHornActive ? 'BUZZER ACTIVE' : 'HORN SILENT'}
                </span>
              </div>
            </div>

            {/* 10Hz RS-232 Serial Hex Packet Sniffer */}
            <div className="rounded-2xl p-6 bg-gradient-to-b from-sky-900/90 to-indigo-950/95 border-2 border-cyan-400/40 shadow-2xl flex flex-col">
              <div className="flex justify-between items-center pb-3 border-b border-cyan-400/25 mb-4">
                <span className="text-xs font-mono font-bold text-cyan-300">
                  REAL-TIME RS-232 SERIAL LOG (10Hz)
                </span>
                <span className="text-xs font-mono text-sky-200">8-E-1 Framing</span>
              </div>

              <div className="flex-1 bg-sky-950/90 rounded-xl p-4 font-mono text-xs overflow-y-auto space-y-2 border border-cyan-400/30 max-h-[460px] shadow-inner">
                {busLog.map((log, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-0.5 border-b border-cyan-400/10">
                    <span className="text-sky-300/70">{log.time}</span>
                    <span className="text-fuchsia-300 font-bold">{log.protocol}</span>
                    <span className="text-amber-300">{log.header}</span>
                    <span className="text-emerald-300">"{log.ascii}"</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* VIEW D: OFFICIAL MATCH SCORESHEET (PRINTABLE) */}
        {activeTab === 'scoresheet' && (
          <div className="flex-1 p-8 flex flex-col items-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-600/30 via-sky-900 to-indigo-950 overflow-y-auto">
            <div className="w-full max-w-3xl p-8 rounded-2xl bg-white text-slate-900 shadow-2xl space-y-6 print:p-0 print:border-0 print:shadow-none">
              
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-2xl font-black tracking-tight">USA WATER POLO / WORLD AQUATICS</h1>
                  <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Official Match Scoresheet & Summary</h2>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition print:hidden"
                >
                  <Printer size={14} />
                  <span>Print Sheet (PDF)</span>
                </button>
              </div>

              {/* Match Header */}
              <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-slate-100 border border-slate-300 font-mono text-xs">
                <div>
                  <span className="text-slate-500 block">WHITE TEAM:</span>
                  <span className="font-bold text-base">{teamWhiteName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">DARK TEAM:</span>
                  <span className="font-bold text-base">{teamDarkName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">FINAL SCORE:</span>
                  <span className="font-bold text-base text-blue-700">{scoreWhite} - {scoreDark}</span>
                </div>
              </div>

              {/* Quarter Progression Table */}
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2 font-mono">Period Scoring Progression</h3>
                <table className="w-full text-xs font-mono border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-200">
                      <th className="border border-slate-300 p-2 text-left">Team</th>
                      <th className="border border-slate-300 p-2 text-center">Q1</th>
                      <th className="border border-slate-300 p-2 text-center">Q2</th>
                      <th className="border border-slate-300 p-2 text-center">Q3</th>
                      <th className="border border-slate-300 p-2 text-center">Q4</th>
                      <th className="border border-slate-300 p-2 text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 p-2 font-bold">{teamWhiteName}</td>
                      <td className="border border-slate-300 p-2 text-center">3</td>
                      <td className="border border-slate-300 p-2 text-center">4</td>
                      <td className="border border-slate-300 p-2 text-center">2</td>
                      <td className="border border-slate-300 p-2 text-center">2</td>
                      <td className="border border-slate-300 p-2 text-center font-bold text-sm">{scoreWhite}</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 p-2 font-bold">{teamDarkName}</td>
                      <td className="border border-slate-300 p-2 text-center">2</td>
                      <td className="border border-slate-300 p-2 text-center">2</td>
                      <td className="border border-slate-300 p-2 text-center">3</td>
                      <td className="border border-slate-300 p-2 text-center">2</td>
                      <td className="border border-slate-300 p-2 text-center font-bold text-sm">{scoreDark}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Sign-off */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-xs">
                <div>
                  <div className="border-b border-slate-400 pb-1 mb-1"></div>
                  <span className="text-slate-500">Referee 1 Signature</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-1 mb-1"></div>
                  <span className="text-slate-500">Desk / Table Worker Signature</span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VIEW E: PRODUCT MOCKUPS GALLERY */}
        {activeTab === 'mockups' && (
          <MockupsGallery
            gameTimeFormatted={formatMinSecTenths(gameTimeMs)}
            shotDisplay={shotDisplay}
            shotSec={shotSec}
            isBlanked={isBlanked}
            scoreWhite={scoreWhite}
            scoreDark={scoreDark}
            teamWhiteName={teamWhiteName}
            teamDarkName={teamDarkName}
            period={period}
            isRunning={isRunning}
            onToggleStartStop={toggleStartStop}
            onReset30={reset30}
            onReset20={reset20}
            onFireHorn={() => fireHornManual(1200)}
          />
        )}

        {/* VIEW F: 6-8 SPORTS LIVE GAME DESK & ROSTER BRIDGE */}
        {activeTab === 'sixeight' && (
          <SixEightPanel
            syncMode={sixEightMode}
            onChangeSyncMode={setSixEightMode}
            activeMatch={active68Match}
            onSelectMatch={handleSelect68Match}
            whiteRoster={whiteRoster}
            darkRoster={darkRoster}
            events={sixEightEvents}
            scoreWhite={scoreWhite}
            scoreDark={scoreDark}
            period={period}
            gameClockFormatted={formatMinSecTenths(gameTimeMs)}
            onRecordPlayerGoal={handleRecord68Goal}
            onRecordPlayerExclusion={addExclusion}
            onForceSyncNow={() =>
              logSixEightEvent(
                'MATCH_SYNC',
                `Manual Scoreboard & Clock Snapshot pushed to 6-8 Game Desk (${teamWhiteName} ${scoreWhite} - ${scoreDark} ${teamDarkName})`
              )
            }
          />
        )}

      </main>

      {/* ======================================================== */}
      {/* 3. CAP NUMBER PICKER MODAL (WITH 6-8 SPORTS ROSTER)      */}
      {/* ======================================================== */}
      {showCapModal && (
        <div className="fixed inset-0 bg-sky-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-gradient-to-b from-sky-800 to-indigo-950 border-2 border-cyan-300/50 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-cyan-300/30">
              <div>
                <span className="text-sm font-black text-white uppercase tracking-wider block">
                  Select {showCapModal === 'white' ? teamWhiteName : teamDarkName} Cap # for 20s Exclusion
                </span>
                <span className="text-[10px] font-mono text-cyan-200">
                  Synced with 6-8 Sports Roster ({active68Match.gameId}) &bull; Tracks 3-Foul Cap-Out
                </span>
              </div>
              <button
                onClick={() => setShowCapModal(null)}
                className="px-2.5 py-1 rounded-lg bg-white/10 text-cyan-200 hover:text-white text-xs font-mono"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2.5 max-h-[360px] overflow-y-auto p-1">
              {Array.from({ length: 16 }, (_, i) => i + 1).map(cap => {
                const roster = showCapModal === 'white' ? whiteRoster : darkRoster;
                const player = roster.find(p => p.cap === cap);
                const fouls = player ? player.exclusions : 0;
                const isCappedOut = fouls >= 3;
                return (
                  <button
                    key={cap}
                    onClick={() => addExclusion(showCapModal, cap)}
                    className={`p-2.5 rounded-xl border font-mono transition flex flex-col items-center justify-between ${
                      isCappedOut
                        ? 'bg-rose-950/70 border-rose-400/50 text-rose-200 hover:bg-rose-600'
                        : 'bg-sky-900/70 hover:bg-rose-500 hover:text-white border-cyan-400/30 text-white'
                    }`}
                  >
                    <span className="text-lg font-black leading-none">#{cap}</span>
                    <span className="text-[10px] font-sans font-bold truncate max-w-full mt-1 opacity-90">
                      {player ? player.name : `Cap ${cap}`}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full mt-1 font-bold ${
                      fouls >= 2 ? 'bg-rose-500/40 text-amber-200' : 'bg-sky-950/60 text-cyan-200'
                    }`}>
                      {fouls}/3 Fouls
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
