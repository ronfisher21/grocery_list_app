"""
Unit tests for core.normalize: known inputs → expected normalized form.
"""

import pytest

from core.normalize import normalize


def test_empty_and_whitespace_only():
    """Empty or whitespace-only input returns empty string."""
    assert normalize("") == ""
    assert normalize("   ") == ""
    assert normalize("\t\n  \n") == ""


def test_trim():
    """Leading and trailing whitespace is removed."""
    assert normalize("  חלב  ") == "חלב"
    assert normalize("\tלחם\n") == "לחם"


def test_collapse_spaces():
    """Runs of spaces, tabs, newlines become a single space."""
    assert normalize("חלב   עוגיות") == "חלב עוגיות"
    assert normalize("נוזל\t\tלשירותים") == "נוזל לשירותים"
    assert normalize("אורז\n\nמוכן") == "אורז מוכן"
    assert normalize("  a   b   c  ") == "a b c"


def test_hebrew_variant_vav():
    """ווי is normalized to ו."""
    assert normalize("ווי") == "ו"
    assert normalize("יוגורט עם ווי") == "יוגורט עם ו"


def test_hebrew_variant_yod():
    """יי is normalized to י."""
    assert normalize("יי") == "י"
    assert normalize("חלב יי") == "חלב י"


def test_combined_normalization():
    """Trim, collapse, and Hebrew variants applied together."""
    assert normalize("  יוגורט   ווי  \n\t ") == "יוגורט ו"
    assert normalize("  במבה  ") == "במבה"


def test_non_string_input_returns_empty():
    """Non-string input is treated as empty (guard for API/caller)."""
    assert normalize(None) == ""  # type: ignore[arg-type]


def test_identity_for_already_normalized():
    """Already-normalized Hebrew item names are unchanged."""
    assert normalize("במבה") == "במבה"
    assert normalize("חזה עוף") == "חזה עוף"
    assert normalize("מוצרים יבשים ושימורים") == "מוצרים יבשים ושימורים"
