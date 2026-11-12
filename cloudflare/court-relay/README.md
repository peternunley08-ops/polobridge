# PoloPad Pro — Court Relay

A small WebSocket relay that links scoring desks on different pools to the **Tournament Director** dashboard. It runs on Cloudflare Workers with one Durable Object per tournament room.

Without a relay the dashboard only sees desks that are open in the same browser on the same device. With it, any tablet or phone that opens an invite link appears on the director's screen.

## What It Does

Every text frame a device sends into a room is rebroadcast to the other devices in that room. That is all. The relay stores nothing, never originates a frame, and holds no match logic: ordering, staleness, clock projection and conflict handling all live in the PWA (`react_app/src/engine/court-link.ts`), where they are unit tested.

| Route | Purpose |
| :--- | :--- |
| `GET /` or `GET /health` | Health check, returns JSON |
| `GET /room/<CODE>` | WebSocket upgrade into room `<CODE>` |

## Deploy

Requires a Cloudflare account and Node.js **22.12 or newer** (a Wrangler 4 requirement).

```bash
cd cloudflare/court-relay
```

```bash
npm install
```

```bash
npx wrangler deploy
```

Wrangler prints the deployed address, for example `https://polopad-court-relay.<your-subdomain>.workers.dev`.

## Connect The PWA

1. On the director's device open **Director → Link Setup**.
2. Press **New Private Room**.
3. Paste the relay address into **Cross-device relay** and press **Save Relay**. `https://` and `wss://` forms are both accepted.
4. Under **Invite links** copy **Desk A** to **Desk D** and send each one to the volunteer on that pool. Opening the link sets the room, the court and the relay in one tap.

The relay address is stored per device, so only the director ever types it.

## Configuration

Set in `wrangler.toml` under `[vars]`.

| Variable | Default | Meaning |
| :--- | :--- | :--- |
| **`ALLOWED_ORIGINS`** | GitHub Pages site, `localhost:3000`, the Capacitor app schemes | Comma-separated web origins allowed to connect from a browser. Add your own domain if you host the PWA elsewhere. `*` allows any origin. |

## Limits

These are constants in `src/index.ts`.

| Limit | Value | Why |
| :--- | :--- | :--- |
| Frame size | 16 KB | A snapshot is about 1 KB |
| Frames per socket | 30 per second | A desk sends at most 10 per second |
| Sockets per room | 24 | Four desks plus dashboards and spare devices |
| Frame content | JSON addressed to this room | Stops the relay being used as a general message bus |

A socket that breaks a limit is closed (`1003` binary, `1008` policy, `1009` too large) and nothing further from it is forwarded.

## Trust Model

- The **room code is the only credential**. Anyone who has it can watch the room and publish into it.
- The dashboard is **read-only**. Nothing sent through the relay can start, stop or reset a clock on any desk. The worst a stranger holding the code can do is show wrong numbers on a director's screen.
- Use **New Private Room** in the PWA (eight symbols from a 31-symbol alphabet, about 39 bits) rather than a guessable name, and treat invite links like the room code.
- The origin allowlist stops other websites from using your relay through their visitors' browsers. It is not authentication: a non-browser client can send any `Origin`, or none.

## Traffic

Each publishing desk sends one heartbeat per second plus one frame per real change (whistle, reset, goal), capped at ten per second. Every connected device also sends a 4-byte keep-alive every five seconds, which is answered by the runtime's WebSocket auto-response rather than by the relay's own code. A four-court tournament is therefore roughly four to eight frames per second in total.

The Durable Object class is declared with `new_sqlite_classes` and uses WebSocket Hibernation. Check Cloudflare's current Durable Objects pricing and limits for your plan before a tournament; this README makes no promise about cost.

## Local Development

```bash
npx wrangler dev
```

The relay listens on `http://127.0.0.1:8787`. In the PWA use `ws://127.0.0.1:8787` as the relay address. Browsers only allow insecure `ws://` to the loopback interface from an `https` page, so a relay on another machine must be reached over `wss://`.

When the PWA is served from an origin that is not in the allowlist (a different local port, for instance), start the relay with an override:

```bash
npx wrangler dev --var ALLOWED_ORIGINS:*
```

## Tests

```bash
npm test
```

Starts the Worker under the local Workers runtime on a free port and checks fan-out, room isolation, the keep-alive, the origin allowlist and every limit with real WebSocket clients. Set `RELAY_TEST_URL=http://127.0.0.1:8787` to test a relay that is already running.

The cross-device path through the real PWA is covered by `tests/e2e/director-dashboard.e2e.cjs` at the repository root when `COURT_RELAY_URL` is set.
