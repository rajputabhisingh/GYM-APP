from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

from .config import get_settings, get_supabase_admin, get_supabase_client
from .schemas import ProfileOut, UserRole

bearer_scheme = HTTPBearer()


def _verify_token(token: str):
    """Validates the access token directly against Supabase Auth.
    No local JWT secret needed — works whether the project signs tokens
    with a legacy shared HS256 secret or the newer asymmetric JWT keys."""
    supabase = get_supabase_client()
    try:
        user_resp = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )
    if not user_resp or not user_resp.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )
    return user_resp.user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ProfileOut:
    user = _verify_token(credentials.credentials)

    admin = get_supabase_admin()
    res = admin.table("profiles").select("*").eq("id", user.id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Profile not found for this account")

    return ProfileOut(**res.data)


def get_user_client(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> Client:
    """Supabase client scoped to the caller's own identity (via their access token).
    Every query made through this client is filtered by RLS as that user —
    ownership checks don't need to be re-implemented in Python."""
    _verify_token(credentials.credentials)  # 401s on bad/expired token
    settings = get_settings()
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    client.postgrest.auth(credentials.credentials)
    return client


def require_role(*allowed_roles: UserRole):
    """Usage: Depends(require_role(UserRole.owner))"""
    def _guard(user: ProfileOut = Depends(get_current_user)) -> ProfileOut:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(r.value for r in allowed_roles)}",
            )
        return user
    return _guard