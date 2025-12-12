"""
Pydantic models for request/response validation
"""

from pydantic import BaseModel


class SetEntryInput(BaseModel):
    """Set entry input for auto-save."""

    set_number: int
    weight_kg: float
    reps: int
    is_done: int


class SaveExerciseRequest(BaseModel):
    """Request body for saving exercise data."""

    notes: str | None = None
    effort_tag: str | None = None
    dropset_done: int | None = None
    sets: list[SetEntryInput] | None = None


class SaveExerciseResponse(BaseModel):
    """Response for save exercise endpoint."""

    status: str


class FinishSessionResponse(BaseModel):
    """Response for finish session endpoint."""

    status: str
    redirect: str
