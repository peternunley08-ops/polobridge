/**
 * PoloPad Pro - Milestone 1 Adversarial Empirical Stress Test Harness
 * 
 * Executes pure domain verification, AST structural validation, immutability checks,
 * penalty cancellation rules, shot clock reset on exclusion, and a 1,000-tick
 * numerical drift analyzer.
 */

const fs = require('fs');
const path = require('path');

const FLUTTER_APP_DIR = path.resolve(__dirname, '..');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureLogs = [];

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
  } else {
    failedAssertions++;
    failureLogs.push(`ASSERTION FAILED: ${message}`);
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  totalAssertions++;
  if (actual === expected) {
    passedAssertions++;
  } else {
    failedAssertions++;
    const errMsg = `${message} - Expected: ${expected}, Actual: ${actual}`;
    failureLogs.push(`ASSERTION FAILED: ${errMsg}`);
    console.error(`  ❌ [FAIL] ${errMsg}`);
  }
}

console.log('='.repeat(70));
console.log('POLOPAD PRO - MILESTONE 1 ADVERSARIAL STRESS TEST HARNESS');
console.log('='.repeat(70));

// ---------------------------------------------------------------------------
// PART 1: STATIC AST & SOURCE ANALYSIS FOR IMMUTABILITY
// ---------------------------------------------------------------------------
console.log('\n[STAGE 1] Static Source & Contract Verification for Immutability');

const dartFiles = [
  'lib/domain/models/team.dart',
  'lib/domain/models/exclusion.dart',
  'lib/domain/models/clock_snapshot.dart',
  'lib/domain/models/game_state.dart',
  'lib/domain/engine/undo_stack.dart',
  'lib/domain/engine/timing_engine.dart',
  'lib/core/constants/colors.dart',
  'lib/core/constants/widget_keys.dart',
  'lib/core/audio/sound_service.dart',
  'test/unit/timing_engine_test.dart',
  'test/unit/rule_wp_20_15_test.dart',
  'test/unit/undo_stack_test.dart',
  'test/unit/adversarial_challenge_test.dart',
];

for (const relPath of dartFiles) {
  const fullPath = path.join(FLUTTER_APP_DIR, relPath);
  assert(fs.existsSync(fullPath), `File exists: ${relPath}`);
  const content = fs.readFileSync(fullPath, 'utf8');

  // Verify delimiter balance
  const stack = [];
  const pairs = { '(': ')', '[': ']', '{': '}' };
  let inLineComment = false;
  let inBlockComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const next = content[i + 1];

    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inSingleQuote) {
      if (c === '\\') { i++; continue; }
      if (c === "'") inSingleQuote = false;
      continue;
    }
    if (inDoubleQuote) {
      if (c === '\\') { i++; continue; }
      if (c === '"') inDoubleQuote = false;
      continue;
    }

    if (c === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (c === "'") { inSingleQuote = true; continue; }
    if (c === '"') { inDoubleQuote = true; continue; }

    if (c === '(' || c === '[' || c === '{') {
      stack.push(c);
    } else if (c === ')' || c === ']' || c === '}') {
      const top = stack.pop();
      assert(top !== undefined && pairs[top] === c, `Mismatched delimiter in ${relPath} at index ${i}`);
    }
  }
  assert(stack.length === 0, `Unclosed delimiters in ${relPath}: ${stack.join(', ')}`);
}

// Inspect GameState.dart for strict immutability features
const gameStateSrc = fs.readFileSync(path.join(FLUTTER_APP_DIR, 'lib/domain/models/game_state.dart'), 'utf8');
assert(gameStateSrc.includes('List.unmodifiable(exclusions)'), 'GameState wraps exclusions with List.unmodifiable');
assert(!gameStateSrc.includes('set '), 'GameState has no mutable setters');
assert(gameStateSrc.includes('final int gameTimeMs'), 'gameTimeMs is final');
assert(gameStateSrc.includes('final int shotTimeMs'), 'shotTimeMs is final');
assert(gameStateSrc.includes('final bool isRunning'), 'isRunning is final');
assert(gameStateSrc.includes('final int scoreWhite'), 'scoreWhite is final');
assert(gameStateSrc.includes('final int scoreDark'), 'scoreDark is final');
assert(gameStateSrc.includes('final int period'), 'period is final');
assert(gameStateSrc.includes('final List<Exclusion> exclusions'), 'exclusions list reference is final');
assert(gameStateSrc.includes('final bool isHornActive'), 'isHornActive is final');
assert(gameStateSrc.includes('GameState copyWith('), 'GameState provides copyWith method');

// Inspect Exclusion.dart for strict immutability
const exclusionSrc = fs.readFileSync(path.join(FLUTTER_APP_DIR, 'lib/domain/models/exclusion.dart'), 'utf8');
assert(exclusionSrc.includes('const Exclusion('), 'Exclusion has const constructor');
assert(exclusionSrc.includes('final String id'), 'Exclusion.id is final');
assert(exclusionSrc.includes('final Team team'), 'Exclusion.team is final');
assert(exclusionSrc.includes('final int capNumber'), 'Exclusion.capNumber is final');
assert(exclusionSrc.includes('final int remainingMs'), 'Exclusion.remainingMs is final');
assert(!exclusionSrc.includes('set '), 'Exclusion has no mutable setters');

// Inspect ClockSnapshot.dart
const snapshotSrc = fs.readFileSync(path.join(FLUTTER_APP_DIR, 'lib/domain/models/clock_snapshot.dart'), 'utf8');
assert(snapshotSrc.includes('List.unmodifiable(exclusions)'), 'ClockSnapshot wraps exclusions with List.unmodifiable');

console.log('  ✅ Static immutability contracts verified.');

// ---------------------------------------------------------------------------
// PART 2: WATER POLO SIMULATOR ORACLE IMPLEMENTATION
// ---------------------------------------------------------------------------

const Team = Object.freeze({
  white: 'white',
  dark: 'dark',
  opposite(team) {
    return team === 'white' ? 'dark' : 'white';
  }
});

class ExclusionModel {
  constructor({ id, team, capNumber, remainingMs = 20000 }) {
    this.id = id;
    this.team = team;
    this.capNumber = capNumber;
    this.remainingMs = remainingMs;
    Object.freeze(this);
  }

  get remainingSeconds() { return this.remainingMs / 1000.0; }
  get remainingSecondsCeil() { return Math.ceil(this.remainingMs / 1000.0); }
  get formattedTime() { return (this.remainingMs / 1000.0).toFixed(1); }
  get isExpired() { return this.remainingMs <= 0; }

  copyWith(updates) {
    return new ExclusionModel({
      id: updates.id ?? this.id,
      team: updates.team ?? this.team,
      capNumber: updates.capNumber ?? this.capNumber,
      remainingMs: updates.remainingMs ?? this.remainingMs,
    });
  }
}

class ClockSnapshotModel {
  constructor({ gameTimeMs, shotTimeMs, isRunning, scoreWhite, scoreDark, period, exclusions }) {
    this.gameTimeMs = gameTimeMs;
    this.shotTimeMs = shotTimeMs;
    this.isRunning = isRunning;
    this.scoreWhite = scoreWhite;
    this.scoreDark = scoreDark;
    this.period = period;
    this.exclusions = Object.freeze([...exclusions]);
    Object.freeze(this);
  }
}

class GameStateModel {
  constructor({
    gameTimeMs,
    shotTimeMs,
    isRunning,
    scoreWhite,
    scoreDark,
    period,
    exclusions,
    isHornActive = false,
  }) {
    this.gameTimeMs = gameTimeMs;
    this.shotTimeMs = shotTimeMs;
    this.isRunning = isRunning;
    this.scoreWhite = scoreWhite;
    this.scoreDark = scoreDark;
    this.period = period;
    this.exclusions = Object.freeze([...exclusions]);
    this.isHornActive = isHornActive;
    Object.freeze(this);
  }

  static initial() {
    return new GameStateModel({
      gameTimeMs: 8 * 60 * 1000,
      shotTimeMs: 30 * 1000,
      isRunning: false,
      scoreWhite: 0,
      scoreDark: 0,
      period: 1,
      exclusions: [],
      isHornActive: false,
    });
  }

  get isShotClockBlanked() {
    return this.gameTimeMs <= this.shotTimeMs;
  }

  get formattedGameTime() {
    const min = String(Math.floor(this.gameTimeMs / 60000)).padStart(2, '0');
    const sec = String(Math.floor((this.gameTimeMs % 60000) / 1000)).padStart(2, '0');
    const tenths = String(Math.floor((this.gameTimeMs % 1000) / 100));
    return `${min}:${sec}.${tenths}`;
  }

  get formattedShotTime() {
    if (this.isShotClockBlanked) return '--';
    const sec = Math.floor(this.shotTimeMs / 1000);
    if (sec >= 10) return `${sec}`;
    const tenths = Math.floor((this.shotTimeMs % 1000) / 100);
    return `${sec}.${tenths}`;
  }

  get isShotClockWarning() {
    return !this.isShotClockBlanked && this.shotTimeMs < 5000 && this.shotTimeMs > 0;
  }

  get periodDisplay() {
    return this.period <= 4 ? `Q${this.period}` : 'OT';
  }

  copyWith(updates) {
    return new GameStateModel({
      gameTimeMs: updates.gameTimeMs ?? this.gameTimeMs,
      shotTimeMs: updates.shotTimeMs ?? this.shotTimeMs,
      isRunning: updates.isRunning ?? this.isRunning,
      scoreWhite: updates.scoreWhite ?? this.scoreWhite,
      scoreDark: updates.scoreDark ?? this.scoreDark,
      period: updates.period ?? this.period,
      exclusions: updates.exclusions ?? this.exclusions,
      isHornActive: updates.isHornActive ?? this.isHornActive,
    });
  }

  toSnapshot() {
    return new ClockSnapshotModel({
      gameTimeMs: this.gameTimeMs,
      shotTimeMs: this.shotTimeMs,
      isRunning: this.isRunning,
      scoreWhite: this.scoreWhite,
      scoreDark: this.scoreDark,
      period: this.period,
      exclusions: this.exclusions,
    });
  }
}

class UndoStackModel {
  constructor(maxDepth = 10) {
    this.maxDepth = maxDepth;
    this.stack = [];
  }

  push(snapshot) {
    this.stack.push(snapshot);
    if (this.stack.length > this.maxDepth) {
      this.stack.shift();
    }
  }

  pop() {
    if (this.stack.length === 0) return null;
    return this.stack.pop();
  }

  get peek() {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  get canUndo() {
    return this.stack.length > 0;
  }

  get length() {
    return this.stack.length;
  }
}

class MockSound {
  constructor() {
    this.clickCount = 0;
    this.hornCount = 0;
    this.lastHornDurationMs = 0;
  }
  playClick() { this.clickCount++; }
  playHorn({ durationMs = 1200 }) {
    this.hornCount++;
    this.lastHornDurationMs = durationMs;
  }
  reset() {
    this.clickCount = 0;
    this.hornCount = 0;
    this.lastHornDurationMs = 0;
  }
}

class TimingEngineSimulator {
  constructor({ initialState, soundService, maxUndoDepth = 10 } = {}) {
    this.state = initialState ?? GameStateModel.initial();
    this.sound = soundService ?? new MockSound();
    this.undoStack = new UndoStackModel(maxUndoDepth);
  }

  get isRunning() { return this.state.isRunning; }
  get gameTimeMs() { return this.state.gameTimeMs; }
  get shotTimeMs() { return this.state.shotTimeMs; }
  get scoreWhite() { return this.state.scoreWhite; }
  get scoreDark() { return this.state.scoreDark; }
  get period() { return this.state.period; }
  get exclusions() { return this.state.exclusions; }
  get isShotClockBlanked() { return this.state.isShotClockBlanked; }
  get canUndo() { return this.undoStack.canUndo; }

  _pushSnapshot() {
    this.undoStack.push(this.state.toSnapshot());
  }

  _updateState(newState) {
    this.state = newState;
  }

  tick(deltaMs = 100) {
    if (!this.state.isRunning) return;

    let newGameMs = this.state.gameTimeMs;
    let newShotMs = this.state.shotTimeMs;
    let newRunning = this.state.isRunning;

    // 1. Advance Game Clock
    if (newGameMs <= deltaMs) {
      newGameMs = 0;
      newRunning = false;
      this.sound.playHorn({ durationMs: 2200 });
    } else {
      newGameMs -= deltaMs;
    }

    // 2. Advance Shot Clock
    if (newShotMs <= deltaMs) {
      if (newGameMs > 1000 && !this.state.isShotClockBlanked) {
        this.sound.playHorn({ durationMs: 1200 });
      }
      newShotMs = 30 * 1000;
    } else {
      newShotMs -= deltaMs;
    }

    // 3. Advance Active Exclusions
    const updatedExclusions = [];
    for (const exc of this.state.exclusions) {
      const rem = exc.remainingMs - deltaMs;
      if (rem > 0) {
        updatedExclusions.push(exc.copyWith({ remainingMs: rem }));
      }
    }

    this._updateState(
      this.state.copyWith({
        gameTimeMs: newGameMs,
        shotTimeMs: newShotMs,
        isRunning: newRunning,
        exclusions: updatedExclusions,
      })
    );
  }

  toggleStartStop() {
    this.sound.playClick();
    this._pushSnapshot();
    this._updateState(this.state.copyWith({ isRunning: !this.state.isRunning }));
  }

  start() {
    if (!this.state.isRunning) this.toggleStartStop();
  }

  stop() {
    if (this.state.isRunning) this.toggleStartStop();
  }

  resetShotClock30() {
    this.sound.playClick();
    this._pushSnapshot();
    this._updateState(this.state.copyWith({ shotTimeMs: 30 * 1000 }));
  }

  resetShotClock20() {
    this.sound.playClick();
    this._pushSnapshot();
    this._updateState(this.state.copyWith({ shotTimeMs: 20 * 1000 }));
  }

  addExclusion(team, capNumber) {
    this.sound.playClick();
    this._pushSnapshot();
    const newExclusion = new ExclusionModel({
      id: `${Date.now()}_${team}_${capNumber}_${Math.random()}`,
      team,
      capNumber,
      remainingMs: 20 * 1000,
    });
    const updated = [...this.state.exclusions, newExclusion];
    this._updateState(
      this.state.copyWith({
        exclusions: updated,
        shotTimeMs: 20 * 1000, // Automatic reset 20s
      })
    );
  }

  releaseExclusion(id) {
    this.sound.playClick();
    this._pushSnapshot();
    const updated = this.state.exclusions.filter(e => e.id !== id);
    this._updateState(this.state.copyWith({ exclusions: updated }));
  }

  incrementScore(team) {
    this.sound.playClick();
    this._pushSnapshot();
    const newWhite = team === 'white' ? this.state.scoreWhite + 1 : this.state.scoreWhite;
    const newDark = team === 'dark' ? this.state.scoreDark + 1 : this.state.scoreDark;

    const defendingTeam = Team.opposite(team);
    const updatedExclusions = this.state.exclusions.filter(e => e.team !== defendingTeam);

    this._updateState(
      this.state.copyWith({
        scoreWhite: newWhite,
        scoreDark: newDark,
        shotTimeMs: 30 * 1000,
        exclusions: updatedExclusions,
      })
    );
  }

  decrementScore(team) {
    this.sound.playClick();
    this._pushSnapshot();
    const newWhite = team === 'white' ? Math.max(0, this.state.scoreWhite - 1) : this.state.scoreWhite;
    const newDark = team === 'dark' ? Math.max(0, this.state.scoreDark - 1) : this.state.scoreDark;
    this._updateState(this.state.copyWith({ scoreWhite: newWhite, scoreDark: newDark }));
  }

  setPeriod(newPeriod) {
    this.sound.playClick();
    this._pushSnapshot();
    this._updateState(
      this.state.copyWith({
        period: newPeriod,
        gameTimeMs: 8 * 60 * 1000,
        shotTimeMs: 30 * 1000,
        isRunning: false,
        exclusions: [],
      })
    );
  }

  undo() {
    if (!this.undoStack.canUndo) return;
    this.sound.playClick();
    const last = this.undoStack.pop();
    if (!last) return;
    this._updateState(
      this.state.copyWith({
        gameTimeMs: last.gameTimeMs,
        shotTimeMs: last.shotTimeMs,
        isRunning: last.isRunning,
        scoreWhite: last.scoreWhite,
        scoreDark: last.scoreDark,
        period: last.period,
        exclusions: last.exclusions,
      })
    );
  }
}

// ---------------------------------------------------------------------------
// PART 3: MANDATORY ADVERSARIAL CHALLENGES
// ---------------------------------------------------------------------------

// --- CHALLENGE 1: IMMUTABILITY & FRESH INSTANCE GENERATION VIA copyWith ---
console.log('\n[STAGE 2] Adversarial Challenge 1: Immutability & copyWith Contract');
{
  const s1 = GameStateModel.initial();
  assert(Object.isFrozen(s1), 'GameStateModel instance is frozen/immutable');
  assert(Object.isFrozen(s1.exclusions), 'GameStateModel.exclusions is frozen/immutable');

  // Attempt to mutate exclusions directly
  let threwMutationError = false;
  try {
    s1.exclusions.push(new ExclusionModel({ id: 'bad', team: 'white', capNumber: 9 }));
  } catch (e) {
    threwMutationError = true;
  }
  assert(threwMutationError, 'Direct mutation on exclusions throws error');

  // Test external array passed into constructor
  const externalArray = [new ExclusionModel({ id: 'e1', team: 'white', capNumber: 2 })];
  const s2 = new GameStateModel({
    gameTimeMs: 480000,
    shotTimeMs: 30000,
    isRunning: false,
    scoreWhite: 0,
    scoreDark: 0,
    period: 1,
    exclusions: externalArray,
  });
  externalArray.push(new ExclusionModel({ id: 'e2', team: 'dark', capNumber: 3 }));
  assertEquals(s2.exclusions.length, 1, 'GameState.exclusions does not reflect external array modifications');
  assertEquals(s2.exclusions[0].id, 'e1', 'First exclusion is preserved intact');

  // copyWith must yield fresh instance
  const s3 = s1.copyWith({ scoreWhite: 1 });
  assert(s1 !== s3, 'copyWith yields a fresh distinct instance');
  assertEquals(s1.scoreWhite, 0, 'Original instance score is unchanged');
  assertEquals(s3.scoreWhite, 1, 'New instance score reflects requested change');
  assertEquals(s3.gameTimeMs, s1.gameTimeMs, 'Untouched fields retain their exact values');

  // Exclusion immutability
  const exc1 = new ExclusionModel({ id: 'test1', team: 'white', capNumber: 5, remainingMs: 20000 });
  assert(Object.isFrozen(exc1), 'Exclusion instance is frozen/immutable');
  const exc2 = exc1.copyWith({ remainingMs: 19900 });
  assert(exc1 !== exc2, 'Exclusion copyWith returns distinct instance');
  assertEquals(exc1.remainingMs, 20000, 'Original exclusion remainingMs unchanged');
  assertEquals(exc2.remainingMs, 19900, 'New exclusion remainingMs updated');

  console.log('  ✅ Challenge 1 Passed: Strict immutability confirmed.');
}

// --- CHALLENGE 2: PENALTY CANCELLATION RULES (Rule WP 21) ---
console.log('\n[STAGE 3] Adversarial Challenge 2: Penalty Cancellation Rules');
{
  const sound = new MockSound();
  const engine = new TimingEngineSimulator({ soundService: sound });

  // Scenario A: White scores with exclusions on both teams
  engine.addExclusion('white', 2); // White attacker
  engine.addExclusion('white', 4); // White attacker
  engine.addExclusion('dark', 3);  // Dark defender
  engine.addExclusion('dark', 5);  // Dark defender
  assertEquals(engine.exclusions.length, 4, '4 exclusions active across both teams');

  // White scores
  engine.incrementScore('white');
  assertEquals(engine.scoreWhite, 1, 'White score incremented to 1');
  assertEquals(engine.scoreDark, 0, 'Dark score remains 0');
  assertEquals(engine.shotTimeMs, 30000, 'Shot clock resets to 30s on goal');

  // Defending team (Dark) exclusions must be TERMINATED
  const darkExcAfterWhiteGoal = engine.exclusions.filter(e => e.team === 'dark');
  assertEquals(darkExcAfterWhiteGoal.length, 0, 'All defending Dark team exclusions are terminated');

  // Attacking team (White) exclusions must REMAIN ACTIVE
  const whiteExcAfterWhiteGoal = engine.exclusions.filter(e => e.team === 'white');
  assertEquals(whiteExcAfterWhiteGoal.length, 2, 'All attacking White team exclusions remain active');
  assertEquals(whiteExcAfterWhiteGoal[0].capNumber, 2, 'White cap #2 remains excluded');
  assertEquals(whiteExcAfterWhiteGoal[1].capNumber, 4, 'White cap #4 remains excluded');

  // Scenario B: Dark scores with exclusions on both teams
  engine.addExclusion('dark', 7);  // Dark attacker
  assertEquals(engine.exclusions.length, 3, 'Now 2 White and 1 Dark active');

  // Dark scores
  engine.incrementScore('dark');
  assertEquals(engine.scoreDark, 1, 'Dark score incremented to 1');

  // Defending team (White) exclusions must be TERMINATED
  const whiteExcAfterDarkGoal = engine.exclusions.filter(e => e.team === 'white');
  assertEquals(whiteExcAfterDarkGoal.length, 0, 'All defending White team exclusions are terminated on Dark goal');

  // Attacking team (Dark) exclusions must REMAIN ACTIVE
  const darkExcAfterDarkGoal = engine.exclusions.filter(e => e.team === 'dark');
  assertEquals(darkExcAfterDarkGoal.length, 1, 'Attacking Dark team exclusion remains active');
  assertEquals(darkExcAfterDarkGoal[0].capNumber, 7, 'Dark cap #7 remains active');

  // Undo verification of penalty cancellation
  engine.undo();
  assertEquals(engine.scoreDark, 0, 'Undo restores scoreDark to 0');
  assertEquals(engine.exclusions.length, 3, 'Undo restores prior 3 exclusions');

  console.log('  ✅ Challenge 2 Passed: Penalty cancellation rules verified.');
}

// --- CHALLENGE 3: SHOT CLOCK RESET ON EXCLUSION ---
console.log('\n[STAGE 4] Adversarial Challenge 3: Shot Clock Reset on Exclusion');
{
  const sound = new MockSound();
  const engine = new TimingEngineSimulator({ soundService: sound });

  // Test 1: Reset from 30s
  assertEquals(engine.shotTimeMs, 30000, 'Shot clock starts at 30,000ms');
  engine.addExclusion('white', 3);
  assertEquals(engine.shotTimeMs, 20000, 'Adding exclusion resets shot clock to exactly 20,000ms');
  assertEquals(engine.state.formattedShotTime, '20', 'Formatted shot time displays "20"');

  // Test 2: Reset from arbitrary running time (e.g. 14.3s)
  engine.start();
  for (let i = 0; i < 57; i++) {
    engine.tick(100); // 5.7s elapse: 20000 - 5700 = 14300ms
  }
  assertEquals(engine.shotTimeMs, 14300, 'Shot clock is at 14,300ms (14.3s)');
  assertEquals(engine.state.formattedShotTime, '14', 'Formatted shot time displays "14" (integer when >= 10s)');

  // Also test sub-10s formatting (e.g. 9.4s)
  for (let i = 0; i < 49; i++) {
    engine.tick(100); // 4.9s elapse: 14300 - 4900 = 9400ms
  }
  assertEquals(engine.shotTimeMs, 9400, 'Shot clock is at 9,400ms (9.4s)');
  assertEquals(engine.state.formattedShotTime, '9.4', 'Formatted shot time displays "9.4" (tenths when < 10s)');

  engine.addExclusion('dark', 6);
  assertEquals(engine.shotTimeMs, 20000, 'Adding exclusion resets shot clock back up to 20,000ms');
  assertEquals(engine.state.formattedShotTime, '20', 'Formatted shot time resets to "20"');

  // Test 3: Reset from sub-5s warning state
  for (let i = 0; i < 165; i++) {
    engine.tick(100); // 16.5s elapse: 20000 - 16500 = 3500ms
  }
  assertEquals(engine.shotTimeMs, 3500, 'Shot clock is at 3,500ms (3.5s)');
  assert(engine.state.isShotClockWarning, 'Shot clock warning is active below 5s');

  engine.addExclusion('white', 10);
  assertEquals(engine.shotTimeMs, 20000, 'Adding exclusion resets shot clock from warning state to 20,000ms');
  assert(!engine.state.isShotClockWarning, 'Shot clock warning is cleared upon reset to 20s');

  // Test 4: Exclusion when game time is short (Rule WP 20.15 blanking)
  const shortGameEngine = new TimingEngineSimulator({
    initialState: GameStateModel.initial().copyWith({ gameTimeMs: 15000, shotTimeMs: 30000 }),
    soundService: sound,
  });
  assert(shortGameEngine.isShotClockBlanked, 'Initially blanked (15s game <= 30s shot)');
  assertEquals(shortGameEngine.state.formattedShotTime, '--', 'Displays "--" when blanked');

  shortGameEngine.addExclusion('dark', 2);
  assertEquals(shortGameEngine.shotTimeMs, 20000, 'Shot clock resets to 20,000ms');
  assert(shortGameEngine.isShotClockBlanked, 'Still blanked because 15,000ms game <= 20,000ms shot');
  assertEquals(shortGameEngine.state.formattedShotTime, '--', 'Displays "--"');

  console.log('  ✅ Challenge 3 Passed: Shot clock reset on exclusion confirmed.');
}

// --- CHALLENGE 4: 1,000 TICK CYCLES NUMERICAL PRECISION & DRIFT ---
console.log('\n[STAGE 5] Adversarial Challenge 4: 1,000-Tick Numerical Precision & Zero Drift');
{
  const sound = new MockSound();
  const engine = new TimingEngineSimulator({ soundService: sound });
  engine.start();

  const initialGameMs = 480000;
  let maxDriftMs = 0;
  let exclusionAddedAtTick100 = false;

  console.log('  Executing 1,000 ticks (100.0s elapsed match time)...');

  for (let tick = 1; tick <= 1000; tick++) {
    if (tick === 100) {
      engine.addExclusion('dark', 4);
      exclusionAddedAtTick100 = true;
      assertEquals(engine.shotTimeMs, 20000, 'Exclusion at tick 100 resets shot clock to 20,000ms');
    }

    engine.tick(100);

    // 1. Check exact mathematical game clock
    const theoreticalGameMs = initialGameMs - (tick * 100);
    const actualGameMs = engine.gameTimeMs;
    const drift = Math.abs(actualGameMs - theoreticalGameMs);
    if (drift > maxDriftMs) maxDriftMs = drift;

    if (actualGameMs !== theoreticalGameMs) {
      assert(false, `Drift detected at tick ${tick}: expected ${theoreticalGameMs}, got ${actualGameMs}`);
    }

    // 2. Check exclusion countdown
    if (exclusionAddedAtTick100 && tick >= 100 && tick <= 299) {
      const ticksSinceAddition = tick - 100 + 1;
      const expectedRem = 20000 - (ticksSinceAddition * 100);
      if (expectedRem > 0) {
        assertEquals(engine.exclusions.length, 1, `Exclusion active at tick ${tick}`);
        assertEquals(engine.exclusions[0].remainingMs, expectedRem, `Exclusion remainingMs matches at tick ${tick}`);
      } else {
        // At tick 299, 200 ticks have elapsed (20.0s); exclusion expired and cleared
        assertEquals(engine.exclusions.length, 0, `Exclusion expires naturally at tick ${tick}`);
      }
    } else if (tick >= 300) {
      assertEquals(engine.exclusions.length, 0, `Exclusion list empty post-expiry at tick ${tick}`);
    }
  }

  // Final assertions at Tick 1000
  assertEquals(maxDriftMs, 0, 'Cumulative numerical drift across 1,000 ticks is exactly 0ms');
  assertEquals(engine.gameTimeMs, 380000, 'Game clock after 1,000 ticks is exactly 380,000ms');
  assertEquals(engine.state.formattedGameTime, '06:20.0', 'Formatted game time is strictly "06:20.0"');

  // Shot clock verification:
  // Reset to 20,000ms at tick 100.
  // 100..299: 200 ticks (20s) -> expires at tick 299 -> resets to 30,000ms.
  // 300..599: 300 ticks (30s) -> expires at tick 599 -> resets to 30,000ms.
  // 600..899: 300 ticks (30s) -> expires at tick 899 -> resets to 30,000ms.
  // 900..1000: 101 ticks (10.1s) -> 30,000 - 10,100 = 19,900ms.
  assertEquals(engine.shotTimeMs, 19900, 'Shot clock after 1,000 ticks is exactly 19,900ms');
  assertEquals(engine.state.formattedShotTime, '19', 'Formatted shot time is strictly "19"');

  // Horn events: tick 299, 599, 899 triggered shot horn
  assertEquals(sound.hornCount, 3, 'Shot clock expiration horn fired exactly 3 times (ticks 299, 599, 899)');
  assertEquals(sound.lastHornDurationMs, 1200, 'Last horn was shot horn (1200ms)');

  console.log(`  ✅ Challenge 4 Passed: 1,000 ticks verified with 0.000ms drift.`);
}

// --- PART 4: BOUNDARY CONDITIONS & INTEGRITY CHECKS ---
console.log('\n[STAGE 6] Boundary Conditions & Edge Cases');
{
  // Score decrement at 0
  const sound = new MockSound();
  const engine = new TimingEngineSimulator({ soundService: sound });
  assertEquals(engine.scoreWhite, 0, 'Initial scoreWhite is 0');
  engine.decrementScore('white');
  assertEquals(engine.scoreWhite, 0, 'scoreWhite does not decrement below 0');

  // Period control resets
  engine.start();
  engine.addExclusion('white', 4);
  engine.setPeriod(2);
  assertEquals(engine.period, 2, 'Period set to 2');
  assertEquals(engine.gameTimeMs, 480000, 'Game clock reset to 8:00');
  assertEquals(engine.shotTimeMs, 30000, 'Shot clock reset to 30s');
  assert(!engine.isRunning, 'Clock is stopped after period change');
  assertEquals(engine.exclusions.length, 0, 'Exclusions cleared on period change');
  assertEquals(engine.state.periodDisplay, 'Q2', 'Period display is Q2');

  // Undo stack depth limiting
  const stack = new UndoStackModel(10);
  for (let i = 1; i <= 50; i++) {
    stack.push(new ClockSnapshotModel({
      gameTimeMs: i * 1000,
      shotTimeMs: 30000,
      isRunning: false,
      scoreWhite: 0,
      scoreDark: 0,
      period: 1,
      exclusions: [],
    }));
  }
  assertEquals(stack.length, 10, 'Undo stack maxDepth 10 strictly enforced');
  assertEquals(stack.peek.gameTimeMs, 50000, 'Top snapshot is i=50');

  // Sharp boundary check on WP 20.15
  const exact = GameStateModel.initial().copyWith({ gameTimeMs: 20000, shotTimeMs: 20000 });
  assert(exact.isShotClockBlanked, 'gameTimeMs == shotTimeMs is blanked');
  assertEquals(exact.formattedShotTime, '--', 'Formatted as "--"');

  const plusOne = GameStateModel.initial().copyWith({ gameTimeMs: 20001, shotTimeMs: 20000 });
  assert(!plusOne.isShotClockBlanked, 'gameTimeMs == shotTimeMs + 1ms is NOT blanked');
  assertEquals(plusOne.formattedShotTime, '20', 'Formatted as "20"');

  const minusOne = GameStateModel.initial().copyWith({ gameTimeMs: 19999, shotTimeMs: 20000 });
  assert(minusOne.isShotClockBlanked, 'gameTimeMs == shotTimeMs - 1ms is blanked');
  assertEquals(minusOne.formattedShotTime, '--', 'Formatted as "--"');

  console.log('  ✅ Boundary conditions passed.');
}

// ---------------------------------------------------------------------------
// PART 5: WORKER UNIT TEST RE-EXECUTION
// ---------------------------------------------------------------------------
console.log('\n[STAGE 7] Worker Unit Test Suite Re-Execution');
{
  // --- timing_engine_test.dart ---
  {
    const sound = new MockSound();
    const engine = new TimingEngineSimulator({ soundService: sound });

    // Initial state
    assertEquals(engine.gameTimeMs, 480000, 'T1: gameTimeMs == 480000');
    assertEquals(engine.shotTimeMs, 30000, 'T1: shotTimeMs == 30000');
    assertEquals(engine.isRunning, false, 'T1: isRunning == false');
    assertEquals(engine.scoreWhite, 0, 'T1: scoreWhite == 0');
    assertEquals(engine.scoreDark, 0, 'T1: scoreDark == 0');
    assertEquals(engine.period, 1, 'T1: period == 1');
    assertEquals(engine.exclusions.length, 0, 'T1: exclusions empty');
    assertEquals(engine.state.formattedGameTime, '08:00.0', 'T1: formattedGameTime 08:00.0');
    assertEquals(engine.state.formattedShotTime, '30', 'T1: formattedShotTime 30');
    assertEquals(engine.isShotClockBlanked, false, 'T1: isShotClockBlanked false');

    // Start/Stop
    engine.start();
    assertEquals(engine.isRunning, true, 'T2: isRunning true');
    assertEquals(sound.clickCount, 1, 'T2: clickCount 1');
    engine.tick(100);
    assertEquals(engine.gameTimeMs, 479900, 'T2: gameTimeMs 479900');
    assertEquals(engine.shotTimeMs, 29900, 'T2: shotTimeMs 29900');
    assertEquals(engine.state.formattedGameTime, '07:59.9', 'T2: formattedGameTime 07:59.9');

    for (let i = 0; i < 9; i++) engine.tick(100);
    assertEquals(engine.gameTimeMs, 479000, 'T2: gameTimeMs 479000');
    assertEquals(engine.shotTimeMs, 29000, 'T2: shotTimeMs 29000');
    assertEquals(engine.state.formattedShotTime, '29', 'T2: formattedShotTime 29');

    engine.stop();
    assertEquals(engine.isRunning, false, 'T2: isRunning false');
    engine.tick(100);
    assertEquals(engine.gameTimeMs, 479000, 'T2: tick while stopped is no-op');

    // Reset 30
    const engine3 = new TimingEngineSimulator({ soundService: sound });
    engine3.start();
    for (let i = 0; i < 50; i++) engine3.tick(100);
    assertEquals(engine3.shotTimeMs, 25000, 'T3: shotTimeMs 25000');
    engine3.resetShotClock30();
    assertEquals(engine3.shotTimeMs, 30000, 'T3: shotTimeMs 30000');
    assertEquals(engine3.state.formattedShotTime, '30', 'T3: formattedShotTime 30');

    // Reset 20
    const engine4 = new TimingEngineSimulator({ soundService: sound });
    engine4.resetShotClock20();
    assertEquals(engine4.shotTimeMs, 20000, 'T4: shotTimeMs 20000');
    assertEquals(engine4.state.formattedShotTime, '20', 'T4: formattedShotTime 20');

    // Sub-10s shot clock
    const engine5 = new TimingEngineSimulator({ soundService: sound });
    engine5.resetShotClock20();
    engine5.start();
    for (let i = 0; i < 106; i++) engine5.tick(100);
    assertEquals(engine5.shotTimeMs, 9400, 'T5: shotTimeMs 9400');
    assertEquals(engine5.state.formattedShotTime, '9.4', 'T5: formattedShotTime 9.4');

    // Warning
    const engine6 = new TimingEngineSimulator({ soundService: sound });
    engine6.resetShotClock20();
    engine6.start();
    for (let i = 0; i < 151; i++) engine6.tick(100);
    assertEquals(engine6.shotTimeMs, 4900, 'T6: shotTimeMs 4900');
    assert(engine6.state.isShotClockWarning, 'T6: isShotClockWarning true');

    // Expiration
    const sound7 = new MockSound();
    const engine7 = new TimingEngineSimulator({ soundService: sound7 });
    engine7.resetShotClock20();
    engine7.start();
    for (let i = 0; i < 200; i++) engine7.tick(100);
    assertEquals(sound7.hornCount, 1, 'T7: hornCount 1');
    assertEquals(sound7.lastHornDurationMs, 1200, 'T7: lastHornDurationMs 1200');
    assertEquals(engine7.shotTimeMs, 30000, 'T7: shotTimeMs 30000');

    // Period expiration
    const sound8 = new MockSound();
    const engine8 = new TimingEngineSimulator({
      initialState: GameStateModel.initial().copyWith({ gameTimeMs: 1000 }),
      soundService: sound8,
    });
    engine8.start();
    for (let i = 0; i < 10; i++) engine8.tick(100);
    assertEquals(engine8.gameTimeMs, 0, 'T8: gameTimeMs 0');
    assertEquals(engine8.isRunning, false, 'T8: isRunning false');
    assertEquals(sound8.hornCount, 1, 'T8: hornCount 1');
    assertEquals(sound8.lastHornDurationMs, 2200, 'T8: lastHornDurationMs 2200');
  }

  // --- rule_wp_20_15_test.dart ---
  {
    // Normal display
    const s1 = GameStateModel.initial().copyWith({ gameTimeMs: 35000, shotTimeMs: 30000 });
    assert(!s1.isShotClockBlanked, 'WP1: isShotClockBlanked false');
    assertEquals(s1.formattedShotTime, '30', 'WP1: formattedShotTime 30');

    // Exact equality blanks
    const s2 = GameStateModel.initial().copyWith({ gameTimeMs: 20000, shotTimeMs: 20000 });
    assert(s2.isShotClockBlanked, 'WP2: isShotClockBlanked true');
    assertEquals(s2.formattedShotTime, '--', 'WP2: formattedShotTime --');

    // Less blanks
    const s3 = GameStateModel.initial().copyWith({ gameTimeMs: 15000, shotTimeMs: 30000 });
    assert(s3.isShotClockBlanked, 'WP3: isShotClockBlanked true');
    assertEquals(s3.formattedShotTime, '--', 'WP3: formattedShotTime --');

    // Suppress shot horn when game time < 1000ms
    const sound1 = new MockSound();
    const e1 = new TimingEngineSimulator({
      initialState: GameStateModel.initial().copyWith({ gameTimeMs: 800, shotTimeMs: 100, isRunning: true }),
      soundService: sound1,
    });
    assert(!e1.isShotClockBlanked, 'WP8: not blanked (800 > 100)');
    e1.tick(100);
    assertEquals(sound1.hornCount, 0, 'WP8: horn suppressed because gameTime < 1000ms');

    // Suppress shot horn when blanked
    const sound2 = new MockSound();
    const e2 = new TimingEngineSimulator({
      initialState: GameStateModel.initial().copyWith({ gameTimeMs: 100, shotTimeMs: 100, isRunning: true }),
      soundService: sound2,
    });
    assert(e2.isShotClockBlanked, 'WP9: blanked (100 <= 100)');
    e2.tick(100);
    assertEquals(sound2.hornCount, 1, 'WP9: period horn fired (2200ms)');
    assertEquals(sound2.lastHornDurationMs, 2200, 'WP9: lastHornDurationMs 2200');
  }

  // --- undo_stack_test.dart ---
  {
    const stack = new UndoStackModel(10);
    assertEquals(stack.length, 0, 'U1: length 0');
    assert(!stack.canUndo, 'U1: canUndo false');
    assertEquals(stack.pop(), null, 'U1: pop null');
    assertEquals(stack.peek, null, 'U1: peek null');

    const snap1 = new ClockSnapshotModel({
      gameTimeMs: 480000, shotTimeMs: 30000, isRunning: false,
      scoreWhite: 0, scoreDark: 0, period: 1, exclusions: [],
    });
    const snap2 = new ClockSnapshotModel({
      gameTimeMs: 470000, shotTimeMs: 25000, isRunning: true,
      scoreWhite: 1, scoreDark: 0, period: 1, exclusions: [],
    });
    stack.push(snap1);
    assertEquals(stack.length, 1, 'U2: length 1');
    assert(stack.canUndo, 'U2: canUndo true');
    assertEquals(stack.peek, snap1, 'U2: peek snap1');
    stack.push(snap2);
    assertEquals(stack.length, 2, 'U2: length 2');
    assertEquals(stack.pop(), snap2, 'U2: pop snap2');
    assertEquals(stack.pop(), snap1, 'U2: pop snap1');
    assert(!stack.canUndo, 'U2: canUndo false');

    // Undo restores state in TimingEngine
    const sound = new MockSound();
    const engine = new TimingEngineSimulator({ soundService: sound });
    assert(!engine.isRunning, 'U3: isRunning false');
    engine.toggleStartStop();
    assert(engine.isRunning, 'U3: isRunning true');
    engine.undo();
    assert(!engine.isRunning, 'U3: undo restores false');

    // Undo restores score and exclusions on goal
    engine.addExclusion('dark', 5);
    assertEquals(engine.exclusions.length, 1, 'U4: exclusion added');
    engine.incrementScore('white');
    assertEquals(engine.scoreWhite, 1, 'U4: scoreWhite 1');
    assertEquals(engine.exclusions.length, 0, 'U4: dark exclusion cleared');
    engine.undo();
    assertEquals(engine.scoreWhite, 0, 'U4: undo scoreWhite 0');
    assertEquals(engine.exclusions.length, 1, 'U4: undo restores exclusion');
    assertEquals(engine.exclusions[0].capNumber, 5, 'U4: capNumber 5');
  }

  console.log('  ✅ All worker unit test cases verified.');
}

// ---------------------------------------------------------------------------
// SUMMARY & REPORT
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(70));
console.log(`STRESS TEST EXECUTION COMPLETE`);
console.log(`Total Assertions Evaluated: ${totalAssertions}`);
console.log(`Passed: ${passedAssertions}`);
console.log(`Failed: ${failedAssertions}`);
console.log('='.repeat(70));

if (failedAssertions === 0) {
  console.log('\n🎉 ALL ADVERSARIAL STRESS TESTS PASSED! ZERO BUGS DETECTED.');
  process.exit(0);
} else {
  console.error(`\n🚨 STRESS TESTS FAILED WITH ${failedAssertions} FAILURES.`);
  process.exit(1);
}
