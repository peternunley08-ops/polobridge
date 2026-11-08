import React, { useState } from 'react';
import {
  Trophy, Cloud, RefreshCw, CheckCircle2, AlertTriangle,
  Users, Activity, Download, ExternalLink, ShieldAlert, PlusCircle, Send
} from 'lucide-react';
import {
  SixEightMatchPreset,
  SixEightPlayer,
  SixEightGameEvent,
  SixEightSyncMode,
  PRESET_68_MATCHES,
  sixEightClient,
} from '../engine/six-eight-sports';

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
  const [customGameId, setCustomGameId] = useState(activeMatch.gameId);
  const [webhookUrl, setWebhookUrl] = useState(sixEightClient.getWebhookUrl());
  const [apiKey, setApiKey] = useState('68_live_pk_99482a7f3c1e');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const handleLoadPreset = (preset: SixEightMatchPreset) => {
    setCustomGameId(preset.gameId);
    onSelectMatch(preset);
    if (syncMode === 'disconnected') {
      onChangeSyncMode('cloud_live');
    }
    setStatusBanner(`Loaded 6-8 Sports Match ${preset.gameId} (${preset.teamWhiteName} vs. ${preset.teamDarkName})`);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handleExportJson = () => {
    const payload = {
      platform: '6-8 Sports Official Game Desk Export',
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
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `68sports_gamedesk_${customGameId}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
    <div className="flex-1 p-6 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/30 via-sky-900 to-indigo-950 space-y-6">
      
      {/* Top 6-8 Sports Connection & Match Loader Bar */}
      <div className="max-w-6xl mx-auto rounded-3xl bg-gradient-to-r from-sky-800/90 via-blue-900/95 to-indigo-950/95 border-2 border-cyan-400/50 p-6 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-400/30 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 flex flex-col items-center justify-center font-black text-white shadow-lg shadow-orange-500/30 border border-white/40">
              <span className="text-base leading-none tracking-tighter">6-8</span>
              <span className="text-[8px] font-mono tracking-widest uppercase">SPORTS</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-black tracking-tight text-white">
                  6-8 Sports Live Game Desk &amp; Roster Bridge
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1.5 ${
                    syncMode === 'cloud_live'
                      ? 'bg-emerald-400/20 text-emerald-200 border-emerald-400/50'
                      : syncMode === 'local_bridge'
                      ? 'bg-cyan-400/20 text-cyan-200 border-cyan-400/50'
                      : 'bg-rose-500/20 text-rose-200 border-rose-400/40'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      syncMode === 'disconnected' ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'
                    }`}
                  />
                  {syncMode === 'cloud_live'
                    ? '6-8 CLOUD LIVE SYNC'
                    : syncMode === 'local_bridge'
                    ? 'LOCAL TABLET BRIDGE'
                    : 'OFFLINE / STANDALONE'}
                </span>
              </div>
              <p className="text-xs text-cyan-200/90 mt-0.5">
                Official bi-directional integration with <strong>scores.6-8sports.com</strong> &amp; <strong>6-8 Game Desk</strong> — syncs cap rosters, PI ratings, 3-foul cap-outs, and live play-by-play.
              </p>
            </div>
          </div>

          {/* Connection Mode Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex bg-sky-950/80 p-1 rounded-xl border border-cyan-400/30 text-xs font-mono">
              <button
                onClick={() => onChangeSyncMode('cloud_live')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  syncMode === 'cloud_live'
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-sky-950 shadow'
                    : 'text-sky-200 hover:text-white'
                }`}
              >
                <Cloud size={13} />
                <span>6-8 Cloud Live</span>
              </button>
              <button
                onClick={() => onChangeSyncMode('local_bridge')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  syncMode === 'local_bridge'
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-sky-950 shadow'
                    : 'text-sky-200 hover:text-white'
                }`}
              >
                <Activity size={13} />
                <span>Local Desk Bridge</span>
              </button>
              <button
                onClick={() => onChangeSyncMode('disconnected')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  syncMode === 'disconnected'
                    ? 'bg-rose-500 text-white shadow'
                    : 'text-sky-300/70 hover:text-white'
                }`}
              >
                Disconnect
              </button>
            </div>

            <button
              onClick={handleExportJson}
              className="px-3.5 py-2 rounded-xl bg-amber-400/25 hover:bg-amber-400/35 border border-amber-300/50 text-amber-200 text-xs font-mono font-bold flex items-center gap-1.5 transition"
            >
              <Download size={13} />
              <span>Export 6-8 JSON</span>
            </button>
          </div>
        </div>

        {/* Status Confirmation Banner */}
        {statusBanner && (
          <div className="px-4 py-2.5 rounded-xl bg-emerald-500/25 border border-emerald-300/50 text-emerald-100 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-300" />
              <span>{statusBanner}</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-emerald-200">Rosters &amp; Scoreboard Synced</span>
          </div>
        )}

        {/* Tournament Match Selector & Endpoint Configuration */}
        <div className="grid grid-cols-[1.5fr_1fr] gap-5">
          {/* Preset Tournament Matches */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono font-bold text-cyan-200 uppercase tracking-wider flex items-center justify-between">
              <span>1. Select Active 6-8 Sports Tournament Game</span>
              <a
                href="https://scores.6-8sports.com"
                target="_blank"
                rel="noreferrer"
                className="text-amber-300 hover:text-amber-200 flex items-center gap-1 underline"
              >
                <span>scores.6-8sports.com</span>
                <ExternalLink size={11} />
              </a>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {PRESET_68_MATCHES.map((preset) => {
                const isSelected = activeMatch.gameId === preset.gameId;
                return (
                  <button
                    key={preset.gameId}
                    onClick={() => handleLoadPreset(preset)}
                    className={`p-3 rounded-2xl text-left border transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-b from-cyan-500/30 to-blue-600/40 border-cyan-300 shadow-lg shadow-cyan-500/20'
                        : 'bg-sky-950/60 hover:bg-sky-900/70 border-cyan-400/25'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-amber-300 font-bold">
                        <span>{preset.gameId}</span>
                        {isSelected && <CheckCircle2 size={12} className="text-emerald-300" />}
                      </div>
                      <div className="text-xs font-black text-white mt-1">
                        {preset.teamWhiteName} vs. {preset.teamDarkName}
                      </div>
                      <div className="text-[10px] text-cyan-200/80 truncate mt-0.5">
                        {preset.tournament}
                      </div>
                    </div>
                    <div className="text-[9px] font-mono text-sky-300 mt-2 pt-1.5 border-t border-cyan-400/20">
                      {preset.division}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key & Game ID Manual Override */}
          <div className="rounded-2xl bg-sky-950/70 border border-cyan-400/30 p-3.5 flex flex-col justify-between space-y-2">
            <div className="text-[10px] font-mono font-bold text-cyan-200 uppercase tracking-wider flex items-center justify-between">
              <span>2. 6-8 Game Desk API / Webhook Credentials</span>
              <span className="text-emerald-300">TLS 1.3 Ready</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-mono text-sky-300 block mb-0.5">6-8 GAME ID</label>
                <input
                  type="text"
                  value={customGameId}
                  onChange={(e) => setCustomGameId(e.target.value)}
                  className="w-full px-2.5 py-1 rounded-lg bg-sky-900/80 border border-cyan-400/30 text-xs font-mono text-white focus:outline-none focus:border-cyan-300"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono text-sky-300 block mb-0.5">DESK ACCESS TOKEN</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    sixEightClient.setCredentials(webhookUrl, e.target.value);
                  }}
                  className="w-full px-2.5 py-1 rounded-lg bg-sky-900/80 border border-cyan-400/30 text-xs font-mono text-white focus:outline-none focus:border-cyan-300"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => {
                  setWebhookUrl(e.target.value);
                  sixEightClient.setCredentials(e.target.value, apiKey);
                }}
                placeholder="https://api.6-8sports.com/v1/gamedesk/telemetry"
                className="flex-1 px-2.5 py-1 rounded-lg bg-sky-900/80 border border-cyan-400/30 text-[11px] font-mono text-cyan-200 focus:outline-none"
              />
              <button
                onClick={() => {
                  onForceSyncNow();
                  setStatusBanner(`Pushed full scoreboard & clock snapshot to 6-8 Game Desk (${customGameId})`);
                  setTimeout(() => setStatusBanner(null), 3500);
                }}
                className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 text-sky-950 font-mono font-black text-[11px] flex items-center gap-1 shadow hover:brightness-110 transition"
              >
                <Send size={11} />
                <span>PUSH SYNC</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-Column Roster & Live Play-by-Play Telemetry Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-[1fr_1fr_1.1fr] gap-5">
        
        {/* COLUMN 1: WHITE CAP ROSTER & 6-8 PI RATINGS */}
        <div className="rounded-3xl bg-gradient-to-b from-sky-800/85 via-sky-900/90 to-blue-950/95 border-2 border-white/40 p-5 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/20 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_#fff]" />
              <div>
                <h2 className="text-sm font-black text-white">{activeMatch.teamWhiteName} (WHITE CAPS)</h2>
                <p className="text-[10px] font-mono text-cyan-200">{activeMatch.teamWhiteClub}</p>
              </div>
            </div>
            <span className="text-2xl font-black font-mono text-white bg-white/15 px-3 py-0.5 rounded-xl border border-white/30">
              {scoreWhite}
            </span>
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-[420px] pr-1">
            {whiteRoster.map((player) => {
              const isCappedOut = player.exclusions >= 3;
              return (
                <div
                  key={player.cap}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                    isCappedOut
                      ? 'bg-rose-950/60 border-rose-400/50 opacity-75'
                      : 'bg-sky-950/65 hover:bg-sky-900/80 border-cyan-400/25'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-white text-sky-950 font-mono font-black text-xs flex items-center justify-center shadow">
                      #{player.cap}
                    </span>
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{player.name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">
                          PI {player.piScore}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {renderFoulDots(player.exclusions)}
                        <span className="text-[10px] font-mono text-sky-200">
                          {player.goals}G &bull; {player.steals}STL
                        </span>
                        {isCappedOut && (
                          <span className="text-[9px] font-mono font-black text-rose-300 bg-rose-500/30 px-1.5 rounded">
                            3RD FOUL OUT
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick 6-8 Desk Triggers */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onRecordPlayerGoal('white', player.cap)}
                      className="px-2 py-1 rounded-lg bg-emerald-400/25 hover:bg-emerald-400/40 border border-emerald-300/40 text-emerald-200 font-mono font-bold text-[10px] transition"
                      title="Record Goal in 6-8 Game Desk & Reset 30s"
                    >
                      +GOAL
                    </button>
                    <button
                      onClick={() => onRecordPlayerExclusion('white', player.cap)}
                      disabled={isCappedOut}
                      className="px-2 py-1 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 border border-rose-300/40 text-rose-200 font-mono font-bold text-[10px] disabled:opacity-30 transition"
                      title="Record 20s Exclusion in 6-8 Game Desk & Reset 20s"
                    >
                      +EJECT
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 2: DARK CAP ROSTER & 6-8 PI RATINGS */}
        <div className="rounded-3xl bg-gradient-to-b from-blue-800/85 via-indigo-900/90 to-indigo-950/95 border-2 border-cyan-400/50 p-5 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-cyan-400/25 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
              <div>
                <h2 className="text-sm font-black text-cyan-200">{activeMatch.teamDarkName} (DARK CAPS)</h2>
                <p className="text-[10px] font-mono text-sky-300">{activeMatch.teamDarkClub}</p>
              </div>
            </div>
            <span className="text-2xl font-black font-mono text-cyan-300 bg-cyan-400/15 px-3 py-0.5 rounded-xl border border-cyan-400/30">
              {scoreDark}
            </span>
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-[420px] pr-1">
            {darkRoster.map((player) => {
              const isCappedOut = player.exclusions >= 3;
              return (
                <div
                  key={player.cap}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                    isCappedOut
                      ? 'bg-rose-950/60 border-rose-400/50 opacity-75'
                      : 'bg-indigo-950/70 hover:bg-indigo-900/80 border-cyan-400/25'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-b from-cyan-400 to-blue-600 text-white font-mono font-black text-xs flex items-center justify-center shadow">
                      #{player.cap}
                    </span>
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{player.name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200 border border-amber-400/30">
                          PI {player.piScore}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {renderFoulDots(player.exclusions)}
                        <span className="text-[10px] font-mono text-sky-200">
                          {player.goals}G &bull; {player.steals}STL
                        </span>
                        {isCappedOut && (
                          <span className="text-[9px] font-mono font-black text-rose-300 bg-rose-500/30 px-1.5 rounded">
                            3RD FOUL OUT
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick 6-8 Desk Triggers */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onRecordPlayerGoal('dark', player.cap)}
                      className="px-2 py-1 rounded-lg bg-emerald-400/25 hover:bg-emerald-400/40 border border-emerald-300/40 text-emerald-200 font-mono font-bold text-[10px] transition"
                      title="Record Goal in 6-8 Game Desk & Reset 30s"
                    >
                      +GOAL
                    </button>
                    <button
                      onClick={() => onRecordPlayerExclusion('dark', player.cap)}
                      disabled={isCappedOut}
                      className="px-2 py-1 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 border border-rose-300/40 text-rose-200 font-mono font-bold text-[10px] disabled:opacity-30 transition"
                      title="Record 20s Exclusion in 6-8 Game Desk & Reset 20s"
                    >
                      +EJECT
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 3: LIVE 6-8 GAME DESK PLAY-BY-PLAY TELEMETRY FEED */}
        <div className="rounded-3xl bg-gradient-to-b from-sky-900/90 to-indigo-950/95 border-2 border-cyan-400/40 p-5 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-cyan-400/25 mb-3">
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Activity size={15} className="text-amber-300" />
                <span>6-8 Live Play-by-Play Feed</span>
              </h2>
              <p className="text-[10px] font-mono text-cyan-200">
                Real-Time JSON Packets to 6-8 Game Desk
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">
              {events.length} Events
            </span>
          </div>

          <div className="flex-1 bg-sky-950/90 rounded-2xl p-3.5 border border-cyan-400/30 overflow-y-auto max-h-[420px] space-y-2 font-mono text-xs shadow-inner">
            {events.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-sky-300/70 py-12">
                <Trophy size={28} className="text-cyan-400/50 mb-2" />
                <div>No match events logged yet.</div>
                <div className="text-[10px] mt-1">
                  Score a goal, trigger an exclusion, or reset the shot clock to stream live packets to 6-8 Sports.
                </div>
              </div>
            ) : (
              events.map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-xl bg-sky-900/60 border border-cyan-400/20 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-amber-300">
                      Q{evt.period} &bull; {evt.gameClock} (Shot: {evt.shotClock})
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 text-[9px]">
                      {evt.synced ? '6-8 SYNCED' : 'LOCAL QUEUE'}
                    </span>
                  </div>
                  <div className="text-white font-bold text-xs">{evt.description}</div>
                  <div className="flex items-center justify-between text-[10px] text-cyan-200/80">
                    <span>Type: {evt.type}</span>
                    <span>Score: {evt.scoreSnapshot}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
