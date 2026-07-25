from fastapi import APIRouter, HTTPException, Depends, Query

from ..config import get_supabase_client, get_supabase_admin
from ..schemas import SignupRequest, LoginRequest, RefreshRequest, TokenResponse, ProfileOut, GoalsUpdateRequest
from ..schemas_owner import OwnerSignupRequest, OwnerSignupResponse, GymOut
from ..schemas_registration import (
    IndividualSignupRequest,
    TrainerSignupRequest,
    SignupResponse,
    ResendVerificationRequest,
    AvailabilityResponse,
)
from ..auth import get_current_user, get_user_client

router = APIRouter(prefix="/auth", tags=["auth"])


def _resolve_gym_by_code(admin, gym_code: str) -> str:
    """FR-03/FR-04 (Modules 2 & 3): validate the Gym Code exists before creating the account."""
    res = (
        admin.table("gyms")
        .select("id")
        .eq("gym_code", gym_code.strip().upper())
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=400, detail="Invalid Gym Code — please check and try again.")
    return res.data["id"]


def _already_confirmed(user) -> bool:
    return bool(getattr(user, "email_confirmed_at", None) or getattr(user, "confirmed_at", None))


def _friendly_conflict_error(raw: str) -> str:
    low = raw.lower()
    if "username" in low and ("unique" in low or "duplicate" in low):
        return "This username is already taken."
    if "phone" in low and ("unique" in low or "duplicate" in low):
        return "This phone number is already registered."
    if "gyms_owner_id_key" in low or ("owner_id" in low and "unique" in low):
        return "This account is already registered as a gym owner."
    if "already" in low and ("regist" in low or "exist" in low):
        return "This email is already registered."
    if "email" in low and ("taken" in low or "exist" in low or "regist" in low):
        return "This email is already registered."
    # Unmatched — surface the real reason instead of hiding it behind a vague message
    return f"Registration failed: {raw}"


@router.post("/signup", response_model=ProfileOut, status_code=201)
def signup(payload: SignupRequest):
    supabase = get_supabase_client()
    try:
        result = supabase.auth.sign_up({
            "email": payload.email,
            "password": payload.password,
            "options": {
                "data": {
                    "full_name": payload.full_name,
                    "phone": payload.phone,
                    "role": payload.role.value,
                }
            },
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not result.user:
        raise HTTPException(status_code=400, detail="Signup failed")

    admin = get_supabase_admin()
    res = admin.table("profiles").select("*").eq("id", result.user.id).maybe_single().execute()

    if not res or not res.data:
        # DB trigger didn't create the row — happens if this email was already
        # registered-but-unconfirmed from an earlier attempt (Supabase reuses that
        # user without re-inserting into auth.users, so the trigger never fires).
        # Self-heal by writing the profile directly.
        upsert_res = (
            admin.table("profiles")
            .upsert({
                "id": result.user.id,
                "full_name": payload.full_name,
                "email": payload.email,
                "phone": payload.phone,
                "role": payload.role.value,
            })
            .execute()
        )
        if not upsert_res.data:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Account created in Auth but profile could not be saved. "
                    "Confirm the `profiles` table and `user_role` enum exist "
                    "(run supabase/schema.sql in the Supabase SQL Editor)."
                ),
            )
        return ProfileOut(**upsert_res.data[0])

    return ProfileOut(**res.data)


@router.post("/signup/owner", response_model=OwnerSignupResponse, status_code=201)
def signup_owner(payload: OwnerSignupRequest):
    """Gym Owner Registration — PRD Module 1 (FR-01..FR-10)."""
    supabase = get_supabase_client()
    try:
        result = supabase.auth.sign_up({
            "email": payload.email,
            "password": payload.password,
            "options": {
                "data": {
                    "full_name": payload.owner_name,
                    "phone": payload.phone,
                    "role": "owner",
                    "username": payload.username,
                }
            },
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=_friendly_conflict_error(str(e)))

    if not result.user:
        raise HTTPException(status_code=400, detail="Registration failed")

    admin = get_supabase_admin()

    # Profile: trigger usually creates it; self-heal if not (see /auth/signup for why)
    profile_res = admin.table("profiles").select("*").eq("id", result.user.id).maybe_single().execute()
    if not profile_res or not profile_res.data:
        try:
            upsert_res = (
                admin.table("profiles")
                .upsert({
                    "id": result.user.id,
                    "full_name": payload.owner_name,
                    "email": payload.email,
                    "phone": payload.phone,
                    "role": "owner",
                    "username": payload.username,
                })
                .execute()
            )
        except Exception as e:
            raise HTTPException(status_code=409, detail=_friendly_conflict_error(str(e)))
        if not upsert_res.data:
            raise HTTPException(status_code=500, detail="Account created but profile could not be saved.")
        profile_data = upsert_res.data[0]
    else:
        profile_data = profile_res.data

    # Gym row — gym_code stays NULL until email verification (FR-09), UNLESS
    # "Confirm email" is OFF in Supabase, in which case the user is already
    # confirmed the instant sign_up() returns — generate the code right away
    # instead of waiting on a verification event that will never fire.
    already_confirmed = bool(
        getattr(result.user, "email_confirmed_at", None)
        or getattr(result.user, "confirmed_at", None)
    )
    gym_code_value = None
    if already_confirmed:
        try:
            code_res = admin.rpc("generate_gym_code", {}).execute()
            gym_code_value = code_res.data
        except Exception:
            gym_code_value = None  # non-fatal — gym still gets created without a code

    gym_insert = {
        "owner_id": result.user.id,
        "gym_name": payload.gym_name,
        "address": payload.address,
        "pin_code": payload.pin_code,
        "promo_code": payload.promo_code,
    }
    if gym_code_value:
        gym_insert["gym_code"] = gym_code_value

    try:
        gym_res = admin.table("gyms").insert(gym_insert).execute()
    except Exception as e:
        raise HTTPException(status_code=409, detail=_friendly_conflict_error(str(e)))

    if not gym_res.data:
        raise HTTPException(status_code=500, detail="Gym could not be created.")

    if gym_code_value:
        message = f"Registration successful! Your Gym Code is {gym_code_value}."
    else:
        message = "Registration successful. Check your email to verify your account before logging in."

    return OwnerSignupResponse(
        profile=ProfileOut(**profile_data),
        gym=GymOut(**gym_res.data[0]),
        message=message,
    )


@router.post("/signup/individual", response_model=SignupResponse, status_code=201)
def signup_individual(payload: IndividualSignupRequest):
    """Individual User Registration — PRD Module 2 (FR-01..FR-07)."""
    admin = get_supabase_admin()

    gym_id = None
    if payload.workout_type.value == "in_gym" and payload.gym_code:
        gym_id = _resolve_gym_by_code(admin, payload.gym_code)

    supabase = get_supabase_client()
    try:
        result = supabase.auth.sign_up({
            "email": payload.email,
            "password": payload.password,
            "options": {
                "data": {
                    "full_name": payload.full_name,
                    "phone": payload.phone,
                    "role": "individual",
                    "username": payload.username,
                    "workout_type": payload.workout_type.value,
                    "gym_id": gym_id,
                }
            },
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=_friendly_conflict_error(str(e)))

    if not result.user:
        raise HTTPException(status_code=400, detail="Registration failed")

    profile_res = admin.table("profiles").select("*").eq("id", result.user.id).maybe_single().execute()
    if not profile_res or not profile_res.data:
        try:
            upsert_res = (
                admin.table("profiles")
                .upsert({
                    "id": result.user.id,
                    "full_name": payload.full_name,
                    "email": payload.email,
                    "phone": payload.phone,
                    "role": "individual",
                    "username": payload.username,
                    "workout_type": payload.workout_type.value,
                    "gym_id": gym_id,
                })
                .execute()
            )
        except Exception as e:
            raise HTTPException(status_code=409, detail=_friendly_conflict_error(str(e)))
        if not upsert_res.data:
            raise HTTPException(status_code=500, detail="Account created but profile could not be saved.")
        profile_data = upsert_res.data[0]
    else:
        profile_data = profile_res.data

    verified = _already_confirmed(result.user)
    message = (
        "Registration successful! You can log in now."
        if verified
        else "Registration successful. Check your email to verify your account before logging in."
    )
    return SignupResponse(profile=ProfileOut(**profile_data), verified=verified, message=message)


@router.post("/signup/trainer", response_model=SignupResponse, status_code=201)
def signup_trainer(payload: TrainerSignupRequest):
    """Trainer Registration — PRD Module 3 (FR-01..FR-07)."""
    admin = get_supabase_admin()

    gym_id = None
    if payload.trainer_type.value == "in_gym":
        gym_id = _resolve_gym_by_code(admin, payload.gym_code)

    supabase = get_supabase_client()
    try:
        result = supabase.auth.sign_up({
            "email": payload.email,
            "password": payload.password,
            "options": {
                "data": {
                    "full_name": payload.full_name,
                    "phone": payload.phone,
                    "role": "trainer",
                    "username": payload.username,
                    "trainer_category": payload.trainer_type.value,
                    "pin_code": payload.pin_code,
                    "gym_id": gym_id,
                }
            },
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=_friendly_conflict_error(str(e)))

    if not result.user:
        raise HTTPException(status_code=400, detail="Registration failed")

    profile_res = admin.table("profiles").select("*").eq("id", result.user.id).maybe_single().execute()
    if not profile_res or not profile_res.data:
        try:
            upsert_res = (
                admin.table("profiles")
                .upsert({
                    "id": result.user.id,
                    "full_name": payload.full_name,
                    "email": payload.email,
                    "phone": payload.phone,
                    "role": "trainer",
                    "username": payload.username,
                    "trainer_category": payload.trainer_type.value,
                    "pin_code": payload.pin_code,
                    "gym_id": gym_id,
                })
                .execute()
            )
        except Exception as e:
            raise HTTPException(status_code=409, detail=_friendly_conflict_error(str(e)))
        if not upsert_res.data:
            raise HTTPException(status_code=500, detail="Account created but profile could not be saved.")
        profile_data = upsert_res.data[0]
    else:
        profile_data = profile_res.data

    verified = _already_confirmed(result.user)
    message = (
        "Registration successful! You can log in now."
        if verified
        else "Registration successful. Check your email to verify your account before logging in."
    )
    return SignupResponse(profile=ProfileOut(**profile_data), verified=verified, message=message)


@router.post("/resend-verification")
def resend_verification(payload: ResendVerificationRequest):
    """Recommendation (Modules 2 & 3): allow resending the verification email."""
    supabase = get_supabase_client()
    try:
        supabase.auth.resend({"type": "signup", "email": payload.email})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Verification email resent — check your inbox."}


@router.get("/check-availability", response_model=AvailabilityResponse)
def check_availability(
    field: str = Query(..., pattern="^(username|phone)$"),
    value: str = Query(..., min_length=1),
):
    """Recommendation (Modules 2 & 3): real-time uniqueness check for username/phone."""
    admin = get_supabase_admin()
    res = admin.table("profiles").select("id").eq(field, value).limit(1).execute()
    return AvailabilityResponse(field=field, value=value, available=len(res.data) == 0)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    supabase = get_supabase_client()
    try:
        result = supabase.auth.sign_in_with_password({
            "email": payload.email,
            "password": payload.password,
        })
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not result.session:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    admin = get_supabase_admin()
    res = admin.table("profiles").select("*").eq("id", result.user.id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Profile not found for this account")

    return TokenResponse(
        access_token=result.session.access_token,
        refresh_token=result.session.refresh_token,
        profile=ProfileOut(**res.data),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest):
    """Called automatically by the frontend when an access token has expired."""
    supabase = get_supabase_client()
    try:
        result = supabase.auth.refresh_session(payload.refresh_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Session expired — please log in again.")

    if not result.session:
        raise HTTPException(status_code=401, detail="Session expired — please log in again.")

    admin = get_supabase_admin()
    res = admin.table("profiles").select("*").eq("id", result.user.id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Profile not found for this account")

    return TokenResponse(
        access_token=result.session.access_token,
        refresh_token=result.session.refresh_token,
        profile=ProfileOut(**res.data),
    )


@router.get("/me", response_model=ProfileOut)
def me(current_user: ProfileOut = Depends(get_current_user)):
    return current_user


@router.patch("/goals", response_model=ProfileOut)
def update_goals(
    payload: GoalsUpdateRequest,
    user: ProfileOut = Depends(get_current_user),
    client=Depends(get_user_client),
):
    res = client.table("profiles").update({"goals": payload.goals}).eq("id", user.id).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Could not update goals")
    return ProfileOut(**res.data[0])