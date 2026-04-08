# Grocery Squad — Handoff State
_Last updated: 2026-04-07_

## Current Mission
Three new feature tasks approved by user. Work through them in order, report after each one and wait for approval before moving to the next.

## ✅ Completed
- [x] `loguru==0.7.3` added to `requirements.txt` and installed in `.venv`
- [x] `core/logging_config.py` — central `setup_logging()`, colorized stdout via loguru
- [x] `core/categorizer.py` — full input/output tracing (raw input, normalized key, layer hit/miss, LLM raw output + latency, sanitized result)
- [x] `core/api.py` — loguru replaces stdlib logging; lifespan startup logs backend config
- [x] `core/overrides.py` — loguru replaces stdlib logging
- [x] `core/test_categorize.py` — 25 Hebrew/English/edge-case test cases with PASS/FAIL assertions
- [x] Koyeb MCP unblocked — token now passed via `env` block in `~/.claude.json` ✓
- [x] Committed and pushed all logging work to `master` — Koyeb deployed healthy (deployment `12f99a99`)
- [x] Runtime logs verified: full loguru trace pipeline working in production

---

## 🚀 Next Tasks (do in order, report + wait for approval between each)

### ✅ Task 1 — Backend: Local-First SQLite `item_dictionary` (DONE 2026-04-08)
1. `core/item_dictionary.py` — SQLite WAL, `get_item_metadata` / `save_item_metadata`, normalized keys
2. `core/settings.py` — `dict_db_path` (env `DICT_DB_PATH`, default `data/item_dictionary.db`)
3. `core/categorizer.py` — Layer 0 inserted; saves to dict after LLM success
4. `core/test_item_dictionary.py` — 12/12 passing (hit, miss, upsert, normalization, edge cases)

### ✅ Task 2 — Backend: Israeli Brand-Aware LLM Prompt (DONE 2026-04-08)
1. Update the categorization prompt in `core/categorizer.py` to recognize Israeli grocery store brands/firms as category signals
   - e.g. `דני` → `מוצרי חלב וביצים`, `תנובה` → `מוצרי חלב וביצים`, `אסם` → `מזון יבש`, etc.
   - Add a brand hints section to the system prompt so the LLM maps known brands to their correct category before guessing
2. Test with at least 5 brand-name items to confirm correct categorization
3. **Report back and wait for approval before starting Task 3**

### Task 3 — Backend & QA: Regex-First Parser
1. Create `core/parser.py`:
   - Unicode-aware regex that extracts quantity (number only, no units) from Hebrew and English strings
   - Quantity can appear **before or after** the item name
   - e.g. `'4 בננות'` → `{ quantity: 4, clean_name: 'בננות' }`
   - e.g. `'בננות 4'` → `{ quantity: 4, clean_name: 'בננות' }`
   - e.g. `'2 Apples'` → `{ quantity: 2, clean_name: 'Apples' }`
   - Returns: `ParsedItem(quantity: float | None, clean_name: str)`
   - **Parser always runs via regex — zero LLM calls**
2. Integrate parser into `/categorize` pipeline: parse first, pass `clean_name` to categorizer
3. LLM is only called on Layer 0 (item_dictionary) cache miss — never for parsing
4. Write `core/test_parser.py` — 10 edge cases: mixed languages, no numbers, trailing numbers, zero LLM calls asserted
5. **Report back and wait for approval before starting Task 4**

### Task 4 — Frontend: Smart Entry UI
1. Create Autocomplete input field — as user types, query local SQLite `item_dictionary`
2. If match found, show as suggestion
3. On selection, auto-place item in its assigned category block
4. Add small Quantity toggle next to item name, defaulting to Regex-captured number
5. **Report back and wait for approval when done**

---

## Deferred (post-new-tasks)
- [ ] Pull Koyeb runtime logs with `mcp__koyeb__query-logs` — look for wrong-category patterns
- [ ] Run `python -m core.test_categorize` locally with OpenAI key to validate 25 test cases
- [ ] Fix prompt bias or normalization bugs found in logs

## How to Resume in a New Session
Tell Claude:
> "Initialize as the Grocery Squad. Read TODO.md and pick up from where we left off."
