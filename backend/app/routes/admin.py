import os
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional, Literal
from app.core.supabase import get_supabase
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


def _list_all_users(supabase):
    """Paginate through all auth users to avoid memory issues on large installs."""
    all_users = []
    page = 1
    per_page = 1000
    while True:
        resp = supabase.auth.admin.list_users(page=page, per_page=per_page)
        batch = resp.users if hasattr(resp, "users") else []
        all_users.extend(batch)
        if len(batch) < per_page:
            break
        page += 1
    return all_users


# ─── Request models ───────────────────────────────────────────────────────

class AdminSetupRequest(BaseModel):
    email: str
    setup_key: str

class RoleUpdateRequest(BaseModel):
    role: Literal["admin", "user"]


async def require_admin(authorization: Optional[str] = Header(None)):
    """Verify JWT and confirm the user has role='admin' (stored in user_metadata)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.split(" ", 1)[1]
    supabase = get_supabase()
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        meta = user_response.user.user_metadata or {}
        if meta.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")

        return user_response.user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin auth error: {e}", exc_info=True)
        raise HTTPException(status_code=401, detail="Authentication failed")


@router.get("/metrics")
async def get_metrics(_admin=Depends(require_admin)):
    """Return high-level record counts for the system health panel."""
    supabase = get_supabase()
    try:
        all_auth_users = _list_all_users(supabase)
        total_users = len(all_auth_users)

        mats_res = supabase.table("study_materials").select("id", count="exact").execute()
        chaps_res = supabase.table("chapters").select("id", count="exact").execute()
        quiz_res = supabase.table("quizzes").select("id", count="exact").execute()

        return {
            "total_users": total_users,
            "total_materials": mats_res.count or len(mats_res.data),
            "total_chapters": chaps_res.count or len(chaps_res.data),
            "total_quizzes": quiz_res.count or len(quiz_res.data),
        }
    except Exception as e:
        logger.error(f"Metrics error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users")
async def get_users(_admin=Depends(require_admin)):
    """Return all registered users with their course and chapter progress."""
    supabase = get_supabase()
    try:
        profiles_map = {}
        try:
            profiles_res = supabase.table("profiles").select("id, role, updated_at").execute()
            profiles_map = {p["id"]: p for p in (profiles_res.data or [])}
        except Exception:
            pass  # table not created yet — fall back to user_metadata

        user_list_raw = _list_all_users(supabase)

        # Gather material + chapter stats per user in bulk
        mats_res = supabase.table("study_materials").select("id, user_id").execute()
        material_ids = [m["id"] for m in (mats_res.data or [])]
        user_mat_count: dict[str, int] = {}
        for m in (mats_res.data or []):
            user_mat_count[m["user_id"]] = user_mat_count.get(m["user_id"], 0) + 1

        completed_map: dict[str, int] = {}
        if material_ids:
            chaps_res = supabase.table("chapters").select("material_id, status").in_("material_id", material_ids).execute()
            # map material_id → user_id
            mat_to_user = {m["id"]: m["user_id"] for m in (mats_res.data or [])}
            for c in (chaps_res.data or []):
                if c["status"] == "completed":
                    uid = mat_to_user.get(c["material_id"])
                    if uid:
                        completed_map[uid] = completed_map.get(uid, 0) + 1

        result = []
        for u in user_list_raw:
            uid = str(u.id)
            profile = profiles_map.get(uid, {})
            meta = u.user_metadata or {}
            role = profile.get("role") or meta.get("role", "user")
            result.append({
                "id": uid,
                "email": u.email,
                "role": role,
                "course_count": user_mat_count.get(uid, 0),
                "completed_chapters": completed_map.get(uid, 0),
                "created_at": u.created_at.isoformat() if u.created_at else None,
            })

        return result
    except Exception as e:
        logger.error(f"Users fetch error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/content")
async def get_content(_admin=Depends(require_admin)):
    """Return all study materials with chapter progress for the content management panel."""
    supabase = get_supabase()
    try:
        mats_res = supabase.table("study_materials").select("id, file_name, user_id, created_at").order("created_at", desc=True).execute()
        materials = mats_res.data or []

        if not materials:
            return []

        material_ids = [m["id"] for m in materials]
        chaps_res = supabase.table("chapters").select("material_id, status").in_("material_id", material_ids).execute()

        stats: dict[str, dict] = {}
        for c in (chaps_res.data or []):
            mid = c["material_id"]
            if mid not in stats:
                stats[mid] = {"total": 0, "completed": 0}
            stats[mid]["total"] += 1
            if c["status"] == "completed":
                stats[mid]["completed"] += 1

        result = []
        for m in materials:
            s = stats.get(m["id"], {"total": 0, "completed": 0})
            total = s["total"]
            completed = s["completed"]
            result.append({
                "id": m["id"],
                "file_name": m["file_name"],
                "user_id": m["user_id"],
                "created_at": m["created_at"],
                "total_chapters": total,
                "completed_chapters": completed,
                "progress": round((completed / total) * 100) if total > 0 else 0,
            })

        return result
    except Exception as e:
        logger.error(f"Content fetch error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/setup")
async def bootstrap_first_admin(request: AdminSetupRequest):
    """
    One-time setup: promotes the first admin without Supabase dashboard access.
    Protected by ADMIN_SETUP_KEY. Locked once any admin exists.
    """
    setup_key = os.environ.get("ADMIN_SETUP_KEY", "")
    if not setup_key:
        raise HTTPException(status_code=503, detail="Setup is disabled. Set ADMIN_SETUP_KEY in backend .env.")
    if request.setup_key != setup_key:
        raise HTTPException(status_code=403, detail="Invalid setup key.")

    supabase = get_supabase()
    try:
        user_list = _list_all_users(supabase)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not query users: {e}")

    if any((u.user_metadata or {}).get("role") == "admin" for u in user_list):
        raise HTTPException(status_code=409, detail="An admin already exists. Use the Admin Dashboard to manage roles.")

    target = next((u for u in user_list if u.email == request.email), None)
    if not target:
        raise HTTPException(status_code=404, detail="No account found with that email. Register first.")

    existing_meta = target.user_metadata or {}
    supabase.auth.admin.update_user_by_id(
        str(target.id),
        {"user_metadata": {**existing_meta, "role": "admin"}}
    )

    logger.info(f"First admin bootstrapped: {request.email}")
    return {"message": f"Success! {request.email} is now an admin. Sign in and go to /admin."}


@router.patch("/users/{user_id}/role")
async def update_user_role(user_id: str, request: RoleUpdateRequest, admin=Depends(require_admin)):
    """Promote or demote any user. Admins cannot demote themselves."""
    if str(admin.id) == user_id and request.role != "admin":
        raise HTTPException(status_code=400, detail="You cannot remove your own admin role.")

    supabase = get_supabase()
    try:
        target = supabase.auth.admin.get_user_by_id(user_id)
        existing_meta = (target.user.user_metadata or {}) if target.user else {}
        supabase.auth.admin.update_user_by_id(
            user_id,
            {"user_metadata": {**existing_meta, "role": request.role}}
        )
        logger.info(f"Role updated: user {user_id} → {request.role}")
        return {"status": "success", "role": request.role}
    except Exception as e:
        logger.error(f"Role update error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
