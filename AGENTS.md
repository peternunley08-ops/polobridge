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
