/**
 * PoloBridge & PoloPad Pro — Court Link Session
 * ==============================================
 * The one object the UI talks to. It owns this device's link configuration,
 * keeps the transports alive, runs the desk publisher and feeds the director's
 * court directory.
 *
 * Roles are not exclusive: a device can score Court B and show the four-court
 * dashboard at the same time. Its own frames are ingested locally, so its own
 * court appears on its own dashboard.
 *
 * Transports only run while they are needed — when this device is publishing a
 * court or a dashboard is on screen — so a single-desk school never opens a
 * channel or a socket.
 *
 * Every browser dependency is injected, which lets the whole session run under
 * a fake clock in the test suite.
 */

import {
  COURT_IDS,
  COURT_LINK_PROTOCOL_VERSION,
  CourtAlert,
  CourtDirectory,
  CourtFrame,
  CourtId,
  CourtPublisher,
  CourtView,
  DeskStateInput,
  FrameRejectReason,
  encodeCourtFrame,
  generateRoomCode,
  normalizeRoomCode,
  parseCourtFrame,
} from './court-link';
import {
  BroadcastChannelFactory,
  BroadcastChannelTransport,
  COURT_LINK_STORAGE_KEY,
  CourtInvite,
  CourtLinkConfig,
  CourtTransportStatus,
  RelaySocketLike,
  StorageLike,
  StoredCourtLink,
  WebSocketRelayTransport,
  buildInviteHash,
  defaultBroadcastChannelFactory,
  defaultSocketFactory,
  loadStoredCourtLink,
  normalizeRelayUrl,
  relaySocketUrl,
  sanitizeCourtLinkConfig,
  saveStoredCourtLink,
} from './court-link-transports';
import { CourtSimulator } from './court-simulator';

export const SESSION_TICK_MS = 250;
export const MAX_RECENT_ALERTS = 30;
/** The simulator's private room; it is never opened on any transport. */
export const DEMO_ROOM = 'DEMO-COURTS';
/** Per-tab memory of the court this tab scores (survives a reload of the tab). */
export const COURT_LINK_TAB_STORAGE_KEY = `${COURT_LINK_STORAGE_KEY}:tab-court`;

/**
 * Asks the browser for exclusive ownership of one court on this device.
 * Resolves to a release function, or null when another tab already holds it.
 */
export type DeskLockRequest = (name: string) => Promise<(() => void) | null>;

export interface CourtLinkSessionDeps {
  now: () => number;
  /** Shared by every tab of this browser profile. */
  storage: StorageLike | null;
  /** Private to this tab; remembers which court this tab scores. */
  tabStorage: StorageLike | null;
  randomBytes: (count: number) => Uint8Array;
  /** False when `randomBytes` is not cryptographically secure. */
  hasSecureRandom: boolean;
  setTimer: (callback: () => void, delayMs: number) => unknown;
  clearTimer: (handle: unknown) => void;
  createChannel: BroadcastChannelFactory | null;
  createSocket: ((url: string) => RelaySocketLike) | null;
  /** null when the Web Locks API is unavailable (no cross-tab guard). */
  requestDeskLock: DeskLockRequest | null;
}

/**
 * - off        this device is not scoring a court
 * - acquiring  waiting for the browser to grant the court to this tab
 * - publishing this tab owns the court and is transmitting
 * - blocked    another tab of this browser is already publishing that court
 */
export type DeskSlotState = 'off' | 'acquiring' | 'publishing' | 'blocked';

export interface CourtLinkStatus {
  config: CourtLinkConfig;
  deskId: string;
  deskSlot: DeskSlotState;
  /** True while transports are running (publishing or a dashboard is open). */
  isLinkActive: boolean;
  localStatus: CourtTransportStatus;
  /** 'idle' when no relay is configured. */
  relayStatus: CourtTransportStatus;
  relayDetail: string | null;
  isDemoMode: boolean;
  /** Set when an invite link configured this device, until dismissed. */
  appliedInvite: CourtInvite | null;
}

/** Fast-changing counters, polled by the dashboard instead of pushed. */
export interface CourtLinkDiagnostics {
  framesSent: number;
  framesReceived: number;
  framesRejected: number;
  lastRejectReason: FrameRejectReason | null;
  lastSentAtMs: number | null;
  relayRttMs: number | null;
  relayReconnectAttempt: number;
}

export type ConfigUpdateResult = { ok: true } | { ok: false; error: string };

function deskLockName(room: string, courtId: CourtId): string {
  return `polopad-court-desk:${room}:${courtId}`;
}

export class CourtLinkSession {
  private stored: StoredCourtLink;
  private readonly sessionStartedAtMs: number;
  private seq = 0;

  private readonly directory = new CourtDirectory();
  private readonly demoDirectory = new CourtDirectory();
  private simulator: CourtSimulator | null = null;

  private publisher: CourtPublisher | null = null;
  private publisherKey = '';
  private latestDeskState: DeskStateInput | null = null;

  private deskSlot: DeskSlotState = 'off';
  private lockName = '';
  private lockRequestToken = 0;
  private releaseLock: (() => void) | null = null;

  private local: BroadcastChannelTransport | null = null;
  private relay: WebSocketRelayTransport | null = null;
  private transportKey = '';
  private relayDetail: string | null = null;

  private watchers = 0;
  private tickTimer: unknown = null;
  private disposed = false;

  private framesSent = 0;
  private framesReceived = 0;
  private framesRejected = 0;
  private lastRejectReason: FrameRejectReason | null = null;

  private appliedInvite: CourtInvite | null = null;
  private recentAlerts: CourtAlert[] = [];
  private status: CourtLinkStatus;
  private readonly changeListeners = new Set<() => void>();
  private readonly alertListeners = new Set<(alert: CourtAlert) => void>();

  constructor(private readonly deps: CourtLinkSessionDeps) {
    this.stored = loadStoredCourtLink(deps.storage, deps.randomBytes);
    this.stored.config.deskCourtId = this.readTabCourt(this.stored.config.deskCourtId);
    this.sessionStartedAtMs = deps.now();
    this.status = this.buildStatus();
    this.reconcile();
  }

  // -------------------------------------------------------------------------
  // Reading state
  // -------------------------------------------------------------------------

  /** Stable reference until something changes (safe for useSyncExternalStore). */
  public getStatus = (): CourtLinkStatus => this.status;

  public subscribe = (listener: () => void): (() => void) => {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  };

  public onAlert(listener: (alert: CourtAlert) => void): () => void {
    this.alertListeners.add(listener);
    return () => {
      this.alertListeners.delete(listener);
    };
  }

  /** Newest first. */
  public getRecentAlerts(): CourtAlert[] {
    return this.recentAlerts;
  }

  public getCourtViews(nowMs: number = this.deps.now()): CourtView[] {
    return (this.simulator ? this.demoDirectory : this.directory).getViews(nowMs);
  }

  public getDiagnostics(): CourtLinkDiagnostics {
    return {
      framesSent: this.framesSent,
      framesReceived: this.framesReceived,
      framesRejected: this.framesRejected,
      lastRejectReason: this.lastRejectReason,
      lastSentAtMs: this.publisher ? this.publisher.getLastSentAtMs() : null,
      relayRttMs: this.relay ? this.relay.getRttMs() : null,
      relayReconnectAttempt: this.relay ? this.relay.getReconnectAttempt() : 0,
    };
  }

  // -------------------------------------------------------------------------
  // Dashboard lifetime
  // -------------------------------------------------------------------------

  /** Call while a dashboard is on screen; the returned function releases it. */
  public watch(): () => void {
    this.watchers += 1;
    const wasActive = this.transportKey !== '';
    this.reconcile();
    // Transports that were already open will not re-announce on their own.
    if (wasActive) this.sendSyncRequest();
    this.refreshStatus();

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.watchers = Math.max(0, this.watchers - 1);
      this.reconcile();
      this.refreshStatus();
    };
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  public updateConfig(patch: Partial<CourtLinkConfig>): ConfigUpdateResult {
    const current = this.stored.config;
    const next: CourtLinkConfig = { ...current };

    if (patch.room !== undefined) {
      const room = normalizeRoomCode(patch.room);
      if (!room) return { ok: false, error: 'Room code must be 6–24 letters, digits or dashes.' };
      next.room = room;
    }
    if (patch.relayUrl !== undefined) {
      const relay = normalizeRelayUrl(patch.relayUrl);
      if (!relay.ok) return { ok: false, error: relay.error };
      next.relayUrl = relay.url;
    }
    if (patch.deskCourtId !== undefined) {
      if (patch.deskCourtId !== null && !(COURT_IDS as readonly unknown[]).includes(patch.deskCourtId)) {
        return { ok: false, error: 'Court must be A, B, C or D.' };
      }
      next.deskCourtId = patch.deskCourtId;
    }
    if (patch.deskLabel !== undefined) {
      next.deskLabel = sanitizeCourtLinkConfig({ ...next, deskLabel: patch.deskLabel }, next).deskLabel;
    }

    const roomChanged = next.room !== current.room;
    const courtChanged = next.deskCourtId !== current.deskCourtId;
    const unchanged =
      !roomChanged && !courtChanged && next.relayUrl === current.relayUrl && next.deskLabel === current.deskLabel;
    if (unchanged) return { ok: true };

    // Sign off the old court while the old transports are still up.
    if (this.publisher && (roomChanged || courtChanged)) this.publisher.bye();

    this.stored = { deskId: this.stored.deskId, config: next };
    saveStoredCourtLink(this.deps.storage, this.stored);
    this.writeTabCourt(next.deskCourtId);
    if (roomChanged) this.directory.reset();

    this.reconcile();
    this.refreshStatus();
    return { ok: true };
  }

  /** Switches this device to a freshly generated, unguessable room. */
  public createRoom(): ConfigUpdateResult {
    if (!this.deps.hasSecureRandom) {
      return { ok: false, error: 'This browser cannot generate a secure room code. Type one in instead.' };
    }
    return this.updateConfig({ room: generateRoomCode(this.deps.randomBytes) });
  }

  public applyInvite(invite: CourtInvite): ConfigUpdateResult {
    const patch: Partial<CourtLinkConfig> = { room: invite.room };
    // A dashboard invite (no court) must not stop a desk that is already scoring.
    if (invite.courtId) patch.deskCourtId = invite.courtId;
    if (invite.relayUrl) patch.relayUrl = invite.relayUrl;
    const result = this.updateConfig(patch);
    if (result.ok) {
      this.appliedInvite = invite;
      this.refreshStatus();
    }
    return result;
  }

  public dismissInviteNotice(): void {
    if (!this.appliedInvite) return;
    this.appliedInvite = null;
    this.refreshStatus();
  }

  /** `baseUrl` is the app's own address without a fragment. */
  public buildInviteLink(baseUrl: string, courtId: CourtId | null): string {
    const { room, relayUrl } = this.stored.config;
    return `${baseUrl}${buildInviteHash({ room, courtId, relayUrl })}`;
  }

  /** Try again to publish from this tab after another tab was closed. */
  public retryDeskSlot(): void {
    if (this.deskSlot !== 'blocked') return;
    this.lockName = '';
    this.reconcile();
    this.refreshStatus();
  }

  // -------------------------------------------------------------------------
  // Desk publishing
  // -------------------------------------------------------------------------

  /** Feed the console's state on every change; a no-op unless publishing. */
  public publishDeskState(input: DeskStateInput): void {
    this.latestDeskState = input;
    if (this.publisher) this.publisher.update(input);
  }

  /** The page is going away: tell dashboards so they do not wait for a timeout. */
  public handlePageHide(): void {
    if (this.publisher) this.publisher.bye();
  }

  // -------------------------------------------------------------------------
  // Director actions
  // -------------------------------------------------------------------------

  public setDemoMode(enabled: boolean): void {
    if (enabled === (this.simulator !== null)) return;
    if (enabled) {
      this.demoDirectory.reset();
      this.simulator = new CourtSimulator({
        room: DEMO_ROOM,
        now: this.deps.now,
        // Through the real codec, so the demo exercises the same path as a desk.
        deliver: (frame) => {
          const parsed = parseCourtFrame(encodeCourtFrame(frame), DEMO_ROOM);
          if (parsed.ok) this.emitAlerts(this.demoDirectory.ingest(parsed.frame, this.deps.now()).alerts);
        },
      });
    } else {
      this.simulator = null;
      this.demoDirectory.reset();
    }
    this.reconcile();
    this.refreshStatus();
  }

  /** Dismiss a finished or abandoned court tile. */
  public clearCourt(courtId: CourtId): void {
    (this.simulator ? this.demoDirectory : this.directory).clear(courtId);
    this.notifyChange();
  }

  public dispose(): void {
    this.disposed = true;
    this.simulator = null;
    this.dropPublisher();
    this.releaseDeskLock();
    this.stopTransports();
    if (this.tickTimer !== null) {
      this.deps.clearTimer(this.tickTimer);
      this.tickTimer = null;
    }
    this.changeListeners.clear();
    this.alertListeners.clear();
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private nextSeq = (): number => {
    this.seq += 1;
    return this.seq;
  };

  private readTabCourt(fallback: CourtId | null): CourtId | null {
    const tabStorage = this.deps.tabStorage;
    if (!tabStorage) return fallback;
    try {
      const raw = tabStorage.getItem(COURT_LINK_TAB_STORAGE_KEY);
      if (raw === null) return fallback;
      if (raw === 'none') return null;
      return (COURT_IDS as readonly string[]).includes(raw) ? (raw as CourtId) : fallback;
    } catch {
      return fallback;
    }
  }

  private writeTabCourt(courtId: CourtId | null): void {
    const tabStorage = this.deps.tabStorage;
    if (!tabStorage) return;
    try {
      tabStorage.setItem(COURT_LINK_TAB_STORAGE_KEY, courtId ?? 'none');
    } catch {
      // Private browsing: this tab simply forgets its court on reload.
    }
  }

  /** Brings transports, the desk lock and the publisher in line with the config. */
  private reconcile(): void {
    if (this.disposed) return;
    const { room, relayUrl, deskCourtId } = this.stored.config;
    const wantLink = deskCourtId !== null || this.watchers > 0;

    const transportKey = wantLink ? `${room}|${relayUrl}` : '';
    if (transportKey !== this.transportKey) {
      this.stopTransports();
      this.transportKey = transportKey;
      if (wantLink) this.startTransports(room, relayUrl);
    }

    const lockName = deskCourtId !== null ? deskLockName(room, deskCourtId) : '';
    if (lockName !== this.lockName) {
      this.dropPublisher();
      this.releaseDeskLock();
      this.lockName = lockName;
      if (lockName === '') {
        this.deskSlot = 'off';
      } else {
        this.acquireDeskLock(lockName);
      }
    }

    this.syncPublisher();
    this.setTicking(wantLink || this.simulator !== null);
  }

  private acquireDeskLock(lockName: string): void {
    const request = this.deps.requestDeskLock;
    if (!request) {
      // No Web Locks: publish anyway; the director still flags duplicate desks.
      this.deskSlot = 'publishing';
      return;
    }

    this.deskSlot = 'acquiring';
    this.lockRequestToken += 1;
    const token = this.lockRequestToken;
    request(lockName)
      .then((release) => {
        const stillWanted = !this.disposed && token === this.lockRequestToken && this.lockName === lockName;
        if (!stillWanted) {
          if (release) release();
          return;
        }
        if (release) {
          this.releaseLock = release;
          this.deskSlot = 'publishing';
          this.syncPublisher();
        } else {
          this.deskSlot = 'blocked';
        }
        this.refreshStatus();
      })
      .catch(() => {
        if (this.disposed || token !== this.lockRequestToken) return;
        // A lock manager that fails must not silence the desk.
        this.deskSlot = 'publishing';
        this.syncPublisher();
        this.refreshStatus();
      });
  }

  private releaseDeskLock(): void {
    this.lockRequestToken += 1;
    if (this.releaseLock) {
      this.releaseLock();
      this.releaseLock = null;
    }
  }

  private syncPublisher(): void {
    const { room, deskCourtId, deskLabel } = this.stored.config;
    const publisherKey =
      deskCourtId !== null && this.deskSlot === 'publishing' ? `${room}|${deskCourtId}|${deskLabel}` : '';
    if (publisherKey === this.publisherKey) return;

    this.publisherKey = publisherKey;
    if (publisherKey === '' || deskCourtId === null) {
      this.publisher = null;
      return;
    }
    this.publisher = new CourtPublisher({
      room,
      courtId: deskCourtId,
      deskId: this.stored.deskId,
      deskLabel,
      sessionStartedAtMs: this.sessionStartedAtMs,
      now: this.deps.now,
      nextSeq: this.nextSeq,
      send: this.broadcast,
    });
    if (this.latestDeskState) this.publisher.update(this.latestDeskState);
  }

  private dropPublisher(): void {
    this.publisher = null;
    this.publisherKey = '';
  }

  private startTransports(room: string, relayUrl: string): void {
    this.local = new BroadcastChannelTransport(
      room,
      {
        onMessage: this.handleRaw,
        onStatus: (status) => {
          if (status === 'open') this.announce();
          this.refreshStatus();
        },
      },
      this.deps.createChannel
    );
    this.local.start();

    if (relayUrl !== '' && this.deps.createSocket) {
      this.relay = new WebSocketRelayTransport(
        relaySocketUrl(relayUrl, room),
        {
          onMessage: this.handleRaw,
          onStatus: (status, detail) => {
            this.relayDetail = detail;
            if (status === 'open') this.announce();
            this.refreshStatus();
          },
        },
        {
          createSocket: this.deps.createSocket,
          now: this.deps.now,
          setTimer: this.deps.setTimer,
          clearTimer: this.deps.clearTimer,
        }
      );
      this.relay.start();
    }
  }

  private stopTransports(): void {
    if (this.local) {
      this.local.stop();
      this.local = null;
    }
    if (this.relay) {
      this.relay.stop();
      this.relay = null;
    }
    this.relayDetail = null;
    this.transportKey = '';
  }

  /** A link just came up: make sure both sides learn the current state at once. */
  private announce(): void {
    if (this.publisher) this.publisher.flush();
    if (this.watchers > 0) this.sendSyncRequest();
  }

  private sendSyncRequest(): void {
    this.broadcast({
      v: COURT_LINK_PROTOCOL_VERSION,
      room: this.stored.config.room,
      deskId: this.stored.deskId,
      sessionStartedAtMs: this.sessionStartedAtMs,
      seq: this.nextSeq(),
      sentAtMs: this.deps.now(),
      kind: 'sync-request',
    });
  }

  private broadcast = (frame: CourtFrame): void => {
    const raw = encodeCourtFrame(frame);
    if (this.local) this.local.send(raw);
    if (this.relay) this.relay.send(raw);
    if (frame.kind === 'sync-request') return;

    this.framesSent += 1;
    // Our own court belongs on our own dashboard too.
    this.ingest(frame);
  };

  private handleRaw = (raw: string): void => {
    const parsed = parseCourtFrame(raw, this.stored.config.room);
    if (!parsed.ok) {
      this.framesRejected += 1;
      this.lastRejectReason = parsed.reason;
      return;
    }
    this.framesReceived += 1;
    if (parsed.frame.kind === 'sync-request') {
      if (this.publisher) this.publisher.flush();
      return;
    }
    this.ingest(parsed.frame);
  };

  private ingest(frame: CourtFrame): void {
    const result = this.directory.ingest(frame, this.deps.now());
    // While the demo is on screen, real alerts stay silent (data keeps updating).
    if (!this.simulator) this.emitAlerts(result.alerts);
  }

  private setTicking(wanted: boolean): void {
    if (wanted && this.tickTimer === null) {
      this.tickTimer = this.deps.setTimer(this.tick, SESSION_TICK_MS);
    } else if (!wanted && this.tickTimer !== null) {
      this.deps.clearTimer(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private tick = (): void => {
    this.tickTimer = null;
    if (this.disposed) return;
    const now = this.deps.now();

    if (this.publisher) this.publisher.tick();
    const realAlerts = this.directory.sweep(now);
    if (this.simulator) {
      this.simulator.advance(now);
      this.emitAlerts(this.demoDirectory.sweep(now));
    } else {
      this.emitAlerts(realAlerts);
    }

    const { deskCourtId } = this.stored.config;
    this.setTicking(deskCourtId !== null || this.watchers > 0 || this.simulator !== null);
  };

  private emitAlerts(alerts: CourtAlert[]): void {
    if (alerts.length === 0) return;
    this.recentAlerts = [...alerts.slice().reverse(), ...this.recentAlerts].slice(0, MAX_RECENT_ALERTS);
    for (const alert of alerts) {
      for (const listener of this.alertListeners) listener(alert);
    }
    this.notifyChange();
  }

  private buildStatus(): CourtLinkStatus {
    return {
      config: this.stored.config,
      deskId: this.stored.deskId,
      deskSlot: this.deskSlot,
      isLinkActive: this.transportKey !== '',
      localStatus: this.local ? this.local.getStatus() : 'idle',
      relayStatus: this.relay ? this.relay.getStatus() : 'idle',
      relayDetail: this.relayDetail,
      isDemoMode: this.simulator !== null,
      appliedInvite: this.appliedInvite,
    };
  }

  private refreshStatus(): void {
    this.status = this.buildStatus();
    this.notifyChange();
  }

  private notifyChange(): void {
    for (const listener of this.changeListeners) listener();
  }
}

// ---------------------------------------------------------------------------
// Browser wiring
// ---------------------------------------------------------------------------

function safeStorage(read: () => Storage): StorageLike | null {
  try {
    // Merely touching these throws when the browser blocks storage.
    return read();
  } catch {
    return null;
  }
}

function browserDeskLock(): DeskLockRequest | null {
  if (typeof navigator === 'undefined' || !('locks' in navigator) || !navigator.locks) return null;
  const locks = navigator.locks;
  return (name: string) =>
    new Promise<(() => void) | null>((resolve) => {
      locks
        .request(name, { ifAvailable: true }, (lock) => {
          if (!lock) {
            resolve(null);
            return undefined;
          }
          // Holding the lock for as long as this promise stays pending.
          return new Promise<void>((release) => resolve(() => release()));
        })
        .catch(() => resolve(null));
    });
}

export function createBrowserCourtLinkDeps(): CourtLinkSessionDeps {
  const hasWindow = typeof window !== 'undefined';
  const secureCrypto =
    typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function' ? crypto : null;

  return {
    now: () => Date.now(),
    storage: hasWindow ? safeStorage(() => window.localStorage) : null,
    tabStorage: hasWindow ? safeStorage(() => window.sessionStorage) : null,
    randomBytes: (count: number) => {
      const bytes = new Uint8Array(count);
      if (secureCrypto) {
        secureCrypto.getRandomValues(bytes);
      } else {
        for (let i = 0; i < count; i += 1) bytes[i] = Math.floor(Math.random() * 256);
      }
      return bytes;
    },
    hasSecureRandom: secureCrypto !== null,
    setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    createChannel: defaultBroadcastChannelFactory(),
    createSocket: defaultSocketFactory(),
    requestDeskLock: browserDeskLock(),
  };
}

export const courtLinkSession = new CourtLinkSession(createBrowserCourtLinkDeps());

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => courtLinkSession.handlePageHide());
}
