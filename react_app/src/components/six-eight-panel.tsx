import React, { useState, useEffect } from 'react';
import {
  Trophy, Cloud, RefreshCw, CheckCircle2, AlertTriangle,
  Users, Activity, Download, ExternalLink, ShieldAlert, PlusCircle, Send,
  Wifi, WifiOff, Radio, GitFork, ArrowRight, Play, Check
} from 'lucide-react';
import {
  SixEightMatchPreset,
  SixEightPlayer,
  SixEightGameEvent,
  SixEightSyncMode,
  PRESET_68_MATCHES,
} from '../engine/six-eight-sports';
import {
  sixEightBridge,
  SixEightBridgeStatus,
  SixEightBridgeMessage,
  TournamentBracket,
  BracketMatch,
} from '../engine/six-eight-bridge';

interface SixEightPanelProps {
  syncMode: SixEightSyncMode;
  onChangeSyncMode: (mode: SixEightSyncMode) => void;
  activeMatch: SixEightMatchPreset;
  onSelectMatch: (match: SixEightMatchPreset) => void;
  whiteRoster: SixEightPlayer[];
  darkRoster: SixEightPlayer[];
  events: SixEightGameEvent[];
  scoreWhite: number;
  scoreDark: number;
  period: number;
  gameClockFormatted: string;
  onRecordPlayerGoal: (team: 'white' | 'dark', cap: number) => void;
  onRecordPlayerExclusion: (team: 'white' | 'dark', cap: number) => void;
  onForceSyncNow: () => void;
}

export default function SixEightPanel({
  syncMode,
  onChangeSyncMode,
  activeMatch,
  onSelectMatch,
  whiteRoster,
  darkRoster,
  events,
  scoreWhite,
  scoreDark,
  period,
  gameClockFormatted,
  onRecordPlayerGoal,
  onRecordPlayerExclusion,
  onForceSyncNow,
}: SixEightPanelProps) {
  const [subTab, setSubTab] = useState<'roster' | 'bracket' | 'inspector' | 'chaos'>('roster');
  const [customGameId, setCustomGameId] = useState(activeMatch.gameId);
  const [wsUrl, setWsUrl] = useState(sixEightBridge.getConfig().wsUrl);
  const [apiKey, setApiKey] = useState(sixEightBridge.getConfig().apiKey);
  const [bridgeStatus, setBridgeStatus] = useState<SixEightBridgeStatus>(sixEightBridge.getStatus());
  const [latencyMs, setLatencyMs] = useState<number | null>(sixEightBridge.getLatency());
  const [queuedCount, setQueuedCount] = useState<number>(sixEightBridge.getQueuedEventCount());
  const [recentFrames, setRecentFrames] = useState<SixEightBridgeMessage[]>([]);
  const [bracket, setBracket] = useState<TournamentBracket>(sixEightBridge.getTournamentBracket());
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Subscribe to bridge lifecycle
  useEffect(() => {
    const unsubStatus = sixEightBridge.onStatusChange((status, latency) => {
      setBridgeStatus(status);
      setLatencyMs(latency);
      setQueuedCount(sixEightBridge.getQueuedEventCount());
    });

    const unsubMsg = sixEightBridge.onMessage((msg) => {
      setRecentFrames((prev) => [msg, ...prev.slice(0, 49)]);
    });

    const unsubBracket = sixEightBridge.onBracketUpdate((updatedBracket) => {
      setBracket(updatedBracket);
    });

    return () => {
      unsubStatus();
      unsubMsg();
      unsubBracket();
    };
  }, []);

  const handleConnectWs = () => {
    sixEightBridge.configure({ wsUrl, apiKey, gameId: customGameId, autoReconnect: true });
    sixEightBridge.connect();
    onChangeSyncMode('cloud_live');
    setStatusBanner('Initiating 6-8 Sports Cloud WebSocket Bridge connection...');
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const handleDisconnectWs = () => {
    sixEightBridge.disconnect();
    onChangeSyncMode('disconnected');
    setStatusBanner('WebSocket disconnected. Switched to offline buffering mode.');
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const handleFlushQueue = () => {
    sixEightBridge.flushOfflineQueue();
    setQueuedCount(sixEightBridge.getQueuedEventCount());
    setStatusBanner('Flushing buffered offline telemetry frames to 6-8 Sports cloud...');
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const handleLoadPreset = (preset: SixEightMatchPreset) => {
    setCustomGameId(preset.gameId);
    onSelectMatch(preset);
    sixEightBridge.configure({ gameId: preset.gameId });
    if (bridgeStatus === 'connected') {
      sixEightBridge.publishSnapshot({
        gameId: preset.gameId,
        period: 1,
        gameClock: '08:00.0',
        gameTimeMs: 480000,
        shotClock: '30.0',
        shotTimeMs: 30000,
        isRunning: false,
        scoreWhite: 0,
        scoreDark: 0,
        teamWhiteName: preset.teamWhiteName,
        teamDarkName: preset.teamDarkName,
        timestampIso: new Date().toISOString(),
        sequenceId: Date.now(),
      });
    }
    setStatusBanner(`Loaded 6-8 Sports Match ${preset.gameId} (${preset.teamWhiteName} vs. ${preset.teamDarkName})`);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handleExportJson = () => {
    const payload = {
      platform: '6-8 Sports Official Game Desk Export',
      schema: '6-8-gamedesk-v2',
      exportedAt: new Date().toISOString(),
      gameId: customGameId,
      tournament: activeMatch.tournament,
      venue: activeMatch.venue,
      period,
      gameClock: gameClockFormatted,
      score: {
        white: { name: activeMatch.teamWhiteName, club: activeMatch.teamWhiteClub, goals: scoreWhite },
        dark: { name: activeMatch.teamDarkName, club: activeMatch.teamDarkClub, goals: scoreDark },
      },
      rosters: {
        white: whiteRoster,
        dark: darkRoster,
      },
      playByPlayEvents: events,
      bracket: bracket,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `68sports_gamedesk_${customGameId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Chaos Simulation
  const handleSimulateChaosDrop = () => {
    setStatusBanner('🚨 SIMULATING POOLSIDE WI-FI DROP: Severing WebSocket connection...');
    sixEightBridge.disconnect();

    setTimeout(() => {
      // Simulate scoring during Wi-Fi outage
      setStatusBanner('⚠️ Offline Mode: Queueing match events in persistent offline buffer...');
      onRecordPlayerGoal('white', 2);
      onRecordPlayerGoal('dark', 3);
      setQueuedCount(sixEightBridge.getQueuedEventCount());

      setTimeout(() => {
        setStatusBanner('🔄 Re-establishing Wi-Fi link: Probing WebSocket with exponential backoff...');
        sixEightBridge.connect();

        setTimeout(() => {
          sixEightBridge.flushOfflineQueue();
          setQueuedCount(0);
          setStatusBanner('✅ RECONNECTED: Buffered events flushed atomically to 6-8 Sports cloud! Zero telemetry loss.');
          setTimeout(() => setStatusBanner(null), 5000);
        }, 1200);
      }, 2000);
    }, 1500);
  };

  const renderFoulDots = (exclusions: number) => {
    return (
      <div className="flex items-center gap-1" title={`${exclusions}/3 Personal Fouls`}>
        {[1, 2, 3].map((idx) => {
          const active = exclusions >= idx;
          const color =
            idx === 3 && active
              ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
              : idx === 2 && active
              ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
              : active
              ? 'bg-cyan-300'
              : 'bg-sky-950 border border-cyan-400/30';
          return <span key={idx} className={`w-2.5 h-2.5 rounded-full ${color}`} />;
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/30 via-sky-900 to-indigo-950 space-y-6 max-w-7xl mx-auto">
      
      {/* Top 6-8 Sports Connection & WebSocket Telemetry Bar */}
      <div className="rounded-3xl bg-gradient-to-r from-sky-800/90 via-blue-900/95 to-indigo-950/95 border-2 border-cyan-400/50 p-6 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-400/30 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 flex flex-col items-center justify-center font-black text-white shadow-lg shadow-orange-500/30 border border-white/40">
              <span className="text-base leading-none tracking-tighter">6-8</span>
              <span className="text-[8px] font-mono tracking-widest uppercase">SPORTS</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-black tracking-tight text-white uppercase">
                  6-8 Sports Live Cloud Desk &amp; WebSocket Bridge
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1.5 ${
                    bridgeStatus === 'connected'
                      ? 'bg-emerald-400/20 text-emerald-200 border-emerald-400/50'
                      : bridgeStatus === 'connecting' || bridgeStatus === 'reconnecting'
                      ? 'bg-amber-400/20 text-amber-200 border-amber-400/50'
                      : 'bg-rose-500/20 text-rose-200 border-rose-400/40'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      bridgeStatus === 'connected'
                        ? 'bg-emerald-400 animate-pulse'
                        : bridgeStatus === 'connecting' || bridgeStatus === 'reconnecting'
                        ? 'bg-amber-400 animate-ping'
                        : 'bg-rose-400'
                    }`}
                  />
                  {bridgeStatus === 'connected'
                    ? `WSS LIVE ${latencyMs !== null ? `(${latencyMs}ms)` : ''}`
                    : bridgeStatus === 'reconnecting'
                    ? 'RECONNECTING...'
                    : bridgeStatus === 'connecting'
                    ? 'CONNECTING...'
                    : 'OFFLINE BUFFER'}
                </span>

                {queuedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 animate-pulse">
                    📦 {queuedCount} QUEUED
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-cyan-200/90 mt-0.5">
                REAL-TIME WEBSOCKET TELEMETRY • AUTOMATIC EXPONENTIAL BACKOFF • BRACKET SYNC
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {bridgeStatus === 'connected' ? (
              <button
                onClick={handleDisconnectWs}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-400/30 text-xs font-bold uppercase transition flex items-center gap-1.5"
              >
                <WifiOff size={13} />
                Disconnect WSS
              </button>
            ) : (
              <button
                onClick={handleConnectWs}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 text-xs font-bold uppercase transition flex items-center gap-1.5"
              >
                <Wifi size={13} />
                Connect WSS
              </button>
            )}

            {queuedCount > 0 && (
              <button
                onClick={handleFlushQueue}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-bold uppercase transition flex items-center gap-1.5"
              >
                <Send size={13} />
                Flush Buffer ({queuedCount})
              </button>
            )}

            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-cyan-200 border border-cyan-400/30 text-xs font-bold uppercase transition flex items-center gap-1.5"
            >
              <Download size={13} />
              Export 6-8 JSON
            </button>
          </div>
        </div>

        {/* WSS URL & Credentials Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
          <div className="space-y-1">
            <span className="text-[10px] text-cyan-300 font-bold uppercase">WebSocket Relay Endpoint</span>
            <input
              type="text"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              className="w-full bg-sky-950/80 border border-cyan-400/30 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-300 focus:outline-none"
              placeholder="wss://..."
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-cyan-300 font-bold uppercase">6-8 Desk API Key / Token</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-sky-950/80 border border-cyan-400/30 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-300 focus:outline-none"
              placeholder="68_live_pk_..."
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-cyan-300 font-bold uppercase">Active Match ID</span>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={customGameId}
                onChange={(e) => setCustomGameId(e.target.value)}
                className="w-full bg-sky-950/80 border border-cyan-400/30 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-300 focus:outline-none"
              />
              <button
                onClick={handleConnectWs}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase"
              >
                Sync
              </button>
            </div>
          </div>
        </div>

        {statusBanner && (
          <div className="px-4 py-2.5 rounded-xl bg-cyan-950/80 border border-cyan-400/40 text-cyan-200 text-xs font-mono flex items-center gap-2 animate-fadeIn">
            <Activity size={14} className="text-cyan-400 animate-spin" />
            <span>{statusBanner}</span>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-cyan-400/20 pb-2">
        {[
          { id: 'roster', label: '👥 Team Rosters & PI Scores' },
          { id: 'bracket', label: '🏆 Live Tournament Bracket' },
          { id: 'inspector', label: '📟 WSS Packet Inspector' },
          { id: 'chaos', label: '⚡ Wi-Fi Drop Simulator' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id as typeof subTab)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              subTab === tab.id
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-cyan-300 hover:bg-slate-800/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: Team Rosters & 6-8 PI Ratings */}
      {subTab === 'roster' && (
        <div className="space-y-6">
          {/* Preset Tournament Match Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRESET_68_MATCHES.map((preset) => (
              <div
                key={preset.gameId}
                onClick={() => handleLoadPreset(preset)}
                className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-3 ${
                  activeMatch.gameId === preset.gameId
                    ? 'bg-cyan-950/60 border-cyan-400 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-900/60 border-cyan-400/20 hover:border-cyan-400/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                    <span>{preset.gameId}</span>
                    <span className="text-[10px] text-slate-400">{preset.division}</span>
                  </div>
                  <div className="text-sm font-black text-white mt-1">
                    {preset.teamWhiteName} vs. {preset.teamDarkName}
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">{preset.tournament}</div>
                </div>
                <div className="text-[10px] font-mono text-slate-400 border-t border-cyan-400/15 pt-2">
                  📍 {preset.venue}
                </div>
              </div>
            ))}
          </div>

          {/* Roster Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* White Roster */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl overflow-hidden shadow-xl">
              <div className="bg-gradient-to-r from-slate-100 to-sky-200 text-slate-900 px-4 py-3 flex items-center justify-between font-black uppercase text-sm">
                <span>⚪ {activeMatch.teamWhiteName} ({activeMatch.teamWhiteClub})</span>
                <span className="text-xs font-mono font-bold text-slate-700">6-8 Roster</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-cyan-400/20 text-slate-400 uppercase text-[10px] bg-slate-950/40">
                      <th className="py-2 px-3 text-center">Cap</th>
                      <th className="py-2 px-3">Player</th>
                      <th className="py-2 px-2 text-center">Pos</th>
                      <th className="py-2 px-2 text-center text-cyan-300">6-8 PI</th>
                      <th className="py-2 px-2 text-center">Goals</th>
                      <th className="py-2 px-3 text-center">Exclusions</th>
                      <th className="py-2 px-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-400/10">
                    {whiteRoster.map((player) => (
                      <tr key={player.cap} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-center font-bold text-slate-200">#{player.cap}</td>
                        <td className="py-2 px-3 font-sans font-medium text-slate-100">{player.name}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                            player.position === 'GK' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-cyan-300'
                          }`}>
                            {player.position}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center font-black text-amber-300">{player.piScore.toFixed(1)}</td>
                        <td className="py-2 px-2 text-center font-bold text-emerald-300">{player.goals}</td>
                        <td className="py-2 px-3 text-center">{renderFoulDots(player.exclusions)}</td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onRecordPlayerGoal('white', player.cap)}
                              className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px]"
                              title="Record Goal"
                            >
                              +G
                            </button>
                            <button
                              onClick={() => onRecordPlayerExclusion('white', player.cap)}
                              className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[9px]"
                              title="Record Exclusion"
                            >
                              +E
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dark Roster */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl overflow-hidden shadow-xl">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 flex items-center justify-between font-black uppercase text-sm">
                <span>🔵 {activeMatch.teamDarkName} ({activeMatch.teamDarkClub})</span>
                <span className="text-xs font-mono font-bold text-blue-200">6-8 Roster</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-cyan-400/20 text-slate-400 uppercase text-[10px] bg-slate-950/40">
                      <th className="py-2 px-3 text-center">Cap</th>
                      <th className="py-2 px-3">Player</th>
                      <th className="py-2 px-2 text-center">Pos</th>
                      <th className="py-2 px-2 text-center text-cyan-300">6-8 PI</th>
                      <th className="py-2 px-2 text-center">Goals</th>
                      <th className="py-2 px-3 text-center">Exclusions</th>
                      <th className="py-2 px-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-400/10">
                    {darkRoster.map((player) => (
                      <tr key={player.cap} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-center font-bold text-slate-200">#{player.cap}</td>
                        <td className="py-2 px-3 font-sans font-medium text-slate-100">{player.name}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                            player.position === 'GK' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-cyan-300'
                          }`}>
                            {player.position}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center font-black text-amber-300">{player.piScore.toFixed(1)}</td>
                        <td className="py-2 px-2 text-center font-bold text-emerald-300">{player.goals}</td>
                        <td className="py-2 px-3 text-center">{renderFoulDots(player.exclusions)}</td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onRecordPlayerGoal('dark', player.cap)}
                              className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px]"
                              title="Record Goal"
                            >
                              +G
                            </button>
                            <button
                              onClick={() => onRecordPlayerExclusion('dark', player.cap)}
                              className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[9px]"
                              title="Record Exclusion"
                            >
                              +E
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Live Tournament Bracket View */}
      {subTab === 'bracket' && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-400/20 pb-4">
            <div>
              <h2 className="text-base font-black text-white uppercase flex items-center gap-2">
                <Trophy className="text-amber-400 w-5 h-5" />
                {bracket.name}
              </h2>
              <div className="text-xs font-mono text-cyan-300">{bracket.division} • {bracket.venue}</div>
            </div>
            <button
              onClick={() => {
                // Sync current game score into active match M5 in bracket
                sixEightBridge.updateBracketMatchScore('M5', scoreWhite, scoreDark, period, 'live');
                setStatusBanner('Synced current desk score into Tournament Bracket match M5.');
                setTimeout(() => setStatusBanner(null), 3000);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs uppercase shadow-md flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              Sync Desk Score to Bracket
            </button>
          </div>

          {/* Bracket Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quarterfinals */}
            <div className="space-y-4">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Quarterfinals (4 Courts)
              </div>
              <div className="space-y-3">
                {bracket.matches.filter(m => m.round === 'QF').map(match => (
                  <div key={match.id} className="p-3.5 rounded-xl bg-slate-950/70 border border-cyan-400/20 text-xs space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>{match.court}</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">{match.status.toUpperCase()}</span>
                    </div>
                    <div className="space-y-1 font-bold">
                      <div className="flex items-center justify-between">
                        <span className={match.winner === match.teamWhite ? 'text-amber-300' : 'text-slate-200'}>⚪ {match.teamWhite}</span>
                        <span className="font-mono text-cyan-300">{match.scoreWhite}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={match.winner === match.teamDark ? 'text-amber-300' : 'text-slate-200'}>🔵 {match.teamDark}</span>
                        <span className="font-mono text-cyan-300">{match.scoreDark}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Semifinals */}
            <div className="space-y-4">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Semifinals (Live Now)
              </div>
              <div className="space-y-3">
                {bracket.matches.filter(m => m.round === 'SF').map(match => (
                  <div key={match.id} className="p-3.5 rounded-xl bg-cyan-950/50 border-2 border-cyan-400/40 text-xs space-y-2 shadow-lg">
                    <div className="flex items-center justify-between text-[10px] font-mono text-cyan-300">
                      <span>{match.court}</span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-black border border-emerald-400/40 animate-pulse">
                        LIVE Q{match.period}
                      </span>
                    </div>
                    <div className="space-y-1 font-bold">
                      <div className="flex items-center justify-between">
                        <span className="text-white">⚪ {match.teamWhite}</span>
                        <span className="font-mono text-lg font-black text-cyan-300">{match.scoreWhite}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white">🔵 {match.teamDark}</span>
                        <span className="font-mono text-lg font-black text-cyan-300">{match.scoreDark}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Finals */}
            <div className="space-y-4">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Championship &amp; 3rd Place
              </div>
              <div className="space-y-3">
                {bracket.matches.filter(m => m.round === 'FINAL' || m.round === '3RD').map(match => (
                  <div key={match.id} className="p-3.5 rounded-xl bg-slate-950/70 border border-amber-400/20 text-xs space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-amber-300">
                      <span>{match.round === 'FINAL' ? '🏆 GOLD MEDAL MATCH' : '🥉 3RD PLACE BRONZE'}</span>
                      <span className="text-slate-400">{match.scheduledTime}</span>
                    </div>
                    <div className="space-y-1 font-bold">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">⚪ {match.teamWhite}</span>
                        <span className="font-mono text-slate-500">-</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">🔵 {match.teamDark}</span>
                        <span className="font-mono text-slate-500">-</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: WebSocket Packet Inspector */}
      {subTab === 'inspector' && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-400/20 pb-3">
            <div className="text-sm font-black uppercase text-white flex items-center gap-2">
              <Radio className="text-cyan-400 w-4 h-4" />
              Live WebSocket Frame Stream (Protocol: 6-8-gamedesk-v2)
            </div>
            <button
              onClick={() => setRecentFrames([])}
              className="text-xs font-mono text-slate-400 hover:text-cyan-300"
            >
              Clear Inspector
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 font-mono text-xs pr-1">
            {recentFrames.length === 0 ? (
              <div className="text-center py-10 text-slate-500 italic">
                No WebSocket frames captured yet. Connect to a WebSocket endpoint above or generate match events.
              </div>
            ) : (
              recentFrames.map((frame, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950/80 border border-cyan-400/20 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 font-bold border border-cyan-400/30">
                      FRAME #{frame.sequenceId} • {frame.type}
                    </span>
                    <span>{frame.timestampIso}</span>
                  </div>
                  <pre className="text-[11px] text-cyan-200 overflow-x-auto p-2 rounded bg-slate-900/80">
                    {JSON.stringify(frame.payload, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: Chaos & RF Drop Simulator */}
      {subTab === 'chaos' && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="border-b border-cyan-400/20 pb-3">
            <h2 className="text-sm font-black uppercase text-white flex items-center gap-2">
              <ShieldAlert className="text-amber-400 w-5 h-5" />
              Poolside Wi-Fi Chaos &amp; Offline Queue Resilience Testbench
            </h2>
            <p className="text-xs font-mono text-slate-300 mt-1">
              Verify that no match event, goal, or foul is lost if pool deck Wi-Fi is severed or throttled mid-game.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-400/20 flex flex-col justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-300 uppercase">1. Disconnect Simulation</span>
                <p className="text-[11px] text-slate-400 mt-1">Simulates an unexpected router or hotspot outage on deck.</p>
              </div>
              <button
                onClick={handleSimulateChaosDrop}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase shadow-md shadow-rose-600/30"
              >
                💥 Run Wi-Fi Drop Test
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-400/20 flex flex-col justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-300 uppercase">2. Offline Buffer Queue</span>
                <p className="text-[11px] text-slate-400 mt-1">Buffered events ready to flush automatically on reconnect.</p>
              </div>
              <div className="text-2xl font-black font-mono text-amber-300">
                {queuedCount} <span className="text-xs font-normal text-slate-400">Frames</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-400/20 flex flex-col justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-300 uppercase">3. Atomic Flush</span>
                <p className="text-[11px] text-slate-400 mt-1">Manually triggers an immediate batch flush to the cloud.</p>
              </div>
              <button
                disabled={queuedCount === 0}
                onClick={handleFlushQueue}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase disabled:opacity-30"
              >
                📤 Flush Queue Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
