import React, { useState, useEffect } from 'react';
import {
  Database,
  ShieldCheck,
  Wifi,
  WifiOff,
  Bluetooth,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  Clock,
  Activity,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  FileJson,
} from 'lucide-react';
import {
  matchPersistence,
  PersistedMatchState,
  PersistenceHealthMetrics,
} from '../engine/match-persistence';
import {
  bleManager,
  BleConnectionStatus,
  BleReconnectTelemetry,
} from '../engine/bluetooth-manager';

export interface OfflineResiliencePanelProps {
  currentMatchState: Omit<PersistedMatchState, 'id' | 'savedAtMs' | 'savedAtIso' | 'totalSavesCount'>;
  bleStatus: BleConnectionStatus;
  bleDeviceName: string;
  onRestoreMatchState: (restored: PersistedMatchState) => void;
  onResetToFreshMatch: () => void;
  onForceResyncBle: () => void;
}

export default function OfflineResiliencePanel(props: OfflineResiliencePanelProps) {
  const {
    currentMatchState,
    bleStatus,
    bleDeviceName,
    onRestoreMatchState,
    onResetToFreshMatch,
    onForceResyncBle,
  } = props;

  const [health, setHealth] = useState<PersistenceHealthMetrics>(() =>
    matchPersistence.getHealthMetrics()
  );
  const [bleTelemetry, setBleTelemetry] = useState<BleReconnectTelemetry>(() =>
    bleManager.getReconnectTelemetry()
  );
  const [checkpoints, setCheckpoints] = useState<Array<PersistedMatchState & { label?: string }>>([]);
  const [checkpointLabel, setCheckpointLabel] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isSimulatingDrop, setIsSimulatingDrop] = useState<boolean>(false);

  const refreshCheckpoints = async () => {
    const list = await matchPersistence.listCheckpoints();
    setCheckpoints(list);
  };

  useEffect(() => {
    const unsubHealth = matchPersistence.subscribeHealth((m) => setHealth(m));
    const unsubBle = bleManager.onReconnectTelemetry((t) => setBleTelemetry(t));
    refreshCheckpoints();
    return () => {
      unsubHealth();
      void unsubBle;
    };
  }, []);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${tenths}`;
  };

  const handleCreateCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    const label =
      checkpointLabel.trim() ||
      `Q${currentMatchState.period} (${formatTime(currentMatchState.gameTimeMs)}) • ${currentMatchState.teamWhiteName} ${currentMatchState.scoreWhite}-${currentMatchState.scoreDark} ${currentMatchState.teamDarkName}`;
    await matchPersistence.createCheckpoint(label, currentMatchState);
    setCheckpointLabel('');
    await refreshCheckpoints();
    setStatusBanner(`Saved IndexedDB Checkpoint: "${label}"`);
    setTimeout(() => setStatusBanner(null), 3500);
  };

  const handleRestoreCheckpoint = (cp: PersistedMatchState & { label?: string }) => {
    onRestoreMatchState(cp);
    setStatusBanner(
      `Restored Match Checkpoint: ${cp.label || cp.savedAtIso} (${formatTime(cp.gameTimeMs)} remaining)`
    );
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handleSimulateCrashRecovery = async () => {
    const hydrated = await matchPersistence.loadFromIndexedDB();
    if (hydrated) {
      onRestoreMatchState(hydrated);
      setStatusBanner(
        `Zero-Loss Recovery Verified! Restored exact millisecond state (${formatTime(hydrated.gameTimeMs)} Game / ${(hydrated.shotTimeMs / 1000).toFixed(1)}s Shot) from IndexedDB.`
      );
    } else {
      setStatusBanner('No persisted state found; saving current state to IndexedDB now.');
      await matchPersistence.saveLiveState(currentMatchState);
    }
    setTimeout(() => setStatusBanner(null), 4500);
  };

  const handleSimulateBleDrop = async () => {
    setIsSimulatingDrop(true);
    setStatusBanner('Simulating Poolside RF Interference & Exponential Backoff Auto-Reconnect...');
    await bleManager.simulateRfDropAndAutoReconnect(() => {
      onForceResyncBle();
    });
    setIsSimulatingDrop(false);
    setStatusBanner(
      'BLE Auto-Reconnect Complete! Hardware GATT characteristics & scoreboard clocks resynchronized.'
    );
    setTimeout(() => setStatusBanner(null), 4500);
  };

  const handleExportJson = () => {
    const fullRecord: PersistedMatchState = {
      ...currentMatchState,
      id: 'active_match',
      savedAtMs: Date.now(),
      savedAtIso: new Date().toISOString(),
      totalSavesCount: health.totalSavesCount,
    };
    const jsonStr = matchPersistence.exportMatchBackupJson(fullRecord);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polopad_match_${currentMatchState.teamWhiteName}_vs_${currentMatchState.teamDarkName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner('Exported portable Match Backup JSON file.');
    setTimeout(() => setStatusBanner(null), 3500);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        const matchObj = (parsed.match || parsed) as PersistedMatchState;
        if (matchObj && typeof matchObj.gameTimeMs === 'number') {
          onRestoreMatchState(matchObj);
          await matchPersistence.saveLiveState(matchObj);
          setStatusBanner(
            `Imported Match Backup: ${matchObj.teamWhiteName} ${matchObj.scoreWhite} - ${matchObj.scoreDark} ${matchObj.teamDarkName}`
          );
        }
      } catch {
        setStatusBanner('Invalid Match JSON file.');
      }
      setTimeout(() => setStatusBanner(null), 4000);
    };
    reader.readAsText(file);
  };

  const handleFactoryReset = async () => {
    await matchPersistence.clearAllPersistedData();
    onResetToFreshMatch();
    await refreshCheckpoints();
    setStatusBanner('Cleared IndexedDB & reset to fresh Regulation Q1 (08:00.0 / 30s, 0-0).');
    setTimeout(() => setStatusBanner(null), 4000);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* 1. TOP HERO BANNER */}
      <div className="rounded-3xl bg-gradient-to-r from-sky-900/90 via-blue-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-300/40 text-emerald-200 text-xs font-mono font-bold">
              <ShieldCheck size={14} />
              <span>ZERO DATA LOSS • 100ms INDEXEDDB AUTO-SAVE • BLE AUTO-RECONNECT</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Offline Poolside Resilience &amp; Match Persistence Vault
            </h2>
            <p className="text-xs sm:text-sm text-cyan-100/90 max-w-3xl">
              Every 100ms clock tick, goal, exclusion, and timeout is continuously committed to browser{' '}
              <code className="text-cyan-300 font-mono">IndexedDB</code> + synchronous{' '}
              <code className="text-cyan-300 font-mono">localStorage</code> mirror. Refreshing the page, closing Safari, or losing Wi-Fi mid-quarter loses 0.0 seconds of official match time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border flex items-center gap-1.5 ${
                health.isOnline
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                  : 'bg-amber-500/20 border-amber-400/40 text-amber-200'
              }`}
            >
              {health.isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{health.isOnline ? 'NETWORK ONLINE' : 'OFFLINE POOL DECK MODE'}</span>
            </span>

            <span className="px-3 py-1.5 rounded-xl bg-sky-950/90 border border-cyan-400/35 text-cyan-200 font-mono text-xs font-bold flex items-center gap-1.5">
              <Database size={14} className="text-cyan-300" />
              <span>{health.storageBackend === 'indexeddb+localstorage' ? 'IndexedDB + Mirror Active' : 'LocalStorage Mirror'}</span>
            </span>
          </div>
        </div>

        {statusBanner && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-500/20 border border-emerald-300/50 text-emerald-200 text-xs font-mono font-bold flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-300 shrink-0" />
            <span>{statusBanner}</span>
          </div>
        )}
      </div>

      {/* 2. DUAL TELEMETRY GRID: INDEXEDDB ENGINE + BLE AUTO-RECONNECT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD A: INDEXEDDB 100ms REAL-TIME PERSISTENCE */}
        <div className="rounded-3xl bg-sky-900/75 border-2 border-cyan-400/35 p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="text-cyan-300" size={20} />
                <h3 className="text-lg font-black text-white">
                  100ms IndexedDB Auto-Save Engine
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase bg-emerald-500/25 text-emerald-300 border border-emerald-400/40">
                ACTIVE ({health.totalSavesCount} SAVES)
              </span>
            </div>
            <p className="text-xs text-cyan-100/80">
              Writes to <code className="text-cyan-300">PoloPadProOfflineDB.live_match_state</code> on every tick and binds <code className="text-cyan-300">pagehide</code> / <code className="text-cyan-300">beforeunload</code> listeners so sudden tab refreshes preserve exact tenth-of-a-second clocks.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center font-mono">
            <div className="p-2.5 rounded-xl bg-sky-950/80 border border-cyan-400/25">
              <span className="text-[10px] text-cyan-300/80 block">PERSISTED CLOCK</span>
              <span className="text-sm font-black text-amber-300">
                {formatTime(currentMatchState.gameTimeMs)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-950/80 border border-cyan-400/25">
              <span className="text-[10px] text-cyan-300/80 block">SHOT / SCORE</span>
              <span className="text-sm font-black text-white">
                {Math.ceil(currentMatchState.shotTimeMs / 1000)}s • {currentMatchState.scoreWhite}-{currentMatchState.scoreDark}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-950/80 border border-cyan-400/25">
              <span className="text-[10px] text-cyan-300/80 block">PAYLOAD SIZE</span>
              <span className="text-sm font-black text-emerald-300">
                {(health.estimatedBytesUsed / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={handleSimulateCrashRecovery}
              className="py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-sky-950 font-mono font-black text-xs shadow-lg active:translate-y-0.5 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={15} />
              <span>TEST TAB CRASH / REFRESH RECOVERY</span>
            </button>

            <button
              onClick={handleFactoryReset}
              className="py-3 px-4 rounded-2xl bg-sky-950/90 hover:bg-rose-500/30 text-rose-200 border border-rose-400/40 font-mono font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Trash2 size={15} />
              <span>NEW MATCH (CLEAR &amp; RESET 8:00)</span>
            </button>
          </div>
        </div>

        {/* CARD B: BLE EXPONENTIAL-BACKOFF AUTO-RECONNECT */}
        <div className="rounded-3xl bg-sky-900/75 border-2 border-cyan-400/35 p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bluetooth className="text-cyan-300" size={20} />
                <h3 className="text-lg font-black text-white">
                  BLE GATT Watchdog &amp; Auto-Reconnect
                </h3>
              </div>
              <button
                onClick={() => bleManager.setAutoReconnect(!bleTelemetry.autoReconnectEnabled)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase border cursor-pointer ${
                  bleTelemetry.autoReconnectEnabled
                    ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40'
                    : 'bg-sky-950 text-sky-300 border-cyan-400/20'
                }`}
              >
                {bleTelemetry.autoReconnectEnabled ? 'AUTO-RECONNECT ON' : 'AUTO-RECONNECT OFF'}
              </button>
            </div>
            <p className="text-xs text-cyan-100/80">
              Monitors <code className="text-cyan-300">gattserverdisconnected</code> events. On unexpected RF drop, automatically retries connection with exponential backoff (<code className="text-cyan-300">500ms &rarr; 1s &rarr; 2s &rarr; 4s &rarr; 8s</code>) and pushes live clock/score state back to the dongle.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center font-mono">
            <div className="p-2.5 rounded-xl bg-sky-950/80 border border-cyan-400/25">
              <span className="text-[10px] text-cyan-300/80 block">GATT STATUS</span>
              <span
                className={`text-xs font-black uppercase ${
                  bleStatus === 'connected'
                    ? 'text-emerald-300'
                    : bleStatus === 'reconnecting'
                    ? 'text-amber-300 animate-pulse'
                    : 'text-cyan-200'
                }`}
              >
                {bleStatus.toUpperCase()}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-950/80 border border-cyan-400/25">
              <span className="text-[10px] text-cyan-300/80 block">BACKOFF ATTEMPT</span>
              <span className="text-sm font-black text-white">
                {bleTelemetry.reconnectAttempt} / {bleTelemetry.maxAttempts}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-950/80 border border-cyan-400/25">
              <span className="text-[10px] text-cyan-300/80 block">RECOVERIES</span>
              <span className="text-sm font-black text-emerald-300">
                {bleTelemetry.totalReconnectSuccesses}
              </span>
            </div>
          </div>

          <button
            onClick={handleSimulateBleDrop}
            disabled={isSimulatingDrop}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-sky-950 font-mono font-black text-xs shadow-lg active:translate-y-0.5 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={15} className={isSimulatingDrop ? 'animate-spin' : ''} />
            <span>
              {isSimulatingDrop
                ? 'RECONNECTING GATT & RESYNCING CLOCKS...'
                : '⚡ SIMULATE RF DROP & AUTO-RECONNECT'}
            </span>
          </button>
        </div>
      </div>

      {/* 3. CHECKPOINT VAULT & PORTABLE JSON BACKUP */}
      <div className="rounded-3xl bg-sky-950/90 border-2 border-cyan-400/35 p-5 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/20 pb-3">
          <div>
            <h3 className="text-base font-black text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <Clock size={18} className="text-cyan-300" />
              <span>Match Time-Machine Checkpoints &amp; JSON Backup</span>
            </h3>
            <p className="text-xs text-cyan-200/80">
              Create named quarter checkpoints in IndexedDB or export a portable JSON match file for tournament directors.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-xl bg-sky-900 hover:bg-sky-800 text-cyan-200 border border-cyan-400/30 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} />
              <span>Export Match JSON</span>
            </button>

            <label className="px-3 py-1.5 rounded-xl bg-sky-900 hover:bg-sky-800 text-cyan-200 border border-cyan-400/30 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer">
              <Upload size={14} />
              <span>Import JSON</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportJson}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Create Checkpoint Form */}
        <form onSubmit={handleCreateCheckpoint} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={checkpointLabel}
            onChange={(e) => setCheckpointLabel(e.target.value)}
            placeholder="Checkpoint label (e.g., End of Q2, Before Penalty Review, Timeout 4:12)..."
            className="flex-1 min-w-[240px] px-3.5 py-2 rounded-xl bg-sky-900/70 border border-cyan-400/30 text-white font-mono text-xs placeholder:text-sky-300/60 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-sky-950 font-mono font-black text-xs cursor-pointer transition shadow"
          >
            + Save IndexedDB Checkpoint
          </button>
        </form>

        {/* Checkpoints List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {checkpoints.length === 0 ? (
            <div className="p-4 rounded-2xl bg-sky-900/40 border border-cyan-400/20 text-center text-xs font-mono text-cyan-200/70">
              No manual checkpoints saved yet. Live 100ms state is continuously auto-saved in the primary store.
            </div>
          ) : (
            checkpoints.map((cp) => (
              <div
                key={cp.id}
                className="p-3 rounded-2xl bg-sky-900/60 border border-cyan-400/25 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
              >
                <div>
                  <span className="font-black text-white block">
                    {cp.label || `Checkpoint ${cp.id}`}
                  </span>
                  <span className="text-[11px] text-cyan-200/80">
                    Q{cp.period} ({formatTime(cp.gameTimeMs)} / {Math.ceil(cp.shotTimeMs / 1000)}s) •{' '}
                    {cp.teamWhiteName} {cp.scoreWhite} - {cp.scoreDark} {cp.teamDarkName} • Saved{' '}
                    {new Date(cp.savedAtMs).toLocaleTimeString()}
                  </span>
                </div>
                <button
                  onClick={() => handleRestoreCheckpoint(cp)}
                  className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-sky-950 font-black text-xs cursor-pointer transition"
                >
                  Restore State
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
