"""Tests for Pydantic schema validation."""
import pytest
from pydantic import ValidationError

from app.models.schemas import (
    CourseGenerationRequest,
    LessonRequest,
    QuizRequest,
    FeedbackRequest,
    ChatRequest,
    UserContext,
)


class TestCourseGenerationRequest:
    def test_valid(self):
        r = CourseGenerationRequest(topic="Python", level="beginner", duration=5)
        assert r.topic == "Python"

    def test_invalid_level(self):
        with pytest.raises(ValidationError):
            CourseGenerationRequest(topic="Python", level="expert", duration=5)

    def test_empty_topic_rejected(self):
        with pytest.raises(ValidationError):
            CourseGenerationRequest(topic="", level="beginner", duration=5)

    def test_topic_truncated_at_200(self):
        r = CourseGenerationRequest(topic="A" * 300, level="beginner", duration=5)
        assert len(r.topic) == 200

    def test_duration_bounds(self):
        with pytest.raises(ValidationError):
            CourseGenerationRequest(topic="X", level="beginner", duration=0)
        with pytest.raises(ValidationError):
            CourseGenerationRequest(topic="X", level="beginner", duration=201)

    def test_null_byte_stripped_from_topic(self):
        r = CourseGenerationRequest(topic="hello\x00world", level="beginner", duration=3)
        assert "\x00" not in r.topic


class TestFeedbackRequest:
    def test_score_bounds(self):
        with pytest.raises(ValidationError):
            FeedbackRequest(chapter_id="c1", score=101, attempts=1)
        with pytest.raises(ValidationError):
            FeedbackRequest(chapter_id="c1", score=-1, attempts=1)

    def test_attempts_minimum(self):
        with pytest.raises(ValidationError):
            FeedbackRequest(chapter_id="c1", score=50, attempts=0)

    def test_valid(self):
        r = FeedbackRequest(chapter_id="c1", score=75, attempts=2)
        assert r.score == 75


class TestChatRequest:
    def test_empty_message_rejected(self):
        with pytest.raises(ValidationError):
            ChatRequest(
                message="",
                user_context=UserContext(current_topic="Math", level="beginner", weak_areas=[]),
            )

    def test_message_truncated(self):
        r = ChatRequest(
            message="x" * 2000,
            user_context=UserContext(current_topic="Math", level="beginner", weak_areas=[]),
        )
        assert len(r.message) == 1000

    def test_null_byte_stripped_from_message(self):
        r = ChatRequest(
            message="hello\x00there",
            user_context=UserContext(current_topic="Math", level="beginner", weak_areas=[]),
        )
        assert "\x00" not in r.message

    def test_invalid_level_in_context(self):
        with pytest.raises(ValidationError):
            ChatRequest(
                message="hi",
                user_context=UserContext(current_topic="Math", level="genius", weak_areas=[]),
            )
