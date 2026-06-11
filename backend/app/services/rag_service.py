import io
import os
import zipfile
import logging
import asyncio
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import FakeEmbeddings
from langchain_text_splitters import CharacterTextSplitter

try:
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
except ImportError:
    embeddings = FakeEmbeddings(size=768)

logger = logging.getLogger(__name__)

VECTOR_STORE_PATH = "faiss_index"
_STORAGE_BUCKET = "materials"
_STORAGE_KEY = "faiss_index/faiss_index.zip"


# ── Supabase Storage helpers ──────────────────────────────────────────────────

def _upload_index(supabase) -> None:
    """Zip the local FAISS index files and upload to Supabase Storage."""
    try:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for fname in ("index.faiss", "index.pkl"):
                fpath = os.path.join(VECTOR_STORE_PATH, fname)
                if os.path.exists(fpath):
                    zf.write(fpath, fname)
        buf.seek(0)
        supabase.storage.from_(_STORAGE_BUCKET).upload(
            path=_STORAGE_KEY,
            file=buf.read(),
            file_options={"content-type": "application/zip", "upsert": "true"},
        )
        logger.info("FAISS index uploaded to Supabase Storage")
    except Exception as e:
        logger.warning(f"Could not upload FAISS index to storage: {e}")


def _download_index(supabase) -> bool:
    """Download and unpack FAISS index from Supabase Storage. Returns True on success."""
    try:
        data = supabase.storage.from_(_STORAGE_BUCKET).download(_STORAGE_KEY)
        if not data:
            return False
        os.makedirs(VECTOR_STORE_PATH, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            zf.extractall(VECTOR_STORE_PATH)
        logger.info("FAISS index restored from Supabase Storage")
        return True
    except Exception as e:
        logger.info(f"No FAISS index in storage (first run or not yet saved): {e}")
        return False


def _get_supabase():
    try:
        from app.core.supabase import get_supabase
        return get_supabase()
    except Exception:
        return None


# ── Public API ────────────────────────────────────────────────────────────────

def get_vector_store():
    """Load local FAISS index; if absent, try to restore from Supabase Storage."""
    if not os.path.exists(VECTOR_STORE_PATH):
        supabase = _get_supabase()
        if supabase:
            _download_index(supabase)

    if os.path.exists(VECTOR_STORE_PATH):
        try:
            return FAISS.load_local(VECTOR_STORE_PATH, embeddings, allow_dangerous_deserialization=True)
        except Exception as e:
            logger.warning(f"Failed to load local FAISS index: {e}")
    return None


def ingest_text(text: str) -> None:
    text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    texts = text_splitter.split_text(text)

    vector_store = get_vector_store()
    if vector_store is None:
        vector_store = FAISS.from_texts(texts, embeddings)
    else:
        vector_store.add_texts(texts)

    vector_store.save_local(VECTOR_STORE_PATH)

    # Persist to Supabase Storage so the index survives deployment restarts
    supabase = _get_supabase()
    if supabase:
        _upload_index(supabase)


def retrieve_context(query: str, k: int = 3) -> str:
    vector_store = get_vector_store()
    if not vector_store:
        return "No external context available."
    docs = vector_store.similarity_search(query, k=k)
    return "\n\n".join([doc.page_content for doc in docs])
