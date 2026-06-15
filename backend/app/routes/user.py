from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.core.supabase import get_supabase
from app.services.llm_service import get_user_token_usage
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/tokens")
async def my_token_usage(authorization: Optional[str] = Header(None)):
    """Return the calling user's own token consumption stats."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = authorization.split(" ", 1)[1]
    supabase = get_supabase()
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        user_id = str(user_response.user.id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

    return get_user_token_usage(user_id)
