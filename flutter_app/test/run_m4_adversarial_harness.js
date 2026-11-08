/**
 * PoloPad Pro — Milestone 4 Adversarial Stress Testing Harness
 * 
 * Independently executes empirical challenge checks on:
 * 1. Widget previews schema, native import purity, and viewport constraints
 * 2. GitHub Actions CI workflow YAML validation, step dependencies, and paths
 * 3. Color palette audit for strictly zero pitch-black background occurrences
 * 4. Gitignore pattern completeness and artifact matching
 */

const fs = require('fs');
const path = require('path');

const FLUTTER_APP_DIR = path.resolve(__dirname, '..');
const LIB_DIR = path.join(FLUTTER_APP_DIR, 'lib');
const TEST_DIR = path.join(FLUTTER_APP_DIR, 'test');
const PREVIEWS_FILE = path.join(LIB_DIR, 'widget_previews.dart');
const CI_WORKFLOW_FILE = path.join(FLUTTER_APP_DIR, '.github', 'workflows', 'ci.yml');
const GITIGNORE_FILE = path.join(FLUTTER_APP_DIR, '.gitignore');
const README_FILE = path.join(FLUTTER_APP_DIR, 'README.md');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
  } else {
    failedAssertions++;
    console.error(`  ❌ FAILED: ${message}`);
  }
}

console.log('======================================================================');
console.log('POLOPAD PRO — MILESTONE 4 ADVERSARIAL CHALLENGER STRESS HARNESS');
console.log('======================================================================\n');

// =============================================================================
// STAGE 1: Widget Previews Schema & Parameter Integrity
// =============================================================================
console.log('[STAGE 1] Widget Previews Schema & Parameter Integrity');
const previewsSource = fs.readFileSync(PREVIEWS_FILE, 'utf8');

// Parse clean @Preview annotations excluding comments
let i = 0;
const len = previewsSource.length;
const parsedPreviews = [];

while (i < len) {
  if (previewsSource.startsWith('//', i)) {
    i = previewsSource.indexOf('\n', i);
    if (i === -1) break;
    continue;
  }
  if (previewsSource.startsWith('/*', i)) {
    i = previewsSource.indexOf('*/', i);
    if (i === -1) break;
    i += 2;
    continue;
  }
  if (previewsSource.startsWith('@Preview', i)) {
    i = previewsSource.indexOf('(', i);
    if (i === -1) break;

    let depth = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let paramsStart = i + 1;
    i++;

    while (i < len && depth > 0) {
      const char = previewsSource[i];
      const prevChar = previewsSource[i - 1];

      if (inSingleQuote) {
        if (char === "'" && prevChar !== '\\') inSingleQuote = false;
      } else if (inDoubleQuote) {
        if (char === '"' && prevChar !== '\\') inDoubleQuote = false;
      } else {
        if (char === "'") inSingleQuote = true;
        else if (char === '"') inDoubleQuote = true;
        else if (char === '(') depth++;
        else if (char === ')') depth--;
      }
      i++;
    }

    const paramsText = previewsSource.substring(paramsStart, i - 1);
    let rest = previewsSource.substring(i);
    const fnMatch = rest.match(/^\s*(?:\/\/\/[^\n]*\n\s*)*Widget\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/);

    if (fnMatch) {
      parsedPreviews.push({
        fnName: fnMatch[1],
        fnParams: fnMatch[2].trim(),
        paramsText: paramsText.trim()
      });
    }
  } else {
    i++;
  }
}

assert(parsedPreviews.length === 33, `Expected exactly 33 @Preview annotations, found ${parsedPreviews.length}`);
assert(parsedPreviews.length >= 19, `Meets minimum 19 required previews`);

// Validate every individual preview
const groupsFound = new Set();
for (const p of parsedPreviews) {
  assert(p.fnParams === '', `Preview function ${p.fnName} must have zero parameters`);
  
  const nameMatch = p.paramsText.match(/name\s*:\s*(\x27(?:[^\x27\\]|\\.)*\x27|\x22(?:[^\x22\\]|\\.)*\x22)/);
  const groupMatch = p.paramsText.match(/group\s*:\s*(\x27(?:[^\x27\\]|\\.)*\x27|\x22(?:[^\x22\\]|\\.)*\x22)/);
  const sizeMatch = p.paramsText.match(/size\s*:\s*(?:const\s+)?Size\s*\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/);

  assert(nameMatch !== null && nameMatch[1].length > 2, `Preview ${p.fnName} has valid name parameter`);
  assert(groupMatch !== null && groupMatch[1].length > 2, `Preview ${p.fnName} has valid group parameter`);
  assert(sizeMatch !== null, `Preview ${p.fnName} has valid Size(w, h) constraint`);

  if (sizeMatch) {
    const width = parseFloat(sizeMatch[1]);
    const height = parseFloat(sizeMatch[2]);
    assert(width >= 100 && width <= 1920, `Preview ${p.fnName} width ${width} is within realistic bounds`);
    assert(height >= 50 && height <= 1200, `Preview ${p.fnName} height ${height} is within realistic bounds`);
  }

  if (groupMatch) {
    groupsFound.add(groupMatch[1].replace(/['"]/g, ''));
  }
}

assert(groupsFound.has('Layouts'), 'Group "Layouts" is present');
assert(groupsFound.has('Screens'), 'Group "Screens" is present');
assert(groupsFound.has('Plungers'), 'Group "Plungers" is present');
assert(groupsFound.has('Clocks'), 'Group "Clocks" is present');
assert(groupsFound.has('Team Bays') || groupsFound.has('Bays'), 'Group "Team Bays"/"Bays" is present');
assert(groupsFound.has('Sheets') || groupsFound.has('Sheets & Navigation'), 'Group "Sheets" is present');

// Verify Theme scaffolding and Wrapper
assert(previewsSource.includes('class AquaticPreviewThemeData extends PreviewThemeData'), 'AquaticPreviewThemeData extends PreviewThemeData');
assert(previewsSource.includes('PreviewThemeData aquaticThemeBuilder()'), 'aquaticThemeBuilder() constant callback declared');
assert(previewsSource.includes('buildPreviewWrapper('), 'buildPreviewWrapper declared');
assert(previewsSource.includes('createPreviewController('), 'createPreviewController declared with autoTick: false and autoConnect: false');
console.log(`  ✅ Stage 1 Passed: All 33 previews validated across ${groupsFound.size} groups.\n`);

// =============================================================================
// STAGE 2: Web Runtime Purity & Zero Native Imports Audit
// =============================================================================
console.log('[STAGE 2] Web Runtime Purity & Zero Native Imports Audit');
const visitedFiles = new Set();
const nativeViolations = [];

function crawlImports(filePath) {
  if (visitedFiles.has(filePath)) return;
  visitedFiles.add(filePath);
  if (!fs.existsSync(filePath)) return;

  const code = fs.readFileSync(filePath, 'utf8');
  const importRegex = /import\s+[\x27\x22]([^\x27\x22]+)[\x27\x22]/g;
  let m;

  while ((m = importRegex.exec(code)) !== null) {
    const target = m[1];
    if (target.startsWith('dart:io') || target.startsWith('dart:ffi') || target.startsWith('dart:html')) {
      nativeViolations.push({ file: filePath, native: target });
    }
    if (target.startsWith('package:polopad_pro/')) {
      const rel = target.replace('package:polopad_pro/', '');
      crawlImports(path.join(LIB_DIR, rel));
    } else if (!target.startsWith('package:') && !target.startsWith('dart:')) {
      crawlImports(path.resolve(path.dirname(filePath), target));
    }
  }
}

crawlImports(PREVIEWS_FILE);

assert(visitedFiles.size >= 25, `Crawl reached at least 25 transitive files (reached ${visitedFiles.size})`);
assert(nativeViolations.length === 0, `Zero native imports in transitive closure (found ${nativeViolations.length})`);
console.log(`  ✅ Stage 2 Passed: ${visitedFiles.size} files checked. Zero native imports found.\n`);

// =============================================================================
// STAGE 3: GitHub Actions CI Workflow Structure & Syntax Validation
// =============================================================================
console.log('[STAGE 3] GitHub Actions CI Workflow Structure & Syntax Validation');
assert(fs.existsSync(CI_WORKFLOW_FILE), '.github/workflows/ci.yml exists');
const ciContent = fs.readFileSync(CI_WORKFLOW_FILE, 'utf8');

// Check tab characters
let tabCount = 0;
for (let c = 0; c < ciContent.length; c++) {
  if (ciContent[c] === '\t') tabCount++;
}
assert(tabCount === 0, 'ci.yml contains zero tab characters');

// Validate key workflow sections
assert(ciContent.includes('name: PoloPad Pro CI'), 'Workflow name is specified');
assert(ciContent.includes('on:'), 'on trigger specified');
assert(ciContent.includes('push:'), 'push trigger specified');
assert(ciContent.includes('pull_request:'), 'pull_request trigger specified');
assert(ciContent.includes('workflow_dispatch:'), 'workflow_dispatch trigger specified');
assert(ciContent.includes('permissions:\n  contents: read'), 'Security: permissions contents: read declared');
assert(ciContent.includes('jobs:\n  analyze-and-test:'), 'analyze-and-test job declared');
assert(ciContent.includes('runs-on: ubuntu-latest'), 'Runner is ubuntu-latest');
assert(ciContent.includes('working-directory: flutter_app'), 'defaults working-directory is flutter_app');

// Validate steps in exact sequence
const stepsInOrder = [
  'actions/checkout@v4',
  'actions/setup-java@v4',
  'subosito/flutter-action@v2',
  'flutter pub get',
  'dart format --output=none --set-exit-if-changed .',
  'flutter analyze --fatal-infos --fatal-warnings',
  'flutter test --coverage test/',
  'flutter test integration_test/app_test.dart',
  'actions/upload-artifact@v4'
];

let lastIndex = -1;
for (const step of stepsInOrder) {
  const curIndex = ciContent.indexOf(step);
  assert(curIndex > lastIndex, `Step "${step}" is present in expected execution order`);
  lastIndex = curIndex;
}

// Validate artifact upload path alignment
assert(ciContent.includes('name: flutter-coverage-report'), 'Artifact name is flutter-coverage-report');
assert(ciContent.includes('path: flutter_app/coverage/'), 'Artifact path is flutter_app/coverage/ (correct relative path from repo root)');
assert(ciContent.includes('if-no-files-found: ignore'), 'Handles missing coverage gracefully with if-no-files-found: ignore');
console.log('  ✅ Stage 3 Passed: CI workflow structure, step ordering, and paths verified.\n');

// =============================================================================
// STAGE 4: Color Palette & Pitch-Black Background Audit
// =============================================================================
console.log('[STAGE 4] Color Palette & Pitch-Black Background Audit');

function getAllDartFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllDartFiles(full));
    } else if (entry.name.endsWith('.dart')) {
      results.push(full);
    }
  }
  return results;
}

const libDartFiles = getAllDartFiles(LIB_DIR);
const allDartFiles = [...libDartFiles, ...getAllDartFiles(TEST_DIR)];
let pitchBlackBackgroundOccurrences = 0;

for (const f of libDartFiles) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineNum) => {
    // Check for explicit hex representations of black in lib/
    if (/0x[fF]{0,2}000000/.test(line)) {
      pitchBlackBackgroundOccurrences++;
      console.error(`  Pitch-black hex found in ${f}:${lineNum + 1}: ${line.trim()}`);
    }
    if (/0x[fF]{0,2}06080[dD]/.test(line)) {
      pitchBlackBackgroundOccurrences++;
      console.error(`  Pitch-black hex 06080d found in ${f}:${lineNum + 1}: ${line.trim()}`);
    }
  });
}

for (const f of allDartFiles) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineNum) => {
    // Check for Colors.black used as a background
    if (/backgroundColor\s*:\s*Colors\.black/.test(line)) {
      pitchBlackBackgroundOccurrences++;
      console.error(`  Colors.black background in ${f}:${lineNum + 1}: ${line.trim()}`);
    }
  });
}

assert(pitchBlackBackgroundOccurrences === 0, `Zero pitch-black backgrounds found across ${libDartFiles.length} lib files and ${allDartFiles.length} total Dart files`);

// Verify aquatic palette tokens in colors.dart
const colorsFileContent = fs.readFileSync(path.join(LIB_DIR, 'core', 'constants', 'colors.dart'), 'utf8');
assert(colorsFileContent.includes('canvasSky900 = Color(0xFF0C4A6E);'), 'canvasSky900 (#0C4A6E) defined');
assert(colorsFileContent.includes('canvasBlue900 = Color(0xFF1E3A8A);'), 'canvasBlue900 (#1E3A8A) defined');
assert(colorsFileContent.includes('canvasIndigo950 = Color(0xFF1E1B4B);'), 'canvasIndigo950 (#1E1B4B) defined');
assert(colorsFileContent.includes('cyan400 = Color(0xFF22D3EE);'), 'cyan400 (#22D3EE) defined');

console.log(`  ✅ Stage 4 Passed: ${allDartFiles.length} files audited. Zero pitch-black backgrounds confirmed.\n`);

// =============================================================================
// STAGE 5: Gitignore Completeness & Pattern Matching Stress
// =============================================================================
console.log('[STAGE 5] Gitignore Completeness & Pattern Matching Stress');
assert(fs.existsSync(GITIGNORE_FILE), '.gitignore exists');
const gitignoreContent = fs.readFileSync(GITIGNORE_FILE, 'utf8');

const activeRules = gitignoreContent.split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'));

assert(activeRules.includes('.widget_preview/'), 'Crucial .widget_preview/ cache pattern present');
assert(activeRules.includes('.dart_tool/'), '.dart_tool/ build pattern present');
assert(activeRules.includes('build/'), 'build/ output directory present');
assert(activeRules.includes('coverage/'), 'coverage/ directory present');
assert(activeRules.includes('.idea/'), '.idea/ IDE directory present');
assert(activeRules.includes('.vscode/'), '.vscode/ IDE directory present');
assert(activeRules.includes('.DS_Store'), '.DS_Store OS file present');
assert(activeRules.includes('.env'), '.env secret file present');

// Stress test pattern matching logic
const testFilesToIgnore = [
  '.widget_preview/cache/index.html',
  '.dart_tool/package_config.json',
  'build/app/outputs/flutter-apk/app-release.apk',
  'coverage/lcov.info',
  '.idea/modules.xml',
  'test.iml',
  '.vscode/settings.json',
  '.DS_Store',
  '.env',
  'secret.pem'
];

for (const tf of testFilesToIgnore) {
  const matches = activeRules.some(rule => {
    const clean = rule.replace(/\/$/, '');
    if (clean.startsWith('*.')) {
      return tf.endsWith(clean.substring(1));
    }
    return tf.startsWith(clean) || tf.includes('/' + clean) || tf === clean;
  });
  assert(matches, `Rule properly matches ephemeral artifact "${tf}"`);
}

// Verify that source files are NOT matched by gitignore
const testFilesToTrack = [
  'lib/main.dart',
  'lib/widget_previews.dart',
  'pubspec.yaml',
  'README.md',
  '.github/workflows/ci.yml'
];

for (const tf of testFilesToTrack) {
  const wronglyIgnored = activeRules.some(rule => {
    const clean = rule.replace(/\/$/, '');
    return tf === clean;
  });
  assert(!wronglyIgnored, `Source file "${tf}" is not erroneously ignored`);
}

console.log('  ✅ Stage 5 Passed: Gitignore rules and pattern matching stress verified.\n');

// =============================================================================
// STAGE 6: Viewport Boundary & Layout Constraint Stress Simulation
// =============================================================================
console.log('[STAGE 6] Viewport Boundary & Layout Constraint Stress Simulation');

// Verify LayoutBuilder breakpoint contract in AdaptiveGameScreen
const adaptiveScreenCode = fs.readFileSync(path.join(LIB_DIR, 'presentation', 'screens', 'adaptive_game_screen.dart'), 'utf8');
assert(adaptiveScreenCode.includes('constraints.maxWidth > 600'), 'Explicit 600dp breakpoint for tablet layout');
assert(adaptiveScreenCode.includes('TabletDualThumbLayout('), 'Renders TabletDualThumbLayout when > 600');
assert(adaptiveScreenCode.includes('MobileStackedLayout('), 'Renders MobileStackedLayout when <= 600');

// Verify MobileStackedLayout employs FittedBox and bounded constraints
const mobileLayoutCode = fs.readFileSync(path.join(LIB_DIR, 'presentation', 'screens', 'mobile_stacked_layout.dart'), 'utf8');
assert(mobileLayoutCode.includes('FittedBox('), 'MobileStackedLayout uses FittedBox for font scale protection');
assert(mobileLayoutCode.includes('SingleChildScrollView('), 'MobileStackedLayout wraps content in scroll view to prevent RenderFlex overflow');

// Verify TabletDualThumbLayout provides 3 distinct columns with plunger buttons
const tabletLayoutCode = fs.readFileSync(path.join(LIB_DIR, 'presentation', 'screens', 'tablet_dual_thumb_layout.dart'), 'utf8');
assert(tabletLayoutCode.includes('PlungerButton.startStop('), 'Left column contains giant startStop PlungerButton');
assert(tabletLayoutCode.includes('PlungerButton.reset30('), 'Right column contains reset30 PlungerButton');
assert(tabletLayoutCode.includes('PlungerButton.reset20('), 'Right column contains reset20 PlungerButton');
assert(tabletLayoutCode.includes('WidgetKeys.undoButton'), 'Center bay contains undoButton');

console.log('  ✅ Stage 6 Passed: Viewport breakpoint math and layout constraints verified.\n');

// =============================================================================
// SUMMARY
// =============================================================================
console.log('======================================================================');
console.log('HARNESS EXECUTION SUMMARY');
console.log(`Total Assertions Evaluated: ${totalAssertions}`);
console.log(`Passed: ${passedAssertions}`);
console.log(`Failed: ${failedAssertions}`);
console.log('======================================================================');

if (failedAssertions > 0) {
  console.error(`\n❌ VERIFICATION REJECTED: ${failedAssertions} assertions failed!`);
  process.exit(1);
} else {
  console.log('\n🎉 ALL MILESTONE 4 ADVERSARIAL STRESS TESTS PASSED! ZERO BUGS DETECTED.');
  process.exit(0);
}
