from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    owner = "owner"
    trainer = "trainer"
    individual = "individual"


class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    email: EmailStr
    phone: str
    password: str = Field(..., min_length=6)
    role: UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ProfileOut(BaseModel):
    id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    username: Optional[str] = None
    role: UserRole
    goals: List[str] = []


class GoalsUpdateRequest(BaseModel):
    goals: List[str]


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    profile: ProfileOut