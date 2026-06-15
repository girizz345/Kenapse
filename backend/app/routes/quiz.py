from fastapi import APIRouter, HTTPException
from app.models.schemas import QuizRequest, QuizResponse
from app.services.llm_service import generate_quiz, set_request_user
from app.core.supabase import get_supabase
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

_DIFFICULTY_MAP = {
    "easier":   {"beginner": "beginner",     "intermediate": "beginner",     "advanced": "intermediate"},
    "maintain": {"beginner": "beginner",     "intermediate": "intermediate", "advanced": "advanced"},
    "harder":   {"beginner": "intermediate", "intermediate": "advanced",     "advanced": "advanced"},
}


def _effective_level(recommendation: str, base_level: str) -> str:
    return _DIFFICULTY_MAP.get(recommendation, {}).get(base_level, base_level)


@router.post("/generate", response_model=QuizResponse)
async def create_quiz(request: QuizRequest):
    try:
        effective_level = request.level
        prior_misconceptions: list = []

        # Fetch stored adaptation data for this chapter/user
        if request.chapter_id and request.user_id:
            supabase = get_supabase()
            if supabase:
                try:
                    resp = (
                        supabase.table("quiz_results")
                        .select("difficulty_recommendation, misconceptions")
                        .eq("chapter_id", request.chapter_id)
                        .eq("user_id", request.user_id)
                        .maybe_single()
                        .execute()
                    )
                    if resp.data:
                        rec = resp.data.get("difficulty_recommendation")
                        if rec:
                            effective_level = _effective_level(rec, request.level)
                            logger.info(
                                f"Quiz adaptation: {request.level} → {effective_level} "
                                f"(recommendation: {rec})"
                            )
                        prior_misconceptions = resp.data.get("misconceptions") or []
                except Exception as e:
                    logger.warning(f"Could not fetch adaptation data for quiz: {e}")

        set_request_user(request.user_id)
        quiz_data = await generate_quiz(
            topic=request.topic,
            level=effective_level,
            prior_misconceptions=prior_misconceptions,
        )
        if not quiz_data:
            raise HTTPException(status_code=500, detail="Failed to generate quiz")
        return quiz_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{chapter_id}", response_model=QuizResponse)
async def get_quiz(chapter_id: str):
    try:
        supabase = get_supabase()
        if supabase is None:
            raise HTTPException(status_code=500, detail="Supabase not configured")
        response = supabase.table("quizzes").select("*").eq("chapter_id", chapter_id).maybe_single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Quiz not found")
        return {"questions": response.data["questions"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
