# Project: Hebrew Grocery Sync (S25/A56) - MAINTENANCE MODE

## 🎯 Project Vision
A real-time, shared grocery list application. Current Focus: **Debugging and Refactoring AI Categorization Logic.**

## 🏗️ Architecture & Boundaries (TEMPORARY OVERRIDE)
- **Frontend (/app):** React Native (Expo). Managed by Claude Code.
- **AI Core (/core):** Python (FastAPI). **NOW EDITABLE BY CLAUDE CODE** for bug fixing and logging.
- **Database:** Supabase (PostgreSQL).

## 🛠️ Debugging & AI Core Task (PRIORITY)
1. **Logging:** Add comprehensive logging to `core/` to trace how `item_name` is processed, what the LLM returns, and why the final category is assigned.
2. **Category Bias Fix:** Identify why items are getting "stuck" on single categories or receiving incorrect ones.
3. **Refactor:** Improve the prompt in the Python categorizer and ensure the normalization logic matches between `/app` and `/core`.

## 🤖 Agent Roles
- **Front Agent:** UI, RTL, and Supabase client.
- **Full-Stack Debugger:** (New Role) Has full permission to read/write in `/core` to fix categorization bugs and implement robust error handling.

## 🛑 Loop Guard & Safety
- **Iteration Limit:** 10 iterations.
- **Validation:** After every change in `/core`, run the FastAPI server and test with at least 5 known "problematic" items.

## 🧠 AI Integration Protocol (Updated)
- **POST /categorize:** Must be traceable. Log the full request/response cycle.
- **Manual Overrides:** Ensure the Python core correctly prioritizes the `manual_overrides` table from Supabase before calling the LLM.

## 📁 Folder Permissions (MAINTENANCE MODE)
- **UNLOCKED:** Claude Agents now have **FULL WRITE ACCESS** to `/core`. 
- **GOAL:** Clean up the Python logic so it can be later moved as a module into the Unified Todoist App.

## 🛠️ Common Commands
- **Backend Dev:** `cd core && uvicorn main:app --reload`
- **Frontend Dev:** `cd app && npx expo start`
- **Install Python Deps:** `cd core && pip install -r requirements.txt`