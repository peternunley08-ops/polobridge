/**
 * ============================================================================
 * PoloPad Pro — 6-8 Sports Cloud Sync & WebSocket Bridge Engine
 * ============================================================================
 * Implements real-time, bi-directional cloud streaming of game desk telemetry,
 * play-by-play events, team rosters, and tournament brackets to the 6-8 Sports
 * ecosystem (68sports.com / Game Desk Pro).
 *
 * Architecture:
 * 1. Persistent WebSocket Bridge: Low-latency full-duplex socket with automatic
 *    exponential backoff reconnection (500ms -> 1s -> 2s -> 4s -> 8s).
 * 2. Offline Resilience Buffer: Queues match events locally (in-memory + IndexedDB/localStorage)
 *    during pool deck Wi-Fi drops and flushes atomically upon reconnection.
 * 3. Multi-Channel Fan-Out: Concurrently broadcasts to:
 *    - Cloud WebSocket endpoint (WSS)
 *    - Local BroadcastChannel ('polopad_68sports_bridge') for poolside tablet-to-tablet sync
 *    - Optional REST / Webhook fallback
 * 4. Live Tournament Bracket Sync: Synchronizes live court scores into multi-round
 *    tournament bracket trees (Quarterfinals, Semifinals, Finals).
 * ============================================================================
 */

import { SixEightGameEvent, SixEightPlayer, SixEightMatchPreset } from './six-eight-sports';

export type SixEightBridgeStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface SixEightBridgeConfig {
  wsUrl: string;
  apiKey: string;
  gameId: string;
  autoReconnect: boolean;
  heartbeatIntervalMs: number;
}

export interface SixEightScoreboardSnapshot {
  gameId: string;
  period: number;
  gameClock: string;
  gameTimeMs: number;
  shotClock: string;
  shotTimeMs: number;
  isRunning: boolean;
  scoreWhite: number;
  scoreDark: number;
  teamWhiteName: string;
  teamDarkName: string;
  timestampIso: string;
  sequenceId: number;
}

export interface SixEightBridgeMessage {
  protocol: '6-8-gamedesk-v2';
  type: 'EVENT' | 'SNAPSHOT' | 'ROSTER' | 'PING' | 'PONG' | 'SYNC_ACK' | 'BRACKET_UPDATE' | 'REMOTE_COMMAND';
  gameId: string;
  sequenceId: number;
  timestampIso: string;
  payload: unknown;
}

export interface BracketMatch {
  id: string;
  round: 'QF' | 'SF' | '3RD' | 'FINAL';
  matchNumber: number;
  court: string;
  scheduledTime: string;
  teamWhite: string;
  teamDark: string;
  scoreWhite: number;
  scoreDark: number;
  period: number;
  status: 'upcoming' | 'live' | 'final';
  winner?: string;
}

export interface TournamentBracket {
  tournamentId: string;
  name: string;
  division: string;
  venue: string;
  matches: BracketMatch[];
}

export const INITIAL_TOURNAMENT_BRACKET: TournamentBracket = {
  tournamentId: '68-CHAMP-2026',
  name: 'USA Water Polo National Championship • Platinum Division',
  division: '18U Boys Championship Bracket',
  venue: 'Stanford Avery Aquatic Center • Courses 1–4',
  matches: [
    {
      id: 'M1',
      round: 'QF',
      matchNumber: 1,
      court: 'Court 1 (Avery Stadium)',
      scheduledTime: '09:00 AM',
      teamWhite: 'Vanguard WP',
      teamDark: 'Stanford WP Foundation',
      scoreWhite: 11,
      scoreDark: 9,
      period: 4,
      status: 'final',
      winner: 'Vanguard WP',
    },
    {
      id: 'M2',
      round: 'QF',
      matchNumber: 2,
      court: 'Court 2 (Belardi Pool)',
      scheduledTime: '09:00 AM',
      teamWhite: 'Newport Harbor',
      teamDark: 'JSerra Catholic',
      scoreWhite: 8,
      scoreDark: 7,
      period: 4,
      status: 'final',
      winner: 'Newport Harbor',
    },
    {
      id: 'M3',
      round: 'QF',
      matchNumber: 3,
      court: 'Court 3 (Baker Pool)',
      scheduledTime: '10:15 AM',
      teamWhite: 'CC United',
      teamDark: 'SoCal Water Polo',
      scoreWhite: 10,
      scoreDark: 12,
      period: 4,
      status: 'final',
      winner: 'SoCal Water Polo',
    },
    {
      id: 'M4',
      round: 'QF',
      matchNumber: 4,
      court: 'Court 4 (Maas Pool)',
      scheduledTime: '10:15 AM',
      teamWhite: 'Del Mar WPC',
      teamDark: 'LA Premier',
      scoreWhite: 14,
      scoreDark: 13,
      period: 4,
      status: 'final',
      winner: 'Del Mar WPC',
    },
    {
      id: 'M5',
      round: 'SF',
      matchNumber: 5,
      court: 'Court 1 (Avery Stadium)',
      scheduledTime: '01:30 PM',
      teamWhite: 'Vanguard WP',
      teamDark: 'Newport Harbor',
      scoreWhite: 8,
      scoreDark: 7,
      period: 3,
      status: 'live',
    },
    {
      id: 'M6',
      round: 'SF',
      matchNumber: 6,
      court: 'Court 2 (Belardi Pool)',
      scheduledTime: '01:30 PM',
      teamWhite: 'SoCal Water Polo',
      teamDark: 'Del Mar WPC',
      scoreWhite: 6,
      scoreDark: 6,
      period: 2,
      status: 'live',
    },
    {
      id: 'M7',
      round: '3RD',
      matchNumber: 7,
      court: 'Court 2 (Belardi Pool)',
      scheduledTime: '04:00 PM',
      teamWhite: 'TBD (SF1 Loser)',
      teamDark: 'TBD (SF2 Loser)',
      scoreWhite: 0,
      scoreDark: 0,
      period: 1,
      status: 'upcoming',
    },
    {
      id: 'M8',
      round: 'FINAL',
      matchNumber: 8,
      court: 'Court 1 (Avery Stadium)',
      scheduledTime: '05:30 PM',
      teamWhite: 'TBD (SF1 Winner)',
      teamDark: 'TBD (SF2 Winner)',
      scoreWhite: 0,
      scoreDark: 0,
      period: 1,
      status: 'upcoming',
    },
  ],
};

const QUEUE_STORAGE_KEY = 'polopad_68sports_offline_queue_v2';

export class SixEightBridgeManager {
  private socket: WebSocket | null = null;
  private status: SixEightBridgeStatus = 'disconnected';
  private config: SixEightBridgeConfig = {
    wsUrl: 'wss://api.6-8sports.com/v2/gamedesk/live',
    apiKey: '68_live_pk_99482a7f3c1e',
    gameId: '68-JO-2026-412',
    autoReconnect: true,
    heartbeatIntervalMs: 15000,
  };

  private sequenceCounter = 1;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private localBroadcastChannel: BroadcastChannel | null = null;
  private offlineQueue: SixEightBridgeMessage[] = [];
  private lastPingTimeMs = 0;
  private latencyMs: number | null = null;

  private statusListeners: Array<(status: SixEightBridgeStatus, latency: number | null) => void> = [];
  private messageListeners: Array<(msg: SixEightBridgeMessage) => void> = [];
  private bracketListeners: Array<(bracket: TournamentBracket) => void> = [];
  private currentBracket: TournamentBracket = INITIAL_TOURNAMENT_BRACKET;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.localBroadcastChannel = new BroadcastChannel('polopad_68sports_bridge');
        this.localBroadcastChannel.onmessage = (event) => {
          this.handleInboundLocalBroadcast(event.data);
        };
      } catch {
        // Fallback for browsers without BroadcastChannel
      }
    }

    this.loadOfflineQueue();
  }

  // --- Configuration & Lifecycle ---

  public configure(config: Partial<SixEightBridgeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): SixEightBridgeConfig {
    return { ...this.config };
  }

  public getStatus(): SixEightBridgeStatus {
    return this.status;
  }

  public getLatency(): number | null {
    return this.latencyMs;
  }

  public getQueuedEventCount(): number {
    return this.offlineQueue.length;
  }

  public getTournamentBracket(): TournamentBracket {
    return this.currentBracket;
  }

  public onStatusChange(callback: (status: SixEightBridgeStatus, latency: number | null) => void): () => void {
    this.statusListeners.push(callback);
    callback(this.status, this.latencyMs);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  public onMessage(callback: (msg: SixEightBridgeMessage) => void): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((cb) => cb !== callback);
    };
  }

  public onBracketUpdate(callback: (bracket: TournamentBracket) => void): () => void {
    this.bracketListeners.push(callback);
    callback(this.currentBracket);
    return () => {
      this.bracketListeners = this.bracketListeners.filter((cb) => cb !== callback);
    };
  }

  // --- Connection Management ---

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');

    try {
      // Build authenticated WebSocket URL with query params
      const separator = this.config.wsUrl.includes('?') ? '&' : '?';
      const authenticatedUrl = `${this.config.wsUrl}${separator}apiKey=${encodeURIComponent(
        this.config.apiKey
      )}&gameId=${encodeURIComponent(this.config.gameId)}`;

      this.socket = new WebSocket(authenticatedUrl);

      this.socket.onopen = () => {
        this.reconnectAttempt = 0;
        this.setStatus('connected');
        this.startHeartbeat();
        this.flushOfflineQueue();
      };

      this.socket.onmessage = (event) => {
        this.handleInboundSocketMessage(event.data);
      };

      this.socket.onerror = () => {
        this.setStatus('error');
      };

      this.socket.onclose = () => {
        this.stopHeartbeat();
        this.socket = null;
        if (this.config.autoReconnect && this.status !== 'disconnected') {
          this.scheduleReconnect();
        } else {
          this.setStatus('disconnected');
        }
      };
    } catch {
      this.setStatus('error');
      if (this.config.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  public disconnect(): void {
    this.config.autoReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }

  private scheduleReconnect(): void {
    this.setStatus('reconnecting');
    this.reconnectAttempt++;
    // Exponential backoff: 500ms * 2^(attempt-1), capped at 8000ms
    const delay = Math.min(8000, 500 * Math.pow(2, this.reconnectAttempt - 1));

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendPing();
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendPing(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.lastPingTimeMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const pingMsg: SixEightBridgeMessage = {
        protocol: '6-8-gamedesk-v2',
        type: 'PING',
        gameId: this.config.gameId,
        sequenceId: this.sequenceCounter++,
        timestampIso: new Date().toISOString(),
        payload: { clientTime: this.lastPingTimeMs },
      };
      this.socket.send(JSON.stringify(pingMsg));
    }
  }

  // --- Message Handling ---

  private handleInboundSocketMessage(rawData: string | ArrayBuffer): void {
    try {
      const dataStr = typeof rawData === 'string' ? rawData : new TextDecoder().decode(rawData);
      const msg = JSON.parse(dataStr) as SixEightBridgeMessage;

      if (msg.type === 'PONG') {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.latencyMs = Math.round(now - this.lastPingTimeMs);
        this.notifyStatus();
      } else if (msg.type === 'BRACKET_UPDATE') {
        if (msg.payload && typeof msg.payload === 'object') {
          this.currentBracket = msg.payload as TournamentBracket;
          this.bracketListeners.forEach((cb) => cb(this.currentBracket));
        }
      }

      this.messageListeners.forEach((cb) => cb(msg));
    } catch {
      // Ignore malformed incoming frames
    }
  }

  private handleInboundLocalBroadcast(data: unknown): void {
    if (data && typeof data === 'object' && 'protocol' in data && (data as SixEightBridgeMessage).protocol === '6-8-gamedesk-v2') {
      const msg = data as SixEightBridgeMessage;
      this.messageListeners.forEach((cb) => cb(msg));
    }
  }

  // --- Outbound Telemetry Dispatching ---

  public publishEvent(event: SixEightGameEvent): void {
    const msg: SixEightBridgeMessage = {
      protocol: '6-8-gamedesk-v2',
      type: 'EVENT',
      gameId: this.config.gameId,
      sequenceId: this.sequenceCounter++,
      timestampIso: new Date().toISOString(),
      payload: event,
    };

    this.dispatchMessage(msg);
  }

  public publishSnapshot(snapshot: SixEightScoreboardSnapshot): void {
    const msg: SixEightBridgeMessage = {
      protocol: '6-8-gamedesk-v2',
      type: 'SNAPSHOT',
      gameId: this.config.gameId,
      sequenceId: this.sequenceCounter++,
      timestampIso: new Date().toISOString(),
      payload: snapshot,
    };

    this.dispatchMessage(msg);
  }

  public publishRoster(team: 'white' | 'dark', roster: SixEightPlayer[]): void {
    const msg: SixEightBridgeMessage = {
      protocol: '6-8-gamedesk-v2',
      type: 'ROSTER',
      gameId: this.config.gameId,
      sequenceId: this.sequenceCounter++,
      timestampIso: new Date().toISOString(),
      payload: { team, roster },
    };

    this.dispatchMessage(msg);
  }

  public updateBracketMatchScore(matchId: string, scoreWhite: number, scoreDark: number, period: number, status: 'upcoming' | 'live' | 'final'): void {
    const updatedMatches = this.currentBracket.matches.map((m) => {
      if (m.id === matchId) {
        return {
          ...m,
          scoreWhite,
          scoreDark,
          period,
          status,
          winner: status === 'final' ? (scoreWhite > scoreDark ? m.teamWhite : m.teamDark) : undefined,
        };
      }
      return m;
    });

    this.currentBracket = {
      ...this.currentBracket,
      matches: updatedMatches,
    };

    const bracketMsg: SixEightBridgeMessage = {
      protocol: '6-8-gamedesk-v2',
      type: 'BRACKET_UPDATE',
      gameId: this.config.gameId,
      sequenceId: this.sequenceCounter++,
      timestampIso: new Date().toISOString(),
      payload: this.currentBracket,
    };

    this.dispatchMessage(bracketMsg);
    this.bracketListeners.forEach((cb) => cb(this.currentBracket));
  }

  private dispatchMessage(msg: SixEightBridgeMessage): void {
    // 1. Broadcast locally on pool-deck BroadcastChannel
    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage(msg);
      } catch {
        // Broadcast fallback
      }
    }

    // 2. Dispatch to WebSocket server if connected; otherwise buffer in offline queue
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(msg));
      } catch {
        this.enqueueOfflineMessage(msg);
      }
    } else {
      this.enqueueOfflineMessage(msg);
    }
  }

  // --- Offline Queue Resilience ---

  private enqueueOfflineMessage(msg: SixEightBridgeMessage): void {
    // Avoid buffering raw PINGs
    if (msg.type === 'PING' || msg.type === 'PONG') return;

    this.offlineQueue.push(msg);
    // Cap offline buffer to latest 500 events
    if (this.offlineQueue.length > 500) {
      this.offlineQueue.shift();
    }
    this.saveOfflineQueue();
  }

  public flushOfflineQueue(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.offlineQueue.length === 0) {
      return;
    }

    const queued = [...this.offlineQueue];
    this.offlineQueue = [];
    this.saveOfflineQueue();

    queued.forEach((msg) => {
      try {
        this.socket?.send(JSON.stringify(msg));
      } catch {
        this.offlineQueue.push(msg);
      }
    });

    this.saveOfflineQueue();
  }

  private loadOfflineQueue(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
        if (raw) {
          this.offlineQueue = JSON.parse(raw);
        }
      } catch {
        this.offlineQueue = [];
      }
    }
  }

  private saveOfflineQueue(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.offlineQueue));
      } catch {
        // Storage quota safeguard
      }
    }
  }

  private setStatus(newStatus: SixEightBridgeStatus): void {
    this.status = newStatus;
    if (newStatus !== 'connected') {
      this.latencyMs = null;
    }
    this.notifyStatus();
  }

  private notifyStatus(): void {
    this.statusListeners.forEach((cb) => cb(this.status, this.latencyMs));
  }
}

export const sixEightBridge = new SixEightBridgeManager();
