import os
import json
import threading
from datetime import datetime, timedelta
from backend.config import DIRECTORY, ADMIN_EMAILS
from backend.auth import resolve_user_display_name
from backend.storage import create_backup_snapshot
from backend.unreal_export import (
    count_board_contents,
    transform_to_unreal_schema,
    save_unreal_artifacts
)
from backend.github_sync import sync_project_data_to_github

LOCKS_FILE = os.path.join(DIRECTORY, 'locks.json')
_LOCKS_MUTEX = threading.Lock()
ACTIVE_LOCKS = {}
BOARD_REVISIONS = {}

def record_board_save(board_id, author_name):
    global BOARD_REVISIONS
    with _LOCKS_MUTEX:
        now = datetime.now()
        curr_ver = (BOARD_REVISIONS.get(board_id, {}).get("version") or 0) + 1
        record = {
            "boardId": board_id,
            "lastModified": now.isoformat(),
            "timestamp": now.strftime("%H:%M:%S"),
            "author": author_name or "Editor",
            "version": curr_ver
        }
        BOARD_REVISIONS[board_id] = record
        return record

def get_board_revisions():
    with _LOCKS_MUTEX:
        return dict(BOARD_REVISIONS)

def _parse_iso(iso_str):
    if not iso_str:
        return datetime.min
    try:
        # Handles ISO strings with or without fractional seconds / timezone
        clean_str = iso_str.replace("Z", "+00:00")
        if "+" in clean_str:
            clean_str = clean_str.split("+")[0]
        return datetime.fromisoformat(clean_str)
    except Exception:
        return datetime.min

def load_locks():
    global ACTIVE_LOCKS
    with _LOCKS_MUTEX:
        if os.path.exists(LOCKS_FILE):
            try:
                with open(LOCKS_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        now = datetime.now()
                        cleaned = {}
                        for bid, l in data.items():
                            exp = _parse_iso(l.get('expiresAt'))
                            if exp > now:
                                cleaned[bid] = l
                        ACTIVE_LOCKS = cleaned
            except Exception as e:
                print(f"[Locks] Error reading {LOCKS_FILE}: {e}")
                ACTIVE_LOCKS = {}
        else:
            ACTIVE_LOCKS = {}
    return ACTIVE_LOCKS

def save_locks():
    with _LOCKS_MUTEX:
        try:
            with open(LOCKS_FILE, 'w', encoding='utf-8') as f:
                json.dump(ACTIVE_LOCKS, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[Locks] Error writing {LOCKS_FILE}: {e}")

def clean_expired_locks():
    now = datetime.now()
    changed = False
    with _LOCKS_MUTEX:
        to_del = []
        for bid, l in ACTIVE_LOCKS.items():
            exp = _parse_iso(l.get('expiresAt'))
            if exp <= now:
                to_del.append(bid)
        for bid in to_del:
            del ACTIVE_LOCKS[bid]
            changed = True
    if changed:
        save_locks()

def is_admin_user(user):
    if not user or not isinstance(user, dict):
        return False
    email = (user.get('email') or '').strip().lower()
    return email in ADMIN_EMAILS or user.get('isAdmin') is True or user.get('role') == 'admin'

def get_all_locks():
    clean_expired_locks()
    with _LOCKS_MUTEX:
        now = datetime.now()
        result = {}
        for bid, l in ACTIVE_LOCKS.items():
            exp = _parse_iso(l.get('expiresAt'))
            remaining_sec = max(0, int((exp - now).total_seconds()))
            result[bid] = {
                **l,
                "remainingSeconds": remaining_sec
            }
        return result

def acquire_board_lock(board_id, board_name, user):
    clean_expired_locks()
    if not board_id:
        return {"success": False, "status": "error", "message": "Missing boardId"}
    if not user:
        return {"success": False, "status": "unauthorized", "message": "Authentication required"}
    if user.get('status') != 'approved' or user.get('canEdit') is False or user.get('role') == 'viewer':
        return {"success": False, "status": "forbidden", "message": "You do not have editing permissions on this board."}

    user_email = (user.get('email') or '').strip().lower()
    user_name = user.get('name') or resolve_user_display_name(user_email, '')
    is_admin = is_admin_user(user)

    now = datetime.now()
    expires_at = now + timedelta(minutes=3)

    with _LOCKS_MUTEX:
        existing = ACTIVE_LOCKS.get(board_id)
        if existing:
            exp = _parse_iso(existing.get('expiresAt'))
            owner_email = (existing.get('userEmail') or '').strip().lower()
            if exp > now and owner_email != user_email:
                # Locked by another user
                rem = max(0, int((exp - now).total_seconds()))
                return {
                    "success": False,
                    "status": "locked",
                    "lock": {**existing, "remainingSeconds": rem},
                    "canOverride": is_admin,
                    "message": f"Board is currently being edited by {existing.get('userName', 'another user')}."
                }

        # Either no lock, expired, or already owned by same user -> acquire/renew
        lock_record = {
            "boardId": board_id,
            "boardName": board_name or board_id,
            "userEmail": user_email,
            "userName": user_name,
            "lockedAt": (existing.get('lockedAt') if existing and existing.get('userEmail') == user_email else now.isoformat()),
            "lastHeartbeat": now.isoformat(),
            "expiresAt": expires_at.isoformat(),
            "ttlSeconds": 180,
            "remainingSeconds": 180
        }
        ACTIVE_LOCKS[board_id] = lock_record

    save_locks()
    return {"success": True, "status": "acquired", "lock": lock_record}

def heartbeat_board_lock(board_id, user):
    clean_expired_locks()
    if not board_id or not user:
        return {"success": False, "status": "error", "message": "Missing boardId or user"}

    user_email = (user.get('email') or '').strip().lower()
    now = datetime.now()
    expires_at = now + timedelta(minutes=3)

    with _LOCKS_MUTEX:
        existing = ACTIVE_LOCKS.get(board_id)
        if not existing:
            return {"success": False, "status": "lost", "message": "Lock was expired or released"}

        owner_email = (existing.get('userEmail') or '').strip().lower()
        if owner_email != user_email:
            return {"success": False, "status": "lost", "message": f"Lock was taken over by {existing.get('userName')}"}

        existing['lastHeartbeat'] = now.isoformat()
        existing['expiresAt'] = expires_at.isoformat()
        existing['remainingSeconds'] = 180
        ret_lock = dict(existing)

    save_locks()
    return {"success": True, "status": "renewed", "lock": ret_lock}

def release_board_lock(board_id, user):
    clean_expired_locks()
    if not board_id:
        return {"success": True, "status": "released"}

    user_email = (user.get('email') or '').strip().lower() if user else ''
    is_admin = is_admin_user(user)

    with _LOCKS_MUTEX:
        existing = ACTIVE_LOCKS.get(board_id)
        if not existing:
            return {"success": True, "status": "released"}

        owner_email = (existing.get('userEmail') or '').strip().lower()
        if owner_email == user_email or is_admin or not owner_email:
            del ACTIVE_LOCKS[board_id]
        else:
            return {"success": False, "status": "not_owner", "message": "Cannot release lock held by another user"}

    save_locks()
    return {"success": True, "status": "released"}

def override_board_lock(board_id, board_name, user):
    """
    Allows Admin (Daniel Poludyonny) to break any existing lock and acquire it.
    """
    clean_expired_locks()
    if not is_admin_user(user):
        return {
            "success": False,
            "status": "forbidden",
            "message": "Security Error: Only Administrator (Daniel Poludyonny) can override board locks."
        }

    user_email = (user.get('email') or '').strip().lower()
    user_name = user.get('name') or "Daniel Poludyonny (Admin)"
    now = datetime.now()
    expires_at = now + timedelta(minutes=3)

    prev_owner = "Unknown"
    with _LOCKS_MUTEX:
        existing = ACTIVE_LOCKS.get(board_id)
        if existing:
            prev_owner = existing.get('userName') or existing.get('userEmail') or "another user"

        new_lock = {
            "boardId": board_id,
            "boardName": board_name or board_id,
            "userEmail": user_email,
            "userName": user_name,
            "lockedAt": now.isoformat(),
            "lastHeartbeat": now.isoformat(),
            "expiresAt": expires_at.isoformat(),
            "ttlSeconds": 180,
            "remainingSeconds": 180,
            "overriddenFrom": prev_owner
        }
        ACTIVE_LOCKS[board_id] = new_lock

    save_locks()
    return {
        "success": True,
        "status": "overridden",
        "lock": new_lock,
        "message": f"Lock for {board_name or board_id} successfully overridden from {prev_owner}."
    }

def check_board_lock_access(board_id, user):
    """
    Checks if `user` has write access to `board_id` considering active locks.
    Returns (allowed: bool, reason: str, lock_info: dict).
    - Admins always have access.
    - If board has no lock or expired lock, allowed=True.
    - If lock is held by this user, allowed=True.
    - If lock is held by another user, allowed=False.
    """
    clean_expired_locks()
    if not board_id:
        return True, "No board specified", None
    if is_admin_user(user):
        return True, "Admin access granted", None

    user_email = (user.get('email') or '').strip().lower() if user else ''
    now = datetime.now()

    with _LOCKS_MUTEX:
        existing = ACTIVE_LOCKS.get(board_id)
        if not existing:
            return True, "Board is unlocked", None

        exp = _parse_iso(existing.get('expiresAt'))
        owner_email = (existing.get('userEmail') or '').strip().lower()
        if exp > now and owner_email and owner_email != user_email:
            rem = max(0, int((exp - now).total_seconds()))
            return False, f"Board is locked by {existing.get('userName', 'another user')} ({rem}s remaining)", {**existing, "remainingSeconds": rem}

        return True, "Lock held by current user or expired", existing

# ----------------- Scoped Board Partitioned Storage -----------------

def node_belongs_to_board(node, board_id):
    if not node or not isinstance(node, dict) or not board_id:
        return False

    cat = node.get("category") or "KeyChain"
    var_id = node.get("variationId") or ""

    if board_id == "GenericPool":
        return cat == "GenericPool"
    if board_id == "DeckPool":
        return cat in ("DeckPool", "deck") or var_id == "deck_events"
    if board_id == "SpeciesPool":
        return cat in ("SpeciesPool", "species") or var_id == "species_events"

    parts = board_id.split(":")
    board_cat = parts[0]
    target_tl = parts[1] if len(parts) > 1 else None
    target_var = parts[2] if len(parts) > 2 else None

    if board_cat == "KeyChain":
        if cat != "KeyChain":
            return False
        return var_id == target_var if target_var else True

    if board_cat == "SecretChain":
        if cat != "SecretChain":
            return False
        return var_id == target_var if target_var else True

    return False

def dialogue_belongs_to_board(diag, board_id, active_board_node_ids):
    if not diag or not isinstance(diag, dict) or not board_id:
        return False

    # Check links
    links = diag.get("links") or []
    target_ev_id = diag.get("targetEventId")
    linked_event_ids = [l.get("targetEventId") for l in links if isinstance(l, dict) and l.get("targetEventId")]
    if target_ev_id:
        linked_event_ids.append(target_ev_id)

    if linked_event_ids:
        # If linked to any node currently on this board, it belongs to this board
        return any(eid in active_board_node_ids for eid in linked_event_ids)

    # Standalone dialogue: check category and variationId
    cat = diag.get("category") or "KeyChain"
    var_id = diag.get("variationId") or ""

    if board_id == "GenericPool":
        return cat == "GenericPool"
    if board_id == "DeckPool":
        return cat in ("DeckPool", "deck") or var_id == "deck_events"
    if board_id == "SpeciesPool":
        return cat in ("SpeciesPool", "species") or var_id == "species_events"

    parts = board_id.split(":")
    board_cat = parts[0]
    target_var = parts[2] if len(parts) > 2 else None

    if board_cat in ("KeyChain", "SecretChain"):
        if cat != board_cat:
            return False
        return var_id == target_var if target_var else True

    return False

def merge_and_save_board(board_id, board_nodes, board_dialogues, author_name, timelines=None, variations=None, stage_layout_version=None):
    """
    Atomically updates ONLY the nodes and dialogues belonging to `board_id`
    using the partitioned board storage system, leaving all other boards completely untouched.
    """
    from backend.board_storage import save_board_slice
    return save_board_slice(board_id, board_nodes, board_dialogues, author_name, timelines=timelines, variations=variations, stage_layout_version=stage_layout_version)

# Pre-load on startup
load_locks()
