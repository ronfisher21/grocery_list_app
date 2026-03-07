"""
Main classification logic: categorize(item_name) implementing Layer 1 → Layer 2 → LLM → fallback.

No HTTP here; the FastAPI layer calls this. Uses normalize, overrides, prompts, and OpenAI.
"""

import logging

from openai import OpenAI

from core.normalize import normalize
from core.overrides import get_5_latest, get_by_key
from core.prompts import (
    ALLOWED_CATEGORIES,
    FALLBACK_CATEGORY,
    build_system_prompt_with_overrides,
)
from core.settings import get_settings

logger = logging.getLogger(__name__)


def categorize(item_name: str) -> str:
    """
    Classify a grocery item into one Hebrew category (Layer 1 → 2 → LLM → fallback).

    Layer 1: Exact-match cache from manual_overrides.
    Layer 2: Few-shot from 5 latest overrides + GPT-4o mini.
    Fallback: FALLBACK_CATEGORY when OpenAI is unavailable or returns invalid category.

    Args:
        item_name: Raw item name (e.g. from user or API).

    Returns:
        Single category name in Hebrew (one of ALLOWED_CATEGORIES or FALLBACK_CATEGORY).
    """
    normalized = normalize(item_name or "")
    if not normalized:
        return FALLBACK_CATEGORY

    # Layer 1: cache hit
    cached = get_by_key(normalized)
    if cached is not None:
        return cached

    # Layer 2: build prompt with user examples and call LLM
    examples = get_5_latest()
    system_prompt = build_system_prompt_with_overrides(examples)
    try:
        settings = get_settings()
        if not settings.has_openai_key:
            logger.warning("OpenAI API key not set; using fallback category")
            return FALLBACK_CATEGORY
        client = OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": normalized},
            ],
            max_tokens=50,
            temperature=0,
        )
        raw = (response.choices[0].message.content or "").strip()
        category = _sanitize_category(raw)
        return category if category else FALLBACK_CATEGORY
    except Exception as e:
        logger.exception("OpenAI categorizer failed: %s", e)
        return FALLBACK_CATEGORY


def _sanitize_category(raw: str) -> str:
    """
    Ensure the model response is one of the allowed categories (Hebrew only, no extra text).

    Args:
        raw: Raw model output (e.g. "ניקיון" or "ניקיון.").

    Returns:
        Valid category string or empty if not recognized.
    """
    s = (raw or "").strip().rstrip(".")
    if s in ALLOWED_CATEGORIES:
        return s
    # Allow match ignoring trailing punctuation
    for cat in ALLOWED_CATEGORIES:
        if cat in s or s in cat:
            return cat
    return ""
