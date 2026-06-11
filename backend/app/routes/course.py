import uuid
from fastapi import APIRouter, HTTPException
from typing import List
from app.models.schemas import CourseGenerationRequest, Chapter, ChapterStatusUpdateRequest
from app.services.llm_service import generate_course
from app.core.supabase import get_supabase
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/generate")
async def create_course(request: CourseGenerationRequest):
    try:
        course_data = await generate_course(request.topic, request.level, request.duration)
        if not course_data:
            raise HTTPException(status_code=500, detail="Failed to generate course")

        material_id = None

        # Persist to DB so CourseFlow can load it
        supabase = get_supabase()
        if request.user_id and supabase:
            material_id = str(uuid.uuid4())
            course_title = course_data.get("course_title", request.topic)

            supabase.table("study_materials").insert({
                "id": material_id,
                "user_id": request.user_id,
                "file_url": "",
                "file_name": course_title,
            }).execute()

            chapters = course_data.get("chapters", [])
            for i, ch in enumerate(chapters):
                supabase.table("chapters").insert({
                    "material_id": material_id,
                    "title": ch.get("title", ""),
                    "objective": ch.get("objective", ""),
                    "topics": ch.get("topics", []),
                    "order_index": i + 1,
                    "status": "active" if i == 0 else "locked",
                }).execute()

            logger.info(f"Course saved to DB: {material_id} ({len(chapters)} chapters)")

        return {**course_data, "material_id": material_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Course generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{material_id}", response_model=List[Chapter])
async def get_chapters(material_id: str):
    try:
        supabase = get_supabase()
        if supabase is None:
            raise HTTPException(status_code=500, detail="Supabase not configured")
        response = supabase.table("chapters").select("*").eq("material_id", material_id).order("order_index").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/chapter/{chapter_id}/status")
async def update_chapter_status(chapter_id: str, request: ChapterStatusUpdateRequest):
    try:
        supabase = get_supabase()
        if supabase is None:
            raise HTTPException(status_code=500, detail="Supabase not configured")
        supabase.table("chapters").update({"status": request.status}).eq("id", chapter_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
