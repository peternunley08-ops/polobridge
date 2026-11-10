/**
 * PoloBridge & PoloPad Pro — Court Link: Multi-Court Telemetry Protocol & Engine
 * ==============================================================================
 * Lets one Tournament Director screen monitor up to four pool courses at once.
 *
 * Every scoring desk publishes a compact, versioned snapshot of its match. The
 * director does not need a 10 Hz feed: it dead-reckons both clocks between
 * snapshots, so a 1 Hz heartbeat plus an immediate frame on every real change
 * is enough to render tenth-of-a-second clocks.
 *
 * This module is deliberately pure: no DOM, no timers, no I/O. Callers inject
 * the current time and the transport, which keeps every rule below testable.
 *
 *  1. Wire format      strict, bounded frame parser (network input is untrusted)
 *  2. Projection       clock dead-reckoning with the console's own stop rules
 *  3. Offset filter    one-way minimum-delay filter (immune to clock skew)
 *  4. CourtDirectory   director-side state: ordering, staleness, court conflicts
 *  5. CourtPublisher   desk-side send policy: "send when the prediction is wrong"
 *
 * The dashboard is strictly read-only: nothing received here can start, stop or
 * reset a clock on any desk.
 */

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------

export const COURT_LINK_PROTOCOL_VERSION = 1;

export const COURT_IDS = ['A', 'B', 'C', 'D'] as const;
export type CourtId = (typeof COURT_IDS)[number];
export type CourtTeam = 'white' | 'dark';

/** A desk re-announces itself this often even when nothing changed. */
export const HEARTBEAT_INTERVAL_MS = 1000;
/** Hard ceiling of 10 frames/s per desk, however fast the operator taps. */
export const MIN_SEND_INTERVAL_MS = 100;
/** Game/shot clock error the director may accumulate before a corrective frame. */
export const CLOCK_TOLERANCE_MS = 150;
/** Same idea for exclusion and timeout countdowns (shown in whole seconds). */
export const COUNTDOWN_TOLERANCE_MS = 300;

/** Silence shorter than this is a healthy link (three missed heartbeats). */
export const LAGGING_AFTER_MS = 3000;
/** Silence this long means the desk is gone: stop extrapolating its clocks. */
export const STALE_AFTER_MS = 8000;

/** A rival desk counts as a live conflict while heard within this window. */
export const CONFLICT_WINDOW_MS = 5000;
/** One stray frame (e.g. a page reload in flight) never raises a conflict. */
export const CONFLICT_MIN_FRAMES = 2;

export const OFFSET_WINDOW_SAMPLES = 20;
/** A delay this far above the window minimum is treated as a clock step. */
export const OFFSET_STEP_RESET_MS = 750;

export const MAX_FRAME_CHARS = 16 * 1024;
export const MAX_RECENT_EVENTS = 8;
export const MAX_FEED_EVENTS = 40;
export const MAX_EXCLUSIONS = 14;
export const MAX_CAPPED_OUT = 20;
/** Q1–Q4, OT1, OT2 and the penalty shootout. */
export const PERIOD_SCORE_SLOTS = 7;
export const MAX_GAME_TIME_MS = 60 * 60 * 1000;
export const MAX_SHOT_TIME_MS = 99 * 1000;
export const MAX_COUNTDOWN_MS = 120 * 1000;
export const MAX_SCORE = 99;
/** World Aquatics Rule WP 22.3: the third personal foul removes the player. */
export const PERSONAL_FOUL_LIMIT = 3;

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

export type CourtRuleset = 'nfhs' | 'ncaa-wa';
export type CourtScoreboardProtocol = 'cts' | 'daktronics';
export type CourtHardwareLink = 'connected' | 'reconnecting' | 'offline';
export type CourtTimeoutType = '60s' | '30s';

export interface CourtExclusion {
  id: string;
  team: CourtTeam;
  cap: number;
  remainingMs: number;
}

export interface CourtTimeout {
  team: CourtTeam;
  type: CourtTimeoutType;
  remainingMs: number;
}

export interface CourtTimeoutsLeft {
  full: number;
  short: number;
}

export interface CourtEvent {
  id: string;
  atMs: number;
  period: number;
  /** Game clock as the desk displayed it, e.g. "05:42.3". */
  clock: string;
  type: string;
  team?: CourtTeam;
  cap?: number;
  text: string;
}

export interface CourtSnapshot {
  /** Desk wall clock at the instant these values were true. */
  capturedAtMs: number;
  isRunning: boolean;
  gameTimeMs: number;
  shotTimeMs: number;
  /** 1–4 regulation, 5–6 overtime, 7 penalty shootout. */
  period: number;
  scoreWhite: number;
  scoreDark: number;
  teamWhiteName: string;
  teamDarkName: string;
  quarterScores: { white: number[]; dark: number[] };
  exclusions: CourtExclusion[];
  activeTimeout: CourtTimeout | null;
  timeoutsLeft: { white: CourtTimeoutsLeft; dark: CourtTimeoutsLeft };
  hornActive: boolean;
  ruleset: CourtRuleset;
  scoreboardProtocol: CourtScoreboardProtocol;
  hardwareLink: CourtHardwareLink;
  /** Caps removed under WP 22.3, per team. */
  cappedOut: { white: number[]; dark: number[] };
  /** Newest first. */
  recentEvents: CourtEvent[];
}

interface CourtFrameBase {
  v: number;
  room: string;
  deskId: string;
  /** Wall clock when this page load began; orders sessions of one device. */
  sessionStartedAtMs: number;
  /** Strictly increasing within a session. */
  seq: number;
  sentAtMs: number;
}

export interface CourtSnapshotFrame extends CourtFrameBase {
  kind: 'snapshot';
  courtId: CourtId;
  deskLabel: string;
  snapshot: CourtSnapshot;
}

export interface CourtByeFrame extends CourtFrameBase {
  kind: 'bye';
  courtId: CourtId;
}

/** Sent by a dashboard that just joined: "every desk, announce yourself now". */
export interface CourtSyncRequestFrame extends CourtFrameBase {
  kind: 'sync-request';
}

export type CourtFrame = CourtSnapshotFrame | CourtByeFrame | CourtSyncRequestFrame;

export type FrameRejectReason =
  | 'not-string'
  | 'too-large'
  | 'bad-json'
  | 'bad-shape'
  | 'bad-version'
  | 'wrong-room'
  | 'bad-kind'
  | 'bad-court'
  | 'bad-snapshot';

export type ParsedCourtFrame =
  | { ok: true; frame: CourtFrame }
  | { ok: false; reason: FrameRejectReason };

// ---------------------------------------------------------------------------
// Desk-side input (the console's own state shape)
// ---------------------------------------------------------------------------

export interface DeskExclusionInput {
  id: string;
  team: CourtTeam;
  cap: number;
  /** Seconds, as the console stores them. */
  remaining: number;
}

export interface DeskEventInput {
  id: string;
  timestampIso: string;
  period: number;
  gameClock: string;
  type: string;
  team?: CourtTeam;
  cap?: number;
  description: string;
}

export interface DeskStateInput {
  isRunning: boolean;
  gameTimeMs: number;
  shotTimeMs: number;
  period: number;
  scoreWhite: number;
  scoreDark: number;
  teamWhiteName: string;
  teamDarkName: string;
  quarterScores: { white: number[]; dark: number[] };
  exclusions: DeskExclusionInput[];
  activeTimeout: CourtTimeout | null;
  timeoutsWhite: CourtTimeoutsLeft;
  timeoutsDark: CourtTimeoutsLeft;
  isHornActive: boolean;
  /** false = NFHS high-school mode (every reset is 30 s). */
  enable20sReset: boolean;
  protocol: CourtScoreboardProtocol;
  /** Raw BLE status string from the Bluetooth manager. */
  bleStatus: string;
  cappedOutWhite: number[];
  cappedOutDark: number[];
  /** Newest first. */
  events: DeskEventInput[];
}

// ---------------------------------------------------------------------------
// Room codes
// ---------------------------------------------------------------------------

/** 31 unambiguous symbols: no I, L, O, 0 or 1 to misread on a sunlit deck. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Same-device demo room; never a secret. */
export const DEFAULT_LOCAL_ROOM = 'LOCAL-POOL';
const ROOM_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{4,22}[A-Z0-9]$/;

/** Canonicalises operator input; returns null when it cannot be a room code. */
export function normalizeRoomCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = input
    .toUpperCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return ROOM_CODE_PATTERN.test(cleaned) ? cleaned : null;
}

/**
 * Generates an unguessable `XXXX-XXXX` room code (31^8 ≈ 8.5e11 combinations).
 * Rejection sampling keeps every symbol equally likely.
 */
export function generateRoomCode(randomBytes: (count: number) => Uint8Array): string {
  const symbols: string[] = [];
  const limit = 256 - (256 % ROOM_CODE_ALPHABET.length);
  let guard = 0;
  while (symbols.length < 8) {
    guard += 1;
    if (guard > 64) throw new Error('Random source did not produce usable bytes.');
    const bytes = randomBytes(16);
    for (let i = 0; i < bytes.length && symbols.length < 8; i += 1) {
      if (bytes[i] < limit) symbols.push(ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length]);
    }
  }
  return `${symbols.slice(0, 4).join('')}-${symbols.slice(4).join('')}`;
}

// ---------------------------------------------------------------------------
// Display formatting (digit-for-digit parity with the scoring console)
// ---------------------------------------------------------------------------

const pad2 = (value: number): string => String(value).padStart(2, '0');

export function formatGameClock(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const min = Math.floor(safe / 60000);
  const sec = Math.floor((safe % 60000) / 1000);
  const tenths = Math.floor((safe % 1000) / 100);
  return `${pad2(min)}:${pad2(sec)}.${tenths}`;
}

export function formatShotClock(ms: number, isBlanked: boolean): string {
  if (isBlanked) return '--';
  const safe = Math.max(0, Math.floor(ms));
  const sec = Math.floor(safe / 1000);
  const tenths = Math.floor((safe % 1000) / 100);
  return sec >= 10 ? `${sec}` : `${sec}.${tenths}`;
}

export function periodLabel(period: number): string {
  if (period <= 4) return `Q${period}`;
  if (period === 5) return 'OT1';
  if (period === 6) return 'OT2';
  return 'PSO';
}

/** World Aquatics Rule WP 20.15: the shot clock blanks when T_game <= T_shot. */
export function isShotClockBlanked(gameTimeMs: number, shotTimeMs: number): boolean {
  return gameTimeMs <= shotTimeMs;
}

/** World Aquatics Rule WP 22.3: caps that have reached the personal-foul limit. */
export function capsCappedOut(roster: ReadonlyArray<{ cap: number; exclusions: number }>): number[] {
  return roster
    .filter((player) => player.exclusions >= PERSONAL_FOUL_LIMIT)
    .map((player) => player.cap)
    .sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Sanitising readers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Rounds and clamps into [min, max]; null unless the input is a finite number. */
function readInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

/** Strips control characters and truncates; null unless the input is a string. */
function readText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  return value.replace(CONTROL_CHARS, ' ').trim().slice(0, maxLength);
}

function readTeam(value: unknown): CourtTeam | null {
  return value === 'white' || value === 'dark' ? value : null;
}

function readCourtId(value: unknown): CourtId | null {
  return (COURT_IDS as readonly unknown[]).includes(value) ? (value as CourtId) : null;
}

function readPeriodScores(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const scores: number[] = [];
  for (let i = 0; i < PERIOD_SCORE_SLOTS; i += 1) {
    const raw = i < value.length ? value[i] : 0;
    const score = readInt(raw ?? 0, 0, MAX_SCORE);
    if (score === null) return null;
    scores.push(score);
  }
  return scores;
}

function readCapList(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const caps = new Set<number>();
  for (const raw of value.slice(0, MAX_CAPPED_OUT)) {
    const cap = readInt(raw, 1, 99);
    if (cap === null) return null;
    caps.add(cap);
  }
  return [...caps].sort((a, b) => a - b);
}

function readTimeoutsLeft(value: unknown): CourtTimeoutsLeft | null {
  if (!isRecord(value)) return null;
  const full = readInt(value.full, 0, 9);
  const short = readInt(value.short, 0, 9);
  return full === null || short === null ? null : { full, short };
}

function readExclusion(value: unknown): CourtExclusion | null {
  if (!isRecord(value)) return null;
  const id = readText(value.id, 40);
  const team = readTeam(value.team);
  const cap = readInt(value.cap, 1, 99);
  const remainingMs = readInt(value.remainingMs, 0, MAX_COUNTDOWN_MS);
  if (!id || team === null || cap === null || remainingMs === null) return null;
  return { id, team, cap, remainingMs };
}

function readTimeout(value: unknown): CourtTimeout | null {
  if (!isRecord(value)) return null;
  const team = readTeam(value.team);
  const type = value.type === '60s' || value.type === '30s' ? value.type : null;
  const remainingMs = readInt(value.remainingMs, 0, MAX_COUNTDOWN_MS);
  if (team === null || type === null || remainingMs === null) return null;
  return { team, type, remainingMs };
}

function readEvent(value: unknown): CourtEvent | null {
  if (!isRecord(value)) return null;
  const id = readText(value.id, 64);
  const atMs = readInt(value.atMs, 0, Number.MAX_SAFE_INTEGER);
  const period = readInt(value.period, 1, PERIOD_SCORE_SLOTS);
  const clock = readText(value.clock, 12);
  const type = readText(value.type, 32);
  const text = readText(value.text, 160);
  if (!id || atMs === null || period === null || clock === null || !type || text === null) return null;
  const event: CourtEvent = { id, atMs, period, clock, type, text };
  if (value.team !== undefined) {
    const team = readTeam(value.team);
    if (team === null) return null;
    event.team = team;
  }
  if (value.cap !== undefined) {
    const cap = readInt(value.cap, 1, 99);
    if (cap === null) return null;
    event.cap = cap;
  }
  return event;
}

/**
 * Rebuilds a snapshot field by field from untrusted input. Unknown keys are
 * dropped, numbers are clamped to their legal range, strings are stripped of
 * control characters and truncated. Returns null when the shape is wrong.
 */
export function normalizeSnapshot(raw: unknown): CourtSnapshot | null {
  if (!isRecord(raw)) return null;

  const capturedAtMs = readInt(raw.capturedAtMs, 0, Number.MAX_SAFE_INTEGER);
  const gameTimeMs = readInt(raw.gameTimeMs, 0, MAX_GAME_TIME_MS);
  const shotTimeMs = readInt(raw.shotTimeMs, 0, MAX_SHOT_TIME_MS);
  const period = readInt(raw.period, 1, PERIOD_SCORE_SLOTS);
  const scoreWhite = readInt(raw.scoreWhite, 0, MAX_SCORE);
  const scoreDark = readInt(raw.scoreDark, 0, MAX_SCORE);
  const teamWhiteName = readText(raw.teamWhiteName, 24);
  const teamDarkName = readText(raw.teamDarkName, 24);
  if (
    capturedAtMs === null ||
    gameTimeMs === null ||
    shotTimeMs === null ||
    period === null ||
    scoreWhite === null ||
    scoreDark === null ||
    teamWhiteName === null ||
    teamDarkName === null ||
    typeof raw.isRunning !== 'boolean' ||
    typeof raw.hornActive !== 'boolean'
  ) {
    return null;
  }

  if (!isRecord(raw.quarterScores) || !isRecord(raw.timeoutsLeft) || !isRecord(raw.cappedOut)) return null;
  const quarterWhite = readPeriodScores(raw.quarterScores.white);
  const quarterDark = readPeriodScores(raw.quarterScores.dark);
  const timeoutsWhite = readTimeoutsLeft(raw.timeoutsLeft.white);
  const timeoutsDark = readTimeoutsLeft(raw.timeoutsLeft.dark);
  const cappedWhite = readCapList(raw.cappedOut.white);
  const cappedDark = readCapList(raw.cappedOut.dark);
  if (!quarterWhite || !quarterDark || !timeoutsWhite || !timeoutsDark || !cappedWhite || !cappedDark) return null;

  const ruleset = raw.ruleset === 'nfhs' || raw.ruleset === 'ncaa-wa' ? raw.ruleset : null;
  const scoreboardProtocol =
    raw.scoreboardProtocol === 'cts' || raw.scoreboardProtocol === 'daktronics' ? raw.scoreboardProtocol : null;
  const hardwareLink =
    raw.hardwareLink === 'connected' || raw.hardwareLink === 'reconnecting' || raw.hardwareLink === 'offline'
      ? raw.hardwareLink
      : null;
  if (ruleset === null || scoreboardProtocol === null || hardwareLink === null) return null;

  if (!Array.isArray(raw.exclusions) || !Array.isArray(raw.recentEvents)) return null;
  const exclusions: CourtExclusion[] = [];
  for (const entry of raw.exclusions.slice(0, MAX_EXCLUSIONS)) {
    const exclusion = readExclusion(entry);
    if (!exclusion) return null;
    exclusions.push(exclusion);
  }
  const recentEvents: CourtEvent[] = [];
  for (const entry of raw.recentEvents.slice(0, MAX_RECENT_EVENTS)) {
    const event = readEvent(entry);
    if (!event) return null;
    recentEvents.push(event);
  }

  let activeTimeout: CourtTimeout | null = null;
  if (raw.activeTimeout !== null && raw.activeTimeout !== undefined) {
    activeTimeout = readTimeout(raw.activeTimeout);
    if (!activeTimeout) return null;
  }

  return {
    capturedAtMs,
    isRunning: raw.isRunning,
    gameTimeMs,
    shotTimeMs,
    period,
    scoreWhite,
    scoreDark,
    teamWhiteName: teamWhiteName || 'WHITE',
    teamDarkName: teamDarkName || 'DARK',
    quarterScores: { white: quarterWhite, dark: quarterDark },
    exclusions,
    activeTimeout,
    timeoutsLeft: { white: timeoutsWhite, dark: timeoutsDark },
    hornActive: raw.hornActive,
    ruleset,
    scoreboardProtocol,
    hardwareLink,
    cappedOut: { white: cappedWhite, dark: cappedDark },
    recentEvents,
  };
}

/**
 * Maps the console's state onto the wire snapshot. It runs through the same
 * normaliser the director uses, so anything a desk can produce is guaranteed
 * to be accepted on the other side. Returns null rather than throwing: a
 * malformed value must never be able to break the scoring console.
 */
export function buildCourtSnapshot(input: DeskStateInput, capturedAtMs: number): CourtSnapshot | null {
  const hardwareLink: CourtHardwareLink =
    input.bleStatus === 'connected'
      ? 'connected'
      : input.bleStatus === 'connecting' || input.bleStatus === 'reconnecting'
      ? 'reconnecting'
      : 'offline';

  return normalizeSnapshot({
    capturedAtMs,
    isRunning: input.isRunning,
    gameTimeMs: input.gameTimeMs,
    shotTimeMs: input.shotTimeMs,
    period: input.period,
    scoreWhite: input.scoreWhite,
    scoreDark: input.scoreDark,
    teamWhiteName: input.teamWhiteName,
    teamDarkName: input.teamDarkName,
    quarterScores: input.quarterScores,
    exclusions: input.exclusions.slice(0, MAX_EXCLUSIONS).map((exclusion) => ({
      id: exclusion.id,
      team: exclusion.team,
      cap: exclusion.cap,
      remainingMs: exclusion.remaining * 1000,
    })),
    activeTimeout: input.activeTimeout
      ? {
          team: input.activeTimeout.team,
          type: input.activeTimeout.type,
          remainingMs: input.activeTimeout.remainingMs,
        }
      : null,
    timeoutsLeft: { white: input.timeoutsWhite, dark: input.timeoutsDark },
    hornActive: input.isHornActive,
    ruleset: input.enable20sReset ? 'ncaa-wa' : 'nfhs',
    scoreboardProtocol: input.protocol,
    hardwareLink,
    cappedOut: { white: input.cappedOutWhite, dark: input.cappedOutDark },
    recentEvents: input.events.slice(0, MAX_RECENT_EVENTS).map((event) => {
      const parsedAt = Date.parse(event.timestampIso);
      return {
        id: event.id,
        atMs: Number.isFinite(parsedAt) ? parsedAt : capturedAtMs,
        period: event.period,
        clock: event.gameClock,
        type: event.type,
        team: event.team,
        cap: event.cap,
        text: event.description,
      };
    }),
  });
}

// ---------------------------------------------------------------------------
// Frame codec
// ---------------------------------------------------------------------------

const DESK_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function encodeCourtFrame(frame: CourtFrame): string {
  return JSON.stringify(frame);
}

/** Parses one frame for `expectedRoom`. Never throws, whatever the input. */
export function parseCourtFrame(raw: unknown, expectedRoom: string): ParsedCourtFrame {
  if (typeof raw !== 'string') return { ok: false, reason: 'not-string' };
  if (raw.length > MAX_FRAME_CHARS) return { ok: false, reason: 'too-large' };

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'bad-json' };
  }
  if (!isRecord(decoded)) return { ok: false, reason: 'bad-shape' };
  if (decoded.v !== COURT_LINK_PROTOCOL_VERSION) return { ok: false, reason: 'bad-version' };
  if (normalizeRoomCode(decoded.room) !== expectedRoom) return { ok: false, reason: 'wrong-room' };

  const deskId = typeof decoded.deskId === 'string' && DESK_ID_PATTERN.test(decoded.deskId) ? decoded.deskId : null;
  const sessionStartedAtMs = readInt(decoded.sessionStartedAtMs, 0, Number.MAX_SAFE_INTEGER);
  const sentAtMs = readInt(decoded.sentAtMs, 0, Number.MAX_SAFE_INTEGER);
  // Ordering depends on seq, so it is validated exactly rather than clamped.
  const seq = typeof decoded.seq === 'number' && Number.isSafeInteger(decoded.seq) && decoded.seq >= 1 ? decoded.seq : null;
  if (deskId === null || sessionStartedAtMs === null || seq === null || sentAtMs === null) {
    return { ok: false, reason: 'bad-shape' };
  }

  const base = { v: COURT_LINK_PROTOCOL_VERSION, room: expectedRoom, deskId, sessionStartedAtMs, seq, sentAtMs };

  if (decoded.kind === 'sync-request') return { ok: true, frame: { ...base, kind: 'sync-request' } };

  if (decoded.kind === 'bye') {
    const courtId = readCourtId(decoded.courtId);
    if (courtId === null) return { ok: false, reason: 'bad-court' };
    return { ok: true, frame: { ...base, kind: 'bye', courtId } };
  }

  if (decoded.kind === 'snapshot') {
    const courtId = readCourtId(decoded.courtId);
    if (courtId === null) return { ok: false, reason: 'bad-court' };
    const snapshot = normalizeSnapshot(decoded.snapshot);
    if (!snapshot) return { ok: false, reason: 'bad-snapshot' };
    const deskLabel = readText(decoded.deskLabel, 40) || 'Desk';
    return { ok: true, frame: { ...base, kind: 'snapshot', courtId, deskLabel, snapshot } };
  }

  return { ok: false, reason: 'bad-kind' };
}

// ---------------------------------------------------------------------------
// Clock projection (dead reckoning)
// ---------------------------------------------------------------------------

export type CourtClockExpiry = 'none' | 'shot-clock' | 'period';

export interface CourtProjection {
  gameTimeMs: number;
  shotTimeMs: number;
  /** False once the projection has run either clock down to zero. */
  isRunning: boolean;
  isShotBlanked: boolean;
  expiry: CourtClockExpiry;
  exclusions: CourtExclusion[];
  activeTimeout: CourtTimeout | null;
  elapsedMs: number;
}

/**
 * Advances a snapshot by `elapsedMs` using exactly the console's stop rules:
 *
 *  - Both clocks only move while the game clock is running.
 *  - A shot clock reaching 0.0 stops BOTH clocks (violation horn); a game clock
 *    reaching 0.0 ends the period. Either way the clocks stop after
 *    min(T_game, T_shot), so a projection can never run past a stoppage.
 *  - Exclusions count down with the game clock; a team timeout counts down in
 *    real time whether or not the game clock is running.
 *
 * Because both clocks lose the same amount, the WP 20.15 relation
 * T_game <= T_shot is invariant under projection.
 */
export function projectSnapshot(snapshot: CourtSnapshot, elapsedMs: number): CourtProjection {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const runway = Math.min(snapshot.gameTimeMs, snapshot.shotTimeMs);
  const ranFor = snapshot.isRunning ? Math.min(elapsed, runway) : 0;
  const ranOut = snapshot.isRunning && elapsed >= runway;

  const gameTimeMs = snapshot.gameTimeMs - ranFor;
  const shotTimeMs = snapshot.shotTimeMs - ranFor;

  let expiry: CourtClockExpiry = 'none';
  if (ranOut) expiry = snapshot.gameTimeMs <= snapshot.shotTimeMs ? 'period' : 'shot-clock';

  const exclusions = snapshot.exclusions
    .map((exclusion) => ({ ...exclusion, remainingMs: exclusion.remainingMs - ranFor }))
    .filter((exclusion) => exclusion.remainingMs > 0);

  let activeTimeout: CourtTimeout | null = null;
  if (snapshot.activeTimeout) {
    const remainingMs = snapshot.activeTimeout.remainingMs - elapsed;
    if (remainingMs > 0) activeTimeout = { ...snapshot.activeTimeout, remainingMs };
  }

  return {
    gameTimeMs,
    shotTimeMs,
    isRunning: snapshot.isRunning && !ranOut,
    isShotBlanked: isShotClockBlanked(gameTimeMs, shotTimeMs),
    expiry,
    exclusions,
    activeTimeout,
    elapsedMs: elapsed,
  };
}

// ---------------------------------------------------------------------------
// Link health
// ---------------------------------------------------------------------------

export type CourtLinkHealth = 'empty' | 'live' | 'lagging' | 'stale' | 'signed-off';

/** Health of a desk that has been heard, from the silence since its last frame. */
export function classifyLinkHealth(silenceMs: number): 'live' | 'lagging' | 'stale' {
  if (silenceMs < LAGGING_AFTER_MS) return 'live';
  if (silenceMs < STALE_AFTER_MS) return 'lagging';
  return 'stale';
}

// ---------------------------------------------------------------------------
// One-way clock offset filter
// ---------------------------------------------------------------------------

/**
 * A desk's wall clock and the director's wall clock can disagree by seconds, so
 * snapshots cannot be anchored by comparing timestamps directly. For every
 * frame we observe  offset = receivedAt - capturedAt = skew + networkDelay.
 * The skew is constant and the delay is never negative, so the smallest offset
 * in a sliding window is the best estimate of (skew + minimum delay).
 *
 * Anchoring at  capturedAt + minOffset  therefore cancels the skew entirely and
 * removes delay jitter: a frame that arrived 300 ms late is projected 300 ms
 * further, instead of making the director's clock stutter. The residual error
 * is the minimum one-way delay, which no one-way scheme can observe.
 *
 * A sample far above the minimum means a clock was stepped (or the link stalled
 * for longer than a heartbeat); the window restarts so the estimate recovers at
 * once rather than after the stale minimum slides out.
 */
export class ClockOffsetFilter {
  private samples: number[] = [];

  /** Returns the director-clock instant at which the snapshot was true. */
  public observe(capturedAtMs: number, receivedAtMs: number): number {
    const offset = receivedAtMs - capturedAtMs;
    if (this.samples.length > 0 && offset - this.minimum() > OFFSET_STEP_RESET_MS) {
      this.samples = [];
    }
    this.samples.push(offset);
    if (this.samples.length > OFFSET_WINDOW_SAMPLES) this.samples.shift();
    return capturedAtMs + this.minimum();
  }

  /** Delay of the most recent frame above the window minimum. */
  public latestJitterMs(): number {
    if (this.samples.length === 0) return 0;
    return this.samples[this.samples.length - 1] - this.minimum();
  }

  public reset(): void {
    this.samples = [];
  }

  private minimum(): number {
    let min = Infinity;
    for (const sample of this.samples) if (sample < min) min = sample;
    return min;
  }
}

// ---------------------------------------------------------------------------
// Director-side directory
// ---------------------------------------------------------------------------

export type CourtAlertKind =
  | 'desk-joined'
  | 'desk-signed-off'
  | 'goal'
  | 'period-end'
  | 'timeout'
  | 'cap-out'
  | 'link-lost'
  | 'link-restored'
  | 'conflict';

export interface CourtAlert {
  id: string;
  kind: CourtAlertKind;
  courtId: CourtId;
  severity: 'info' | 'warn';
  atMs: number;
  text: string;
}

export type IngestOutcome =
  | 'accepted'
  /** Same frame seen again (expected when two transports carry it). */
  | 'duplicate'
  | 'reordered'
  /** A different desk already owns this court. */
  | 'court-claimed'
  | 'ignored';

export interface IngestResult {
  outcome: IngestOutcome;
  alerts: CourtAlert[];
}

export interface CourtConflict {
  /** Labels of the other devices publishing as this court. */
  rivalLabels: string[];
}

export interface CourtView {
  courtId: CourtId;
  health: CourtLinkHealth;
  /** Milliseconds since the last accepted frame (0 when empty). */
  silenceMs: number;
  deskId: string | null;
  deskLabel: string | null;
  /** Last confirmed state from the desk. */
  snapshot: CourtSnapshot | null;
  /** What to draw now: projected while the link is up, last-known otherwise. */
  projection: CourtProjection | null;
  /** True while the clocks are being extrapolated from a healthy link. */
  isProjected: boolean;
  conflict: CourtConflict | null;
  jitterMs: number;
  framesAccepted: number;
  /** Rolling play-by-play, newest first. */
  events: CourtEvent[];
}

interface DeskTrack {
  identity: string;
  deskId: string;
  deskLabel: string;
  sessionStartedAtMs: number;
  lastSeq: number;
  snapshot: CourtSnapshot;
  anchorMs: number;
  lastHeardAtMs: number;
  saidBye: boolean;
  offsetFilter: ClockOffsetFilter;
  framesAccepted: number;
}

interface RivalTrack {
  deskLabel: string;
  lastHeardAtMs: number;
  frames: number;
}

interface CourtTrack {
  active: DeskTrack | null;
  rivals: Map<string, RivalTrack>;
  feed: CourtEvent[];
  linkLostReported: boolean;
  conflictReported: boolean;
}

function identityOf(frame: { deskId: string; sessionStartedAtMs: number }): string {
  return `${frame.deskId}#${frame.sessionStartedAtMs}`;
}

function teamName(snapshot: CourtSnapshot, team: CourtTeam): string {
  return team === 'white' ? snapshot.teamWhiteName : snapshot.teamDarkName;
}

function scoreLine(snapshot: CourtSnapshot): string {
  return `${snapshot.teamWhiteName} ${snapshot.scoreWhite}–${snapshot.scoreDark} ${snapshot.teamDarkName}`;
}

/**
 * Holds what the director knows about each of the four courts.
 *
 * Ordering — a desk is identified by (deskId, sessionStartedAtMs). Within one
 * identity only a strictly higher `seq` is accepted, which also discards the
 * second copy when the same frame arrives over two transports.
 *
 * Court ownership — the first desk heard for a court owns it. Another identity
 * takes over only if it is a newer page load of the same device, or the owner
 * has signed off or gone stale. Any other claimant is recorded as a rival and
 * flagged, so two misconfigured tablets can never make a court flicker between
 * two different matches.
 */
export class CourtDirectory {
  private readonly courts = new Map<CourtId, CourtTrack>();
  private alertCounter = 0;

  constructor() {
    this.reset();
  }

  public reset(): void {
    for (const courtId of COURT_IDS) this.clear(courtId);
  }

  /** Forgets one court (the director dismissing a finished or abandoned tile). */
  public clear(courtId: CourtId): void {
    this.courts.set(courtId, {
      active: null,
      rivals: new Map(),
      feed: [],
      linkLostReported: false,
      conflictReported: false,
    });
  }

  public ingest(frame: CourtFrame, receivedAtMs: number): IngestResult {
    if (frame.kind === 'sync-request') return { outcome: 'ignored', alerts: [] };

    const court = this.track(frame.courtId);
    const identity = identityOf(frame);
    const active = court.active;

    if (frame.kind === 'bye') {
      if (active && active.identity === identity) {
        if (frame.seq <= active.lastSeq) return { outcome: 'reordered', alerts: [] };
        active.lastSeq = frame.seq;
        if (active.saidBye) return { outcome: 'accepted', alerts: [] };
        active.saidBye = true;
        return {
          outcome: 'accepted',
          alerts: [
            this.alert('desk-signed-off', frame.courtId, 'info', receivedAtMs, `desk signed off (${active.deskLabel})`),
          ],
        };
      }
      court.rivals.delete(identity);
      return { outcome: 'ignored', alerts: [] };
    }

    if (active && active.identity === identity) {
      if (frame.seq === active.lastSeq) return { outcome: 'duplicate', alerts: [] };
      if (frame.seq < active.lastSeq) return { outcome: 'reordered', alerts: [] };
      return { outcome: 'accepted', alerts: this.refresh(court, active, frame, receivedAtMs) };
    }

    if (active) {
      const newerLoadOfSameDevice =
        frame.deskId === active.deskId && frame.sessionStartedAtMs > active.sessionStartedAtMs;
      const ownerGone = active.saidBye || receivedAtMs - active.lastHeardAtMs >= STALE_AFTER_MS;
      if (!newerLoadOfSameDevice && !ownerGone) {
        const rival = court.rivals.get(identity);
        court.rivals.set(identity, {
          deskLabel: frame.deskLabel,
          lastHeardAtMs: receivedAtMs,
          frames: (rival?.frames ?? 0) + 1,
        });
        return { outcome: 'court-claimed', alerts: [] };
      }
    }

    return { outcome: 'accepted', alerts: this.adopt(court, frame, receivedAtMs) };
  }

  /**
   * Emits the alerts that depend on the passage of time rather than on a frame:
   * a link going stale and a court conflict appearing. Call a few times a second.
   */
  public sweep(nowMs: number): CourtAlert[] {
    const alerts: CourtAlert[] = [];
    for (const courtId of COURT_IDS) {
      const court = this.track(courtId);
      const active = court.active;

      for (const [identity, rival] of court.rivals) {
        if (nowMs - rival.lastHeardAtMs >= CONFLICT_WINDOW_MS) court.rivals.delete(identity);
      }

      if (!active) continue;

      const isStale = !active.saidBye && nowMs - active.lastHeardAtMs >= STALE_AFTER_MS;
      if (isStale && !court.linkLostReported) {
        court.linkLostReported = true;
        alerts.push(this.alert('link-lost', courtId, 'warn', nowMs, `desk link lost (${active.deskLabel})`));
      }

      const rivalLabels = this.rivalLabels(court, nowMs);
      if (rivalLabels.length > 0 && !court.conflictReported) {
        court.conflictReported = true;
        alerts.push(
          this.alert(
            'conflict',
            courtId,
            'warn',
            nowMs,
            `${rivalLabels.length + 1} devices are publishing this court (${[active.deskLabel, ...rivalLabels].join(', ')})`
          )
        );
      } else if (rivalLabels.length === 0) {
        court.conflictReported = false;
      }
    }
    return alerts;
  }

  /** Always four views, in court order A–D. Read-only: safe to call per frame. */
  public getViews(nowMs: number): CourtView[] {
    return COURT_IDS.map((courtId) => this.getView(courtId, nowMs));
  }

  public getView(courtId: CourtId, nowMs: number): CourtView {
    const court = this.track(courtId);
    const active = court.active;
    if (!active) {
      return {
        courtId,
        health: 'empty',
        silenceMs: 0,
        deskId: null,
        deskLabel: null,
        snapshot: null,
        projection: null,
        isProjected: false,
        conflict: null,
        jitterMs: 0,
        framesAccepted: 0,
        events: court.feed,
      };
    }

    const silenceMs = Math.max(0, nowMs - active.lastHeardAtMs);
    const health: CourtLinkHealth = active.saidBye ? 'signed-off' : classifyLinkHealth(silenceMs);
    const isProjected = health === 'live' || health === 'lagging';
    // A dead link must not keep animating: fall back to the last confirmed values.
    const projection = projectSnapshot(active.snapshot, isProjected ? nowMs - active.anchorMs : 0);
    const rivalLabels = this.rivalLabels(court, nowMs);

    return {
      courtId,
      health,
      silenceMs,
      deskId: active.deskId,
      deskLabel: active.deskLabel,
      snapshot: active.snapshot,
      projection,
      isProjected,
      conflict: rivalLabels.length > 0 ? { rivalLabels } : null,
      jitterMs: active.offsetFilter.latestJitterMs(),
      framesAccepted: active.framesAccepted,
      events: court.feed,
    };
  }

  private track(courtId: CourtId): CourtTrack {
    return this.courts.get(courtId) as CourtTrack;
  }

  private rivalLabels(court: CourtTrack, nowMs: number): string[] {
    const labels: string[] = [];
    for (const rival of court.rivals.values()) {
      if (rival.frames >= CONFLICT_MIN_FRAMES && nowMs - rival.lastHeardAtMs < CONFLICT_WINDOW_MS) {
        labels.push(rival.deskLabel);
      }
    }
    return labels;
  }

  private adopt(court: CourtTrack, frame: CourtSnapshotFrame, receivedAtMs: number): CourtAlert[] {
    const previous = court.active;
    const offsetFilter = new ClockOffsetFilter();
    court.active = {
      identity: identityOf(frame),
      deskId: frame.deskId,
      deskLabel: frame.deskLabel,
      sessionStartedAtMs: frame.sessionStartedAtMs,
      lastSeq: frame.seq,
      snapshot: frame.snapshot,
      anchorMs: offsetFilter.observe(frame.snapshot.capturedAtMs, receivedAtMs),
      lastHeardAtMs: receivedAtMs,
      saidBye: false,
      offsetFilter,
      framesAccepted: 1,
    };
    court.rivals.delete(court.active.identity);
    const endsOutage = court.linkLostReported;
    court.linkLostReported = false;
    this.mergeFeed(court, frame.snapshot.recentEvents);

    // A reload of the same tablet is routine; only announce a genuinely new desk.
    if (previous && previous.deskId === frame.deskId) {
      return endsOutage
        ? [this.alert('link-restored', frame.courtId, 'info', receivedAtMs, `desk link restored (${frame.deskLabel})`)]
        : [];
    }
    return [this.alert('desk-joined', frame.courtId, 'info', receivedAtMs, `desk online (${frame.deskLabel})`)];
  }

  private refresh(
    court: CourtTrack,
    active: DeskTrack,
    frame: CourtSnapshotFrame,
    receivedAtMs: number
  ): CourtAlert[] {
    const previous = active.snapshot;
    const next = frame.snapshot;
    const alerts: CourtAlert[] = [];

    if (court.linkLostReported) {
      court.linkLostReported = false;
      alerts.push(
        this.alert('link-restored', frame.courtId, 'info', receivedAtMs, `desk link restored (${frame.deskLabel})`)
      );
    }

    active.lastSeq = frame.seq;
    active.deskLabel = frame.deskLabel;
    active.snapshot = next;
    active.anchorMs = active.offsetFilter.observe(next.capturedAtMs, receivedAtMs);
    active.lastHeardAtMs = receivedAtMs;
    active.saidBye = false;
    active.framesAccepted += 1;
    this.mergeFeed(court, next.recentEvents);

    const whiteDelta = next.scoreWhite - previous.scoreWhite;
    const darkDelta = next.scoreDark - previous.scoreDark;
    // Exactly one goal for exactly one team; a roster import or a correction is not a goal.
    if (whiteDelta + darkDelta === 1 && (whiteDelta === 1 || darkDelta === 1)) {
      const scorer: CourtTeam = whiteDelta === 1 ? 'white' : 'dark';
      alerts.push(
        this.alert('goal', frame.courtId, 'info', receivedAtMs, `GOAL ${teamName(next, scorer)} — ${scoreLine(next)}`)
      );
    }

    if (previous.gameTimeMs > 0 && next.gameTimeMs === 0 && next.period === previous.period && next.period <= 6) {
      alerts.push(
        this.alert(
          'period-end',
          frame.courtId,
          'info',
          receivedAtMs,
          `END OF ${periodLabel(next.period)} — ${scoreLine(next)}`
        )
      );
    }

    if (!previous.activeTimeout && next.activeTimeout) {
      alerts.push(
        this.alert(
          'timeout',
          frame.courtId,
          'info',
          receivedAtMs,
          `${next.activeTimeout.type} TIMEOUT — ${teamName(next, next.activeTimeout.team)}`
        )
      );
    }

    for (const team of ['white', 'dark'] as const) {
      for (const cap of next.cappedOut[team]) {
        if (!previous.cappedOut[team].includes(cap)) {
          alerts.push(
            this.alert(
              'cap-out',
              frame.courtId,
              'warn',
              receivedAtMs,
              `CAP-OUT ${teamName(next, team)} #${cap} — third personal foul (WP 22.3)`
            )
          );
        }
      }
    }

    return alerts;
  }

  private mergeFeed(court: CourtTrack, incoming: CourtEvent[]): void {
    if (incoming.length === 0) return;
    const known = new Set(court.feed.map((event) => event.id));
    const fresh = incoming.filter((event) => !known.has(event.id));
    if (fresh.length === 0) return;
    court.feed = [...fresh, ...court.feed].sort((a, b) => b.atMs - a.atMs).slice(0, MAX_FEED_EVENTS);
  }

  private alert(
    kind: CourtAlertKind,
    courtId: CourtId,
    severity: 'info' | 'warn',
    atMs: number,
    detail: string
  ): CourtAlert {
    this.alertCounter += 1;
    return { id: `${courtId}-${kind}-${this.alertCounter}`, kind, courtId, severity, atMs, text: `Court ${courtId} — ${detail}` };
  }
}

// ---------------------------------------------------------------------------
// Desk-side publisher
// ---------------------------------------------------------------------------

export interface CourtPublisherOptions {
  room: string;
  courtId: CourtId;
  deskId: string;
  deskLabel: string;
  sessionStartedAtMs: number;
  now: () => number;
  /** Shared, strictly increasing counter for this page load. */
  nextSeq: () => number;
  send: (frame: CourtFrame) => void;
}

/** Everything that is not a ticking countdown; any change here is sent at once. */
function discreteSignature(snapshot: CourtSnapshot): string {
  return JSON.stringify([
    snapshot.isRunning,
    snapshot.period,
    snapshot.scoreWhite,
    snapshot.scoreDark,
    snapshot.teamWhiteName,
    snapshot.teamDarkName,
    snapshot.quarterScores,
    snapshot.hornActive,
    snapshot.ruleset,
    snapshot.scoreboardProtocol,
    snapshot.hardwareLink,
    snapshot.timeoutsLeft,
    snapshot.activeTimeout ? [snapshot.activeTimeout.team, snapshot.activeTimeout.type] : null,
    snapshot.exclusions.map((exclusion) => [exclusion.id, exclusion.team, exclusion.cap]),
    snapshot.cappedOut,
    snapshot.recentEvents.length > 0 ? snapshot.recentEvents[0].id : null,
  ]);
}

/**
 * True when a director holding `sent` would, by projecting it forward, already
 * be showing `current` within tolerance — i.e. no frame needs to be sent.
 */
export function isPredictedBy(sent: CourtSnapshot, current: CourtSnapshot): boolean {
  if (discreteSignature(sent) !== discreteSignature(current)) return false;

  const predicted = projectSnapshot(sent, current.capturedAtMs - sent.capturedAtMs);
  if (Math.abs(predicted.gameTimeMs - current.gameTimeMs) > CLOCK_TOLERANCE_MS) return false;
  if (Math.abs(predicted.shotTimeMs - current.shotTimeMs) > CLOCK_TOLERANCE_MS) return false;

  if (current.activeTimeout) {
    const predictedMs = predicted.activeTimeout ? predicted.activeTimeout.remainingMs : 0;
    if (Math.abs(predictedMs - current.activeTimeout.remainingMs) > COUNTDOWN_TOLERANCE_MS) return false;
  }

  for (const exclusion of current.exclusions) {
    const match = predicted.exclusions.find((candidate) => candidate.id === exclusion.id);
    const predictedMs = match ? match.remainingMs : 0;
    if (Math.abs(predictedMs - exclusion.remainingMs) > COUNTDOWN_TOLERANCE_MS) return false;
  }
  return true;
}

/** Nothing in a static snapshot depends on the time it was captured. */
function isStatic(snapshot: CourtSnapshot): boolean {
  return !snapshot.isRunning && snapshot.activeTimeout === null;
}

/**
 * Decides when a desk transmits.
 *
 * The console re-renders ten times a second while the clock runs, but the
 * director can predict every one of those ticks. So a frame is sent only when
 * that prediction would be wrong (a whistle, a reset, a goal, a manual clock
 * edit), plus a 1 Hz heartbeat that proves the desk is alive and bounds drift.
 */
export class CourtPublisher {
  private latest: CourtSnapshot | null = null;
  private lastSent: CourtSnapshot | null = null;
  private lastSentAtMs = Number.NEGATIVE_INFINITY;
  private pending = false;
  private framesSent = 0;

  constructor(private readonly options: CourtPublisherOptions) {}

  /** Feed the console's current state; cheap enough to call on every render. */
  public update(input: DeskStateInput): void {
    const now = this.options.now();
    const snapshot = buildCourtSnapshot(input, now);
    if (!snapshot) return;
    this.latest = snapshot;
    if (!this.lastSent || !isPredictedBy(this.lastSent, snapshot)) this.pending = true;
    this.pump(now);
  }

  /** Drives the heartbeat and any frame deferred by the rate limit. */
  public tick(): void {
    if (!this.latest) return;
    const now = this.options.now();
    if (now - this.lastSentAtMs >= HEARTBEAT_INTERVAL_MS) this.pending = true;
    this.pump(now);
  }

  /** Request an immediate re-announcement (a dashboard just joined). */
  public flush(): void {
    if (!this.latest) return;
    this.pending = true;
    this.pump(this.options.now());
  }

  /** Tell dashboards this desk is leaving, after one final snapshot. */
  public bye(): void {
    if (this.latest) {
      this.pending = true;
      this.lastSentAtMs = Number.NEGATIVE_INFINITY;
      this.pump(this.options.now());
    }
    this.options.send({ ...this.header(), kind: 'bye', courtId: this.options.courtId });
    this.framesSent += 1;
  }

  public getFramesSent(): number {
    return this.framesSent;
  }

  public getLastSentAtMs(): number | null {
    return Number.isFinite(this.lastSentAtMs) ? this.lastSentAtMs : null;
  }

  private header(): CourtFrameBase {
    return {
      v: COURT_LINK_PROTOCOL_VERSION,
      room: this.options.room,
      deskId: this.options.deskId,
      sessionStartedAtMs: this.options.sessionStartedAtMs,
      seq: this.options.nextSeq(),
      sentAtMs: this.options.now(),
    };
  }

  private pump(now: number): void {
    if (!this.pending || !this.latest) return;
    if (now - this.lastSentAtMs < MIN_SEND_INTERVAL_MS) return;

    // A static state is as true now as when it was captured, so re-stamp it:
    // the heartbeat then carries a fresh timestamp for the offset filter.
    const snapshot = isStatic(this.latest) ? { ...this.latest, capturedAtMs: now } : this.latest;
    this.latest = snapshot;
    this.pending = false;
    this.lastSent = snapshot;
    this.lastSentAtMs = now;
    this.framesSent += 1;
    this.options.send({
      ...this.header(),
      kind: 'snapshot',
      courtId: this.options.courtId,
      deskLabel: this.options.deskLabel,
      snapshot,
    });
  }
}
