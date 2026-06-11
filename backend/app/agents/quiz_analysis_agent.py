import asyncio
import json
import logging
from typing import List, Dict

from app.services.llm_service import generate_content

logger = logging.getLogger(__name__)

_ANALYSIS_SCHEMA = """{
  "misconceptions": ["string — each specific misunderstanding identified from a wrong answer"],
  "remediation": "2-3 sentences spoken directly to the student, addressing their exact gaps",
  "focus_topics": ["sub-topic1", "sub-topic2"],
  "encouragement": "one personalized sentence of encouragement based on their score"
}"""


class QuizAnalysisAgent:
    """
    Replaces the rule-based score-threshold feedback with LLM-driven analysis.
    Reads the actual wrong answers to identify specific misconceptions and
    generate targeted remediation advice.
    """

    async def analyze(
        self,
        topic: str,
        level: str,
        wrong_answers: List[Dict],  # [{question, selected, correct}, ...]
        score_pct: float,
    ) -> dict:
        if not wrong_answers:
            return {
                "misconceptions": [],
                "remediation": "Excellent work — you answered every question correctly!",
                "focus_topics": [],
                "encouragement": "Keep up this momentum as you move to the next chapter.",
            }

        wrong_block = "\n".join(
            f"  Q: {w.get('question', '')}\n"
            f"  Student chose: {w.get('selected', '')}\n"
            f"  Correct answer: {w.get('correct', '')}"
            for w in wrong_answers
        )

        prompt = f"""You are an expert learning analyst. A student just completed a quiz on \
"{topic}" at {level} level and scored {score_pct:.0f}%.

Questions they got WRONG:
{wrong_block}

Analyze these errors. Output ONLY valid JSON matching this schema:
{_ANALYSIS_SCHEMA}

Rules:
- "misconceptions": one entry per wrong answer — name the specific conceptual error, \
not just "answered incorrectly"
- "remediation": address the student directly ("you", "your"), be specific to THEIR errors, \
not a generic recap of the topic
- "focus_topics": 1-3 narrow sub-topics within "{topic}" they should review before continuing
- "encouragement": tailor it to {score_pct:.0f}% — high score gets celebratory tone, \
low score gets motivating tone
"""
        try:
            raw = await asyncio.to_thread(generate_content, prompt)
            cleaned = raw.strip()
            if cleaned.startswith("{"):
                return json.loads(cleaned)
        except Exception as e:
            logger.error(f"QuizAnalysisAgent failed: {e}")

        return self._fallback(score_pct)

    def difficulty_from_score(self, score_pct: float) -> str:
        if score_pct < 50:
            return "easier"
        if score_pct > 80:
            return "harder"
        return "maintain"

    def _fallback(self, score_pct: float) -> dict:
        if score_pct < 50:
            msg = "Review the lesson again before moving on — focus on the concepts you found tricky."
            enc = "Every attempt builds understanding. You've got this!"
        elif score_pct < 80:
            msg = "Good progress! Revisit the areas you missed to strengthen your understanding."
            enc = "You're making solid progress — keep pushing forward."
        else:
            msg = "Well done! A quick review of the missed points will make you even sharper."
            enc = "Almost perfect — excellent work!"
        return {
            "misconceptions": [],
            "remediation": msg,
            "focus_topics": [],
            "encouragement": enc,
        }
