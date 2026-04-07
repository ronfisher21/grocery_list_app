"""
Manual smoke-test script: simulates Hebrew and English inputs through categorize().

Run from project root:
    python -m core.test_categorize

Requires OPENAI_API_KEY in .env (or environment). If key is absent, expect FALLBACK for all LLM items.
"""

import sys
from pathlib import Path

# Allow running from project root without installing the package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.logging_config import setup_logging
from core.categorizer import categorize
from core.prompts import FALLBACK_CATEGORY

setup_logging(level="DEBUG")

# ---------------------------------------------------------------------------
# Test cases: (input, expected_category_or_None_if_any_valid_category_is_ok)
# None means "just log what comes back — no assertion"
# ---------------------------------------------------------------------------
CASES: list[tuple[str, str | None]] = [
    # --- Hebrew core cases ---
    ("חלב",          "מוצרי חלב וביצים"),
    ("ביצים",        "מוצרי חלב וביצים"),
    ("3 ביצים",      "מוצרי חלב וביצים"),   # quantity prefix
    ("עגבניות",      "ירקות ופירות"),
    ("לחם",          "לחם"),
    ("פיתות",        "לחם"),
    ("שמפו",         "היגיינה"),
    ("סבון כלים",    "ניקיון"),
    ("קולה",         "שתייה"),
    ("במבה",         "חטיפים"),
    ("חזה עוף",      "בשר עוף ודגים"),
    ("זיתים",        "מוצרים יבשים ושימורים"),
    ("תמצית וניל",   "אפייה"),
    ("נייר אפייה",   "מוצרים למטבח"),
    ("אורז מוכן",    "אוכל מוכן"),

    # --- English inputs (should still return a Hebrew category) ---
    ("milk",         None),
    ("chicken breast", None),
    ("shampoo",      None),
    ("tomatoes",     None),

    # --- Edge cases ---
    ("",             FALLBACK_CATEGORY),    # empty → fallback
    ("   ",          FALLBACK_CATEGORY),    # whitespace only → fallback
    ("xyzzy12345",   None),                 # unknown item → anything non-empty
    ("3 יוגורט",     "מוצרי חלב וביצים"),  # Hebrew with quantity
    ("יוגורט 200g",  "מוצרי חלב וביצים"),  # Hebrew with English suffix

    # --- Known tricky items (category-bias regression) ---
    ("טונה",         "מוצרים יבשים ושימורים"),
    ("גבינה צהובה",  "מוצרי חלב וביצים"),
    ("נוזל לכלים",   "ניקיון"),
    ("נייר טואלט",   "ניקיון"),
]

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
passed = 0
failed = 0
errors: list[str] = []

print("\n" + "=" * 60)
print(f"  Running {len(CASES)} test cases")
print("=" * 60 + "\n")

for item_name, expected in CASES:
    result = categorize(item_name)
    ok = (expected is None) or (result == expected)
    status = "PASS" if ok else "FAIL"
    if ok:
        passed += 1
    else:
        failed += 1
        errors.append(f"  [{status}] {item_name!r:30s}  got={result!r}  expected={expected!r}")
    print(f"[{status}] {item_name!r:30s} → {result!r}")

print("\n" + "=" * 60)
print(f"  Results: {passed} passed / {failed} failed / {len(CASES)} total")
print("=" * 60)

if errors:
    print("\nFailed cases:")
    for e in errors:
        print(e)
    sys.exit(1)
else:
    print("\nAll assertions passed.")
    sys.exit(0)
