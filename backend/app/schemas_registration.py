from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, model_validator

from .schemas import ProfileOut


class WorkoutLocation(str, Enum):
    free = "free"
    in_gym = "in_gym"


class TrainerCategory(str, Enum):
    freelancer = "freelancer"
    in_gym = "in_gym"


class IndividualSignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    workout_type: WorkoutLocation
    gym_code: Optional[str] = None  # optional even for In-Gym — not selecting one shouldn't block signup
    phone: str = Field(..., min_length=10, max_length=15)
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.]+$")
    password: str = Field(..., min_length=6)
    promo_code: Optional[str] = None


class TrainerSignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    trainer_type: TrainerCategory
    gym_code: Optional[str] = None  # FR-03: mandatory only when trainer_type == in_gym
    phone: str = Field(..., min_length=10, max_length=15)
    email: EmailStr
    pin_code: str = Field(..., pattern=r"^[0-9]{6}$")
    username: str = Field(..., min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.]+$")
    password: str = Field(..., min_length=6)
    promo_code: Optional[str] = None

    @model_validator(mode="after")
    def check_gym_code(self):
        if self.trainer_type == TrainerCategory.in_gym and not self.gym_code:
            raise ValueError("Gym Code is required for In-Gym trainers.")
        return self


class SignupResponse(BaseModel):
    profile: ProfileOut
    verified: bool
    message: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class GymSearchResult(BaseModel):
    id: str
    gym_name: str
    gym_code: str


class AvailabilityResponse(BaseModel):
    field: str
    value: str
    available: bool