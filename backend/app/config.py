from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import create_client, Client


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    FRONTEND_ORIGIN: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except Exception as e:
        raise RuntimeError(
            "Config load failed. Checklist:\n"
            "  1. `.env` file must be inside `backend/` folder.\n"
            "  2. You must run `uvicorn` FROM the `backend/` folder "
            "(e.g. `cd backend` then `uvicorn app.main:app --reload`).\n"
            "  3. `.env` must have real values for SUPABASE_URL, SUPABASE_ANON_KEY, "
            "SUPABASE_SERVICE_ROLE_KEY (the secret key — different from the anon key).\n"
            f"Original error: {e}"
        ) from e


def get_supabase_client() -> Client:
    """Anon client — used for signup/login. Respects RLS."""
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


def get_supabase_admin() -> Client:
    """Service-role client — bypasses RLS. Server-side trusted reads only."""
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)