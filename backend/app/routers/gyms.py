from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import get_user_client
from ..config import get_supabase_admin
from ..schemas_registration import GymSearchResult

router = APIRouter(prefix="/gyms", tags=["gyms"])


@router.get("/search", response_model=List[GymSearchResult])
def search_gyms(q: str = Query(..., min_length=1, max_length=100)):
    """Public — used on the Individual/Trainer signup forms so people can find
    a gym by name instead of typing the exact Gym Code (Recommendation, Modules 2 & 3).
    Only returns gyms that have a gym_code (i.e. the owner has verified their email)."""
    admin = get_supabase_admin()
    words = [w for w in q.strip().split() if w]

    # Each word must appear somewhere in gym_name — order-independent,
    # so "fitness island akurdi" still matches "Akurdi Fitness Island".
    name_query = admin.table("gyms").select("id, gym_name, gym_code")
    for word in words:
        name_query = name_query.ilike("gym_name", f"%{word}%")
    by_name = name_query.limit(10).execute()

    by_code = (
        admin.table("gyms")
        .select("id, gym_name, gym_code")
        .ilike("gym_code", f"%{q.strip()}%")
        .limit(10)
        .execute()
    )

    seen = {}
    for row in (by_name.data or []) + (by_code.data or []):
        if row.get("gym_code"):
            seen[row["id"]] = row
    return list(seen.values())[:10]


@router.get("/me")
def get_my_gym(client=Depends(get_user_client)):
    res = client.table("gyms").select("*").maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="No gym found for this account")
    return res.data