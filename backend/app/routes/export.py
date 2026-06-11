import os
import tempfile
import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
from app.services.pdf_service import generate_pdf

router = APIRouter()

class ExportRequest(BaseModel):
    title: str
    explanation: str
    example: str
    key_points: List[str]

@router.post("/pdf")
async def export_pdf(request: ExportRequest):
    try:
        tmp_dir = tempfile.gettempdir()
        filename = os.path.join(tmp_dir, f"kenapse_export_{uuid.uuid4().hex}.pdf")
        generate_pdf(
            title=request.title,
            explanation=request.explanation,
            example=request.example,
            key_points=request.key_points,
            output_filename=filename,
        )
        return FileResponse(
            path=filename,
            filename="lesson_export.pdf",
            media_type="application/pdf",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
