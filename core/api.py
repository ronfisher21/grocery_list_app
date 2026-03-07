"""
FastAPI app: POST /categorize and POST /categorize/override (feedback loop).

Categorize calls the same categorize() logic; override upserts to overrides (Supabase or in-memory).
"""

import logging

from fastapi import FastAPI, HTTPException

from core.categorizer import categorize
from core.models import CategorizeRequest, CategorizeResponse, OverrideRequest, OverrideResponse
from core.normalize import normalize
from core.overrides import upsert
from core.prompts import ALLOWED_CATEGORIES

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Hebrew Grocery Categorizer",
    description="AI classification for grocery list items (Hebrew); supports overrides for self-learning.",
    version="0.1.0",
)


@app.post("/categorize", response_model=CategorizeResponse)
def post_categorize(body: CategorizeRequest) -> CategorizeResponse:
    """
    Classify a grocery item into one Hebrew category.

    Uses Layer 1 (cache) then Layer 2 (LLM with few-shot); returns category only.
    """
    category = categorize(body.item_name)
    return CategorizeResponse(category=category)


@app.post("/categorize/override", response_model=OverrideResponse)
def post_categorize_override(body: OverrideRequest) -> OverrideResponse:
    """
    Store a user correction: item_name -> category (Layer 3 feedback loop).

    Normalizes item_name before storage. Next POST /categorize for that item returns this category from cache.
    """
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
        return OverrideResponse(success=True, message="Override saved.")
    except Exception as e:
        logger.exception("Override upsert failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save override") from e


@app.get("/health")
def health() -> dict[str, str]:
    """Health check for deployment."""
    return {"status": "ok"}
