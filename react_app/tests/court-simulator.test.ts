/**
 * Demo simulator — the scripted matches must obey the same rules as the real
 * console, and must only ever speak valid protocol.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COURT_IDS,
  CourtDirectory,
  CourtFrame,
  CourtId,
  CourtSnapshot,
  encodeCourtFrame,
  parseCourtFrame,
} from '../src/engine/court-link';
import { CourtSimulator, DEMO_COURT_SCRIPTS, createSeededRandom } from '../src/engine/court-simulator';
import { FakeClock } from './helpers';

const ROOM = 'SIM-ROOM';
const STEP_MS = 100;

interface Run {
  frames: CourtFrame[];
  encoded: string[];
  byCourt: Map<CourtId, CourtSnapshot[]>;
}

/**
 * Runs the four demo courts for `seconds` of simulated time.
 *
 * Court D's scripted link outage is switched off here so that every frame a
 * desk produced is observed: the rules checks compare consecutive frames, and
 * a gap would let two separate events look like one.
 */
function runDemo(seconds: number): Run {
  const clock = new FakeClock(1_800_000_000_000);
  const frames: CourtFrame[] = [];
  const simulator = new CourtSimulator({
    room: ROOM,
    now: clock.now,
    deliver: (frame) => frames.push(frame),
    scripts: DEMO_COURT_SCRIPTS.map((script) => ({ ...script, outageSeconds: 0, outageEverySeconds: 0 })),
  });
  for (let elapsed = 0; elapsed < seconds * 1_000; elapsed += STEP_MS) {
    clock.advance(STEP_MS);
    simulator.advance(clock.nowMs);
  }
  const byCourt = new Map<CourtId, CourtSnapshot[]>(COURT_IDS.map((courtId) => [courtId, []]));
  for (const frame of frames) {
    if (frame.kind === 'snapshot') (byCourt.get(frame.courtId) as CourtSnapshot[]).push(frame.snapshot);
  }
  return { frames, encoded: frames.map(encodeCourtFrame), byCourt };
}

// Twenty simulated minutes: every court plays through several periods.
const LONG_RUN = runDemo(20 * 60);

describe('demo simulator — protocol', () => {
  it('produces frames for all four courts', () => {
    for (const courtId of COURT_IDS) {
      assert.ok((LONG_RUN.byCourt.get(courtId) as CourtSnapshot[]).length > 600, `court ${courtId}`);
    }
  });

  it('only ever emits frames the director parser accepts unchanged', () => {
    for (let i = 0; i < LONG_RUN.frames.length; i += 1) {
      const parsed = parseCourtFrame(LONG_RUN.encoded[i], ROOM);
      assert.equal(parsed.ok, true);
      if (parsed.ok) assert.deepEqual(parsed.frame, LONG_RUN.frames[i]);
    }
  });

  it('stays near one frame a second per court', () => {
    const perCourtPerSecond = LONG_RUN.frames.length / 4 / (20 * 60);
    assert.ok(perCourtPerSecond > 0.8 && perCourtPerSecond < 1.6, `rate was ${perCourtPerSecond.toFixed(2)} frames/s`);
  });

  it('replays identically from the same seeds', () => {
    assert.deepEqual(runDemo(90).encoded, runDemo(90).encoded);
  });

  it('uses a deterministic, well-spread random source', () => {
    const random = createSeededRandom(42);
    const again = createSeededRandom(42);
    const values = Array.from({ length: 2_000 }, () => random());
    assert.deepEqual(values.slice(0, 5), Array.from({ length: 5 }, () => again()));
    assert.ok(values.every((value) => value >= 0 && value < 1));
    const mean = values.reduce((total, value) => total + value, 0) / values.length;
    assert.ok(Math.abs(mean - 0.5) < 0.03, `mean was ${mean}`);
  });
});

describe('demo simulator — rules invariants over twenty minutes', () => {
  it('never shows a negative clock or a shot clock above 30 s', () => {
    for (const snapshots of LONG_RUN.byCourt.values()) {
      for (const snapshot of snapshots) {
        assert.ok(snapshot.gameTimeMs >= 0 && snapshot.gameTimeMs <= 480_000);
        assert.ok(snapshot.shotTimeMs >= 0 && snapshot.shotTimeMs <= 30_000);
      }
    }
  });

  it('keeps the score equal to the sum of the period scores', () => {
    for (const snapshots of LONG_RUN.byCourt.values()) {
      for (const snapshot of snapshots) {
        assert.equal(snapshot.scoreWhite, snapshot.quarterScores.white.reduce((a, b) => a + b, 0));
        assert.equal(snapshot.scoreDark, snapshot.quarterScores.dark.reduce((a, b) => a + b, 0));
      }
    }
  });

  it('WP 21: a goal releases the defending team and resets the shot clock to 30 s', () => {
    let goals = 0;
    for (const snapshots of LONG_RUN.byCourt.values()) {
      for (let i = 1; i < snapshots.length; i += 1) {
        const previous = snapshots[i - 1];
        const current = snapshots[i];
        const whiteScored = current.scoreWhite === previous.scoreWhite + 1 && current.scoreDark === previous.scoreDark;
        const darkScored = current.scoreDark === previous.scoreDark + 1 && current.scoreWhite === previous.scoreWhite;
        if (!whiteScored && !darkScored) continue;
        goals += 1;
        const defending = whiteScored ? 'dark' : 'white';
        assert.deepEqual(
          current.exclusions.filter((exclusion) => exclusion.team === defending),
          [],
          'defending exclusions must be released on the goal'
        );
        assert.equal(current.shotTimeMs, 30_000);
        assert.equal(current.isRunning, false, 'play stops for the restart');
      }
    }
    assert.ok(goals >= 20, `expected plenty of goals to check, saw ${goals}`);
  });

  it('NFHS: a new exclusion resets the shot clock to 30 s on the high-school court and 20 s elsewhere', () => {
    const newExclusions = new Map<CourtId, number>(COURT_IDS.map((courtId) => [courtId, 0]));
    for (const [courtId, snapshots] of LONG_RUN.byCourt) {
      const script = DEMO_COURT_SCRIPTS.find((candidate) => candidate.courtId === courtId);
      assert.ok(script);
      const seen = new Set<string>();
      for (const snapshot of snapshots) {
        assert.equal(snapshot.ruleset, script.enable20sReset ? 'ncaa-wa' : 'nfhs');
        for (const exclusion of snapshot.exclusions) {
          if (seen.has(exclusion.id)) continue;
          seen.add(exclusion.id);
          newExclusions.set(courtId, (newExclusions.get(courtId) as number) + 1);
          assert.equal(snapshot.shotTimeMs, script.enable20sReset ? 20_000 : 30_000, `court ${courtId}`);
          assert.equal(exclusion.remainingMs, 20_000);
        }
      }
    }
    assert.ok((newExclusions.get('D') as number) >= 3, 'the NFHS court must have been exercised');
    assert.ok((newExclusions.get('A') as number) + (newExclusions.get('B') as number) >= 3);
  });

  it('WP 22.3: a capped-out player is never excluded again in that match', () => {
    let capOuts = 0;
    for (const snapshots of LONG_RUN.byCourt.values()) {
      const seenExclusions = new Set<string>();
      let previous: CourtSnapshot | null = null;
      for (const snapshot of snapshots) {
        const newMatch = previous !== null && snapshot.scoreWhite + snapshot.scoreDark < previous.scoreWhite + previous.scoreDark;
        if (previous && !newMatch) {
          for (const team of ['white', 'dark'] as const) {
            // Within a match the capped-out list only grows.
            for (const cap of previous.cappedOut[team]) assert.ok(snapshot.cappedOut[team].includes(cap));
            for (const cap of snapshot.cappedOut[team]) {
              if (!previous.cappedOut[team].includes(cap)) capOuts += 1;
            }
            for (const exclusion of snapshot.exclusions) {
              if (exclusion.team !== team || seenExclusions.has(exclusion.id)) continue;
              assert.ok(
                !previous.cappedOut[team].includes(exclusion.cap),
                `cap #${exclusion.cap} was excluded after capping out`
              );
            }
          }
        }
        for (const exclusion of snapshot.exclusions) seenExclusions.add(exclusion.id);
        previous = snapshot;
      }
    }
    assert.ok(capOuts >= 1, 'at least one cap-out should occur in twenty minutes of four matches');
  });

  it('never has more than two players excluded at once, and none while a period is over', () => {
    for (const snapshots of LONG_RUN.byCourt.values()) {
      for (const snapshot of snapshots) {
        assert.ok(snapshot.exclusions.length <= 2);
        if (snapshot.gameTimeMs === 0) assert.deepEqual(snapshot.exclusions, []);
      }
    }
  });

  it('stops both clocks at a 0.0 shot clock and at the end of a period', () => {
    let shotViolations = 0;
    let periodEnds = 0;
    for (const snapshots of LONG_RUN.byCourt.values()) {
      for (const snapshot of snapshots) {
        if (snapshot.gameTimeMs === 0) {
          periodEnds += 1;
          assert.equal(snapshot.isRunning, false);
        } else if (snapshot.shotTimeMs === 0) {
          shotViolations += 1;
          assert.equal(snapshot.isRunning, false);
        }
      }
    }
    assert.ok(periodEnds >= 4, `saw ${periodEnds} end-of-period frames`);
    assert.ok(shotViolations >= 1, `saw ${shotViolations} shot-clock violations`);
  });

  it('advances through the periods and starts a new match after the fourth', () => {
    const courtA = LONG_RUN.byCourt.get('A') as CourtSnapshot[];
    assert.equal(courtA[0].period, 4);
    assert.ok(courtA.some((snapshot) => snapshot.period === 1 && snapshot.scoreWhite + snapshot.scoreDark === 0));
    const courtD = LONG_RUN.byCourt.get('D') as CourtSnapshot[];
    assert.ok(courtD.some((snapshot) => snapshot.period === 2), 'court D should reach the second period');
  });
});

describe('demo simulator — link outage on court D', () => {
  it('drives the dashboard through lagging, lost and restored', () => {
    const clock = new FakeClock(1_800_000_000_000);
    const directory = new CourtDirectory();
    const alerts: string[] = [];
    const simulator = new CourtSimulator({
      room: ROOM,
      now: clock.now,
      deliver: (frame) => {
        for (const alert of directory.ingest(frame, clock.nowMs).alerts) alerts.push(`${alert.courtId}:${alert.kind}`);
      },
    });

    const healthSeen = new Set<string>();
    for (let elapsed = 0; elapsed < 70_000; elapsed += STEP_MS) {
      clock.advance(STEP_MS);
      simulator.advance(clock.nowMs);
      for (const alert of directory.sweep(clock.nowMs)) alerts.push(`${alert.courtId}:${alert.kind}`);
      healthSeen.add(directory.getView('D', clock.nowMs).health);
      // The other three courts never lose their link.
      for (const courtId of ['A', 'B', 'C'] as const) {
        assert.equal(directory.getView(courtId, clock.nowMs).health, 'live', `court ${courtId} at ${elapsed} ms`);
      }
    }

    assert.deepEqual([...healthSeen].sort(), ['lagging', 'live', 'stale']);
    assert.ok(alerts.includes('D:link-lost'));
    assert.ok(alerts.indexOf('D:link-restored') > alerts.indexOf('D:link-lost'));
    assert.equal(directory.getView('D', clock.nowMs).health, 'live');
  });
});
