---
name: playwright
description: "End-to-end browser, DOM, and live HTTP bundle verifier (microsoft/playwright-mcp). Tests rendered views, PWA manifest, Service Worker, and downloadable STL/Gerber endpoints."
---
# Playwright — End-to-End Live App & Bundle Verification
Run `python3 tests/test_playwright_e2e.py` to spin up an HTTP server against `react_app/dist` and verify HTTP 200 and payload integrity across `index.html`, `manifest.json`, `sw.js`, and all `.zip`/`.csv`/`.stl` downloads.
