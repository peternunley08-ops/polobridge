/**
 * PoloBridge & PoloPad Pro — Match Clock Engine
 * ==============================================
 * The one place that says how the game clock, shot clock, exclusions and team
 * timeouts move through time. The scoring console and the Tournament Director
 * projection both use it, so the two can never disagree about a stoppage.
 *
 * Clocks stay quantised to 100 ms ticks, but ticks are counted against the
 * wall clock instead of against timer callbacks. A timer that fires late, a
 * throttled background tab or a tablet that slept all produce the right number
 * of ticks on the next callback, so the clock re-synchronises by itself.
 *
 * Pure: no DOM, no timers. Callers pass the current time in.
 */

export const CLOCK_TICK_MS = 100;
/** A 60 s team timeout sounds a warning horn with this much left. */
export const TIMEOUT_WARNING_MS = 15 * 1000;
/** Exclusions at or below this many seconds are finished (matches the console). */
const EXCLUSION_DONE_SECONDS = 0.05;

export type ClockExpiry = 'none' | 'shot-clock' | 'period';

export interface MatchClocks {
  gameTimeMs: number;
  shotTimeMs: number;
}

export interface MatchClockStep extends MatchClocks {
  /** How long the clocks actually ran: less than asked when one of them expired. */
  ranForMs: number;
  expiry: ClockExpiry;
}

/**
 * Runs both clocks for `elapsedMs`.
 *
 * A shot clock reaching 0.0 stops BOTH clocks (violation); a game clock
 * reaching 0.0 ends the period. Either way they stop after min(T_game, T_shot),
 * and a simultaneous expiry counts as the end of the period.
 */
export function advanceMatchClocks(clocks: MatchClocks, elapsedMs: number): MatchClockStep {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const gameTimeMs = Math.max(0, clocks.gameTimeMs);
  const shotTimeMs = Math.max(0, clocks.shotTimeMs);
  const runway = Math.min(gameTimeMs, shotTimeMs);
  const ranForMs = Math.min(elapsed, runway);

  let expiry: ClockExpiry = 'none';
  if (elapsed >= runway) expiry = gameTimeMs <= shotTimeMs ? 'period' : 'shot-clock';

  return { gameTimeMs: gameTimeMs - ranForMs, shotTimeMs: shotTimeMs - ranForMs, ranForMs, expiry };
}

/** Counts exclusions down by the time the game clock really ran; drops served ones. */
export function advanceExclusions<T extends { remaining: number }>(exclusions: T[], ranForMs: number): T[] {
  if (ranForMs <= 0 || exclusions.length === 0) return exclusions;
  return exclusions
    .map((exclusion) => ({ ...exclusion, remaining: Math.max(0, exclusion.remaining - ranForMs / 1000) }))
    .filter((exclusion) => exclusion.remaining > EXCLUSION_DONE_SECONDS);
}

export interface RunningTimeout {
  type: '60s' | '30s';
  remainingMs: number;
  warned15s: boolean;
}

export interface TimeoutStep<T extends RunningTimeout> {
  /** null once the timeout has run out. */
  timeout: T | null;
  /** True on the step where a 60 s timeout first reaches 15 s remaining. */
  crossedWarning: boolean;
  expired: boolean;
}

/** A team timeout runs in real time, whether or not the game clock is running. */
export function advanceTimeout<T extends RunningTimeout>(timeout: T, elapsedMs: number): TimeoutStep<T> {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const remainingMs = timeout.remainingMs - elapsed;
  if (remainingMs <= 0) return { timeout: null, crossedWarning: false, expired: true };

  const crossedWarning = timeout.type === '60s' && !timeout.warned15s && remainingMs <= TIMEOUT_WARNING_MS;
  return {
    timeout: { ...timeout, remainingMs, warned15s: timeout.warned15s || crossedWarning },
    crossedWarning,
    expired: false,
  };
}

/**
 * Turns wall-clock time into whole ticks. The part of a tick that has not
 * elapsed yet is carried to the next call, so no time is ever lost or counted
 * twice however irregularly the caller's timer fires.
 */
export class TickAccumulator {
  /** Wall time of the last tick boundary that has been handed out. */
  private anchorMs: number;

  constructor(nowMs: number, private readonly tickMs: number = CLOCK_TICK_MS) {
    this.anchorMs = nowMs;
  }

  /** Whole ticks that have elapsed since the previous call. */
  public consume(nowMs: number): number {
    if (!Number.isFinite(nowMs)) return 0;
    if (nowMs < this.anchorMs) {
      // The wall clock was set back: start again from here, never run backwards.
      this.anchorMs = nowMs;
      return 0;
    }
    const ticks = Math.floor((nowMs - this.anchorMs) / this.tickMs);
    this.anchorMs += ticks * this.tickMs;
    return ticks;
  }

  /** Delay to request so the next callback lands on the next tick boundary. */
  public msUntilNextTick(nowMs: number): number {
    const remaining = this.anchorMs + this.tickMs - nowMs;
    return Math.min(this.tickMs, Math.max(1, remaining));
  }
}
