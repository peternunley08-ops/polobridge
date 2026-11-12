/**
 * Shared fixtures for the Court Link test suites: a manual clock with timers,
 * in-memory stand-ins for the browser APIs, and frame/state builders.
 */

import {
  COURT_LINK_PROTOCOL_VERSION,
  CourtFrame,
  CourtId,
  CourtSnapshotFrame,
  DeskStateInput,
  buildCourtSnapshot,
} from '../src/engine/court-link';
import {
  BroadcastChannelFactory,
  BroadcastChannelLike,
  RelaySocketLike,
  StorageLike,
} from '../src/engine/court-link-transports';
import { CourtLinkSessionDeps, DeskLockRequest } from '../src/engine/court-link-session';

/** A wall clock and timer queue that only move when a test says so. */
export class FakeClock {
  public nowMs: number;
  private timers: Array<{ id: number; atMs: number; callback: () => void }> = [];
  private nextId = 1;

  constructor(startMs = 1_800_000_000_000) {
    this.nowMs = startMs;
  }

  public now = (): number => this.nowMs;

  public setTimer = (callback: () => void, delayMs: number): unknown => {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.push({ id, atMs: this.nowMs + delayMs, callback });
    return id;
  };

  public clearTimer = (handle: unknown): void => {
    this.timers = this.timers.filter((timer) => timer.id !== handle);
  };

  /** Moves time forward, firing due timers in order at their exact instants. */
  public advance(durationMs: number): void {
    const targetMs = this.nowMs + durationMs;
    for (;;) {
      const due = this.timers
        .filter((timer) => timer.atMs <= targetMs)
        .sort((a, b) => a.atMs - b.atMs || a.id - b.id)[0];
      if (!due) break;
      this.timers = this.timers.filter((timer) => timer !== due);
      this.nowMs = Math.max(this.nowMs, due.atMs);
      due.callback();
    }
    this.nowMs = targetMs;
  }

  public pendingTimers(): number {
    return this.timers.length;
  }

  /** Delays of the timers currently queued, soonest first. */
  public pendingDelays(): number[] {
    return this.timers.map((timer) => timer.atMs - this.nowMs).sort((a, b) => a - b);
  }
}

export class MemoryStorage implements StorageLike {
  public readonly values = new Map<string, string>();
  public failWrites = false;

  public getItem(key: string): string | null {
    return this.values.has(key) ? (this.values.get(key) as string) : null;
  }

  public setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.values.set(key, value);
  }
}

class FakeChannel implements BroadcastChannelLike {
  public onmessage: ((event: { data: unknown }) => void) | null = null;
  public closed = false;

  constructor(
    public readonly name: string,
    private readonly hub: FakeChannelHub
  ) {}

  public postMessage(message: unknown): void {
    if (this.closed) throw new Error('InvalidStateError: channel is closed');
    this.hub.deliver(this, message);
  }

  public close(): void {
    this.closed = true;
    this.hub.remove(this);
  }
}

/**
 * Models BroadcastChannel inside one browser profile: a message reaches every
 * other open channel with the same name, never the sender itself.
 */
export class FakeChannelHub {
  public readonly posted: Array<{ name: string; message: unknown }> = [];
  private channels: FakeChannel[] = [];

  public factory: BroadcastChannelFactory = (name: string) => {
    const channel = new FakeChannel(name, this);
    this.channels.push(channel);
    return channel;
  };

  public deliver(sender: FakeChannel, message: unknown): void {
    this.posted.push({ name: sender.name, message });
    for (const channel of [...this.channels]) {
      if (channel !== sender && channel.name === sender.name && channel.onmessage) {
        channel.onmessage({ data: message });
      }
    }
  }

  /** Injects a message as if some other tab had posted it. */
  public inject(name: string, message: unknown): void {
    for (const channel of [...this.channels]) {
      if (channel.name === name && channel.onmessage) channel.onmessage({ data: message });
    }
  }

  public remove(channel: FakeChannel): void {
    this.channels = this.channels.filter((candidate) => candidate !== channel);
  }

  public openChannelNames(): string[] {
    return this.channels.map((channel) => channel.name);
  }
}

export class FakeSocket implements RelaySocketLike {
  public readyState = 0;
  public bufferedAmount = 0;
  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: unknown }) => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public readonly sent: string[] = [];
  public closedWith: { code?: number; reason?: string } | null = null;

  constructor(public readonly url: string) {}

  public send(data: string): void {
    this.sent.push(data);
  }

  public close(code?: number, reason?: string): void {
    this.closedWith = { code, reason };
    this.readyState = 3;
  }

  /** The server accepted the connection. */
  public serverOpen(): void {
    this.readyState = 1;
    if (this.onopen) this.onopen();
  }

  public serverMessage(data: unknown): void {
    if (this.onmessage) this.onmessage({ data });
  }

  /** The connection dropped (or was never established). */
  public serverClose(): void {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
}

/** Records every socket a transport opens. */
export class FakeSocketFactory {
  public readonly sockets: FakeSocket[] = [];
  public failNext = false;

  public create = (url: string): RelaySocketLike => {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('SecurityError: insecure WebSocket from a secure page');
    }
    const socket = new FakeSocket(url);
    this.sockets.push(socket);
    return socket;
  };

  public latest(): FakeSocket {
    return this.sockets[this.sockets.length - 1];
  }
}

/** Models the Web Locks API shared by every tab of one browser profile. */
export class FakeLockManager {
  private held = new Set<string>();

  public request: DeskLockRequest = (name: string) => {
    if (this.held.has(name)) return Promise.resolve(null);
    this.held.add(name);
    return Promise.resolve(() => {
      this.held.delete(name);
    });
  };

  public heldNames(): string[] {
    return [...this.held].sort();
  }
}

/** Lets promise callbacks (lock grants) run. */
export async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

/** Deterministic bytes for ids; cryptographic strength is irrelevant in tests. */
export function countingBytes(start = 0): (count: number) => Uint8Array {
  let next = start;
  return (count: number) => {
    const bytes = new Uint8Array(count);
    for (let i = 0; i < count; i += 1) {
      bytes[i] = next % 256;
      next += 7;
    }
    return bytes;
  };
}

export interface SessionHarnessOptions {
  clock: FakeClock;
  hub?: FakeChannelHub | null;
  storage?: MemoryStorage | null;
  tabStorage?: MemoryStorage | null;
  sockets?: FakeSocketFactory | null;
  locks?: FakeLockManager | null;
  idSeed?: number;
  hasSecureRandom?: boolean;
}

export function sessionDeps(options: SessionHarnessOptions): CourtLinkSessionDeps {
  return {
    now: options.clock.now,
    storage: options.storage === undefined ? new MemoryStorage() : options.storage,
    tabStorage: options.tabStorage === undefined ? new MemoryStorage() : options.tabStorage,
    randomBytes: countingBytes(options.idSeed ?? 0),
    hasSecureRandom: options.hasSecureRandom ?? true,
    setTimer: options.clock.setTimer,
    clearTimer: options.clock.clearTimer,
    createChannel: options.hub ? options.hub.factory : null,
    createSocket: options.sockets ? options.sockets.create : null,
    requestDeskLock: options.locks ? options.locks.request : null,
  };
}

/** A console mid-match: Q3, 05:42.3 on the game clock, 24.0 on the shot clock. */
export function deskState(overrides: Partial<DeskStateInput> = {}): DeskStateInput {
  return {
    isRunning: false,
    gameTimeMs: 342_300,
    shotTimeMs: 24_000,
    period: 3,
    scoreWhite: 7,
    scoreDark: 6,
    teamWhiteName: 'VANGUARD',
    teamDarkName: 'STANFORD',
    quarterScores: { white: [3, 2, 2, 0, 0, 0, 0], dark: [2, 2, 2, 0, 0, 0, 0] },
    exclusions: [],
    activeTimeout: null,
    timeoutsWhite: { full: 3, short: 1 },
    timeoutsDark: { full: 2, short: 1 },
    isHornActive: false,
    enable20sReset: true,
    protocol: 'cts',
    bleStatus: 'connected',
    cappedOutWhite: [],
    cappedOutDark: [],
    events: [],
    ...overrides,
  };
}

export interface FrameOptions {
  room?: string;
  courtId?: CourtId;
  deskId?: string;
  deskLabel?: string;
  sessionStartedAtMs?: number;
  seq?: number;
  capturedAtMs: number;
  state?: Partial<DeskStateInput>;
}

export const TEST_ROOM = 'TEST-ROOM';

export function snapshotFrame(options: FrameOptions): CourtSnapshotFrame {
  const snapshot = buildCourtSnapshot(deskState(options.state), options.capturedAtMs);
  if (!snapshot) throw new Error('Test fixture produced an invalid snapshot.');
  return {
    v: COURT_LINK_PROTOCOL_VERSION,
    room: options.room ?? TEST_ROOM,
    kind: 'snapshot',
    courtId: options.courtId ?? 'A',
    deskId: options.deskId ?? 'DESKAAAA0001',
    deskLabel: options.deskLabel ?? 'iPad Table 1',
    sessionStartedAtMs: options.sessionStartedAtMs ?? 1_000,
    seq: options.seq ?? 1,
    sentAtMs: options.capturedAtMs,
    snapshot,
  };
}

export function byeFrame(options: Omit<FrameOptions, 'state' | 'capturedAtMs'> & { sentAtMs: number }): CourtFrame {
  return {
    v: COURT_LINK_PROTOCOL_VERSION,
    room: options.room ?? TEST_ROOM,
    kind: 'bye',
    courtId: options.courtId ?? 'A',
    deskId: options.deskId ?? 'DESKAAAA0001',
    sessionStartedAtMs: options.sessionStartedAtMs ?? 1_000,
    seq: options.seq ?? 1,
    sentAtMs: options.sentAtMs,
  };
}
