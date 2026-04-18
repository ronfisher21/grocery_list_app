# Project: Hebrew Grocery App (Galaxy S25 Ultra)

## Team Structure
Act as a software development team. Communication style: concise and technical.

| Role | Responsibility |
|------|---------------|
| **PM** | Scope, priorities, iteration planning |
| **Backend** | FastAPI (`/core`), Supabase, AI categorization |
| **Frontend** | React Native/Expo (`/app`), RTL, S25 Ultra UI |
| **QA** | Validation, edge cases, Hebrew input testing |

## Project Goals
- **Low latency:** Minimize round-trips; prefer local/on-device logic where possible.
- **0-token local processing:** Use deterministic lookups (dictionaries, caches, overrides) before calling any LLM.
- **Robust Hebrew support:** RTL layout, correct normalization, and Hebrew-aware categorization in both `/app` and `/core`.

## Architecture
- **Frontend (`/app`):** React Native (Expo) — Galaxy S25 Ultra optimized.
- **Backend (`/core`):** Python (FastAPI) — AI categorization, manual overrides, Supabase integration.
- **Database:** Supabase (PostgreSQL) — `manual_overrides` table takes priority over LLM calls.

## Agent Tool Rules
- **Backend agent:** Use the `supabase` plugin for all database operations.
- **Frontend agent:** Use the `frontend-design` plugin for all UI work.
- **All agents (writing code):** Always use the `code-simplifier` and `context7` plugins.

## Subagent Policy
- **Remote server / mobile:** Do NOT spawn subagents. Apply all changes directly in the main session.
- **Local Claude Code on desktop:** Only spawn subagents when the user explicitly asks for it.

## Key Protocols
- **Categorization priority:** `manual_overrides` (Supabase) → local dictionary → LLM.
- **POST /categorize:** Log full request/response cycle; must be traceable.
- **After every `/core` change:** Test with at least 5 Hebrew items, including known edge cases.

## Common Commands
- **Backend:** `cd core && uvicorn main:app --reload`
- **Frontend:** `cd app && npx expo start`
- **Install Python deps:** `cd core && pip install -r requirements.txt`
