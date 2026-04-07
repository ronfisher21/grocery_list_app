"""
Manual overrides: get-by-key (Layer 1 cache), get-5-latest (Layer 2), upsert (Layer 3).

Uses Supabase table `manual_overrides` when PROJECT_URL and SERVICE_ROLE_KEY are set
in the backend environment (same Supabase project as the app). If either is missing,
the backend falls back to an in-memory store (empty per process), so app-written
overrides will not be seen by POST /categorize until these are set.
"""

from datetime import datetime, timezone
from typing import Any

from loguru import logger

from core.settings import get_settings

# In-memory fallback when Supabase is not configured
_store: dict[str, tuple[str, datetime]] = {}
_order: list[str] = []

TABLE_NAME = "manual_overrides"


def _client():
    """Return Supabase client or None if not configured."""
    settings = get_settings()
    if not settings.has_supabase:
        return None
    try:
        from supabase import create_client
        return create_client(settings.project_url, settings.service_role_key)
    except Exception as e:
        logger.warning("Supabase client creation failed: %s", e)
        return None


def get_by_key(normalized_key: str) -> str | None:
    """
    Look up category for a normalized item name (Layer 1 cache).

    Args:
        normalized_key: Output of normalize(item_name).

    Returns:
        Stored category if found, else None.
    """
    if not normalized_key:
        return None
    client = _client()
    if client is None:
        entry = _store.get(normalized_key)
        out = entry[0] if entry else None
        logger.info(
            "override get_by_key: in-memory store, key=%r -> %s",
            normalized_key,
            out if out else "MISS",
        )
        return out
    try:
        r = (
            client.table(TABLE_NAME)
            .select("category")
            .eq("item_name_normalized", normalized_key)
            .limit(1)
            .execute()
        )
        data: list[Any] = r.data if isinstance(r.data, list) else []
        if data and len(data) > 0:
            row = data[0]
            cat = row.get("category") if isinstance(row, dict) else None
            out = str(cat) if isinstance(cat, str) else None
            logger.info(
                "override get_by_key: Supabase, key=%r -> HIT %r",
                normalized_key,
                out,
            )
            return out
        logger.info(
            "override get_by_key: Supabase, key=%r -> MISS (no row)",
            normalized_key,
        )
        return None
    except Exception as e:
        logger.exception("Supabase get_by_key failed: %s", e)
        return None


def get_5_latest() -> list[tuple[str, str]]:
    """
    Return the 5 most recently corrected (item_name_normalized, category) pairs for Layer 2.

    Returns:
        List of (normalized_item_name, category), most recent first (max 5).
    """
    client = _client()
    if client is None:
        out: list[tuple[str, str]] = []
        for key in reversed(_order):
            if key in _store:
                out.append((key, _store[key][0]))
                if len(out) >= 5:
                    break
        return out
    try:
        r = (
            client.table(TABLE_NAME)
            .select("item_name_normalized, category")
            .order("last_corrected_at", desc=True)
            .limit(5)
            .execute()
        )
        data: list[Any] = r.data if isinstance(r.data, list) else []
        result: list[tuple[str, str]] = []
        for row in data:
            if not isinstance(row, dict):
                continue
            k = row.get("item_name_normalized")
            v = row.get("category")
            if isinstance(k, str) and isinstance(v, str):
                result.append((k, v))
        return result
    except Exception as e:
        logger.exception("Supabase get_5_latest failed: %s", e)
        return []


def upsert(normalized_key: str, category: str) -> None:
    """
    Upsert a manual override: set category for normalized item and refresh last_corrected_at.

    Args:
        normalized_key: Output of normalize(item_name).
        category: One of the allowed Hebrew categories (see core.prompts.ALLOWED_CATEGORIES).
    """
    if not normalized_key:
        return
    client = _client()
    if client is None:
        now = datetime.now(timezone.utc)
        if normalized_key in _order:
            _order.remove(normalized_key)
        _order.append(normalized_key)
        _store[normalized_key] = (category, now)
        logger.debug("Override upserted (in-memory): %s -> %s", normalized_key, category)
        return
    try:
        now = datetime.now(timezone.utc).isoformat()
        client.table(TABLE_NAME).upsert(
            {
                "item_name_normalized": normalized_key,
                "category": category,
                "last_corrected_at": now,
            },
            on_conflict="item_name_normalized",
        ).execute()
        logger.debug("Override upserted (Supabase): %s -> %s", normalized_key, category)
    except Exception as e:
        logger.exception("Supabase upsert failed: %s", e)
        raise
