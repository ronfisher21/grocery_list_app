"""
Pydantic request/response models for categorize and override endpoints.
"""

from pydantic import BaseModel, Field


class CategorizeRequest(BaseModel):
    """Request body for POST /categorize."""

    item_name: str = Field(..., min_length=1, description="Grocery item name to classify (e.g. Hebrew).")


class CategorizeResponse(BaseModel):
    """Response body for POST /categorize."""

    category: str = Field(..., description="Hebrew category name for the item.")


class OverrideRequest(BaseModel):
    """Request body for POST /categorize/override (user correction, Layer 3 feedback loop)."""

    item_name: str = Field(..., min_length=1, description="Item name as shown (will be normalized for storage).")
    category: str = Field(..., min_length=1, description="Correct Hebrew category chosen by the user.")


class OverrideResponse(BaseModel):
    """Response body for POST /categorize/override."""

    success: bool = Field(..., description="Whether the override was stored.")
    message: str = Field(default="", description="Optional message (e.g. error or confirmation).")
