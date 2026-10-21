import os
import json
import threading
from datetime import datetime, timedelta
from backend.config import ANALYTICS_FILE, ANALYTICS_ADMIN_EMAILS

ANALYTICS_LOCK = threading.Lock()
_cached_analytics = None

PALETTE = [
    "#f59e0b",  # Amber
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

def load_analytics_data():
    global _cached_analytics
    with ANALYTICS_LOCK:
        if _cached_analytics is not None:
            return _cached_analytics
        if os.path.exists(ANALYTICS_FILE):
            try:
                with open(ANALYTICS_FILE, 'r', encoding='utf-8') as f:
                    _cached_analytics = json.load(f)
                    if not isinstance(_cached_analytics, dict):
                        _cached_analytics = {}
            except Exception:
                _cached_analytics = {}
        else:
            _cached_analytics = {}
        
        if "dailyTotals" not in _cached_analytics:
            _cached_analytics["dailyTotals"] = {}
        return _cached_analytics

def save_analytics_data(data):
    global _cached_analytics
    with ANALYTICS_LOCK:
        _cached_analytics = data
        try:
            with open(ANALYTICS_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[Analytics] Failed to save analytics.json: {e}")

def format_duration(seconds):
    if not seconds or seconds < 0:
        return "0s"
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    parts = []
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0 or hours > 0:
        parts.append(f"{minutes}m")
    parts.append(f"{secs}s")
    return " ".join(parts)

def record_active_editing_time(user_email, user_name, board_id, seconds, timestamp_iso=None):
    if not user_email or seconds <= 0:
        return False
    
    # Cap seconds per report to 120 seconds to prevent spoofing
    seconds = min(int(seconds), 120)
    
    now = datetime.utcnow()
    if timestamp_iso:
        try:
            now = datetime.fromisoformat(timestamp_iso.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            now = datetime.utcnow()
            
    date_str = now.strftime("%Y-%m-%d")
    hour = now.hour
    
    data = load_analytics_data()
    daily = data.setdefault("dailyTotals", {})
    day_bucket = daily.setdefault(date_str, {})
    
    clean_email = user_email.strip().lower()
    if clean_email in ("daniel.poludyonny@gmail.com", "dpoludonnyi@n-ix.com"):
        clean_email = "dpoludonnyi@n-ix.com"
        user_name = "Daniel Poludyonny"

    user_entry = day_bucket.setdefault(clean_email, {
        "name": user_name or clean_email.split('@')[0].replace('.', ' ').title(),
        "email": clean_email,
        "seconds": 0,
        "boards": {},
        "hourly": [0] * 24,
        "lastActive": now.isoformat() + "Z"
    })
    
    user_entry["name"] = user_name or user_entry.get("name")
    user_entry["seconds"] += seconds
    user_entry["lastActive"] = now.isoformat() + "Z"
    
    clean_board = board_id or "General"
    boards_map = user_entry.setdefault("boards", {})
    boards_map[clean_board] = boards_map.get(clean_board, 0) + seconds
    
    hourly = user_entry.setdefault("hourly", [0] * 24)
    if len(hourly) < 24:
        hourly.extend([0] * (24 - len(hourly)))
    if 0 <= hour < 24:
        hourly[hour] += seconds
        
    save_analytics_data(data)
    return True

def get_analytics_summary(timeframe="daily", target_date_str=None):
    data = load_analytics_data()
    daily = data.get("dailyTotals", {})
    
    today = datetime.utcnow().date()
    target_date = today
    if target_date_str:
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
        except Exception:
            target_date = today
            
    # Determine date range according to timeframe
    if timeframe == "weekly":
        # Start on Monday of the week containing target_date
        monday = target_date - timedelta(days=target_date.weekday())
        date_keys = [(monday + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
        period_label = f"Week of {monday.strftime('%b %d')} – {(monday + timedelta(days=6)).strftime('%b %d, %Y')}"
        chart_labels = [(monday + timedelta(days=i)).strftime("%a %b %d") for i in range(7)]
    elif timeframe == "monthly":
        # All days in target_date's month
        first_day = target_date.replace(day=1)
        # Next month first day minus 1 day
        next_month = (first_day.replace(day=28) + timedelta(days=4)).replace(day=1)
        days_in_month = (next_month - timedelta(days=1)).day
        date_keys = [(first_day + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days_in_month)]
        period_label = target_date.strftime("%B %Y")
        chart_labels = [(first_day + timedelta(days=i)).strftime("%d") for i in range(days_in_month)]
    else: # daily
        date_keys = [target_date.strftime("%Y-%m-%d")]
        period_label = target_date.strftime("%A, %B %d, %Y")
        chart_labels = [f"{h:02d}:00" for h in range(24)]
        
    user_totals = {}  # email -> { name, email, seconds, boards: {}, hourly_or_daily: [0]*len(chart_labels), lastActive }
    board_totals = {} # boardId -> { seconds, users: { email: seconds } }
    total_seconds = 0
    
    for idx, d_str in enumerate(date_keys):
        day_users = daily.get(d_str, {})
        for raw_email, uentry in day_users.items():
            email = raw_email.strip().lower()
            u_name = uentry.get("name")
            if email in ("daniel.poludyonny@gmail.com", "dpoludonnyi@n-ix.com"):
                email = "dpoludonnyi@n-ix.com"
                u_name = "Daniel Poludyonny"

            if email not in user_totals:
                user_totals[email] = {
                    "name": u_name or email.split('@')[0].replace('.', ' ').title(),
                    "email": email,
                    "seconds": 0,
                    "boards": {},
                    "series": [0] * len(chart_labels),
                    "lastActive": uentry.get("lastActive")
                }
            
            u_sec = uentry.get("seconds", 0)
            user_totals[email]["seconds"] += u_sec
            total_seconds += u_sec
            
            # Update last active if newer
            cand_last = uentry.get("lastActive")
            if cand_last and (not user_totals[email]["lastActive"] or cand_last > user_totals[email]["lastActive"]):
                user_totals[email]["lastActive"] = cand_last
                
            # Accumulate board breakdowns
            for bid, bsec in uentry.get("boards", {}).items():
                user_totals[email]["boards"][bid] = user_totals[email]["boards"].get(bid, 0) + bsec
                if bid not in board_totals:
                    board_totals[bid] = {"boardId": bid, "seconds": 0, "users": {}}
                board_totals[bid]["seconds"] += bsec
                board_totals[bid]["users"][email] = board_totals[bid]["users"].get(email, 0) + bsec
                
            # Populate chart series bucket
            if timeframe == "daily":
                # In daily mode, chart labels are 24 hours
                hourly_list = uentry.get("hourly", [])
                for h in range(min(24, len(hourly_list))):
                    user_totals[email]["series"][h] += round(hourly_list[h] / 60.0, 1) # minutes
            else:
                # In weekly/monthly mode, chart label index corresponds to day idx
                user_totals[email]["series"][idx] += round(u_sec / 60.0, 1) # minutes

    # Format user list and assign chart colors
    users_list = []
    color_idx = 0
    for email, u in user_totals.items():
        pct = round((u["seconds"] / total_seconds * 100), 1) if total_seconds > 0 else 0
        top_board = None
        top_board_sec = 0
        boards_formatted = {}
        for b_name, b_s in u["boards"].items():
            boards_formatted[b_name] = {
                "seconds": b_s,
                "formatted": format_duration(b_s)
            }
            if b_s > top_board_sec:
                top_board_sec = b_s
                top_board = b_name
                
        user_color = PALETTE[color_idx % len(PALETTE)]
        color_idx += 1
        
        users_list.append({
            "name": u["name"],
            "email": u["email"],
            "color": user_color,
            "seconds": u["seconds"],
            "minutes": round(u["seconds"] / 60.0, 1),
            "hours": round(u["seconds"] / 3600.0, 2),
            "formatted": format_duration(u["seconds"]),
            "percentShare": pct,
            "topBoard": top_board or "None",
            "boards": boards_formatted,
            "series": u["series"],
            "lastActive": u["lastActive"]
        })
        
    users_list.sort(key=lambda x: x["seconds"], reverse=True)
    
    # Format boards list
    boards_list = []
    for bid, binfo in board_totals.items():
        boards_list.append({
            "boardId": bid,
            "seconds": binfo["seconds"],
            "formatted": format_duration(binfo["seconds"]),
            "percent": round((binfo["seconds"] / total_seconds * 100), 1) if total_seconds > 0 else 0,
            "userCount": len(binfo["users"])
        })
    boards_list.sort(key=lambda x: x["seconds"], reverse=True)
    
    # KPIs
    top_user = users_list[0] if users_list else None
    top_board_obj = boards_list[0] if boards_list else None
    
    return {
        "timeframe": timeframe,
        "periodLabel": period_label,
        "targetDate": target_date.strftime("%Y-%m-%d"),
        "totalSeconds": total_seconds,
        "totalFormatted": format_duration(total_seconds),
        "totalHours": round(total_seconds / 3600.0, 2),
        "activeWritersCount": len(users_list),
        "topContributor": {
            "name": top_user["name"] if top_user else "None",
            "email": top_user["email"] if top_user else "",
            "formatted": top_user["formatted"] if top_user else "0s",
            "percent": top_user["percentShare"] if top_user else 0
        },
        "mostEditedBoard": {
            "boardId": top_board_obj["boardId"] if top_board_obj else "None",
            "formatted": top_board_obj["formatted"] if top_board_obj else "0s"
        },
        "chart": {
            "labels": chart_labels,
            "series": [
                {
                    "name": u["name"],
                    "email": u["email"],
                    "color": u["color"],
                    "data": u["series"]
                } for u in users_list
            ]
        },
        "users": users_list,
        "boards": boards_list
    }

def export_analytics_csv(timeframe="daily", target_date_str=None):
    summary = get_analytics_summary(timeframe, target_date_str)
    lines = [
        f"Period,{summary['periodLabel']}",
        f"Total Team Active Editing Time,{summary['totalFormatted']}",
        "",
        "Writer Name,Writer Email,Total Active Time,Active Hours,Contribution %,Top Board,Last Active"
    ]
    
    for u in summary.get("users", []):
        lines.append(f'"{u["name"]}","{u["email"]}","{u["formatted"]}",{u["hours"]},{u["percentShare"]}%,{u["topBoard"]},{u["lastActive"] or ""}')
        
    lines.append("")
    lines.append("Board Breakdown")
    lines.append("Board ID,Total Active Time,Share %,Contributors Count")
    for b in summary.get("boards", []):
        lines.append(f'"{b["boardId"]}","{b["formatted"]}",{b["percent"]}%,{b["userCount"]}')
        
    return "\n".join(lines)
