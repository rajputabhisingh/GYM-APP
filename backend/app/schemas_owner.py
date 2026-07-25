from typing import Optional
from pydantic import BaseModel, EmailStr, Field

from .schemas import ProfileOut


class OwnerSignupRequest(BaseModel):
    gym_name: str = Field(..., min_length=2)
    owner_name: str = Field(..., min_length=2)
    phone: str = Field(..., min_length=10, max_length=15)
    email: EmailStr
    address: str = Field(..., min_length=5)
    pin_code: str = Field(..., pattern=r"^[0-9]{6}$", description="6-digit PIN code")
    username: str = Field(..., min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.]+$")
    password: str = Field(..., min_length=6)
    promo_code: Optional[str] = None


class GymOut(BaseModel):
    id: str
    gym_name: str
    address: str
    pin_code: str
    gym_code: Optional[str] = None
    promo_code: Optional[str] = None


class OwnerSignupResponse(BaseModel):
    profile: ProfileOut
    gym: GymOut
    message: str