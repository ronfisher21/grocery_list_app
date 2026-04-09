"""
Layer 0 local cache: SQLite-backed item dictionary.

Provides get/save for (name → category, icon, last_quantity) with zero network calls.
Used as the first lookup layer in categorizer.py before hitting Supabase or the LLM.
"""

import sqlite3
from pathlib import Path
from typing import Optional

from loguru import logger

from core.normalize import normalize
from core.settings import get_settings

_conn: Optional[sqlite3.Connection] = None


def _get_conn() -> sqlite3.Connection:
    """Return (and lazily initialize) the shared SQLite connection."""
    global _conn
    if _conn is not None:
        return _conn

    db_path = Path(get_settings().dict_db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    _conn = sqlite3.connect(str(db_path), check_same_thread=False)
    _conn.row_factory = sqlite3.Row
    _conn.execute("PRAGMA journal_mode=WAL")
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS item_dictionary (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT    UNIQUE NOT NULL,
            category      TEXT    NOT NULL,
            icon          TEXT    NOT NULL DEFAULT '',
            last_quantity REAL
        )
        """
    )
    _conn.commit()
    logger.info("item_dictionary: SQLite opened at {}", db_path)
    return _conn


def get_item_metadata(name: str) -> Optional[dict]:
    """
    Look up a normalized item name in the local dictionary.

    Args:
        name: Raw item name (will be normalized internally).

    Returns:
        dict with keys {name, category, icon, last_quantity} or None on miss.
    """
    key = normalize(name)
    if not key:
        return None
    try:
        conn = _get_conn()
        row = conn.execute(
            "SELECT name, category, icon, last_quantity FROM item_dictionary WHERE name = ?",
            (key,),
        ).fetchone()
        if row:
            result = dict(row)
            logger.debug("item_dictionary: HIT  key={!r} → {}", key, result)
            return result
        logger.debug("item_dictionary: MISS key={!r}", key)
        return None
    except Exception as e:
        logger.exception("item_dictionary get failed: {}", e)
        return None


def search_items(prefix: str, limit: int = 6) -> list[dict]:
    """
    Prefix search in the local dictionary (for autocomplete).

    Args:
        prefix: Raw prefix string (will be normalized).
        limit: Maximum results to return.

    Returns:
        List of dicts with keys {name, category, icon, last_quantity}.
    """
    key = normalize(prefix)
    if not key:
        return []
    try:
        conn = _get_conn()
        rows = conn.execute(
            "SELECT name, category, icon, last_quantity FROM item_dictionary WHERE name LIKE ? LIMIT ?",
            (f"{key}%", limit),
        ).fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.exception("item_dictionary search failed: {}", e)
        return []


def save_item_metadata(
    name: str,
    category: str,
    icon: str = "",
    last_quantity: Optional[float] = None,
) -> None:
    """
    Upsert an item into the local dictionary (INSERT OR REPLACE).

    Args:
        name: Raw item name (will be normalized internally).
        category: Hebrew category string.
        icon: Optional emoji/icon string.
        last_quantity: Optional last-used quantity float.
    """
    key = normalize(name)
    if not key:
        return
    try:
        conn = _get_conn()
        conn.execute(
            """
            INSERT INTO item_dictionary (name, category, icon, last_quantity)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                category      = excluded.category,
                icon          = excluded.icon,
                last_quantity = excluded.last_quantity
            """,
            (key, category, icon, last_quantity),
        )
        conn.commit()
        logger.debug(
            "item_dictionary: UPSERT key={!r} category={!r} icon={!r} qty={}",
            key,
            category,
            icon,
            last_quantity,
        )
    except Exception as e:
        logger.exception("item_dictionary save failed: {}", e)
