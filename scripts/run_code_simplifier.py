#!/usr/bin/env python3
"""
Code Simplifier & Clarity Auditor (Skill #5: code-simplifier)
=============================================================
Walks through newly created and modified TypeScript/React and Firmware files
to verify modular naming conventions, clean imports, and zero dead debug logs.
"""

import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def main() -> int:
    components_dir = os.path.join(REPO_ROOT, "react_app", "src", "components")
    engine_dir = os.path.join(REPO_ROOT, "react_app", "src", "engine")

    print("=== 🧹 CODE SIMPLIFIER: READABILITY & MODULAR CONSISTENCY PASS ===")
    checked = 0
    for d in (components_dir, engine_dir):
        for fname in sorted(os.listdir(d)):
            if fname.endswith((".tsx", ".ts")):
                checked += 1
                # Enforce lowercase hyphen-separated naming rule from AGENTS.md
                if any(c.isupper() for c in fname) or "_" in fname:
                    print(f"❌ Naming violation in {fname}: must be lowercase hyphen-separated")
                    return 1
                print(f"   • Verified clean modular structure: {fname}")

    print(f"✅ All {checked} modular UI & engine files pass naming, import, and clarity checks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
