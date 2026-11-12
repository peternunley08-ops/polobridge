# PoloBridge & PoloPad Pro — Workspace Agent Rules

## 1. Visual & UI Design Standard
- **Vibrant Aquatic Palette (No Pitch-Black)**: Always use the sunlit Olympic Pool aquatic color scheme (`bg-gradient-to-br from-sky-900 via-blue-900 to-indigo-950`, translucent sapphire/teal cards, `border-cyan-400/30` glass borders, and high-visibility emerald/amber/rose 3D plungers). Never revert to pitch-black (`#06080d`, `#040508`, `bg-black`) backgrounds.
- **Modular Naming Convention**: Keep all new component and engine filenames lowercase and hyphen-separated (e.g., `mockups-gallery.tsx`, `bluetooth-manager.ts`, `six-eight-sports.ts`, `six-eight-panel.tsx`).
- **Preserve Working Features**: Never remove or break existing working logic (100ms Game/Shot clocks, World Aquatics Rule WP 20.15 auto-blanking, 1-click Undo stack, Web Audio synthesizer, Web Bluetooth GATT `4fa10001-...` driver, and 6-8 Sports Game Desk integration).

## 2. Toolchain & Environment Guardrails (macOS)
- **Homebrew PATH**: Always prefix shell commands with `export PATH=/opt/homebrew/bin:$PATH`.
- **Avoid Blocked Apple Command Line Shims**: Do not run `/usr/bin/git` or `/usr/bin/python3` (they hang on an unaccepted Xcode license prompt). Use `/opt/homebrew/bin/node` for all data processing and scripting tasks.

## 3. iCloud Desktop Synchronization
- After every verified `npm run build`, sync the project to `/Users/peternunley/Desktop/polobridge/react_app/` using:
  `rsync -av --exclude 'node_modules' --exclude '.git' /Users/peternunley/.gemini/antigravity/scratch/brand-studio/ ~/Desktop/polobridge/react_app/`

## 4. Token-Efficient Delegation (Claude Code)
- **Orchestrator**: The session model plans, designs, reviews and verifies. Water polo rules, clock behaviour, the court-link protocol, hardware decisions and anything else that needs judgement stay with it.
- **Haiku Agents**: Delegate small, mechanical, fully specified work to the agents in `.claude/agents/` without asking first. Each runs on Haiku and is limited to the local tools in its own `tools:` list (no Shopify, Gmail, Notion or Drive connectors).
  - **`repo-scout`**: Read-only search that returns conclusions with `path:line` references.
  - **`check-runner`**: Runs the test and audit suites and returns a pass/fail table. Edits nothing.
  - **`doc-scribe`**: Vault notes, `MEMORY.md`, `.memory/session_log.json` and README sections, from a fact sheet.
  - **`convention-test-writer`**: The Python presence-and-wiring suites in `tests/`, from an exact list of strings.
- **Briefs**: Make each brief self-contained: the exact files the agent may edit and the exact facts or strings to use. Keep agents that run at the same time on disjoint files, and do not rebuild `react_app/dist` while one is running.
- **Review**: Read every agent's diff before committing it. Check an agent's report against the files; do not repeat it as a result.
- **Do It Inline**: A single command, a one-file lookup or an edit of a few lines costs less inline than a cold agent start.
