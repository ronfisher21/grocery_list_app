# AI Core Implementation Plan

## 1. Overview & Objectives

- **Purpose:** Hebrew-first grocery item classification for the shared list app (S25/A56).
- **Goals:** Zero-cost (GPT-4o mini), minimal latency, self-learning from user corrections.
- **Export:** One classification function + one FastAPI endpoint for the React Native frontend.

---

## 2. Tech Stack & Configuration

| Component    | Choice        | Notes                                      |
|-------------|----------------|--------------------------------------------|
| API framework | **FastAPI**  | Endpoints, Pydantic request/response       |
| LLM         | **OpenAI API** | Key from `.env`: `OPENAI_API_KEY`         |
| Validation  | **Pydantic**   | Request/response models, settings         |
| Model       | **GPT-4o mini**| Cost/latency sweet spot for classification |

- Load `OPENAI_API_KEY` from `.env` (e.g. via `pydantic-settings` or `python-dotenv`). Never hardcode.
- All user-facing and classification output remains **Hebrew**.

---

## 3. System Prompt (Hebrew)

Use this exact system prompt for the categorizer:

```
תפקיד: אתה עוזר חכם לסיווג מוצרים ברשימת קניות.
משימה: עליך לקבל שם של מוצר ולשייך אותו לקטגוריה אחת בלבד מתוך הרשימה המוגדרת.

הקטגוריות המותרות:
- ניקיון
- היגיינה
- מוצרים למטבח
- אפייה
- חטיפים
- מוצרים יבשים ושימורים
- שתייה
- מוצרי חלב וביצים
- בשר עוף ודגים
- לחם
- מוצרים לבית
- אוכל מוכן

דוגמאות לסיווג:
1. קלט: "נוזל לשירותים" -> קטגוריה: ניקיון
2. קלט: "שמפו" -> קטגוריה: היגיינה
3. קלט: "נייר אפייה" -> קטגוריה: מוצרים למטבח
4. קלט: "תמצית וניל" -> קטגוריה: אפייה
5. קלט: "במבה" -> קטגוריה: חטיפים
6. קלט: "זיתים" -> קטגוריה: מוצרים יבשים ושימורים
7. קלט: "קולה" -> קטגוריה: שתייה
8. קלט: "יוגורט" -> קטגוריה: מוצרי חלב וביצים
9. קלט: "חזה עוף" -> קטגוריה: בשר עוף ודגים
10. קלט: "פיתות" -> קטגוריה: לחם
11. קלט: "תרבד" -> קטגוריה: מוצרים לבית
12. קלט: "אורז מוכן" -> קטגוריה: אוכל מוכן

הנחיות קריטיות:
- ענה בשם הקטגוריה בלבד, ללא הסברים וללא סימני פיסוק.
- אם המוצר לא מופיע בדוגמאות, השתמש בהיגיון כדי לשייך אותו לקטגוריה המתאימה ביותר מהרשימה.
- אם אתה לא בטוח, שייך לקטגוריה הקרובה ביותר (למשל: סבון כלים לניקיון, קוטג' למוצרי חלב וביצים).
```

- Stored as a constant or loaded from config in the core module.
- For **Layer 2**, append a “User-Specific Preferences” block (see §5.2) before sending to the model.

---

## 4. Export Surface for the Frontend

- **Pure function:**  
  `categorize(item_name: str, ...) -> str`  
  Returns a single category name (Hebrew). Used by the backend and tests.
- **FastAPI endpoint:**  
  e.g. `POST /categorize` with body `{ "item_name": "..." }` and response `{ "category": "..." }`.  
  The endpoint should call the same `categorize()` logic so behavior is identical.

All logic (cache, RAG-lite, LLM, fallback) lives behind this single entry point.

---

## 5. Three-Layer Classification (Self-Learning & Adaptive)

### 5.1 Layer 1: Exact-Match Local Cache

- **Source:** `manual_overrides` table (Supabase or same DB as app).
- **When:** Before any LLM call.
- **Logic:**
  1. Normalize `item_name` (see §6).
  2. Look up normalized key in `manual_overrides`.
  3. If found → return stored `category` immediately (0-latency, 0-cost).

### 5.2 Layer 2: Dynamic Few-Shot (RAG-lite)

- **When:** Cache miss.
- **Mechanism:** Fetch the **5 most recent** user corrections from `manual_overrides` (ordered by `last_corrected_at` DESC).
- **Use:** Inject into the system prompt as “User-Specific Examples” so the model follows the user’s style.

**Prompt injection block (append to system prompt when corrections exist):**

```
User-Specific Preferences (Priority):
The user has previously corrected these items. Follow these patterns over general logic:
- Input: {item_1} -> Category: {cat_1}
- Input: {item_2} -> Category: {cat_2}
...
```

- Then call GPT-4o mini with this augmented system prompt and the current `item_name` as user message.

### 5.3 Layer 3: Feedback Loop

- **Trigger:** User changes an item’s category in the UI.
- **Action:** Upsert into `manual_overrides`:
  - **Keys:** Normalized `item_name` (unique), `category`, `last_corrected_at`.
- **API:** Either:
  - A dedicated endpoint (e.g. `POST /categorize/override`) that the frontend calls on “save correction”, or
  - The frontend writes to Supabase from the app; the core only reads.  
  The plan should be explicit about who writes (backend vs client) so the schema stays single source of truth.

---

## 6. Manual Overrides Schema

- **Table:** `manual_overrides` (or equivalent in Supabase).
- **Columns:**
  - `item_name` (or `item_name_normalized`): string, **unique index** (used for cache lookup).
  - `category`: string, one of the 12 allowed categories.
  - `last_corrected_at`: timestamp (for “5 most recent” retrieval).
- **Deduplication:** Normalize before lookup and before upsert:
  - Trim and collapse whitespace.
  - Optional: normalize Hebrew variants (e.g. `ו`/`ווי`, `י`/`יי`) to increase cache hit rate.
- **Upsert:** On user correction, upsert by normalized `item_name`, set `category` and `last_corrected_at`.

---

## 7. Performance Guardrails

- **Deduplication:** Same normalization for:
  - Cache lookup (Layer 1),
  - Storing/updating overrides (Layer 3),
  - Any “similar items” or “most frequent category” fallback (below).
- **Fallback when OpenAI is unavailable:**
  - Option A: Return the most frequent category among similar items (e.g. from overrides or from existing list), if available.
  - Option B: Return a fixed **“General”** (or one designated fallback category) and log the failure.
  - Prefer A when data exists; otherwise B. All in Hebrew.

---

## 8. Suggested File / Module Layout (core)

- `core/settings.py` – Load `OPENAI_API_KEY` from env; Pydantic `BaseSettings`.
- `core/prompts.py` – System prompt constant + helper to build prompt with user-specific examples.
- `core/normalize.py` – Hebrew string normalization (trim, collapse spaces, optional `ו`/`יי`).
- `core/categorizer.py` – Main logic: `categorize(item_name)` implementing Layer 1 → 2 → LLM → fallback; no HTTP.
- `core/overrides.py` – DB access: get by key, get 5 latest, upsert (Supabase client or shared DB client).
- `core/api.py` or `core/routes/categorize.py` – FastAPI app and `POST /categorize`, plus optional `POST /categorize/override`.
- `core/models.py` – Pydantic models: request/response for categorize and override.
- Tests: `tests/test_categorizer.py`, `tests/test_api.py`, optionally `tests/test_normalize.py`.

*(Note: Current file is `categroizer.py`; consider renaming to `categorizer.py` and updating imports.)*

---

## 9. Dependencies

- **fastapi**
- **openai** (official SDK)
- **pydantic** (and optionally **pydantic-settings** for `.env`)
- **httpx** or **aiohttp** if needed for async Supabase/HTTP
- Supabase client as used by the rest of the app (e.g. **supabase**)

Pin versions in `requirements.txt` or `pyproject.toml`.

---

## 10. Testing Strategy (Pytest)

- **Unit:**  
  - Normalization: known inputs → expected normalized form.  
  - `categorize()` with mocked cache and mocked OpenAI: cache hit returns immediately; cache miss returns value from mock LLM; fallback when OpenAI raises.
- **Integration:**  
  - FastAPI `TestClient`: `POST /categorize` with `item_name` → 200 and `category` in response; override endpoint upserts and subsequent categorize uses cache.
- **Prompt:**  
  - Optional: snapshot or string assert that user-specific block is appended when overrides are provided.

---

## 11. Implementation Order

1. **Config & prompt** – Settings (env), prompts module, allowed categories list.
2. **Normalize** – Hebrew normalization and tests.
3. **manual_overrides schema** – Define in Supabase; implement get-by-key and get-5-latest.
4. **Categorizer core** – Layer 1 (cache) → Layer 2 (prompt + LLM) → fallback; use OpenAI with system prompt from §3.
5. **FastAPI** – Models, `POST /categorize`, optional `POST /categorize/override`.
6. **Feedback loop** – Upsert on correction (from API or from app to Supabase).
7. **Tests** – Unit + integration as in §10.
8. **Rename** – `categroizer.py` → `categorizer.py` and fix references.

---

## 12. Summary

| Layer   | Mechanism              | Purpose                          |
|--------|------------------------|----------------------------------|
| 1      | Exact-match cache      | 0-latency, 0-cost for corrections |
| 2      | Few-shot in system prompt | User-specific in-context learning |
| 3      | Upsert on correction   | Persist and reuse user choices   |

- **Export:** One `categorize()` function + one FastAPI endpoint; optional override endpoint.
- **Model:** GPT-4o mini; API key from `.env`.
- **Guardrails:** Normalization, fallback category when API fails.

This plan keeps the AI core minimal, testable, and ready for the React Native frontend and Supabase memory layer.
