#!/usr/bin/env python3
"""
PoloBridge & PoloPad Pro — Claude Code Agent Definition Verification Suite
==========================================================================
This file only checks presence and wiring: each definition in .claude/agents/
names itself correctly, runs on Haiku, and is limited to an explicit allowlist
of local tools. The read-only agents keep their read-only tool lists, and the
guardrail sentences that bound each agent's job are still in its body.

It does NOT test how an agent behaves. Agent behaviour is covered by the main
session reviewing every agent's diff, as AGENTS.md section 4 requires.
"""

import os
import re
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
AGENTS_DIR = os.path.join(REPO_ROOT, ".claude", "agents")

EXPECTED_AGENTS = ("check-runner", "convention-test-writer", "doc-scribe", "repo-scout")
ALLOWED_TOOLS = {"Read", "Edit", "Write", "Grep", "Glob", "Bash"}
FRONTMATTER_KEYS = ("name", "description", "tools", "model")
FILE_NAME_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*\.md$")

GUARDRAILS: dict[str, tuple[str, ...]] = {
    "check-runner.md": (
        "You do not fix anything.",
        "Never run `wrangler deploy`.",
        "A check is PASS only when its exit code was 0",
        "Do not commit, push, deploy or send anything outside the repository.",
    ),
    "doc-scribe.md": (
        "Use only the facts in the brief.",
        "Edit only the files the brief names.",
        "Do not commit, push, deploy or send anything outside the repository.",
    ),
    "convention-test-writer.md": (
        "Never weaken, skip or delete an assertion to get a pass.",
        "Do not edit `.github/workflows/`",
        "Do not commit, push, deploy or send anything outside the repository.",
    ),
    "repo-scout.md": (
        "You cannot edit files or run commands.",
    ),
}


def agent_files() -> list[str]:
    """Sorted names of the *.md files in AGENTS_DIR."""
    return sorted(name for name in os.listdir(AGENTS_DIR) if name.endswith(".md"))


def load_agent(file_name: str) -> tuple[dict[str, str], str]:
    """Return (frontmatter_dict, body) for one agent definition file."""
    path = os.path.join(AGENTS_DIR, file_name)
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()

    if not lines or lines[0] != "---":
        raise ValueError(f"{file_name}: file must start with a '---' frontmatter line")
    try:
        end = lines.index("---", 1)
    except ValueError:
        raise ValueError(f"{file_name}: frontmatter has no closing '---' line") from None

    frontmatter: dict[str, str] = {}
    for line in lines[1:end]:
        if ": " not in line:
            raise ValueError(f"{file_name}: frontmatter line has no ': ' separator: {line!r}")
        key, value = line.split(": ", 1)
        frontmatter[key.strip()] = value.strip()

    body = "\n".join(lines[end + 1:])
    return frontmatter, body


def tool_list(frontmatter: dict[str, str]) -> list[str]:
    """The comma-separated tools value as a list of names."""
    return [tool.strip() for tool in frontmatter["tools"].split(",")]


class TestAgentDefinitions(unittest.TestCase):
    def test_01_expected_agents_present(self):
        self.assertTrue(
            os.path.isdir(AGENTS_DIR),
            f"Agent definitions directory is missing: {AGENTS_DIR}",
        )
        for name in EXPECTED_AGENTS:
            with self.subTest(agent=name):
                path = os.path.join(AGENTS_DIR, f"{name}.md")
                self.assertTrue(
                    os.path.isfile(path),
                    f"{name}.md must exist in .claude/agents/",
                )

    def test_02_frontmatter_contract(self):
        for file_name in agent_files():
            with self.subTest(agent=file_name):
                frontmatter, body = load_agent(file_name)
                stem = file_name[: -len(".md")]

                self.assertIsNotNone(
                    FILE_NAME_PATTERN.match(file_name),
                    f"{file_name} must be lowercase and hyphen-separated",
                )
                self.assertEqual(
                    sorted(frontmatter),
                    sorted(FRONTMATTER_KEYS),
                    f"{file_name} frontmatter keys must be exactly {list(FRONTMATTER_KEYS)}; "
                    "any other key changes what an agent may do and has to be added to "
                    "this suite on purpose",
                )
                self.assertEqual(
                    frontmatter.get("name"),
                    stem,
                    f"{file_name} name must equal the file name without .md",
                )
                self.assertGreaterEqual(
                    len(frontmatter.get("description", "")),
                    40,
                    f"{file_name} description must be at least 40 characters",
                )
                self.assertGreaterEqual(
                    len(body.strip()),
                    200,
                    f"{file_name} body must be at least 200 characters",
                )

    def test_03_every_agent_runs_on_haiku(self):
        for file_name in agent_files():
            with self.subTest(agent=file_name):
                frontmatter, _ = load_agent(file_name)
                self.assertEqual(
                    frontmatter.get("model"),
                    "haiku",
                    f"{file_name} must run on model 'haiku'",
                )

    def test_04_tools_are_an_explicit_local_allowlist(self):
        for file_name in agent_files():
            with self.subTest(agent=file_name):
                frontmatter, _ = load_agent(file_name)
                tools = tool_list(frontmatter)
                self.assertTrue(tools, f"{file_name} tools list must not be empty")
                self.assertNotIn("", tools, f"{file_name} tools list must not contain an empty entry")
                self.assertEqual(
                    len(tools),
                    len(set(tools)),
                    f"{file_name} tools list must not contain duplicates",
                )
                for tool in tools:
                    self.assertIn(
                        tool,
                        ALLOWED_TOOLS,
                        f"{file_name} lists tool {tool!r}, which is not in the allowlist; "
                        "no connector or mcp__ tools and no Agent tool are permitted",
                    )

    def test_05_read_only_agents_cannot_write(self):
        frontmatter, _ = load_agent("repo-scout.md")
        self.assertEqual(
            set(tool_list(frontmatter)),
            {"Read", "Grep", "Glob"},
            "repo-scout must be read-only: its tools must be exactly Read, Grep and Glob",
        )

        frontmatter, _ = load_agent("check-runner.md")
        tools = tool_list(frontmatter)
        self.assertNotIn("Edit", tools, "check-runner must not have the Edit tool; it edits nothing")
        self.assertNotIn("Write", tools, "check-runner must not have the Write tool; it edits nothing")

    def test_06_guardrail_sentences(self):
        for file_name, sentences in GUARDRAILS.items():
            with self.subTest(agent=file_name):
                _, body = load_agent(file_name)
                for sentence in sentences:
                    self.assertIn(
                        sentence,
                        body,
                        f"{file_name} body must contain the guardrail sentence {sentence!r}",
                    )


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
