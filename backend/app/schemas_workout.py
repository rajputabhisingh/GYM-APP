from datetime import date, datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class WorkoutSource(str, Enum):
    manual = "manual"
    voice = "voice"


class DifficultyLevel(str, Enum):
    easy = "easy"
    moderate = "moderate"
    hard = "hard"
    failure = "failure"


class ExerciseCategory(str, Enum):
    strength = "strength"
    cardio = "cardio"


class MuscleGroup(str, Enum):
    chest = "chest"
    back = "back"
    shoulders = "shoulders"
    biceps = "biceps"
    triceps = "triceps"
    forearms = "forearms"
    legs = "legs"
    glutes = "glutes"
    core = "core"
    cardio = "cardio"
    full_body = "full_body"


# ---------- Workout ----------
class WorkoutCreate(BaseModel):
    workout_date: date = Field(default_factory=date.today)
    title: Optional[str] = None
    notes: Optional[str] = None
    source: WorkoutSource = WorkoutSource.manual


class WorkoutUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None


class WorkoutOut(BaseModel):
    id: str
    user_id: str
    workout_date: date
    title: Optional[str] = None
    notes: Optional[str] = None
    source: WorkoutSource
    created_at: datetime


# ---------- Exercise catalog ----------
class ExerciseCatalogOut(BaseModel):
    id: str
    name: str
    category: ExerciseCategory
    muscle_group: MuscleGroup


# ---------- Sets ----------
class ExerciseSetIn(BaseModel):
    set_number: int
    weight_kg: Optional[float] = None
    reps: Optional[int] = None
    difficulty: Optional[DifficultyLevel] = None
    notes: Optional[str] = None
    per_side: bool = False


class ExerciseSetOut(ExerciseSetIn):
    id: str


# ---------- Workout exercise ----------
class WorkoutExerciseCreate(BaseModel):
    exercise_id: str
    exercise_order: int = 1
    sets: List[ExerciseSetIn] = []


class WorkoutExerciseOut(BaseModel):
    id: str
    exercise_id: str
    exercise_order: int
    exercise: Optional[ExerciseCatalogOut] = None
    sets: List[ExerciseSetOut] = []


# ---------- Cardio ----------
class CardioSessionCreate(BaseModel):
    exercise_id: Optional[str] = None
    activity_name: str
    speed: Optional[float] = None
    duration_minutes: float
    calories_burned: Optional[float] = None
    heart_rate: Optional[int] = None


class CardioSessionOut(CardioSessionCreate):
    id: str


# ---------- Full workout detail (nested) ----------
class WorkoutDetailOut(WorkoutOut):
    workout_exercises: List[WorkoutExerciseOut] = []
    cardio_sessions: List[CardioSessionOut] = []