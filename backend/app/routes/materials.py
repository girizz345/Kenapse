from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import uuid
import logging
from app.services.material_processor import process_study_material

logger = logging.getLogger(__name__)

router = APIRouter()

class MaterialUploadRequest(BaseModel):
    file_url: str
    file_name: str
    user_id: Optional[str] = None

class MaterialUploadResponse(BaseModel):
    status: str
    message: str
    material_id: Optional[str] = None

from app.core.supabase import get_supabase
from typing import List

class MaterialListItem(BaseModel):
    id: str
    file_name: str
    created_at: str
    total_chapters: int = 0
    completed_chapters: int = 0
    progress: int = 0

@router.post("/process", response_model=MaterialUploadResponse)
async def process_material(request: MaterialUploadRequest, background_tasks: BackgroundTasks):
    try:
        logger.info(f"Processing material upload: {request.file_name} for user: {request.user_id}")

        if not request.file_url or not request.file_name:
            raise ValueError("file_url and file_name are required")

        material_id = await process_study_material(request.file_url, request.file_name, request.user_id)

        logger.info(f"Material processing completed successfully: {material_id}")
        return MaterialUploadResponse(
            status="success",
            message="Material is being processed",
            material_id=material_id
        )
    except ValueError as e:
        error_msg = f"Invalid input: {str(e)}"
        logger.warning(error_msg)
        raise HTTPException(status_code=400, detail=error_msg)
    except RuntimeError as e:
        error_msg = f"Processing error: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)

@router.delete("/{material_id}")
async def delete_material(material_id: str):
    try:
        supabase = get_supabase()
        if supabase is None:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        # Verify material exists
        check = supabase.table("study_materials").select("id").eq("id", material_id).maybe_single().execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="Course not found")

        # Chapters and quizzes cascade automatically via FK ON DELETE CASCADE
        supabase.table("study_materials").delete().eq("id", material_id).execute()
        logger.info(f"Deleted material: {material_id}")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete material error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}", response_model=List[MaterialListItem])
async def get_user_materials(user_id: str):
    try:
        supabase = get_supabase()
        if supabase is None:
            logger.error("Supabase not configured")
            raise HTTPException(status_code=500, detail="Supabase not configured")

        logger.info(f"Fetching materials for user: {user_id}")
        materials_response = supabase.table("study_materials").select("id, file_name, created_at").eq("user_id", user_id).order("created_at", desc=True).execute()
        materials = materials_response.data

        if not materials:
            return []

        # Fetch all chapters for all materials in one query
        material_ids = [m["id"] for m in materials]
        chapters_response = supabase.table("chapters").select("material_id, status").in_("material_id", material_ids).execute()

        # Group chapter counts by material_id
        chapter_stats: dict[str, dict] = {}
        for chapter in chapters_response.data:
            mid = chapter["material_id"]
            if mid not in chapter_stats:
                chapter_stats[mid] = {"total": 0, "completed": 0}
            chapter_stats[mid]["total"] += 1
            if chapter["status"] == "completed":
                chapter_stats[mid]["completed"] += 1

        result = []
        for m in materials:
            stats = chapter_stats.get(m["id"], {"total": 0, "completed": 0})
            total = stats["total"]
            completed = stats["completed"]
            progress = round((completed / total) * 100) if total > 0 else 0
            result.append({
                "id": m["id"],
                "file_name": m["file_name"],
                "created_at": m["created_at"],
                "total_chapters": total,
                "completed_chapters": completed,
                "progress": progress,
            })

        logger.info(f"Found {len(result)} materials for user: {user_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Failed to fetch user materials: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)
