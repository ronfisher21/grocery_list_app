# Project: Hebrew Grocery Sync (S25/A56)

## 🎯 Project Vision
A real-time, shared grocery list application for Samsung S25 and A56. The app uses a chat interface to add items, which are automatically categorized via an AI Core (Python backend) and synced via Supabase. UI and QA are owned by Claude Code.

## 🏗️ Architecture & Boundaries
- **Frontend (/app):** React Native (Expo). **Managed by Claude Code.** UI, RTL, Supabase client, and QA live here.
- **AI Core (/core):** Python (FastAPI, categorizer, overrides). **MANAGED BY CURSOR. CLAUDE AGENTS MUST NOT EDIT.**
- **Database:** Supabase (PostgreSQL + Realtime). Schema and RLS are defined in Supabase; the app reads/writes via the Supabase client and calls the backend only for categorization.

## 🤖 Agent Roles (Team Configuration)
- **Front Agent:** Handles React Native UI, RTL styling, chat-to-list flow, and mobile-specific logic.
- **Database Agent:** Manages Supabase schema, RLS policies, and real-time subscriptions (within the app code; schema changes are applied in Supabase dashboard or SQL).
- **QA Agent:** Monitors latency, verifies Hebrew RTL integrity, and runs automated tests.

## 🛑 Loop Guard & Token Safety
- **Iteration Limit:** Do not exceed 10 iterations for a single task. If unsolved, STOP and ask the Architect.
- **Circuit Breaker:** If the QA Agent detects the same build/sync error 3 times, halt all activity.
- **Context Management:** Only read relevant files. Avoid global codebase searches unless required for integration.

## 🇮🇱 Hebrew & RTL Guidelines
- **Primary Language:** All UI strings MUST be in Hebrew.
- **RTL Force:** Use `I18nManager.forceRTL(true)` so the layout is correct for Hebrew.
- **Fonts:** Use fonts that support Hebrew characters clearly (e.g., Assistant or Heebo).

## 🧠 AI Integration Protocol
- **Classification Flow:**
  1. When the user adds an item, the app calls the backend **POST /categorize** with `{ "item_name": "..." }` and receives `{ "category": "..." }`. The backend handles cache (manual_overrides) and LLM internally; the app does not call any override endpoint.
  2. The app then inserts the item (with that category) into Supabase `grocery_items` for the shared list.
- **Feedback Loop (Option 2 – direct write):** When the user changes a category in the UI, the app must:
  1. **Normalize** the item name (same rules as backend: trim, collapse spaces, ווי→ו, יי→י). Use a shared `normalize` utility in the app (see `app/IMPLEMENTATION_PLAN.md` §6).
  2. **Upsert** into Supabase table `manual_overrides` with `item_name_normalized`, `category`, `last_corrected_at`.
  3. Update the corresponding row in `grocery_items` so the list shows the new category.
  The backend only **reads** `manual_overrides`; the app is the **writer** for user corrections. Do not call any backend override API from the app.

## 📁 Shared Folder Rules
- **READ ONLY:** Claude Agents may read `/core` to understand API contracts (e.g. POST /categorize request/response) and normalization rules. Do not rely on reading core for every change; prefer `app/IMPLEMENTATION_PLAN.md` and this file.
- **FORBIDDEN:** Writing or refactoring any file inside `/core`.
- **COMMUNICATION:** If the Front Agent needs a backend change, create a `REQUEST_FOR_ARCHITECT.md` file in the project root (or in `/app` as agreed) and describe the request. Do not modify `/core`.

## 🔐 Environment & Secrets
- **Use `app/.env` only.** Variables: `APP_SUPABASE_URL`, `APP_SUPABASE_ANON_KEY`, `API_BASE_URL` (backend base URL for POST /categorize). Copy from `app/.env.example` if missing.
- **Never** use the root `.env` in the app. **Never** put `OPENAI_API_KEY`, `SERVICE_ROLE_KEY`, or `POSTGRES_*` in the app. The anon key is sufficient for Supabase from the client (with RLS).

## 📋 Reference
- **Frontend plan:** `app/IMPLEMENTATION_PLAN.md` – flows, data model, normalization, implementation order.
- **Backend (read-only):** `/core` – categorizer, overrides (read path), API. Do not edit.

## 🛠️ Common Commands
- **Install deps:** `cd app && npm install`
- **Run Android:** `npx expo run:android`
- **Run iOS:** `npx expo run:ios`
- **QA / tests:** `npm test` (from `app/`)
- **Sync DB (from project root):** `supabase db push` — when schema/RLS changes are managed via Supabase CLI.
