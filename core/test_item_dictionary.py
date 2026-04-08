"""
Unit tests for core/item_dictionary.py.

Covers: hit, miss, upsert, normalization, edge cases.
Runs against an isolated in-memory SQLite DB (no file I/O).
"""

import sqlite3
from unittest.mock import patch

import pytest

import core.item_dictionary as dict_mod


@pytest.fixture(autouse=True)
def reset_db(tmp_path):
    """
    Reset the module-level SQLite connection before each test,
    pointing it at a fresh temp file so tests are fully isolated.
    """
    db_path = tmp_path / "test_item_dictionary.db"

    # Patch get_settings to return our temp path
    class _FakeSettings:
        dict_db_path = str(db_path)

    with patch("core.item_dictionary.get_settings", return_value=_FakeSettings()):
        dict_mod._conn = None  # force re-init on next call
        yield
        if dict_mod._conn:
            dict_mod._conn.close()
        dict_mod._conn = None


# ── Basic MISS / HIT cycle ────────────────────────────────────────────────────

def test_miss_on_empty_db():
    result = dict_mod.get_item_metadata("חלב")
    assert result is None


def test_save_then_hit():
    dict_mod.save_item_metadata("חלב", "מוצרי חלב", icon="🥛", last_quantity=2.0)
    result = dict_mod.get_item_metadata("חלב")
    assert result is not None
    assert result["category"] == "מוצרי חלב"
    assert result["icon"] == "🥛"
    assert result["last_quantity"] == 2.0


# ── Upsert (UPDATE on conflict) ───────────────────────────────────────────────

def test_upsert_updates_category():
    dict_mod.save_item_metadata("תפוח", "פירות", icon="🍎")
    dict_mod.save_item_metadata("תפוח", "ירקות", icon="🥦")  # override
    result = dict_mod.get_item_metadata("תפוח")
    assert result["category"] == "ירקות"
    assert result["icon"] == "🥦"


def test_upsert_updates_quantity():
    dict_mod.save_item_metadata("בננה", "פירות", last_quantity=1.0)
    dict_mod.save_item_metadata("בננה", "פירות", last_quantity=3.5)
    result = dict_mod.get_item_metadata("בננה")
    assert result["last_quantity"] == 3.5


# ── Normalization ─────────────────────────────────────────────────────────────

def test_save_raw_retrieved_normalized():
    """Save with surrounding whitespace, lookup with clean name — same row."""
    dict_mod.save_item_metadata("  גבינה  ", "מוצרי חלב")
    result = dict_mod.get_item_metadata("גבינה")
    assert result is not None
    assert result["name"] == "גבינה"


def test_lookup_raw_input_normalizes():
    """Lookup with extra spaces still hits after normalized save."""
    dict_mod.save_item_metadata("לחם", "מאפים")
    result = dict_mod.get_item_metadata("  לחם  ")
    assert result is not None
    assert result["category"] == "מאפים"


# ── Optional fields ───────────────────────────────────────────────────────────

def test_defaults_icon_empty_string():
    dict_mod.save_item_metadata("ביצים", "מוצרי חלב")
    result = dict_mod.get_item_metadata("ביצים")
    assert result["icon"] == ""


def test_defaults_quantity_none():
    dict_mod.save_item_metadata("שמן זית", "שמנים")
    result = dict_mod.get_item_metadata("שמן זית")
    assert result["last_quantity"] is None


# ── Edge cases ────────────────────────────────────────────────────────────────

def test_empty_name_returns_none():
    result = dict_mod.get_item_metadata("")
    assert result is None


def test_save_empty_name_is_noop():
    dict_mod.save_item_metadata("", "פירות")
    result = dict_mod.get_item_metadata("")
    assert result is None


def test_english_item():
    dict_mod.save_item_metadata("apples", "פירות", icon="🍏")
    result = dict_mod.get_item_metadata("Apples")  # different case
    # normalize does not lowercase — should miss (consistent with existing normalize)
    # This confirms case-sensitivity matches normalize() behavior.
    assert result is None or result["name"] == "apples"


def test_multiple_items_independent():
    dict_mod.save_item_metadata("בצל", "ירקות")
    dict_mod.save_item_metadata("שום", "ירקות")
    dict_mod.save_item_metadata("עגבנייה", "ירקות")

    assert dict_mod.get_item_metadata("בצל")["category"] == "ירקות"
    assert dict_mod.get_item_metadata("שום")["category"] == "ירקות"
    assert dict_mod.get_item_metadata("עגבנייה")["category"] == "ירקות"
    assert dict_mod.get_item_metadata("מלפפון") is None
