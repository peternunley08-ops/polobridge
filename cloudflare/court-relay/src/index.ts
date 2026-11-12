/**
 * PoloPad Pro — Court Relay (Cloudflare Worker + Durable Object)
 * ==============================================================
 * Connects scoring desks on different pools to a Tournament Director screen.
 *
 * The relay is deliberately dumb: one Durable Object per tournament room, and
 * every text frame a socket sends is rebroadcast to the other sockets in that
 * room. All protocol logic (ordering, staleness, clock projection, conflict
 * handling) lives in the PWA, where it is unit tested. The relay stores
 * nothing and never originates a frame.
 *
 *   GET /                 health check (JSON)
 *   GET /room/<CODE>      WebSocket upgrade into room <CODE>
 *
 * Guard rails, because the endpoint is public:
 *   - room codes must match the PWA's format
 *   - browser connections are limited to an origin allowlist
 *   - frames must be JSON addressed to this room, at most 16 KB
 *   - at most 30 frames a second per socket and 24 sockets per room
 *
 * Trust model: the room code is the only credential. Anyone who has it can
 * watch the room and publish into it. The dashboard is read-only, so the
 * worst a stranger with the code can do is show wrong numbers on a director's
 * screen; they can never touch a desk's clock. Use the PWA's "New private
 * room" button (39 bits of randomness) rather than a guessable name.
 *
 * The WebSocket Hibernation API is used, so the runtime can evict an idle room
 * from memory without dropping its sockets, and the keep-alive ("ping" ->
 * "pong") is handled by the runtime's auto-response instead of this code.
 */

import { DurableObject } from 'cloudflare:workers';

export interface Env {
  COURT_ROOM: DurableObjectNamespace<CourtRoom>;
  /** Comma-separated origins, or "*". */
  ALLOWED_ORIGINS?: string;
}

/** Must stay in step with ROOM_CODE_PATTERN in react_app/src/engine/court-link.ts. */
const ROOM_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{4,22}[A-Z0-9]$/;
/** Must stay in step with MAX_FRAME_CHARS in the PWA. */
const MAX_FRAME_CHARS = 16 * 1024;
/** Four desks plus a generous number of dashboards and spare devices. */
const MAX_SOCKETS_PER_ROOM = 24;
const RATE_WINDOW_MS = 1000;
/** A desk sends at most 10 frames/s; this leaves room for bursts. */
const MAX_FRAMES_PER_WINDOW = 30;

const KEEP_ALIVE_REQUEST = 'ping';
const KEEP_ALIVE_RESPONSE = 'pong';

/** WebSocket.readyState value for an open socket. */
const SOCKET_OPEN = 1;

const CLOSE_NORMAL = 1000;
const CLOSE_UNSUPPORTED_DATA = 1003;
const CLOSE_POLICY_VIOLATION = 1008;
const CLOSE_MESSAGE_TOO_BIG = 1009;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/**
 * Browsers always send Origin on a WebSocket handshake, so this stops other
 * websites from using the relay through their visitors. It is not
 * authentication: a non-browser client can send any Origin, or none.
 */
export function isOriginAllowed(origin: string | null, allowList: string | undefined): boolean {
  const allowed = (allowList ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  if (allowed.includes('*')) return true;
  if (origin === null) return true;
  return allowed.includes(origin);
}

/** Extracts and validates the room code from `/room/<CODE>`. */
export function roomFromPath(pathname: string): string | null {
  const match = /^\/room\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  const room = decoded.toUpperCase();
  return ROOM_CODE_PATTERN.test(room) ? room : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ service: 'polopad-court-relay', protocol: 1, ok: true });
    }
    if (!url.pathname.startsWith('/room/')) return json({ error: 'not found' }, 404);

    const room = roomFromPath(url.pathname);
    if (room === null) return json({ error: 'invalid room code' }, 400);

    if ((request.headers.get('Upgrade') ?? '').toLowerCase() !== 'websocket') {
      return json({ error: 'expected a WebSocket upgrade' }, 426);
    }
    if (!isOriginAllowed(request.headers.get('Origin'), env.ALLOWED_ORIGINS)) {
      return json({ error: 'origin not allowed' }, 403);
    }

    const stub = env.COURT_ROOM.get(env.COURT_ROOM.idFromName(room));
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;

interface RateWindow {
  startedAtMs: number;
  frames: number;
}

export class CourtRoom extends DurableObject<Env> {
  /** In memory only: a room waking from hibernation simply starts fresh windows. */
  private readonly rates = new Map<WebSocket, RateWindow>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(KEEP_ALIVE_REQUEST, KEEP_ALIVE_RESPONSE));
  }

  async fetch(request: Request): Promise<Response> {
    const room = roomFromPath(new URL(request.url).pathname);
    if (room === null) return json({ error: 'invalid room code' }, 400);
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS_PER_ROOM) return json({ error: 'room is full' }, 429);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    // The tag survives hibernation and tells each handler which room this is.
    this.ctx.acceptWebSocket(server, [room]);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Once the relay has started closing a socket, frames it still had in
    // flight are dropped: a rejected sender must not get anything else through.
    if (socket.readyState !== SOCKET_OPEN) return;

    if (typeof message !== 'string') {
      this.reject(socket, CLOSE_UNSUPPORTED_DATA, 'text frames only');
      return;
    }
    if (message.length > MAX_FRAME_CHARS) {
      this.reject(socket, CLOSE_MESSAGE_TOO_BIG, 'frame too large');
      return;
    }
    if (!this.withinRate(socket)) {
      this.reject(socket, CLOSE_POLICY_VIOLATION, 'rate limit exceeded');
      return;
    }
    if (!this.isFrameForThisRoom(socket, message)) {
      this.reject(socket, CLOSE_POLICY_VIOLATION, 'not a court frame for this room');
      return;
    }

    for (const peer of this.ctx.getWebSockets()) {
      if (peer === socket) continue;
      try {
        peer.send(message);
      } catch {
        // The peer is closing; its own close handler cleans up.
      }
    }
  }

  async webSocketClose(socket: WebSocket, code: number): Promise<void> {
    this.rates.delete(socket);
    try {
      // Complete the closing handshake. Reserved codes cannot be echoed back.
      socket.close(code === 1005 || code === 1006 || code === 1015 ? CLOSE_NORMAL : code, 'closing');
    } catch {
      // Already closed.
    }
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    this.rates.delete(socket);
  }

  private reject(socket: WebSocket, code: number, reason: string): void {
    this.rates.delete(socket);
    try {
      socket.close(code, reason);
    } catch {
      // Already closed.
    }
  }

  private withinRate(socket: WebSocket): boolean {
    const now = Date.now();
    const current = this.rates.get(socket);
    if (!current || now - current.startedAtMs >= RATE_WINDOW_MS) {
      this.rates.set(socket, { startedAtMs: now, frames: 1 });
      return true;
    }
    current.frames += 1;
    return current.frames <= MAX_FRAMES_PER_WINDOW;
  }

  /** Cheap structural check so the relay cannot be used as a general message bus. */
  private isFrameForThisRoom(socket: WebSocket, message: string): boolean {
    const room = this.ctx.getTags(socket)[0];
    try {
      const frame: unknown = JSON.parse(message);
      return (
        typeof frame === 'object' &&
        frame !== null &&
        typeof (frame as { room?: unknown }).room === 'string' &&
        (frame as { room: string }).room === room &&
        typeof (frame as { kind?: unknown }).kind === 'string'
      );
    } catch {
      return false;
    }
  }
}
