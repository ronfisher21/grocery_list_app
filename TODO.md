# Grocery Squad — Handoff State
_Last updated: 2026-04-07_

## Current Mission
Debugging categorization bugs in `/core`. Adding logging, test script, and checking Koyeb logs.

## Completed
- [x] `loguru==0.7.3` added to `requirements.txt` and installed in `.venv`
- [x] `core/logging_config.py` — central `setup_logging()`, colorized stdout via loguru
- [x] `core/categorizer.py` — full input/output tracing (raw input, normalized key, layer hit/miss, LLM raw output + latency, sanitized result)
- [x] `core/api.py` — loguru replaces stdlib logging; lifespan startup logs backend config
- [x] `core/overrides.py` — loguru replaces stdlib logging
- [x] `core/test_categorize.py` — 25 Hebrew/English/edge-case test cases with PASS/FAIL assertions

## Blocked / In Progress
- [ ] **Koyeb MCP logs** — MCP is connected but token is passed wrong in `~/.claude.json`

### Koyeb Fix Required (before restart)
The `~/.claude.json` koyeb MCP config passes the token as a CLI arg instead of an env var.

**Current (wrong):**
```json
"koyeb": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@koyeb/mcp-server", "--env", "KOYEB_TOKEN=<token>"]
}
```

**Fix (correct):**
```json
"koyeb": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@koyeb/mcp-server"],
  "env": {
    "KOYEB_TOKEN": "<your-claude-code-mcp-token>"
  }
}
```

After fixing: restart Claude Code → run `mcp__koyeb__list-apps` to verify → then pull logs.

## Next Steps (after Koyeb is unblocked)
1. Pull runtime logs from Koyeb with `mcp__koyeb__query-logs` — look for patterns of wrong categories
2. Run `python -m core.test_categorize` locally with OpenAI key to validate 25 test cases
3. Based on log findings: fix prompt bias or normalization bugs in `core/categorizer.py`

## How to Resume in a New Session
Tell Claude:
> "Initialize as the Grocery Squad. Read TODO.md and pick up from where we left off."
