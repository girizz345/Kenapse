import os
import re
import uuid
import json
import io
import asyncio
import httpx
from pypdf import PdfReader
from app.core.supabase import get_supabase
from app.services.llm_service import generate_gemini_content
import logging

logger = logging.getLogger(__name__)

MAX_PDF_IMAGES   = 8        # images per material uploaded to storage
MIN_IMAGE_BYTES  = 5_000    # skip images < 5 KB (icons / decorations)
FULL_TEXT_LIMIT  = 500_000  # extract up to 500 K chars before sampling
LLM_TEXT_TARGET  = 120_000  # chars sent to LLM for chapter generation


# ── PDF image extraction ──────────────────────────────────────────────────────

def _detect_image_format(data: bytes) -> tuple[str, str]:
    if data[:4] == b'\x89PNG':
        return 'png', 'image/png'
    if data[:2] == b'\xff\xd8':
        return 'jpg', 'image/jpeg'
    return 'jpg', 'image/jpeg'


def _extract_and_upload_images(
    reader: PdfReader, material_id: str, supabase, supabase_url: str
) -> list[str]:
    urls: list[str] = []
    img_index = 0
    for page_num, page in enumerate(reader.pages):
        if img_index >= MAX_PDF_IMAGES:
            break
        try:
            page_images = page.images
        except Exception as e:
            logger.warning(f"Cannot read images on page {page_num}: {e}")
            continue
        for img in page_images:
            if img_index >= MAX_PDF_IMAGES:
                break
            try:
                data: bytes = img.data
                if not data or len(data) < MIN_IMAGE_BYTES:
                    continue
                ext, ct = _detect_image_format(data)
                path = f"pdf-images/{material_id}/img_{img_index}.{ext}"
                supabase.storage.from_("materials").upload(
                    path, data, {"content-type": ct, "upsert": "true"}
                )
                urls.append(
                    f"{supabase_url}/storage/v1/object/public/materials/{path}"
                )
                img_index += 1
            except Exception as e:
                logger.warning(f"Skipping image {img_index} p{page_num}: {e}")
    logger.info(f"Uploaded {len(urls)} PDF images for {material_id}")
    return urls


# ── Text utilities ────────────────────────────────────────────────────────────

def _extract_headings(text: str) -> str:
    """
    Pull chapter/section headings out of the raw text.
    Returns a newline-separated string of up to 80 headings.
    These give the LLM the book's skeleton even when the body is sampled.
    """
    patterns = [
        r'^(?:Chapter|CHAPTER|Part|PART|Unit|UNIT|Section|SECTION)\s+[\dIVXivx]+[:\.\s]+(.{3,80})$',
        r'^\d+[\.\)]\s+([A-Z][^\n]{4,70})$',           # "1. Introduction"
        r'^\d+\.\d+\s+([A-Z][^\n]{4,60})$',            # "1.1 Background"
        r'^([A-Z][A-Z\s\-]{4,50})$',                   # ALL-CAPS headings
    ]
    headings: list[str] = []
    seen: set[str] = set()
    for line in text.split('\n'):
        line = line.strip()
        if not line or len(line) > 120:
            continue
        for pat in patterns:
            m = re.match(pat, line)
            if m:
                h = (m.group(1) if m.lastindex else line).strip()
                if h and h not in seen:
                    headings.append(h)
                    seen.add(h)
                break
    return '\n'.join(headings[:80])


def _smart_sample(text: str, target: int = LLM_TEXT_TARGET) -> str:
    """
    For documents longer than `target` chars, take proportional slices
    spread evenly from start to end so every part of the book is
    represented in the LLM prompt.
    """
    if len(text) <= target:
        return text

    n_slices  = 20
    slice_len = target // n_slices
    total     = len(text)
    step      = total // n_slices

    parts: list[str] = []
    for i in range(n_slices):
        start = i * step
        parts.append(text[start : start + slice_len])

    sampled = "\n\n[...]\n\n".join(parts)
    logger.info(
        f"Document too large ({len(text):,} chars) — sampled {len(sampled):,} chars "
        f"across {n_slices} slices for LLM"
    )
    return sampled


def _chapter_count_target(text_len: int) -> int:
    """Scale expected chapter count with document size."""
    if text_len <  10_000: return 3
    if text_len <  30_000: return 5
    if text_len <  80_000: return 8
    if text_len < 200_000: return 12
    if text_len < 400_000: return 16
    return 20


def _find_chapter_excerpt(full_text: str, title: str, topics: list[str], max_chars: int = 2_000) -> str:
    """
    Find the most relevant text passage for a chapter by searching for its
    title / topics in the full text.  Falls back to an empty string.
    """
    search_terms = [title] + topics
    best_start = -1
    best_score = 0

    for term in search_terms:
        idx = full_text.lower().find(term.lower())
        if idx == -1:
            continue
        # Prefer earlier mentions of longer, more specific terms
        score = len(term)
        if score > best_score or best_start == -1:
            best_score = score
            best_start = idx

    if best_start == -1:
        return ""

    # Take a window around the match
    start = max(0, best_start - 200)
    end   = min(len(full_text), start + max_chars)
    return full_text[start:end].strip()


# ── File download / text extraction ──────────────────────────────────────────

async def _download_file(file_url: str) -> bytes | None:
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(file_url)
            r.raise_for_status()
            return r.content
    except Exception as e:
        logger.warning(f"Download failed {file_url}: {e}")
        return None


def _extract_full_text(content: bytes, file_name: str) -> str:
    """Extract ALL text from the file (up to FULL_TEXT_LIMIT chars)."""
    if file_name.lower().endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(content))
            pages_text = []
            total = 0
            for page in reader.pages:
                t = page.extract_text() or ""
                pages_text.append(t)
                total += len(t)
                if total >= FULL_TEXT_LIMIT:
                    break
            extracted = "\n".join(pages_text).strip()
            if extracted:
                logger.info(f"Extracted {len(extracted):,} chars from PDF: {file_name}")
                return extracted
            logger.warning(f"PDF had no extractable text: {file_name}")
        except Exception as e:
            logger.warning(f"PDF text extraction error: {e}")
    else:
        try:
            return content.decode("utf-8").strip()[:FULL_TEXT_LIMIT]
        except UnicodeDecodeError:
            pass

    return f"Study material: '{file_name}'. Covers introduction, core concepts, and applications."


# ── Main entry point ──────────────────────────────────────────────────────────

async def process_study_material(file_url: str, file_name: str, user_id: str) -> str:
    """
    Full pipeline:
      1. Insert material record
      2. Download file
      3. Extract text (full document, no early truncation)
      4. Extract & upload PDF images (non-critical)
      5. Generate comprehensive chapter structure via LLM
      6. Save chapters with per-chapter content_text excerpts
      7. Generate quizzes per chapter
    """
    material_id  = str(uuid.uuid4())
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase     = get_supabase()

    if supabase is None:
        raise RuntimeError("Supabase client not initialised.")

    # 1. Insert material record
    try:
        supabase.table("study_materials").insert({
            "id":        material_id,
            "user_id":   user_id,
            "file_url":  file_url,
            "file_name": file_name,
        }).execute()
        logger.info(f"Material record created: {material_id}")
    except Exception as e:
        raise RuntimeError(f"Failed to save material record: {e}")

    # 2. Download
    logger.info(f"Downloading: {file_url}")
    content = await _download_file(file_url) or b""

    # 3. Extract full text
    full_text = _extract_full_text(content, file_name) if content else (
        f"Study material: '{file_name}'."
    )
    text_len = len(full_text)
    logger.info(f"Full text length: {text_len:,} chars")

    # 4. Extract PDF images (non-critical)
    if file_name.lower().endswith(".pdf") and content:
        try:
            reader     = PdfReader(io.BytesIO(content))
            pdf_images = await asyncio.to_thread(
                _extract_and_upload_images, reader, material_id, supabase, supabase_url
            )
            if pdf_images:
                try:
                    supabase.table("study_materials").update(
                        {"pdf_images": pdf_images}
                    ).eq("id", material_id).execute()
                except Exception as e:
                    logger.warning(f"pdf_images save failed (run migrate_pdf_images.sql): {e}")
        except Exception as e:
            logger.warning(f"PDF image extraction failed (non-critical): {e}")

    # 5. Build LLM input: headings skeleton + sampled body
    headings      = _extract_headings(full_text)
    sampled_text  = _smart_sample(full_text)
    chapter_count = _chapter_count_target(text_len)

    headings_block = (
        f"\n\nDETECTED HEADINGS / TABLE OF CONTENTS:\n{headings}\n"
        if headings else ""
    )

    chapter_prompt = f"""
You are an expert curriculum designer. Your task is to create a COMPLETE and COMPREHENSIVE
course structure for the study material below.

RULES — follow these exactly:
1. Generate EXACTLY {chapter_count} chapters (or more if the material is richer).
2. You MUST cover EVERY topic, section, and concept present in the material.
3. Do NOT skip any subject area. The chapters must together cover 100% of the content.
4. Chapter titles must reflect the ACTUAL content of the material, not generic names.
5. Each chapter must list 2-4 specific topics drawn directly from the material.
6. Each chapter must include a 150-250 word excerpt (content_text) taken verbatim or
   closely paraphrased from the relevant section of the material.
{headings_block}
MATERIAL TEXT (sampled proportionally from the full document):
{sampled_text}

Return ONLY valid JSON — no markdown fences, no extra keys:
[
  {{
    "title": "Chapter title matching the material",
    "objective": "What the student will be able to do after this chapter",
    "topics": ["specific topic A", "specific topic B", "specific topic C"],
    "content_text": "150-250 word excerpt from the relevant section of the material..."
  }}
]
"""

    try:
        logger.info(f"Generating {chapter_count} chapters via LLM ({len(sampled_text):,} chars sent)…")
        raw      = await asyncio.to_thread(generate_gemini_content, chapter_prompt)
        chapters_list = json.loads(raw)
        logger.info(f"LLM returned {len(chapters_list)} chapters")
    except json.JSONDecodeError:
        # Retry with a stricter prompt on parse failure
        logger.warning("JSON parse failed — retrying with strict prompt")
        strict_prompt = (
            f"Return ONLY a JSON array of {chapter_count} chapter objects with keys "
            f"title, objective, topics (array), content_text. "
            f"Base it on this text:\n{sampled_text[:40_000]}"
        )
        try:
            raw = await asyncio.to_thread(generate_gemini_content, strict_prompt)
            chapters_list = json.loads(raw)
        except Exception as e:
            raise RuntimeError(f"Chapter generation failed twice: {e}")
    except Exception as e:
        raise RuntimeError(f"LLM chapter generation error: {e}")

    # 6. Save chapters
    for idx, chapter in enumerate(chapters_list):
        chapter_id = str(uuid.uuid4())
        title      = chapter.get("title", f"Chapter {idx + 1}")
        topics     = chapter.get("topics", [])

        # Use LLM-provided excerpt; fall back to search in full text
        content_text = chapter.get("content_text", "").strip()
        if not content_text:
            content_text = _find_chapter_excerpt(full_text, title, topics)

        chapter_data = {
            "id":           chapter_id,
            "material_id":  material_id,
            "title":        title,
            "objective":    chapter.get("objective", ""),
            "topics":       topics,
            "order_index":  idx,
            "status":       "active" if idx == 0 else "locked",
        }
        # content_text saved separately so missing column doesn't block insert
        try:
            supabase.table("chapters").insert(chapter_data).execute()
        except Exception as e:
            raise RuntimeError(f"Failed to save chapter '{title}': {e}")

        if content_text:
            try:
                supabase.table("chapters").update(
                    {"content_text": content_text}
                ).eq("id", chapter_id).execute()
            except Exception as e:
                logger.warning(f"content_text save failed (run migrate_chapters_content.sql): {e}")

        logger.info(f"Chapter saved [{idx + 1}/{len(chapters_list)}]: {title}")

        # 7. Generate quiz for this chapter
        quiz_prompt = f"""
Generate a 4-question multiple choice quiz for the chapter "{title}"
covering: {', '.join(topics)}.

Use the following excerpt from the material as the source of truth:
{content_text[:1_500] if content_text else "No excerpt available — use general knowledge."}

Return ONLY valid JSON:
[
  {{
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "answer": "Exact text of the correct option",
    "hint": "A subtle clue that guides thinking without revealing the answer"
  }}
]
"""
        try:
            quiz_raw       = await asyncio.to_thread(generate_gemini_content, quiz_prompt)
            quiz_questions = json.loads(quiz_raw)
            supabase.table("quizzes").insert({
                "id":         str(uuid.uuid4()),
                "chapter_id": chapter_id,
                "questions":  quiz_questions,
            }).execute()
            logger.info(f"Quiz saved for chapter: {title}")
        except Exception as e:
            logger.error(f"Quiz generation failed for '{title}': {e}")
            # Non-critical — continue with next chapter

    logger.info(f"Processing complete: {material_id} ({len(chapters_list)} chapters)")
    return material_id
