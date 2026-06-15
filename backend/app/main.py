from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import course, lesson, quiz, feedback, chat, export, materials, admin, user
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = FastAPI(title="Kenapse API", description="AI-powered adaptive learning platform")

# Configure CORS — allow specific origins in production via ALLOWED_ORIGINS env var
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
_origins = [o.strip() for o in _raw_origins.split(",")] if _raw_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(course.router, prefix="/course", tags=["Course"])
app.include_router(lesson.router, prefix="/lesson", tags=["Lesson"])
app.include_router(quiz.router, prefix="/quiz", tags=["Quiz"])
app.include_router(feedback.router, prefix="/feedback", tags=["Feedback"])
app.include_router(chat.router, prefix="/chat", tags=["Chat"])
app.include_router(export.router, prefix="/export", tags=["Export"])
app.include_router(materials.router, prefix="/materials", tags=["Materials"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(user.router,  prefix="/user",  tags=["User"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Kenapse API"}

@app.get("/debug/env")
def debug_env():
    from app.core.supabase import get_supabase
    sb = get_supabase()
    url = os.environ.get("SUPABASE_URL", "")
    return {
        "supabase_url_set": bool(url),
        "supabase_url_prefix": url[:35] if url else None,
        "service_role_key_set": bool(os.environ.get("SUPABASE_SERVICE_ROLE_KEY")),
        "anon_key_set": bool(os.environ.get("SUPABASE_ANON_KEY")),
        "gemini_key_set": bool(os.environ.get("GEMINI_API_KEY")),
        "groq_key_set": bool(os.environ.get("GROQ_API_KEY")),
        "supabase_client_ok": sb is not None,
    }
