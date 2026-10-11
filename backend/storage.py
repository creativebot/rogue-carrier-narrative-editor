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

def load_comments():
    if not os.path.exists(COMMENTS_FILE):
        return []
    try:
        with open(COMMENTS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            comments = data.get('comments', [])
        changed = False
        for c in comments:
            if not isinstance(c, dict):
                continue
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
            save_comments(comments)
        return comments
    except Exception:
        return []

def save_comments(comments_list):
    with open(COMMENTS_FILE, 'w', encoding='utf-8') as f:
        json.dump({"comments": comments_list}, f, indent=2, ensure_ascii=False)
    try:
        threading.Thread(
            target=_sync_json_file_to_github,
            args=("comments.json", {"comments": comments_list}, f"Sync comments ({len(comments_list)} total)"),
            daemon=True
        ).start()
    except Exception:
        pass

def load_notifications():
    if not os.path.exists(NOTIFICATIONS_FILE):
        return []
    try:
        with open(NOTIFICATIONS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            notifs = data.get('notifications', [])
        changed = False
        for n in notifs:
            if not isinstance(n, dict):
                continue
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
            save_notifications(notifs)
        return notifs
    except Exception:
        return []

def save_notifications(notifications_list):
    with open(NOTIFICATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump({"notifications": notifications_list}, f, indent=2, ensure_ascii=False)
    try:
        threading.Thread(
            target=_sync_json_file_to_github,
            args=("notifications.json", {"notifications": notifications_list}, f"Sync notifications ({len(notifications_list)} total)"),
            daemon=True
        ).start()
    except Exception:
        pass



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
    return changed

