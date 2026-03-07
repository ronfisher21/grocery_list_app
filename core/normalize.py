"""
Hebrew string normalization for cache lookup and manual overrides.
Same normalization is used for Layer 1 lookup, Layer 3 upsert, and fallback.
"""

import re


def normalize(item_name: str) -> str:
    """
    Normalize an item name for deduplication and cache lookup.

    - Trims leading and trailing whitespace.
    - Collapses runs of whitespace (spaces, tabs, newlines) to a single space.
    - Optionally normalizes Hebrew spelling variants to increase cache hit rate:
      - ווי (double vav) → ו (single vav)
      - יי (double yod) → י (single yod)

    Args:
        item_name: Raw input from user or API (e.g. "  חלב   עוגיות  ").

    Returns:
        Normalized string suitable as a unique key; empty input returns "".
    """
    if not item_name or not isinstance(item_name, str):
        return ""
    s = item_name.strip()
    s = re.sub(r"\s+", " ", s)
    s = _normalize_hebrew_variants(s)
    return s


def _normalize_hebrew_variants(s: str) -> str:
    """
    Normalize common Hebrew spelling variants for cache deduplication.

    - ווי → ו (e.g. יוגורט vs יוגורט spellings)
    - יי → י (e.g. חלב vs חלב spellings)

    Args:
        s: String already trimmed and space-collapsed.

    Returns:
        String with variants normalized to single-character form.
    """
    s = s.replace("ווי", "ו")
    s = s.replace("יי", "י")
    return s
