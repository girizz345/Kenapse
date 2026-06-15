import os
import json
import logging
import asyncio
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# ── Gemini setup (new google-genai SDK) ──────────────────────────────────────
_gemini_client = None
if GEMINI_API_KEY:
    try:
        from google import genai as google_genai
        _gemini_client = google_genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini LLM initialized (google-genai SDK)")
    except Exception as e:
        logger.warning(f"Gemini init failed: {e}")

# ── Groq setup ────────────────────────────────────────────────────────────────
_groq_client = None
if GROQ_API_KEY:
    try:
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
        logger.info("Groq LLM initialized (fallback ready)")
    except Exception as e:
        logger.warning(f"Groq init failed: {e}")

# ── Quota / rate-limit error keywords ────────────────────────────────────────
_QUOTA_KEYWORDS = ("quota", "rate", "limit", "429", "resource exhausted", "too many", "overloaded")


# ── Token usage tracker (in-process, resets on restart) ──────────────────────
class _TokenCounter:
    def __init__(self):
        self.prompt_tokens     = 0
        self.completion_tokens = 0
        self.calls             = 0
        self.gemini_calls      = 0
        self.groq_calls        = 0

    def record(self, prompt: int, completion: int, provider: str):
        self.prompt_tokens     += prompt
        self.completion_tokens += completion
        self.calls             += 1
        if provider == "gemini":
            self.gemini_calls += 1
        else:
            self.groq_calls   += 1

    def to_dict(self) -> dict:
        total = self.prompt_tokens + self.completion_tokens
        # Gemini 2.0 Flash pricing (per 1M tokens)
        gemini_cost = (self.prompt_tokens * 0.075 + self.completion_tokens * 0.30) / 1_000_000
        # Groq Llama-3.3-70B pricing (per 1M tokens)
        groq_cost   = (self.prompt_tokens * 0.59  + self.completion_tokens * 0.79)  / 1_000_000
        return {
            "prompt_tokens":     self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens":      total,
            "llm_calls":         self.calls,
            "gemini_calls":      self.gemini_calls,
            "groq_calls":        self.groq_calls,
            "estimated_cost_usd": round(gemini_cost + groq_cost, 6),
        }

_tokens = _TokenCounter()


def get_token_usage() -> dict:
    """Return accumulated token stats since last server restart."""
    return _tokens.to_dict()


async def _convert_to_steps(example_text: str, topic: str) -> list:
    """Convert a prose example string into an example_steps array of typed objects."""
    prompt = f"""Convert this worked example into a JSON array of step objects.

TOPIC: {topic}
EXAMPLE TEXT: {example_text}

Return ONLY a valid JSON array. Each object has exactly:
  "type": one of "header" | "text" | "formula" | "answer"
  "text": the content

Rules:
- "header" = step label like "Step 1 — State the problem" (no LaTeX)
- "text"   = explanation sentence, may use $inline$ math
- "formula"= ONE LaTeX expression, NO $$ delimiters, show every line separately
- "answer" = final result only, LaTeX without $$ delimiters

Use \\dfrac for fractions, \\int_{{a}}^{{b}} for integrals, \\therefore for final answer.
Output ONLY the JSON array, nothing else.
"""
    try:
        raw = await asyncio.to_thread(generate_content, prompt)
        cleaned = raw.strip()
        if cleaned.startswith("["):
            steps = json.loads(cleaned)
            if isinstance(steps, list) and steps:
                logger.info(f"Converted prose example to {len(steps)} steps for: {topic}")
                return steps
    except Exception as e:
        logger.warning(f"_convert_to_steps failed: {e}")

    # Hard fallback: wrap the prose as a single text block
    return [{"type": "text", "text": example_text}]


def _sanitize(text: str, max_len: int = 500) -> str:
    """Strip null bytes and cap length to prevent prompt injection / runaway tokens."""
    if not text:
        return ""
    return text.replace("\x00", "").strip()[:max_len]


def _clean_json(text: str) -> str:
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    return text.strip()


def _call_gemini(prompt: str) -> str:
    if not _gemini_client:
        raise RuntimeError("Gemini not configured")
    response = _gemini_client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )
    # Track token usage
    um = getattr(response, "usage_metadata", None)
    if um:
        _tokens.record(
            getattr(um, "prompt_token_count", 0) or 0,
            getattr(um, "candidates_token_count", 0) or 0,
            "gemini",
        )
    return response.text


def _call_groq(prompt: str) -> str:
    if not _groq_client:
        raise RuntimeError("Groq not configured")
    response = _groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=4096,
    )
    # Track token usage
    usage = getattr(response, "usage", None)
    if usage:
        _tokens.record(
            getattr(usage, "prompt_tokens", 0) or 0,
            getattr(usage, "completion_tokens", 0) or 0,
            "groq",
        )
    return response.choices[0].message.content


def generate_content(prompt: str) -> str:
    """
    Generate text content. Tries Gemini first; on quota/rate errors falls
    back to Groq automatically. Raises RuntimeError if both fail.
    """
    # ── Try Gemini ────────────────────────────────────────────────────────────
    if _gemini_client:
        try:
            result = _call_gemini(prompt)
            logger.info("Content generated via Gemini")
            return _clean_json(result)
        except Exception as e:
            err = str(e).lower()
            if any(k in err for k in _QUOTA_KEYWORDS):
                logger.warning(f"Gemini quota/rate hit — falling back to Groq: {e}")
            else:
                logger.error(f"Gemini error (non-quota) — falling back to Groq: {e}")

    # ── Try Groq ──────────────────────────────────────────────────────────────
    if _groq_client:
        try:
            result = _call_groq(prompt)
            logger.info("Content generated via Groq (fallback)")
            return _clean_json(result)
        except Exception as e:
            logger.error(f"Groq error: {e}")

    raise RuntimeError("All LLM providers failed or are not configured. Check GEMINI_API_KEY / GROQ_API_KEY.")


# Alias for backward compatibility with material_processor.py
generate_gemini_content = generate_content


# ── Structured generation helpers ────────────────────────────────────────────

def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except Exception as e:
        logger.error(f"JSON parse failed: {e} | text: {text[:200]}")
        return {}


async def generate_course(topic: str, level: str, duration: int) -> dict:
    topic = _sanitize(topic, 200)
    level = _sanitize(level, 50)
    prompt = f"""
You are an expert AI tutor. Generate a structured course for the topic: "{topic}".
Target audience level: "{level}". Approximate duration: {duration} hours.

Output ONLY valid JSON — no markdown, no explanation:
{{
    "course_title": "String",
    "chapters": [
        {{
            "chapter_id": 1,
            "title": "String",
            "topics": ["topic1", "topic2"],
            "objective": "String"
        }}
    ]
}}
"""
    try:
        result = await asyncio.to_thread(generate_content, prompt)
        return _parse_json(result)
    except Exception as e:
        logger.error(f"generate_course failed: {e}")
        return {
            "course_title": f"{topic} Course",
            "chapters": [
                {"chapter_id": 1, "title": "Introduction", "topics": [topic], "objective": f"Understand the basics of {topic}"},
                {"chapter_id": 2, "title": "Core Concepts", "topics": [topic], "objective": f"Apply core concepts of {topic}"},
                {"chapter_id": 3, "title": "Advanced Topics", "topics": [topic], "objective": f"Master advanced {topic} techniques"},
            ]
        }


async def generate_lesson(
    chapter_id: int,
    topic: str,
    level: str,
    content_text: str = "",
    misconceptions: list | None = None,
    focus_topics: list | None = None,
) -> dict:
    topic = _sanitize(topic, 200)
    level = _sanitize(level, 50)
    # When the chapter has an excerpt from the uploaded material, ground the
    # lesson in that content so it reflects exactly what the user studied.
    if content_text and len(content_text.strip()) > 100:
        material_block = f"""
The student uploaded study material. Use the following excerpt as your
PRIMARY source of truth for this lesson. Your lesson MUST be based on
and consistent with this content:

--- MATERIAL EXCERPT ---
{content_text[:3000]}
--- END EXCERPT ---
"""
    else:
        material_block = ""

    adaptation_block = ""
    if misconceptions or focus_topics:
        parts = []
        if misconceptions:
            items = "\n".join(f"  - {m}" for m in misconceptions[:5])
            parts.append(
                "The student previously held these misconceptions — address each one directly:\n" + items
            )
        if focus_topics:
            items = "\n".join(f"  - {t}" for t in focus_topics[:3])
            parts.append(
                "Spend extra depth on these sub-topics the student needs to reinforce:\n" + items
            )
        adaptation_block = "\nSTUDENT ADAPTATION (apply to this lesson):\n" + "\n\n".join(parts) + "\n"

    prompt = f"""
You are an expert AI tutor teaching a {level}-level student.
Create a rich, detailed lesson for the topic "{topic}".
{material_block}
{adaptation_block}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT FOR "example_steps":

For MATH / SCIENCE / FORMULA topics — produce a worked example as a JSON array
of step objects. Each object has exactly two keys:
  "type" → one of: "header" | "text" | "formula" | "answer"
  "text" → the content (see rules below per type)

Type rules:
  "header"  → Step label, e.g. "Step 1 — State the problem"
               text = plain string, no LaTeX delimiters
  "text"    → A sentence of explanation. May use $inline$ math.
               NEVER put a block formula here — use "formula" for that.
  "formula" → A single LaTeX expression, NO $$ delimiters, just the LaTeX.
               One formula per object. Show every intermediate line separately.
               Use \\dfrac for fractions, \\int_{{a}}^{{b}} for integrals,
               \\left(\\right) for brackets, \\therefore for final answer.
  "answer"  → Same as "formula" but visually highlighted. Use for the FINAL result only.

EXAMPLE of a complete "example_steps" for a calculus problem:
[
  {{"type":"header","text":"Step 1 — State the problem"}},
  {{"type":"text",  "text":"Evaluate the definite integral $\\int_0^2 x^2 \\, dx$"}},
  {{"type":"header","text":"Step 2 — Find the antiderivative"}},
  {{"type":"text",  "text":"The antiderivative of $x^n$ is $\\dfrac{{x^{{n+1}}}}{{n+1}}$, so:"}},
  {{"type":"formula","text":"\\int x^2 \\, dx = \\dfrac{{x^3}}{{3}}"}},
  {{"type":"header","text":"Step 3 — Apply the Fundamental Theorem of Calculus"}},
  {{"type":"formula","text":"\\int_0^2 x^2 \\, dx = \\left[\\dfrac{{x^3}}{{3}}\\right]_0^2"}},
  {{"type":"header","text":"Step 4 — Substitute the bounds"}},
  {{"type":"formula","text":"= \\dfrac{{2^3}}{{3}} - \\dfrac{{0^3}}{{3}}"}},
  {{"type":"formula","text":"= \\dfrac{{8}}{{3}} - 0"}},
  {{"type":"answer", "text":"\\therefore \\int_0^2 x^2 \\, dx = \\dfrac{{8}}{{3}}"}}
]

For NON-MATH topics (history, biology, literature, etc.) — use only "text" objects:
[
  {{"type":"text","text":"A real-world example sentence here."}},
  {{"type":"text","text":"More context if needed."}}
]

LaTeX cheatsheet for formulas:
- Fractions: \\dfrac{{num}}{{den}}
- Integrals: \\int_{{a}}^{{b}} f(x) \\, dx
- Brackets:  \\left( \\right), \\left[ \\right]
- Powers:    x^{{2}}, e^{{x}}
- Trig:      \\sin, \\cos, \\tan, \\ln, \\log
- Greek:     \\theta, \\pi, \\alpha, \\beta
- Boxes:     \\boxed{{expr}}
- Final ans: \\therefore
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Output ONLY valid JSON — no markdown fences, no explanation outside the JSON:
{{
    "title": "Concise lesson title",
    "summary": "1-2 sentence TL;DR that captures the entire lesson",
    "explanation": "Key properties/theorems, each as: **Name:** statement \\n$$formula$$\\n meaning. Separate with \\n\\n. For non-math: 4-6 prose paragraphs.",
    "example_steps": [/* array of step objects as described above */],
    "key_points": ["point1", "point2", "point3", "point4", "point5"],
    "fun_fact": "One surprising or counterintuitive fact about this topic"
}}
"""
    try:
        result = await asyncio.to_thread(generate_content, prompt)
        data = _parse_json(result)
        data.setdefault("summary", "")
        data.setdefault("fun_fact", "")
        data.setdefault("example_steps", [])

        # Legacy: if LLM still returned "example" string instead of "example_steps",
        # convert it to the new format via the reformat pass
        if not data["example_steps"] and data.get("example"):
            logger.info(f"LLM returned legacy 'example' string for '{topic}' — converting to steps")
            data["example_steps"] = await _convert_to_steps(data["example"], topic)

        # Final safety net: if example_steps is still empty, build a minimal stub
        if not data["example_steps"]:
            data["example_steps"] = [
                {"type": "text", "text": f"No worked example available for {topic}. Please reload the lesson."}
            ]

        return data
    except Exception as e:
        logger.error(f"generate_lesson failed: {e}")
        return {
            "title": f"Lesson: {topic}",
            "summary": f"An introduction to {topic} at {level} level.",
            "explanation": (
                f"This lesson covers {topic} at the {level} level.\n\n"
                "The AI service is temporarily unavailable — please try again in a moment."
            ),
            "example": f"Example for {topic}: Apply the concepts learned to a real-world scenario.",
            "key_points": [
                "Review the topic objectives",
                "Practice with examples",
                "Test yourself with the quiz",
                "Try again shortly for AI-generated content",
            ],
            "fun_fact": "",
        }


async def generate_quiz(topic: str, level: str, prior_misconceptions: list | None = None) -> dict:
    topic = _sanitize(topic, 200)
    level = _sanitize(level, 50)
    misconception_block = ""
    if prior_misconceptions:
        items = "\n".join(f"  - {m}" for m in prior_misconceptions[:5])
        misconception_block = (
            f"\nThe student has shown these specific misconceptions before. "
            f"Include at least 2 questions that directly test whether these are now resolved:\n{items}\n"
        )

    prompt = f"""
Generate a 4-question multiple-choice quiz for "{topic}" at {level} difficulty.
{misconception_block}
Output ONLY valid JSON — no markdown, no explanation:
{{
    "questions": [
        {{
            "question": "Question text",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "answer": "Exact text of the correct option",
            "hint": "A subtle clue that guides thinking without revealing the answer"
        }}
    ]
}}
"""
    try:
        result = await asyncio.to_thread(generate_content, prompt)
        data = _parse_json(result)
        # Ensure every question has a hint field
        for q in data.get("questions", []):
            q.setdefault("hint", "")
        return data
    except Exception as e:
        logger.error(f"generate_quiz failed: {e}")
        return {
            "questions": [
                {
                    "question": f"Which of the following best describes {topic}?",
                    "options": ["A foundational concept", "An advanced technique", "A programming language", "A database system"],
                    "answer": "A foundational concept",
                    "hint": "Think about how this topic is typically introduced in textbooks."
                }
            ]
        }


async def generate_chat_response(message: str, user_context: dict, rag_context: str = "") -> str:
    message = _sanitize(message, 1000)
    context_str = (
        f"Current Topic: {user_context.get('current_topic', 'General')}\n"
        f"Level: {user_context.get('level', 'Intermediate')}\n"
        f"Weak Areas: {', '.join(user_context.get('weak_areas', []))}"
    )
    prompt = f"""
You are Kenapse, a friendly and knowledgeable AI tutor.
User Context:
{context_str}

Relevant Context:
{rag_context if rag_context else "No additional context available."}

User: {message}

Give a clear, helpful, educational response. Be concise but thorough.
If the user makes a mistake, gently correct them with an explanation.
"""
    try:
        return await asyncio.to_thread(generate_content, prompt)
    except Exception as e:
        logger.error(f"generate_chat_response failed: {e}")
        return "I'm having trouble connecting right now. Please try again in a moment."
