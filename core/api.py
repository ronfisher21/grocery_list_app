"""
FastAPI app: POST /categorize and POST /categorize/override (feedback loop).

Categorize calls the same categorize() logic; override upserts to overrides (Supabase or in-memory).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from loguru import logger

from core.categorizer import categorize
from core.item_dictionary import save_item_metadata, search_items
from core.logging_config import setup_logging
from core.models import CategorizeRequest, CategorizeResponse, OverrideRequest, OverrideResponse, SuggestItem
from core.normalize import normalize
from core.overrides import upsert
from core.parser import parse_item
from core.prompts import ALLOWED_CATEGORIES
from core.settings import get_settings


def _seed_dict_from_supabase() -> None:
    """Read all manual_overrides from Supabase and populate the local SQLite dict."""
    s = get_settings()
    if not s.has_supabase:
        logger.warning("seed_dict: Supabase not configured — skipping")
        return
    try:
        from supabase import create_client

        client = create_client(s.project_url, s.service_role_key)
        resp = (
            client.table("manual_overrides")
            .select("item_name_normalized, category")
            .execute()
        )
        rows = resp.data if isinstance(resp.data, list) else []
        count = 0
        for row in rows:
            name = row.get("item_name_normalized")
            cat = row.get("category")
            if isinstance(name, str) and isinstance(cat, str) and name and cat:
                save_item_metadata(name, cat)
                count += 1
        logger.info("seed_dict: loaded {} overrides into local SQLite dict", count)
    except Exception as e:
        logger.exception("seed_dict: failed to seed from Supabase: {}", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(level="DEBUG")
    s = get_settings()
    logger.info(
        "Override backend: {} (PROJECT_URL and SERVICE_ROLE_KEY)",
        "Supabase" if s.has_supabase else "in-memory (overrides will NOT persist)",
    )
    logger.info("OpenAI key present: {}", s.has_openai_key)
    _seed_dict_from_supabase()
    yield


app = FastAPI(
    title="Hebrew Grocery Categorizer",
    description="AI classification for grocery list items (Hebrew); supports overrides for self-learning.",
    version="0.1.0",
    lifespan=lifespan,
)


@app.post("/categorize", response_model=CategorizeResponse)
def post_categorize(body: CategorizeRequest) -> CategorizeResponse:
    """
    Classify a grocery item into one Hebrew category.

    Uses Layer 1 (cache) then Layer 2 (LLM with few-shot); returns category only.
    """
    logger.info("POST /categorize  item_name={!r}", body.item_name)
    parsed = parse_item(body.item_name)
    logger.info("  parsed → quantity={} clean_name={!r}", parsed.quantity, parsed.clean_name)
    category = categorize(parsed.clean_name)
    logger.info("POST /categorize  result={!r}", category)
    return CategorizeResponse(category=category, quantity=parsed.quantity)


@app.post("/categorize/override", response_model=OverrideResponse)
def post_categorize_override(body: OverrideRequest) -> OverrideResponse:
    """
    Store a user correction: item_name -> category (Layer 3 feedback loop).

    Normalizes item_name before storage. Next POST /categorize for that item returns this category from cache.
    """
    logger.info(
        "POST /categorize/override  item_name={!r}  category={!r}",
        body.item_name, body.category,
    )
    if body.category not in ALLOWED_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"category must be one of: {list(ALLOWED_CATEGORIES)}",
        )
    normalized = normalize(body.item_name)
    if not normalized:
        return OverrideResponse(success=False, message="item_name normalized to empty")
    try:
        upsert(normalized, body.category)
        save_item_metadata(normalized, body.category)  # keep Layer 0 in sync with the correction
        logger.success("Override saved: {!r} → {!r}", normalized, body.category)
        return OverrideResponse(success=True, message="Override saved.")
    except Exception as e:
        logger.exception("Override upsert failed: {}", e)
        raise HTTPException(status_code=500, detail="Failed to save override") from e


@app.get("/suggest", response_model=list[SuggestItem])
def get_suggest(q: str = "") -> list[SuggestItem]:
    """
    Autocomplete: prefix-search the local item dictionary.

    Args q: Partial item name typed by the user (min 2 chars recommended).
    Returns up to 6 matching items sorted by closest prefix.
    """
    logger.debug("GET /suggest  q={!r}", q)
    results = search_items(q.strip())
    logger.debug("GET /suggest  {} results", len(results))
    return [SuggestItem(**r) for r in results]


@app.get("/health")
def health() -> dict[str, str]:
    """Health check for deployment."""
    return {"status": "ok"}
