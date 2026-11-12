/**
 * Court Link engine — protocol, rules and state-machine tests.
 * Runs against the real engine source (no re-implementation of the rules).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CLOCK_TOLERANCE_MS,
  CONFLICT_WINDOW_MS,
  COURT_LINK_PROTOCOL_VERSION,
  ClockOffsetFilter,
  CourtDirectory,
  CourtFrame,
  CourtPublisher,
  CourtSnapshot,
  DeskStateInput,
  HEARTBEAT_INTERVAL_MS,
  LAGGING_AFTER_MS,
  MAX_EXCLUSIONS,
  MAX_FEED_EVENTS,
  MAX_FRAME_CHARS,
  MAX_GAME_TIME_MS,
  MAX_RECENT_EVENTS,
  MAX_SCORE,
  OFFSET_STEP_RESET_MS,
  OFFSET_WINDOW_SAMPLES,
  PERIOD_SCORE_SLOTS,
  ROOM_CODE_ALPHABET,
  STALE_AFTER_MS,
  buildCourtSnapshot,
  capsCappedOut,
  classifyLinkHealth,
  encodeCourtFrame,
  formatGameClock,
  formatShotClock,
  generateRoomCode,
  isPredictedBy,
  isShotClockBlanked,
  normalizeRoomCode,
  normalizeSnapshot,
  parseCourtFrame,
  periodLabel,
  projectSnapshot,
} from '../src/engine/court-link';
import { createSeededRandom } from '../src/engine/court-simulator';
import { FakeClock, TEST_ROOM, byeFrame, deskState, snapshotFrame } from './helpers';

const T0 = 1_800_000_000_000;

function snapshotOf(state: Partial<DeskStateInput>, capturedAtMs = T0): CourtSnapshot {
  const snapshot = buildCourtSnapshot(deskState(state), capturedAtMs);
  assert.ok(snapshot, 'fixture snapshot must be valid');
  return snapshot;
}

// ---------------------------------------------------------------------------
// Display parity with the scoring console
// ---------------------------------------------------------------------------

describe('clock formatting matches the scoring console digit for digit', () => {
  it('formats the game clock as MM:SS.t using floor, like the console', () => {
    assert.equal(formatGameClock(480_000), '08:00.0');
    assert.equal(formatGameClock(342_300), '05:42.3');
    assert.equal(formatGameClock(59_999), '00:59.9');
    assert.equal(formatGameClock(100), '00:00.1');
    assert.equal(formatGameClock(0), '00:00.0');
    assert.equal(formatGameClock(-250), '00:00.0');
  });

  it('formats the shot clock as whole seconds, with tenths under 10 s', () => {
    assert.equal(formatShotClock(30_000, false), '30');
    assert.equal(formatShotClock(29_900, false), '29');
    assert.equal(formatShotClock(10_000, false), '10');
    assert.equal(formatShotClock(9_900, false), '9.9');
    assert.equal(formatShotClock(4_950, false), '4.9');
    assert.equal(formatShotClock(0, false), '0.0');
  });

  it('shows -- whenever the shot clock is blanked', () => {
    assert.equal(formatShotClock(24_000, true), '--');
    assert.equal(formatShotClock(0, true), '--');
  });

  it('labels regulation, overtime and shootout periods', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(periodLabel), ['Q1', 'Q2', 'Q3', 'Q4', 'OT1', 'OT2', 'PSO']);
  });
});

// ---------------------------------------------------------------------------
// Rules invariants
// ---------------------------------------------------------------------------

describe('World Aquatics Rule WP 20.15 — shot clock blanking when T_game <= T_shot', () => {
  it('blanks when the game clock is below the shot clock', () => {
    assert.equal(isShotClockBlanked(18_000, 30_000), true);
  });

  it('blanks at exact equality (the <= boundary)', () => {
    assert.equal(isShotClockBlanked(30_000, 30_000), true);
  });

  it('un-blanks one tick above equality', () => {
    assert.equal(isShotClockBlanked(30_100, 30_000), false);
  });

  it('is invariant under projection: a visible shot clock never blanks by itself', () => {
    const snapshot = snapshotOf({ isRunning: true, gameTimeMs: 40_000, shotTimeMs: 30_000 });
    for (const elapsed of [0, 100, 5_000, 29_900, 30_000, 45_000]) {
      assert.equal(projectSnapshot(snapshot, elapsed).isShotBlanked, false, `elapsed ${elapsed}`);
    }
  });

  it('is invariant under projection: a blanked shot clock stays blanked', () => {
    const snapshot = snapshotOf({ isRunning: true, gameTimeMs: 25_000, shotTimeMs: 30_000 });
    for (const elapsed of [0, 100, 12_000, 25_000, 60_000]) {
      assert.equal(projectSnapshot(snapshot, elapsed).isShotBlanked, true, `elapsed ${elapsed}`);
    }
  });
});

describe('World Aquatics Rule WP 22.3 — third personal foul caps a player out', () => {
  it('lists exactly the caps with three or more personal fouls, in cap order', () => {
    const roster = [
      { cap: 7, exclusions: 2 },
      { cap: 4, exclusions: 3 },
      { cap: 2, exclusions: 4 },
      { cap: 9, exclusions: 0 },
    ];
    assert.deepEqual(capsCappedOut(roster), [2, 4]);
  });

  it('carries cap-outs to the director and raises a warning the moment one appears', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1 }), T0);
    const result = directory.ingest(
      snapshotFrame({ capturedAtMs: T0 + 500, seq: 2, state: { cappedOutDark: [4] } }),
      T0 + 500
    );
    assert.deepEqual(
      result.alerts.map((alert) => [alert.kind, alert.severity]),
      [['cap-out', 'warn']]
    );
    assert.match(result.alerts[0].text, /Court A — CAP-OUT STANFORD #4 .*WP 22\.3/);
    assert.deepEqual(directory.getView('A', T0 + 500).snapshot?.cappedOut, { white: [], dark: [4] });
  });

  it('does not repeat the warning for a player who is already capped out', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1, state: { cappedOutDark: [4] } }), T0);
    const result = directory.ingest(
      snapshotFrame({ capturedAtMs: T0 + 500, seq: 2, state: { cappedOutDark: [4], scoreWhite: 7 } }),
      T0 + 500
    );
    assert.deepEqual(result.alerts, []);
  });
});

describe('NFHS high-school mode is carried to the director', () => {
  it('marks a desk with the 20 s reset disabled as NFHS', () => {
    assert.equal(snapshotOf({ enable20sReset: false }).ruleset, 'nfhs');
    assert.equal(snapshotOf({ enable20sReset: true }).ruleset, 'ncaa-wa');
  });

  it('transmits a ruleset change immediately', () => {
    assert.equal(isPredictedBy(snapshotOf({ enable20sReset: true }), snapshotOf({ enable20sReset: false })), false);
  });
});

describe('World Aquatics Rule WP 21 — exclusions released on a goal reach the director at once', () => {
  it('is not predictable, so the publisher must transmit the release', () => {
    const before = snapshotOf({
      isRunning: true,
      exclusions: [{ id: 'x1', team: 'dark', cap: 4, remaining: 14 }],
    });
    const afterGoal = snapshotOf({ isRunning: true, scoreWhite: 8, shotTimeMs: 30_000, exclusions: [] });
    assert.equal(isPredictedBy(before, afterGoal), false);
  });

  it('clears the exclusion on the dashboard in the same frame as the goal', () => {
    const directory = new CourtDirectory();
    directory.ingest(
      snapshotFrame({
        capturedAtMs: T0,
        seq: 1,
        state: { isRunning: true, exclusions: [{ id: 'x1', team: 'dark', cap: 4, remaining: 14 }] },
      }),
      T0
    );
    assert.equal(directory.getView('A', T0).projection?.exclusions.length, 1);

    const result = directory.ingest(
      snapshotFrame({ capturedAtMs: T0 + 300, seq: 2, state: { scoreWhite: 8, shotTimeMs: 30_000, exclusions: [] } }),
      T0 + 300
    );
    assert.deepEqual(directory.getView('A', T0 + 300).projection?.exclusions, []);
    assert.deepEqual(
      result.alerts.map((alert) => alert.kind),
      ['goal']
    );
  });
});

// ---------------------------------------------------------------------------
// Wire format
// ---------------------------------------------------------------------------

describe('frame codec', () => {
  const fullState: Partial<DeskStateInput> = {
    isRunning: true,
    exclusions: [
      { id: 'x1', team: 'dark', cap: 4, remaining: 13.9 },
      { id: 'x2', team: 'white', cap: 11, remaining: 20 },
    ],
    activeTimeout: { team: 'white', type: '60s', remainingMs: 41_200 },
    cappedOutWhite: [9, 2],
    cappedOutDark: [5],
    isHornActive: true,
    events: [
      {
        id: 'e2',
        timestampIso: '2026-11-10T18:30:02.000Z',
        period: 3,
        gameClock: '05:42.3',
        type: 'GOAL',
        team: 'white',
        cap: 5,
        description: 'GOAL by VANGUARD #5',
      },
      {
        id: 'e1',
        timestampIso: '2026-11-10T18:29:40.000Z',
        period: 3,
        gameClock: '06:04.0',
        type: 'PERIOD_CHANGE',
        description: 'Period switched to Q3',
      },
    ],
  };

  it('round-trips every field exactly', () => {
    const frame = snapshotFrame({ capturedAtMs: T0, seq: 42, courtId: 'C', state: fullState });
    const parsed = parseCourtFrame(encodeCourtFrame(frame), TEST_ROOM);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.deepEqual(parsed.frame, frame);
  });

  it('converts console seconds to milliseconds and sorts cap-outs', () => {
    const snapshot = snapshotOf(fullState);
    assert.deepEqual(
      snapshot.exclusions.map((exclusion) => exclusion.remainingMs),
      [13_900, 20_000]
    );
    assert.deepEqual(snapshot.cappedOut, { white: [2, 9], dark: [5] });
    assert.equal(snapshot.recentEvents[0].atMs, Date.parse('2026-11-10T18:30:02.000Z'));
  });

  it('maps the Bluetooth status onto the three hardware-link states', () => {
    assert.equal(snapshotOf({ bleStatus: 'connected' }).hardwareLink, 'connected');
    assert.equal(snapshotOf({ bleStatus: 'reconnecting' }).hardwareLink, 'reconnecting');
    assert.equal(snapshotOf({ bleStatus: 'connecting' }).hardwareLink, 'reconnecting');
    for (const status of ['disconnected', 'unsupported', 'error', 'anything-else']) {
      assert.equal(snapshotOf({ bleStatus: status }).hardwareLink, 'offline', status);
    }
  });

  it('round-trips bye and sync-request frames', () => {
    const bye = byeFrame({ sentAtMs: T0, seq: 9, courtId: 'D' });
    const parsedBye = parseCourtFrame(encodeCourtFrame(bye), TEST_ROOM);
    assert.deepEqual(parsedBye, { ok: true, frame: bye });

    const sync: CourtFrame = {
      v: COURT_LINK_PROTOCOL_VERSION,
      room: TEST_ROOM,
      kind: 'sync-request',
      deskId: 'DIRECTOR0001',
      sessionStartedAtMs: 5,
      seq: 1,
      sentAtMs: T0,
    };
    assert.deepEqual(parseCourtFrame(encodeCourtFrame(sync), TEST_ROOM), { ok: true, frame: sync });
  });

  const base = (): Record<string, unknown> =>
    JSON.parse(encodeCourtFrame(snapshotFrame({ capturedAtMs: T0 }))) as Record<string, unknown>;
  const reasonFor = (mutate: (frame: Record<string, unknown>) => void): string => {
    const frame = base();
    mutate(frame);
    const parsed = parseCourtFrame(JSON.stringify(frame), TEST_ROOM);
    return parsed.ok ? 'accepted' : parsed.reason;
  };

  it('rejects anything that is not a JSON object string', () => {
    assert.deepEqual(parseCourtFrame(undefined, TEST_ROOM), { ok: false, reason: 'not-string' });
    assert.deepEqual(parseCourtFrame({ v: 1 }, TEST_ROOM), { ok: false, reason: 'not-string' });
    assert.deepEqual(parseCourtFrame('{not json', TEST_ROOM), { ok: false, reason: 'bad-json' });
    assert.deepEqual(parseCourtFrame('[1,2,3]', TEST_ROOM), { ok: false, reason: 'bad-shape' });
    assert.deepEqual(parseCourtFrame('null', TEST_ROOM), { ok: false, reason: 'bad-shape' });
    assert.deepEqual(parseCourtFrame('"pong"', TEST_ROOM), { ok: false, reason: 'bad-shape' });
  });

  it('rejects oversized frames before parsing them', () => {
    const huge = `{"pad":"${'x'.repeat(MAX_FRAME_CHARS)}"}`;
    assert.deepEqual(parseCourtFrame(huge, TEST_ROOM), { ok: false, reason: 'too-large' });
  });

  it('rejects other protocol versions', () => {
    assert.equal(reasonFor((frame) => (frame.v = 2)), 'bad-version');
    assert.equal(reasonFor((frame) => (frame.v = '1')), 'bad-version');
    assert.equal(reasonFor((frame) => delete frame.v), 'bad-version');
  });

  it('rejects frames addressed to another room', () => {
    assert.equal(reasonFor((frame) => (frame.room = 'OTHER-ROOM')), 'wrong-room');
    assert.equal(reasonFor((frame) => (frame.room = 42)), 'wrong-room');
  });

  it('rejects malformed identity and ordering fields', () => {
    assert.equal(reasonFor((frame) => (frame.deskId = 'short')), 'bad-shape');
    assert.equal(reasonFor((frame) => (frame.deskId = 'has spaces in it')), 'bad-shape');
    assert.equal(reasonFor((frame) => (frame.seq = 0)), 'bad-shape');
    assert.equal(reasonFor((frame) => (frame.seq = -4)), 'bad-shape');
    assert.equal(reasonFor((frame) => (frame.seq = 1.5)), 'bad-shape');
    assert.equal(reasonFor((frame) => (frame.seq = '3')), 'bad-shape');
    assert.equal(reasonFor((frame) => (frame.sessionStartedAtMs = null)), 'bad-shape');
  });

  it('rejects unknown kinds and courts', () => {
    assert.equal(reasonFor((frame) => (frame.kind = 'start-clock')), 'bad-kind');
    assert.equal(reasonFor((frame) => (frame.courtId = 'E')), 'bad-court');
    assert.equal(reasonFor((frame) => (frame.courtId = 'a')), 'bad-court');
  });

  it('rejects snapshots with the wrong shape', () => {
    const snapshotReason = (mutate: (snapshot: Record<string, unknown>) => void): string =>
      reasonFor((frame) => mutate(frame.snapshot as Record<string, unknown>));
    assert.equal(snapshotReason((snapshot) => (snapshot.isRunning = 'yes')), 'bad-snapshot');
    assert.equal(snapshotReason((snapshot) => (snapshot.gameTimeMs = null)), 'bad-snapshot');
    assert.equal(snapshotReason((snapshot) => (snapshot.gameTimeMs = '480000')), 'bad-snapshot');
    assert.equal(snapshotReason((snapshot) => (snapshot.teamWhiteName = 7)), 'bad-snapshot');
    assert.equal(snapshotReason((snapshot) => (snapshot.exclusions = 'none')), 'bad-snapshot');
    assert.equal(snapshotReason((snapshot) => (snapshot.exclusions = [{ id: 'x', team: 'red', cap: 1 }])), 'bad-snapshot');
    assert.equal(snapshotReason((snapshot) => (snapshot.ruleset = 'fina')), 'bad-snapshot');
    assert.equal(snapshotReason((snapshot) => (snapshot.activeTimeout = { team: 'white', type: '45s' })), 'bad-snapshot');
    assert.equal(snapshotReason((snapshot) => delete snapshot.quarterScores), 'bad-snapshot');
    assert.equal(reasonFor((frame) => (frame.snapshot = 'x')), 'bad-snapshot');
  });

  it('clamps out-of-range numbers instead of trusting them', () => {
    const snapshot = normalizeSnapshot({
      ...snapshotOf({}),
      gameTimeMs: 99_999_999,
      shotTimeMs: -500,
      scoreWhite: 150,
      scoreDark: -3,
      period: 12,
    });
    assert.ok(snapshot);
    assert.equal(snapshot.gameTimeMs, MAX_GAME_TIME_MS);
    assert.equal(snapshot.shotTimeMs, 0);
    assert.equal(snapshot.scoreWhite, MAX_SCORE);
    assert.equal(snapshot.scoreDark, 0);
    assert.equal(snapshot.period, PERIOD_SCORE_SLOTS);
  });

  it('strips control characters and truncates long text', () => {
    const snapshot = snapshotOf({
      teamWhiteName: 'VAN\u0000GUARD\u001b[31m WATER POLO CLUB OF HUNTINGTON BEACH',
      teamDarkName: '   ',
    });
    assert.equal(snapshot.teamWhiteName.length <= 24, true);
    assert.equal(/[\u0000-\u001f]/.test(snapshot.teamWhiteName), false);
    assert.equal(snapshot.teamWhiteName.startsWith('VAN GUARD'), true);
    assert.equal(snapshot.teamDarkName, 'DARK');
  });

  it('bounds every list so a hostile frame cannot grow the dashboard', () => {
    const manyExclusions = Array.from({ length: 40 }, (_, index) => ({
      id: `x${index}`,
      team: 'white' as const,
      cap: (index % 13) + 1,
      remaining: 10,
    }));
    const manyEvents = Array.from({ length: 30 }, (_, index) => ({
      id: `e${index}`,
      timestampIso: '2026-11-10T18:30:02.000Z',
      period: 1,
      gameClock: '08:00.0',
      type: 'GOAL',
      description: 'x'.repeat(500),
    }));
    const snapshot = snapshotOf({ exclusions: manyExclusions, events: manyEvents });
    assert.equal(snapshot.exclusions.length, MAX_EXCLUSIONS);
    assert.equal(snapshot.recentEvents.length, MAX_RECENT_EVENTS);
    assert.equal(snapshot.recentEvents[0].text.length, 160);
  });

  it('pads and truncates period scores to exactly seven slots', () => {
    assert.deepEqual(snapshotOf({ quarterScores: { white: [1, 2], dark: [] } }).quarterScores, {
      white: [1, 2, 0, 0, 0, 0, 0],
      dark: [0, 0, 0, 0, 0, 0, 0],
    });
    assert.equal(
      snapshotOf({ quarterScores: { white: [1, 1, 1, 1, 1, 1, 1, 1, 1], dark: [0] } }).quarterScores.white.length,
      PERIOD_SCORE_SLOTS
    );
  });

  it('drops unknown keys and cannot be used for prototype pollution', () => {
    const raw =
      '{"v":1,"room":"TEST-ROOM","kind":"bye","courtId":"A","deskId":"DESKAAAA0001","sessionStartedAtMs":1,' +
      '"seq":1,"sentAtMs":1,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"extra":1}';
    const parsed = parseCourtFrame(raw, TEST_ROOM);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.deepEqual(Object.keys(parsed.frame).sort(), [
        'courtId',
        'deskId',
        'kind',
        'room',
        'sentAtMs',
        'seq',
        'sessionStartedAtMs',
        'v',
      ]);
    }
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  });

  it('never throws, whatever arrives', () => {
    const garbage: unknown[] = [
      '',
      ' ',
      '{}',
      '{"v":1}',
      '{"v":1,"room":"TEST-ROOM"}',
      '{"v":1,"room":"TEST-ROOM","kind":"snapshot"}',
      '{"v":1,"room":{"toString":1}}',
      '\u0000\u0001\u0002',
      'ping',
      '1e999',
      '{"v":1,"room":"TEST-ROOM","kind":"snapshot","courtId":"A","deskId":"DESKAAAA0001","sessionStartedAtMs":1,"seq":1,"sentAtMs":1,"snapshot":{"exclusions":[null],"recentEvents":[1]}}',
      42,
      null,
      Symbol('x'),
      () => 1,
    ];
    for (const input of garbage) {
      assert.doesNotThrow(() => parseCourtFrame(input, TEST_ROOM));
      assert.equal(parseCourtFrame(input, TEST_ROOM).ok, false);
    }
  });

  it('returns null rather than throwing when the console state is malformed', () => {
    assert.equal(buildCourtSnapshot(deskState({ gameTimeMs: Number.NaN }), T0), null);
    assert.equal(buildCourtSnapshot(deskState({ shotTimeMs: Number.POSITIVE_INFINITY }), T0), null);
  });
});

describe('room codes', () => {
  it('canonicalises what an operator types', () => {
    assert.equal(normalizeRoomCode('k7qm 4f9x'), 'K7QM-4F9X');
    assert.equal(normalizeRoomCode('  kap7_2026  '), 'KAP7-2026');
    assert.equal(normalizeRoomCode('K7QM--4F9X!'), 'K7QM-4F9X');
    assert.equal(normalizeRoomCode('-local-pool-'), 'LOCAL-POOL');
  });

  it('rejects codes that are too short, too long or not text', () => {
    assert.equal(normalizeRoomCode('ABC'), null);
    assert.equal(normalizeRoomCode('A'.repeat(25)), null);
    assert.equal(normalizeRoomCode('!!!!!!!!'), null);
    assert.equal(normalizeRoomCode(null), null);
    assert.equal(normalizeRoomCode(123456), null);
  });

  it('generates XXXX-XXXX from the unambiguous alphabet', () => {
    const code = generateRoomCode((count) => crypto.getRandomValues(new Uint8Array(count)));
    assert.match(code, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    assert.equal(normalizeRoomCode(code), code);
    for (const forbidden of ['I', 'L', 'O', '0', '1']) assert.equal(ROOM_CODE_ALPHABET.includes(forbidden), false);
  });

  it('uses rejection sampling so every symbol is equally likely', () => {
    // 31 symbols: bytes 248–255 would bias the first eight symbols and must be skipped.
    const bytes = [255, 248, 0, 250, 30, 31, 61, 62, 93, 247, 1, 2];
    const code = generateRoomCode(() => Uint8Array.from(bytes));
    const expected = [0, 30, 31, 61, 62, 93, 247, 1].map((byte) => ROOM_CODE_ALPHABET[byte % 31]);
    assert.equal(code, `${expected.slice(0, 4).join('')}-${expected.slice(4).join('')}`);
  });

  it('fails loudly instead of looping forever on a broken random source', () => {
    assert.throws(() => generateRoomCode((count) => new Uint8Array(count).fill(255)), /usable bytes/);
  });
});

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

describe('clock projection (dead reckoning)', () => {
  it('leaves stopped clocks exactly where they are', () => {
    const projection = projectSnapshot(snapshotOf({ isRunning: false, gameTimeMs: 342_300, shotTimeMs: 24_000 }), 5_000);
    assert.equal(projection.gameTimeMs, 342_300);
    assert.equal(projection.shotTimeMs, 24_000);
    assert.equal(projection.isRunning, false);
    assert.equal(projection.expiry, 'none');
  });

  it('runs both clocks down together while the game is running', () => {
    const projection = projectSnapshot(snapshotOf({ isRunning: true, gameTimeMs: 60_000, shotTimeMs: 25_000 }), 10_000);
    assert.equal(projection.gameTimeMs, 50_000);
    assert.equal(projection.shotTimeMs, 15_000);
    assert.equal(projection.isRunning, true);
    assert.equal(projection.expiry, 'none');
  });

  it('stops BOTH clocks when the shot clock reaches 0.0', () => {
    const projection = projectSnapshot(snapshotOf({ isRunning: true, gameTimeMs: 60_000, shotTimeMs: 25_000 }), 40_000);
    assert.equal(projection.shotTimeMs, 0);
    assert.equal(projection.gameTimeMs, 35_000);
    assert.equal(projection.isRunning, false);
    assert.equal(projection.expiry, 'shot-clock');
  });

  it('ends the period when the game clock reaches 0.0 first', () => {
    const projection = projectSnapshot(snapshotOf({ isRunning: true, gameTimeMs: 8_000, shotTimeMs: 20_000 }), 9_000);
    assert.equal(projection.gameTimeMs, 0);
    assert.equal(projection.shotTimeMs, 12_000);
    assert.equal(projection.isRunning, false);
    assert.equal(projection.expiry, 'period');
    assert.equal(projection.isShotBlanked, true);
  });

  it('treats a simultaneous expiry as the end of the period', () => {
    const projection = projectSnapshot(snapshotOf({ isRunning: true, gameTimeMs: 20_000, shotTimeMs: 20_000 }), 20_000);
    assert.equal(projection.expiry, 'period');
    assert.equal(projection.gameTimeMs, 0);
    assert.equal(projection.shotTimeMs, 0);
  });

  it('stops exactly at the expiry instant, not one tick later', () => {
    const snapshot = snapshotOf({ isRunning: true, gameTimeMs: 60_000, shotTimeMs: 25_000 });
    assert.equal(projectSnapshot(snapshot, 24_999).isRunning, true);
    assert.equal(projectSnapshot(snapshot, 25_000).isRunning, false);
  });

  it('never produces a negative clock, however long the link was silent', () => {
    const projection = projectSnapshot(snapshotOf({ isRunning: true, gameTimeMs: 3_000, shotTimeMs: 1_000 }), 86_400_000);
    assert.equal(projection.gameTimeMs >= 0 && projection.shotTimeMs >= 0, true);
  });

  it('counts exclusions down with the game clock and stops them at a stoppage', () => {
    const snapshot = snapshotOf({
      isRunning: true,
      gameTimeMs: 60_000,
      shotTimeMs: 5_000,
      exclusions: [{ id: 'x1', team: 'dark', cap: 4, remaining: 20 }],
    });
    // The shot clock expires after 5 s, so the exclusion only served 5 s.
    assert.equal(projectSnapshot(snapshot, 12_000).exclusions[0].remainingMs, 15_000);
  });

  it('does not count an exclusion down while the game clock is stopped', () => {
    const snapshot = snapshotOf({ isRunning: false, exclusions: [{ id: 'x1', team: 'dark', cap: 4, remaining: 20 }] });
    assert.equal(projectSnapshot(snapshot, 30_000).exclusions[0].remainingMs, 20_000);
  });

  it('removes an exclusion once it has been served', () => {
    const snapshot = snapshotOf({
      isRunning: true,
      gameTimeMs: 60_000,
      shotTimeMs: 30_000,
      exclusions: [{ id: 'x1', team: 'dark', cap: 4, remaining: 3 }],
    });
    assert.equal(projectSnapshot(snapshot, 2_900).exclusions.length, 1);
    assert.deepEqual(projectSnapshot(snapshot, 3_000).exclusions, []);
  });

  it('counts a team timeout down in real time while the game clock is stopped', () => {
    const snapshot = snapshotOf({ isRunning: false, activeTimeout: { team: 'white', type: '30s', remainingMs: 30_000 } });
    assert.equal(projectSnapshot(snapshot, 12_000).activeTimeout?.remainingMs, 18_000);
    assert.equal(projectSnapshot(snapshot, 30_000).activeTimeout, null);
  });

  it('treats a negative or non-finite elapsed time as zero', () => {
    const snapshot = snapshotOf({ isRunning: true, gameTimeMs: 60_000, shotTimeMs: 25_000 });
    assert.equal(projectSnapshot(snapshot, -5_000).gameTimeMs, 60_000);
    assert.equal(projectSnapshot(snapshot, Number.NaN).gameTimeMs, 60_000);
  });
});

describe('link health thresholds', () => {
  it('classifies silence at each boundary', () => {
    assert.equal(classifyLinkHealth(0), 'live');
    assert.equal(classifyLinkHealth(LAGGING_AFTER_MS - 1), 'live');
    assert.equal(classifyLinkHealth(LAGGING_AFTER_MS), 'lagging');
    assert.equal(classifyLinkHealth(STALE_AFTER_MS - 1), 'lagging');
    assert.equal(classifyLinkHealth(STALE_AFTER_MS), 'stale');
  });

  it('tolerates two missed heartbeats before reporting anything', () => {
    assert.equal(classifyLinkHealth(2 * HEARTBEAT_INTERVAL_MS + 500), 'live');
  });
});

// ---------------------------------------------------------------------------
// Clock offset filter
// ---------------------------------------------------------------------------

describe('one-way clock offset filter', () => {
  it('cancels a constant clock skew of any size and sign', () => {
    for (const skew of [0, 90_000, -300_000, 7_200_000]) {
      const filter = new ClockOffsetFilter();
      for (let i = 0; i < 5; i += 1) {
        const capturedAt = T0 + i * 1_000;
        const receivedAt = capturedAt + skew + 40;
        assert.equal(filter.observe(capturedAt, receivedAt), receivedAt, `skew ${skew}`);
      }
    }
  });

  it('removes delay jitter: a late frame is projected further, not shown late', () => {
    const filter = new ClockOffsetFilter();
    const skew = 90_000;
    filter.observe(T0, T0 + skew + 40);
    const lateAnchor = filter.observe(T0 + 1_000, T0 + 1_000 + skew + 340);
    // The frame arrived 300 ms later than the best case, so it is anchored 300 ms in the past.
    assert.equal(lateAnchor, T0 + 1_000 + skew + 340 - 300);
    assert.equal(filter.latestJitterMs(), 300);
  });

  it('adopts a new, lower minimum immediately', () => {
    const filter = new ClockOffsetFilter();
    filter.observe(T0, T0 + 200);
    assert.equal(filter.observe(T0 + 1_000, T0 + 1_000 + 30), T0 + 1_000 + 30);
    assert.equal(filter.latestJitterMs(), 0);
  });

  it('restarts when a clock is stepped, instead of waiting for the old minimum to expire', () => {
    const filter = new ClockOffsetFilter();
    filter.observe(T0, T0 + 40);
    // The desk clock jumps back five seconds: every later offset is 5 s larger.
    const stepped = T0 + 1_000 - 5_000;
    assert.equal(filter.observe(stepped, T0 + 1_000 + 40), T0 + 1_000 + 40);
    assert.equal(filter.latestJitterMs(), 0);
    assert.equal(filter.observe(stepped + 1_000, T0 + 2_000 + 40), T0 + 2_000 + 40);
  });

  it('keeps jitter just below the step threshold in the window', () => {
    const filter = new ClockOffsetFilter();
    filter.observe(T0, T0 + 40);
    filter.observe(T0 + 1_000, T0 + 1_000 + 40 + OFFSET_STEP_RESET_MS);
    assert.equal(filter.latestJitterMs(), OFFSET_STEP_RESET_MS);
  });

  it('lets an unusually fast sample slide out of the window', () => {
    const filter = new ClockOffsetFilter();
    filter.observe(T0, T0 + 10);
    for (let i = 1; i <= OFFSET_WINDOW_SAMPLES; i += 1) filter.observe(T0 + i * 1_000, T0 + i * 1_000 + 200);
    assert.equal(filter.latestJitterMs(), 0);
  });
});

// ---------------------------------------------------------------------------
// Director-side directory
// ---------------------------------------------------------------------------

describe('court directory — ordering', () => {
  it('starts with four empty courts in order A–D', () => {
    const views = new CourtDirectory().getViews(T0);
    assert.deepEqual(
      views.map((view) => [view.courtId, view.health]),
      [
        ['A', 'empty'],
        ['B', 'empty'],
        ['C', 'empty'],
        ['D', 'empty'],
      ]
    );
  });

  it('adopts the first desk heard and announces it', () => {
    const directory = new CourtDirectory();
    const result = directory.ingest(snapshotFrame({ capturedAtMs: T0, courtId: 'B' }), T0);
    assert.equal(result.outcome, 'accepted');
    assert.deepEqual(
      result.alerts.map((alert) => alert.text),
      ['Court B — desk online (iPad Table 1)']
    );
    const view = directory.getView('B', T0);
    assert.equal(view.health, 'live');
    assert.equal(view.deskLabel, 'iPad Table 1');
    assert.equal(view.snapshot?.scoreWhite, 7);
  });

  it('accepts only strictly newer frames from the same page load', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 5, state: { scoreWhite: 7 } }), T0);
    assert.equal(
      directory.ingest(snapshotFrame({ capturedAtMs: T0 + 100, seq: 6, state: { scoreWhite: 8 } }), T0 + 100).outcome,
      'accepted'
    );
    assert.equal(
      directory.ingest(snapshotFrame({ capturedAtMs: T0 + 100, seq: 6, state: { scoreWhite: 8 } }), T0 + 110).outcome,
      'duplicate'
    );
    assert.equal(
      directory.ingest(snapshotFrame({ capturedAtMs: T0 + 50, seq: 4, state: { scoreWhite: 3 } }), T0 + 120).outcome,
      'reordered'
    );
    assert.equal(directory.getView('A', T0 + 120).snapshot?.scoreWhite, 8);
  });

  it('raises each alert once when the same frame arrives over two transports', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1 }), T0);
    const goal = snapshotFrame({ capturedAtMs: T0 + 400, seq: 2, state: { scoreWhite: 8 } });
    assert.equal(directory.ingest(goal, T0 + 400).alerts.length, 1);
    assert.deepEqual(directory.ingest(goal, T0 + 430), { outcome: 'duplicate', alerts: [] });
  });

  it('accepts a reloaded tablet at once even though its sequence restarts', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, sessionStartedAtMs: 1_000, seq: 900 }), T0);
    const result = directory.ingest(
      snapshotFrame({ capturedAtMs: T0 + 2_000, sessionStartedAtMs: 9_000, seq: 1, state: { scoreDark: 9 } }),
      T0 + 2_000
    );
    assert.equal(result.outcome, 'accepted');
    assert.deepEqual(result.alerts, [], 'a routine reload is not announced');
    assert.equal(directory.getView('A', T0 + 2_000).snapshot?.scoreDark, 9);
  });

  it('keeps courts independent of one another', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, courtId: 'A', deskId: 'DESKAAAA0001' }), T0);
    directory.ingest(snapshotFrame({ capturedAtMs: T0 + 9_000, courtId: 'B', deskId: 'DESKBBBB0002' }), T0 + 9_000);
    const views = directory.getViews(T0 + 9_000);
    assert.equal(views[0].health, 'stale');
    assert.equal(views[1].health, 'live');
    assert.equal(views[2].health, 'empty');
  });

  it('ignores sync requests', () => {
    const directory = new CourtDirectory();
    const result = directory.ingest(
      { v: 1, room: TEST_ROOM, kind: 'sync-request', deskId: 'DIRECTOR0001', sessionStartedAtMs: 1, seq: 1, sentAtMs: T0 },
      T0
    );
    assert.deepEqual(result, { outcome: 'ignored', alerts: [] });
  });
});

describe('court directory — link health and projection', () => {
  const running = { isRunning: true, gameTimeMs: 120_000, shotTimeMs: 30_000 };

  it('projects the clocks while the link is live', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, state: running }), T0);
    const view = directory.getView('A', T0 + 2_500);
    assert.equal(view.health, 'live');
    assert.equal(view.isProjected, true);
    assert.equal(view.projection?.gameTimeMs, 117_500);
    assert.equal(view.projection?.shotTimeMs, 27_500);
  });

  it('keeps projecting, flagged as lagging, between 3 s and 8 s of silence', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, state: running }), T0);
    const view = directory.getView('A', T0 + LAGGING_AFTER_MS);
    assert.equal(view.health, 'lagging');
    assert.equal(view.isProjected, true);
    assert.equal(view.projection?.gameTimeMs, 117_000);
    assert.equal(view.silenceMs, LAGGING_AFTER_MS);
  });

  it('stops animating a dead link and falls back to the last confirmed values', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, state: running }), T0);
    const view = directory.getView('A', T0 + STALE_AFTER_MS);
    assert.equal(view.health, 'stale');
    assert.equal(view.isProjected, false);
    assert.equal(view.projection?.gameTimeMs, 120_000);
    assert.equal(view.projection?.shotTimeMs, 30_000);
  });

  it('projects correctly when the desk clock is an hour behind the director', () => {
    const directory = new CourtDirectory();
    const skew = 3_600_000;
    directory.ingest(snapshotFrame({ capturedAtMs: T0 - skew, state: running }), T0 + 60);
    directory.ingest(snapshotFrame({ capturedAtMs: T0 - skew + 1_000, seq: 2, state: { ...running, gameTimeMs: 119_000, shotTimeMs: 29_000 } }), T0 + 1_060);
    assert.equal(directory.getView('A', T0 + 1_560).projection?.gameTimeMs, 118_500);
  });

  it('reports a lost link exactly once, then its restoration', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1 }), T0);
    assert.deepEqual(directory.sweep(T0 + STALE_AFTER_MS - 1), []);
    const lost = directory.sweep(T0 + STALE_AFTER_MS);
    assert.deepEqual(
      lost.map((alert) => [alert.kind, alert.severity, alert.text]),
      [['link-lost', 'warn', 'Court A — desk link lost (iPad Table 1)']]
    );
    assert.deepEqual(directory.sweep(T0 + STALE_AFTER_MS + 5_000), []);

    const back = directory.ingest(snapshotFrame({ capturedAtMs: T0 + 20_000, seq: 2 }), T0 + 20_000);
    assert.deepEqual(
      back.alerts.map((alert) => alert.kind),
      ['link-restored']
    );
    assert.equal(directory.getView('A', T0 + 20_000).health, 'live');
  });

  it('announces restoration when the outage ends with a page reload', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, sessionStartedAtMs: 1_000 }), T0);
    directory.sweep(T0 + STALE_AFTER_MS);
    const back = directory.ingest(snapshotFrame({ capturedAtMs: T0 + 30_000, sessionStartedAtMs: 8_000 }), T0 + 30_000);
    assert.deepEqual(
      back.alerts.map((alert) => alert.kind),
      ['link-restored']
    );
  });

  it('shows a signed-off desk as last-known immediately, without waiting for a timeout', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1, state: running }), T0);
    const result = directory.ingest(byeFrame({ sentAtMs: T0 + 200, seq: 2 }), T0 + 200);
    assert.deepEqual(
      result.alerts.map((alert) => alert.kind),
      ['desk-signed-off']
    );
    const view = directory.getView('A', T0 + 1_000);
    assert.equal(view.health, 'signed-off');
    assert.equal(view.isProjected, false);
    assert.equal(view.projection?.gameTimeMs, 120_000);
    assert.deepEqual(directory.sweep(T0 + 60_000), [], 'a signed-off desk is not a lost link');
  });

  it('resumes when a signed-off page comes back from the back/forward cache', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1 }), T0);
    directory.ingest(byeFrame({ sentAtMs: T0 + 200, seq: 2 }), T0 + 200);
    directory.ingest(snapshotFrame({ capturedAtMs: T0 + 5_000, seq: 3 }), T0 + 5_000);
    assert.equal(directory.getView('A', T0 + 5_000).health, 'live');
  });

  it('ignores a bye that arrives out of order', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 5 }), T0);
    assert.equal(directory.ingest(byeFrame({ sentAtMs: T0, seq: 4 }), T0 + 10).outcome, 'reordered');
    assert.equal(directory.getView('A', T0 + 10).health, 'live');
  });

  it('lets the director dismiss a tile', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0 }), T0);
    directory.clear('A');
    assert.equal(directory.getView('A', T0).health, 'empty');
  });
});

describe('court directory — two devices claiming one court', () => {
  const rival = { deskId: 'DESKZZZZ0009', deskLabel: 'Spare Phone', sessionStartedAtMs: 4_000 };

  it('keeps showing the first desk and never flickers to the second', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1, state: { scoreWhite: 7 } }), T0);
    const claim = directory.ingest(snapshotFrame({ ...rival, capturedAtMs: T0 + 100, seq: 1, state: { scoreWhite: 0 } }), T0 + 100);
    assert.equal(claim.outcome, 'court-claimed');
    assert.equal(directory.getView('A', T0 + 100).snapshot?.scoreWhite, 7);
    assert.equal(directory.getView('A', T0 + 100).deskLabel, 'iPad Table 1');
  });

  it('does not flag a conflict for a single stray frame', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1 }), T0);
    directory.ingest(snapshotFrame({ ...rival, capturedAtMs: T0 + 100, seq: 1 }), T0 + 100);
    assert.equal(directory.getView('A', T0 + 200).conflict, null);
    assert.deepEqual(directory.sweep(T0 + 200), []);
  });

  it('flags the conflict after a second frame and warns exactly once', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1 }), T0);
    directory.ingest(snapshotFrame({ ...rival, capturedAtMs: T0 + 100, seq: 1 }), T0 + 100);
    directory.ingest(snapshotFrame({ ...rival, capturedAtMs: T0 + 1_100, seq: 2 }), T0 + 1_100);
    assert.deepEqual(directory.getView('A', T0 + 1_200).conflict, { rivalLabels: ['Spare Phone'] });

    const alerts = directory.sweep(T0 + 1_200);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].kind, 'conflict');
    assert.equal(alerts[0].text, 'Court A — 2 devices are publishing this court (iPad Table 1, Spare Phone)');
    assert.deepEqual(directory.sweep(T0 + 1_400), []);
  });

  it('clears the conflict once the second device stops', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1 }), T0);
    directory.ingest(snapshotFrame({ ...rival, capturedAtMs: T0 + 100, seq: 1 }), T0 + 100);
    directory.ingest(snapshotFrame({ ...rival, capturedAtMs: T0 + 1_100, seq: 2 }), T0 + 1_100);
    directory.ingest(snapshotFrame({ capturedAtMs: T0 + 6_000, seq: 2 }), T0 + 6_000);
    assert.equal(directory.getView('A', T0 + 1_100 + CONFLICT_WINDOW_MS).conflict, null);
  });

  it('clears the conflict at once when the second device signs off', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1 }), T0);
    directory.ingest(snapshotFrame({ ...rival, capturedAtMs: T0 + 100, seq: 1 }), T0 + 100);
    directory.ingest(snapshotFrame({ ...rival, capturedAtMs: T0 + 1_100, seq: 2 }), T0 + 1_100);
    directory.ingest(byeFrame({ ...rival, sentAtMs: T0 + 1_200, seq: 3 }), T0 + 1_200);
    assert.equal(directory.getView('A', T0 + 1_300).conflict, null);
  });

  it('hands the court over once the first desk has gone stale', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1, state: { scoreWhite: 7 } }), T0);
    const takeover = directory.ingest(
      snapshotFrame({ ...rival, capturedAtMs: T0 + STALE_AFTER_MS, seq: 1, state: { scoreWhite: 2 } }),
      T0 + STALE_AFTER_MS
    );
    assert.equal(takeover.outcome, 'accepted');
    assert.deepEqual(
      takeover.alerts.map((alert) => alert.text),
      ['Court A — desk online (Spare Phone)']
    );
    assert.equal(directory.getView('A', T0 + STALE_AFTER_MS).snapshot?.scoreWhite, 2);
  });

  it('hands the court over immediately after the first desk signs off', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1 }), T0);
    directory.ingest(byeFrame({ sentAtMs: T0 + 100, seq: 2 }), T0 + 100);
    const takeover = directory.ingest(snapshotFrame({ ...rival, capturedAtMs: T0 + 200, seq: 1 }), T0 + 200);
    assert.equal(takeover.outcome, 'accepted');
    assert.equal(directory.getView('A', T0 + 200).deskLabel, 'Spare Phone');
  });

  it('flags a second tab of the same tablet that is still publishing', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, sessionStartedAtMs: 9_000, seq: 1 }), T0);
    // An older page load of the same device keeps transmitting.
    const stale = { sessionStartedAtMs: 1_000, deskLabel: 'iPad Table 1 (old tab)' };
    assert.equal(directory.ingest(snapshotFrame({ ...stale, capturedAtMs: T0 + 100, seq: 50 }), T0 + 100).outcome, 'court-claimed');
    directory.ingest(snapshotFrame({ ...stale, capturedAtMs: T0 + 1_100, seq: 51 }), T0 + 1_100);
    assert.deepEqual(directory.getView('A', T0 + 1_200).conflict, { rivalLabels: ['iPad Table 1 (old tab)'] });
  });
});

describe('court directory — alerts and play-by-play', () => {
  const event = (id: string, iso: string) => ({
    id,
    timestampIso: iso,
    period: 3,
    gameClock: '05:42.3',
    type: 'GOAL',
    description: `event ${id}`,
  });

  it('announces a goal for either team with the new score', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1 }), T0);
    const white = directory.ingest(snapshotFrame({ capturedAtMs: T0 + 1, seq: 2, state: { scoreWhite: 8 } }), T0 + 1);
    assert.equal(white.alerts[0].text, 'Court A — GOAL VANGUARD — VANGUARD 8–6 STANFORD');
    const dark = directory.ingest(snapshotFrame({ capturedAtMs: T0 + 2, seq: 3, state: { scoreWhite: 8, scoreDark: 7 } }), T0 + 2);
    assert.equal(dark.alerts[0].text, 'Court A — GOAL STANFORD — VANGUARD 8–7 STANFORD');
  });

  it('does not mistake a roster import or a score correction for a goal', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1 }), T0);
    const imported = directory.ingest(snapshotFrame({ capturedAtMs: T0 + 1, seq: 2, state: { scoreWhite: 11, scoreDark: 9 } }), T0 + 1);
    assert.deepEqual(imported.alerts, []);
    const corrected = directory.ingest(snapshotFrame({ capturedAtMs: T0 + 2, seq: 3, state: { scoreWhite: 10, scoreDark: 9 } }), T0 + 2);
    assert.deepEqual(corrected.alerts, []);
    const swapped = directory.ingest(snapshotFrame({ capturedAtMs: T0 + 3, seq: 4, state: { scoreWhite: 11, scoreDark: 8 } }), T0 + 3);
    assert.deepEqual(swapped.alerts, [], 'one team up and the other down is a correction');
  });

  it('announces the end of a period when the game clock hits 0.0', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1, state: { isRunning: true, gameTimeMs: 400 } }), T0);
    const ended = directory.ingest(snapshotFrame({ capturedAtMs: T0 + 400, seq: 2, state: { isRunning: false, gameTimeMs: 0 } }), T0 + 400);
    assert.deepEqual(
      ended.alerts.map((alert) => alert.text),
      ['Court A — END OF Q3 — VANGUARD 7–6 STANFORD']
    );
  });

  it('announces a team timeout once, when it starts', () => {
    const directory = new CourtDirectory();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1 }), T0);
    const timeout = { team: 'dark' as const, type: '60s' as const, remainingMs: 60_000 };
    const started = directory.ingest(snapshotFrame({ capturedAtMs: T0 + 1, seq: 2, state: { activeTimeout: timeout } }), T0 + 1);
    assert.deepEqual(
      started.alerts.map((alert) => alert.text),
      ['Court A — 60s TIMEOUT — STANFORD']
    );
    const ticking = directory.ingest(
      snapshotFrame({ capturedAtMs: T0 + 1_001, seq: 3, state: { activeTimeout: { ...timeout, remainingMs: 59_000 } } }),
      T0 + 1_001
    );
    assert.deepEqual(ticking.alerts, []);
  });

  it('gives every alert a unique id', () => {
    const directory = new CourtDirectory();
    const ids = new Set<string>();
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1 }), T0).alerts.forEach((alert) => ids.add(alert.id));
    for (let i = 0; i < 10; i += 1) {
      directory
        .ingest(snapshotFrame({ capturedAtMs: T0 + i + 1, seq: i + 2, state: { scoreWhite: 8 + i } }), T0 + i + 1)
        .alerts.forEach((alert) => ids.add(alert.id));
    }
    assert.equal(ids.size, 11);
  });

  it('merges the play-by-play across snapshots without duplicates, newest first', () => {
    const directory = new CourtDirectory();
    const e1 = event('e1', '2026-11-10T18:00:01.000Z');
    const e2 = event('e2', '2026-11-10T18:00:02.000Z');
    const e3 = event('e3', '2026-11-10T18:00:03.000Z');
    directory.ingest(snapshotFrame({ capturedAtMs: T0, seq: 1, state: { events: [e2, e1] } }), T0);
    directory.ingest(snapshotFrame({ capturedAtMs: T0 + 1, seq: 2, state: { events: [e3, e2, e1] } }), T0 + 1);
    assert.deepEqual(
      directory.getView('A', T0 + 1).events.map((entry) => entry.id),
      ['e3', 'e2', 'e1']
    );
  });

  it('caps the rolling feed', () => {
    const directory = new CourtDirectory();
    for (let i = 0; i < MAX_FEED_EVENTS + 15; i += 1) {
      const iso = new Date(T0 + i * 1_000).toISOString();
      directory.ingest(snapshotFrame({ capturedAtMs: T0 + i, seq: i + 1, state: { events: [event(`e${i}`, iso)] } }), T0 + i);
    }
    const feed = directory.getView('A', T0 + 100).events;
    assert.equal(feed.length, MAX_FEED_EVENTS);
    assert.equal(feed[0].id, `e${MAX_FEED_EVENTS + 14}`);
  });
});

// ---------------------------------------------------------------------------
// Desk-side publisher
// ---------------------------------------------------------------------------

interface PublisherRig {
  clock: FakeClock;
  frames: CourtFrame[];
  publisher: CourtPublisher;
}

function publisherRig(): PublisherRig {
  const clock = new FakeClock(T0);
  const frames: CourtFrame[] = [];
  let seq = 0;
  const publisher = new CourtPublisher({
    room: TEST_ROOM,
    courtId: 'A',
    deskId: 'DESKAAAA0001',
    deskLabel: 'iPad Table 1',
    sessionStartedAtMs: T0 - 5_000,
    now: clock.now,
    nextSeq: () => {
      seq += 1;
      return seq;
    },
    send: (frame) => frames.push(frame),
  });
  return { clock, frames, publisher };
}

/** Runs the console's 100 ms tick loop for `ticks` ticks, like App.tsx does. */
function runConsole(rig: PublisherRig, state: DeskStateInput, ticks: number, wallMsPerTick = 100): DeskStateInput {
  let current = state;
  for (let i = 0; i < ticks; i += 1) {
    rig.clock.advance(wallMsPerTick);
    if (current.isRunning) {
      current = {
        ...current,
        gameTimeMs: Math.max(0, current.gameTimeMs - 100),
        shotTimeMs: Math.max(0, current.shotTimeMs - 100),
      };
    }
    rig.publisher.update(current);
    rig.publisher.tick();
  }
  return current;
}

describe('desk publisher — send policy', () => {
  it('sends the first state immediately', () => {
    const rig = publisherRig();
    rig.publisher.update(deskState());
    assert.equal(rig.frames.length, 1);
    assert.equal(rig.frames[0].kind, 'snapshot');
    assert.equal(rig.frames[0].seq, 1);
  });

  it('sends only 1 Hz heartbeats while a running clock ticks as predicted', () => {
    const rig = publisherRig();
    const state = deskState({ isRunning: true, gameTimeMs: 300_000, shotTimeMs: 30_000 });
    rig.publisher.update(state);
    runConsole(rig, state, 50);
    // t = 0 plus one heartbeat per second for five seconds — not fifty frames.
    assert.equal(rig.frames.length, 6);
    assert.deepEqual(
      rig.frames.map((frame) => frame.sentAtMs - T0),
      [0, 1_000, 2_000, 3_000, 4_000, 5_000]
    );
  });

  it('sends a whistle (clock stop) at once', () => {
    const rig = publisherRig();
    let state = deskState({ isRunning: true, gameTimeMs: 300_000, shotTimeMs: 30_000 });
    rig.publisher.update(state);
    state = runConsole(rig, state, 4);
    const before = rig.frames.length;
    rig.publisher.update({ ...state, isRunning: false });
    assert.equal(rig.frames.length, before + 1);
    const last = rig.frames[rig.frames.length - 1];
    assert.equal(last.kind === 'snapshot' && last.snapshot.isRunning, false);
  });

  const immediateChanges: Array<[string, Partial<DeskStateInput>]> = [
    ['a 30 s shot-clock reset', { shotTimeMs: 30_000 }],
    ['a 20 s shot-clock reset', { shotTimeMs: 20_000 }],
    ['a goal', { scoreWhite: 8 }],
    ['a period change', { period: 4, gameTimeMs: 480_000 }],
    ['a manual +1 s game-clock edit', { gameTimeMs: 343_300 }],
    ['a new exclusion', { exclusions: [{ id: 'x1', team: 'dark', cap: 4, remaining: 20 }] }],
    ['the horn', { isHornActive: true }],
    ['a team rename', { teamDarkName: 'CAL' }],
    ['a timeout', { activeTimeout: { team: 'white', type: '60s', remainingMs: 60_000 } }],
    ['a lost Bluetooth dongle', { bleStatus: 'reconnecting' }],
    ['a scoreboard protocol switch', { protocol: 'daktronics' }],
  ];
  for (const [label, change] of immediateChanges) {
    it(`sends ${label} without waiting for the heartbeat`, () => {
      const rig = publisherRig();
      rig.publisher.update(deskState());
      rig.clock.advance(250);
      rig.publisher.update(deskState(change));
      assert.equal(rig.frames.length, 2, label);
    });
  }

  it('releasing exclusions on a goal (WP 21) is transmitted at once', () => {
    const rig = publisherRig();
    const excluded = deskState({ exclusions: [{ id: 'x1', team: 'dark', cap: 4, remaining: 14 }] });
    rig.publisher.update(excluded);
    rig.clock.advance(300);
    rig.publisher.update(deskState({ scoreWhite: 8, shotTimeMs: 30_000, exclusions: [] }));
    assert.equal(rig.frames.length, 2);
    const last = rig.frames[1];
    assert.deepEqual(last.kind === 'snapshot' ? last.snapshot.exclusions : null, []);
  });

  it('never exceeds ten frames a second, and still delivers the final state', () => {
    const rig = publisherRig();
    rig.publisher.update(deskState({ scoreWhite: 1 }));
    for (let score = 2; score <= 6; score += 1) {
      rig.clock.advance(10);
      rig.publisher.update(deskState({ scoreWhite: score }));
    }
    assert.equal(rig.frames.length, 1, 'changes inside the 100 ms window are coalesced');
    rig.clock.advance(60);
    rig.publisher.tick();
    assert.equal(rig.frames.length, 2);
    const last = rig.frames[1];
    assert.equal(last.kind === 'snapshot' && last.snapshot.scoreWhite, 6);
  });

  it('tolerates ordinary timer drift without extra frames', () => {
    const rig = publisherRig();
    const state = deskState({ isRunning: true, gameTimeMs: 300_000, shotTimeMs: 30_000 });
    rig.publisher.update(state);
    // The console loses 4 ms per tick: 40 ms a second, inside the tolerance.
    runConsole(rig, state, 48, 104);
    const elapsedMs = 48 * 104;
    assert.equal(rig.frames.length, 1 + Math.floor(elapsedMs / HEARTBEAT_INTERVAL_MS));
  });

  it('follows the console when a throttled tab makes its clock run slow', () => {
    const rig = publisherRig();
    const state = deskState({ isRunning: true, gameTimeMs: 300_000, shotTimeMs: 30_000 });
    rig.publisher.update(state);
    // A background tab: one 100 ms tick per second of wall time.
    runConsole(rig, state, 5, 1_000);
    const last = rig.frames[rig.frames.length - 1];
    assert.equal(last.kind === 'snapshot' && last.snapshot.gameTimeMs, 299_500);
    assert.equal(rig.frames.length, 6);
  });

  it('re-stamps a static heartbeat so it carries a fresh capture time', () => {
    const rig = publisherRig();
    rig.publisher.update(deskState({ isRunning: false }));
    rig.clock.advance(HEARTBEAT_INTERVAL_MS);
    rig.publisher.tick();
    const heartbeat = rig.frames[1];
    assert.equal(heartbeat.kind === 'snapshot' && heartbeat.snapshot.capturedAtMs, T0 + HEARTBEAT_INTERVAL_MS);
  });

  it('keeps the true capture time on a running heartbeat', () => {
    const rig = publisherRig();
    const state = deskState({ isRunning: true, gameTimeMs: 300_000, shotTimeMs: 30_000 });
    rig.publisher.update(state);
    rig.clock.advance(960);
    rig.publisher.update({ ...state, gameTimeMs: 299_000, shotTimeMs: 29_000 });
    rig.clock.advance(40);
    rig.publisher.tick();
    const heartbeat = rig.frames[rig.frames.length - 1];
    assert.equal(heartbeat.kind === 'snapshot' && heartbeat.snapshot.capturedAtMs, T0 + 960);
  });

  it('answers a sync request with an immediate snapshot', () => {
    const rig = publisherRig();
    rig.publisher.update(deskState());
    rig.clock.advance(400);
    rig.publisher.flush();
    assert.equal(rig.frames.length, 2);
  });

  it('numbers frames strictly upwards and signs off after a final snapshot', () => {
    const rig = publisherRig();
    rig.publisher.update(deskState());
    rig.clock.advance(20);
    rig.publisher.update(deskState({ scoreWhite: 8 }));
    rig.publisher.bye();
    assert.deepEqual(
      rig.frames.map((frame) => [frame.kind, frame.seq]),
      [
        ['snapshot', 1],
        ['snapshot', 2],
        ['bye', 3],
      ]
    );
    const final = rig.frames[1];
    assert.equal(final.kind === 'snapshot' && final.snapshot.scoreWhite, 8);
  });

  it('sends nothing, and does not throw, for a malformed console state', () => {
    const rig = publisherRig();
    assert.doesNotThrow(() => rig.publisher.update(deskState({ gameTimeMs: Number.NaN })));
    rig.publisher.tick();
    assert.equal(rig.frames.length, 0);
  });

  it('every frame it produces is accepted by the director parser', () => {
    const rig = publisherRig();
    const state = deskState({ isRunning: true, gameTimeMs: 300_000, shotTimeMs: 30_000 });
    rig.publisher.update(state);
    runConsole(rig, state, 30);
    rig.publisher.bye();
    for (const frame of rig.frames) {
      assert.equal(parseCourtFrame(encodeCourtFrame(frame), TEST_ROOM).ok, true);
    }
  });
});

describe('desk to director, end to end over a jittery link with skewed clocks', () => {
  it('converges within 300 ms of every change and then tracks the console to 250 ms', () => {
    const rig = publisherRig();
    const directory = new CourtDirectory();
    const random = createSeededRandom(20261110);
    // The director's wall clock runs 93 s behind the desk's.
    const skewMs = -93_000;
    const inFlight: Array<{ arrivesAtMs: number; frame: CourtFrame }> = [];
    let delivered = 0;

    // A scripted minute: whistle, restart, two resets and a goal.
    const script = new Map<number, (state: DeskStateInput) => DeskStateInput>([
      [80, (state) => ({ ...state, isRunning: false })],
      [120, (state) => ({ ...state, isRunning: true, shotTimeMs: 30_000 })],
      [250, (state) => ({ ...state, shotTimeMs: 20_000 })],
      [330, (state) => ({ ...state, isRunning: false, scoreWhite: state.scoreWhite + 1, shotTimeMs: 30_000 })],
      [380, (state) => ({ ...state, isRunning: true })],
      [520, (state) => ({ ...state, shotTimeMs: 30_000 })],
    ]);

    let state = deskState({ isRunning: true, gameTimeMs: 300_000, shotTimeMs: 30_000 });
    rig.publisher.update(state);
    let worstErrorMs = 0;
    let lastChangeTick = 0;
    let samples = 0;

    for (let tick = 1; tick <= 600; tick += 1) {
      rig.clock.advance(100);
      if (state.isRunning) {
        state = { ...state, gameTimeMs: state.gameTimeMs - 100, shotTimeMs: Math.max(0, state.shotTimeMs - 100) };
      }
      const change = script.get(tick);
      if (change) {
        state = change(state);
        lastChangeTick = tick;
      }
      rig.publisher.update(state);
      rig.publisher.tick();

      // Each new frame crosses the network with 20–119 ms of delay.
      while (delivered < rig.frames.length) {
        inFlight.push({ arrivesAtMs: rig.clock.nowMs + 20 + Math.floor(random() * 100), frame: rig.frames[delivered] });
        delivered += 1;
      }
      inFlight.sort((a, b) => a.arrivesAtMs - b.arrivesAtMs);
      while (inFlight.length > 0 && inFlight[0].arrivesAtMs <= rig.clock.nowMs) {
        const arrival = inFlight.shift() as { arrivesAtMs: number; frame: CourtFrame };
        const parsed = parseCourtFrame(encodeCourtFrame(arrival.frame), TEST_ROOM);
        assert.equal(parsed.ok, true);
        if (parsed.ok) assert.equal(directory.ingest(parsed.frame, arrival.arrivesAtMs + skewMs).outcome, 'accepted');
      }

      // A change needs one rate-limit window plus one network delay to arrive.
      if (tick - lastChangeTick < 3) continue;
      const view = directory.getView('A', rig.clock.nowMs + skewMs);
      assert.ok(view.projection, 'the director must have the court by now');
      assert.equal(view.health, 'live');
      samples += 1;
      worstErrorMs = Math.max(
        worstErrorMs,
        Math.abs(view.projection.gameTimeMs - state.gameTimeMs),
        Math.abs(view.projection.shotTimeMs - state.shotTimeMs)
      );
    }

    assert.ok(samples > 570, `expected to sample almost every tick, sampled ${samples}`);
    assert.ok(rig.frames.length < 90, `expected roughly one frame a second, sent ${rig.frames.length}`);
    assert.ok(worstErrorMs <= CLOCK_TOLERANCE_MS + 100, `worst clock error was ${worstErrorMs} ms`);
    assert.equal(directory.getView('A', rig.clock.nowMs + skewMs).snapshot?.scoreWhite, 8);
  });
});

describe('prediction check used by the publisher', () => {
  it('accepts a running clock that advanced by exactly the elapsed time', () => {
    const sent = snapshotOf({ isRunning: true, gameTimeMs: 60_000, shotTimeMs: 20_000 }, T0);
    const now = snapshotOf({ isRunning: true, gameTimeMs: 59_000, shotTimeMs: 19_000 }, T0 + 1_000);
    assert.equal(isPredictedBy(sent, now), true);
  });

  it('accepts an error at the tolerance and rejects one just beyond it', () => {
    const sent = snapshotOf({ isRunning: true, gameTimeMs: 60_000, shotTimeMs: 20_000 }, T0);
    const atLimit = snapshotOf({ isRunning: true, gameTimeMs: 59_000 + CLOCK_TOLERANCE_MS, shotTimeMs: 19_000 }, T0 + 1_000);
    const beyond = snapshotOf({ isRunning: true, gameTimeMs: 59_000 + CLOCK_TOLERANCE_MS + 1, shotTimeMs: 19_000 }, T0 + 1_000);
    assert.equal(isPredictedBy(sent, atLimit), true);
    assert.equal(isPredictedBy(sent, beyond), false);
  });

  it('predicts an exclusion and a timeout counting down', () => {
    const sent = snapshotOf(
      {
        isRunning: true,
        gameTimeMs: 60_000,
        shotTimeMs: 20_000,
        exclusions: [{ id: 'x1', team: 'dark', cap: 4, remaining: 20 }],
      },
      T0
    );
    const later = snapshotOf(
      {
        isRunning: true,
        gameTimeMs: 58_000,
        shotTimeMs: 18_000,
        exclusions: [{ id: 'x1', team: 'dark', cap: 4, remaining: 18 }],
      },
      T0 + 2_000
    );
    assert.equal(isPredictedBy(sent, later), true);

    const timeoutSent = snapshotOf({ activeTimeout: { team: 'white', type: '60s', remainingMs: 60_000 } }, T0);
    const timeoutLater = snapshotOf({ activeTimeout: { team: 'white', type: '60s', remainingMs: 57_000 } }, T0 + 3_000);
    assert.equal(isPredictedBy(timeoutSent, timeoutLater), true);
    const timeoutJumped = snapshotOf({ activeTimeout: { team: 'white', type: '60s', remainingMs: 30_000 } }, T0 + 3_000);
    assert.equal(isPredictedBy(timeoutSent, timeoutJumped), false);
  });
});
