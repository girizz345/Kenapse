from fastapi import APIRouter, HTTPException
from app.models.schemas import LessonRequest, LessonResponse
from app.services.llm_service import generate_lesson, set_request_user
from app.core.supabase import get_supabase
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/get", response_model=LessonResponse)
async def get_lesson(request: LessonRequest):
    try:
        misconceptions: list = []
        focus_topics: list = []

        # Fetch stored adaptation data for this chapter/user
        if request.chapter_id and request.user_id:
            supabase = get_supabase()
            if supabase:
                try:
                    resp = (
                        supabase.table("quiz_results")
                        .select("misconceptions, focus_topics, score")
                        .eq("chapter_id", request.chapter_id)
                        .eq("user_id", request.user_id)
                        .maybe_single()
                        .execute()
                    )
                    if resp.data:
                        misconceptions = resp.data.get("misconceptions") or []
                        focus_topics = resp.data.get("focus_topics") or []
                        if misconceptions:
                            logger.info(
                                f"Lesson adaptation: addressing {len(misconceptions)} "
                                f"misconception(s) for chapter {request.chapter_id}"
                            )
                except Exception as e:
                    logger.warning(f"Could not fetch adaptation data for lesson: {e}")

        set_request_user(request.user_id)
        lesson_data = await generate_lesson(
            request.chapter_id,
            request.topic,
            request.level,
            content_text=request.content_text or "",
            misconceptions=misconceptions,
            focus_topics=focus_topics,
        )
        if not lesson_data:
            raise HTTPException(status_code=500, detail="Failed to generate lesson")
        return lesson_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
