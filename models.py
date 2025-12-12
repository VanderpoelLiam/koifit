"""
Pydantic models for request/response validation
"""

from pydantic import BaseModel
from typing import Optional, List


class SetEntryInput(BaseModel):
    """Set entry input for auto-save."""

    set_number: int
    weight_kg: float
    reps: int
    is_done: int


class SaveExerciseRequest(BaseModel):
    """Request body for saving exercise data."""

    notes: Optional[str] = None
    effort_tag: Optional[str] = None
    dropset_done: Optional[int] = None
    sets: Optional[List[SetEntryInput]] = None


class SaveExerciseResponse(BaseModel):
    """Response for save exercise endpoint."""

    status: str


class FinishSessionResponse(BaseModel):
    """Response for finish session endpoint."""

    status: str
    redirect: str
