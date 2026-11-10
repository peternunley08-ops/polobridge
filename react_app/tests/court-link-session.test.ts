/**
 * Court Link session — a desk and a director wired together in memory.
 * These tests drive the same object the UI uses, under a manual clock.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CourtAlert,
  DEFAULT_LOCAL_ROOM,
  HEARTBEAT_INTERVAL_MS,
  STALE_AFTER_MS,
  encodeCourtFrame,
} from '../src/engine/court-link';
import {
  COURT_LINK_TAB_STORAGE_KEY,
  CourtLinkSession,
  DEMO_ROOM,
  SESSION_TICK_MS,
} from '../src/engine/court-link-session';
import { COURT_LINK_STORAGE_KEY, courtChannelName } from '../src/engine/court-link-transports';
import {
  FakeChannelHub,
  FakeClock,
  FakeLockManager,
  FakeSocketFactory,
  MemoryStorage,
  deskState,
  flushMicrotasks,
  sessionDeps,
  snapshotFrame,
} from './helpers';

interface Pair {
  clock: FakeClock;
  hub: FakeChannelHub;
  desk: CourtLinkSession;
  director: CourtLinkSession;
}

/** Two tabs of one browser: a desk and a director, sharing BroadcastChannel. */
function pair(): Pair {
  const clock = new FakeClock();
  const hub = new FakeChannelHub();
  const desk = new CourtLinkSession(sessionDeps({ clock, hub, idSeed: 1 }));
  const director = new CourtLinkSession(sessionDeps({ clock, hub, idSeed: 101 }));
  return { clock, hub, desk, director };
}

describe('session — nothing runs until it is needed', () => {
  it('opens no channel, socket or timer for a plain single desk', () => {
    const clock = new FakeClock();
    const hub = new FakeChannelHub();
    const sockets = new FakeSocketFactory();
    const session = new CourtLinkSession(sessionDeps({ clock, hub, sockets }));
    session.publishDeskState(deskState());
    clock.advance(10_000);

    assert.deepEqual(hub.openChannelNames(), []);
    assert.equal(sockets.sockets.length, 0);
    assert.equal(clock.pendingTimers(), 0);
    assert.equal(hub.posted.length, 0);
    const status = session.getStatus();
    assert.equal(status.deskSlot, 'off');
    assert.equal(status.isLinkActive, false);
    assert.equal(status.config.room, DEFAULT_LOCAL_ROOM);
  });

  it('starts when a dashboard opens and stops again when it closes', () => {
    const clock = new FakeClock();
    const hub = new FakeChannelHub();
    const session = new CourtLinkSession(sessionDeps({ clock, hub }));
    const release = session.watch();
    assert.deepEqual(hub.openChannelNames(), [courtChannelName(DEFAULT_LOCAL_ROOM)]);
    assert.equal(session.getStatus().isLinkActive, true);
    assert.equal(session.getStatus().localStatus, 'open');

    release();
    release();
    assert.deepEqual(hub.openChannelNames(), []);
    clock.advance(SESSION_TICK_MS * 2);
    assert.equal(clock.pendingTimers(), 0);
    assert.equal(session.getStatus().isLinkActive, false);
  });

  it('keeps the link up while two dashboards are open and one closes', () => {
    const clock = new FakeClock();
    const hub = new FakeChannelHub();
    const session = new CourtLinkSession(sessionDeps({ clock, hub }));
    const releaseFirst = session.watch();
    const releaseSecond = session.watch();
    releaseFirst();
    assert.equal(session.getStatus().isLinkActive, true);
    releaseSecond();
    assert.equal(session.getStatus().isLinkActive, false);
  });
});

describe('session — a desk reaches a director', () => {
  it('shows the desk on the director screen with live, projected clocks', () => {
    const { clock, desk, director } = pair();
    director.watch();
    assert.deepEqual(desk.updateConfig({ deskCourtId: 'B', deskLabel: 'iPad Table 2' }), { ok: true });
    desk.publishDeskState(deskState({ isRunning: true, gameTimeMs: 120_000, shotTimeMs: 30_000 }));

    const immediate = director.getCourtViews()[1];
    assert.equal(immediate.courtId, 'B');
    assert.equal(immediate.health, 'live');
    assert.equal(immediate.deskLabel, 'iPad Table 2');
    assert.equal(immediate.projection?.gameTimeMs, 120_000);

    // No new frame for 700 ms: the director advances the clocks by itself.
    clock.advance(700);
    const later = director.getCourtViews()[1];
    assert.equal(later.projection?.gameTimeMs, 119_300);
    assert.equal(later.projection?.shotTimeMs, 29_300);
    assert.equal(desk.getStatus().deskSlot, 'publishing');
  });

  it('catches up a director who opens the dashboard after the match started', () => {
    const { clock, desk, director } = pair();
    desk.updateConfig({ deskCourtId: 'A' });
    desk.publishDeskState(deskState({ scoreWhite: 9 }));
    clock.advance(400);
    assert.equal(director.getCourtViews()[0].health, 'empty', 'nobody was listening yet');

    director.watch();
    assert.equal(director.getCourtViews()[0].snapshot?.scoreWhite, 9, 'the sync request was answered at once');
  });

  it('shows a desk its own court on its own dashboard', () => {
    const { desk } = pair();
    desk.updateConfig({ deskCourtId: 'D' });
    desk.publishDeskState(deskState({ scoreDark: 4 }));
    desk.watch();
    const own = desk.getCourtViews()[3];
    assert.equal(own.health, 'live');
    assert.equal(own.snapshot?.scoreDark, 4);
  });

  it('keeps a stopped desk live through its heartbeat', () => {
    const { clock, desk, director } = pair();
    director.watch();
    desk.updateConfig({ deskCourtId: 'A' });
    desk.publishDeskState(deskState());
    clock.advance(STALE_AFTER_MS * 3);
    const view = director.getCourtViews()[0];
    assert.equal(view.health, 'live');
    assert.ok(view.silenceMs <= HEARTBEAT_INTERVAL_MS + SESSION_TICK_MS);
    assert.ok(view.framesAccepted >= 20);
  });

  it('reports a goal to alert listeners and keeps it in the recent list', () => {
    const { clock, desk, director } = pair();
    const heard: CourtAlert[] = [];
    director.onAlert((alert) => heard.push(alert));
    director.watch();
    desk.updateConfig({ deskCourtId: 'C' });
    desk.publishDeskState(deskState({ scoreWhite: 7 }));
    clock.advance(500);
    desk.publishDeskState(deskState({ scoreWhite: 8, shotTimeMs: 30_000 }));

    assert.deepEqual(
      heard.map((alert) => alert.kind),
      ['desk-joined', 'goal']
    );
    assert.equal(director.getRecentAlerts()[0].kind, 'goal', 'newest first');
  });

  it('marks the court as lost when the desk tab is suspended, then restores it', () => {
    const clock = new FakeClock();
    const hub = new FakeChannelHub();
    const director = new CourtLinkSession(sessionDeps({ clock, hub, idSeed: 101 }));
    const heard: string[] = [];
    director.onAlert((alert) => heard.push(alert.kind));
    director.watch();

    // A desk whose timers stop (a backgrounded iPad): frames just cease.
    const channel = courtChannelName(DEFAULT_LOCAL_ROOM);
    hub.inject(channel, encodeCourtFrame(snapshotFrame({ room: DEFAULT_LOCAL_ROOM, capturedAtMs: clock.nowMs, seq: 1 })));
    clock.advance(STALE_AFTER_MS + SESSION_TICK_MS);
    assert.equal(director.getCourtViews()[0].health, 'stale');

    hub.inject(channel, encodeCourtFrame(snapshotFrame({ room: DEFAULT_LOCAL_ROOM, capturedAtMs: clock.nowMs, seq: 2 })));
    assert.equal(director.getCourtViews()[0].health, 'live');
    assert.deepEqual(heard, ['desk-joined', 'link-lost', 'link-restored']);
  });

  it('tells the director at once when the desk page closes', () => {
    const { clock, desk, director } = pair();
    director.watch();
    desk.updateConfig({ deskCourtId: 'A' });
    desk.publishDeskState(deskState({ scoreWhite: 12 }));
    clock.advance(300);
    desk.handlePageHide();
    const view = director.getCourtViews()[0];
    assert.equal(view.health, 'signed-off');
    assert.equal(view.snapshot?.scoreWhite, 12);
  });

  it('counts and drops garbage arriving on the channel', () => {
    const { hub, director } = pair();
    director.watch();
    const channel = courtChannelName(DEFAULT_LOCAL_ROOM);
    hub.inject(channel, '{not json');
    hub.inject(channel, encodeCourtFrame(snapshotFrame({ room: 'OTHER-ROOM', capturedAtMs: 1 })));
    const diagnostics = director.getDiagnostics();
    assert.equal(diagnostics.framesRejected, 2);
    assert.equal(diagnostics.lastRejectReason, 'wrong-room');
    assert.deepEqual(
      director.getCourtViews().map((view) => view.health),
      ['empty', 'empty', 'empty', 'empty']
    );
  });
});

describe('session — configuration', () => {
  it('validates every field and explains what is wrong', () => {
    const session = new CourtLinkSession(sessionDeps({ clock: new FakeClock(), hub: new FakeChannelHub() }));
    const room = session.updateConfig({ room: '!!' });
    assert.equal(room.ok, false);
    const relay = session.updateConfig({ relayUrl: 'ws://192.168.1.4:8787' });
    assert.equal(relay.ok === false && /wss:\/\//.test(relay.error), true);
    const court = session.updateConfig({ deskCourtId: 'Q' as unknown as 'A' });
    assert.equal(court.ok, false);
    assert.equal(session.getStatus().config.room, DEFAULT_LOCAL_ROOM, 'a rejected change leaves the config alone');
  });

  it('persists the configuration for the next page load', () => {
    const clock = new FakeClock();
    const storage = new MemoryStorage();
    const tabStorage = new MemoryStorage();
    const first = new CourtLinkSession(sessionDeps({ clock, hub: new FakeChannelHub(), storage, tabStorage }));
    first.updateConfig({ room: 'k7qm 4f9x', deskCourtId: 'C', deskLabel: 'iPad Table 3' });
    const reloaded = new CourtLinkSession(sessionDeps({ clock, hub: new FakeChannelHub(), storage, tabStorage }));
    assert.deepEqual(reloaded.getStatus().config, {
      room: 'K7QM-4F9X',
      deskCourtId: 'C',
      deskLabel: 'iPad Table 3',
      relayUrl: '',
    });
    assert.equal(reloaded.getStatus().deskId, first.getStatus().deskId);
  });

  it('keeps a stable status reference until something changes', () => {
    const session = new CourtLinkSession(sessionDeps({ clock: new FakeClock(), hub: new FakeChannelHub() }));
    let notifications = 0;
    session.subscribe(() => {
      notifications += 1;
    });
    const before = session.getStatus();
    assert.equal(session.getStatus(), before);
    assert.deepEqual(session.updateConfig({ deskLabel: before.config.deskLabel }), { ok: true });
    assert.equal(session.getStatus(), before, 'a no-op update does not churn the UI');
    assert.equal(notifications, 0);
    session.updateConfig({ deskLabel: 'Renamed' });
    assert.notEqual(session.getStatus(), before);
    assert.equal(notifications, 1);
  });

  it('isolates rooms: a director in another room sees nothing', () => {
    const { desk, director } = pair();
    director.updateConfig({ room: 'ROOM-TWO' });
    director.watch();
    desk.updateConfig({ deskCourtId: 'A' });
    desk.publishDeskState(deskState());
    assert.equal(director.getCourtViews()[0].health, 'empty');
  });

  it('forgets the old room when the director switches rooms', () => {
    const { desk, director } = pair();
    director.watch();
    desk.updateConfig({ deskCourtId: 'A' });
    desk.publishDeskState(deskState());
    assert.equal(director.getCourtViews()[0].health, 'live');
    director.updateConfig({ room: 'ROOM-TWO' });
    assert.equal(director.getCourtViews()[0].health, 'empty');
  });

  it('signs off the old court when a desk moves to another court', () => {
    const { clock, desk, director } = pair();
    director.watch();
    desk.updateConfig({ deskCourtId: 'A' });
    desk.publishDeskState(deskState());
    clock.advance(300);
    desk.updateConfig({ deskCourtId: 'B' });

    const views = director.getCourtViews();
    assert.equal(views[0].health, 'signed-off');
    assert.equal(views[1].health, 'live');
  });

  it('stops publishing when the court is switched off', () => {
    const { clock, hub, desk, director } = pair();
    director.watch();
    desk.updateConfig({ deskCourtId: 'A' });
    desk.publishDeskState(deskState());
    clock.advance(300);
    desk.updateConfig({ deskCourtId: null });
    assert.equal(desk.getStatus().deskSlot, 'off');
    assert.equal(director.getCourtViews()[0].health, 'signed-off');

    const sentBefore = hub.posted.length;
    desk.publishDeskState(deskState({ scoreWhite: 20 }));
    clock.advance(5_000);
    assert.equal(
      hub.posted.slice(sentBefore).filter((entry) => String(entry.message).includes('"snapshot"')).length,
      0
    );
  });

  it('creates an unguessable room, or refuses without a secure random source', () => {
    const secure = new CourtLinkSession(sessionDeps({ clock: new FakeClock(), hub: new FakeChannelHub() }));
    assert.deepEqual(secure.createRoom(), { ok: true });
    assert.match(secure.getStatus().config.room, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);

    const weak = new CourtLinkSession(
      sessionDeps({ clock: new FakeClock(), hub: new FakeChannelHub(), hasSecureRandom: false })
    );
    assert.equal(weak.createRoom().ok, false);
    assert.equal(weak.getStatus().config.room, DEFAULT_LOCAL_ROOM);
  });
});

describe('session — invite links', () => {
  it('configures a volunteer desk from a link and shows a notice', () => {
    const session = new CourtLinkSession(sessionDeps({ clock: new FakeClock(), hub: new FakeChannelHub() }));
    const invite = { room: 'K7QM-4F9X', courtId: 'B' as const, relayUrl: 'wss://relay.example.com' };
    assert.deepEqual(session.applyInvite(invite), { ok: true });
    const status = session.getStatus();
    assert.equal(status.config.room, 'K7QM-4F9X');
    assert.equal(status.config.deskCourtId, 'B');
    assert.equal(status.config.relayUrl, 'wss://relay.example.com');
    assert.deepEqual(status.appliedInvite, invite);
    session.dismissInviteNotice();
    assert.equal(session.getStatus().appliedInvite, null);
  });

  it('does not stop a scoring desk when it opens a dashboard-only invite', () => {
    const session = new CourtLinkSession(sessionDeps({ clock: new FakeClock(), hub: new FakeChannelHub() }));
    session.updateConfig({ deskCourtId: 'C' });
    session.applyInvite({ room: 'K7QM-4F9X', courtId: null, relayUrl: '' });
    assert.equal(session.getStatus().config.deskCourtId, 'C');
    assert.equal(session.getStatus().config.room, 'K7QM-4F9X');
  });

  it('builds a link another device can open for a given court', () => {
    const session = new CourtLinkSession(sessionDeps({ clock: new FakeClock(), hub: new FakeChannelHub() }));
    session.updateConfig({ room: 'K7QM-4F9X', relayUrl: 'relay.example.com' });
    assert.equal(
      session.buildInviteLink('https://example.github.io/polobridge/', 'D'),
      'https://example.github.io/polobridge/#pp-room=K7QM-4F9X&pp-court=D&pp-relay=wss%3A%2F%2Frelay.example.com'
    );
    assert.equal(
      session.buildInviteLink('https://example.github.io/polobridge/', null),
      'https://example.github.io/polobridge/#pp-room=K7QM-4F9X&pp-relay=wss%3A%2F%2Frelay.example.com'
    );
  });
});

describe('session — one court, one publishing tab per browser', () => {
  it('lets the first tab publish and blocks a second tab from the same court', async () => {
    const clock = new FakeClock();
    const hub = new FakeChannelHub();
    const locks = new FakeLockManager();
    const storage = new MemoryStorage();

    const firstTab = new CourtLinkSession(sessionDeps({ clock, hub, locks, storage, idSeed: 1 }));
    firstTab.updateConfig({ deskCourtId: 'A' });
    assert.equal(firstTab.getStatus().deskSlot, 'acquiring');
    await flushMicrotasks();
    assert.equal(firstTab.getStatus().deskSlot, 'publishing');

    // A second tab opens later and inherits "Court A" from shared storage.
    const secondTab = new CourtLinkSession(sessionDeps({ clock, hub, locks, storage, idSeed: 1 }));
    await flushMicrotasks();
    assert.equal(secondTab.getStatus().config.deskCourtId, 'A');
    assert.equal(secondTab.getStatus().deskSlot, 'blocked');

    // The blocked tab transmits nothing, but its dashboard still shows the live desk.
    firstTab.publishDeskState(deskState({ scoreWhite: 5 }));
    secondTab.publishDeskState(deskState({ scoreWhite: 99 }));
    secondTab.watch();
    clock.advance(2_000);
    const view = secondTab.getCourtViews()[0];
    assert.equal(view.snapshot?.scoreWhite, 5);
    assert.equal(view.conflict, null);
  });

  it('lets the blocked tab take over once the first tab lets go', async () => {
    const clock = new FakeClock();
    const hub = new FakeChannelHub();
    const locks = new FakeLockManager();
    const storage = new MemoryStorage();
    const firstTab = new CourtLinkSession(sessionDeps({ clock, hub, locks, storage }));
    firstTab.updateConfig({ deskCourtId: 'A' });
    await flushMicrotasks();
    const secondTab = new CourtLinkSession(sessionDeps({ clock, hub, locks, storage }));
    await flushMicrotasks();
    assert.equal(secondTab.getStatus().deskSlot, 'blocked');

    firstTab.dispose();
    assert.deepEqual(locks.heldNames(), []);
    secondTab.retryDeskSlot();
    await flushMicrotasks();
    assert.equal(secondTab.getStatus().deskSlot, 'publishing');
  });

  it('holds exactly one lock, named for the room and court, and moves it with the court', async () => {
    const clock = new FakeClock();
    const locks = new FakeLockManager();
    const session = new CourtLinkSession(sessionDeps({ clock, hub: new FakeChannelHub(), locks }));
    session.updateConfig({ room: 'K7QM-4F9X', deskCourtId: 'A' });
    await flushMicrotasks();
    assert.deepEqual(locks.heldNames(), ['polopad-court-desk:K7QM-4F9X:A']);
    session.updateConfig({ deskCourtId: 'B' });
    await flushMicrotasks();
    assert.deepEqual(locks.heldNames(), ['polopad-court-desk:K7QM-4F9X:B']);
    session.updateConfig({ deskCourtId: null });
    await flushMicrotasks();
    assert.deepEqual(locks.heldNames(), []);
  });

  it('releases a lock that was granted after the operator changed their mind', async () => {
    const clock = new FakeClock();
    const locks = new FakeLockManager();
    const session = new CourtLinkSession(sessionDeps({ clock, hub: new FakeChannelHub(), locks }));
    session.updateConfig({ deskCourtId: 'A' });
    session.updateConfig({ deskCourtId: null });
    await flushMicrotasks();
    assert.deepEqual(locks.heldNames(), []);
    assert.equal(session.getStatus().deskSlot, 'off');
  });

  it('lets two tabs of one browser score two different courts', async () => {
    const clock = new FakeClock();
    const hub = new FakeChannelHub();
    const locks = new FakeLockManager();
    const storage = new MemoryStorage();
    const tabOne = new CourtLinkSession(sessionDeps({ clock, hub, locks, storage, tabStorage: new MemoryStorage() }));
    const tabTwo = new CourtLinkSession(sessionDeps({ clock, hub, locks, storage, tabStorage: new MemoryStorage() }));
    tabOne.updateConfig({ deskCourtId: 'A' });
    tabTwo.updateConfig({ deskCourtId: 'B' });
    await flushMicrotasks();
    assert.equal(tabOne.getStatus().deskSlot, 'publishing');
    assert.equal(tabTwo.getStatus().deskSlot, 'publishing');
  });

  it('a reloaded tab keeps its own court even after another tab chose a different one', () => {
    const clock = new FakeClock();
    const storage = new MemoryStorage();
    const tabOneStorage = new MemoryStorage();
    const tabOne = new CourtLinkSession(sessionDeps({ clock, hub: new FakeChannelHub(), storage, tabStorage: tabOneStorage }));
    tabOne.updateConfig({ deskCourtId: 'A' });
    const tabTwo = new CourtLinkSession(
      sessionDeps({ clock, hub: new FakeChannelHub(), storage, tabStorage: new MemoryStorage() })
    );
    tabTwo.updateConfig({ deskCourtId: 'B' });
    assert.equal(JSON.parse(storage.getItem(COURT_LINK_STORAGE_KEY) as string).config.deskCourtId, 'B');

    const tabOneReloaded = new CourtLinkSession(
      sessionDeps({ clock, hub: new FakeChannelHub(), storage, tabStorage: tabOneStorage })
    );
    assert.equal(tabOneReloaded.getStatus().config.deskCourtId, 'A');
    assert.equal(tabOneStorage.getItem(COURT_LINK_TAB_STORAGE_KEY), 'A');
  });

  it('a tab that switched its court off stays off after a reload', () => {
    const clock = new FakeClock();
    const storage = new MemoryStorage();
    const tabStorage = new MemoryStorage();
    const tab = new CourtLinkSession(sessionDeps({ clock, hub: new FakeChannelHub(), storage, tabStorage }));
    tab.updateConfig({ deskCourtId: 'A' });
    tab.updateConfig({ deskCourtId: null });
    // Another tab then picks a court, changing the shared default.
    new CourtLinkSession(sessionDeps({ clock, hub: new FakeChannelHub(), storage, tabStorage: new MemoryStorage() })).updateConfig({
      deskCourtId: 'C',
    });
    const reloaded = new CourtLinkSession(sessionDeps({ clock, hub: new FakeChannelHub(), storage, tabStorage }));
    assert.equal(reloaded.getStatus().config.deskCourtId, null);
  });

  it('publishes without a lock when the browser has no Web Locks API', () => {
    const session = new CourtLinkSession(sessionDeps({ clock: new FakeClock(), hub: new FakeChannelHub(), locks: null }));
    session.updateConfig({ deskCourtId: 'A' });
    assert.equal(session.getStatus().deskSlot, 'publishing');
  });
});

describe('session — cross-device relay', () => {
  function relayPair(): {
    clock: FakeClock;
    deskSockets: FakeSocketFactory;
    directorSockets: FakeSocketFactory;
    desk: CourtLinkSession;
    director: CourtLinkSession;
  } {
    const clock = new FakeClock();
    const deskSockets = new FakeSocketFactory();
    const directorSockets = new FakeSocketFactory();
    // Separate hubs: two physical devices do not share a BroadcastChannel.
    const desk = new CourtLinkSession(sessionDeps({ clock, hub: new FakeChannelHub(), sockets: deskSockets, idSeed: 1 }));
    const director = new CourtLinkSession(
      sessionDeps({ clock, hub: new FakeChannelHub(), sockets: directorSockets, idSeed: 101 })
    );
    for (const session of [desk, director]) session.updateConfig({ room: 'K7QM-4F9X', relayUrl: 'wss://relay.test' });
    return { clock, deskSockets, directorSockets, desk, director };
  }

  it('connects each device to the room on the relay', () => {
    const { directorSockets, director } = relayPair();
    director.watch();
    assert.equal(directorSockets.latest().url, 'wss://relay.test/room/K7QM-4F9X');
    assert.equal(director.getStatus().relayStatus, 'connecting');
    directorSockets.latest().serverOpen();
    assert.equal(director.getStatus().relayStatus, 'open');
  });

  it('carries a desk on one device to a director on another', () => {
    const { clock, deskSockets, directorSockets, desk, director } = relayPair();
    director.watch();
    directorSockets.latest().serverOpen();
    desk.updateConfig({ deskCourtId: 'B' });
    deskSockets.latest().serverOpen();
    desk.publishDeskState(deskState({ isRunning: true, gameTimeMs: 90_000, shotTimeMs: 30_000, scoreDark: 3 }));
    clock.advance(SESSION_TICK_MS);

    // The relay rebroadcasts each desk frame to the other sockets in the room.
    const deskFrames = deskSockets.latest().sent.filter((raw) => raw.includes('"snapshot"'));
    assert.ok(deskFrames.length >= 1);
    for (const raw of deskFrames) directorSockets.latest().serverMessage(raw);

    const view = director.getCourtViews()[1];
    assert.equal(view.health, 'live');
    assert.equal(view.snapshot?.scoreDark, 3);
  });

  it('asks every desk to announce itself as soon as the relay connects', () => {
    const { directorSockets, director } = relayPair();
    director.watch();
    assert.deepEqual(directorSockets.latest().sent, [], 'nothing can be sent while connecting');
    directorSockets.latest().serverOpen();
    assert.equal(directorSockets.latest().sent.filter((raw) => raw.includes('"sync-request"')).length, 1);
  });

  it('re-announces the desk after the relay reconnects', () => {
    const { clock, deskSockets, desk } = relayPair();
    desk.updateConfig({ deskCourtId: 'A' });
    deskSockets.latest().serverOpen();
    desk.publishDeskState(deskState({ scoreWhite: 3 }));
    clock.advance(SESSION_TICK_MS);

    deskSockets.latest().serverClose();
    assert.equal(desk.getStatus().relayStatus, 'reconnecting');
    clock.advance(500);
    const fresh = deskSockets.latest();
    fresh.serverOpen();
    clock.advance(SESSION_TICK_MS);
    assert.ok(fresh.sent.some((raw) => raw.includes('"snapshot"')), 'the new socket gets the current state at once');
  });

  it('answers a sync request that arrives over the relay', () => {
    const { clock, deskSockets, desk, director } = relayPair();
    desk.updateConfig({ deskCourtId: 'A' });
    deskSockets.latest().serverOpen();
    desk.publishDeskState(deskState());
    clock.advance(600);
    const before = deskSockets.latest().sent.filter((raw) => raw.includes('"snapshot"')).length;

    director.watch();
    const request = encodeCourtFrame({
      v: 1,
      room: 'K7QM-4F9X',
      kind: 'sync-request',
      deskId: director.getStatus().deskId,
      sessionStartedAtMs: 1,
      seq: 1,
      sentAtMs: clock.nowMs,
    });
    deskSockets.latest().serverMessage(request);
    const after = deskSockets.latest().sent.filter((raw) => raw.includes('"snapshot"')).length;
    assert.equal(after, before + 1);
  });

  it('opens no socket when no relay is configured', () => {
    const clock = new FakeClock();
    const sockets = new FakeSocketFactory();
    const session = new CourtLinkSession(sessionDeps({ clock, hub: new FakeChannelHub(), sockets }));
    session.watch();
    assert.equal(sockets.sockets.length, 0);
    assert.equal(session.getStatus().relayStatus, 'idle');
  });

  it('closes the relay socket when the relay address is cleared', () => {
    const { directorSockets, director } = relayPair();
    director.watch();
    const socket = directorSockets.latest();
    socket.serverOpen();
    director.updateConfig({ relayUrl: '' });
    assert.deepEqual(socket.closedWith, { code: 1000, reason: 'client stopped' });
    assert.equal(director.getStatus().relayStatus, 'idle');
  });
});

describe('session — demo mode', () => {
  it('fills all four courts with simulated matches', () => {
    const clock = new FakeClock();
    const session = new CourtLinkSession(sessionDeps({ clock, hub: new FakeChannelHub() }));
    session.setDemoMode(true);
    assert.equal(session.getStatus().isDemoMode, true);
    clock.advance(2_000);
    const views = session.getCourtViews();
    assert.deepEqual(
      views.map((view) => view.health),
      ['live', 'live', 'live', 'live']
    );
    assert.ok(views.every((view) => (view.deskLabel ?? '').startsWith('Demo ')));
  });

  it('never puts simulated data on a transport', () => {
    const clock = new FakeClock();
    const hub = new FakeChannelHub();
    const sockets = new FakeSocketFactory();
    const session = new CourtLinkSession(sessionDeps({ clock, hub, sockets }));
    session.updateConfig({ relayUrl: 'wss://relay.test' });
    session.watch();
    sockets.latest().serverOpen();
    const postedBefore = hub.posted.length;
    const sentBefore = sockets.latest().sent.length;

    session.setDemoMode(true);
    clock.advance(20_000);
    const leaked = [...hub.posted.slice(postedBefore).map((entry) => String(entry.message)), ...sockets.latest().sent.slice(sentBefore)].filter(
      (raw) => raw.includes(DEMO_ROOM) || raw.includes('Demo ')
    );
    assert.deepEqual(leaked, []);
    assert.ok(!hub.openChannelNames().some((name) => name.includes(DEMO_ROOM)));
  });

  it('keeps real courts separate and shows them again when the demo ends', () => {
    const { clock, desk, director } = pair();
    director.watch();
    desk.updateConfig({ deskCourtId: 'A' });
    desk.publishDeskState(deskState({ teamWhiteName: 'REALTEAM' }));

    director.setDemoMode(true);
    clock.advance(1_500);
    assert.notEqual(director.getCourtViews()[0].snapshot?.teamWhiteName, 'REALTEAM');

    director.setDemoMode(false);
    assert.equal(director.getStatus().isDemoMode, false);
    const views = director.getCourtViews();
    assert.equal(views[0].snapshot?.teamWhiteName, 'REALTEAM');
    assert.equal(views[0].health, 'live', 'the real desk kept being tracked during the demo');
    assert.equal(views[1].health, 'empty');
  });

  it('stops its timer when the demo is the only thing running and it ends', () => {
    const clock = new FakeClock();
    const session = new CourtLinkSession(sessionDeps({ clock, hub: new FakeChannelHub() }));
    session.setDemoMode(true);
    clock.advance(1_000);
    assert.equal(clock.pendingTimers(), 1);
    session.setDemoMode(false);
    clock.advance(SESSION_TICK_MS * 2);
    assert.equal(clock.pendingTimers(), 0);
  });

  it('lets the director dismiss a tile', () => {
    const { desk, director } = pair();
    director.watch();
    desk.updateConfig({ deskCourtId: 'A' });
    desk.publishDeskState(deskState());
    desk.handlePageHide();
    director.clearCourt('A');
    assert.equal(director.getCourtViews()[0].health, 'empty');
  });
});

describe('session — shutdown', () => {
  it('releases every channel, socket, lock and timer on dispose', async () => {
    const clock = new FakeClock();
    const hub = new FakeChannelHub();
    const sockets = new FakeSocketFactory();
    const locks = new FakeLockManager();
    const session = new CourtLinkSession(sessionDeps({ clock, hub, sockets, locks }));
    session.updateConfig({ deskCourtId: 'A', relayUrl: 'wss://relay.test' });
    await flushMicrotasks();
    session.watch();
    session.setDemoMode(true);
    session.dispose();

    assert.deepEqual(hub.openChannelNames(), []);
    assert.deepEqual(locks.heldNames(), []);
    assert.equal(clock.pendingTimers(), 0);
    assert.equal(sockets.latest().closedWith?.code, 1000);
    clock.advance(30_000);
    assert.equal(clock.pendingTimers(), 0);
  });
});
