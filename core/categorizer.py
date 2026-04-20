"""
Main classification logic: categorize(item_name) implementing Layer 1 → Layer 2 → LLM → fallback.

No HTTP here; the FastAPI layer calls this. Uses normalize, overrides, prompts, and OpenAI.
"""

import time

import openai
from loguru import logger

from core.item_dictionary import get_item_metadata, save_item_metadata
from core.normalize import normalize
from core.overrides import get_5_latest, get_by_key
from core.prompts import (
    ALLOWED_CATEGORIES,
    FALLBACK_CATEGORY,
    build_system_prompt_with_overrides,
)
from core.settings import get_settings

_openai_client: openai.OpenAI | None = None


def _get_openai_client() -> openai.OpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = openai.OpenAI(api_key=get_settings().openai_api_key)
    return _openai_client


def categorize(item_name: str) -> str:
    """
    Classify a grocery item into one Hebrew category (Layer 0 → 1 → 2 → LLM → fallback).

    Layer 0: Local SQLite dictionary (zero network, zero tokens).
    Layer 1: Exact-match cache from manual_overrides.
    Layer 2: Few-shot from 5 latest overrides + GPT-4o mini.
    Fallback: FALLBACK_CATEGORY when OpenAI is unavailable or returns invalid category.

    Args:
        item_name: Raw item name (e.g. from user or API).

    Returns:
        Single category name in Hebrew (one of ALLOWED_CATEGORIES or FALLBACK_CATEGORY).
    """
    logger.info("─── categorize START ───────────────────────────────")
    logger.info("  raw input    : {!r}", item_name)

    normalized = normalize(item_name or "")
    logger.info("  normalized   : {!r}", normalized)

    if not normalized:
        logger.warning("  result: FALLBACK (empty after normalization)")
        return FALLBACK_CATEGORY

    # Layer 0: local SQLite dictionary (zero network, zero tokens)
    dict_hit = get_item_metadata(normalized)
    if dict_hit is not None:
        logger.success("  layer=0 (local dict HIT) → {!r}", dict_hit["category"])
        return dict_hit["category"]

    logger.info("  layer=0 local dict MISS → escalating")

    # Layer 1: manual overrides cache hit
    cached = get_by_key(normalized)
    if cached is not None:
        logger.success("  layer=1 (override cache HIT) → {!r}", cached)
        save_item_metadata(normalized, cached)  # populate layer 0 for next time
        return cached

    logger.info("  layer=1 override cache MISS → escalating to LLM")

    # Layer 2: build prompt with user examples and call LLM
    examples = get_5_latest()
    logger.debug("  few-shot examples ({} items): {}", len(examples), examples)

    system_prompt = build_system_prompt_with_overrides(examples)

    try:
        if not get_settings().has_openai_key:
            logger.warning("  OpenAI key not set → FALLBACK")
            return FALLBACK_CATEGORY

        client = _get_openai_client()

        t0 = time.perf_counter()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": normalized},
            ],
            max_tokens=50,
            temperature=0,
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000

        raw = (response.choices[0].message.content or "").strip()
        logger.info("  llm raw output : {!r}  ({:.0f}ms)", raw, elapsed_ms)

        category = _sanitize_category(raw)
        logger.info("  sanitized      : {!r}", category if category else "(no match)")

        if category:
            logger.success("  layer=2 (LLM) → {!r}", category)
            save_item_metadata(normalized, category)
            return category

        logger.warning(
            "  LLM returned unrecognized category {!r} → FALLBACK", raw
        )
        return FALLBACK_CATEGORY

    except Exception as e:
        logger.exception("  OpenAI call failed: {}", e)
        logger.warning("  → FALLBACK due to exception")
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
