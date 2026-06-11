import os
import logging
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logger = logging.getLogger(__name__)

_supabase: Client | None = None


def _init() -> Client | None:
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip() or \
          os.environ.get("SUPABASE_ANON_KEY", "").strip()

    if not url:
        logger.error("SUPABASE_URL env var is missing or empty")
        return None
    if not key:
        logger.error("SUPABASE_SERVICE_ROLE_KEY env var is missing or empty")
        return None

    try:
        client = create_client(url, key)
        logger.info(f"Supabase client initialized OK ({url[:40]}...)")
        return client
    except Exception as e:
        logger.error(f"Supabase create_client failed: {e}")
        return None


def get_supabase() -> Client | None:
    global _supabase
    if _supabase is None:
        _supabase = _init()
    return _supabase


# Backwards-compat: module-level `supabase` — initialized on first import
supabase: Client | None = get_supabase()
