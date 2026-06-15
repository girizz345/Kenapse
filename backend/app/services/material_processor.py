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

MAX_PDF_IMAGES   = 8          # images per material uploaded to storage
MIN_IMAGE_BYTES  = 5_000      # skip images < 5 KB (icons / decorations)
FULL_TEXT_LIMIT  = 1_500_000  # extract up to 1.5 M chars (~300 pages)
LLM_TEXT_TARGET  = 120_000    # chars per LLM chunk (≈ 30K tokens, safe for Gemini)
LARGE_DOC_THRESHOLD = 300_000 # above this → use chunked chapter generation


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
    Proportional slice sampling — scales the number of slices with doc size
    so large books get more coverage than small ones.
    """
    if len(text) <= target:
        return text

    # More slices for bigger docs: 20 baseline, up to 40 for very large books
    n_slices  = min(40, max(20, len(text) // 30_000))
    slice_len = target // n_slices
    total     = len(text)
    step      = total // n_slices

    parts: list[str] = []
    for i in range(n_slices):
        start = i * step
        parts.append(text[start : start + slice_len])

    sampled = "\n\n[...]\n\n".join(parts)
    logger.info(
        f"Sampled {len(sampled):,} chars across {n_slices} slices "
        f"(doc: {len(text):,} chars)"
    )
    return sampled


def _split_into_chunks(text: str, chunk_size: int = LLM_TEXT_TARGET) -> list[str]:
    """
    Split a large document into overlapping chunks for parallel processing.
    Each chunk gets a small overlap with its neighbours to avoid cutting mid-topic.
    """
    overlap = chunk_size // 10   # 10% overlap
    chunks  = []
    start   = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start = end - overlap
    return chunks


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

    # 5. Build chapter structure
    headings      = _extract_headings(full_text)
    chapter_count = _chapter_count_target(text_len)
    headings_block = (
        f"\n\nDETECTED HEADINGS / TABLE OF CONTENTS:\n{headings}\n"
        if headings else ""
    )

    def _chapter_prompt(text_chunk: str, n_chapters: int, chunk_label: str = "") -> str:
        label = f" ({chunk_label})" if chunk_label else ""
        return f"""You are an expert curriculum designer. Create a course structure{label}.

RULES:
1. Generate EXACTLY {n_chapters} chapters covering the material below.
2. Cover EVERY topic present — no skipping.
3. Titles must reflect ACTUAL content, not generic names.
4. Each chapter: 2-4 specific topics from the material.
5. content_text: 150-250 word excerpt from the relevant section.
{headings_block}
MATERIAL:
{text_chunk}

Return ONLY valid JSON array, no markdown:
[
  {{
    "title": "Chapter title",
    "objective": "What the student will learn",
    "topics": ["topic A", "topic B"],
    "content_text": "150-250 word excerpt..."
  }}
]"""

    async def _generate_chapters_for_chunk(chunk: str, n: int, label: str) -> list:
        prompt = _chapter_prompt(chunk, n, label)
        try:
            raw = await asyncio.to_thread(generate_gemini_content, prompt)
            result = json.loads(raw)
            logger.info(f"Chunk '{label}': {len(result)} chapters generated")
            return result
        except json.JSONDecodeError:
            logger.warning(f"JSON parse failed for chunk '{label}' — retrying")
            retry = (
                f"Return ONLY a JSON array of {n} chapter objects with keys "
                f"title, objective, topics (array), content_text. "
                f"Base it on:\n{chunk[:30_000]}"
            )
            try:
                raw = await asyncio.to_thread(generate_gemini_content, retry)
                return json.loads(raw)
            except Exception as e:
                logger.error(f"Chunk '{label}' failed twice: {e}")
                return []

    # Large doc → split into chunks and generate chapters in parallel
    if text_len > LARGE_DOC_THRESHOLD:
        chunks = _split_into_chunks(full_text, LLM_TEXT_TARGET)
        n_per_chunk = max(3, chapter_count // len(chunks))
        logger.info(
            f"Large doc ({text_len:,} chars) → {len(chunks)} chunks × "
            f"~{n_per_chunk} chapters each"
        )
        chunk_results = await asyncio.gather(*[
            _generate_chapters_for_chunk(c, n_per_chunk, f"chunk {i+1}/{len(chunks)}")
            for i, c in enumerate(chunks)
        ])
        # Merge, deduplicate by title
        seen_titles: set[str] = set()
        chapters_list: list = []
        for batch in chunk_results:
            for ch in batch:
                t = ch.get("title", "").strip().lower()
                if t and t not in seen_titles:
                    seen_titles.add(t)
                    chapters_list.append(ch)
        logger.info(f"Merged {len(chapters_list)} unique chapters from all chunks")
    else:
        sampled_text = _smart_sample(full_text)
        logger.info(f"Generating {chapter_count} chapters ({len(sampled_text):,} chars)…")
        chapters_list = await _generate_chapters_for_chunk(
            sampled_text, chapter_count, "single"
        )

    if not chapters_list:
        raise RuntimeError("Chapter generation produced no results")

    # 6. Save chapters
    saved_chapters: list[dict] = []   # keep (chapter_id, title, topics, content_text)

    for idx, chapter in enumerate(chapters_list):
        chapter_id   = str(uuid.uuid4())
        title        = chapter.get("title", f"Chapter {idx + 1}")
        topics       = chapter.get("topics", [])
        content_text = chapter.get("content_text", "").strip()
        if not content_text:
            content_text = _find_chapter_excerpt(full_text, title, topics)

        chapter_data = {
            "id":          chapter_id,
            "material_id": material_id,
            "title":       title,
            "objective":   chapter.get("objective", ""),
            "topics":      topics,
            "order_index": idx,
            "status":      "active" if idx == 0 else "locked",
        }
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
                logger.warning(f"content_text save failed: {e}")

        saved_chapters.append({
            "id": chapter_id, "title": title,
            "topics": topics, "content_text": content_text,
        })
        logger.info(f"Chapter saved [{idx + 1}/{len(chapters_list)}]: {title}")

    # 7. Generate ALL quizzes in parallel (major speed-up for large books)
    async def _generate_and_save_quiz(ch: dict) -> None:
        quiz_prompt = f"""Generate a 4-question multiple choice quiz for the chapter "{ch['title']}"
covering: {', '.join(ch['topics'])}.

Use this excerpt as the source of truth:
{ch['content_text'][:1_500] if ch['content_text'] else 'Use general knowledge.'}

Return ONLY valid JSON:
[
  {{
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "answer": "Exact text of correct option",
    "hint": "A subtle clue without revealing the answer"
  }}
]"""
        try:
            raw       = await asyncio.to_thread(generate_gemini_content, quiz_prompt)
            questions = json.loads(raw)
            supabase.table("quizzes").insert({
                "id":         str(uuid.uuid4()),
                "chapter_id": ch["id"],
                "questions":  questions,
            }).execute()
            logger.info(f"Quiz saved: {ch['title']}")
        except Exception as e:
            logger.error(f"Quiz failed for '{ch['title']}': {e}")

    # Run all quiz generations concurrently — 5 at a time to avoid rate limits
    semaphore = asyncio.Semaphore(5)

    async def _quiz_with_limit(ch: dict) -> None:
        async with semaphore:
            await _generate_and_save_quiz(ch)

    await asyncio.gather(*[_quiz_with_limit(ch) for ch in saved_chapters])

    logger.info(f"Processing complete: {material_id} ({len(chapters_list)} chapters)")
    return material_id
