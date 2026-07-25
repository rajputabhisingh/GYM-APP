from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import auth, workouts, exercises, gyms
from .auth import require_role
from .schemas import UserRole, ProfileOut

settings = get_settings()

app = FastAPI(title="Gym Management API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(workouts.router)
app.include_router(exercises.router)
app.include_router(gyms.router)


@app.get("/health")
def health():
    return {"status": "ok"}


# Example role-gated route — proves role routing works end-to-end.
# Delete once real Owner Dashboard routes are built.
@app.get("/owner/ping")
def owner_ping(user: ProfileOut = Depends(require_role(UserRole.owner))):
    return {"message": f"Welcome owner {user.full_name}"}