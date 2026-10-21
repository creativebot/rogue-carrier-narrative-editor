import threading
from datetime import datetime, timedelta
import hashlib

PRESENCE_LOCK = threading.Lock()
ACTIVE_PRESENCE = {} # user_email -> dict
PRESENCE_TIMEOUT_SECONDS = 45

PALETTE = [
    "#f59e0b",  # Amber (Daniel default)
    "#06b6d4",  # Cyan
    "#a855f7",  # Purple
    "#10b981",  # Emerald
    "#f43f5e",  # Rose
    "#3b82f6",  # Blue
    "#fb923c",  # Orange
    "#ec4899",  # Pink
    "#8b5cf6",  # Indigo
    "#14b8a6"   # Teal
]

def get_user_color(email):
    if not email:
        return PALETTE[0]
    clean = email.strip().lower()
    if clean in ("dpoludonnyi@n-ix.com", "daniel.poludyonny@gmail.com"):
        return "#f59e0b"
    h = int(hashlib.md5(clean.encode('utf-8')).hexdigest(), 16)
    return PALETTE[h % len(PALETTE)]

def get_initials(name, email=""):
    if name and isinstance(name, str):
        clean = name.strip()
        parts = clean.split()
        if len(parts) >= 2:
            return (parts[0][0] + parts[-1][0]).upper()
        elif len(parts) == 1 and len(parts[0]) >= 2:
            return parts[0][:2].upper()
        elif len(parts) == 1:
            return parts[0][0].upper()
            
    if email and isinstance(email, str):
        user_part = email.split('@')[0]
        parts = [p for p in user_part.replace('.', ' ').replace('_', ' ').replace('-', ' ').split() if p]
        if len(parts) >= 2:
            return (parts[0][0] + parts[-1][0]).upper()
        elif len(user_part) >= 2:
            return user_part[:2].upper()
    return "??"

def record_presence(user_email, user_name, board_id, board_name, is_editing=False):
    if not user_email:
        return
    clean_email = user_email.strip().lower()
    if clean_email in ("daniel.poludyonny@gmail.com", "dpoludonnyi@n-ix.com"):
        clean_email = "dpoludonnyi@n-ix.com"
        user_name = "Daniel Poludyonny"

    now = datetime.utcnow()
    initials = get_initials(user_name, clean_email)
    color = get_user_color(clean_email)

    with PRESENCE_LOCK:
        ACTIVE_PRESENCE[clean_email] = {
            "email": clean_email,
            "name": user_name or clean_email.split('@')[0].replace('.', ' ').title(),
            "initials": initials,
            "color": color,
            "boardId": board_id or "KeyChain:timeline_1:var_v1",
            "boardName": board_name or "Key Events",
            "isEditing": bool(is_editing),
            "lastSeen": now.isoformat() + "Z",
            "_lastSeenDt": now
        }

def remove_presence(user_email):
    if not user_email:
        return
    clean_email = user_email.strip().lower()
    if clean_email in ("daniel.poludyonny@gmail.com", "dpoludonnyi@n-ix.com"):
        clean_email = "dpoludonnyi@n-ix.com"
    with PRESENCE_LOCK:
        if clean_email in ACTIVE_PRESENCE:
            del ACTIVE_PRESENCE[clean_email]

def get_active_presence():
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=PRESENCE_TIMEOUT_SECONDS)
    with PRESENCE_LOCK:
        to_del = []
        result = []
        for email, p in ACTIVE_PRESENCE.items():
            last_dt = p.get("_lastSeenDt")
            if not last_dt or last_dt < cutoff:
                to_del.append(email)
            else:
                item = dict(p)
                item.pop("_lastSeenDt", None)
                result.append(item)
        for email in to_del:
            del ACTIVE_PRESENCE[email]
            
        # Sort Daniel first, then alphabetical
        result.sort(key=lambda x: (0 if x["email"] == "dpoludonnyi@n-ix.com" else 1, x["name"].lower()))
        return result
