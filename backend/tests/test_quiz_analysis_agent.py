"""Tests for QuizAnalysisAgent — fallback logic and difficulty mapping."""
import json
import pytest
from unittest.mock import patch

from app.agents.quiz_analysis_agent import QuizAnalysisAgent


@pytest.fixture
def agent():
    return QuizAnalysisAgent()


class TestDifficultyFromScore:
    def test_low_score_gives_easier(self, agent):
        assert agent.difficulty_from_score(40.0) == "easier"

    def test_passing_score_gives_maintain(self, agent):
        assert agent.difficulty_from_score(70.0) == "maintain"

    def test_high_score_gives_harder(self, agent):
        assert agent.difficulty_from_score(90.0) == "harder"

    def test_boundary_50_gives_maintain(self, agent):
        assert agent.difficulty_from_score(50.0) == "maintain"

    def test_boundary_80_gives_maintain(self, agent):
        assert agent.difficulty_from_score(80.0) == "maintain"

    def test_boundary_81_gives_harder(self, agent):
        assert agent.difficulty_from_score(81.0) == "harder"


class TestFallback:
    def test_low_score_fallback(self, agent):
        result = agent._fallback(30.0)
        assert result["misconceptions"] == []
        assert "review" in result["remediation"].lower()

    def test_high_score_fallback(self, agent):
        result = agent._fallback(95.0)
        assert "excellent" in result["encouragement"].lower() or "perfect" in result["encouragement"].lower()

    def test_fallback_has_all_keys(self, agent):
        result = agent._fallback(60.0)
        assert {"misconceptions", "remediation", "focus_topics", "encouragement"}.issubset(result.keys())


class TestAnalyze:
    @pytest.mark.asyncio
    async def test_no_wrong_answers_returns_perfect(self, agent):
        result = await agent.analyze("Math", "beginner", [], 100.0)
        assert result["misconceptions"] == []
        assert "correctly" in result["remediation"].lower()

    @pytest.mark.asyncio
    async def test_llm_failure_falls_back_gracefully(self, agent):
        with patch("app.agents.quiz_analysis_agent.generate_content", side_effect=RuntimeError("down")):
            result = await agent.analyze(
                "Physics", "intermediate",
                [{"question": "Q?", "selected": "A", "correct": "B"}],
                25.0,
            )
        assert "misconceptions" in result
        assert "remediation" in result

    @pytest.mark.asyncio
    async def test_parses_valid_llm_response(self, agent):
        mock_out = json.dumps({
            "misconceptions": ["confuses velocity with acceleration"],
            "remediation": "You mixed up velocity and acceleration.",
            "focus_topics": ["kinematics"],
            "encouragement": "Keep going!",
        })
        with patch("app.agents.quiz_analysis_agent.generate_content", return_value=mock_out):
            result = await agent.analyze(
                "Physics", "beginner",
                [{"question": "Q?", "selected": "A", "correct": "B"}],
                50.0,
            )
        assert result["misconceptions"] == ["confuses velocity with acceleration"]
        assert result["focus_topics"] == ["kinematics"]
