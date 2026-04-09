"""
Regex-first parser: extracts quantity from a raw grocery item string.

Zero LLM calls. Handles Hebrew (RTL) and English strings.
Quantity may appear before or after the item name.
"""

import re
from dataclasses import dataclass

# Leading number: "4 בננות" or "1.5 ליטר חלב"
_LEADING = re.compile(r'^\s*(\d+(?:[.,]\d+)?)\s+(.+)$', re.UNICODE)
# Trailing number: "בננות 4" or "גבינה צהובה 2"
_TRAILING = re.compile(r'^(.+?)\s+(\d+(?:[.,]\d+)?)\s*$', re.UNICODE)


@dataclass
class ParsedItem:
    quantity: float | None
    clean_name: str


def parse_item(raw: str) -> ParsedItem:
    """
    Extract quantity and clean item name from raw input string.

    Quantity is a leading or trailing integer/float. No LLM involved.

    Args:
        raw: Raw user input, e.g. "4 בננות" or "חלב 2" or "Apples".

    Returns:
        ParsedItem with quantity (float or None) and clean_name.
    """
    text = raw.strip()

    m = _LEADING.match(text)
    if m:
        return ParsedItem(
            quantity=float(m.group(1).replace(',', '.')),
            clean_name=m.group(2).strip(),
        )

    m = _TRAILING.match(text)
    if m:
        return ParsedItem(
            quantity=float(m.group(2).replace(',', '.')),
            clean_name=m.group(1).strip(),
        )

    return ParsedItem(quantity=None, clean_name=text)
