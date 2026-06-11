import logging
from collections import Counter
from typing import Optional

logger = logging.getLogger(__name__)


async def get_student_profile(
    supabase,
    user_id: str,
    material_id: Optional[str] = None,
) -> dict:
    """
    Aggregate quiz_results across all chapters for a user.
    Optionally scoped to a single course by material_id.

    Returns:
      {
        "chapters_completed": int,
        "avg_score": float | None,
        "weak_chapters": [{"chapter_id", "title", "score"}],   # score < 60
        "recurring_misconceptions": [str],                      # in 2+ chapters
        "trend": "improving"|"declining"|"stable"|"insufficient_data",
        "overall_difficulty": str,
      }
    """
    if not supabase or not user_id:
        return _empty_profile()

    try:
        chapter_map: dict = {}

        query = (
            supabase.table("quiz_results")
            .select("chapter_id, score, attempts, difficulty_recommendation, misconceptions, created_at")
            .eq("user_id", user_id)
        )

        if material_id:
            ch_resp = (
                supabase.table("chapters")
                .select("id, title, order_index")
                .eq("material_id", material_id)
                .execute()
            )
            chapter_map = {str(c["id"]): c for c in (ch_resp.data or [])}
            chapter_ids = list(chapter_map.keys())
            if not chapter_ids:
                return _empty_profile()
            query = query.in_("chapter_id", chapter_ids)

        resp = query.order("created_at").execute()
        rows = resp.data or []

        if not rows:
            return _empty_profile()

        scores = [r["score"] for r in rows if r.get("score") is not None]
        avg_score = round(sum(scores) / len(scores), 1) if scores else None

        weak_chapters = []
        for r in rows:
            if r.get("score") is not None and r["score"] < 60:
                ch_info = chapter_map.get(str(r["chapter_id"]), {})
                weak_chapters.append({
                    "chapter_id": r["chapter_id"],
                    "title": ch_info.get("title", "Unknown chapter"),
                    "score": r["score"],
                })

        all_misconceptions = []
        for r in rows:
            for m in (r.get("misconceptions") or []):
                all_misconceptions.append(m)
        counts = Counter(all_misconceptions)
        recurring = [m for m, c in counts.most_common(5) if c >= 2]

        trend = "insufficient_data"
        if len(scores) >= 4:
            mid = len(scores) // 2
            first_avg = sum(scores[:mid]) / mid
            second_avg = sum(scores[mid:]) / (len(scores) - mid)
            delta = second_avg - first_avg
            if delta > 10:
                trend = "improving"
            elif delta < -10:
                trend = "declining"
            else:
                trend = "stable"

        difficulties = [r.get("difficulty_recommendation") for r in rows if r.get("difficulty_recommendation")]
        overall_difficulty = difficulties[-1] if difficulties else "maintain"

        return {
            "chapters_completed": len(rows),
            "avg_score": avg_score,
            "weak_chapters": weak_chapters[:5],
            "recurring_misconceptions": recurring,
            "trend": trend,
            "overall_difficulty": overall_difficulty,
        }

    except Exception as e:
        logger.warning(f"get_student_profile failed: {e}")
        return _empty_profile()


def _empty_profile() -> dict:
    return {
        "chapters_completed": 0,
        "avg_score": None,
        "weak_chapters": [],
        "recurring_misconceptions": [],
        "trend": "insufficient_data",
        "overall_difficulty": "maintain",
    }


async def check_and_ingest_improvement(
    supabase,
    chapter_id: str,
    user_id: str,
    new_score_pct: float,
    topic: str,
) -> None:
    """
    Layer 3 — self-improvement hook.
    Called from feedback.py BEFORE the upsert overwrites the previous row.
    If new_score - prev_score > 20pp, the prior remediation was effective
    and gets ingested into the RAG store for future students.
    """
    try:
        resp = (
            supabase.table("quiz_results")
            .select("score, remediation")
            .eq("chapter_id", chapter_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not resp.data:
            return  # first attempt — nothing to compare

        prev_score = resp.data.get("score")
        remediation = resp.data.get("remediation", "")

        if prev_score is None or not remediation:
            return

        improvement = new_score_pct - float(prev_score)
        if improvement > 20.0:
            logger.info(
                f"Improvement signal: chapter={chapter_id} "
                f"{prev_score}% → {new_score_pct:.0f}% (+{improvement:.0f}pp). "
                "Ingesting proven remediation into RAG."
            )
            _ingest_proven_remediation(topic, remediation, improvement)

    except Exception as e:
        logger.warning(f"check_and_ingest_improvement failed: {e}")


def _ingest_proven_remediation(topic: str, remediation: str, improvement_pct: float) -> None:
    """Ingest a battle-tested remediation into the FAISS vector store."""
    try:
        from app.services.rag_service import ingest_text
        tagged = (
            f"[PROVEN REMEDIATION — Topic: {topic}, "
            f"Score improvement: +{improvement_pct:.0f}pp]\n\n"
            f"{remediation}"
        )
        ingest_text(tagged)
        logger.info(f"Proven remediation ingested for topic: {topic}")
    except Exception as e:
        logger.warning(f"Failed to ingest proven remediation: {e}")
