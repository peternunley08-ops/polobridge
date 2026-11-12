import React, { useState, useEffect, useCallback } from 'react';
import { 
  Play, Pause, RotateCcw, Volume2, Shield, Flag, Tv, 
  Radio, Settings, FileText, Check, Copy, ExternalLink, 
  Plus, Minus, AlertTriangle, Printer, Layers, Clock,
  ArrowRight, Undo2, Award, Zap, Sparkles, Bluetooth, Trophy,
  Cpu, Rocket, Timer, Keyboard, Compass, Smartphone, Database, LayoutGrid
} from 'lucide-react';
import MockupsGallery from './components/mockups-gallery';
import SixEightPanel from './components/six-eight-panel';
import HardwareBomPanel from './components/hardware-bom-panel';
import LandingPage from './components/landing-page';
import TournamentHubPanel from './components/tournament-hub-panel';
import PhoneConsole from './components/phone-console';
import FirmwareFlasherPanel from './components/firmware-flasher-panel';
import OfflineResiliencePanel from './components/offline-resilience-panel';
import { DigitalScoresheetPanel } from './components/digital-scoresheet-panel';
import TournamentDirectorHub from './components/tournament-director-hub';
import { useCourtLinkStatus } from './components/use-court-link';
import { useLiveState } from './components/use-live-state';
import { capsCappedOut } from './engine/court-link';
import { CLOCK_TICK_MS, TickAccumulator, advanceExclusions, advanceMatchClocks, advanceTimeout } from './engine/match-clock';
import { courtLinkSession } from './engine/court-link-session';
import { parseInviteHash } from './engine/court-link-transports';
import { TeamRoster, MatchEventLogEntry, createDefaultRoster } from './engine/roster-manager';
import { bleManager, BleConnectionStatus } from './engine/bluetooth-manager';
import { matchPersistence, PersistedMatchState } from './engine/match-persistence';
import {
  PRESET_68_MATCHES,
  SixEightMatchPreset,
  SixEightPlayer,
  SixEightGameEvent,
  SixEightEventType,
  SixEightSyncMode,
  sixEightClient,
} from './engine/six-eight-sports';
import { sixEightBridge } from './engine/six-eight-bridge';
import { AudioAnnouncerPanel } from './components/audio-announcer-panel';
import { audioSynthesizer } from './engine/audio-synthesizer';
import { BroadcastOverlayPanel } from './components/broadcast-overlay-panel';
import { broadcastManager } from './engine/broadcast-manager';

// --- Web Audio Synthesizer (Pool Horn & Mechanical Clicks) ---
class SoundEngine {
  playClick() {
    audioSynthesizer.playClick();
  }

  playHorn(durationMs = 1200) {
    audioSynthesizer.playHorn(durationMs);
  }

  playChime(tone: 'info' | 'warn' = 'info') {
    audioSynthesizer.playChime(tone);
  }
}

const sounds = new SoundEngine();

// --- Types ---
type Protocol = 'cts' | 'daktronics';
export type ActiveTab = 'console' | 'audio' | 'offline' | 'tournament' | 'director' | 'flasher' | 'landing' | 'bom' | 'sixeight' | 'mockups' | 'overlay' | 'rack' | 'scoresheet';

interface Exclusion {
  id: string;
  team: 'white' | 'dark';
  cap: number;
  remaining: number;
}

interface ActiveTimeoutState {
  team: 'white' | 'dark';
  type: '60s' | '30s';
  remainingMs: number;
  warned15s: boolean;
}

interface ShootoutShot {
  round: number;
  whiteResult: 'pending' | 'goal' | 'miss';
  darkResult: 'pending' | 'goal' | 'miss';
  whiteCap: number;
  darkCap: number;
}

interface ClockSnapshot {
  gameTimeMs: number;
  shotTimeMs: number;
  isRunning: boolean;
  scoreWhite: number;
  scoreDark: number;
  exclusions: Exclusion[];
}

export default function App() {
  // Zero-Data-Loss Initial Hydration from LocalStorage Mirror & IndexedDB
  const [initialMirror] = useState<PersistedMatchState | null>(() =>
    matchPersistence.loadImmediateMirror()
  );

  // Navigation & Protocol State
  const [activeTab, setActiveTab] = useState<ActiveTab>('console');
  const [protocol, setProtocol] = useState<Protocol>(initialMirror?.protocol || 'cts');

  // Web Bluetooth Dongle Connection State
  const [bleStatus, setBleStatus] = useState<BleConnectionStatus>('disconnected');
  const [bleDeviceName, setBleDeviceName] = useState<string>('');
  const [bleError, setBleError] = useState<string | null>(null);

  // Match Clocks & State
  // Live state: the clock engine reads these through refs, so it always sees the newest value.
  const [isRunning, setIsRunning, isRunningRef] = useLiveState<boolean>(false); // Always boot paused for referee safety
  const [gameTimeMs, setGameTimeMs, gameTimeRef] = useLiveState<number>(initialMirror?.gameTimeMs ?? 8 * 60 * 1000);
  const [shotTimeMs, setShotTimeMs, shotTimeRef] = useLiveState<number>(initialMirror?.shotTimeMs ?? 30 * 1000);
  const [period, setPeriod] = useState<number>(initialMirror?.period ?? 1);
  const [isHornActive, setIsHornActive] = useState<boolean>(false);

  // Teams & Scores
  const [teamWhiteName, setTeamWhiteName] = useState<string>(initialMirror?.teamWhiteName || 'VANGUARD');
  const [teamDarkName, setTeamDarkName] = useState<string>(initialMirror?.teamDarkName || 'STANFORD');
  const [scoreWhite, setScoreWhite] = useState<number>(initialMirror?.scoreWhite ?? 11);
  const [scoreDark, setScoreDark] = useState<number>(initialMirror?.scoreDark ?? 9);
  const [quarterScores, setQuarterScores] = useState<{ white: number[]; dark: number[] }>(
    initialMirror?.quarterScores || {
      white: [3, 4, 2, 2, 0, 0, 0],
      dark: [2, 2, 3, 2, 0, 0, 0],
    }
  );
  const [exclusions, setExclusions] = useState<Exclusion[]>(
    initialMirror?.exclusions || [{ id: '1', team: 'dark', cap: 4, remaining: 14 }]
  );

  // Team Timeouts Engine (3 Full 60s + 1 Short 30s per team)
  const [timeoutsWhite, setTimeoutsWhite] = useState<{ full: number; short: number }>(
    initialMirror?.timeoutsWhite || { full: 3, short: 1 }
  );
  const [timeoutsDark, setTimeoutsDark] = useState<{ full: number; short: number }>(
    initialMirror?.timeoutsDark || { full: 3, short: 1 }
  );
  const [activeTimeout, setActiveTimeout, activeTimeoutRef] = useLiveState<ActiveTimeoutState | null>(null);

  // Penalty Shootout (PSO) 5-Round + Sudden Death Scorecard
  const [shootoutRounds, setShootoutRounds] = useState<ShootoutShot[]>(
    initialMirror?.shootoutRounds || [
      { round: 1, whiteResult: 'goal', darkResult: 'goal', whiteCap: 2, darkCap: 2 },
      { round: 2, whiteResult: 'goal', darkResult: 'miss', whiteCap: 3, darkCap: 3 },
      { round: 3, whiteResult: 'pending', darkResult: 'pending', whiteCap: 4, darkCap: 4 },
      { round: 4, whiteResult: 'pending', darkResult: 'pending', whiteCap: 5, darkCap: 5 },
      { round: 5, whiteResult: 'pending', darkResult: 'pending', whiteCap: 6, darkCap: 6 },
    ]
  );

  // Modal for quick cap ejection
  const [showCapModal, setShowCapModal] = useState<'white' | 'dark' | null>(null);

  // Ruleset: High School (NFHS 30s only) vs. College / International (NCAA / World Aquatics 20s reset)
  const [enable20sReset, setEnable20sReset] = useState<boolean>(initialMirror?.enable20sReset ?? true);

  // Parent Volunteer UX: Simple 4-Button Shot-Clock Plunger Mode vs. Full Varsity Desk Mode
  const [isSimpleVolunteerMode, setIsSimpleVolunteerMode] = useState<boolean>(
    initialMirror?.isSimpleVolunteerMode ?? false
  );

  // Phone Console Mode (Auto-Detect vs. Manual Switcher)
  const [deviceViewMode, setDeviceViewMode] = useState<'auto' | 'phone' | 'desktop'>('auto');
  const [isPhoneViewport, setIsPhoneViewport] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return window.innerWidth < 768;
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsPhoneViewport(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isPhoneMode = deviceViewMode === 'phone' || (deviceViewMode === 'auto' && isPhoneViewport);

  // 6-8 Sports Live Integration State
  const [sixEightMode, setSixEightMode] = useState<SixEightSyncMode>('cloud_live');
  const [active68Match, setActive68Match] = useState<SixEightMatchPreset>(PRESET_68_MATCHES[0]);
  const [whiteRoster, setWhiteRoster] = useState<SixEightPlayer[]>(
    initialMirror?.whiteRoster || PRESET_68_MATCHES[0].whiteRoster
  );
  const [darkRoster, setDarkRoster] = useState<SixEightPlayer[]>(
    initialMirror?.darkRoster || PRESET_68_MATCHES[0].darkRoster
  );
  const [sixEightEvents, setSixEightEvents] = useState<SixEightGameEvent[]>(
    initialMirror?.sixEightEvents || []
  );

  // Custom Team Rosters & Digital Scoresheet State
  const [digitalWhiteRoster, setDigitalWhiteRoster] = useState<TeamRoster>(() => {
    if (initialMirror?.digitalWhiteRoster) return initialMirror.digitalWhiteRoster;
    return createDefaultRoster(initialMirror?.teamWhiteName || 'USA Men', 'white');
  });
  const [digitalBlueRoster, setDigitalBlueRoster] = useState<TeamRoster>(() => {
    if (initialMirror?.digitalBlueRoster) return initialMirror.digitalBlueRoster;
    return createDefaultRoster(initialMirror?.teamDarkName || 'Hungary', 'blue');
  });
  const [digitalEventLog, setDigitalEventLog] = useState<MatchEventLogEntry[]>(
    initialMirror?.digitalEventLog || []
  );

  // Undo History Stack (15-state full snapshot)
  const [undoStack, setUndoStack] = useState<ClockSnapshot[]>([]);

  // Court Link: this desk's live link to the Tournament Director 4-court dashboard
  const courtLinkStatus = useCourtLinkStatus();
  // Director full-screen mode hides this masthead so all four courts fit on one screen.
  const [isDirectorFullScreen, setIsDirectorFullScreen] = useState<boolean>(false);
  const isMastheadHidden = activeTab === 'director' && isDirectorFullScreen;

  // An invite link (#pp-room=…&pp-court=B) configures this device in one tap.
  useEffect(() => {
    const invite = parseInviteHash(window.location.hash);
    if (!invite) return;
    const result = courtLinkSession.applyInvite(invite);
    // Drop the fragment so a reload does not apply the invite a second time.
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    // A desk invite stays on the scoring console; a dashboard invite opens the dashboard.
    if (result.ok && !invite.courtId) setActiveTab('director');
  }, []);

  // Bus Monitor Log
  const [busLog, setBusLog] = useState<Array<{ time: string; header: string; ascii: string; protocol: string }>>([]);

  // Apply a restored match snapshot (from IndexedDB or Checkpoint)
  const applyRestoredMatchState = useCallback((restored: PersistedMatchState) => {
    setIsRunning(false);
    setProtocol(restored.protocol || 'cts');
    setEnable20sReset(restored.enable20sReset ?? true);
    setIsSimpleVolunteerMode(restored.isSimpleVolunteerMode ?? false);
    setGameTimeMs(restored.gameTimeMs);
    setShotTimeMs(restored.shotTimeMs);
    setPeriod(restored.period);
    setTeamWhiteName(restored.teamWhiteName);
    setTeamDarkName(restored.teamDarkName);
    setScoreWhite(restored.scoreWhite);
    setScoreDark(restored.scoreDark);
    if (restored.quarterScores) setQuarterScores(restored.quarterScores);
    if (restored.exclusions) setExclusions(restored.exclusions);
    if (restored.timeoutsWhite) setTimeoutsWhite(restored.timeoutsWhite);
    if (restored.timeoutsDark) setTimeoutsDark(restored.timeoutsDark);
    if (restored.shootoutRounds) setShootoutRounds(restored.shootoutRounds);
    if (restored.whiteRoster) setWhiteRoster(restored.whiteRoster);
    if (restored.darkRoster) setDarkRoster(restored.darkRoster);
    if (restored.sixEightEvents) setSixEightEvents(restored.sixEightEvents);
    if (restored.digitalWhiteRoster) setDigitalWhiteRoster(restored.digitalWhiteRoster);
    if (restored.digitalBlueRoster) setDigitalBlueRoster(restored.digitalBlueRoster);
    if (restored.digitalEventLog) setDigitalEventLog(restored.digitalEventLog);
  }, []);

  // Verify IndexedDB on mount in case IndexedDB has a newer record than localStorage
  useEffect(() => {
    matchPersistence.loadFromIndexedDB().then((idbRecord) => {
      if (idbRecord && (!initialMirror || idbRecord.savedAtMs > initialMirror.savedAtMs)) {
        applyRestoredMatchState(idbRecord);
      }
    });
  }, [initialMirror, applyRestoredMatchState]);

  // Continuous 100ms Auto-Save to IndexedDB & LocalStorage Mirror + pagehide listener
  useEffect(() => {
    const payload = {
      protocol,
      enable20sReset,
      isSimpleVolunteerMode,
      gameTimeMs,
      shotTimeMs,
      period,
      isRunning: false,
      teamWhiteName,
      teamDarkName,
      scoreWhite,
      scoreDark,
      quarterScores,
      exclusions,
      timeoutsWhite,
      timeoutsDark,
      shootoutRounds,
      whiteRoster,
      darkRoster,
      sixEightEvents,
      digitalWhiteRoster,
      digitalBlueRoster,
      digitalEventLog,
    };

    void matchPersistence.saveLiveState(payload);

    const handlePageHide = () => {
      void matchPersistence.saveLiveState(payload);
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [
    protocol,
    enable20sReset,
    isSimpleVolunteerMode,
    gameTimeMs,
    shotTimeMs,
    period,
    teamWhiteName,
    teamDarkName,
    scoreWhite,
    scoreDark,
    quarterScores,
    exclusions,
    timeoutsWhite,
    timeoutsDark,
    shootoutRounds,
    whiteRoster,
    darkRoster,
    sixEightEvents,
    digitalWhiteRoster,
    digitalBlueRoster,
    digitalEventLog,
  ]);

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

  // Sync score, period & clocks to physical BLE dongle when paired or auto-reconnected
  const forceResyncBleHardware = useCallback(() => {
    bleManager.sendProtocol(protocol);
    bleManager.sendGameClock(gameTimeMs);
    bleManager.sendShotClock(shotTimeMs);
    bleManager.sendScores(scoreWhite, scoreDark, period);
    if (isRunning) bleManager.sendStart();
    else bleManager.sendStop();
  }, [protocol, gameTimeMs, shotTimeMs, scoreWhite, scoreDark, period, isRunning]);

  useEffect(() => {
    if (bleStatus === 'connected') {
      bleManager.sendScores(scoreWhite, scoreDark, period);
    }
  }, [scoreWhite, scoreDark, period, bleStatus]);

  // Court Link publisher: hand every state change to the link engine. It is a
  // no-op unless this device scores a court, and even then it only transmits
  // when the director's clock projection would be wrong, plus a 1 Hz heartbeat.
  useEffect(() => {
    courtLinkSession.publishDeskState({
      isRunning,
      gameTimeMs,
      shotTimeMs,
      period,
      scoreWhite,
      scoreDark,
      teamWhiteName,
      teamDarkName,
      quarterScores,
      exclusions,
      activeTimeout,
      timeoutsWhite,
      timeoutsDark,
      isHornActive,
      enable20sReset,
      protocol,
      bleStatus,
      cappedOutWhite: capsCappedOut(whiteRoster),
      cappedOutDark: capsCappedOut(darkRoster),
      events: sixEightEvents,
    });
  }, [
    isRunning,
    gameTimeMs,
    shotTimeMs,
    period,
    scoreWhite,
    scoreDark,
    teamWhiteName,
    teamDarkName,
    quarterScores,
    exclusions,
    activeTimeout,
    timeoutsWhite,
    timeoutsDark,
    isHornActive,
    enable20sReset,
    protocol,
    bleStatus,
    whiteRoster,
    darkRoster,
    sixEightEvents,
  ]);

  const handleToggleBlePair = async () => {
    sounds.playClick();
    if (bleStatus === 'connected') {
      bleManager.disconnect();
    } else {
      await bleManager.connect();
    }
  };

  // Auto-save full match snapshot before changing clock, score, or exclusions
  const pushSnapshot = useCallback(() => {
    setUndoStack(prev => [
      { gameTimeMs, shotTimeMs, isRunning, scoreWhite, scoreDark, exclusions: [...exclusions] },
      ...prev.slice(0, 14)
    ]);
  }, [gameTimeMs, shotTimeMs, isRunning, scoreWhite, scoreDark, exclusions]);

  const handleUndo = useCallback(() => {
    sounds.playClick();
    if (undoStack.length === 0) return;
    const [last, ...rest] = undoStack;
    setGameTimeMs(last.gameTimeMs);
    setShotTimeMs(last.shotTimeMs);
    setIsRunning(last.isRunning);
    setScoreWhite(last.scoreWhite);
    setScoreDark(last.scoreDark);
    setExclusions(last.exclusions);
    setUndoStack(rest);
    bleManager.sendGameClock(last.gameTimeMs);
    bleManager.sendShotClock(last.shotTimeMs);
    if (last.isRunning) bleManager.sendStart();
    else bleManager.sendStop();
  }, [undoStack]);

  // Start / Stop Toggle
  const toggleStartStop = useCallback(() => {
    sounds.playClick();
    pushSnapshot();
    setActiveTimeout(null);
    setIsRunning(prev => {
      const next = !prev;
      if (next) bleManager.sendStart();
      else bleManager.sendStop();
      return next;
    });
  }, [pushSnapshot]);

  // Shot Resets
  const reset30 = useCallback(() => {
    sounds.playClick();
    pushSnapshot();
    setShotTimeMs(30 * 1000);
    // Rule WP 21: A 30s reset indicates a Turnover / Change of Possession.
    // Defending team's active 20s exclusions are automatically released on turnover.
    setExclusions([]);
    bleManager.sendReset30();
  }, [pushSnapshot]);

  const reset20 = useCallback(() => {
    sounds.playClick();
    pushSnapshot();
    setShotTimeMs(20 * 1000);
    bleManager.sendReset20();
  }, [pushSnapshot]);

  const adjustShot = (delta: number) => {
    sounds.playClick();
    pushSnapshot();
    setShotTimeMs(prev => {
      const next = Math.max(0, Math.min(35 * 1000, prev + delta * 1000));
      bleManager.sendShotClock(next);
      return next;
    });
  };

  const adjustGameTime = useCallback((deltaSeconds: number) => {
    sounds.playClick();
    pushSnapshot();
    setGameTimeMs(prev => {
      const next = Math.max(0, prev + deltaSeconds * 1000);
      bleManager.sendGameClock(next);
      return next;
    });
  }, [pushSnapshot]);

  const fireHornManual = useCallback((dur = 1200) => {
    sounds.playHorn(dur);
    setIsHornActive(true);
    bleManager.sendHorn(dur);
    setTimeout(() => setIsHornActive(false), dur);
  }, []);

  // Keyboard / USB Pedal Hotkeys for Poolside Operators
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleStartStop();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        reset30();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        reset20();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        fireHornManual(1200);
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleStartStop, reset30, reset20, fireHornManual, handleUndo]);

  // Rule WP 20.15: Automatic Shot Clock Blanking
  const isBlanked = gameTimeMs <= shotTimeMs;

  // Clock Ticker Engine (100ms ticks, wall-clock anchored) + Timeout Countdown Engine
  // Ticks are counted against the wall clock, not against timer callbacks: a late
  // timer, a throttled tab or a tablet that slept is caught up on the next callback.
  const hasActiveTimeout = activeTimeout !== null;
  useEffect(() => {
    if (!isRunning && !hasActiveTimeout) return undefined;

    const accumulator = new TickAccumulator(Date.now());
    let timer: ReturnType<typeof setTimeout>;

    const onTimer = () => {
      const ticks = accumulator.consume(Date.now());
      if (ticks > 0) {
        const elapsedMs = ticks * CLOCK_TICK_MS;

        // Active Team Timeout Countdown (60s or 30s) runs in real time
        const timeout = activeTimeoutRef.current;
        if (timeout) {
          const step = advanceTimeout(timeout, elapsedMs);
          if (step.crossedWarning) {
            fireHornManual(600);
            audioSynthesizer.announceTimeoutWarning(15);
          }
          if (step.expired) fireHornManual(1500);
          setActiveTimeout(step.timeout);
        }

        if (isRunningRef.current) {
          // Official Rule: a 0.0 shot clock stops BOTH Game & Shot Clocks (1500ms violation horn);
          // a 0.0 game clock ends the period (2200ms horn).
          const step = advanceMatchClocks(
            { gameTimeMs: gameTimeRef.current, shotTimeMs: shotTimeRef.current },
            elapsedMs
          );
          setGameTimeMs(step.gameTimeMs);
          setShotTimeMs(step.shotTimeMs);
          // Exclusions count down with the game clock (auto-remove when served)
          setExclusions(prev => advanceExclusions(prev, step.ranForMs));

          if (step.expiry === 'period') {
            setIsRunning(false);
            fireHornManual(2200);
            audioSynthesizer.announcePeriodEnd(period, scoreWhite, scoreDark);
          } else if (step.expiry === 'shot-clock') {
            setIsRunning(false);
            bleManager.sendStop();
            fireHornManual(1500);
            audioSynthesizer.announceShotClockViolation();
          }
        }
      }
      timer = setTimeout(onTimer, accumulator.msUntilNextTick(Date.now()));
    };

    timer = setTimeout(onTimer, CLOCK_TICK_MS);
    return () => clearTimeout(timer);
  }, [isRunning, hasActiveTimeout, fireHornManual, isRunningRef, gameTimeRef, shotTimeRef, activeTimeoutRef, setIsRunning, setGameTimeMs, setShotTimeMs, setActiveTimeout]);

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

  const periodLabel = (p: number) => {
    if (p <= 4) return `Q${p}`;
    if (p === 5) return 'OT1';
    if (p === 6) return 'OT2';
    return 'PSO';
  };

  // 6-8 Sports Telemetry Dispatcher
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
    sixEightBridge.publishEvent(newEvt);
  };

  // Select Period (Q1-Q4 = 8:00, OT1/OT2 = 3:00, PSO = Shootout)
  const handleSelectPeriod = (p: number) => {
    sounds.playClick();
    pushSnapshot();
    setPeriod(p);
    setIsRunning(false);
    bleManager.sendStop();
    if (p <= 4) {
      setGameTimeMs(8 * 60 * 1000);
      setShotTimeMs(30 * 1000);
    } else if (p === 5 || p === 6) {
      setGameTimeMs(3 * 60 * 1000);
      setShotTimeMs(30 * 1000);
    }
    logSixEightEvent('PERIOD_CHANGE', `Period switched to ${periodLabel(p)}`);
  };

  // Call Team Timeout (60s Full or 30s Short)
  const handleCallTimeout = (team: 'white' | 'dark', type: '60s' | '30s') => {
    sounds.playClick();
    pushSnapshot();
    setIsRunning(false);
    bleManager.sendStop();
    fireHornManual(800);

    if (team === 'white') {
      setTimeoutsWhite(prev => ({
        full: type === '60s' ? Math.max(0, prev.full - 1) : prev.full,
        short: type === '30s' ? Math.max(0, prev.short - 1) : prev.short,
      }));
    } else {
      setTimeoutsDark(prev => ({
        full: type === '60s' ? Math.max(0, prev.full - 1) : prev.full,
        short: type === '30s' ? Math.max(0, prev.short - 1) : prev.short,
      }));
    }

    const durMs = type === '60s' ? 60 * 1000 : 30 * 1000;
    setActiveTimeout({ team, type, remainingMs: durMs, warned15s: false });
    const tName = team === 'white' ? teamWhiteName : teamDarkName;
    audioSynthesizer.announceTimeout(team === 'white' ? 'White' : 'Dark', type === '30s');
    logSixEightEvent('MATCH_SYNC', `${type} Team Timeout called by ${tName}`, team);
  };

  // Rule WP 21: Score Update with Automatic Defending Exclusion Release
  const handleScoreDelta = (team: 'white' | 'dark', delta: number) => {
    sounds.playClick();
    pushSnapshot();
    const pIdx = Math.min(6, Math.max(0, period - 1));

    if (team === 'white') {
      const nextScore = Math.max(0, scoreWhite + delta);
      setScoreWhite(nextScore);
      setQuarterScores(prev => {
        const nextW = [...prev.white];
        nextW[pIdx] = Math.max(0, (nextW[pIdx] || 0) + delta);
        return { ...prev, white: nextW };
      });
      if (delta > 0) {
        // Rule WP 21: Goal scored releases defending (Dark) team's excluded players
        setExclusions(prev => prev.filter(e => e.team !== 'dark'));
        setShotTimeMs(30 * 1000);
        bleManager.sendReset30();
        audioSynthesizer.announceGoal('White', undefined, { white: nextScore, dark: scoreDark });
        logSixEightEvent('GOAL', `GOAL by ${teamWhiteName} (Defending Dark penalties auto-released per Rule WP 21)`, 'white', undefined, undefined, nextScore, scoreDark);
      }
    } else {
      const nextScore = Math.max(0, scoreDark + delta);
      setScoreDark(nextScore);
      setQuarterScores(prev => {
        const nextD = [...prev.dark];
        nextD[pIdx] = Math.max(0, (nextD[pIdx] || 0) + delta);
        return { ...prev, dark: nextD };
      });
      if (delta > 0) {
        // Rule WP 21: Goal scored releases defending (White) team's excluded players
        setExclusions(prev => prev.filter(e => e.team !== 'white'));
        setShotTimeMs(30 * 1000);
        bleManager.sendReset30();
        audioSynthesizer.announceGoal('Dark', undefined, { white: scoreWhite, dark: nextScore });
        logSixEightEvent('GOAL', `GOAL by ${teamDarkName} (Defending White penalties auto-released per Rule WP 21)`, 'dark', undefined, undefined, scoreWhite, nextScore);
      }
    }
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
    pushSnapshot();
    const pIdx = Math.min(6, Math.max(0, period - 1));
    const roster = team === 'white' ? whiteRoster : darkRoster;
    const player = roster.find(p => p.cap === cap);
    const pName = player ? player.name : `Cap #${cap}`;

    if (team === 'white') {
      const nextScore = scoreWhite + 1;
      setScoreWhite(nextScore);
      setQuarterScores(prev => {
        const nextW = [...prev.white];
        nextW[pIdx] = (nextW[pIdx] || 0) + 1;
        return { ...prev, white: nextW };
      });
      setWhiteRoster(prev => prev.map(p => (p.cap === cap ? { ...p, goals: p.goals + 1 } : p)));
      setExclusions(prev => prev.filter(e => e.team !== 'dark'));
      setShotTimeMs(30 * 1000);
      bleManager.sendReset30();
      logSixEightEvent('GOAL', `GOAL by ${teamWhiteName} #${cap} ${pName}`, 'white', cap, pName, nextScore, scoreDark);
    } else {
      const nextScore = scoreDark + 1;
      setScoreDark(nextScore);
      setQuarterScores(prev => {
        const nextD = [...prev.dark];
        nextD[pIdx] = (nextD[pIdx] || 0) + 1;
        return { ...prev, dark: nextD };
      });
      setDarkRoster(prev => prev.map(p => (p.cap === cap ? { ...p, goals: p.goals + 1 } : p)));
      setExclusions(prev => prev.filter(e => e.team !== 'white'));
      setShotTimeMs(30 * 1000);
      bleManager.sendReset30();
      logSixEightEvent('GOAL', `GOAL by ${teamDarkName} #${cap} ${pName}`, 'dark', cap, pName, scoreWhite, nextScore);
    }
  };

  const releaseExclusion = (id: string) => {
    sounds.playClick();
    pushSnapshot();
    const target = exclusions.find(e => e.id === id);
    setExclusions(prev => prev.filter(e => e.id !== id));
    if (target) {
      const tName = target.team === 'white' ? teamWhiteName : teamDarkName;
      logSixEightEvent('EXCLUSION_RELEASE', `Early Release (${tName} #${target.cap}) — Re-entry`, target.team, target.cap);
    }
  };

  const addExclusion = (team: 'white' | 'dark', cap: number) => {
    const roster = team === 'white' ? whiteRoster : darkRoster;
    const player = roster.find(p => p.cap === cap);
    if (player && player.exclusions >= 3) {
      // Rule WP 22.3: Player already has 3 personal fouls (Capped Out)
      return;
    }

    sounds.playClick();
    pushSnapshot();
    setExclusions(prev => [...prev, { id: Date.now().toString(), team, cap, remaining: 20 }]);
    setShowCapModal(null);
    if (enable20sReset) {
      setShotTimeMs(20 * 1000);
      bleManager.sendReset20();
    } else {
      setShotTimeMs(30 * 1000);
      bleManager.sendReset30();
    }

    const pName = player ? player.name : `Cap #${cap}`;
    const newFoulCount = (player ? player.exclusions : 0) + 1;
    const tName = team === 'white' ? teamWhiteName : teamDarkName;

    if (team === 'white') {
      setWhiteRoster(prev => prev.map(p => (p.cap === cap ? { ...p, exclusions: p.exclusions + 1 } : p)));
    } else {
      setDarkRoster(prev => prev.map(p => (p.cap === cap ? { ...p, exclusions: p.exclusions + 1 } : p)));
    }

    if (newFoulCount >= 3) {
      audioSynthesizer.announceCapOut(team === 'white' ? 'White' : 'Dark', cap);
    } else {
      audioSynthesizer.announceExclusion(team === 'white' ? 'White' : 'Dark', cap, 20);
    }

    logSixEightEvent(
      'EXCLUSION_20S',
      `20s Exclusion on ${tName} #${cap} ${pName} (${newFoulCount}/3 Personal Fouls${newFoulCount >= 3 ? ' — CAPPED OUT' : ''})`,
      team,
      cap,
      pName
    );
  };

  // Toggle Penalty Shootout Shot Result
  const handleToggleShootoutShot = (roundIdx: number, team: 'white' | 'dark') => {
    sounds.playClick();
    const cycle: Record<'pending' | 'goal' | 'miss', 'pending' | 'goal' | 'miss'> = {
      pending: 'goal',
      goal: 'miss',
      miss: 'pending',
    };
    setShootoutRounds(prev =>
      prev.map((r, i) => {
        if (i !== roundIdx) return r;
        const current = team === 'white' ? r.whiteResult : r.darkResult;
        const next = cycle[current];
        if (current !== 'goal' && next === 'goal') {
          handleScoreDelta(team, 1);
        } else if (current === 'goal' && next !== 'goal') {
          handleScoreDelta(team, -1);
        }
        return team === 'white' ? { ...r, whiteResult: next } : { ...r, darkResult: next };
      })
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-900 via-blue-900 to-indigo-950 text-white flex flex-col font-sans selection:bg-cyan-400/30 selection:text-cyan-200">
      
      {/* ======================================================== */}
      {/* 1. PROFESSIONAL AQUATIC MASTHEAD HEADER                  */}
      {/* ======================================================== */}
      <header className={`min-h-14 border-b border-cyan-400/30 bg-gradient-to-r from-sky-900/95 via-blue-900/95 to-indigo-900/95 backdrop-blur-xl px-4 py-2 flex-wrap items-center justify-between gap-2 sticky top-0 z-50 shadow-[0_4px_25px_rgba(6,182,212,0.2)] print:hidden ${isMastheadHidden ? 'hidden' : 'flex'}`}>
        
        {/* Brand & Connection Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { sounds.playClick(); setActiveTab('landing'); }}
            className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 via-teal-300 to-amber-300 flex items-center justify-center font-black text-sm text-sky-950 shadow-lg shadow-cyan-400/30 cursor-pointer"
            title="View PoloBridge Product Landing Page"
          >
            🤽
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold tracking-tight text-white drop-shadow-sm">PoloPad Pro</span>
              <button
                onClick={handleToggleBlePair}
                title={bleError || 'Click to pair with ESP32 PoloBridge-Pro dongle via Web Bluetooth'}
                className={`flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full border font-mono font-bold transition cursor-pointer ${
                  bleStatus === 'connected'
                    ? 'bg-emerald-400/20 text-emerald-200 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                    : bleStatus === 'connecting' || bleStatus === 'reconnecting'
                    ? 'bg-amber-400/20 text-amber-200 border-amber-400/50 animate-pulse'
                    : 'bg-cyan-400/20 hover:bg-cyan-400/30 text-cyan-200 border-cyan-300/40'
                }`}
              >
                <Bluetooth size={11} className={bleStatus === 'connected' ? 'text-emerald-300' : 'text-cyan-300'} />
                <span>
                  {bleStatus === 'connected'
                    ? `${bleDeviceName || 'PoloBridge-Pro'} LIVE`
                    : bleStatus === 'reconnecting'
                    ? 'AUTO-RECONNECTING BLE...'
                    : bleStatus === 'connecting'
                    ? 'PAIRING BLE...'
                    : 'PAIR BLE DONGLE'}
                </span>
              </button>

              {/* 6-8 Sports Live Connection Pill */}
              <button
                onClick={() => { sounds.playClick(); setActiveTab('sixeight'); }}
                title="Open 6-8 Sports Live Game Desk & Roster Sync"
                className={`hidden sm:flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full border font-mono font-bold transition cursor-pointer ${
                  sixEightMode !== 'disconnected'
                    ? 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border-amber-300/50 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                    : 'bg-sky-800/50 hover:bg-sky-700/60 text-sky-200 border-cyan-400/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${sixEightMode !== 'disconnected' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                <span>
                  {sixEightMode !== 'disconnected'
                    ? `6-8: ${active68Match.gameId}`
                    : 'CONNECT 6-8'}
                </span>
              </button>

              {/* Court Link Pill: shown only while this device scores a court for a Tournament Director */}
              {courtLinkStatus.config.deskCourtId && (
                <button
                  onClick={() => { sounds.playClick(); setActiveTab('director'); }}
                  title={
                    courtLinkStatus.deskSlot === 'publishing'
                      ? `Court ${courtLinkStatus.config.deskCourtId} is linked to the Tournament Director dashboard`
                      : courtLinkStatus.deskSlot === 'blocked'
                      ? `Court ${courtLinkStatus.config.deskCourtId} is already published from another tab of this browser`
                      : `Linking Court ${courtLinkStatus.config.deskCourtId} to the Tournament Director dashboard`
                  }
                  data-testid="court-link-pill"
                  data-slot={courtLinkStatus.deskSlot}
                  className={`flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full border font-mono font-bold transition cursor-pointer ${
                    courtLinkStatus.deskSlot === 'publishing'
                      ? 'bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-200 border-emerald-300/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : courtLinkStatus.deskSlot === 'blocked'
                      ? 'bg-rose-500/25 hover:bg-rose-500/35 text-rose-100 border-rose-300/60'
                      : 'bg-amber-400/20 text-amber-200 border-amber-300/50 animate-pulse'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${courtLinkStatus.deskSlot === 'publishing' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  <span>
                    COURT {courtLinkStatus.config.deskCourtId}
                    {courtLinkStatus.deskSlot === 'blocked' ? ' BLOCKED' : ''}
                  </span>
                </button>
              )}
            </div>
            <div className="text-[10px] text-cyan-200/80 font-mono">
              {bleError ? (
                <span className="text-amber-300">{bleError}</span>
              ) : (
                <span>{enable20sReset ? 'NCAA / World Aquatics (20s/30s)' : 'NFHS High School (30s Only)'} &bull; 100ms IndexedDB Auto-Saved</span>
              )}
            </div>
          </div>
        </div>

        {/* View Switchers (Console, Offline & IDB, USB Flasher, Auto-Finder, Landing Page, BOM Parts, 6-8 Sports, Mockups, OBS Overlay, Hardware Rack, Scoresheet) */}
        <div className="flex items-center gap-1 bg-sky-950/70 p-1 rounded-xl border border-cyan-400/30 shadow-inner overflow-x-auto">
          {[
            { id: 'console', label: 'Console', icon: Layers },
            { id: 'audio', label: 'Audio & Voice', icon: Volume2 },
            { id: 'offline', label: 'Offline & IDB', icon: Database },
            { id: 'flasher', label: 'USB Flasher & QC', icon: Zap },
            { id: 'tournament', label: 'Auto-Finder & Hub', icon: Compass },
            { id: 'landing', label: 'Product & ROI', icon: Rocket },
            { id: 'bom', label: 'Order BOM ($49)', icon: Cpu },
            { id: 'sixeight', label: '6-8 Sports', icon: Trophy },
            { id: 'mockups', label: 'Mockups & PCB', icon: Sparkles },
            { id: 'overlay', label: 'Scorebug', icon: Tv },
            { id: 'rack', label: 'LED / RS-232', icon: Radio },
            { id: 'scoresheet', label: 'Scoresheet', icon: FileText },
            { id: 'director', label: 'Director', icon: LayoutGrid },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { sounds.playClick(); setActiveTab(tab.id as ActiveTab); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
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
        <div className="flex items-center gap-2">
          {/* Ruleset Mode Selector */}
          <div className="hidden xl:flex items-center bg-sky-950/70 p-0.5 rounded-lg border border-cyan-400/30 text-xs">
            <button
              onClick={() => { sounds.playClick(); setEnable20sReset(false); }}
              className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition cursor-pointer ${
                !enable20sReset ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 shadow-sm' : 'text-sky-300/60 hover:text-sky-100'
              }`}
              title="NFHS High School Mode: All shot clock resets are 30 seconds"
            >
              HS (30s)
            </button>
            <button
              onClick={() => { sounds.playClick(); setEnable20sReset(true); }}
              className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition cursor-pointer ${
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
              className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition cursor-pointer ${
                protocol === 'cts' ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/40' : 'text-sky-300/60 hover:text-sky-100'
              }`}
            >
              CTS 9600
            </button>
            <button
              onClick={() => { sounds.playClick(); setProtocol('daktronics'); bleManager.sendProtocol('daktronics'); }}
              className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition cursor-pointer ${
                protocol === 'daktronics' ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40' : 'text-sky-300/60 hover:text-sky-100'
              }`}
            >
              DAKT 4498
            </button>
          </div>

          {/* Phone vs. iPad/Desktop Layout Switcher */}
          <button
            onClick={() => {
              sounds.playClick();
              setDeviceViewMode(prev => (isPhoneMode ? 'desktop' : 'phone'));
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono font-bold text-xs transition cursor-pointer ${
              isPhoneMode
                ? 'bg-amber-400 text-sky-950 border-amber-300 shadow-md shadow-amber-400/25'
                : 'bg-sky-950/80 text-cyan-200 hover:text-white border-cyan-400/30'
            }`}
            title="Toggle between Phone Controller and iPad/Desktop Chassis"
          >
            <Smartphone size={13} className={isPhoneMode ? 'text-sky-950' : 'text-cyan-300'} />
            <span className="hidden sm:inline">{isPhoneMode ? 'Phone' : 'iPad'}</span>
          </button>

          <button
            onMouseDown={() => fireHornManual(1400)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition shadow-lg cursor-pointer ${
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
        
        {/* VIEW A: DUAL-THUMB HANDHELD CONSOLE (PHONE VIEW OR IPAD CHASSIS) */}
        {activeTab === 'console' && (
          isPhoneMode ? (
            <PhoneConsole
              gameTimeMs={gameTimeMs}
              shotTimeMs={shotTimeMs}
              period={period}
              isRunning={isRunning}
              isBlanked={isBlanked}
              scoreWhite={scoreWhite}
              scoreDark={scoreDark}
              teamWhiteName={teamWhiteName}
              teamDarkName={teamDarkName}
              protocol={protocol}
              enable20sReset={enable20sReset}
              onToggle20sReset={() => {
                sounds.playClick();
                setEnable20sReset(prev => !prev);
              }}
              bleStatus={bleStatus}
              bleDeviceName={bleDeviceName}
              bleError={bleError}
              exclusions={exclusions}
              undoStackLength={undoStack.length}
              whiteRoster={whiteRoster}
              darkRoster={darkRoster}
              activeTimeout={activeTimeout}
              onToggleStartStop={toggleStartStop}
              onReset30={reset30}
              onReset20={reset20}
              onAdjustGameTime={adjustGameTime}
              onAdjustShotTime={adjustShot}
              onFireHorn={fireHornManual}
              onUndo={handleUndo}
              onScoreDelta={handleScoreDelta}
              onSetPeriod={handleSelectPeriod}
              onAddExclusion={addExclusion}
              onReleaseExclusion={releaseExclusion}
              onStartTimeout={handleCallTimeout}
              onEndTimeout={() => setActiveTimeout(null)}
              onToggleBle={handleToggleBlePair}
              onSwitchToDesktopMode={() => setDeviceViewMode('desktop')}
              onOpenAutoFinder={() => setActiveTab('tournament')}
            />
          ) : (
          <div className="flex-1 p-4 sm:p-6 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/30 via-sky-800/90 to-blue-950 overflow-y-auto">
            
            {/* Handheld iPad Chassis — Vibrant Anodized Marine Sapphire */}
            <div className="w-full max-w-6xl rounded-[36px] bg-gradient-to-b from-sky-800/90 via-blue-900/95 to-indigo-950/95 border-2 border-cyan-400/50 p-5 sm:p-6 shadow-[0_24px_70px_rgba(6,182,212,0.3)] backdrop-blur-xl flex flex-col gap-4">
              
              {/* Active Team Timeout Banner (if a 60s or 30s timeout is running) */}
              {activeTimeout && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/30 via-orange-500/35 to-rose-500/30 border-2 border-amber-300 flex items-center justify-between shadow-lg animate-pulse">
                  <div className="flex items-center gap-3">
                    <Timer size={22} className="text-amber-300" />
                    <div>
                      <div className="text-xs font-mono font-black uppercase text-amber-200">
                        ACTIVE {activeTimeout.type} TEAM TIMEOUT &bull; {activeTimeout.team === 'white' ? teamWhiteName : teamDarkName}
                      </div>
                      <div className="text-[11px] text-cyan-100">
                        Warning horn fires automatically at 15.0s remaining (Rule WP 20).
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-black font-mono text-white tabular-nums">
                      {(activeTimeout.remainingMs / 1000).toFixed(1)}s
                    </span>
                    <button
                      onClick={() => { sounds.playClick(); setActiveTimeout(null); }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-sky-950 font-mono font-black text-xs cursor-pointer shadow"
                    >
                      END TIMEOUT
                    </button>
                  </div>
                </div>
              )}

              {/* Operator Complexity Switcher: Simple Volunteer Plunger Mode vs. Full Varsity Desk Mode */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-sky-950/80 border border-cyan-400/35 rounded-2xl px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 font-mono font-bold">
                    REV 2.5 DUAL-TX + 3-CH PICKLE + 105dB HORN
                  </span>
                  <span className="text-cyan-200/80 hidden sm:inline">
                    {isSimpleVolunteerMode
                      ? 'Parent Volunteer Mode: 4 Giant Mistake-Proof Plungers (80% Screen)'
                      : 'Full Varsity Desk Mode: Clocks, Scores, Cap Exclusions, Timeouts & PSO'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-sky-900/80 p-1 rounded-xl border border-cyan-400/30">
                  <button
                    onClick={() => { sounds.playClick(); setIsSimpleVolunteerMode(false); }}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                      !isSimpleVolunteerMode
                        ? 'bg-cyan-400 text-sky-950 shadow'
                        : 'text-cyan-200 hover:text-white'
                    }`}
                  >
                    Full Varsity Desk
                  </button>
                  <button
                    onClick={() => { sounds.playClick(); setIsSimpleVolunteerMode(true); }}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                      isSimpleVolunteerMode
                        ? 'bg-amber-400 text-sky-950 shadow'
                        : 'text-amber-200 hover:text-white'
                    }`}
                  >
                    Simple Shot-Clock Plunger Mode
                  </button>
                </div>
              </div>

              {isSimpleVolunteerMode ? (
                <div className="space-y-4">
                  {/* Giant Readout Strip */}
                  <div className="grid grid-cols-2 gap-4 bg-sky-950/90 border-2 border-cyan-400/40 rounded-3xl p-5 text-center">
                    <div>
                      <div className="text-xs font-mono font-bold text-cyan-300 uppercase">
                        GAME CLOCK ({periodLabel(period)})
                      </div>
                      <div className="text-5xl sm:text-6xl font-black font-mono text-amber-300 tabular-nums mt-1">
                        {formatMinSecTenths(gameTimeMs)}
                      </div>
                    </div>
                    <div className="border-l border-cyan-400/30">
                      <div className="text-xs font-mono font-bold text-rose-300 uppercase">
                        SHOT CLOCK {isBlanked ? '(WP 20.15 BLANKED)' : ''}
                      </div>
                      <div className="text-5xl sm:text-6xl font-black font-mono text-rose-400 tabular-nums mt-1">
                        {shotDisplay}
                      </div>
                    </div>
                  </div>

                  {/* 4 Giant Impossible-to-Miss Tactile Plungers (80% Viewport) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-h-[360px]">
                    <button
                      onClick={toggleStartStop}
                      className={`rounded-3xl p-6 flex flex-col items-center justify-center gap-2 border-t-2 border-white/50 shadow-2xl cursor-pointer transition ${
                        isRunning
                          ? 'bg-gradient-to-b from-rose-500 to-red-700 shadow-[0_10px_0_#881337] active:translate-y-2'
                          : 'bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_10px_0_#065f46] active:translate-y-2'
                      }`}
                    >
                      <span className="text-3xl sm:text-4xl font-black font-mono text-white">
                        {isRunning ? '⏸ PAUSE CLOCKS' : '▶ START CLOCKS'}
                      </span>
                      <span className="text-xs font-mono text-white/90 uppercase">
                        Whistle Stop / Ball In Play [SPACE]
                      </span>
                    </button>

                    <button
                      onClick={reset30}
                      className="rounded-3xl p-6 flex flex-col items-center justify-center gap-2 border-t-2 border-white/50 bg-gradient-to-b from-teal-400 to-emerald-600 text-sky-950 shadow-[0_10px_0_#115e59] active:translate-y-2 cursor-pointer transition"
                    >
                      <span className="text-3xl sm:text-4xl font-black font-mono">
                        30s FULL RESET
                      </span>
                      <span className="text-xs font-mono font-bold uppercase">
                        Turnover / New Possession / Goal [R]
                      </span>
                    </button>

                    <button
                      onClick={reset20}
                      className="rounded-3xl p-6 flex flex-col items-center justify-center gap-2 border-t-2 border-white/50 bg-gradient-to-b from-amber-300 to-amber-500 text-sky-950 shadow-[0_10px_0_#92400e] active:translate-y-2 cursor-pointer transition"
                    >
                      <span className="text-3xl sm:text-4xl font-black font-mono">
                        20s REBOUND / EXCL
                      </span>
                      <span className="text-xs font-mono font-bold uppercase">
                        Corner Throw / Exclusion / Off. Rebound [E]
                      </span>
                    </button>

                    <button
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      className="rounded-3xl p-6 flex flex-col items-center justify-center gap-2 border-t-2 border-cyan-300/50 bg-gradient-to-b from-sky-700 to-indigo-900 text-white shadow-[0_10px_0_#1e1b4b] active:translate-y-2 disabled:opacity-40 cursor-pointer transition"
                    >
                      <span className="text-3xl sm:text-4xl font-black font-mono">
                        ↶ UNDO MISTAKE ({undoStack.length})
                      </span>
                      <span className="text-xs font-mono text-cyan-200 uppercase">
                        Instantly Restore Previous Clock &amp; State [Z]
                      </span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Three-Column Thumb Layout */}
              <div className={isSimpleVolunteerMode ? 'hidden' : 'grid grid-cols-1 lg:grid-cols-[180px_1fr_180px] gap-5 min-h-[520px]'}>
                
                {/* -------------------------------------------------- */}
                {/* 1. LEFT THUMB PILLAR: GIANT 3D START / STOP PLUNGER */}
                {/* -------------------------------------------------- */}
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] font-mono font-black tracking-widest text-cyan-200 flex items-center justify-center gap-1 uppercase">
                    <span>👈</span> Left Thumb (Space)
                  </div>

                  <button
                    onClick={toggleStartStop}
                    className={`flex-1 min-h-[160px] w-full rounded-3xl p-5 flex flex-col items-center justify-between transition-all duration-100 select-none relative group border-t-2 border-white/50 shadow-2xl cursor-pointer ${
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
                  
                  {/* Top Bar: Period Selector (Q1-Q4, OT1, OT2, PSO) & WP 20.15 Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-sky-950/75 p-2 rounded-2xl border border-cyan-400/30 shadow-inner">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-cyan-200 px-1.5 uppercase">Period:</span>
                      {[1, 2, 3, 4, 5, 6, 7].map(p => (
                        <button
                          key={p}
                          onClick={() => handleSelectPeriod(p)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black transition cursor-pointer ${
                            period === p 
                              ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-sky-950 shadow-md shadow-cyan-400/30' 
                              : 'bg-sky-900/60 text-sky-200 hover:bg-sky-800 hover:text-white border border-cyan-400/20'
                          }`}
                        >
                          {periodLabel(p)}
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

                  {/* PENALTY SHOOTOUT (PSO) INTERACTIVE 5-ROUND SCORECARD WHEN PERIOD === 7 */}
                  {period === 7 && (
                    <div className="rounded-2xl p-4 bg-gradient-to-r from-sky-950/95 via-indigo-950/95 to-sky-950/95 border-2 border-amber-400/50 space-y-3 shadow-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-black text-amber-300 uppercase tracking-wider">
                          🥅 Rule WP 24: Alternating 5-Round Penalty Shootout (PSO)
                        </span>
                        <button
                          onClick={() =>
                            setShootoutRounds(prev => [
                              ...prev,
                              {
                                round: prev.length + 1,
                                whiteResult: 'pending',
                                darkResult: 'pending',
                                whiteCap: 1,
                                darkCap: 1,
                              },
                            ])
                          }
                          className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 border border-amber-300/40 text-amber-200 font-mono font-bold text-[10px] cursor-pointer"
                        >
                          + Sudden Death Round
                        </button>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {shootoutRounds.map((r, idx) => (
                          <div key={r.round} className="p-2 rounded-xl bg-sky-900/70 border border-cyan-400/30 text-center space-y-1.5 font-mono text-xs">
                            <div className="text-[10px] text-cyan-200 font-bold">R{r.round}</div>
                            <button
                              onClick={() => handleToggleShootoutShot(idx, 'white')}
                              className={`w-full py-1 rounded font-black text-[10px] cursor-pointer ${
                                r.whiteResult === 'goal'
                                  ? 'bg-emerald-500 text-sky-950'
                                  : r.whiteResult === 'miss'
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-sky-950 text-sky-300 border border-white/20'
                              }`}
                            >
                              W: {r.whiteResult.toUpperCase()}
                            </button>
                            <button
                              onClick={() => handleToggleShootoutShot(idx, 'dark')}
                              className={`w-full py-1 rounded font-black text-[10px] cursor-pointer ${
                                r.darkResult === 'goal'
                                  ? 'bg-emerald-500 text-sky-950'
                                  : r.darkResult === 'miss'
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-sky-950 text-cyan-300 border border-cyan-400/20'
                              }`}
                            >
                              D: {r.darkResult.toUpperCase()}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recessed Master Clocks Bay */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-4">
                    
                    {/* Game Clock */}
                    <div className="rounded-2xl p-4 bg-gradient-to-b from-sky-950/90 via-blue-950/95 to-indigo-950/95 border-2 border-cyan-400/40 shadow-[inset_0_4px_20px_rgba(6,182,212,0.2)] flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[10px] font-mono font-extrabold tracking-widest text-cyan-200">
                        <span>MASTER GAME CLOCK ({periodLabel(period)})</span>
                        <span className="text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30">100ms TICK</span>
                      </div>
                      <div className="text-5xl font-black font-mono tracking-tight text-white py-1 tabular-nums drop-shadow-[0_0_24px_rgba(34,211,238,0.45)]">
                        {formatMinSecTenths(gameTimeMs)}
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-cyan-400/20">
                        <button 
                          onClick={() => setGameTimeMs(g => Math.max(0, g - 1000))} 
                          className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/30 text-[10px] font-mono font-bold text-cyan-100 transition cursor-pointer"
                        >
                          -1s
                        </button>
                        <button 
                          onClick={() => setGameTimeMs(g => g + 1000)} 
                          className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/30 text-[10px] font-mono font-bold text-cyan-100 transition cursor-pointer"
                        >
                          +1s
                        </button>
                        <button 
                          onClick={() => setGameTimeMs(period >= 5 ? 3 * 60 * 1000 : 8 * 60 * 1000)} 
                          className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/30 text-[10px] font-mono font-bold text-cyan-100 ml-auto transition cursor-pointer"
                        >
                          Reset {period >= 5 ? '3:00' : '8:00'}
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
                  <div className="grid grid-cols-4 gap-3">
                    <button
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      className="h-11 rounded-xl bg-gradient-to-b from-cyan-500 to-blue-600 border-t border-white/40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_4px_0_#0369a1] active:translate-y-1 active:shadow-none disabled:opacity-35 disabled:pointer-events-none transition cursor-pointer"
                      title="Undo last clock, score, or exclusion change (Hotkey: Z)"
                    >
                      <RotateCcw size={14} />
                      <span>UNDO ({undoStack.length})</span>
                    </button>

                    <button
                      onClick={() => adjustShot(-1)}
                      className="h-11 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 border-t border-cyan-200/40 text-white font-mono font-bold text-sm shadow-[0_4px_0_#0369a1] active:translate-y-1 active:shadow-none transition cursor-pointer"
                    >
                      -1s Shot
                    </button>

                    <button
                      onClick={() => adjustShot(1)}
                      className="h-11 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 border-t border-cyan-200/40 text-white font-mono font-bold text-sm shadow-[0_4px_0_#0369a1] active:translate-y-1 active:shadow-none transition cursor-pointer"
                    >
                      +1s Shot
                    </button>

                    <button
                      onClick={() => fireHornManual(1000)}
                      className="h-11 rounded-xl bg-gradient-to-b from-rose-500 to-red-600 border-t border-white/40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_4px_0_#9f1239] active:translate-y-1 active:shadow-none transition cursor-pointer"
                      title="Manual Pool Horn (Hotkey: H)"
                    >
                      <Volume2 size={14} />
                      <span>BUZZER</span>
                    </button>
                  </div>

                  {/* Team Bays: Scores, Timeouts & 20-Second Exclusion Trackers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
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
                            onClick={() => handleScoreDelta('white', -1)}
                            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 font-black text-white text-base flex items-center justify-center transition cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-3xl font-black font-mono text-white min-w-[32px] text-center tabular-nums drop-shadow">
                            {scoreWhite}
                          </span>
                          <button
                            onClick={() => handleScoreDelta('white', 1)}
                            className="w-8 h-8 rounded-lg bg-cyan-400/30 hover:bg-cyan-400/45 border border-cyan-200/40 font-black text-white text-base flex items-center justify-center transition cursor-pointer"
                            title="Score Goal (+1), Reset 30s, and Auto-Release Dark Exclusions (Rule WP 21)"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* White Timeouts Bar */}
                      <div className="flex items-center justify-between py-2 border-b border-white/15 text-[10px] font-mono">
                        <span className="text-cyan-100 font-bold">
                          TIMEOUTS ({timeoutsWhite.full} FULL &bull; {timeoutsWhite.short} 30s)
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCallTimeout('white', '60s')}
                            disabled={timeoutsWhite.full === 0}
                            className="px-2 py-0.5 rounded bg-amber-400/25 hover:bg-amber-400/40 border border-amber-300/50 text-amber-100 font-bold disabled:opacity-30 cursor-pointer"
                          >
                            60s TO
                          </button>
                          <button
                            onClick={() => handleCallTimeout('white', '30s')}
                            disabled={timeoutsWhite.short === 0}
                            className="px-2 py-0.5 rounded bg-cyan-400/25 hover:bg-cyan-400/40 border border-cyan-300/50 text-cyan-100 font-bold disabled:opacity-30 cursor-pointer"
                          >
                            30s TO
                          </button>
                        </div>
                      </div>

                      {/* White Exclusions */}
                      <div className="pt-2.5">
                        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-cyan-100 mb-2">
                          <span>20s PENALTIES</span>
                          <button
                            onClick={() => setShowCapModal('white')}
                            className="px-2.5 py-0.5 rounded-md bg-rose-500/35 text-rose-100 border border-rose-300/50 text-[10px] font-bold hover:bg-rose-500/50 transition cursor-pointer"
                          >
                            + EJECT
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[32px]">
                          {exclusions.filter(e => e.team === 'white').length === 0 ? (
                            <span className="text-[11px] text-sky-200/70 font-mono italic">Full Strength (6-on-6)</span>
                          ) : (
                            exclusions.filter(e => e.team === 'white').map(e => (
                              <div key={e.id} className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-rose-600/80 border border-rose-300/60 text-xs font-mono shadow">
                                <span className="font-bold text-white">#{e.cap}</span>
                                <span className="text-amber-200 font-extrabold">{e.remaining.toFixed(0)}s</span>
                                <button
                                  onClick={() => releaseExclusion(e.id)}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white cursor-pointer"
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
                            onClick={() => handleScoreDelta('dark', -1)}
                            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 font-black text-white text-base flex items-center justify-center transition cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-3xl font-black font-mono text-cyan-300 min-w-[32px] text-center tabular-nums drop-shadow">
                            {scoreDark}
                          </span>
                          <button
                            onClick={() => handleScoreDelta('dark', 1)}
                            className="w-8 h-8 rounded-lg bg-cyan-400/30 hover:bg-cyan-400/45 border border-cyan-200/40 font-black text-white text-base flex items-center justify-center transition cursor-pointer"
                            title="Score Goal (+1), Reset 30s, and Auto-Release White Exclusions (Rule WP 21)"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Dark Timeouts Bar */}
                      <div className="flex items-center justify-between py-2 border-b border-cyan-400/20 text-[10px] font-mono">
                        <span className="text-cyan-100 font-bold">
                          TIMEOUTS ({timeoutsDark.full} FULL &bull; {timeoutsDark.short} 30s)
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCallTimeout('dark', '60s')}
                            disabled={timeoutsDark.full === 0}
                            className="px-2 py-0.5 rounded bg-amber-400/25 hover:bg-amber-400/40 border border-amber-300/50 text-amber-100 font-bold disabled:opacity-30 cursor-pointer"
                          >
                            60s TO
                          </button>
                          <button
                            onClick={() => handleCallTimeout('dark', '30s')}
                            disabled={timeoutsDark.short === 0}
                            className="px-2 py-0.5 rounded bg-cyan-400/25 hover:bg-cyan-400/40 border border-cyan-300/50 text-cyan-100 font-bold disabled:opacity-30 cursor-pointer"
                          >
                            30s TO
                          </button>
                        </div>
                      </div>

                      {/* Dark Exclusions */}
                      <div className="pt-2.5">
                        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-cyan-100 mb-2">
                          <span>20s PENALTIES</span>
                          <button
                            onClick={() => setShowCapModal('dark')}
                            className="px-2.5 py-0.5 rounded-md bg-rose-500/35 text-rose-100 border border-rose-300/50 text-[10px] font-bold hover:bg-rose-500/50 transition cursor-pointer"
                          >
                            + EJECT
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[32px]">
                          {exclusions.filter(e => e.team === 'dark').length === 0 ? (
                            <span className="text-[11px] text-indigo-200/70 font-mono italic">Full Strength (6-on-6)</span>
                          ) : (
                            exclusions.filter(e => e.team === 'dark').map(e => (
                              <div key={e.id} className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-rose-600/80 border border-rose-300/60 text-xs font-mono shadow">
                                <span className="font-bold text-white">#{e.cap}</span>
                                <span className="text-amber-200 font-extrabold">{e.remaining.toFixed(0)}s</span>
                                <button
                                  onClick={() => releaseExclusion(e.id)}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white cursor-pointer"
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
                          className="flex-1 w-full rounded-3xl p-4 bg-gradient-to-b from-emerald-400 via-teal-500 to-emerald-600 border-t-2 border-white/50 shadow-[0_10px_0_#065f46,0_16px_28px_rgba(16,185,129,0.35)] active:translate-y-2 active:shadow-[0_2px_0_#065f46] text-white flex flex-col items-center justify-center transition-all select-none group cursor-pointer"
                          title="Reset Shot Clock to 30s (Hotkey: R)"
                        >
                          <span className="text-5xl font-black font-mono leading-none tracking-tight">30</span>
                          <span className="text-sm font-black tracking-wider uppercase mt-1">RESET 30</span>
                          <span className="text-[10px] font-mono font-extrabold text-emerald-950 bg-emerald-200/80 px-2.5 py-0.5 rounded-full mt-1">
                            TURNOVER (R)
                          </span>
                        </button>

                        {/* RESET 20s (Rebound / Exclusion) */}
                        <button
                          onClick={reset20}
                          className="flex-1 w-full rounded-3xl p-4 bg-gradient-to-b from-amber-400 via-orange-500 to-amber-600 border-t-2 border-white/50 shadow-[0_10px_0_#92400e,0_16px_28px_rgba(245,158,11,0.35)] active:translate-y-2 active:shadow-[0_2px_0_#92400e] text-white flex flex-col items-center justify-center transition-all select-none group cursor-pointer"
                          title="Reset Shot Clock to 20s (Hotkey: E)"
                        >
                          <span className="text-5xl font-black font-mono leading-none tracking-tight">20</span>
                          <span className="text-sm font-black tracking-wider uppercase mt-1">RESET 20</span>
                          <span className="text-[10px] font-mono font-extrabold text-amber-950 bg-amber-200/80 px-2.5 py-0.5 rounded-full mt-1">
                            REBOUND / FOUL (E)
                          </span>
                        </button>
                      </>
                    ) : (
                      /* SINGLE GIANT FULL-HEIGHT 30s PLUNGER (HIGH SCHOOL NFHS MODE) */
                      <button
                        onClick={reset30}
                        className="flex-1 w-full rounded-3xl p-5 bg-gradient-to-b from-emerald-400 via-teal-500 to-emerald-600 border-t-2 border-white/50 shadow-[0_12px_0_#065f46,0_20px_35px_rgba(16,185,129,0.45)] active:translate-y-2 active:shadow-[0_4px_0_#065f46] text-white flex flex-col items-center justify-between transition-all select-none group cursor-pointer"
                      >
                        <div className="w-12 flex flex-col gap-1.5 opacity-50">
                          <div className="h-1 rounded-full bg-white" />
                          <div className="h-1 rounded-full bg-white" />
                          <div className="h-1 rounded-full bg-white" />
                        </div>

                        <div className="flex flex-col items-center gap-2">
                          <span className="text-6xl font-black font-mono leading-none tracking-tight drop-shadow-md">30</span>
                          <span className="text-2xl font-black tracking-wider uppercase font-mono">RESET 30</span>
                          <span className="text-[10px] font-black tracking-widest uppercase font-mono px-3 py-1 rounded-full bg-sky-950/60 border border-emerald-300/40 text-emerald-100">
                            ALL RESETS 30s
                          </span>
                        </div>

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

              {/* Footer Hotkey & Hardware Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cyan-400/25 text-[10px] font-mono text-cyan-200/80">
                <div className="flex items-center gap-2">
                  <Keyboard size={12} className="text-cyan-300" />
                  <span>Desk Hotkeys: <strong>[Space]</strong> Start/Stop &bull; <strong>[R]</strong> Reset 30 &bull; <strong>[E]</strong> Reset 20 &bull; <strong>[H]</strong> Horn &bull; <strong>[Z]</strong> Undo</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('bom')}
                    className="text-amber-300 hover:underline font-bold cursor-pointer"
                  >
                    Order Dongle BOM ($24–$49) &rarr;
                  </button>
                  <button
                    onClick={() => setActiveTab('landing')}
                    className="text-emerald-300 hover:underline font-bold cursor-pointer"
                  >
                    Product Overview &amp; ROI &rarr;
                  </button>
                </div>
              </div>

            </div>
          </div>
          )
        )}

        {/* VIEW B: COMMERCIAL PRODUCT LANDING PAGE & ROI CALCULATOR */}
        {activeTab === 'landing' && (
          <LandingPage
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
            onNavigateTab={setActiveTab}
          />
        )}

        {/* VIEW C: READY-TO-ORDER HARDWARE BOM & WIRING HUB */}
        {activeTab === 'bom' && <HardwareBomPanel />}

        {/* VIEW D: LIVE OBS BROADCAST SCOREBUG OVERLAY */}
        {activeTab === 'overlay' && (
          <BroadcastOverlayPanel
            currentGameState={{
              gameTimeMs,
              shotTimeMs,
              isRunning,
              period,
              scoreWhite,
              scoreDark,
              teamWhiteName,
              teamDarkName,
              exclusions,
              activeTimeout,
            }}
            onBackToConsole={() => setActiveTab('console')}
          />
        )}

        {/* VIEW E: PHYSICAL DECK HARDWARE SIMULATOR & RS-232 BUS */}
        {activeTab === 'rack' && (
          <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-600/30 via-sky-900 to-indigo-950 overflow-y-auto">
            
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
                    <span className="text-cyan-300 font-bold">{log.protocol}</span>
                    <span className="text-amber-300">{log.header}</span>
                    <span className="text-emerald-300">&quot;{log.ascii}&quot;</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* VIEW F: OFFICIAL MATCH SCORESHEET & TEAM ROSTERS (USAWP / NFHS) */}
        {activeTab === 'scoresheet' && (
          <DigitalScoresheetPanel
            whiteRoster={digitalWhiteRoster}
            blueRoster={digitalBlueRoster}
            onUpdateWhiteRoster={setDigitalWhiteRoster}
            onUpdateBlueRoster={setDigitalBlueRoster}
            eventLog={digitalEventLog}
            onAddEventLog={(entry) => setDigitalEventLog(prev => [entry, ...prev])}
            currentPeriod={period}
            currentGameTime={formatMinSecTenths(gameTimeMs)}
            whiteScoreByPeriod={quarterScores.white}
            blueScoreByPeriod={quarterScores.dark}
            onScoreIncrement={(team) => {
              if (team === 'white') {
                setScoreWhite(s => s + 1);
                setQuarterScores(qs => {
                  const next = [...qs.white];
                  next[period - 1] = (next[period - 1] || 0) + 1;
                  return { ...qs, white: next };
                });
              } else {
                setScoreDark(s => s + 1);
                setQuarterScores(qs => {
                  const next = [...qs.dark];
                  next[period - 1] = (next[period - 1] || 0) + 1;
                  return { ...qs, dark: next };
                });
              }
            }}
            onAddExclusion={(team, capNumber) => {
              addExclusion(team === 'white' ? 'white' : 'dark', capNumber);
            }}
          />
        )}

        {/* VIEW G: PRODUCT MOCKUPS GALLERY */}
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

        {/* VIEW H: 6-8 SPORTS LIVE GAME DESK & ROSTER BRIDGE */}
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

        {/* VIEW I: UNIVERSAL SCOREBOARD AUTO-FINDER & TOURNAMENT COMMAND HUB */}
        {activeTab === 'tournament' && (
          <TournamentHubPanel
            onSelectProtocol={(p) => {
              sounds.playClick();
              setProtocol(p);
              bleManager.sendProtocol(p);
            }}
            onOpenDirector={() => {
              sounds.playClick();
              setActiveTab('director');
            }}
          />
        )}

        {/* VIEW L: TOURNAMENT DIRECTOR 4-COURT LIVE DASHBOARD (READ-ONLY COURT LINK) */}
        {activeTab === 'director' && (
          <TournamentDirectorHub
            onPlayClick={() => sounds.playClick()}
            onPlayAlert={(severity) => sounds.playChime(severity)}
            onOpenConsole={() => {
              setIsDirectorFullScreen(false);
              setActiveTab('console');
            }}
            isFullScreen={isDirectorFullScreen}
            onSetFullScreen={setIsDirectorFullScreen}
          />
        )}

        {/* VIEW J: WEBSERIAL ESP32-S3 FIRMWARE FLASHER & HARDWARE QC */}
        {activeTab === 'flasher' && <FirmwareFlasherPanel />}

        {/* VIEW K: OFFLINE POOLSIDE RESILIENCE & INDEXEDDB PERSISTENCE VAULT */}
        {activeTab === 'offline' && (
          <OfflineResiliencePanel
            currentMatchState={{
              protocol,
              enable20sReset,
              isSimpleVolunteerMode,
              gameTimeMs,
              shotTimeMs,
              period,
              isRunning: false,
              teamWhiteName,
              teamDarkName,
              scoreWhite,
              scoreDark,
              quarterScores,
              exclusions,
              timeoutsWhite,
              timeoutsDark,
              shootoutRounds,
              whiteRoster,
              darkRoster,
              sixEightEvents,
            }}
            bleStatus={bleStatus}
            bleDeviceName={bleDeviceName}
            onRestoreMatchState={(restored) => {
              sounds.playClick();
              applyRestoredMatchState(restored);
            }}
            onResetToFreshMatch={() => {
              sounds.playClick();
              setIsRunning(false);
              setGameTimeMs(8 * 60 * 1000);
              setShotTimeMs(30 * 1000);
              setPeriod(1);
              setScoreWhite(0);
              setScoreDark(0);
              setQuarterScores({ white: [0, 0, 0, 0, 0, 0, 0], dark: [0, 0, 0, 0, 0, 0, 0] });
              setExclusions([]);
              setTimeoutsWhite({ full: 3, short: 1 });
              setTimeoutsDark({ full: 3, short: 1 });
              setUndoStack([]);
            }}
            onForceResyncBle={forceResyncBleHardware}
          />
        )}

        {/* VIEW N: AUDIO SYNTHESIZER & POOL DECK VOICE ANNOUNCER */}
        {activeTab === 'audio' && (
          <AudioAnnouncerPanel onBackToConsole={() => setActiveTab('console')} />
        )}

      </main>

      {/* ======================================================== */}
      {/* 3. CAP NUMBER PICKER MODAL (WITH 3-FOUL CAP-OUT LOCK)    */}
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
                  Synced with 6-8 Sports Roster ({active68Match.gameId}) &bull; Rule WP 22.3 3-Foul Cap-Out Enforced
                </span>
              </div>
              <button
                onClick={() => setShowCapModal(null)}
                className="px-2.5 py-1 rounded-lg bg-white/10 text-cyan-200 hover:text-white text-xs font-mono cursor-pointer"
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
                    disabled={isCappedOut}
                    onClick={() => addExclusion(showCapModal, cap)}
                    className={`p-2.5 rounded-xl border font-mono transition flex flex-col items-center justify-between ${
                      isCappedOut
                        ? 'bg-rose-950/80 border-rose-400/60 text-rose-300 opacity-50 cursor-not-allowed'
                        : 'bg-sky-900/70 hover:bg-rose-500 hover:text-white border-cyan-400/30 text-white cursor-pointer'
                    }`}
                  >
                    <span className="text-lg font-black leading-none">#{cap}</span>
                    <span className="text-[10px] font-sans font-bold truncate max-w-full mt-1 opacity-90">
                      {player ? player.name : `Cap ${cap}`}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full mt-1 font-bold ${
                      isCappedOut
                        ? 'bg-rose-600 text-white'
                        : fouls >= 2
                        ? 'bg-rose-500/40 text-amber-200'
                        : 'bg-sky-950/60 text-cyan-200'
                    }`}>
                      {isCappedOut ? '3/3 CAPPED OUT' : `${fouls}/3 Fouls`}
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
