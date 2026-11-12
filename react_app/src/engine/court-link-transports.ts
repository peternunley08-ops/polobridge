/**
 * PoloBridge & PoloPad Pro — Court Link Transports, Device Config & Invite Links
 * ==============================================================================
 * Two ways for desk frames to reach a Tournament Director screen:
 *
 *  1. BroadcastChannel  same browser on the same device. Zero infrastructure,
 *                       works with no network at all (demo, testing, a laptop
 *                       running several desks in separate tabs).
 *  2. WebSocket relay   different devices on different pools. A tiny fan-out
 *                       relay (see /cloudflare/court-relay) rebroadcasts every
 *                       frame to the other sockets in the same room.
 *
 * Both are best-effort by design. The protocol is state-based — every snapshot
 * is complete — so a dropped frame is repaired by the next heartbeat and no
 * queueing or acknowledgement is needed.
 *
 * The relay watchdog uses the same exponential backoff curve as the BLE GATT
 * watchdog: 500 ms -> 1 s -> 2 s -> 4 s -> 8 s (capped).
 */

import { COURT_IDS, CourtId, DEFAULT_LOCAL_ROOM, ROOM_CODE_ALPHABET, normalizeRoomCode } from './court-link';

// ---------------------------------------------------------------------------
// Shared transport contract
// ---------------------------------------------------------------------------

export type CourtTransportStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'unsupported';

export interface CourtTransportHandlers {
  onMessage: (raw: string) => void;
  onStatus: (status: CourtTransportStatus, detail: string | null) => void;
}

export interface CourtLinkTransport {
  readonly kind: 'broadcast' | 'relay';
  start(): void;
  stop(): void;
  /** False when the frame could not be handed to the link; it is simply dropped. */
  send(raw: string): boolean;
  getStatus(): CourtTransportStatus;
}

// ---------------------------------------------------------------------------
// 1. BroadcastChannel (same device)
// ---------------------------------------------------------------------------

export interface BroadcastChannelLike {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export type BroadcastChannelFactory = (name: string) => BroadcastChannelLike;

export function courtChannelName(room: string): string {
  return `polopad_court_link_v1:${room}`;
}

export function defaultBroadcastChannelFactory(): BroadcastChannelFactory | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return (name: string) => new BroadcastChannel(name) as unknown as BroadcastChannelLike;
}

export class BroadcastChannelTransport implements CourtLinkTransport {
  public readonly kind = 'broadcast' as const;
  private channel: BroadcastChannelLike | null = null;
  private status: CourtTransportStatus = 'idle';

  constructor(
    private readonly room: string,
    private readonly handlers: CourtTransportHandlers,
    private readonly createChannel: BroadcastChannelFactory | null
  ) {}

  public start(): void {
    if (this.channel) return;
    if (!this.createChannel) {
      this.setStatus('unsupported', 'BroadcastChannel is not available in this browser.');
      return;
    }
    try {
      const channel = this.createChannel(courtChannelName(this.room));
      channel.onmessage = (event) => {
        if (typeof event.data === 'string') this.handlers.onMessage(event.data);
      };
      this.channel = channel;
      this.setStatus('open', null);
    } catch (error: unknown) {
      this.setStatus('unsupported', error instanceof Error ? error.message : String(error));
    }
  }

  public stop(): void {
    if (this.channel) {
      this.channel.onmessage = null;
      try {
        this.channel.close();
      } catch {
        // Closing an already-closed channel is harmless.
      }
      this.channel = null;
    }
    this.setStatus('idle', null);
  }

  public send(raw: string): boolean {
    if (!this.channel) return false;
    try {
      this.channel.postMessage(raw);
      return true;
    } catch {
      return false;
    }
  }

  public getStatus(): CourtTransportStatus {
    return this.status;
  }

  private setStatus(status: CourtTransportStatus, detail: string | null): void {
    if (this.status === status) return;
    this.status = status;
    this.handlers.onStatus(status, detail);
  }
}

// ---------------------------------------------------------------------------
// 2. WebSocket relay (cross-device)
// ---------------------------------------------------------------------------

/** The subset of the browser WebSocket this transport relies on. */
export interface RelaySocketLike {
  readonly readyState: number;
  readonly bufferedAmount: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export interface RelayTransportDeps {
  createSocket: (url: string) => RelaySocketLike;
  now: () => number;
  setTimer: (callback: () => void, delayMs: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

const SOCKET_OPEN = 1;

/** Application-level keep-alive; the relay answers without waking its room. */
export const RELAY_PING_TEXT = 'ping';
export const RELAY_PONG_TEXT = 'pong';
export const RELAY_PING_INTERVAL_MS = 5000;
/** Two missed pongs: the socket is half-open (Wi-Fi dropped without a FIN). */
export const RELAY_PONG_TIMEOUT_MS = 12000;
/** A stalled socket must not queue snapshots that will be obsolete on arrival. */
export const RELAY_MAX_BUFFERED_BYTES = 64 * 1024;
export const RELAY_BACKOFF_BASE_MS = 500;
export const RELAY_BACKOFF_CAP_MS = 8000;

/** 500 ms, 1 s, 2 s, 4 s, then 8 s for every later attempt. */
export function relayBackoffDelayMs(attempt: number): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(RELAY_BACKOFF_CAP_MS, RELAY_BACKOFF_BASE_MS * 2 ** Math.min(safeAttempt - 1, 10));
}

export function relaySocketUrl(relayUrl: string, room: string): string {
  return `${relayUrl}/room/${encodeURIComponent(room)}`;
}

export function defaultSocketFactory(): ((url: string) => RelaySocketLike) | null {
  if (typeof WebSocket === 'undefined') return null;
  return (url: string) => new WebSocket(url) as unknown as RelaySocketLike;
}

/**
 * Keeps one WebSocket to the relay alive for as long as it is wanted.
 * A director leaves a dashboard open all day, so it retries forever rather
 * than giving up after a fixed number of attempts.
 */
export class WebSocketRelayTransport implements CourtLinkTransport {
  public readonly kind = 'relay' as const;
  private socket: RelaySocketLike | null = null;
  private status: CourtTransportStatus = 'idle';
  private wanted = false;
  private attempt = 0;
  private reconnectTimer: unknown = null;
  private pingTimer: unknown = null;
  private lastPingAtMs = 0;
  private lastPongAtMs = 0;
  private awaitingPong = false;
  private rttMs: number | null = null;

  constructor(
    private readonly socketUrl: string,
    private readonly handlers: CourtTransportHandlers,
    private readonly deps: RelayTransportDeps
  ) {}

  public start(): void {
    if (this.wanted) return;
    this.wanted = true;
    this.attempt = 0;
    this.connect();
  }

  public stop(): void {
    this.wanted = false;
    this.clearTimers();
    this.dropSocket(1000, 'client stopped');
    this.rttMs = null;
    this.setStatus('idle', null);
  }

  public send(raw: string): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== SOCKET_OPEN) return false;
    if (socket.bufferedAmount > RELAY_MAX_BUFFERED_BYTES) return false;
    try {
      socket.send(raw);
      return true;
    } catch {
      return false;
    }
  }

  public getStatus(): CourtTransportStatus {
    return this.status;
  }

  /** Round-trip time of the last keep-alive, or null before the first pong. */
  public getRttMs(): number | null {
    return this.rttMs;
  }

  public getReconnectAttempt(): number {
    return this.attempt;
  }

  private connect(): void {
    if (!this.wanted) return;
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting', null);

    let socket: RelaySocketLike;
    try {
      socket = this.deps.createSocket(this.socketUrl);
    } catch (error: unknown) {
      this.scheduleReconnect(error instanceof Error ? error.message : String(error));
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.attempt = 0;
      this.lastPongAtMs = this.deps.now();
      this.awaitingPong = false;
      this.setStatus('open', null);
      this.schedulePing();
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket || typeof event.data !== 'string') return;
      if (event.data === RELAY_PONG_TEXT) {
        const now = this.deps.now();
        this.lastPongAtMs = now;
        if (this.awaitingPong) {
          this.awaitingPong = false;
          this.rttMs = Math.max(0, now - this.lastPingAtMs);
        }
        return;
      }
      this.handlers.onMessage(event.data);
    };

    socket.onerror = () => {
      // The close event that always follows carries the recovery.
    };

    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.clearPingTimer();
      if (this.wanted) this.scheduleReconnect('relay connection closed');
    };
  }

  private schedulePing(): void {
    this.clearPingTimer();
    this.pingTimer = this.deps.setTimer(() => {
      this.pingTimer = null;
      const socket = this.socket;
      if (!socket || !this.wanted) return;

      const now = this.deps.now();
      if (now - this.lastPongAtMs > RELAY_PONG_TIMEOUT_MS) {
        // Half-open socket: its own close event may never fire, so recover here.
        this.dropSocket(4000, 'pong timeout');
        this.scheduleReconnect('relay stopped answering');
        return;
      }

      if (socket.readyState === SOCKET_OPEN) {
        try {
          socket.send(RELAY_PING_TEXT);
          this.lastPingAtMs = now;
          this.awaitingPong = true;
        } catch {
          // A failed ping is caught by the pong timeout on a later cycle.
        }
      }
      this.schedulePing();
    }, RELAY_PING_INTERVAL_MS);
  }

  private scheduleReconnect(reason: string): void {
    if (!this.wanted || this.reconnectTimer !== null) return;
    this.attempt += 1;
    const delayMs = relayBackoffDelayMs(this.attempt);
    this.rttMs = null;
    this.setStatus('reconnecting', `${reason}; retry ${this.attempt} in ${delayMs} ms`, true);
    this.reconnectTimer = this.deps.setTimer(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  /** Detaches every handler first so a late event from this socket is ignored. */
  private dropSocket(code: number, reason: string): void {
    const socket = this.socket;
    this.socket = null;
    this.clearPingTimer();
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close(code, reason);
    } catch {
      // Already closed.
    }
  }

  private clearPingTimer(): void {
    if (this.pingTimer !== null) {
      this.deps.clearTimer(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearPingTimer();
    if (this.reconnectTimer !== null) {
      this.deps.clearTimer(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: CourtTransportStatus, detail: string | null, force = false): void {
    if (this.status === status && !force) return;
    this.status = status;
    this.handlers.onStatus(status, detail);
  }
}

// ---------------------------------------------------------------------------
// Relay URL validation
// ---------------------------------------------------------------------------

export type RelayUrlResult = { ok: true; url: string } | { ok: false; error: string };

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Canonicalises what an operator typed into `wss://host[/path]`.
 * An empty string is valid and means "no relay, same-device only".
 *
 * The PWA is served over https, where browsers refuse insecure ws:// to
 * anything but the loopback interface, so that is rejected up front with a
 * message instead of failing silently later.
 */
export function normalizeRelayUrl(input: unknown): RelayUrlResult {
  if (typeof input !== 'string') return { ok: false, error: 'Relay address must be text.' };
  const trimmed = input.trim();
  if (trimmed === '') return { ok: true, url: '' };
  if (trimmed.length > 300) return { ok: false, error: 'Relay address is too long.' };

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `wss://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, error: 'Relay address is not a valid URL.' };
  }

  if (parsed.username !== '' || parsed.password !== '') {
    return { ok: false, error: 'Relay address must not contain a username or password.' };
  }

  const scheme = parsed.protocol === 'https:' ? 'wss:' : parsed.protocol === 'http:' ? 'ws:' : parsed.protocol;
  if (scheme !== 'wss:' && scheme !== 'ws:') {
    return { ok: false, error: 'Relay address must start with wss:// (or https://).' };
  }
  if (scheme === 'ws:' && !LOOPBACK_HOSTS.has(parsed.hostname)) {
    return {
      ok: false,
      error: 'Use a secure wss:// relay. Browsers block insecure ws:// from an https page, except to localhost.',
    };
  }
  if (parsed.host === '') return { ok: false, error: 'Relay address is missing a host name.' };

  const path = parsed.pathname.replace(/\/+$/, '');
  return { ok: true, url: `${scheme}//${parsed.host}${path}` };
}

// ---------------------------------------------------------------------------
// Device configuration (persisted per browser)
// ---------------------------------------------------------------------------

export const COURT_LINK_STORAGE_KEY = 'polopad_pro_court_link_v1';
export const DESK_LABEL_MAX_LENGTH = 32;

export interface CourtLinkConfig {
  /** Tournament room code shared by every desk and dashboard. */
  room: string;
  /** The court this device scores, or null when it only watches. */
  deskCourtId: CourtId | null;
  /** How this device is named on the director's screen. */
  deskLabel: string;
  /** Canonical wss:// relay, or '' for same-device links only. */
  relayUrl: string;
}

export interface StoredCourtLink {
  /** Stable identity of this browser profile; never shown as a secret. */
  deskId: string;
  config: CourtLinkConfig;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DESK_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function createDeskId(randomBytes: (count: number) => Uint8Array): string {
  const bytes = randomBytes(16);
  let id = '';
  for (let i = 0; i < bytes.length; i += 1) id += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  return id;
}

export function defaultDeskLabel(deskId: string): string {
  return `Desk ${deskId.slice(0, 4)}`;
}

function cleanDeskLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim().slice(0, DESK_LABEL_MAX_LENGTH);
  return cleaned === '' ? fallback : cleaned;
}

/** Rebuilds a config from untrusted input, falling back field by field. */
export function sanitizeCourtLinkConfig(raw: unknown, fallback: CourtLinkConfig): CourtLinkConfig {
  if (typeof raw !== 'object' || raw === null) return fallback;
  const record = raw as Record<string, unknown>;

  const room = normalizeRoomCode(record.room) ?? fallback.room;
  const deskCourtId =
    record.deskCourtId === null
      ? null
      : (COURT_IDS as readonly unknown[]).includes(record.deskCourtId)
      ? (record.deskCourtId as CourtId)
      : fallback.deskCourtId;
  const relay = normalizeRelayUrl(record.relayUrl);

  return {
    room,
    deskCourtId,
    deskLabel: cleanDeskLabel(record.deskLabel, fallback.deskLabel),
    relayUrl: relay.ok ? relay.url : fallback.relayUrl,
  };
}

export function loadStoredCourtLink(
  storage: StorageLike | null,
  randomBytes: (count: number) => Uint8Array
): StoredCourtLink {
  let parsed: unknown = null;
  if (storage) {
    try {
      const raw = storage.getItem(COURT_LINK_STORAGE_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  const record = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  const deskId =
    typeof record.deskId === 'string' && DESK_ID_PATTERN.test(record.deskId) ? record.deskId : createDeskId(randomBytes);
  const defaults: CourtLinkConfig = {
    room: DEFAULT_LOCAL_ROOM,
    deskCourtId: null,
    deskLabel: defaultDeskLabel(deskId),
    relayUrl: '',
  };
  return { deskId, config: sanitizeCourtLinkConfig(record.config, defaults) };
}

export function saveStoredCourtLink(storage: StorageLike | null, stored: StoredCourtLink): boolean {
  if (!storage) return false;
  try {
    storage.setItem(COURT_LINK_STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    // Private browsing or a full quota: the link still works for this page load.
    return false;
  }
}

// ---------------------------------------------------------------------------
// Invite links
// ---------------------------------------------------------------------------

export interface CourtInvite {
  room: string;
  /** null invites a second dashboard rather than a desk. */
  courtId: CourtId | null;
  relayUrl: string;
}

const INVITE_ROOM_PARAM = 'pp-room';
const INVITE_COURT_PARAM = 'pp-court';
const INVITE_RELAY_PARAM = 'pp-relay';

/**
 * Encodes an invite in the URL fragment. A fragment is never sent to the web
 * server, so the room code stays out of hosting logs and referrer headers.
 */
export function buildInviteHash(invite: CourtInvite): string {
  const params = new URLSearchParams();
  params.set(INVITE_ROOM_PARAM, invite.room);
  if (invite.courtId) params.set(INVITE_COURT_PARAM, invite.courtId);
  if (invite.relayUrl) params.set(INVITE_RELAY_PARAM, invite.relayUrl);
  return `#${params.toString()}`;
}

/** Returns null unless every field present in the fragment is valid. */
export function parseInviteHash(hash: unknown): CourtInvite | null {
  if (typeof hash !== 'string' || hash.length < 2 || hash.length > 600) return null;
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

  const room = normalizeRoomCode(params.get(INVITE_ROOM_PARAM));
  if (!room) return null;

  let courtId: CourtId | null = null;
  const courtParam = params.get(INVITE_COURT_PARAM);
  if (courtParam !== null) {
    const upper = courtParam.toUpperCase();
    if (!(COURT_IDS as readonly string[]).includes(upper)) return null;
    courtId = upper as CourtId;
  }

  let relayUrl = '';
  const relayParam = params.get(INVITE_RELAY_PARAM);
  if (relayParam !== null) {
    const relay = normalizeRelayUrl(relayParam);
    if (!relay.ok) return null;
    relayUrl = relay.url;
  }

  return { room, courtId, relayUrl };
}
