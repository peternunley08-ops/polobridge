/**
 * PoloPad Pro — Custom Team Rosters & Digital Scoresheet Engine
 * ============================================================
 * Implements USA Water Polo, NFHS, and World Aquatics compliant match roster
 * tracking, Cap #1-20 player statistics, Rule WP 22.3 (3 personal foul cap-out),
 * and exportable official scoresheets (Printable HTML/PDF & CSV Box Scores).
 */

export type FoulType = 'E' | 'P' | 'MAM'; // Ordinary Exclusion (20s), Penalty (5m), Misconduct/Major

export interface PlayerFoulRecord {
  period: number;
  gameTime: string; // e.g. "05:24.3"
  foulType: FoulType;
}

export interface PlayerRecord {
  capNumber: number; // 1 to 20
  name: string;
  isGoalie: boolean;
  team: 'white' | 'blue';
  goalsByPeriod: number[]; // Index 0 = Q1, 1 = Q2, 2 = Q3, 3 = Q4, 4+ = OT
  fouls: PlayerFoulRecord[];
  saves?: number;
  isActive: boolean;
}

export interface TeamTimeoutRecord {
  period: number;
  gameTime: string;
  duration: 'full' | 'short'; // Full 1-min or 30-sec / 20-sec
}

export interface TeamRoster {
  teamName: string;
  color: 'white' | 'blue';
  coachName: string;
  assistantCoach?: string;
  players: PlayerRecord[];
  timeouts: TeamTimeoutRecord[];
  sprintsWon: number[]; // Period numbers won (e.g. [1, 3])
}

export interface MatchEventLogEntry {
  id: string;
  period: number;
  gameTime: string;
  team: 'white' | 'blue';
  capNumber?: number;
  playerName?: string;
  eventType: 'goal' | 'exclusion' | 'penalty' | 'timeout' | 'sprint' | 'card_yellow' | 'card_red' | 'save';
  description: string;
  timestamp: string; // Wall clock ISO or HH:MM:SS
}

export interface ScoresheetMetadata {
  eventTitle: string;
  gameNumber: string;
  date: string;
  poolLocation: string;
  referee1: string;
  referee2: string;
  deskOfficial: string;
  timerOfficial: string;
}

/**
 * Creates default factory rosters for White and Blue teams with caps #1 to #18.
 */
export function createDefaultRoster(teamName: string, color: 'white' | 'blue'): TeamRoster {
  const players: PlayerRecord[] = [];
  for (let cap = 1; cap <= 18; cap++) {
    players.push({
      capNumber: cap,
      name: cap === 1 ? 'Starting Goalie' : cap === 13 ? 'Backup Goalie' : `Player #${cap}`,
      isGoalie: cap === 1 || cap === 13,
      team: color,
      goalsByPeriod: [0, 0, 0, 0],
      fouls: [],
      saves: cap === 1 || cap === 13 ? 0 : undefined,
      isActive: cap <= 13
    });
  }

  return {
    teamName,
    color,
    coachName: 'Head Coach',
    assistantCoach: 'Assistant Coach',
    players,
    timeouts: [],
    sprintsWon: []
  };
}

/**
 * Calculates total goals scored by a player across all periods.
 */
export function getPlayerTotalGoals(player: PlayerRecord): number {
  return player.goalsByPeriod.reduce((sum, g) => sum + (g || 0), 0);
}

/**
 * Returns true if a player has accumulated 3 personal fouls (Rule WP 22.3 Cap-Out).
 */
export function isPlayerCappedOut(player: PlayerRecord): boolean {
  return player.fouls.length >= 3;
}

/**
 * Records a goal for a specific cap number in the specified period.
 */
export function recordPlayerGoal(
  roster: TeamRoster,
  capNumber: number,
  period: number
): { roster: TeamRoster; player?: PlayerRecord } {
  const updatedPlayers = roster.players.map(p => {
    if (p.capNumber === capNumber) {
      const goals = [...p.goalsByPeriod];
      while (goals.length < period) goals.push(0);
      goals[period - 1] = (goals[period - 1] || 0) + 1;
      return { ...p, goalsByPeriod: goals };
    }
    return p;
  });

  const updatedPlayer = updatedPlayers.find(p => p.capNumber === capNumber);
  return {
    roster: { ...roster, players: updatedPlayers },
    player: updatedPlayer
  };
}

/**
 * Records a personal foul (Exclusion, Penalty, or MAM) for a cap number.
 * Triggers Rule WP 22.3 cap-out warning if fouls reach 3.
 */
export function recordPlayerFoul(
  roster: TeamRoster,
  capNumber: number,
  period: number,
  gameTime: string,
  foulType: FoulType = 'E'
): { roster: TeamRoster; player?: PlayerRecord; isCappedOut: boolean } {
  let isCappedOut = false;
  const updatedPlayers = roster.players.map(p => {
    if (p.capNumber === capNumber) {
      const newFouls = [...p.fouls, { period, gameTime, foulType }];
      if (newFouls.length >= 3) {
        isCappedOut = true;
      }
      return { ...p, fouls: newFouls };
    }
    return p;
  });

  const updatedPlayer = updatedPlayers.find(p => p.capNumber === capNumber);
  return {
    roster: { ...roster, players: updatedPlayers },
    player: updatedPlayer,
    isCappedOut
  };
}

/**
 * Records a goalkeeper save.
 */
export function recordGoalieSave(
  roster: TeamRoster,
  capNumber: number
): { roster: TeamRoster; player?: PlayerRecord } {
  const updatedPlayers = roster.players.map(p => {
    if (p.capNumber === capNumber) {
      return { ...p, saves: (p.saves || 0) + 1 };
    }
    return p;
  });

  const updatedPlayer = updatedPlayers.find(p => p.capNumber === capNumber);
  return {
    roster: { ...roster, players: updatedPlayers },
    player: updatedPlayer
  };
}

/**
 * Records a timeout called by a team.
 */
export function recordTeamTimeout(
  roster: TeamRoster,
  period: number,
  gameTime: string,
  duration: 'full' | 'short' = 'full'
): TeamRoster {
  return {
    ...roster,
    timeouts: [...roster.timeouts, { period, gameTime, duration }]
  };
}

/**
 * Records a sprint won by a team.
 */
export function recordSprintWinner(
  roster: TeamRoster,
  period: number
): TeamRoster {
  if (roster.sprintsWon.includes(period)) return roster;
  return {
    ...roster,
    sprintsWon: [...roster.sprintsWon, period]
  };
}

/**
 * Formats a CSV export containing team rosters, individual goals, fouls, and progressive match timeline.
 */
export function exportScoresheetCsv(
  metadata: ScoresheetMetadata,
  whiteRoster: TeamRoster,
  blueRoster: TeamRoster,
  eventLog: MatchEventLogEntry[]
): string {
  const lines: string[] = [];

  // Metadata Header
  lines.push(`"OFFICIAL WATER POLO SCORESHEET BOX SCORE"`);
  lines.push(`"Event / Tournament:","${metadata.eventTitle}","Game #:","${metadata.gameNumber}"`);
  lines.push(`"Date:","${metadata.date}","Pool Location:","${metadata.poolLocation}"`);
  lines.push(`"Referee 1:","${metadata.referee1}","Referee 2:","${metadata.referee2}"`);
  lines.push(`"Desk Official:","${metadata.deskOfficial}","Timer Official:","${metadata.timerOfficial}"`);
  lines.push('');

  // Team Rosters & Individual Stats Function
  const appendRosterTable = (team: TeamRoster) => {
    lines.push(`"TEAM: ${team.teamName.toUpperCase()} (${team.color.toUpperCase()})"`);
    lines.push(`"Coach:","${team.coachName}","Assistant:","${team.assistantCoach || 'N/A'}"`);
    lines.push(`"Timeouts Called:","${team.timeouts.length}","Sprints Won:","${team.sprintsWon.join(', ') || 'None'}"`);
    lines.push('"Cap #","Player Name","Position","Q1 Goals","Q2 Goals","Q3 Goals","Q4 Goals","Total Goals","Foul 1","Foul 2","Foul 3","Total Fouls","Status"');

    team.players.forEach(p => {
      const q1 = p.goalsByPeriod[0] || 0;
      const q2 = p.goalsByPeriod[1] || 0;
      const q3 = p.goalsByPeriod[2] || 0;
      const q4 = p.goalsByPeriod[3] || 0;
      const totalGoals = getPlayerTotalGoals(p);
      const f1 = p.fouls[0] ? `${p.fouls[0].foulType}-Q${p.fouls[0].period}(${p.fouls[0].gameTime})` : '-';
      const f2 = p.fouls[1] ? `${p.fouls[1].foulType}-Q${p.fouls[1].period}(${p.fouls[1].gameTime})` : '-';
      const f3 = p.fouls[2] ? `${p.fouls[2].foulType}-Q${p.fouls[2].period}(${p.fouls[2].gameTime})` : '-';
      const status = isPlayerCappedOut(p) ? 'CAPPED OUT (WP 22.3)' : p.isActive ? 'Active' : 'Bench';

      lines.push(
        `"${p.capNumber}","${p.name}","${p.isGoalie ? 'GK' : 'Field'}","${q1}","${q2}","${q3}","${q4}","${totalGoals}","${f1}","${f2}","${f3}","${p.fouls.length}","${status}"`
      );
    });
    lines.push('');
  };

  appendRosterTable(whiteRoster);
  appendRosterTable(blueRoster);

  // Progressive Scoring / Play-by-Play Log
  lines.push('"PROGRESSIVE MATCH PLAY-BY-PLAY LOG"');
  lines.push('"Entry #","Period","Game Clock","Team","Cap #","Event Type","Description","Timestamp"');
  eventLog.forEach((evt, idx) => {
    lines.push(
      `"${idx + 1}","Q${evt.period}","${evt.gameTime}","${evt.team.toUpperCase()}","${evt.capNumber || '-'}","${evt.eventType.toUpperCase()}","${evt.description}","${evt.timestamp}"`
    );
  });

  return lines.join('\n');
}

/**
 * Generates an official, print-ready HTML document formatted for Letter/A4 Landscape.
 * Meets USA Water Polo and NFHS desk requirements for referee post-game verification.
 */
export function generatePrintableScoresheetHtml(
  metadata: ScoresheetMetadata,
  whiteRoster: TeamRoster,
  blueRoster: TeamRoster,
  whiteScoreByPeriod: number[],
  blueScoreByPeriod: number[],
  eventLog: MatchEventLogEntry[]
): string {
  const whiteTotal = whiteScoreByPeriod.reduce((a, b) => a + b, 0);
  const blueTotal = blueScoreByPeriod.reduce((a, b) => a + b, 0);

  const renderRosterRows = (roster: TeamRoster) => {
    return roster.players
      .map(p => {
        const q1 = p.goalsByPeriod[0] || 0;
        const q2 = p.goalsByPeriod[1] || 0;
        const q3 = p.goalsByPeriod[2] || 0;
        const q4 = p.goalsByPeriod[3] || 0;
        const totalGoals = getPlayerTotalGoals(p);
        const f1 = p.fouls[0] ? `${p.fouls[0].foulType} (${p.fouls[0].gameTime})` : '';
        const f2 = p.fouls[1] ? `${p.fouls[1].foulType} (${p.fouls[1].gameTime})` : '';
        const f3 = p.fouls[2] ? `${p.fouls[2].foulType} (${p.fouls[2].gameTime})` : '';
        const capped = isPlayerCappedOut(p);

        return `
          <tr class="${capped ? 'capped-out' : ''}">
            <td class="text-center font-bold">${p.capNumber}</td>
            <td class="font-medium">${p.name} ${p.isGoalie ? '<span class="badge-gk">GK</span>' : ''}</td>
            <td class="text-center">${q1 || '-'}</td>
            <td class="text-center">${q2 || '-'}</td>
            <td class="text-center">${q3 || '-'}</td>
            <td class="text-center">${q4 || '-'}</td>
            <td class="text-center font-bold bg-subtle">${totalGoals}</td>
            <td class="text-center text-xs ${f1 ? 'font-bold' : ''}">${f1 || '-'}</td>
            <td class="text-center text-xs ${f2 ? 'font-bold' : ''}">${f2 || '-'}</td>
            <td class="text-center text-xs ${f3 ? 'font-bold text-red' : ''}">${f3 || '-'}</td>
          </tr>
        `;
      })
      .join('');
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Official Scoresheet — ${metadata.eventTitle} (${metadata.gameNumber})</title>
  <style>
    @page { size: landscape; margin: 0.5in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      color: #111827;
      background: #ffffff;
      padding: 0.25in;
    }
    .sheet-container {
      width: 100%;
      max-width: 11in;
      margin: 0 auto;
    }
    .header-bar {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 0.5rem;
      margin-bottom: 0.75rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-title {
      font-size: 16pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.01em;
      color: #0369a1;
    }
    .header-meta {
      font-size: 9pt;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.5rem;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      padding: 0.5rem;
      border-radius: 4px;
      margin-bottom: 0.75rem;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 7.5pt; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .meta-val { font-size: 9.5pt; font-weight: 800; color: #0f172a; }

    /* Quarter Score Summary */
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0.75rem;
      font-size: 9pt;
    }
    .summary-table th, .summary-table td {
      border: 1px solid #cbd5e1;
      padding: 0.35rem 0.5rem;
      text-align: center;
    }
    .summary-table th {
      background: #f8fafc;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 8pt;
    }

    /* Rosters layout */
    .rosters-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .roster-card {
      border: 1px solid #94a3b8;
      border-radius: 4px;
      overflow: hidden;
    }
    .roster-header {
      padding: 0.4rem 0.6rem;
      font-weight: 900;
      font-size: 10pt;
      text-transform: uppercase;
      display: flex;
      justify-content: space-between;
    }
    .roster-white { background: #e0f2fe; color: #0369a1; border-bottom: 2px solid #38bdf8; }
    .roster-blue { background: #dbeafe; color: #1d4ed8; border-bottom: 2px solid #3b82f6; }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
    }
    .data-table th, .data-table td {
      border: 1px solid #e2e8f0;
      padding: 0.2rem 0.35rem;
    }
    .data-table th {
      background: #f1f5f9;
      font-size: 7.5pt;
      font-weight: 800;
      text-transform: uppercase;
    }
    .text-center { text-align: center; }
    .font-bold { font-weight: 800; }
    .font-medium { font-weight: 600; }
    .bg-subtle { background: #f8fafc; }
    .text-xs { font-size: 7.5pt; }
    .text-red { color: #dc2626; font-weight: 900; }
    .capped-out { background: #fee2e2; }
    .badge-gk {
      font-size: 6.5pt;
      padding: 1px 3px;
      background: #dc2626;
      color: #ffffff;
      border-radius: 2px;
      font-weight: 800;
    }

    /* Sign-off footer */
    .sign-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      border-top: 1px dashed #64748b;
      padding-top: 0.5rem;
      margin-top: 0.5rem;
    }
    .sign-line {
      border-bottom: 1px solid #000;
      height: 24px;
      margin-bottom: 4px;
    }
    .sign-label {
      font-size: 7pt;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
    }

    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet-container">
    <div class="header-bar">
      <div>
        <div class="header-title">Official Water Polo Scoresheet</div>
        <div style="font-size: 8.5pt; color: #475569;">USA WATER POLO / NFHS / WORLD AQUATICS COMPLIANT • POLOPAD PRO</div>
      </div>
      <div style="font-size: 9pt; font-weight: 800; text-align: right;">
        FINAL SCORE: ${whiteRoster.teamName} <span style="font-size: 13pt; color: #0284c7;">${whiteTotal}</span> — <span style="font-size: 13pt; color: #1d4ed8;">${blueTotal}</span> ${blueRoster.teamName}
      </div>
    </div>

    <!-- Metadata Grid -->
    <div class="header-meta">
      <div class="meta-item">
        <span class="meta-label">Tournament / Event</span>
        <span class="meta-val">${metadata.eventTitle}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Game # / Date</span>
        <span class="meta-val">${metadata.gameNumber} • ${metadata.date}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Pool / Location</span>
        <span class="meta-val">${metadata.poolLocation}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Referees</span>
        <span class="meta-val">${metadata.referee1} / ${metadata.referee2}</span>
      </div>
    </div>

    <!-- Score Summary Table -->
    <table class="summary-table">
      <thead>
        <tr>
          <th style="text-align: left; width: 30%;">Team</th>
          <th>Q1</th>
          <th>Q2</th>
          <th>Q3</th>
          <th>Q4</th>
          <th>OT1</th>
          <th>OT2</th>
          <th>Final</th>
          <th>Timeouts</th>
          <th>Sprints</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align: left; font-weight: 800; color: #0284c7;">${whiteRoster.teamName} (White)</td>
          <td>${whiteScoreByPeriod[0] || 0}</td>
          <td>${whiteScoreByPeriod[1] || 0}</td>
          <td>${whiteScoreByPeriod[2] || 0}</td>
          <td>${whiteScoreByPeriod[3] || 0}</td>
          <td>${whiteScoreByPeriod[4] || 0}</td>
          <td>${whiteScoreByPeriod[5] || 0}</td>
          <td style="font-weight: 900; font-size: 11pt; background: #f0f9ff;">${whiteTotal}</td>
          <td>${whiteRoster.timeouts.length}</td>
          <td>${whiteRoster.sprintsWon.join(', ') || '-'}</td>
        </tr>
        <tr>
          <td style="text-align: left; font-weight: 800; color: #1d4ed8;">${blueRoster.teamName} (Blue)</td>
          <td>${blueScoreByPeriod[0] || 0}</td>
          <td>${blueScoreByPeriod[1] || 0}</td>
          <td>${blueScoreByPeriod[2] || 0}</td>
          <td>${blueScoreByPeriod[3] || 0}</td>
          <td>${blueScoreByPeriod[4] || 0}</td>
          <td>${blueScoreByPeriod[5] || 0}</td>
          <td style="font-weight: 900; font-size: 11pt; background: #eff6ff;">${blueTotal}</td>
          <td>${blueRoster.timeouts.length}</td>
          <td>${blueRoster.sprintsWon.join(', ') || '-'}</td>
        </tr>
      </tbody>
    </table>

    <!-- Rosters Side-by-Side -->
    <div class="rosters-grid">
      <!-- White Team -->
      <div class="roster-card">
        <div class="roster-header roster-white">
          <span>⚪ ${whiteRoster.teamName}</span>
          <span>Coach: ${whiteRoster.coachName}</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 28px;">Cap</th>
              <th>Player Name</th>
              <th style="width: 24px;">1</th>
              <th style="width: 24px;">2</th>
              <th style="width: 24px;">3</th>
              <th style="width: 24px;">4</th>
              <th style="width: 32px;">G</th>
              <th style="width: 55px;">Foul 1</th>
              <th style="width: 55px;">Foul 2</th>
              <th style="width: 55px;">Foul 3</th>
            </tr>
          </thead>
          <tbody>
            ${renderRosterRows(whiteRoster)}
          </tbody>
        </table>
      </div>

      <!-- Blue Team -->
      <div class="roster-card">
        <div class="roster-header roster-blue">
          <span>🔵 ${blueRoster.teamName}</span>
          <span>Coach: ${blueRoster.coachName}</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 28px;">Cap</th>
              <th>Player Name</th>
              <th style="width: 24px;">1</th>
              <th style="width: 24px;">2</th>
              <th style="width: 24px;">3</th>
              <th style="width: 24px;">4</th>
              <th style="width: 32px;">G</th>
              <th style="width: 55px;">Foul 1</th>
              <th style="width: 55px;">Foul 2</th>
              <th style="width: 55px;">Foul 3</th>
            </tr>
          </thead>
          <tbody>
            ${renderRosterRows(blueRoster)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Sign-off Footer -->
    <div class="sign-bar">
      <div>
        <div class="sign-line"></div>
        <div class="sign-label">Referee 1 Signature</div>
      </div>
      <div>
        <div class="sign-line"></div>
        <div class="sign-label">Referee 2 Signature</div>
      </div>
      <div>
        <div class="sign-line"></div>
        <div class="sign-label">Desk Official Signature</div>
      </div>
      <div>
        <div class="sign-line"></div>
        <div class="sign-label">Timer Official Signature</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
