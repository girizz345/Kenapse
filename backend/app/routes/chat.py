from fastapi import APIRouter, HTTPException
from app.models.schemas import ChatRequest, ChatResponse
from app.agents.tutor_agent import TutorAgent

router = APIRouter()
_agent = TutorAgent()

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        response_text = await _agent.run(
            message=request.message,
            user_context=request.user_context.dict(),
            chapter_id=request.chapter_id,
            user_id=request.user_id,
            material_id=request.material_id,
        )
        return ChatResponse(response=response_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
