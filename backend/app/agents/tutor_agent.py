import asyncio
import json
import logging
from typing import Optional

from app.services.llm_service import generate_content
from app.services.rag_service import retrieve_context
from app.core.supabase import get_supabase

logger = logging.getLogger(__name__)

_PLAN_SCHEMA = """{
  "action": "explain | correct | quiz | redirect",
  "depth": "brief | detailed",
  "focus": "specific sub-topic or concept to address (string)",
  "needs_example": true | false
}"""

_ACTION_INSTRUCTIONS = {
    "explain": lambda focus, depth: (
        f"Provide a {'brief, focused' if depth == 'brief' else 'thorough, step-by-step'} "
        f"explanation of: {focus}."
    ),
    "correct": lambda focus, _: (
        f"Gently correct the student's misunderstanding about: {focus}. "
        "Explain what is wrong and why, without being dismissive."
    ),
    "quiz": lambda focus, _: (
        f"Acknowledge their understanding, then ask ONE well-chosen follow-up question "
        f"that probes deeper into: {focus}."
    ),
    "redirect": lambda focus, _: (
        f"Kindly acknowledge their question, then guide them back to the current lesson topic: {focus}."
    ),
}


class TutorAgent:
    """
    Adaptive tutor with three-stage pipeline:
      1. Gather — RAG context + student progress (single-chapter + cross-chapter) in parallel.
      2. Plan   — decide response strategy via LLM (explain / correct / quiz / redirect).
      3. Synthesize — generate final response grounded in all context.
    """

    async def run(
        self,
        message: str,
        user_context: dict,
        chapter_id: Optional[str] = None,
        user_id: Optional[str] = None,
        material_id: Optional[str] = None,
    ) -> str:
        rag_ctx, progress = await asyncio.gather(
            asyncio.to_thread(retrieve_context, message, 3),
            self._get_progress(chapter_id, user_id, material_id),
        )
        strategy = await self._plan(message, user_context, progress)
        return await self._synthesize(message, user_context, rag_ctx, progress, strategy)

    # ── private helpers ──────────────────────────────────────────────────────────

    async def _get_progress(
        self,
        chapter_id: Optional[str],
        user_id: Optional[str],
        material_id: Optional[str],
    ) -> dict:
        progress = {
            # single-chapter
            "score": None, "attempts": None, "difficulty": None,
            "misconceptions": [], "focus_topics": [],
            # cross-chapter (Layer 2)
            "avg_score": None, "weak_chapters": [],
            "recurring_misconceptions": [], "trend": "insufficient_data",
            "chapters_completed": 0,
        }

        supabase = get_supabase()
        if not supabase:
            return progress

        # Single-chapter fast path
        if chapter_id:
            try:
                query = (
                    supabase.table("quiz_results")
                    .select("score, attempts, difficulty_recommendation, misconceptions, focus_topics")
                    .eq("chapter_id", chapter_id)
                )
                if user_id:
                    query = query.eq("user_id", user_id)
                resp = query.maybe_single().execute()
                if resp.data:
                    progress["score"] = resp.data.get("score")
                    progress["attempts"] = resp.data.get("attempts")
                    progress["difficulty"] = resp.data.get("difficulty_recommendation")
                    progress["misconceptions"] = resp.data.get("misconceptions") or []
                    progress["focus_topics"] = resp.data.get("focus_topics") or []
            except Exception as e:
                logger.warning(f"TutorAgent: single-chapter fetch failed: {e}")

        # Cross-chapter profile (Layer 2)
        if user_id:
            try:
                from app.services.adaptation_service import get_student_profile
                profile = await get_student_profile(supabase, user_id, material_id)
                progress["avg_score"] = profile["avg_score"]
                progress["weak_chapters"] = profile["weak_chapters"]
                progress["recurring_misconceptions"] = profile["recurring_misconceptions"]
                progress["trend"] = profile["trend"]
                progress["chapters_completed"] = profile["chapters_completed"]
                logger.info(f"TutorAgent profile: {profile}")
            except Exception as e:
                logger.warning(f"TutorAgent: cross-chapter profile fetch failed: {e}")

        return progress

    def _build_progress_summary(self, progress: dict) -> str:
        lines = []
        if progress["score"] is not None:
            lines.append(
                f"Current chapter: {progress['score']}% "
                f"(attempts: {progress['attempts']}, difficulty: {progress['difficulty']})"
            )
        if progress["avg_score"] is not None:
            lines.append(f"Course average: {progress['avg_score']}%")
        if progress["trend"] != "insufficient_data":
            lines.append(f"Performance trend: {progress['trend']}")
        if progress["recurring_misconceptions"]:
            lines.append(
                "Recurring gaps across chapters: " +
                ", ".join(progress["recurring_misconceptions"][:3])
            )
        if progress["weak_chapters"]:
            weak_titles = [w["title"] for w in progress["weak_chapters"][:3]]
            lines.append("Weak chapters: " + ", ".join(weak_titles))
        return "\n".join(lines) if lines else "No quiz data yet."

    async def _plan(self, message: str, user_context: dict, progress: dict) -> dict:
        progress_summary = self._build_progress_summary(progress)
        prompt = f"""You are an intelligent tutoring agent. A student sent this message:
"{message}"

Student profile:
- Topic: {user_context.get("current_topic", "Unknown")}
- Level: {user_context.get("level", "intermediate")}
- Weak areas noted: {", ".join(user_context.get("weak_areas", [])) or "none"}
- {progress_summary}

Decide the best response strategy. Output ONLY valid JSON matching this schema:
{_PLAN_SCHEMA}

Definitions:
- "explain"  → student needs a clear explanation
- "correct"  → student said something factually wrong; correct gently
- "quiz"     → student seems confident; challenge them with a question back
- "redirect" → question is off-topic; guide them back
- "focus"    → the specific sub-concept this response should target
- "needs_example" → true when a concrete example will meaningfully help comprehension
"""
        try:
            raw = await asyncio.to_thread(generate_content, prompt)
            cleaned = raw.strip()
            if cleaned.startswith("{"):
                return json.loads(cleaned)
        except Exception as e:
            logger.warning(f"TutorAgent planning step failed: {e}")
        return {"action": "explain", "depth": "detailed", "focus": message[:100], "needs_example": True}

    async def _synthesize(
        self,
        message: str,
        user_context: dict,
        rag_ctx: str,
        progress: dict,
        strategy: dict,
    ) -> str:
        action = strategy.get("action", "explain")
        depth = strategy.get("depth", "detailed")
        focus = strategy.get("focus") or user_context.get("current_topic", "the topic")
        needs_example = strategy.get("needs_example", False)

        progress_summary = self._build_progress_summary(progress)

        action_fn = _ACTION_INSTRUCTIONS.get(action, _ACTION_INSTRUCTIONS["explain"])
        task_instruction = action_fn(focus, depth)

        example_instruction = (
            "Include ONE concrete, real-world example that makes this immediately tangible."
            if needs_example
            else "Omit an example unless it fits very naturally."
        )

        prompt = f"""You are Kenapse, a warm and patient AI tutor helping a \
{user_context.get("level", "intermediate")}-level student studying \
"{user_context.get("current_topic", "this topic")}".

Student learning profile:
{progress_summary}

Relevant excerpts from the student's study material:
{rag_ctx or "No additional material available."}

Student's message: "{message}"

Your task: {task_instruction}
{example_instruction}

Tone: encouraging, conversational, educational.
Length: max 3 concise paragraphs unless a numbered step-by-step breakdown is genuinely needed.
Write plain text only — no JSON, no markdown headers.
"""
        try:
            return await asyncio.to_thread(generate_content, prompt)
        except Exception as e:
            logger.error(f"TutorAgent synthesis failed: {e}")
            return "I'm having trouble connecting right now. Please try again in a moment."
