"""
Tests for core/parser.py — 10 edge cases, zero LLM calls asserted.
"""

from unittest.mock import patch

import pytest

from core.parser import ParsedItem, parse_item


def test_leading_number_hebrew():
    result = parse_item("4 בננות")
    assert result == ParsedItem(quantity=4.0, clean_name="בננות")


def test_trailing_number_hebrew():
    result = parse_item("בננות 4")
    assert result == ParsedItem(quantity=4.0, clean_name="בננות")


def test_leading_number_english():
    result = parse_item("2 Apples")
    assert result == ParsedItem(quantity=2.0, clean_name="Apples")


def test_trailing_number_english():
    result = parse_item("Apples 3")
    assert result == ParsedItem(quantity=3.0, clean_name="Apples")


def test_no_number_hebrew():
    result = parse_item("חלב")
    assert result == ParsedItem(quantity=None, clean_name="חלב")


def test_decimal_leading():
    result = parse_item("1.5 ליטר חלב")
    assert result == ParsedItem(quantity=1.5, clean_name="ליטר חלב")


def test_mixed_language_leading():
    result = parse_item("3 cottage cheese")
    assert result == ParsedItem(quantity=3.0, clean_name="cottage cheese")


def test_multiword_hebrew_trailing():
    result = parse_item("גבינה צהובה 2")
    assert result == ParsedItem(quantity=2.0, clean_name="גבינה צהובה")


def test_leading_whitespace_stripped():
    result = parse_item("  2 ביצים  ")
    assert result == ParsedItem(quantity=2.0, clean_name="ביצים")


def test_number_only_no_split():
    # A bare number has no item name — quantity stays None, clean_name is the raw string
    result = parse_item("5")
    assert result == ParsedItem(quantity=None, clean_name="5")


# ── Zero LLM calls assertion ──────────────────────────────────────────────────

@pytest.mark.parametrize("raw", [
    "4 בננות",
    "חלב",
    "2 Apples",
    "גבינה צהובה 2",
    "1.5 ליטר חלב",
])
def test_no_llm_calls(raw):
    """parse_item must never trigger any OpenAI call."""
    with patch("openai.OpenAI") as mock_openai:
        parse_item(raw)
        mock_openai.assert_not_called()
