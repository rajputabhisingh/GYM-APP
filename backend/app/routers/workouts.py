from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import get_user_client, get_current_user
from ..schemas import ProfileOut
from ..schemas_workout import (
    WorkoutCreate,
    WorkoutUpdate,
    WorkoutOut,
    WorkoutDetailOut,
    WorkoutExerciseCreate,
    CardioSessionCreate,
)

router = APIRouter(prefix="/workouts", tags=["workouts"])

# Nested select: workout -> exercises -> catalog info + sets, plus cardio sessions
WORKOUT_DETAIL_SELECT = (
    "*, "
    "workout_exercises(id, exercise_id, exercise_order, "
    "exercise:exercise_catalog(id, name, category, muscle_group), "
    "sets:exercise_sets(*)), "
    "cardio_sessions(*)"
)


@router.get("/exercise-history/{exercise_id}")
def get_exercise_history(exercise_id: str, client=Depends(get_user_client)):
    """Last session's sets (for pre-fill) + all-time best (target to beat)."""
    res = (
        client.table("workout_exercises")
        .select("id, created_at, sets:exercise_sets(*)")
        .eq("exercise_id", exercise_id)
        .order("created_at", desc=True)
        .execute()
    )
    if not res.data:
        return {"sets": [], "best": None}

    last_sets = sorted(res.data[0].get("sets") or [], key=lambda s: s.get("set_number", 0))

    best_weight = 0
    best_reps = 0
    for we in res.data:
        for s in we.get("sets") or []:
            w = s.get("weight_kg") or 0
            if w > best_weight:
                best_weight = w
                best_reps = s.get("reps") or 0

    best = {"weight_kg": best_weight, "reps": best_reps} if best_weight > 0 else None
    return {"sets": last_sets, "best": best}


@router.post("", response_model=WorkoutOut, status_code=201)
def create_workout(
    payload: WorkoutCreate,
    user: ProfileOut = Depends(get_current_user),
    client=Depends(get_user_client),
):
    """Start a new daily workout session (e.g. 'Chest + Biceps')."""
    data = payload.model_dump(mode="json")
    data["user_id"] = user.id
    res = client.table("workouts").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Could not create workout")
    return res.data[0]


@router.get("", response_model=List[WorkoutDetailOut])
def list_workouts(
    from_date: Optional[date] = Query(None, description="Filter workouts on/after this date"),
    to_date: Optional[date] = Query(None, description="Filter workouts on/before this date"),
    exercise_id: Optional[str] = Query(None, description="Only workouts containing this exercise"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    client=Depends(get_user_client),
):
    """History view — supports daily/weekly/monthly/yearly filtering via from_date/to_date,
    and exercise-wise filtering via exercise_id. Muscle-group filtering can be done
    client-side off the nested `exercise.muscle_group` field, or ask for that filter
    to be added server-side if the history list grows large."""
    q = client.table("workouts").select(WORKOUT_DETAIL_SELECT)
    if from_date:
        q = q.gte("workout_date", from_date.isoformat())
    if to_date:
        q = q.lte("workout_date", to_date.isoformat())
    if exercise_id:
        q = q.eq("workout_exercises.exercise_id", exercise_id)
    q = q.order("workout_date", desc=True).range(offset, offset + limit - 1)
    res = q.execute()
    return res.data


@router.get("/{workout_id}", response_model=WorkoutDetailOut)
def get_workout(workout_id: str, client=Depends(get_user_client)):
    res = (
        client.table("workouts")
        .select(WORKOUT_DETAIL_SELECT)
        .eq("id", workout_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Workout not found")
    return res.data


@router.patch("/{workout_id}", response_model=WorkoutOut)
def update_workout(workout_id: str, payload: WorkoutUpdate, client=Depends(get_user_client)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = client.table("workouts").update(data).eq("id", workout_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Workout not found")
    return res.data[0]


@router.delete("/{workout_id}", status_code=204)
def delete_workout(workout_id: str, client=Depends(get_user_client)):
    client.table("workouts").delete().eq("id", workout_id).execute()
    return None


@router.post("/{workout_id}/exercises", status_code=201)
def add_exercise(workout_id: str, payload: WorkoutExerciseCreate, client=Depends(get_user_client)):
    """Log one exercise + all its sets in a single call.
    Example body:
    {
      "exercise_id": "<uuid from GET /exercises>",
      "exercise_order": 1,
      "sets": [
        {"set_number": 1, "weight_kg": 22.5, "reps": 10, "difficulty": "easy"},
        {"set_number": 2, "weight_kg": 22.5, "reps": 15, "difficulty": "hard",
         "notes": "Easy at the beginning, heavy during the last 4 reps."}
      ]
    }
    """
    we_res = (
        client.table("workout_exercises")
        .insert({
            "workout_id": workout_id,
            "exercise_id": payload.exercise_id,
            "exercise_order": payload.exercise_order,
        })
        .execute()
    )
    if not we_res.data:
        raise HTTPException(status_code=400, detail="Could not add exercise — check workout_id / exercise_id")
    workout_exercise_id = we_res.data[0]["id"]

    sets_out = []
    if payload.sets:
        sets_payload = [
            {**s.model_dump(exclude_none=True), "workout_exercise_id": workout_exercise_id}
            for s in payload.sets
        ]
        sets_res = client.table("exercise_sets").insert(sets_payload).execute()
        sets_out = sets_res.data

    return {"workout_exercise": we_res.data[0], "sets": sets_out}


@router.post("/{workout_id}/cardio", status_code=201)
def add_cardio(workout_id: str, payload: CardioSessionCreate, client=Depends(get_user_client)):
    data = payload.model_dump(exclude_none=True)
    data["workout_id"] = workout_id
    res = client.table("cardio_sessions").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Could not add cardio session")
    return res.data[0]