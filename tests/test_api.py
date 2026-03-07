"""
API test: full flow (override → categorize from cache) for debugging.

Run: pytest tests/test_api.py -v -s
Uses in-memory overrides when Supabase is not configured; no OpenAI call in this path.
"""

import pytest
from fastapi.testclient import TestClient

from core.api import app

client = TestClient(app)


def test_full_flow_override_then_categorize_from_cache():
    """
    Full flow: POST /categorize/override saves a correction, then POST /categorize
    returns that category from Layer 1 cache (no LLM call).

    Use this test to debug and see the entire flow: health → override → categorize.
    """
    # Health
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}

    # Layer 3: save user correction (feedback loop)
    r = client.post(
        "/categorize/override",
        json={"item_name": "חלב", "category": "מוצרי חלב וביצים"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert "saved" in data["message"].lower() or data["message"]

    # Layer 1: categorize same item -> must come from cache (override we just saved)
    r = client.post("/categorize", json={"item_name": "חלב"})
    assert r.status_code == 200
    assert r.json()["category"] == "מוצרי חלב וביצים"

    # Normalized key: extra spaces still hit cache
    r = client.post("/categorize", json={"item_name": "  חלב  "})
    assert r.status_code == 200
    assert r.json()["category"] == "מוצרי חלב וביצים"


def test_new_item_should_not_be_cached():
    """
    New item should not be cached.
    """
    r = client.post("/categorize", json={"item_name": "קליק"})
    assert r.status_code == 200
    assert r.json()["category"] == "חטיפים"
