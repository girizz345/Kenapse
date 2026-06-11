from pydantic import BaseModel, field_validator, Field
from typing import List, Optional, Literal

_VALID_LEVELS = {"beginner", "intermediate", "advanced"}


def _clean(v: str, max_len: int = 500) -> str:
    return v.replace("\x00", "").strip()[:max_len]


# Course Generation
class CourseGenerationRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)
    level: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    duration: int = Field(..., ge=1, le=200)
    user_id: Optional[str] = None

    @field_validator("topic")
    @classmethod
    def sanitize_topic(cls, v: str) -> str:
        return _clean(v, 200)

class TopicItem(BaseModel):
    name: str

class Chapter(BaseModel):
    id: str
    material_id: str
    title: str
    topics: List[str]
    objective: str
    status: str
    order_index: int
    content_text: Optional[str] = None   # excerpt from uploaded material (PDF courses)

class GeneratedChapter(BaseModel):
    chapter_id: int
    title: str
    topics: List[str]
    objective: str

class CourseGenerationResponse(BaseModel):
    course_title: str
    chapters: List[GeneratedChapter]

class ChapterStatusUpdateRequest(BaseModel):
    status: str

# Lesson Generation
class LessonRequest(BaseModel):
    chapter_id: str
    topic: str = Field(..., min_length=1, max_length=200)
    level: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    content_text: Optional[str] = Field(default=None, max_length=5000)
    user_id: Optional[str] = None

    @field_validator("topic")
    @classmethod
    def sanitize_topic(cls, v: str) -> str:
        return _clean(v, 200)

class ExampleStep(BaseModel):
    type: str   # "header" | "text" | "formula" | "answer"
    text: str

class LessonResponse(BaseModel):
    title: str
    summary: Optional[str] = None
    explanation: str
    example_steps: List[ExampleStep] = []
    example: Optional[str] = None   # legacy fallback, ignored by frontend
    key_points: List[str]
    fun_fact: Optional[str] = None

# Quiz Generation
class QuizRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)
    level: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    chapter_id: Optional[str] = None
    user_id: Optional[str] = None

    @field_validator("topic")
    @classmethod
    def sanitize_topic(cls, v: str) -> str:
        return _clean(v, 200)

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    answer: str
    hint: Optional[str] = None

class QuizResponse(BaseModel):
    questions: List[QuizQuestion]

# Feedback
class WrongAnswer(BaseModel):
    question: str
    selected: str
    correct: str

class FeedbackRequest(BaseModel):
    chapter_id: str
    score: int = Field(..., ge=0, le=100)
    attempts: int = Field(..., ge=1)
    user_id: Optional[str] = None
    topic: Optional[str] = Field(default=None, max_length=200)
    level: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    wrong_answers: Optional[List[WrongAnswer]] = None

class FeedbackResponse(BaseModel):
    status: str
    message: str
    new_difficulty: str
    analysis: Optional[dict] = None

# Chat
class UserContext(BaseModel):
    current_topic: str = Field(..., max_length=200)
    level: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    weak_areas: List[str] = Field(default_factory=list, max_length=20)

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    user_context: UserContext
    chapter_id: Optional[str] = None
    user_id: Optional[str] = None
    material_id: Optional[str] = None

    @field_validator("message")
    @classmethod
    def sanitize_message(cls, v: str) -> str:
        return _clean(v, 1000)

class ChatResponse(BaseModel):
    response: str
