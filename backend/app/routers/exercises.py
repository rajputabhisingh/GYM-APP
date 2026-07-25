from typing import Optional, List
from fastapi import APIRouter, Depends, Query

from ..auth import get_user_client
from ..schemas_workout import ExerciseCatalogOut

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=List[ExerciseCatalogOut])
def list_exercises(
    search: Optional[str] = Query(None, description="Name search, e.g. 'bench'"),
    muscle_group: Optional[str] = Query(None),
    category: Optional[str] = Query(None, description="'strength' or 'cardio'"),
    client=Depends(get_user_client),
):
    q = client.table("exercise_catalog").select("*")
    if search:
        q = q.ilike("name", f"%{search}%")
    if muscle_group:
        q = q.eq("muscle_group", muscle_group)
    if category:
        q = q.eq("category", category)
    res = q.order("name").execute()
    return res.data
