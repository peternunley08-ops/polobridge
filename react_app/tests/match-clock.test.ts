/**
 * Match clock engine tests.
 * Runs against the real engine source (no re-implementation of the clock rules),
 * except for the legacy one-tick loop below, which is the reference the
 * console originally used.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CLOCK_TICK_MS,
  TIMEOUT_WARNING_MS,
  TickAccumulator,
  advanceExclusions,
  advanceMatchClocks,
  advanceTimeout,
} from '../src/engine/match-clock';
import { createSeededRandom } from '../src/engine/court-simulator';

describe('match clocks — both clocks run together and stop together', () => {
  it('runs both clocks down by the same elapsed time', () => {
    assert.deepEqual(advanceMatchClocks({ gameTimeMs: 60000, shotTimeMs: 25000 }, 10000), {
      gameTimeMs: 50000,
      shotTimeMs: 15000,
      ranForMs: 10000,
      expiry: 'none',
    });
  });

  it('stops both clocks when the shot clock reaches 0.0', () => {
    assert.deepEqual(advanceMatchClocks({ gameTimeMs: 60000, shotTimeMs: 25000 }, 40000), {
      gameTimeMs: 35000,
      shotTimeMs: 0,
      ranForMs: 25000,
      expiry: 'shot-clock',
    });
  });

  it('ends the period when the game clock reaches 0.0', () => {
    assert.deepEqual(advanceMatchClocks({ gameTimeMs: 8000, shotTimeMs: 20000 }, 9000), {
      gameTimeMs: 0,
      shotTimeMs: 12000,
      ranForMs: 8000,
      expiry: 'period',
    });
  });

  it('treats a simultaneous expiry as the end of the period', () => {
    assert.deepEqual(advanceMatchClocks({ gameTimeMs: 20000, shotTimeMs: 20000 }, 20000), {
      gameTimeMs: 0,
      shotTimeMs: 0,
      ranForMs: 20000,
      expiry: 'period',
    });
  });

  it('stops the shot clock at the exact instant it reaches 0.0', () => {
    assert.equal(advanceMatchClocks({ gameTimeMs: 60000, shotTimeMs: 25000 }, 24999).expiry, 'none');
    assert.equal(advanceMatchClocks({ gameTimeMs: 60000, shotTimeMs: 25000 }, 25000).expiry, 'shot-clock');
  });

  it('leaves positive clocks alone when no time elapses', () => {
    assert.deepEqual(advanceMatchClocks({ gameTimeMs: 60000, shotTimeMs: 25000 }, 0), {
      gameTimeMs: 60000,
      shotTimeMs: 25000,
      ranForMs: 0,
      expiry: 'none',
    });
  });

  it('stops play at once when the shot clock is already at 0.0, leaving the game clock still', () => {
    assert.deepEqual(advanceMatchClocks({ gameTimeMs: 60000, shotTimeMs: 0 }, 100), {
      gameTimeMs: 60000,
      shotTimeMs: 0,
      ranForMs: 0,
      expiry: 'shot-clock',
    });
  });

  it('ends the period at once when the game clock is already at 0.0, leaving the shot clock still', () => {
    assert.deepEqual(advanceMatchClocks({ gameTimeMs: 0, shotTimeMs: 30000 }, 100), {
      gameTimeMs: 0,
      shotTimeMs: 30000,
      ranForMs: 0,
      expiry: 'period',
    });
  });

  it('treats negative or non-finite elapsed time as zero', () => {
    const negative = advanceMatchClocks({ gameTimeMs: 60000, shotTimeMs: 25000 }, -500);
    const notANumber = advanceMatchClocks({ gameTimeMs: 60000, shotTimeMs: 25000 }, Number.NaN);
    assert.equal(negative.gameTimeMs, 60000);
    assert.equal(negative.expiry, 'none');
    assert.equal(notANumber.gameTimeMs, 60000);
    assert.equal(notANumber.expiry, 'none');
  });

  it('never returns a negative clock', () => {
    const long = advanceMatchClocks({ gameTimeMs: 3000, shotTimeMs: 1000 }, 86400000);
    assert.equal(long.gameTimeMs, 2000);
    assert.equal(long.shotTimeMs, 0);
  });

  it('clamps negative clock inputs to zero', () => {
    const step = advanceMatchClocks({ gameTimeMs: -50, shotTimeMs: 1000 }, 100);
    assert.equal(step.gameTimeMs, 0);
    assert.equal(step.expiry, 'period');
  });
});

// ---------------------------------------------------------------------------

interface LegacyClock {
  game: number;
  shot: number;
  running: boolean;
}

/** The console's original per-tick logic: one 100 ms tick. */
function legacyTick(clock: LegacyClock): LegacyClock {
  if (!clock.running) return clock;
  let game = clock.game;
  let shot = clock.shot;
  let running: boolean = clock.running;
  const gameBefore = game;
  if (game <= 100) {
    running = false;
    game = 0;
  } else {
    game -= 100;
  }
  if (shot <= 100) {
    if (gameBefore > 100) running = false;
    shot = 0;
  } else {
    shot -= 100;
  }
  return { game, shot, running };
}

describe('match clocks — identical to the console\'s original one-tick-at-a-time loop', () => {
  it('matches the legacy tick loop for every game, shot and tick count combination', () => {
    let comparisons = 0;
    for (let game = 100; game <= 3000; game += 100) {
      for (let shot = 100; shot <= 3000; shot += 100) {
        for (let k = 1; k <= 40; k++) {
          let legacy: LegacyClock = { game, shot, running: true };
          for (let i = 0; i < k; i++) legacy = legacyTick(legacy);

          const step = advanceMatchClocks({ gameTimeMs: game, shotTimeMs: shot }, k * CLOCK_TICK_MS);
          const message = `game=${game} shot=${shot} k=${k}`;
          assert.equal(step.gameTimeMs, legacy.game, `gameTimeMs mismatch: ${message}`);
          assert.equal(step.shotTimeMs, legacy.shot, `shotTimeMs mismatch: ${message}`);
          assert.equal(step.expiry !== 'none', !legacy.running, `expiry mismatch: ${message}`);
          comparisons++;
        }
      }
    }
    assert.equal(comparisons, 30 * 30 * 40);
  });
});

// ---------------------------------------------------------------------------

describe('exclusions', () => {
  it('counts down in seconds by the time the game clock ran', () => {
    assert.deepEqual(advanceExclusions([{ id: 'a', remaining: 20 }], 5000), [{ id: 'a', remaining: 15 }]);
  });

  it('removes an exclusion that has been served', () => {
    assert.deepEqual(advanceExclusions([{ id: 'a', remaining: 0.1 }], 100), []);
  });

  it('keeps an exclusion that still has time left', () => {
    const result = advanceExclusions([{ id: 'a', remaining: 0.3 }], 100);
    assert.equal(result.length, 1);
    assert.ok(Math.abs(result[0].remaining - 0.2) < 1e-9);
  });

  it('returns the very same array when no time ran or the list is empty', () => {
    const list = [{ id: 'a', remaining: 20 }];
    assert.equal(advanceExclusions(list, 0), list);

    const empty: { remaining: number }[] = [];
    assert.equal(advanceExclusions(empty, 1000), empty);
  });

  it('does not mutate its input and keeps the other fields', () => {
    const input = [{ id: 'a', team: 'dark', cap: 4, remaining: 20 }];
    const output = advanceExclusions(input, 1000);
    assert.equal(input[0].remaining, 20);
    assert.deepEqual(output, [{ id: 'a', team: 'dark', cap: 4, remaining: 19 }]);
  });
});

// ---------------------------------------------------------------------------

describe('team timeout', () => {
  const full = { team: 'white', type: '60s' as const, remainingMs: 60000, warned15s: false };

  it('counts down in real time', () => {
    const step = advanceTimeout(full, 100);
    assert.equal(step.timeout?.remainingMs, 59900);
    assert.equal(step.crossedWarning, false);
    assert.equal(step.expired, false);
  });

  it('warns once when a 60 s timeout reaches 15 s', () => {
    const first = advanceTimeout({ ...full, remainingMs: 15100 }, 100);
    assert.equal(first.timeout?.remainingMs, 15000);
    assert.equal(first.crossedWarning, true);
    assert.equal(first.timeout?.warned15s, true);

    const again = first.timeout;
    assert.ok(again);
    const second = advanceTimeout(again, 100);
    assert.equal(second.crossedWarning, false);
  });

  it('warns late rather than never after a long pause', () => {
    const step = advanceTimeout({ ...full, remainingMs: 20000 }, 11000);
    assert.equal(step.timeout?.remainingMs, 9000);
    assert.equal(step.crossedWarning, true);
  });

  it('does not warn while more than 15 s remain', () => {
    assert.equal(advanceTimeout({ ...full, remainingMs: 15200 }, 100).crossedWarning, false);
    assert.equal(TIMEOUT_WARNING_MS, 15000);
  });

  it('never warns for a 30 s timeout', () => {
    const step = advanceTimeout({ ...full, type: '30s' as const, remainingMs: 16000 }, 5000);
    assert.equal(step.crossedWarning, false);
  });

  it('expires when no time is left', () => {
    assert.deepEqual(advanceTimeout({ ...full, remainingMs: 100 }, 100), {
      timeout: null,
      crossedWarning: false,
      expired: true,
    });
    assert.deepEqual(advanceTimeout({ ...full, remainingMs: 100 }, 5000), {
      timeout: null,
      crossedWarning: false,
      expired: true,
    });
  });

  it('keeps the team on the running timeout', () => {
    assert.equal(advanceTimeout(full, 100).timeout?.team, 'white');
  });
});

// ---------------------------------------------------------------------------

describe('tick accumulator — whole ticks from the wall clock', () => {
  it('gives no tick until 100 ms have passed', () => {
    const a = new TickAccumulator(1000);
    assert.equal(a.consume(1099), 0);
    assert.equal(a.consume(1100), 1);
  });

  it('carries the remainder into the next call', () => {
    const a = new TickAccumulator(1000);
    assert.equal(a.consume(1150), 1);
    assert.equal(a.consume(1200), 1);
    assert.equal(a.consume(1249), 0);
    assert.equal(a.consume(1250), 0);
    assert.equal(a.consume(1300), 1);
  });

  it('yields every missed tick at once when a timer fires late', () => {
    const a = new TickAccumulator(1000);
    assert.equal(a.consume(1750), 7);
    assert.equal(a.consume(1800), 1);
  });

  it('still counts 100 ticks when a throttled tab fires once a second for ten seconds', () => {
    const a = new TickAccumulator(1000);
    let total = 0;
    for (let i = 1; i <= 10; i++) {
      const ticks = a.consume(1000 + i * 1000);
      assert.equal(ticks, 10);
      total += ticks;
    }
    assert.equal(total, 100);
  });

  it('never loses or double-counts time under irregular callbacks', () => {
    const random = createSeededRandom(7);
    const a = new TickAccumulator(5000);
    let t = 5000;
    let total = 0;
    while (t < 65000) {
      t += Math.floor(random() * 400) + 1;
      t = Math.min(t, 65000);
      total += a.consume(t);
    }
    assert.equal(total, 600);
  });

  it('never runs backwards when the wall clock is set back', () => {
    const a = new TickAccumulator(1000);
    assert.equal(a.consume(1700), 7);
    assert.equal(a.consume(500), 0);
    assert.equal(a.consume(599), 0);
    assert.equal(a.consume(600), 1);
  });

  it('ignores a non-finite time', () => {
    const a = new TickAccumulator(1000);
    assert.equal(a.consume(Number.NaN), 0);
    assert.equal(a.consume(1100), 1);
  });

  it('aims the next callback at the next tick boundary', () => {
    const a = new TickAccumulator(1000);
    assert.equal(a.msUntilNextTick(1000), 100);
    assert.equal(a.msUntilNextTick(1060), 40);
    assert.equal(a.msUntilNextTick(1099.5), 1);
    assert.equal(a.msUntilNextTick(1300), 1);
  });

  it('supports another tick size', () => {
    const a = new TickAccumulator(0, 250);
    assert.equal(a.consume(249), 0);
    assert.equal(a.consume(250), 1);
    assert.equal(a.consume(1000), 3);
    assert.equal(CLOCK_TICK_MS, 100);
  });
});
