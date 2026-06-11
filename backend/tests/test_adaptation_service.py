"""Tests for adaptation_service — pure logic, no DB calls."""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from app.services.adaptation_service import _empty_profile, get_student_profile


class TestEmptyProfile:
    def test_has_required_keys(self):
        profile = _empty_profile()
        assert profile["chapters_completed"] == 0
        assert profile["avg_score"] is None
        assert profile["weak_chapters"] == []
        assert profile["recurring_misconceptions"] == []
        assert profile["trend"] == "insufficient_data"
        assert profile["overall_difficulty"] == "maintain"


class TestGetStudentProfile:
    @pytest.mark.asyncio
    async def test_returns_empty_on_no_supabase(self):
        result = await get_student_profile(None, "user-1")
        assert result == _empty_profile()

    @pytest.mark.asyncio
    async def test_returns_empty_on_no_user_id(self):
        result = await get_student_profile(MagicMock(), "")
        assert result == _empty_profile()

    @pytest.mark.asyncio
    async def test_calculates_avg_score(self):
        mock_sb = MagicMock()
        mock_sb.table.return_value.select.return_value \
            .eq.return_value.order.return_value.execute.return_value \
            = MagicMock(data=[
                {"chapter_id": "c1", "score": 80, "attempts": 1,
                 "difficulty_recommendation": "maintain", "misconceptions": [], "created_at": "2024-01-01"},
                {"chapter_id": "c2", "score": 60, "attempts": 1,
                 "difficulty_recommendation": "maintain", "misconceptions": [], "created_at": "2024-01-02"},
            ])
        result = await get_student_profile(mock_sb, "user-1")
        assert result["avg_score"] == 70.0

    @pytest.mark.asyncio
    async def test_identifies_weak_chapters(self):
        mock_sb = MagicMock()
        mock_sb.table.return_value.select.return_value \
            .eq.return_value.order.return_value.execute.return_value \
            = MagicMock(data=[
                {"chapter_id": "c1", "score": 40, "attempts": 1,
                 "difficulty_recommendation": "easier", "misconceptions": [], "created_at": "2024-01-01"},
                {"chapter_id": "c2", "score": 90, "attempts": 1,
                 "difficulty_recommendation": "harder", "misconceptions": [], "created_at": "2024-01-02"},
            ])
        result = await get_student_profile(mock_sb, "user-1")
        assert len(result["weak_chapters"]) == 1
        assert result["weak_chapters"][0]["score"] == 40

    @pytest.mark.asyncio
    async def test_detects_recurring_misconceptions(self):
        mock_sb = MagicMock()
        mock_sb.table.return_value.select.return_value \
            .eq.return_value.order.return_value.execute.return_value \
            = MagicMock(data=[
                {"chapter_id": "c1", "score": 70, "attempts": 1,
                 "difficulty_recommendation": "maintain",
                 "misconceptions": ["confuses X with Y", "misreads formula"],
                 "created_at": "2024-01-01"},
                {"chapter_id": "c2", "score": 65, "attempts": 1,
                 "difficulty_recommendation": "maintain",
                 "misconceptions": ["confuses X with Y"],
                 "created_at": "2024-01-02"},
            ])
        result = await get_student_profile(mock_sb, "user-1")
        assert "confuses X with Y" in result["recurring_misconceptions"]
        assert "misreads formula" not in result["recurring_misconceptions"]

    @pytest.mark.asyncio
    async def test_trend_improving(self):
        mock_sb = MagicMock()
        mock_sb.table.return_value.select.return_value \
            .eq.return_value.order.return_value.execute.return_value \
            = MagicMock(data=[
                {"chapter_id": f"c{i}", "score": s, "attempts": 1,
                 "difficulty_recommendation": "maintain", "misconceptions": [],
                 "created_at": f"2024-01-0{i+1}"}
                for i, s in enumerate([40, 50, 70, 85])
            ])
        result = await get_student_profile(mock_sb, "user-1")
        assert result["trend"] == "improving"

    @pytest.mark.asyncio
    async def test_trend_insufficient_data(self):
        mock_sb = MagicMock()
        mock_sb.table.return_value.select.return_value \
            .eq.return_value.order.return_value.execute.return_value \
            = MagicMock(data=[
                {"chapter_id": "c1", "score": 70, "attempts": 1,
                 "difficulty_recommendation": "maintain", "misconceptions": [],
                 "created_at": "2024-01-01"},
            ])
        result = await get_student_profile(mock_sb, "user-1")
        assert result["trend"] == "insufficient_data"
