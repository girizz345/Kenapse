from fastapi import APIRouter, HTTPException
from app.models.schemas import ChatRequest, ChatResponse
from app.agents.tutor_agent import TutorAgent
from app.services.llm_service import set_request_user

router = APIRouter()
_agent = TutorAgent()

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        set_request_user(request.user_id)
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
