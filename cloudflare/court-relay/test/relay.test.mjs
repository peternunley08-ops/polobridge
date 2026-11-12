/**
 * PoloPad Pro — Court Relay protocol tests.
 *
 * Runs the real Worker under `wrangler dev` (the local Workers runtime) and
 * talks to it with ordinary WebSocket clients.
 *
 *     npm test
 *
 * Set RELAY_TEST_URL=http://127.0.0.1:8787 to test a relay that is already
 * running instead of starting one.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED_ORIGIN = 'https://peternunley08-ops.github.io';

let httpBase = process.env.RELAY_TEST_URL ?? '';
let relayProcess = null;
let relayLog = '';

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(`${httpBase}/health`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) throw new Error(`Relay did not start within ${timeoutMs} ms.\n${relayLog}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

before(async () => {
  if (httpBase) {
    await waitForHealth(5_000);
    return;
  }
  const port = await freePort();
  httpBase = `http://127.0.0.1:${port}`;
  relayProcess = spawn(
    process.execPath,
    [join(packageDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), 'dev', '--port', String(port), '--ip', '127.0.0.1'],
    { cwd: packageDir, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  relayProcess.stdout.on('data', (chunk) => (relayLog += chunk));
  relayProcess.stderr.on('data', (chunk) => (relayLog += chunk));
  await waitForHealth(60_000);
});

after(() => {
  closeAllSockets();
  if (relayProcess && relayProcess.pid) {
    try {
      // Negative pid: stop wrangler together with the runtime it started.
      process.kill(-relayProcess.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
});

// ---------------------------------------------------------------------------
// Client helpers
// ---------------------------------------------------------------------------

const wsBase = () => httpBase.replace(/^http/, 'ws');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let roomCounter = 0;

/** Every socket a test opens, so a failing test cannot leave one behind. */
const openedSockets = new Set();

function closeAllSockets() {
  for (const socket of openedSockets) {
    try {
      socket.close();
    } catch {
      // Already closed.
    }
  }
  openedSockets.clear();
}

afterEach(closeAllSockets);

/** A fresh room per test keeps them independent. */
function newRoom() {
  roomCounter += 1;
  return `T${Date.now().toString(36).toUpperCase()}-${String(roomCounter).padStart(4, '0')}`;
}

function frame(room, extra = {}) {
  return JSON.stringify({ v: 1, room, kind: 'snapshot', deskId: 'DESKAAAA0001', sessionStartedAtMs: 1, seq: 1, sentAtMs: 1, ...extra });
}

/** Opens a socket and records everything that happens on it. */
function connect(room) {
  const socket = new WebSocket(`${wsBase()}/room/${room}`);
  openedSockets.add(socket);
  const client = { socket, messages: [], closeEvent: null, opened: false };
  client.open = new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      client.opened = true;
      resolve(client);
    });
    socket.addEventListener('error', () => reject(new Error(`socket to room ${room} failed to open`)));
  });
  client.closed = new Promise((resolve) => {
    socket.addEventListener('close', (event) => {
      client.closeEvent = { code: event.code, reason: event.reason };
      resolve(client.closeEvent);
    });
  });
  socket.addEventListener('message', (event) => client.messages.push(event.data));
  client.send = (data) => socket.send(data);
  client.close = () => socket.close();
  return client;
}

async function open(room) {
  return connect(room).open;
}

async function waitForMessages(client, count, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (client.messages.length < count) {
    if (Date.now() > deadline) {
      throw new Error(`expected ${count} message(s), received ${client.messages.length}: ${JSON.stringify(client.messages)}`);
    }
    await pause(10);
  }
  return client.messages;
}

async function closeWithin(client, timeoutMs = 2_000) {
  return Promise.race([
    client.closed,
    pause(timeoutMs).then(() => {
      throw new Error('socket was not closed by the relay');
    }),
  ]);
}

/** Raw handshake, so the Origin header can be chosen. Resolves to the status code. */
function handshakeStatus(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(`${httpBase}${path}`, {
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
        ...headers,
      },
    });
    request.on('upgrade', (_response, socket) => {
      socket.destroy();
      resolve(101);
    });
    request.on('response', (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on('error', reject);
    request.end();
  });
}

// ---------------------------------------------------------------------------

describe('court relay — HTTP surface', () => {
  it('answers a health check', async () => {
    const response = await fetch(`${httpBase}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { service: 'polopad-court-relay', protocol: 1, ok: true });
  });

  it('rejects unknown paths and invalid room codes', async () => {
    assert.equal((await fetch(`${httpBase}/nope`)).status, 404);
    assert.equal(await handshakeStatus('/room/ab'), 400);
    assert.equal(await handshakeStatus('/room/%E0%A4%A'), 400);
    assert.equal(await handshakeStatus(`/room/${'A'.repeat(40)}`), 400);
    assert.equal(await handshakeStatus('/room/BAD!CODE'), 400);
  });

  it('requires a WebSocket upgrade for a room', async () => {
    assert.equal((await fetch(`${httpBase}/room/${newRoom()}`)).status, 426);
  });

  it('admits browsers only from the allowed origins', async () => {
    const room = newRoom();
    assert.equal(await handshakeStatus(`/room/${room}`, { Origin: ALLOWED_ORIGIN }), 101);
    assert.equal(await handshakeStatus(`/room/${room}`, { Origin: 'http://localhost:3000' }), 101);
    assert.equal(await handshakeStatus(`/room/${room}`, { Origin: 'https://evil.example' }), 403);
    assert.equal(await handshakeStatus(`/room/${room}`, { Origin: 'https://peternunley08-ops.github.io.evil.example' }), 403);
  });

  it('admits a non-browser client that sends no Origin', async () => {
    assert.equal(await handshakeStatus(`/room/${newRoom()}`), 101);
  });
});

describe('court relay — fan-out', () => {
  it('delivers a frame to the other socket in the room, unchanged, and not back to the sender', async () => {
    const room = newRoom();
    const desk = await open(room);
    const director = await open(room);
    const sent = frame(room, { courtId: 'B', snapshot: { scoreWhite: 7, teamWhiteName: 'NEWPORT — “A”' } });
    desk.send(sent);
    assert.deepEqual(await waitForMessages(director, 1), [sent]);
    await pause(150);
    assert.deepEqual(desk.messages, []);
    desk.close();
    director.close();
  });

  it('delivers to every other socket in the room', async () => {
    const room = newRoom();
    const [desk, directorOne, directorTwo] = await Promise.all([open(room), open(room), open(room)]);
    desk.send(frame(room, { seq: 1 }));
    desk.send(frame(room, { seq: 2 }));
    assert.equal((await waitForMessages(directorOne, 2)).length, 2);
    assert.equal((await waitForMessages(directorTwo, 2)).length, 2);
    assert.deepEqual(
      directorOne.messages.map((raw) => JSON.parse(raw).seq),
      [1, 2],
      'order is preserved'
    );
    for (const client of [desk, directorOne, directorTwo]) client.close();
  });

  it('keeps rooms isolated from one another', async () => {
    const roomOne = newRoom();
    const roomTwo = newRoom();
    const [desk, sameRoom, otherRoom] = await Promise.all([open(roomOne), open(roomOne), open(roomTwo)]);
    desk.send(frame(roomOne));
    await waitForMessages(sameRoom, 1);
    await pause(200);
    assert.deepEqual(otherRoom.messages, []);
    for (const client of [desk, sameRoom, otherRoom]) client.close();
  });

  it('treats the room code in the URL as case-insensitive', async () => {
    const room = newRoom();
    const upper = await open(room);
    const lower = await open(room.toLowerCase());
    lower.send(frame(room));
    assert.equal((await waitForMessages(upper, 1)).length, 1);
    upper.close();
    lower.close();
  });

  it('keeps serving the room after one socket leaves', async () => {
    const room = newRoom();
    const [desk, leaver, stayer] = await Promise.all([open(room), open(room), open(room)]);
    leaver.close();
    await leaver.closed;
    desk.send(frame(room));
    assert.equal((await waitForMessages(stayer, 1)).length, 1);
    desk.close();
    stayer.close();
  });

  it('closes cleanly when the client closes', async () => {
    const client = await open(newRoom());
    client.close();
    const event = await closeWithin(client);
    assert.ok([1000, 1005].includes(event.code), `close code was ${event.code}`);
  });
});

describe('court relay — keep-alive', () => {
  it('answers ping with pong to the sender only', async () => {
    const room = newRoom();
    const desk = await open(room);
    const director = await open(room);
    desk.send('ping');
    assert.deepEqual(await waitForMessages(desk, 1), ['pong']);
    await pause(150);
    assert.deepEqual(director.messages, []);
    desk.close();
    director.close();
  });
});

describe('court relay — guard rails', () => {
  async function expectRejected(payload, expectedCode) {
    const room = newRoom();
    const sender = await open(room);
    const witness = await open(room);
    sender.send(typeof payload === 'function' ? payload(room) : payload);
    const event = await closeWithin(sender);
    assert.equal(event.code, expectedCode);
    await pause(150);
    assert.deepEqual(witness.messages, [], 'a rejected frame is never forwarded');
    witness.close();
  }

  it('drops a sender whose frame is not JSON', async () => {
    await expectRejected('hello everyone', 1008);
  });

  it('drops a sender whose frame is addressed to another room', async () => {
    await expectRejected(() => frame('SOME-OTHER-ROOM'), 1008);
  });

  it('drops a sender whose JSON is not a court frame', async () => {
    await expectRejected((room) => JSON.stringify({ room }), 1008);
    await expectRejected(() => JSON.stringify(['array']), 1008);
    await expectRejected(() => 'null', 1008);
  });

  it('drops a sender whose frame exceeds 16 KB', async () => {
    await expectRejected((room) => frame(room, { pad: 'x'.repeat(17 * 1024) }), 1009);
  });

  it('drops a sender of binary frames', async () => {
    await expectRejected(new Uint8Array([1, 2, 3, 4]), 1003);
  });

  it('accepts a frame just under the size limit', async () => {
    const room = newRoom();
    const sender = await open(room);
    const witness = await open(room);
    const large = frame(room, { pad: 'x'.repeat(15 * 1024) });
    assert.ok(large.length < 16 * 1024);
    sender.send(large);
    assert.equal((await waitForMessages(witness, 1))[0].length, large.length);
    sender.close();
    witness.close();
  });

  it('allows a desk’s normal rate and cuts off a flood', async () => {
    const room = newRoom();
    const sender = await open(room);
    const witness = await open(room);

    // Ten frames a second is the most a real desk ever sends.
    for (let i = 0; i < 10; i += 1) sender.send(frame(room, { seq: i + 1 }));
    await waitForMessages(witness, 10);
    assert.equal(sender.closeEvent, null);

    await pause(1_100);
    for (let i = 0; i < 60; i += 1) sender.send(frame(room, { seq: 100 + i }));
    const event = await closeWithin(sender);
    assert.equal(event.code, 1008);
    await pause(300);
    // Exactly the 30 frames allowed in the window got through, and none after the cut-off.
    assert.equal(witness.messages.length, 10 + 30, `forwarded ${witness.messages.length} frames`);
    const lastForwarded = JSON.parse(witness.messages[witness.messages.length - 1]).seq;
    assert.equal(lastForwarded, 100 + 29);
    witness.close();
  });

  it('caps a room at 24 sockets and frees the place when one leaves', async () => {
    const room = newRoom();
    const clients = await Promise.all(Array.from({ length: 24 }, () => open(room)));
    assert.equal(await handshakeStatus(`/room/${room}`), 429);

    clients[0].close();
    await clients[0].closed;
    await pause(200);
    assert.equal(await handshakeStatus(`/room/${room}`), 101);
    for (const client of clients.slice(1)) client.close();
  });
});
