import threading
import base64
import json
import os
import sys
import re
import uuid
import random
import urllib.request
import urllib.parse
import urllib.error
import smtplib
import hmac
import hashlib
import secrets
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from backend.config import *
from backend.unreal_export import count_board_contents
from backend.auth import is_placeholder_name, resolve_user_display_name
from backend.github_sync import _sync_json_file_to_github

# ----------------- Automated & Manual Backups -----------------

def create_backup_snapshot(trigger_reason, author, app_data):
    """
    Saves an immutable snapshot into BACKUPS_DIR.
    Keeps up to 100 historical snapshots with full rollbacks and exports.
    """
    now = datetime.now()
    timestamp_str = now.strftime('%Y%m%d_%H%M%S')
    clean_reason = "".join(c for c in trigger_reason if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')[:40]
    snapshot_id = f"snap_{timestamp_str}_{clean_reason}"
    filename = f"{snapshot_id}.json"
    filepath = os.path.join(BACKUPS_DIR, filename)

    ev_count, diag_count = count_board_contents(app_data)

    snapshot_payload = {
        "id": snapshot_id,
        "filename": filename,
        "reason": trigger_reason,
        "author": author or "System",
        "timestamp": now.isoformat(),
        "displayTime": now.strftime("%Y-%m-%d %H:%M:%S"),
        "nodeCount": ev_count,
        "dialogueCount": diag_count,
        "data": app_data
    }

    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(snapshot_payload, f, indent=2, ensure_ascii=False)

        # Cleanup old backups beyond 100
        existing = [f for f in os.listdir(BACKUPS_DIR) if f.startswith("snap_") and f.endswith(".json")]
        if len(existing) > 100:
            existing.sort()
            for old_f in existing[:-100]:
                try:
                    os.remove(os.path.join(BACKUPS_DIR, old_f))
                except Exception:
                    pass

        try:
            threading.Thread(
                target=_sync_json_file_to_github,
                args=(f"backups/{filename}", snapshot_payload, f"Backup snapshot {snapshot_id} by {author or 'System'}"),
                daemon=True
            ).start()
        except Exception:
            pass

        return snapshot_payload
    except Exception as err:
        print(f"Error creating backup snapshot: {err}", file=sys.stderr)
        return None



def list_backup_snapshots(category='KeyChain', variation_id='var_v1'):
    snapshots = []
    if os.path.exists(BACKUPS_DIR):
        for fn in os.listdir(BACKUPS_DIR):
            if fn.endswith('.json'):
                fp = os.path.join(BACKUPS_DIR, fn)
                try:
                    with open(fp, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    app_payload = data.get("data") if isinstance(data.get("data"), dict) else data
                    ev_count, diag_count = count_board_contents(app_payload, category, variation_id)
                    snapshots.append({
                        "id": data.get("id") or fn[:-5],
                        "filename": fn,
                        "reason": data.get("reason", "Snapshot"),
                        "author": data.get("author", "Unknown"),
                        "timestamp": data.get("timestamp", ""),
                        "displayTime": data.get("displayTime", datetime.fromtimestamp(os.path.getmtime(fp)).strftime("%Y-%m-%d %H:%M:%S")),
                        "nodeCount": ev_count,
                        "dialogueCount": diag_count,
                        "sizeBytes": os.path.getsize(fp)
                    })
                except Exception:
                    pass
    snapshots.sort(key=lambda s: s.get('timestamp') or s.get('displayTime'), reverse=True)
    return snapshots

# ----------------- Block Commenting System -----------------

def _read_comments_raw():
    if not os.path.exists(COMMENTS_FILE):
        return {"comments": [], "deletedIds": []}
    try:
        with open(COMMENTS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {"comments": [], "deletedIds": []}
        return {
            "comments": data.get("comments", []) if isinstance(data.get("comments"), list) else [],
            "deletedIds": data.get("deletedIds", []) if isinstance(data.get("deletedIds"), list) else []
        }
    except Exception:
        return {"comments": [], "deletedIds": []}

def load_comments():
    raw = _read_comments_raw()
    deleted_set = set(raw.get("deletedIds", []))
    comments = [c for c in raw.get("comments", []) if isinstance(c, dict) and c.get("id") not in deleted_set]
    changed = (len(comments) != len(raw.get("comments", [])))
    for c in comments:
        c_email = (c.get('authorEmail') or '').strip().lower()
        c_author = (c.get('author') or '').strip()
        if not c_email and is_placeholder_name(c_author):
            c_email = ADMIN_EMAIL
            c['authorEmail'] = c_email
            changed = True
        if is_placeholder_name(c_author):
            real_name = resolve_user_display_name(c_email or ADMIN_EMAIL, '')
            if real_name and c.get('author') != real_name:
                c['author'] = real_name
                changed = True
    if changed:
        save_comments(comments, deleted_ids=list(deleted_set), sync_github=False)
    return comments

def save_comments(comments_list, deleted_ids=None, sync_github=True):
    raw = _read_comments_raw()
    merged_deleted = set(raw.get("deletedIds", []))
    if isinstance(deleted_ids, (list, set)):
        merged_deleted.update(x for x in deleted_ids if x)
    clean_comments = [c for c in comments_list if isinstance(c, dict) and c.get("id") not in merged_deleted]
    payload = {
        "comments": clean_comments,
        "deletedIds": sorted(list(merged_deleted))
    }
    with open(COMMENTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    if sync_github:
        try:
            threading.Thread(
                target=_sync_json_file_to_github,
                args=("comments.json", payload, f"Sync comments ({len(clean_comments)} active, {len(merged_deleted)} deleted)"),
                daemon=True
            ).start()
        except Exception:
            pass

def delete_comment_by_id(comment_id):
    if not comment_id:
        return False
    raw = _read_comments_raw()
    deleted_set = set(raw.get("deletedIds", []))
    orig_comments = raw.get("comments", [])
    existed = any(isinstance(c, dict) and c.get("id") == comment_id for c in orig_comments) or (comment_id not in deleted_set)
    deleted_set.add(comment_id)
    remaining = [c for c in orig_comments if isinstance(c, dict) and c.get("id") != comment_id]
    save_comments(remaining, deleted_ids=list(deleted_set), sync_github=True)
    return existed or len(remaining) < len(orig_comments)

def _read_notifications_raw():
    if not os.path.exists(NOTIFICATIONS_FILE):
        return {"notifications": [], "deletedIds": []}
    try:
        with open(NOTIFICATIONS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {"notifications": [], "deletedIds": []}
        return {
            "notifications": data.get("notifications", []) if isinstance(data.get("notifications"), list) else [],
            "deletedIds": data.get("deletedIds", []) if isinstance(data.get("deletedIds"), list) else []
        }
    except Exception:
        return {"notifications": [], "deletedIds": []}

def load_notifications():
    raw = _read_notifications_raw()
    deleted_set = set(raw.get("deletedIds", []))
    notifs = [n for n in raw.get("notifications", []) if isinstance(n, dict) and n.get("id") not in deleted_set]
    changed = (len(notifs) != len(raw.get("notifications", [])))
    for n in notifs:
        s_email = (n.get('senderEmail') or '').strip().lower()
        s_name = (n.get('senderName') or '').strip()
        if not s_email and is_placeholder_name(s_name):
            s_email = ADMIN_EMAIL
            n['senderEmail'] = s_email
            changed = True
        if is_placeholder_name(s_name):
            real_name = resolve_user_display_name(s_email or ADMIN_EMAIL, '')
            if real_name and n.get('senderName') != real_name:
                n['senderName'] = real_name
                changed = True
    if changed:
        save_notifications(notifs, deleted_ids=list(deleted_set), sync_github=False)
    return notifs

def save_notifications(notifications_list, deleted_ids=None, sync_github=True):
    raw = _read_notifications_raw()
    merged_deleted = set(raw.get("deletedIds", []))
    if isinstance(deleted_ids, (list, set)):
        merged_deleted.update(x for x in deleted_ids if x)
    clean_notifs = [n for n in notifications_list if isinstance(n, dict) and n.get("id") not in merged_deleted]
    payload = {
        "notifications": clean_notifs,
        "deletedIds": sorted(list(merged_deleted))
    }
    with open(NOTIFICATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    if sync_github:
        try:
            threading.Thread(
                target=_sync_json_file_to_github,
                args=("notifications.json", payload, f"Sync notifications ({len(clean_notifs)} active)"),
                daemon=True
            ).start()
        except Exception:
            pass

def delete_notification_by_id(notif_id):
    if not notif_id:
        return False
    raw = _read_notifications_raw()
    deleted_set = set(raw.get("deletedIds", []))
    orig_notifs = raw.get("notifications", [])
    existed = any(isinstance(n, dict) and n.get("id") == notif_id for n in orig_notifs)
    deleted_set.add(notif_id)
    remaining = [n for n in orig_notifs if isinstance(n, dict) and n.get("id") != notif_id]
    save_notifications(remaining, deleted_ids=list(deleted_set), sync_github=True)
    return existed or len(remaining) < len(orig_notifs)



T1_CANONICAL_VAR_NAMES = {
    2: "Once More Into The Frey",
    3: "Too Many Variables",
    4: "Gain The Upper Hand",
    5: "Hunted!",
    6: "On A Cold Trail",
    7: "Prism Glitch",
    8: "The Problem of Probability",
    9: "Facing Shadows",
    10: "The Finite Infinity",
}
T1_LEGACY_VAR_NAMES = {
    "Orbital Rift",
    "Deep Submersion",
    "Predator Nest",
    "Bioweapon Outbreak",
    "Zephyrus Wreckage",
    "Chronos Paradox",
    "Sub-Oceanic Abyss",
    "Behemoth Encounter",
    "Echoes of the Fleet",
}

def normalize_t1_variations(app_data):
    if not isinstance(app_data, dict):
        return False
    variations = app_data.get("variations")
    if not isinstance(variations, list):
        return False
    changed = False
    for v in variations:
        if not isinstance(v, dict):
            continue
        tl_id = v.get("timelineId")
        vid = v.get("id") or ""
        try:
            v_num = int(v.get("number") or 0)
        except (ValueError, TypeError):
            v_num = 0
        if (tl_id == "timeline_1" or vid.startswith("var_v")) and v_num in T1_CANONICAL_VAR_NAMES:
            cur_name = (v.get("name") or "").strip()
            if not cur_name or cur_name in T1_LEGACY_VAR_NAMES:
                v["name"] = T1_CANONICAL_VAR_NAMES[v_num]
                changed = True

    var_name_by_id = {
        v.get("id"): (v.get("name") or "").strip()
        for v in variations
        if isinstance(v, dict) and v.get("id") and (v.get("name") or "").strip()
    }
    for n in (app_data.get("nodes") or []):
        if not isinstance(n, dict):
            continue
        if (n.get("category") or "KeyChain") == "KeyChain":
            vid = n.get("variationId") or "var_v1"
            inherited_title = var_name_by_id.get(vid)
            if inherited_title and (n.get("name") != inherited_title or n.get("title") != inherited_title):
                n["name"] = inherited_title
                n["title"] = inherited_title
                changed = True
    return changed

