/**
 * Court Link transports — relay watchdog, BroadcastChannel, relay URL rules,
 * device config persistence and invite links.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_LOCAL_ROOM } from '../src/engine/court-link';
import {
  BroadcastChannelTransport,
  COURT_LINK_STORAGE_KEY,
  CourtTransportStatus,
  DESK_LABEL_MAX_LENGTH,
  RELAY_MAX_BUFFERED_BYTES,
  RELAY_PING_INTERVAL_MS,
  RELAY_PING_TEXT,
  RELAY_PONG_TEXT,
  WebSocketRelayTransport,
  buildInviteHash,
  courtChannelName,
  createDeskId,
  defaultBroadcastChannelFactory,
  loadStoredCourtLink,
  normalizeRelayUrl,
  parseInviteHash,
  relayBackoffDelayMs,
  relaySocketUrl,
  saveStoredCourtLink,
} from '../src/engine/court-link-transports';
import { FakeChannelHub, FakeClock, FakeSocketFactory, MemoryStorage, countingBytes } from './helpers';

interface Recorder {
  messages: string[];
  statuses: Array<[CourtTransportStatus, string | null]>;
  handlers: {
    onMessage: (raw: string) => void;
    onStatus: (status: CourtTransportStatus, detail: string | null) => void;
  };
}

function recorder(): Recorder {
  const messages: string[] = [];
  const statuses: Array<[CourtTransportStatus, string | null]> = [];
  return {
    messages,
    statuses,
    handlers: {
      onMessage: (raw) => messages.push(raw),
      onStatus: (status, detail) => statuses.push([status, detail]),
    },
  };
}

// ---------------------------------------------------------------------------
// Relay watchdog
// ---------------------------------------------------------------------------

describe('relay reconnect backoff', () => {
  it('follows 500 ms -> 1 s -> 2 s -> 4 s -> 8 s and then stays at 8 s', () => {
    assert.deepEqual(
      [1, 2, 3, 4, 5, 6, 7, 20].map(relayBackoffDelayMs),
      [500, 1_000, 2_000, 4_000, 8_000, 8_000, 8_000, 8_000]
    );
  });

  it('is safe for nonsense attempt numbers', () => {
    assert.equal(relayBackoffDelayMs(0), 500);
    assert.equal(relayBackoffDelayMs(-3), 500);
    assert.equal(relayBackoffDelayMs(2.9), 1_000);
    assert.equal(relayBackoffDelayMs(100_000), 8_000);
  });
});

function relayRig(): {
  clock: FakeClock;
  sockets: FakeSocketFactory;
  record: Recorder;
  transport: WebSocketRelayTransport;
} {
  const clock = new FakeClock();
  const sockets = new FakeSocketFactory();
  const record = recorder();
  const transport = new WebSocketRelayTransport('wss://relay.test/room/TEST-ROOM', record.handlers, {
    createSocket: sockets.create,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  return { clock, sockets, record, transport };
}

describe('WebSocket relay transport', () => {
  it('connects to the room URL and reports open', () => {
    const { sockets, record, transport } = relayRig();
    transport.start();
    assert.equal(sockets.sockets.length, 1);
    assert.equal(sockets.latest().url, 'wss://relay.test/room/TEST-ROOM');
    assert.equal(transport.getStatus(), 'connecting');
    sockets.latest().serverOpen();
    assert.equal(transport.getStatus(), 'open');
    assert.deepEqual(
      record.statuses.map(([status]) => status),
      ['connecting', 'open']
    );
  });

  it('only sends while the socket is open', () => {
    const { sockets, transport } = relayRig();
    assert.equal(transport.send('before-start'), false);
    transport.start();
    assert.equal(transport.send('while-connecting'), false);
    sockets.latest().serverOpen();
    assert.equal(transport.send('hello'), true);
    assert.deepEqual(sockets.latest().sent, ['hello']);
  });

  it('forwards text frames and ignores binary ones', () => {
    const { sockets, record, transport } = relayRig();
    transport.start();
    sockets.latest().serverOpen();
    sockets.latest().serverMessage('{"v":1}');
    sockets.latest().serverMessage(new Uint8Array([1, 2, 3]));
    assert.deepEqual(record.messages, ['{"v":1}']);
  });

  it('pings every five seconds, measures the round trip and hides the pong', () => {
    const { clock, sockets, record, transport } = relayRig();
    transport.start();
    sockets.latest().serverOpen();
    assert.equal(transport.getRttMs(), null);

    clock.advance(RELAY_PING_INTERVAL_MS);
    assert.deepEqual(sockets.latest().sent, [RELAY_PING_TEXT]);
    clock.advance(42);
    sockets.latest().serverMessage(RELAY_PONG_TEXT);
    assert.equal(transport.getRttMs(), 42);
    assert.deepEqual(record.messages, [], 'the keep-alive never reaches the engine');
  });

  it('reconnects with the documented backoff when the relay keeps refusing', () => {
    const { clock, sockets, record, transport } = relayRig();
    transport.start();
    const delays: number[] = [];
    for (let attempt = 1; attempt <= 7; attempt += 1) {
      sockets.latest().serverClose();
      assert.equal(transport.getStatus(), 'reconnecting');
      delays.push(clock.pendingDelays()[0]);
      clock.advance(delays[delays.length - 1]);
      assert.equal(sockets.sockets.length, attempt + 1, `attempt ${attempt} opened a new socket`);
    }
    assert.deepEqual(delays, [500, 1_000, 2_000, 4_000, 8_000, 8_000, 8_000]);
    assert.match(String(record.statuses[record.statuses.length - 1][1]), /retry 7 in 8000 ms/);
  });

  it('never gives up: a director screen stays on all day', () => {
    const { clock, sockets, transport } = relayRig();
    transport.start();
    for (let attempt = 1; attempt <= 40; attempt += 1) {
      sockets.latest().serverClose();
      clock.advance(8_000);
    }
    assert.equal(sockets.sockets.length, 41);
    assert.equal(transport.getStatus(), 'reconnecting');
  });

  it('starts the backoff over after a successful connection', () => {
    const { clock, sockets, transport } = relayRig();
    transport.start();
    sockets.latest().serverClose();
    clock.advance(500);
    sockets.latest().serverClose();
    assert.deepEqual(clock.pendingDelays(), [1_000]);
    clock.advance(1_000);

    sockets.latest().serverOpen();
    assert.equal(transport.getReconnectAttempt(), 0);
    sockets.latest().serverClose();
    assert.deepEqual(clock.pendingDelays(), [500]);
  });

  it('detects a half-open socket by the missing pong and reconnects', () => {
    const { clock, sockets, transport } = relayRig();
    transport.start();
    const first = sockets.latest();
    first.serverOpen();

    // Wi-Fi dropped without a FIN: pings go out, nothing ever comes back.
    clock.advance(RELAY_PING_INTERVAL_MS * 2);
    assert.equal(first.closedWith, null, 'two silent cycles are tolerated');
    clock.advance(RELAY_PING_INTERVAL_MS);
    assert.deepEqual(first.closedWith, { code: 4000, reason: 'pong timeout' });
    assert.equal(transport.getStatus(), 'reconnecting');

    clock.advance(500);
    assert.equal(sockets.sockets.length, 2);
  });

  it('keeps a healthy socket open indefinitely', () => {
    const { clock, sockets, transport } = relayRig();
    transport.start();
    const socket = sockets.latest();
    socket.serverOpen();
    for (let cycle = 0; cycle < 50; cycle += 1) {
      clock.advance(RELAY_PING_INTERVAL_MS);
      socket.serverMessage(RELAY_PONG_TEXT);
    }
    assert.equal(socket.closedWith, null);
    assert.equal(sockets.sockets.length, 1);
    assert.equal(transport.getStatus(), 'open');
  });

  it('ignores late events from a socket it has already replaced', () => {
    const { clock, sockets, record, transport } = relayRig();
    transport.start();
    const first = sockets.latest();
    first.serverOpen();
    clock.advance(RELAY_PING_INTERVAL_MS * 3);
    clock.advance(500);
    const second = sockets.latest();
    assert.notEqual(second, first);

    // The dead socket finally reports in; none of it may disturb the new one.
    first.serverClose();
    first.serverMessage('stale frame');
    second.serverOpen();
    assert.equal(sockets.sockets.length, 2);
    assert.deepEqual(record.messages, []);
    assert.equal(transport.getStatus(), 'open');
  });

  it('stops cleanly: closes the socket, cancels every timer and stays stopped', () => {
    const { clock, sockets, transport } = relayRig();
    transport.start();
    const socket = sockets.latest();
    socket.serverOpen();
    transport.stop();

    assert.deepEqual(socket.closedWith, { code: 1000, reason: 'client stopped' });
    assert.equal(transport.getStatus(), 'idle');
    assert.equal(clock.pendingTimers(), 0);
    socket.serverClose();
    clock.advance(60_000);
    assert.equal(sockets.sockets.length, 1, 'no reconnect after an intentional stop');
    assert.equal(transport.send('late'), false);
  });

  it('cancels a pending reconnect when stopped during the backoff', () => {
    const { clock, sockets, transport } = relayRig();
    transport.start();
    sockets.latest().serverClose();
    transport.stop();
    assert.equal(clock.pendingTimers(), 0);
    clock.advance(10_000);
    assert.equal(sockets.sockets.length, 1);
  });

  it('drops frames instead of queueing behind a stalled socket', () => {
    const { sockets, transport } = relayRig();
    transport.start();
    const socket = sockets.latest();
    socket.serverOpen();
    socket.bufferedAmount = RELAY_MAX_BUFFERED_BYTES + 1;
    assert.equal(transport.send('snapshot'), false);
    assert.deepEqual(socket.sent, []);
    socket.bufferedAmount = 0;
    assert.equal(transport.send('snapshot'), true);
  });

  it('retries when the browser refuses to construct the socket', () => {
    const { clock, sockets, transport } = relayRig();
    sockets.failNext = true;
    assert.doesNotThrow(() => transport.start());
    assert.equal(transport.getStatus(), 'reconnecting');
    clock.advance(500);
    assert.equal(sockets.sockets.length, 1);
  });

  it('is idempotent: starting twice opens one socket', () => {
    const { sockets, transport } = relayRig();
    transport.start();
    transport.start();
    assert.equal(sockets.sockets.length, 1);
  });
});

// ---------------------------------------------------------------------------
// BroadcastChannel transport
// ---------------------------------------------------------------------------

describe('BroadcastChannel transport', () => {
  it('names the channel after the room', () => {
    assert.equal(courtChannelName('K7QM-4F9X'), 'polopad_court_link_v1:K7QM-4F9X');
  });

  it('exchanges frames between two tabs in the same room', () => {
    const hub = new FakeChannelHub();
    const desk = recorder();
    const director = recorder();
    const a = new BroadcastChannelTransport('ROOM-ONE', desk.handlers, hub.factory);
    const b = new BroadcastChannelTransport('ROOM-ONE', director.handlers, hub.factory);
    a.start();
    b.start();
    assert.equal(a.getStatus(), 'open');
    assert.equal(a.send('frame-1'), true);
    assert.deepEqual(director.messages, ['frame-1']);
    assert.deepEqual(desk.messages, [], 'a tab never hears itself');
  });

  it('isolates rooms from one another', () => {
    const hub = new FakeChannelHub();
    const other = recorder();
    const a = new BroadcastChannelTransport('ROOM-ONE', recorder().handlers, hub.factory);
    const b = new BroadcastChannelTransport('ROOM-TWO', other.handlers, hub.factory);
    a.start();
    b.start();
    a.send('frame-1');
    assert.deepEqual(other.messages, []);
  });

  it('ignores non-text messages from other software on the channel', () => {
    const hub = new FakeChannelHub();
    const record = recorder();
    const transport = new BroadcastChannelTransport('ROOM-ONE', record.handlers, hub.factory);
    transport.start();
    hub.inject(courtChannelName('ROOM-ONE'), { evil: true });
    hub.inject(courtChannelName('ROOM-ONE'), 12);
    assert.deepEqual(record.messages, []);
  });

  it('closes its channel when stopped', () => {
    const hub = new FakeChannelHub();
    const transport = new BroadcastChannelTransport('ROOM-ONE', recorder().handlers, hub.factory);
    transport.start();
    transport.stop();
    assert.deepEqual(hub.openChannelNames(), []);
    assert.equal(transport.getStatus(), 'idle');
    assert.equal(transport.send('late'), false);
  });

  it('reports unsupported instead of throwing when the API is missing', () => {
    const record = recorder();
    const transport = new BroadcastChannelTransport('ROOM-ONE', record.handlers, null);
    assert.doesNotThrow(() => transport.start());
    assert.equal(transport.getStatus(), 'unsupported');
    assert.equal(transport.send('x'), false);
  });

  it('works over the real BroadcastChannel implementation', async () => {
    const factory = defaultBroadcastChannelFactory();
    assert.ok(factory, 'this runtime provides BroadcastChannel');
    const room = `REAL-${Date.now()}`;
    const received = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('no message within 2 s')), 2_000);
      const listener = new BroadcastChannelTransport(
        room,
        {
          onMessage: (raw) => {
            clearTimeout(timeout);
            listener.stop();
            resolve(raw);
          },
          onStatus: () => undefined,
        },
        factory
      );
      listener.start();
    });
    const sender = new BroadcastChannelTransport(room, recorder().handlers, factory);
    sender.start();
    sender.send('real-frame');
    try {
      assert.equal(await received, 'real-frame');
    } finally {
      sender.stop();
    }
  });
});

// ---------------------------------------------------------------------------
// Relay URL rules
// ---------------------------------------------------------------------------

describe('relay address validation', () => {
  it('treats an empty address as "same device only"', () => {
    assert.deepEqual(normalizeRelayUrl(''), { ok: true, url: '' });
    assert.deepEqual(normalizeRelayUrl('   '), { ok: true, url: '' });
  });

  it('canonicalises what an operator pastes', () => {
    assert.deepEqual(normalizeRelayUrl('relay.example.workers.dev'), { ok: true, url: 'wss://relay.example.workers.dev' });
    assert.deepEqual(normalizeRelayUrl('https://relay.example.workers.dev/'), {
      ok: true,
      url: 'wss://relay.example.workers.dev',
    });
    assert.deepEqual(normalizeRelayUrl(' WSS://Relay.Example.com/base// '), {
      ok: true,
      url: 'wss://relay.example.com/base',
    });
    assert.deepEqual(normalizeRelayUrl('wss://relay.example.com:8443/?token=1#frag'), {
      ok: true,
      url: 'wss://relay.example.com:8443',
    });
  });

  it('allows insecure WebSocket only to the loopback interface', () => {
    assert.deepEqual(normalizeRelayUrl('ws://localhost:8787'), { ok: true, url: 'ws://localhost:8787' });
    assert.deepEqual(normalizeRelayUrl('http://127.0.0.1:8787'), { ok: true, url: 'ws://127.0.0.1:8787' });
    assert.deepEqual(normalizeRelayUrl('ws://[::1]:8787'), { ok: true, url: 'ws://[::1]:8787' });
  });

  it('rejects insecure WebSocket to any other host with an explanation', () => {
    for (const address of ['ws://192.168.1.20:8787', 'http://relay.example.com', 'ws://pool-laptop.local']) {
      const result = normalizeRelayUrl(address);
      assert.equal(result.ok, false, address);
      if (!result.ok) assert.match(result.error, /wss:\/\//);
    }
  });

  it('rejects other schemes, embedded credentials and nonsense', () => {
    assert.equal(normalizeRelayUrl('ftp://relay.example.com').ok, false);
    assert.equal(normalizeRelayUrl('javascript://alert(1)').ok, false);
    assert.equal(normalizeRelayUrl('wss://user:secret@relay.example.com').ok, false);
    assert.equal(normalizeRelayUrl('wss://not a host').ok, false);
    assert.equal(normalizeRelayUrl(`wss://${'a'.repeat(400)}.example.com`).ok, false);
    assert.equal(normalizeRelayUrl(undefined).ok, false);
  });

  it('builds the per-room socket URL', () => {
    assert.equal(relaySocketUrl('wss://relay.example.com', 'K7QM-4F9X'), 'wss://relay.example.com/room/K7QM-4F9X');
    assert.equal(relaySocketUrl('wss://relay.example.com/base', 'K7QM-4F9X'), 'wss://relay.example.com/base/room/K7QM-4F9X');
  });
});

// ---------------------------------------------------------------------------
// Device configuration
// ---------------------------------------------------------------------------

describe('device configuration', () => {
  it('starts as a plain single desk: local room, no court, no relay', () => {
    const stored = loadStoredCourtLink(new MemoryStorage(), countingBytes());
    assert.deepEqual(stored.config, {
      room: DEFAULT_LOCAL_ROOM,
      deskCourtId: null,
      deskLabel: `Desk ${stored.deskId.slice(0, 4)}`,
      relayUrl: '',
    });
    assert.match(stored.deskId, /^[A-Z2-9]{16}$/);
  });

  it('survives a reload', () => {
    const storage = new MemoryStorage();
    const first = loadStoredCourtLink(storage, countingBytes());
    const saved = {
      deskId: first.deskId,
      config: { room: 'K7QM-4F9X', deskCourtId: 'C' as const, deskLabel: 'iPad Table 3', relayUrl: 'wss://relay.example.com' },
    };
    assert.equal(saveStoredCourtLink(storage, saved), true);
    assert.deepEqual(loadStoredCourtLink(storage, countingBytes(99)), saved);
  });

  it('falls back to defaults when storage is unavailable or corrupted', () => {
    assert.equal(loadStoredCourtLink(null, countingBytes()).config.room, DEFAULT_LOCAL_ROOM);
    const storage = new MemoryStorage();
    storage.values.set(COURT_LINK_STORAGE_KEY, '{not json');
    assert.equal(loadStoredCourtLink(storage, countingBytes()).config.room, DEFAULT_LOCAL_ROOM);
    storage.values.set(COURT_LINK_STORAGE_KEY, '"just a string"');
    assert.equal(loadStoredCourtLink(storage, countingBytes()).config.deskCourtId, null);
  });

  it('repairs each invalid field on its own', () => {
    const storage = new MemoryStorage();
    storage.values.set(
      COURT_LINK_STORAGE_KEY,
      JSON.stringify({
        deskId: 'no',
        config: { room: '!!', deskCourtId: 'Z', deskLabel: `  ${'L'.repeat(80)}\u0007 `, relayUrl: 'ws://evil.example' },
      })
    );
    const stored = loadStoredCourtLink(storage, countingBytes());
    assert.match(stored.deskId, /^[A-Z2-9]{16}$/);
    assert.equal(stored.config.room, DEFAULT_LOCAL_ROOM);
    assert.equal(stored.config.deskCourtId, null);
    assert.equal(stored.config.relayUrl, '');
    assert.equal(stored.config.deskLabel.length, DESK_LABEL_MAX_LENGTH);
  });

  it('keeps working when the browser refuses to write', () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const stored = loadStoredCourtLink(storage, countingBytes());
    assert.doesNotThrow(() => saveStoredCourtLink(storage, stored));
    assert.equal(saveStoredCourtLink(storage, stored), false);
    assert.equal(saveStoredCourtLink(null, stored), false);
  });

  it('generates distinct desk ids', () => {
    const next = countingBytes();
    assert.notEqual(createDeskId(next), createDeskId(next));
  });
});

// ---------------------------------------------------------------------------
// Invite links
// ---------------------------------------------------------------------------

describe('invite links', () => {
  it('round-trips a desk invite with a relay', () => {
    const invite = { room: 'K7QM-4F9X', courtId: 'B' as const, relayUrl: 'wss://relay.example.workers.dev' };
    const hash = buildInviteHash(invite);
    assert.equal(hash, '#pp-room=K7QM-4F9X&pp-court=B&pp-relay=wss%3A%2F%2Frelay.example.workers.dev');
    assert.deepEqual(parseInviteHash(hash), invite);
  });

  it('round-trips a dashboard invite with no court and no relay', () => {
    const invite = { room: 'LOCAL-POOL', courtId: null, relayUrl: '' };
    assert.equal(buildInviteHash(invite), '#pp-room=LOCAL-POOL');
    assert.deepEqual(parseInviteHash(buildInviteHash(invite)), invite);
  });

  it('accepts a hand-typed lower-case link', () => {
    assert.deepEqual(parseInviteHash('#pp-room=k7qm-4f9x&pp-court=d'), {
      room: 'K7QM-4F9X',
      courtId: 'D',
      relayUrl: '',
    });
  });

  it('rejects the whole invite when any part is invalid', () => {
    assert.equal(parseInviteHash('#pp-room=!!&pp-court=B'), null);
    assert.equal(parseInviteHash('#pp-room=K7QM-4F9X&pp-court=E'), null);
    assert.equal(parseInviteHash('#pp-room=K7QM-4F9X&pp-relay=ws%3A%2F%2Fevil.example'), null);
    assert.equal(parseInviteHash('#pp-court=B'), null);
  });

  it('ignores fragments that are not invites', () => {
    assert.equal(parseInviteHash(''), null);
    assert.equal(parseInviteHash('#'), null);
    assert.equal(parseInviteHash('#section-2'), null);
    assert.equal(parseInviteHash(`#pp-room=${'A'.repeat(700)}`), null);
    assert.equal(parseInviteHash(null), null);
  });
});
