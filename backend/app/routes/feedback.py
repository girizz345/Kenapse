from fastapi import APIRouter
from app.models.schemas import FeedbackRequest, FeedbackResponse
from app.agents.quiz_analysis_agent import QuizAnalysisAgent
from app.core.supabase import get_supabase
import logging

router = APIRouter()
logger = logging.getLogger(__name__)
_agent = QuizAnalysisAgent()


@router.post("/submit", response_model=FeedbackResponse)
async def submit_feedback(request: FeedbackRequest):
    wrong_answers = [w.dict() for w in (request.wrong_answers or [])]
    score_pct = float(request.score)

    analysis = await _agent.analyze(
        topic=request.topic or "the topic",
        level=request.level or "intermediate",
        wrong_answers=wrong_answers,
        score_pct=score_pct,
    )

    new_difficulty = _agent.difficulty_from_score(score_pct)
    message = analysis.get("encouragement", "")

    supabase = get_supabase()

    # Layer 3: check for retry improvement BEFORE overwriting the old row
    if supabase and request.user_id:
        try:
            from app.services.adaptation_service import check_and_ingest_improvement
            await check_and_ingest_improvement(
                supabase=supabase,
                chapter_id=request.chapter_id,
                user_id=request.user_id,
                new_score_pct=score_pct,
                topic=request.topic or "the topic",
            )
        except Exception as e:
            logger.warning(f"Layer 3 improvement check failed (non-critical): {e}")

    # Persist score + full analysis
    if supabase:
        try:
            upsert_payload = {
                "chapter_id": request.chapter_id,
                "score": request.score,
                "attempts": request.attempts,
                "difficulty_recommendation": new_difficulty,
                "misconceptions": analysis.get("misconceptions", []),
                "focus_topics": analysis.get("focus_topics", []),
                "remediation": analysis.get("remediation", ""),
            }
            if request.user_id:
                upsert_payload["user_id"] = request.user_id

            conflict_target = "chapter_id,user_id" if request.user_id else "chapter_id"
            supabase.table("quiz_results").upsert(
                upsert_payload,
                on_conflict=conflict_target,
            ).execute()
        except Exception as e:
            logger.warning(f"Could not persist feedback: {e}")

    return FeedbackResponse(
        status="success",
        message=message,
        new_difficulty=new_difficulty,
        analysis=analysis,
    )
