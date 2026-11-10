/**
 * PoloBridge & PoloPad Pro — Four-Court Demo Simulator
 * =====================================================
 * Drives four scripted matches through the real CourtPublisher so a director
 * can see the dashboard working without four tablets on four pools.
 *
 * Nothing here is a shortcut around the link: every simulated desk produces
 * ordinary frames, which the caller encodes, parses and ingests exactly like
 * frames from a real desk. The simulated data never touches a real room.
 *
 * The script follows the same rules the console enforces:
 *   - WP 20.15  the shot clock is blanked by the director when T_game <= T_shot
 *   - WP 21     a goal releases the defending team's exclusions and resets 30 s
 *   - WP 22.3   a third personal foul caps the player out for the match
 *   - NFHS      every shot-clock reset is 30 s (no 20 s reset)
 * A 0.0 shot clock stops both clocks, as it does on the console.
 */

import {
  CourtFrame,
  CourtId,
  CourtPublisher,
  CourtTeam,
  DeskEventInput,
  DeskExclusionInput,
  DeskStateInput,
  PERIOD_SCORE_SLOTS,
  PERSONAL_FOUL_LIMIT,
  formatGameClock,
  periodLabel,
} from './court-link';

const REGULATION_PERIOD_MS = 8 * 60 * 1000;
const FULL_SHOT_MS = 30 * 1000;
const SHORT_SHOT_MS = 20 * 1000;
const EXCLUSION_SECONDS = 20;
const MAX_SIM_EVENTS = 8;
/** Never integrate more than this in one step (a throttled background tab). */
const MAX_STEP_MS = 2000;

/** Small deterministic PRNG so a demo (and its tests) replay identically. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimulatedCourtScript {
  courtId: CourtId;
  deskLabel: string;
  teamWhiteName: string;
  teamDarkName: string;
  /** false = NFHS high-school rules. */
  enable20sReset: boolean;
  protocol: 'cts' | 'daktronics';
  period: number;
  gameTimeMs: number;
  shotTimeMs: number;
  quarterScores: { white: number[]; dark: number[] };
  /** Seconds this desk's link stays down in every outage cycle (0 = never). */
  outageSeconds: number;
  outageEverySeconds: number;
  seed: number;
}

export const DEMO_COURT_SCRIPTS: SimulatedCourtScript[] = [
  {
    courtId: 'A',
    deskLabel: 'Demo iPad — Varsity 30m',
    teamWhiteName: 'NEWPORT',
    teamDarkName: 'CORONA',
    enable20sReset: true,
    protocol: 'cts',
    period: 4,
    gameTimeMs: 75 * 1000,
    shotTimeMs: 18 * 1000,
    quarterScores: { white: [3, 2, 3, 3, 0, 0, 0], dark: [2, 3, 3, 2, 0, 0, 0] },
    outageSeconds: 0,
    outageEverySeconds: 0,
    seed: 0xa11ce,
  },
  {
    courtId: 'B',
    deskLabel: 'Demo iPad — North 25y',
    teamWhiteName: 'LAGUNA',
    teamDarkName: 'FOOTHILL',
    enable20sReset: true,
    protocol: 'daktronics',
    period: 2,
    gameTimeMs: 342 * 1000,
    shotTimeMs: 24 * 1000,
    quarterScores: { white: [2, 1, 0, 0, 0, 0, 0], dark: [1, 1, 0, 0, 0, 0, 0] },
    outageSeconds: 0,
    outageEverySeconds: 0,
    seed: 0xb0b,
  },
  {
    courtId: 'C',
    deskLabel: 'Demo Phone — Dive Tank',
    teamWhiteName: 'SOCAL',
    teamDarkName: 'STANFORD',
    enable20sReset: true,
    protocol: 'cts',
    period: 3,
    gameTimeMs: 185 * 1000,
    shotTimeMs: 30 * 1000,
    quarterScores: { white: [2, 3, 2, 0, 0, 0, 0], dark: [3, 2, 2, 0, 0, 0, 0] },
    outageSeconds: 0,
    outageEverySeconds: 0,
    seed: 0xc0ffee,
  },
  {
    courtId: 'D',
    deskLabel: 'Demo iPad — JV Pool (NFHS)',
    teamWhiteName: 'MATER DEI',
    teamDarkName: 'JSERRA',
    enable20sReset: false,
    protocol: 'cts',
    period: 1,
    gameTimeMs: 440 * 1000,
    shotTimeMs: 27 * 1000,
    quarterScores: { white: [1, 0, 0, 0, 0, 0, 0], dark: [0, 0, 0, 0, 0, 0, 0] },
    // Shows the LAGGING -> LINK LOST -> restored states without touching real data.
    outageSeconds: 11,
    outageEverySeconds: 90,
    seed: 0xd00d,
  },
];

interface SimulatedMatch {
  script: SimulatedCourtScript;
  random: () => number;
  publisher: CourtPublisher;
  isRunning: boolean;
  gameTimeMs: number;
  shotTimeMs: number;
  period: number;
  quarterScores: { white: number[]; dark: number[] };
  exclusions: DeskExclusionInput[];
  activeTimeout: DeskStateInput['activeTimeout'];
  timeoutsWhite: { full: number; short: number };
  timeoutsDark: { full: number; short: number };
  fouls: { white: Map<number, number>; dark: Map<number, number> };
  events: DeskEventInput[];
  hornUntilMs: number;
  /** While stopped: when play resumes, and what happens at that instant. */
  resumeAtMs: number;
  onResume: 'play' | 'next-period' | 'new-match';
  startedAtMs: number;
  eventCounter: number;
}

export interface CourtSimulatorOptions {
  room: string;
  now: () => number;
  /** Receives every frame a simulated desk transmits. */
  deliver: (frame: CourtFrame) => void;
  scripts?: SimulatedCourtScript[];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export class CourtSimulator {
  private readonly matches: SimulatedMatch[];
  private lastAdvancedAtMs: number;
  private seq = 0;

  constructor(private readonly options: CourtSimulatorOptions) {
    const startedAtMs = options.now();
    this.lastAdvancedAtMs = startedAtMs;
    this.matches = (options.scripts ?? DEMO_COURT_SCRIPTS).map((script, index) => {
      const match: SimulatedMatch = {
        script,
        random: createSeededRandom(script.seed),
        publisher: new CourtPublisher({
          room: options.room,
          courtId: script.courtId,
          deskId: `DEMODESK${script.courtId}${String(index).padStart(3, '0')}`,
          deskLabel: script.deskLabel,
          sessionStartedAtMs: startedAtMs,
          now: options.now,
          nextSeq: () => {
            this.seq += 1;
            return this.seq;
          },
          send: (frame) => {
            if (!this.isLinkDown(match, options.now())) options.deliver(frame);
          },
        }),
        isRunning: true,
        gameTimeMs: script.gameTimeMs,
        shotTimeMs: script.shotTimeMs,
        period: script.period,
        quarterScores: {
          white: [...script.quarterScores.white],
          dark: [...script.quarterScores.dark],
        },
        exclusions: [],
        activeTimeout: null,
        timeoutsWhite: { full: 3, short: 1 },
        timeoutsDark: { full: 3, short: 1 },
        fouls: { white: new Map(), dark: new Map() },
        events: [],
        hornUntilMs: 0,
        resumeAtMs: 0,
        onResume: 'play',
        startedAtMs,
        eventCounter: 0,
      };
      return match;
    });
    for (const match of this.matches) match.publisher.update(this.toDeskState(match, startedAtMs));
  }

  /** Steps every simulated match up to `nowMs` and lets each desk transmit. */
  public advance(nowMs: number): void {
    const deltaMs = Math.min(MAX_STEP_MS, Math.max(0, nowMs - this.lastAdvancedAtMs));
    this.lastAdvancedAtMs = nowMs;
    for (const match of this.matches) {
      if (deltaMs > 0) this.step(match, deltaMs, nowMs);
      match.publisher.update(this.toDeskState(match, nowMs));
      match.publisher.tick();
    }
  }

  private isLinkDown(match: SimulatedMatch, nowMs: number): boolean {
    const { outageSeconds, outageEverySeconds } = match.script;
    if (outageSeconds <= 0 || outageEverySeconds <= 0) return false;
    const cycleSeconds = ((nowMs - match.startedAtMs) / 1000) % outageEverySeconds;
    return cycleSeconds >= outageEverySeconds - outageSeconds;
  }

  private step(match: SimulatedMatch, deltaMs: number, nowMs: number): void {
    if (match.activeTimeout) {
      const remainingMs = match.activeTimeout.remainingMs - deltaMs;
      match.activeTimeout = remainingMs > 0 ? { ...match.activeTimeout, remainingMs } : null;
      if (!match.activeTimeout) {
        match.hornUntilMs = nowMs + 1200;
        match.resumeAtMs = nowMs + 2000;
      }
      return;
    }

    if (!match.isRunning) {
      if (nowMs >= match.resumeAtMs) this.resume(match, nowMs);
      return;
    }

    const ranFor = Math.min(deltaMs, match.gameTimeMs, match.shotTimeMs);
    match.gameTimeMs -= ranFor;
    match.shotTimeMs -= ranFor;
    match.exclusions = match.exclusions
      .map((exclusion) => ({ ...exclusion, remaining: exclusion.remaining - ranFor / 1000 }))
      .filter((exclusion) => exclusion.remaining > 0.05);

    if (match.gameTimeMs <= 0) {
      this.endPeriod(match, nowMs);
      return;
    }
    if (match.shotTimeMs <= 0) {
      // Shot clock violation: both clocks stop, turnover, play restarts on 30 s.
      match.isRunning = false;
      match.hornUntilMs = nowMs + 1500;
      match.resumeAtMs = nowMs + 3000;
      match.onResume = 'play';
      match.exclusions = [];
      return;
    }

    const seconds = ranFor / 1000;
    const happens = (perSecond: number): boolean => match.random() < 1 - Math.exp(-perSecond * seconds);

    if (happens(1 / 34)) {
      this.scoreGoal(match, nowMs);
    } else if (happens(1 / 50)) {
      this.callExclusion(match, nowMs);
    } else if (happens(1 / 16)) {
      // Change of possession: a 30 s reset also releases exclusions (WP 21).
      match.shotTimeMs = FULL_SHOT_MS;
      match.exclusions = [];
    } else if (happens(1 / 150)) {
      this.callTimeout(match, nowMs);
    }
  }

  private resume(match: SimulatedMatch, nowMs: number): void {
    if (match.onResume === 'next-period') {
      match.period += 1;
      match.gameTimeMs = REGULATION_PERIOD_MS;
      match.exclusions = [];
      this.logEvent(match, nowMs, 'PERIOD_CHANGE', `Period switched to ${periodLabel(match.period)}`);
    } else if (match.onResume === 'new-match') {
      match.period = 1;
      match.gameTimeMs = REGULATION_PERIOD_MS;
      match.quarterScores = {
        white: new Array<number>(PERIOD_SCORE_SLOTS).fill(0),
        dark: new Array<number>(PERIOD_SCORE_SLOTS).fill(0),
      };
      match.exclusions = [];
      match.fouls = { white: new Map(), dark: new Map() };
      match.timeoutsWhite = { full: 3, short: 1 };
      match.timeoutsDark = { full: 3, short: 1 };
      this.logEvent(match, nowMs, 'MATCH_SYNC', 'New match on this course');
    }
    // After a timeout the possession keeps its shot clock; a new period, a new
    // match or a 0.0 violation restarts it at 30 s.
    if (match.onResume !== 'play' || match.shotTimeMs <= 0) match.shotTimeMs = FULL_SHOT_MS;
    match.onResume = 'play';
    match.isRunning = true;
  }

  private endPeriod(match: SimulatedMatch, nowMs: number): void {
    match.isRunning = false;
    match.gameTimeMs = 0;
    match.hornUntilMs = nowMs + 2200;
    match.exclusions = [];
    if (match.period >= 4) {
      match.resumeAtMs = nowMs + 15000;
      match.onResume = 'new-match';
    } else {
      match.resumeAtMs = nowMs + 8000;
      match.onResume = 'next-period';
    }
  }

  private scoreGoal(match: SimulatedMatch, nowMs: number): void {
    const scorer: CourtTeam = match.random() < 0.5 ? 'white' : 'dark';
    const slot = Math.min(PERIOD_SCORE_SLOTS - 1, Math.max(0, match.period - 1));
    match.quarterScores[scorer][slot] += 1;
    // Rule WP 21: a goal releases the defending team's excluded players.
    match.exclusions = match.exclusions.filter((exclusion) => exclusion.team === scorer);
    match.shotTimeMs = FULL_SHOT_MS;
    match.isRunning = false;
    match.resumeAtMs = nowMs + 5000;
    match.onResume = 'play';
    const cap = 2 + Math.floor(match.random() * 11);
    const name = scorer === 'white' ? match.script.teamWhiteName : match.script.teamDarkName;
    this.logEvent(match, nowMs, 'GOAL', `GOAL by ${name} #${cap}`, scorer, cap);
  }

  private callExclusion(match: SimulatedMatch, nowMs: number): void {
    if (match.exclusions.length >= 2) return;
    const team: CourtTeam = match.random() < 0.5 ? 'white' : 'dark';
    const fouls = match.fouls[team];
    const eligible: number[] = [];
    for (let cap = 2; cap <= 12; cap += 1) {
      // Rule WP 22.3: a capped-out player cannot be excluded again.
      if ((fouls.get(cap) ?? 0) < PERSONAL_FOUL_LIMIT) eligible.push(cap);
    }
    if (eligible.length === 0) return;

    const cap = eligible[Math.floor(match.random() * eligible.length)];
    const count = (fouls.get(cap) ?? 0) + 1;
    fouls.set(cap, count);
    match.eventCounter += 1;
    match.exclusions = [
      ...match.exclusions,
      { id: `sim-${match.script.courtId}-x${match.eventCounter}`, team, cap, remaining: EXCLUSION_SECONDS },
    ];
    // NFHS high-school mode has no 20 s reset.
    match.shotTimeMs = match.script.enable20sReset ? SHORT_SHOT_MS : FULL_SHOT_MS;
    const name = team === 'white' ? match.script.teamWhiteName : match.script.teamDarkName;
    this.logEvent(
      match,
      nowMs,
      'EXCLUSION_20S',
      `20s Exclusion on ${name} #${cap} (${count}/${PERSONAL_FOUL_LIMIT} Personal Fouls${
        count >= PERSONAL_FOUL_LIMIT ? ' — CAPPED OUT' : ''
      })`,
      team,
      cap
    );
  }

  private callTimeout(match: SimulatedMatch, nowMs: number): void {
    const team: CourtTeam = match.random() < 0.5 ? 'white' : 'dark';
    const bank = team === 'white' ? match.timeoutsWhite : match.timeoutsDark;
    if (bank.short <= 0) return;
    bank.short -= 1;
    match.isRunning = false;
    match.onResume = 'play';
    match.hornUntilMs = nowMs + 800;
    match.activeTimeout = { team, type: '30s', remainingMs: 30 * 1000 };
    const name = team === 'white' ? match.script.teamWhiteName : match.script.teamDarkName;
    this.logEvent(match, nowMs, 'MATCH_SYNC', `30s Team Timeout called by ${name}`, team);
  }

  private logEvent(
    match: SimulatedMatch,
    nowMs: number,
    type: string,
    description: string,
    team?: CourtTeam,
    cap?: number
  ): void {
    match.eventCounter += 1;
    const event: DeskEventInput = {
      id: `sim-${match.script.courtId}-${match.eventCounter}`,
      timestampIso: new Date(nowMs).toISOString(),
      period: match.period,
      gameClock: formatGameClock(match.gameTimeMs),
      type,
      description,
    };
    if (team) event.team = team;
    if (cap !== undefined) event.cap = cap;
    match.events = [event, ...match.events].slice(0, MAX_SIM_EVENTS);
  }

  private toDeskState(match: SimulatedMatch, nowMs: number): DeskStateInput {
    const cappedOut = (team: CourtTeam): number[] =>
      [...match.fouls[team].entries()]
        .filter(([, count]) => count >= PERSONAL_FOUL_LIMIT)
        .map(([cap]) => cap)
        .sort((a, b) => a - b);

    return {
      isRunning: match.isRunning,
      gameTimeMs: match.gameTimeMs,
      shotTimeMs: match.shotTimeMs,
      period: match.period,
      scoreWhite: sum(match.quarterScores.white),
      scoreDark: sum(match.quarterScores.dark),
      teamWhiteName: match.script.teamWhiteName,
      teamDarkName: match.script.teamDarkName,
      quarterScores: match.quarterScores,
      exclusions: match.exclusions,
      activeTimeout: match.activeTimeout,
      timeoutsWhite: match.timeoutsWhite,
      timeoutsDark: match.timeoutsDark,
      isHornActive: nowMs < match.hornUntilMs,
      enable20sReset: match.script.enable20sReset,
      protocol: match.script.protocol,
      bleStatus: 'connected',
      cappedOutWhite: cappedOut('white'),
      cappedOutDark: cappedOut('dark'),
      events: match.events,
    };
  }
}
