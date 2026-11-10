#!/usr/bin/env node
/**
 * PoloPad Pro — Tournament Director dashboard, end to end in a real browser.
 *
 * Serves the production bundle (react_app/dist), opens a scoring desk and a
 * director screen as two tabs of one Chromium profile, and checks that what
 * the desk does is what the director sees. It also re-checks the console's
 * own rules (WP 20.15, WP 21, WP 22.3, NFHS) so a change to the link can
 * never quietly break them.
 *
 * Requires Playwright with Chromium:
 *     npm i -D playwright && npx playwright install chromium
 * Run after `npm run build` in react_app:
 *     node tests/e2e/director-dashboard.e2e.cjs
 *
 * Optional: point COURT_RELAY_URL at a running relay (for example
 * ws://127.0.0.1:8787 from `npx wrangler dev` in cloudflare/court-relay) to
 * also check the cross-device path with two isolated browser profiles.
 */

'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const DIST_DIR = path.resolve(__dirname, '..', '..', 'react_app', 'dist');
const RELAY_URL = process.env.COURT_RELAY_URL || '';
const MIRROR_KEY = 'polopad_pro_live_match_v1';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.csv': 'text/csv',
  '.stl': 'model/stl',
  '.zip': 'application/zip',
};

function startServer() {
  const server = http.createServer((request, response) => {
    const urlPath = decodeURIComponent((request.url || '/').split('?')[0]);
    const relative = urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath;
    const filePath = path.join(DIST_DIR, path.normalize(relative));
    if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}/` }));
  });
}

// ---------------------------------------------------------------------------
// Tiny check harness
// ---------------------------------------------------------------------------

const results = [];

async function check(name, run) {
  try {
    await run();
    results.push({ name, ok: true });
    console.log(`  ✔ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  ✖ ${name}\n      ${String(error && error.message ? error.message : error).split('\n').join('\n      ')}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/** Polls until `read()` satisfies `accept`, or fails with the last value seen. */
async function eventually(read, accept, label, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  for (;;) {
    last = await read();
    if (accept(last)) return last;
    if (Date.now() > deadline) throw new Error(`${label}: still ${JSON.stringify(last)} after ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function clockToMs(text) {
  const match = /^(\d\d):(\d\d)\.(\d)$/.exec(text.trim());
  if (!match) throw new Error(`not a game clock: ${JSON.stringify(text)}`);
  return Number(match[1]) * 60000 + Number(match[2]) * 1000 + Number(match[3]) * 100;
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

function watchErrors(page, sink, label) {
  page.on('pageerror', (error) => sink.push(`${label} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') sink.push(`${label} console: ${message.text()}`);
  });
}

async function openDirectorTab(page) {
  await page.getByRole('button', { name: 'Director', exact: true }).click();
  await page.getByTestId('court-grid').waitFor();
}

async function openConsoleTab(page) {
  await page.getByRole('button', { name: 'Console', exact: true }).click();
  await page.getByText('MASTER GAME CLOCK').waitFor();
}

async function openSetup(page) {
  if (!(await page.getByTestId('link-setup').isVisible().catch(() => false))) {
    await page.getByTestId('setup-toggle').click();
  }
  await page.getByTestId('link-setup').waitFor();
}

const tile = (page, court) => page.getByTestId(`court-tile-${court}`);
const health = (page, court) => tile(page, court).getAttribute('data-health');
const text = (page, id) => page.getByTestId(id).innerText();

/** The console's own master game clock, e.g. "08:00.0". */
async function consoleGameClock(page) {
  return page.evaluate(() => {
    const label = [...document.querySelectorAll('span')].find((node) => node.textContent.startsWith('MASTER GAME CLOCK'));
    return label.parentElement.nextElementSibling.textContent.trim();
  });
}

/**
 * Opens a scoring console that boots in a chosen match state.
 *
 * The console saves its state on every unload, so the state has to be in
 * storage before the app's first script runs; seeding and then reloading would
 * simply be overwritten. The guard keeps a later reload of the tab from
 * re-seeding it.
 */
async function openSeededConsole(context, baseUrl, match, errors, label) {
  const page = await context.newPage();
  watchErrors(page, errors, label);
  await page.addInitScript(
    ([key, record]) => {
      if (sessionStorage.getItem('__e2e_seeded')) return;
      sessionStorage.setItem('__e2e_seeded', '1');
      const now = Date.now() + 60000;
      localStorage.setItem(
        key,
        JSON.stringify({ id: 'active_match', savedAtMs: now, savedAtIso: new Date(now).toISOString(), totalSavesCount: 1, ...record })
      );
    },
    [MIRROR_KEY, match]
  );
  await page.goto(baseUrl);
  await page.getByText('MASTER GAME CLOCK').waitFor();
  return page;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function sameDeviceScenarios(browser, baseUrl) {
  console.log('\nDesk and director as two tabs of one browser');
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
  const errors = [];
  const director = await context.newPage();
  watchErrors(director, errors, 'director');

  await director.goto(baseUrl);
  await openDirectorTab(director);

  await check('a fresh dashboard shows four empty courts in the local room', async () => {
    expectEqual(await text(director, 'director-summary'), 'ROOM LOCAL-POOL · 0 of 4 courts live', 'summary');
    for (const court of ['A', 'B', 'C', 'D']) expectEqual(await health(director, court), 'empty', `court ${court}`);
    expect(!(await director.getByTestId('court-link-pill').isVisible().catch(() => false)), 'no link pill for a watch-only device');
  });

  // The desk boots in a known state: Q3, 02:00.0, white 5 dark 4, one dark exclusion, a dark player on two fouls.
  let desk = await openSeededConsole(context, baseUrl, {
    protocol: 'cts',
    enable20sReset: true,
    isSimpleVolunteerMode: false,
    gameTimeMs: 120000,
    shotTimeMs: 30000,
    period: 3,
    isRunning: false,
    teamWhiteName: 'NEWPORT',
    teamDarkName: 'CORONA',
    scoreWhite: 5,
    scoreDark: 4,
    quarterScores: { white: [2, 2, 1, 0, 0, 0, 0], dark: [1, 2, 1, 0, 0, 0, 0] },
    exclusions: [{ id: 'x1', team: 'dark', cap: 4, remaining: 14 }],
    timeoutsWhite: { full: 3, short: 1 },
    timeoutsDark: { full: 3, short: 1 },
    darkRoster: [
      { cap: 4, name: 'D. Four', position: 'UTL', piScore: 80, goals: 0, exclusions: 2, steals: 0 },
      { cap: 7, name: 'D. Seven', position: 'ATK', piScore: 80, goals: 0, exclusions: 0, steals: 0 },
    ],
    sixEightEvents: [],
  }, errors, 'desk');

  await check('choosing a court links the desk and the director sees it at once', async () => {
    await openDirectorTab(desk);
    await openSetup(desk);
    await desk.getByTestId('desk-court-B').click();
    await eventually(() => desk.getByTestId('court-link-pill').getAttribute('data-slot'), (slot) => slot === 'publishing', 'desk slot');
    await eventually(() => health(director, 'B'), (value) => value === 'live', 'court B on the director');
    expectEqual(await text(director, 'court-score-white-B'), '5', 'white score');
    expectEqual(await text(director, 'court-score-dark-B'), '4', 'dark score');
    expectEqual(await text(director, 'court-period-B'), 'Q3', 'period');
    expectEqual(await text(director, 'court-game-clock-B'), '02:00.0', 'game clock');
    expectEqual(await text(director, 'court-shot-clock-B'), '30', 'shot clock');
    expectEqual(await text(director, 'court-play-state-B'), 'WHISTLE', 'play state');
    expect((await tile(director, 'B').innerText()).includes('NEWPORT'), 'team name shown');
    expectEqual(await text(director, 'director-summary'), 'ROOM LOCAL-POOL · 1 of 4 courts live', 'summary');
  });

  await check('the desk sees its own court on its own dashboard', async () => {
    await eventually(() => health(desk, 'B'), (value) => value === 'live', 'own court');
    expect((await tile(desk, 'B').innerText()).includes('this device'), 'own court is marked');
  });

  await check('a second tab of the same browser is blocked from publishing the same court', async () => {
    const second = await context.newPage();
    await second.goto(baseUrl);
    await eventually(() => second.getByTestId('court-link-pill').getAttribute('data-slot'), (slot) => slot === 'blocked', 'second tab slot');
    await openDirectorTab(second);
    await eventually(() => health(second, 'B'), (value) => value === 'live', 'blocked tab still watches');
    expect(!(await tile(director, 'B').innerText()).includes('devices are publishing'), 'no conflict on the director');
    await second.close();
  });

  await openConsoleTab(desk);

  await check('WP 21: the active exclusion is on the director, and a goal releases it', async () => {
    await eventually(() => tile(director, 'B').innerText(), (value) => value.includes('D#4'), 'exclusion chip');
    await desk.getByTitle('Score Goal (+1), Reset 30s, and Auto-Release Dark Exclusions (Rule WP 21)').click();
    await eventually(() => text(director, 'court-score-white-B'), (value) => value === '6', 'white score after goal');
    await eventually(() => tile(director, 'B').innerText(), (value) => !value.includes('D#4'), 'exclusion released');
    expect((await desk.getByText('Full Strength (6-on-6)').count()) === 2, 'console shows both teams at full strength');
    await eventually(() => director.getByRole('log').innerText(), (value) => value.includes('GOAL NEWPORT'), 'goal in the ticker');
  });

  await check('starting the clock shows IN PLAY and the director clock tracks the desk', async () => {
    await desk.keyboard.press('Space');
    await eventually(() => text(director, 'court-play-state-B'), (value) => value === 'IN PLAY', 'play state');
    await desk.waitForTimeout(1500);
    const [deskClock, directorClock] = await Promise.all([consoleGameClock(desk), text(director, 'court-game-clock-B')]);
    const difference = Math.abs(clockToMs(deskClock) - clockToMs(directorClock));
    expect(difference <= 300, `desk ${deskClock} vs director ${directorClock} differ by ${difference} ms`);
    expect(clockToMs(directorClock) < 120000, 'the clock has moved');
  });

  await check('a whistle stops the director clock on exactly the desk value', async () => {
    await desk.keyboard.press('Space');
    await eventually(() => text(director, 'court-play-state-B'), (value) => value === 'WHISTLE', 'play state');
    const deskClock = await consoleGameClock(desk);
    await eventually(() => text(director, 'court-game-clock-B'), (value) => value === deskClock, `director clock equals desk ${deskClock}`);
    await director.waitForTimeout(600);
    expectEqual(await text(director, 'court-game-clock-B'), deskClock, 'clock stays frozen');
  });

  await check('a shot-clock reset reaches the director without waiting for the heartbeat', async () => {
    await desk.keyboard.press('e');
    await eventually(() => text(director, 'court-shot-clock-B'), (value) => value === '20', 'shot clock after 20 s reset', 700);
    await desk.keyboard.press('r');
    await eventually(() => text(director, 'court-shot-clock-B'), (value) => value === '30', 'shot clock after 30 s reset', 700);
  });

  await check('WP 22.3: a third foul caps the player out on the desk and on the director', async () => {
    await desk.getByRole('button', { name: '+ EJECT' }).nth(1).click();
    await desk.getByRole('button', { name: /#4/ }).click();
    await eventually(() => tile(director, 'B').innerText(), (value) => value.includes('CAP-OUT D#4'), 'cap-out chip');
    await eventually(() => director.getByRole('log').innerText(), (value) => value.includes('CAP-OUT CORONA #4'), 'cap-out alert');
    await desk.getByRole('button', { name: '+ EJECT' }).nth(1).click();
    const capped = desk.getByRole('button', { name: /#4/ });
    expect(await capped.isDisabled(), 'the capped-out cap can no longer be excluded');
    expect((await capped.innerText()).includes('3/3 CAPPED OUT'), 'cap-out label shown');
    await desk.getByRole('button', { name: 'Cancel' }).click();
  });

  await check('NFHS mode hides the 20 s plunger on the desk and is flagged on the director', async () => {
    expect((await desk.getByTitle('Reset Shot Clock to 20s (Hotkey: E)').count()) === 1, '20 s plunger present in NCAA mode');
    await desk.getByRole('button', { name: 'NCAA: 20s/30s' }).click();
    expect((await desk.getByTitle('Reset Shot Clock to 20s (Hotkey: E)').count()) === 0, '20 s plunger hidden in NFHS mode');
    await eventually(() => tile(director, 'B').innerText(), (value) => value.includes('NFHS 30s'), 'ruleset chip');
    await desk.getByRole('button', { name: 'NFHS: 30s ONLY' }).click();
    await eventually(() => tile(director, 'B').innerText(), (value) => value.includes('NCAA/WA'), 'ruleset chip restored');
  });

  await check('WP 20.15: when the game clock is at or below the shot clock both screens blank it', async () => {
    // A replacement tablet takes over the court, booting at T_game == T_shot.
    await desk.close();
    desk = await openSeededConsole(context, baseUrl, {
      gameTimeMs: 30000,
      shotTimeMs: 30000,
      period: 4,
      teamWhiteName: 'NEWPORT',
      teamDarkName: 'CORONA',
      scoreWhite: 6,
      scoreDark: 4,
      exclusions: [],
    }, errors, 'desk-2');
    await eventually(() => desk.getByTestId('court-link-pill').getAttribute('data-slot'), (slot) => slot === 'publishing', 'replacement desk slot');
    expect((await desk.getByText('WP 20.15 AUTO-BLANKED').count()) === 1, 'console badge at T_game == T_shot');
    await eventually(() => health(director, 'B'), (value) => value === 'live', 'court B is live again');
    await eventually(() => text(director, 'court-shot-clock-B'), (value) => value === '--', 'director shot clock');
    expect((await tile(director, 'B').innerText()).includes('WP 20.15'), 'rule shown on the tile');

    // One second more on the game clock and the shot clock is shown again.
    await desk.getByRole('button', { name: '+1s', exact: true }).click();
    expect((await desk.getByText('RULE WP 20.15 ARMED').count()) === 1, 'console badge un-blanked');
    await eventually(() => text(director, 'court-shot-clock-B'), (value) => value === '30', 'director shot clock visible again');
  });

  await check('closing the desk page marks the court as signed off at once', async () => {
    await desk.close();
    await eventually(() => health(director, 'B'), (value) => value === 'signed-off', 'court B after the desk closed', 2500);
    expectEqual(await text(director, 'court-play-state-B'), 'LAST KNOWN', 'play state');
    expectEqual(await text(director, 'court-score-white-B'), '6', 'last known score kept');
  });

  await check('the demo shows four live courts, each labelled, and leaves real data alone', async () => {
    await director.getByTestId('demo-toggle').click();
    await eventually(
      async () => Promise.all(['A', 'B', 'C', 'D'].map((court) => health(director, court))),
      (values) => values.every((value) => value === 'live'),
      'demo courts'
    );
    expect(await director.getByTestId('demo-ribbon').isVisible(), 'demo badge visible');
    for (const court of ['A', 'B', 'C', 'D']) {
      expect((await tile(director, court).innerText()).includes('DEMO'), `court ${court} carries a DEMO tag`);
    }
    const first = clockToMs(await text(director, 'court-game-clock-B'));
    await director.waitForTimeout(1200);
    expect(clockToMs(await text(director, 'court-game-clock-B')) < first, 'demo clock ticks');
    await director.getByTestId('demo-toggle').click();
    await eventually(() => health(director, 'B'), (value) => value === 'signed-off', 'real court B is back');
    expectEqual(await health(director, 'A'), 'empty', 'court A is empty again');
  });

  await check('full screen hides the masthead and fits all four courts on a 1024 x 768 iPad', async () => {
    await director.setViewportSize({ width: 1024, height: 768 });
    await director.getByTestId('demo-toggle').click();
    await director.getByTestId('fullscreen-toggle').click();
    await eventually(() => director.locator('header').isVisible(), (visible) => visible === false, 'masthead hidden');
    await director.waitForTimeout(400);
    const bottoms = await director.$$eval('[data-testid^="court-tile-"]', (nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().bottom)));
    expect(bottoms.every((bottom) => bottom <= 768), `tile bottoms ${JSON.stringify(bottoms)} exceed the 768 px viewport`);
    await director.keyboard.press('Escape');
    await eventually(() => director.locator('header').isVisible(), (visible) => visible === true, 'masthead restored by Esc');
    await director.getByTestId('demo-toggle').click();
  });

  await check('the rendered dashboard has no pitch-black surface', async () => {
    await director.setViewportSize({ width: 1366, height: 900 });
    await director.getByTestId('demo-toggle').click();
    await openSetup(director);
    await director.waitForTimeout(300);
    const offenders = await director.evaluate(() => {
      const found = [];
      for (const node of document.querySelectorAll('body, body *')) {
        const style = getComputedStyle(node);
        const match = /rgba?\(([^)]+)\)/.exec(style.backgroundColor);
        if (!match) continue;
        const [r, g, b, a = '1'] = match[1].split(',').map((part) => part.trim());
        // Opaque (or nearly opaque) and darker than the deepest palette tone.
        if (Number(a) > 0.5 && Number(r) < 14 && Number(g) < 14 && Number(b) < 24) {
          found.push(`${node.tagName.toLowerCase()}.${String(node.className).slice(0, 60)} -> ${style.backgroundColor}`);
        }
      }
      return found;
    });
    expectEqual(offenders.length, 0, `pitch-black surfaces ${JSON.stringify(offenders.slice(0, 5))}`);
    await director.getByTestId('demo-toggle').click();
  });

  await check('the dashboard does not scroll sideways on a phone', async () => {
    await director.setViewportSize({ width: 390, height: 844 });
    await director.waitForTimeout(200);
    const overflow = await director.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow <= 0, `page is ${overflow} px wider than the phone screen`);
  });

  await check('no page raised a JavaScript error', async () => {
    expectEqual(errors.length, 0, `errors ${JSON.stringify(errors.slice(0, 5))}`);
  });

  await context.close();
}

async function inviteScenario(browser, baseUrl) {
  console.log('\nInvite link on a fresh device');
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
  const page = await context.newPage();

  await check('an invite link sets the room and court, then removes itself from the address bar', async () => {
    await page.goto(`${baseUrl}#pp-room=k7qm-4f9x&pp-court=C`);
    await eventually(() => page.getByTestId('court-link-pill').getAttribute('data-slot'), (slot) => slot === 'publishing', 'desk slot');
    expect((await page.getByTestId('court-link-pill').innerText()).includes('COURT C'), 'pill names the court');
    expectEqual(new URL(page.url()).hash, '', 'fragment cleared');
    expect(await page.getByText('MASTER GAME CLOCK').isVisible(), 'a desk invite stays on the scoring console');
    await openDirectorTab(page);
    expectEqual(await text(page, 'director-summary'), 'ROOM K7QM-4F9X · 1 of 4 courts live', 'summary');
    expect((await page.getByText('Invite link applied').count()) === 1, 'invite notice shown');
  });

  await check('the choice survives a reload of the tab', async () => {
    await page.reload();
    await eventually(() => page.getByTestId('court-link-pill').getAttribute('data-slot'), (slot) => slot === 'publishing', 'desk slot after reload');
    expect((await page.getByTestId('court-link-pill').innerText()).includes('COURT C'), 'still Court C');
  });

  await check('a malformed invite is ignored', async () => {
    const other = await browser.newContext({ serviceWorkers: 'block' });
    const fresh = await other.newPage();
    await fresh.goto(`${baseUrl}#pp-room=K7QM-4F9X&pp-court=Z&pp-relay=ws%3A%2F%2Fevil.example`);
    await fresh.getByText('MASTER GAME CLOCK').waitFor();
    expect(!(await fresh.getByTestId('court-link-pill').isVisible().catch(() => false)), 'no court was set');
    await openDirectorTab(fresh);
    expectEqual(await text(fresh, 'director-summary'), 'ROOM LOCAL-POOL · 0 of 4 courts live', 'room unchanged');
    await other.close();
  });

  await context.close();
}

async function relayScenario(browser, baseUrl) {
  console.log(`\nTwo isolated devices through the relay at ${RELAY_URL}`);
  // Separate contexts share nothing: no BroadcastChannel, no storage. Only the relay connects them.
  const deskContext = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
  const directorContext = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
  const desk = await deskContext.newPage();
  const director = await directorContext.newPage();
  const room = `E2E-${Date.now().toString(36).toUpperCase()}`;

  const join = async (page) => {
    await page.goto(baseUrl);
    await openDirectorTab(page);
    await openSetup(page);
    await page.getByTestId('room-input').fill(room);
    await page.getByRole('button', { name: 'JOIN ROOM' }).click();
    await page.getByTestId('relay-input').fill(RELAY_URL);
    await page.getByTestId('relay-save').click();
    await eventually(() => page.getByTestId('relay-status').getAttribute('aria-label'), (label) => String(label).startsWith('RELAY LIVE'), 'relay status', 8000);
  };

  await check('both devices connect to the relay', async () => {
    await join(director);
    await join(desk);
  });

  await check('without the relay the two devices would be invisible to each other', async () => {
    expectEqual(await health(director, 'D'), 'empty', 'court D before the desk publishes');
  });

  await check('the desk on one device appears on the director on another', async () => {
    await desk.getByTestId('desk-court-D').click();
    await eventually(() => health(director, 'D'), (value) => value === 'live', 'court D over the relay', 6000);
    expectEqual(await text(director, 'court-game-clock-D'), '08:00.0', 'game clock');
  });

  await check('clock, whistle and score changes cross the relay', async () => {
    await openConsoleTab(desk);
    await desk.keyboard.press('Space');
    await eventually(() => text(director, 'court-play-state-D'), (value) => value === 'IN PLAY', 'play state');
    await desk.waitForTimeout(1200);
    await desk.keyboard.press('Space');
    await eventually(() => text(director, 'court-play-state-D'), (value) => value === 'WHISTLE', 'play state');
    const deskClock = await consoleGameClock(desk);
    await eventually(() => text(director, 'court-game-clock-D'), (value) => value === deskClock, `director clock equals desk ${deskClock}`);
    const before = Number(await text(director, 'court-score-dark-D'));
    await desk.getByTitle('Score Goal (+1), Reset 30s, and Auto-Release White Exclusions (Rule WP 21)').click();
    await eventually(() => text(director, 'court-score-dark-D'), (value) => Number(value) === before + 1, 'dark score');
  });

  await check('a director who joins late is caught up immediately', async () => {
    const lateContext = await browser.newContext({ serviceWorkers: 'block' });
    const late = await lateContext.newPage();
    await join(late);
    await eventually(() => health(late, 'D'), (value) => value === 'live', 'court D for the late director', 3000);
    await lateContext.close();
  });

  await check('a second device claiming the same court is flagged, and the first desk stays on screen', async () => {
    const rivalContext = await browser.newContext({ serviceWorkers: 'block' });
    const rival = await rivalContext.newPage();
    await join(rival);
    await rival.getByTestId('desk-court-D').click();
    await eventually(() => tile(director, 'D').innerText(), (value) => value.includes('2 devices are publishing this court'), 'conflict ribbon on the director', 8000);
    await eventually(() => director.getByRole('log').innerText(), (value) => value.includes('2 devices are publishing this court'), 'conflict alert');
    // The rival is told as well, on its own setup card.
    await eventually(() => rival.getByTestId('link-setup').innerText(), (value) => value.includes('Another device is also publishing Court D'), 'warning on the rival device', 8000);
    await rivalContext.close();
    await eventually(() => tile(director, 'D').innerText(), (value) => !value.includes('devices are publishing'), 'conflict clears', 9000);
    expectEqual(await health(director, 'D'), 'live', 'the original desk is still shown');
  });

  await check('closing the desk signs the court off on the remote director', async () => {
    await desk.close();
    await eventually(() => health(director, 'D'), (value) => value === 'signed-off' || value === 'stale', 'court D after the desk closed', 12000);
  });

  await deskContext.close();
  await directorContext.close();
}

// ---------------------------------------------------------------------------

(async () => {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.error(`No production bundle at ${DIST_DIR}. Run "npm run build" in react_app first.`);
    process.exit(2);
  }
  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch();
  try {
    await sameDeviceScenarios(browser, baseUrl);
    await inviteScenario(browser, baseUrl);
    if (RELAY_URL) await relayScenario(browser, baseUrl);
    else console.log('\nRelay scenario skipped (set COURT_RELAY_URL to run it).');
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
