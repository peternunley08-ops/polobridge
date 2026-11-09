import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Copy,
  Check,
  UserPlus,
  AlertTriangle,
  ShieldAlert,
  Award,
  Clock,
  Waves
} from 'lucide-react';
import {
  TeamRoster,
  PlayerRecord,
  ScoresheetMetadata,
  MatchEventLogEntry,
  FoulType,
  recordPlayerGoal,
  recordPlayerFoul,
  recordGoalieSave,
  recordTeamTimeout,
  recordSprintWinner,
  getPlayerTotalGoals,
  isPlayerCappedOut,
  exportScoresheetCsv,
  generatePrintableScoresheetHtml
} from '../engine/roster-manager';

interface DigitalScoresheetPanelProps {
  whiteRoster: TeamRoster;
  blueRoster: TeamRoster;
  onUpdateWhiteRoster: (roster: TeamRoster) => void;
  onUpdateBlueRoster: (roster: TeamRoster) => void;
  eventLog: MatchEventLogEntry[];
  onAddEventLog: (entry: MatchEventLogEntry) => void;
  currentPeriod: number;
  currentGameTime: string;
  whiteScoreByPeriod: number[];
  blueScoreByPeriod: number[];
  onScoreIncrement?: (team: 'white' | 'blue') => void;
  onAddExclusion?: (team: 'white' | 'blue', capNumber: number) => void;
}

export const DigitalScoresheetPanel: React.FC<DigitalScoresheetPanelProps> = ({
  whiteRoster,
  blueRoster,
  onUpdateWhiteRoster,
  onUpdateBlueRoster,
  eventLog,
  onAddEventLog,
  currentPeriod,
  currentGameTime,
  whiteScoreByPeriod,
  blueScoreByPeriod,
  onScoreIncrement,
  onAddExclusion
}) => {
  const [metadata, setMetadata] = useState<ScoresheetMetadata>({
    eventTitle: 'CIF Section Finals / Varsity Invitational',
    gameNumber: 'Match #14',
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    poolLocation: 'Olympic Aquatic Center — Course A',
    referee1: 'M. Vardy (USAWP / FINA)',
    referee2: 'S. Krikorian (NFHS)',
    deskOfficial: 'Volunteer Table Desk 1',
    timerOfficial: 'Volunteer Table Desk 2'
  });

  const [activeTab, setActiveTab] = useState<'sheet' | 'quick-logger' | 'roster-edit'>('sheet');
  const [selectedTeam, setSelectedTeam] = useState<'white' | 'blue'>('white');
  const [selectedFoulType, setSelectedFoulType] = useState<FoulType>('E');
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Quick Action: Goal
  const handleQuickGoal = (capNumber: number) => {
    const isWhite = selectedTeam === 'white';
    const roster = isWhite ? whiteRoster : blueRoster;
    const { roster: updatedRoster, player } = recordPlayerGoal(roster, capNumber, currentPeriod);

    if (isWhite) onUpdateWhiteRoster(updatedRoster);
    else onUpdateBlueRoster(updatedRoster);

    if (onScoreIncrement) onScoreIncrement(selectedTeam);

    const now = new Date();
    const entry: MatchEventLogEntry = {
      id: 'evt_' + Date.now(),
      period: currentPeriod,
      gameTime: currentGameTime,
      team: selectedTeam,
      capNumber,
      playerName: player?.name,
      eventType: 'goal',
      description: `GOAL by Cap #${capNumber} (${player?.name || 'Unknown'}) in Q${currentPeriod}`,
      timestamp: now.toTimeString().split(' ')[0]
    };
    onAddEventLog(entry);
  };

  // Quick Action: Foul
  const handleQuickFoul = (capNumber: number) => {
    const isWhite = selectedTeam === 'white';
    const roster = isWhite ? whiteRoster : blueRoster;
    const { roster: updatedRoster, player, isCappedOut: capped } = recordPlayerFoul(
      roster,
      capNumber,
      currentPeriod,
      currentGameTime,
      selectedFoulType
    );

    if (isWhite) onUpdateWhiteRoster(updatedRoster);
    else onUpdateBlueRoster(updatedRoster);

    if (onAddExclusion) onAddExclusion(selectedTeam, capNumber);

    const now = new Date();
    const foulDesc = selectedFoulType === 'E' ? '20s Exclusion' : selectedFoulType === 'P' ? '5m Penalty Foul' : 'Major Misconduct (MAM)';
    const entry: MatchEventLogEntry = {
      id: 'evt_' + Date.now(),
      period: currentPeriod,
      gameTime: currentGameTime,
      team: selectedTeam,
      capNumber,
      playerName: player?.name,
      eventType: selectedFoulType === 'P' ? 'penalty' : 'exclusion',
      description: `${foulDesc} on Cap #${capNumber} (${player?.name || 'Player'}) [Foul #${player?.fouls.length || 1}]${capped ? ' ⚠️ CAPPED OUT (WP 22.3)' : ''}`,
      timestamp: now.toTimeString().split(' ')[0]
    };
    onAddEventLog(entry);
  };

  // Quick Action: Goalie Save
  const handleQuickSave = (capNumber: number) => {
    const isWhite = selectedTeam === 'white';
    const roster = isWhite ? whiteRoster : blueRoster;
    const { roster: updatedRoster, player } = recordGoalieSave(roster, capNumber);

    if (isWhite) onUpdateWhiteRoster(updatedRoster);
    else onUpdateBlueRoster(updatedRoster);

    const now = new Date();
    onAddEventLog({
      id: 'evt_' + Date.now(),
      period: currentPeriod,
      gameTime: currentGameTime,
      team: selectedTeam,
      capNumber,
      playerName: player?.name,
      eventType: 'save',
      description: `Goalkeeper Save by Cap #${capNumber} (${player?.name || 'Goalie'})`,
      timestamp: now.toTimeString().split(' ')[0]
    });
  };

  // Quick Action: Timeout
  const handleQuickTimeout = () => {
    const isWhite = selectedTeam === 'white';
    const roster = isWhite ? whiteRoster : blueRoster;
    const updated = recordTeamTimeout(roster, currentPeriod, currentGameTime, 'full');
    if (isWhite) onUpdateWhiteRoster(updated);
    else onUpdateBlueRoster(updated);

    const now = new Date();
    onAddEventLog({
      id: 'evt_' + Date.now(),
      period: currentPeriod,
      gameTime: currentGameTime,
      team: selectedTeam,
      eventType: 'timeout',
      description: `TIMEOUT called by ${roster.teamName} (Total: ${updated.timeouts.length})`,
      timestamp: now.toTimeString().split(' ')[0]
    });
  };

  // Quick Action: Sprint Won
  const handleQuickSprint = () => {
    const isWhite = selectedTeam === 'white';
    const roster = isWhite ? whiteRoster : blueRoster;
    const updated = recordSprintWinner(roster, currentPeriod);
    if (isWhite) onUpdateWhiteRoster(updated);
    else onUpdateBlueRoster(updated);

    const now = new Date();
    onAddEventLog({
      id: 'evt_' + Date.now(),
      period: currentPeriod,
      gameTime: currentGameTime,
      team: selectedTeam,
      eventType: 'sprint',
      description: `Sprint Won by ${roster.teamName} for Period ${currentPeriod}`,
      timestamp: now.toTimeString().split(' ')[0]
    });
  };

  // Edit Player Name
  const handlePlayerNameChange = (team: 'white' | 'blue', capNumber: number, newName: string) => {
    const isWhite = team === 'white';
    const roster = isWhite ? whiteRoster : blueRoster;
    const updatedPlayers = roster.players.map(p => p.capNumber === capNumber ? { ...p, name: newName } : p);
    if (isWhite) onUpdateWhiteRoster({ ...roster, players: updatedPlayers });
    else onUpdateBlueRoster({ ...roster, players: updatedPlayers });
  };

  // Export: Print HTML
  const handlePrintScoresheet = () => {
    const html = generatePrintableScoresheetHtml(
      metadata,
      whiteRoster,
      blueRoster,
      whiteScoreByPeriod,
      blueScoreByPeriod,
      eventLog
    );
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
    } else {
      window.print();
    }
  };

  // Export: CSV
  const handleExportCsv = () => {
    const csv = exportScoresheetCsv(metadata, whiteRoster, blueRoster, eventLog);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scoresheet_${metadata.gameNumber.replace(/\s+/g, '_')}_${whiteRoster.teamName}_vs_${blueRoster.teamName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy Summary Box Score
  const handleCopySummary = () => {
    const whiteTotal = whiteScoreByPeriod.reduce((a, b) => a + b, 0);
    const blueTotal = blueScoreByPeriod.reduce((a, b) => a + b, 0);
    const summary = [
      `🤽 POLOPAD PRO OFFICIAL BOX SCORE`,
      `${metadata.eventTitle} — ${metadata.gameNumber}`,
      `${whiteRoster.teamName} (White): ${whiteTotal} [${whiteScoreByPeriod.join('-')}]`,
      `${blueRoster.teamName} (Blue): ${blueTotal} [${blueScoreByPeriod.join('-')}]`,
      ``,
      `⚪ ${whiteRoster.teamName} Top Scorers:`,
      ...whiteRoster.players.filter(p => getPlayerTotalGoals(p) > 0).map(p => `  • Cap #${p.capNumber} ${p.name}: ${getPlayerTotalGoals(p)} goals`),
      ``,
      `🔵 ${blueRoster.teamName} Top Scorers:`,
      ...blueRoster.players.filter(p => getPlayerTotalGoals(p) > 0).map(p => `  • Cap #${p.capNumber} ${p.name}: ${getPlayerTotalGoals(p)} goals`),
      ``,
      `Live PWA: https://peternunley08-ops.github.io/polobridge/`
    ].join('\n');

    navigator.clipboard.writeText(summary);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  const activePlayers = selectedTeam === 'white' ? whiteRoster.players : blueRoster.players;
  const whiteTotal = whiteScoreByPeriod.reduce((a, b) => a + b, 0);
  const blueTotal = blueScoreByPeriod.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/30 rounded-2xl p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white uppercase flex items-center gap-2">
              Digital Scoresheet & Team Rosters
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                USAWP • NFHS
              </span>
            </h2>
            <p className="text-xs font-mono text-cyan-300 tracking-wider">
              CAP #1–20 TRACKING • RULE WP 22.3 CAP-OUT ENFORCEMENT • OFFICIAL PDF/CSV EXPORT
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrintScoresheet}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 active:translate-y-0.5 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF Scoresheet
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-800/80 hover:bg-slate-700/80 text-cyan-300 border border-cyan-400/30 active:translate-y-0.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-800/80 hover:bg-slate-700/80 text-cyan-300 border border-cyan-400/30 active:translate-y-0.5 transition"
          >
            {copiedNotice ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedNotice ? 'Copied!' : 'Copy Box Score'}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-cyan-400/20 pb-2">
        <button
          onClick={() => setActiveTab('sheet')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            activeTab === 'sheet'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
              : 'text-cyan-300 hover:bg-slate-800/60'
          }`}
        >
          📋 Official Scoresheet Table
        </button>
        <button
          onClick={() => setActiveTab('quick-logger')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            activeTab === 'quick-logger'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
              : 'text-cyan-300 hover:bg-slate-800/60'
          }`}
        >
          ⚡ Fast Cap Logger (Poolside)
        </button>
        <button
          onClick={() => setActiveTab('roster-edit')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            activeTab === 'roster-edit'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
              : 'text-cyan-300 hover:bg-slate-800/60'
          }`}
        >
          👥 Edit Rosters & Metadata
        </button>
      </div>

      {/* TAB 1: Official Scoresheet Grid View */}
      {activeTab === 'sheet' && (
        <div className="flex flex-col gap-6">
          {/* Quarter Score Summary Banner */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl p-4 shadow-xl overflow-x-auto">
            <table className="w-full text-center text-xs">
              <thead>
                <tr className="border-b border-cyan-400/20 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="text-left py-2 px-3">Team</th>
                  <th className="py-2 px-2">Q1</th>
                  <th className="py-2 px-2">Q2</th>
                  <th className="py-2 px-2">Q3</th>
                  <th className="py-2 px-2">Q4</th>
                  <th className="py-2 px-2">OT1</th>
                  <th className="py-2 px-2">OT2</th>
                  <th className="py-2 px-3 font-black text-cyan-300">Final</th>
                  <th className="py-2 px-2">Timeouts</th>
                  <th className="py-2 px-2">Sprints Won</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-400/10 font-mono">
                <tr>
                  <td className="text-left font-black text-white py-2.5 px-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-slate-100 shadow"></span>
                    {whiteRoster.teamName} (White)
                  </td>
                  <td className="py-2.5">{whiteScoreByPeriod[0] || 0}</td>
                  <td className="py-2.5">{whiteScoreByPeriod[1] || 0}</td>
                  <td className="py-2.5">{whiteScoreByPeriod[2] || 0}</td>
                  <td className="py-2.5">{whiteScoreByPeriod[3] || 0}</td>
                  <td className="py-2.5">{whiteScoreByPeriod[4] || 0}</td>
                  <td className="py-2.5">{whiteScoreByPeriod[5] || 0}</td>
                  <td className="py-2.5 px-3 font-black text-base text-cyan-300 bg-cyan-950/40">
                    {whiteTotal}
                  </td>
                  <td className="py-2.5 text-slate-400">{whiteRoster.timeouts.length}</td>
                  <td className="py-2.5 text-slate-400">{whiteRoster.sprintsWon.join(', ') || '-'}</td>
                </tr>
                <tr>
                  <td className="text-left font-black text-sky-400 py-2.5 px-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500 shadow"></span>
                    {blueRoster.teamName} (Blue)
                  </td>
                  <td className="py-2.5">{blueScoreByPeriod[0] || 0}</td>
                  <td className="py-2.5">{blueScoreByPeriod[1] || 0}</td>
                  <td className="py-2.5">{blueScoreByPeriod[2] || 0}</td>
                  <td className="py-2.5">{blueScoreByPeriod[3] || 0}</td>
                  <td className="py-2.5">{blueScoreByPeriod[4] || 0}</td>
                  <td className="py-2.5">{blueScoreByPeriod[5] || 0}</td>
                  <td className="py-2.5 px-3 font-black text-base text-cyan-300 bg-cyan-950/40">
                    {blueTotal}
                  </td>
                  <td className="py-2.5 text-slate-400">{blueRoster.timeouts.length}</td>
                  <td className="py-2.5 text-slate-400">{blueRoster.sprintsWon.join(', ') || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Side-by-Side Rosters Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* White Roster */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl overflow-hidden shadow-xl flex flex-col">
              <div className="bg-gradient-to-r from-slate-100 to-sky-200 text-slate-900 px-4 py-3 flex items-center justify-between font-black uppercase text-sm">
                <span className="flex items-center gap-2">⚪ {whiteRoster.teamName}</span>
                <span className="text-xs font-mono text-slate-700">Coach: {whiteRoster.coachName}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-cyan-400/20 text-slate-400 font-bold uppercase text-[10px] bg-slate-950/40">
                      <th className="py-2 px-2 text-center w-10">Cap</th>
                      <th className="py-2 px-3">Player Name</th>
                      <th className="py-2 px-1 text-center w-7">1</th>
                      <th className="py-2 px-1 text-center w-7">2</th>
                      <th className="py-2 px-1 text-center w-7">3</th>
                      <th className="py-2 px-1 text-center w-7">4</th>
                      <th className="py-2 px-2 text-center w-10 font-black text-cyan-300">G</th>
                      <th className="py-2 px-2 text-center">Foul 1</th>
                      <th className="py-2 px-2 text-center">Foul 2</th>
                      <th className="py-2 px-2 text-center">Foul 3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-400/10 font-mono">
                    {whiteRoster.players.map(p => {
                      const capped = isPlayerCappedOut(p);
                      const totalG = getPlayerTotalGoals(p);
                      return (
                        <tr key={p.capNumber} className={`${capped ? 'bg-rose-950/40 text-rose-300' : 'hover:bg-slate-800/40'}`}>
                          <td className="py-1.5 px-2 text-center font-bold text-slate-200">{p.capNumber}</td>
                          <td className="py-1.5 px-3 font-sans font-medium text-slate-100 flex items-center gap-1.5">
                            {p.name}
                            {p.isGoalie && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                GK
                              </span>
                            )}
                            {capped && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-600 text-white animate-pulse">
                                CAPPED OUT
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-1 text-center text-slate-300">{p.goalsByPeriod[0] || '-'}</td>
                          <td className="py-1.5 px-1 text-center text-slate-300">{p.goalsByPeriod[1] || '-'}</td>
                          <td className="py-1.5 px-1 text-center text-slate-300">{p.goalsByPeriod[2] || '-'}</td>
                          <td className="py-1.5 px-1 text-center text-slate-300">{p.goalsByPeriod[3] || '-'}</td>
                          <td className="py-1.5 px-2 text-center font-black text-cyan-300 bg-cyan-950/20">{totalG || '-'}</td>
                          <td className="py-1.5 px-2 text-center text-[10px]">
                            {p.fouls[0] ? `${p.fouls[0].foulType} (${p.fouls[0].gameTime})` : '-'}
                          </td>
                          <td className="py-1.5 px-2 text-center text-[10px]">
                            {p.fouls[1] ? `${p.fouls[1].foulType} (${p.fouls[1].gameTime})` : '-'}
                          </td>
                          <td className="py-1.5 px-2 text-center text-[10px] font-bold text-rose-400">
                            {p.fouls[2] ? `${p.fouls[2].foulType} (${p.fouls[2].gameTime})` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Blue Roster */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl overflow-hidden shadow-xl flex flex-col">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 flex items-center justify-between font-black uppercase text-sm">
                <span className="flex items-center gap-2">🔵 {blueRoster.teamName}</span>
                <span className="text-xs font-mono text-blue-200">Coach: {blueRoster.coachName}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-cyan-400/20 text-slate-400 font-bold uppercase text-[10px] bg-slate-950/40">
                      <th className="py-2 px-2 text-center w-10">Cap</th>
                      <th className="py-2 px-3">Player Name</th>
                      <th className="py-2 px-1 text-center w-7">1</th>
                      <th className="py-2 px-1 text-center w-7">2</th>
                      <th className="py-2 px-1 text-center w-7">3</th>
                      <th className="py-2 px-1 text-center w-7">4</th>
                      <th className="py-2 px-2 text-center w-10 font-black text-cyan-300">G</th>
                      <th className="py-2 px-2 text-center">Foul 1</th>
                      <th className="py-2 px-2 text-center">Foul 2</th>
                      <th className="py-2 px-2 text-center">Foul 3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-400/10 font-mono">
                    {blueRoster.players.map(p => {
                      const capped = isPlayerCappedOut(p);
                      const totalG = getPlayerTotalGoals(p);
                      return (
                        <tr key={p.capNumber} className={`${capped ? 'bg-rose-950/40 text-rose-300' : 'hover:bg-slate-800/40'}`}>
                          <td className="py-1.5 px-2 text-center font-bold text-slate-200">{p.capNumber}</td>
                          <td className="py-1.5 px-3 font-sans font-medium text-slate-100 flex items-center gap-1.5">
                            {p.name}
                            {p.isGoalie && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                GK
                              </span>
                            )}
                            {capped && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-600 text-white animate-pulse">
                                CAPPED OUT
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-1 text-center text-slate-300">{p.goalsByPeriod[0] || '-'}</td>
                          <td className="py-1.5 px-1 text-center text-slate-300">{p.goalsByPeriod[1] || '-'}</td>
                          <td className="py-1.5 px-1 text-center text-slate-300">{p.goalsByPeriod[2] || '-'}</td>
                          <td className="py-1.5 px-1 text-center text-slate-300">{p.goalsByPeriod[3] || '-'}</td>
                          <td className="py-1.5 px-2 text-center font-black text-cyan-300 bg-cyan-950/20">{totalG || '-'}</td>
                          <td className="py-1.5 px-2 text-center text-[10px]">
                            {p.fouls[0] ? `${p.fouls[0].foulType} (${p.fouls[0].gameTime})` : '-'}
                          </td>
                          <td className="py-1.5 px-2 text-center text-[10px]">
                            {p.fouls[1] ? `${p.fouls[1].foulType} (${p.fouls[1].gameTime})` : '-'}
                          </td>
                          <td className="py-1.5 px-2 text-center text-[10px] font-bold text-rose-400">
                            {p.fouls[2] ? `${p.fouls[2].foulType} (${p.fouls[2].gameTime})` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Progressive Play-by-Play Timeline */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Progressive Match Play-by-Play Event Log
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
              {eventLog.length === 0 ? (
                <div className="text-center py-6 text-slate-500 italic">No match events logged yet. Use the Fast Cap Logger below.</div>
              ) : (
                eventLog.map(evt => (
                  <div key={evt.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-cyan-400/15">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-cyan-950 text-cyan-300 border border-cyan-400/30">
                        Q{evt.period} • {evt.gameTime}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        evt.team === 'white' ? 'bg-slate-200 text-slate-900' : 'bg-blue-600 text-white'
                      }`}>
                        {evt.team.toUpperCase()} {evt.capNumber ? `#${evt.capNumber}` : ''}
                      </span>
                      <span className="text-slate-200">{evt.description}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{evt.timestamp}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Fast Cap Logger (Poolside Touch Agility) */}
      {activeTab === 'quick-logger' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Target Team & Action Config */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              <span>🎯</span>
              <span>1. Select Team & Action</span>
            </h3>

            {/* Team Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedTeam('white')}
                className={`py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition border ${
                  selectedTeam === 'white'
                    ? 'bg-slate-100 text-slate-950 border-white shadow-lg'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700'
                }`}
              >
                ⚪ White Caps
              </button>
              <button
                onClick={() => setSelectedTeam('blue')}
                className={`py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition border ${
                  selectedTeam === 'blue'
                    ? 'bg-blue-600 text-white border-blue-400 shadow-lg'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700'
                }`}
              >
                🔵 Blue Caps
              </button>
            </div>

            {/* Foul Type Selector */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-cyan-400/15">
              <span className="text-[10px] font-bold uppercase text-slate-400">Foul Category (WP 21 / 22):</span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setSelectedFoulType('E')}
                  className={`py-2 px-1 rounded-lg text-xs font-black transition border ${
                    selectedFoulType === 'E'
                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700'
                  }`}
                >
                  E (20s Excl)
                </button>
                <button
                  onClick={() => setSelectedFoulType('P')}
                  className={`py-2 px-1 rounded-lg text-xs font-black transition border ${
                    selectedFoulType === 'P'
                      ? 'bg-rose-500 text-white border-rose-300'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700'
                  }`}
                >
                  P (5m Pen)
                </button>
                <button
                  onClick={() => setSelectedFoulType('MAM')}
                  className={`py-2 px-1 rounded-lg text-xs font-black transition border ${
                    selectedFoulType === 'MAM'
                      ? 'bg-purple-600 text-white border-purple-400'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700'
                  }`}
                >
                  MAM (Major)
                </button>
              </div>
            </div>

            {/* Special Quick Actions */}
            <div className="flex flex-col gap-2 pt-2 border-t border-cyan-400/15">
              <span className="text-[10px] font-bold uppercase text-slate-400">Team Actions:</span>
              <button
                onClick={handleQuickTimeout}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-black text-xs uppercase flex items-center justify-center gap-2"
              >
                ⏱️ Call 1-Min Timeout
              </button>
              <button
                onClick={handleQuickSprint}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-black text-xs uppercase flex items-center justify-center gap-2"
              >
                🏊 Award Sprint Won (Q{currentPeriod})
              </button>
            </div>
          </div>

          {/* Cap Number Touch Grid */}
          <div className="md:col-span-2 bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                <span>🤽</span>
                <span>2. Tap Cap Number to Record Action ({selectedTeam.toUpperCase()})</span>
              </h3>
              <span className="text-xs font-mono text-cyan-400">
                Current Clock: Q{currentPeriod} • {currentGameTime}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {activePlayers.map(p => {
                const capped = isPlayerCappedOut(p);
                const goals = getPlayerTotalGoals(p);
                return (
                  <div
                    key={p.capNumber}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-between gap-2 transition ${
                      capped
                        ? 'bg-rose-950/40 border-rose-600/50 opacity-60'
                        : selectedTeam === 'white'
                        ? 'bg-slate-800/80 border-slate-700 hover:border-white'
                        : 'bg-blue-950/60 border-blue-800 hover:border-cyan-400'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-lg font-black font-mono text-white">#{p.capNumber}</span>
                      {p.isGoalie && (
                        <span className="text-[8px] font-black px-1 rounded bg-rose-500/30 text-rose-300">GK</span>
                      )}
                    </div>
                    <div className="text-[11px] font-medium text-slate-200 text-center truncate w-full">
                      {p.name}
                    </div>

                    {/* Stats pill */}
                    <div className="flex items-center justify-center gap-1.5 w-full text-[10px] font-mono">
                      <span className="text-emerald-400 font-bold">{goals}G</span>
                      <span className="text-slate-500">•</span>
                      <span className={`font-bold ${p.fouls.length >= 2 ? 'text-rose-400' : 'text-amber-400'}`}>
                        {p.fouls.length}F
                      </span>
                    </div>

                    {/* Action Plungers */}
                    <div className="grid grid-cols-2 gap-1 w-full pt-1">
                      <button
                        disabled={capped}
                        onClick={() => handleQuickGoal(p.capNumber)}
                        className="py-1 px-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] disabled:opacity-30"
                      >
                        +GOAL
                      </button>
                      <button
                        disabled={capped}
                        onClick={() => handleQuickFoul(p.capNumber)}
                        className="py-1 px-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] disabled:opacity-30"
                      >
                        +FOUL
                      </button>
                    </div>

                    {p.isGoalie && (
                      <button
                        onClick={() => handleQuickSave(p.capNumber)}
                        className="w-full py-1 px-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[9px]"
                      >
                        +SAVE ({p.saves || 0})
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Edit Rosters & Match Metadata */}
      {activeTab === 'roster-edit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Metadata Card */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">Event & Officials Info</h3>
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-slate-400 font-bold text-[10px] uppercase">Tournament / Event</label>
                <input
                  type="text"
                  value={metadata.eventTitle}
                  onChange={e => setMetadata({ ...metadata, eventTitle: e.target.value })}
                  className="w-full bg-slate-950 border border-cyan-400/30 rounded-lg p-2 text-white font-medium"
                />
              </div>
              <div>
                <label className="text-slate-400 font-bold text-[10px] uppercase">Game #</label>
                <input
                  type="text"
                  value={metadata.gameNumber}
                  onChange={e => setMetadata({ ...metadata, gameNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-cyan-400/30 rounded-lg p-2 text-white font-medium"
                />
              </div>
              <div>
                <label className="text-slate-400 font-bold text-[10px] uppercase">Pool Location</label>
                <input
                  type="text"
                  value={metadata.poolLocation}
                  onChange={e => setMetadata({ ...metadata, poolLocation: e.target.value })}
                  className="w-full bg-slate-950 border border-cyan-400/30 rounded-lg p-2 text-white font-medium"
                />
              </div>
              <div>
                <label className="text-slate-400 font-bold text-[10px] uppercase">Referee 1</label>
                <input
                  type="text"
                  value={metadata.referee1}
                  onChange={e => setMetadata({ ...metadata, referee1: e.target.value })}
                  className="w-full bg-slate-950 border border-cyan-400/30 rounded-lg p-2 text-white font-medium"
                />
              </div>
              <div>
                <label className="text-slate-400 font-bold text-[10px] uppercase">Referee 2</label>
                <input
                  type="text"
                  value={metadata.referee2}
                  onChange={e => setMetadata({ ...metadata, referee2: e.target.value })}
                  className="w-full bg-slate-950 border border-cyan-400/30 rounded-lg p-2 text-white font-medium"
                />
              </div>
            </div>
          </div>

          {/* Edit White Roster Names */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">⚪ Edit White Players</h3>
              <input
                type="text"
                value={whiteRoster.teamName}
                onChange={e => onUpdateWhiteRoster({ ...whiteRoster, teamName: e.target.value })}
                className="bg-slate-950 border border-cyan-400/30 rounded px-2 py-0.5 text-xs text-white font-bold"
              />
            </div>
            <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {whiteRoster.players.map(p => (
                <div key={p.capNumber} className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-400 w-8">#{p.capNumber}</span>
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => handlePlayerNameChange('white', p.capNumber, e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded px-2 py-1 text-white text-xs"
                  />
                  {p.isGoalie && <span className="text-[10px] font-bold text-rose-400">GK</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Edit Blue Roster Names */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-400/25 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-sky-400">🔵 Edit Blue Players</h3>
              <input
                type="text"
                value={blueRoster.teamName}
                onChange={e => onUpdateBlueRoster({ ...blueRoster, teamName: e.target.value })}
                className="bg-slate-950 border border-cyan-400/30 rounded px-2 py-0.5 text-xs text-white font-bold"
              />
            </div>
            <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {blueRoster.players.map(p => (
                <div key={p.capNumber} className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-400 w-8">#{p.capNumber}</span>
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => handlePlayerNameChange('blue', p.capNumber, e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded px-2 py-1 text-white text-xs"
                  />
                  {p.isGoalie && <span className="text-[10px] font-bold text-rose-400">GK</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
