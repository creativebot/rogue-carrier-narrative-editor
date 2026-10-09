import threading
import base64
import http.server
import socketserver
import json
import os
import sys
import re
import uuid
import random
import urllib.request
import urllib.parse
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import hashlib
import secrets

PORT = int(os.environ.get("PORT", 8000))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
SAVES_DIR = os.path.join(DIRECTORY, 'saves')
BACKUPS_DIR = os.path.join(DIRECTORY, 'backups')
USERS_FILE = os.path.join(DIRECTORY, 'users.json')
COMMENTS_FILE = os.path.join(DIRECTORY, 'comments.json')
NOTIFICATIONS_FILE = os.path.join(DIRECTORY, 'notifications.json')
NOTIFICATIONS_LOG = os.path.join(DIRECTORY, 'notifications.log')

os.makedirs(SAVES_DIR, exist_ok=True)
os.makedirs(BACKUPS_DIR, exist_ok=True)

ADMIN_EMAIL = "dpoludonnyi@n-ix.com"
ADMIN_EMAILS = {"dpoludonnyi@n-ix.com", "daniel.poludyonny@gmail.com"}
ALLOWED_EMAILS = {"daniel.poludyonny@gmail.com"}
ALLOWED_DOMAIN = "@n-ix.com"
REGISTRATION_ENABLED = False  # Public registration disabled by administrator
GOOGLE_CLIENT_ID = "436412031999-5hjf625k2417tn0ua2lb395731111dvb.apps.googleusercontent.com"

def is_admin_email(email):
    if not email:
        return False
    e = email.strip().lower()
    return e in ADMIN_EMAILS or e == ADMIN_EMAIL.lower()

# Password Hashing & Verification
def hash_password(password, salt=None):
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
    return f"{salt}:{hashed}"

def verify_password(stored_hash, password):
    if not stored_hash or ':' not in stored_hash:
        return False
    salt, hashed = stored_hash.split(':', 1)
    test_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
    return secrets.compare_digest(hashed, test_hash)

# In-memory stores
OTP_STORE = {}    # email -> {"otp": "123456", "expires": datetime}
SESSIONS = {}     # token -> {"email": "...", "role": "admin"|"editor", "name": "...", "status": "approved"|"pending"}

def parse_reward_string(raw_str):
    raw_str = raw_str.strip()
    icon = ""
    if raw_str and not raw_str[0].isalnum() and raw_str[0] not in ('+', '-'):
        parts = raw_str.split(None, 1)
        if len(parts) > 1 and len(parts[0]) <= 4:
            icon = parts[0]
            raw_str = parts[1].strip()

    amt = ""
    name = raw_str
    m_delta = re.search(r"^(.*?)\s*([+\-][0-9]+(?:-[0-9]+)?|[xX]\s*[0-9]+(?:-[0-9]+)?|[0-9]+-[0-9]+)$", raw_str)
    if m_delta:
        name = m_delta.group(1).strip()
        amt = m_delta.group(2).strip()
        if amt.lower().startswith('x'):
            amt = amt[1:].strip()

    cat = "Stat" if icon in ('🧠', '😊', '💀', '❤️', '👨‍🚀', '📜') else "Item"
    if "spec" in name.lower() or "crew" in name.lower() or icon in ('🔬', '🔧', '⚙️', '🛡️'):
        cat = "Specialization"

    return {
        "ResourceID": f"res_{name.lower().replace(' ', '_')}",
        "Name": name,
        "Amount": amt,
        "Category": cat,
        "Icon": icon
    }

def transform_to_unreal_schema(app_data):
    nodes = app_data.get('nodes', [])
    dialogues = app_data.get('dialogues', [])
    timelines = app_data.get('timelines', [])
    variations = app_data.get('variations', [])
    characters = app_data.get('characters', [])
    project_info = app_data.get('projectInfo', {}) or {}

    unreal_events = []
    for node in nodes:
        actions = []
        for idx, act in enumerate(node.get('actions', [])):
            req_clauses = []
            for c_idx, r in enumerate(act.get('requirements', [])):
                if isinstance(r, dict) and 'items' in r:
                    alts = []
                    for item in r.get('items', []):
                        try:
                            amt_val = int(item.get('amount', 1))
                        except (ValueError, TypeError):
                            amt_val = 1
                        alts.append({
                            "ItemID": item.get('resourceId') or item.get('id', ''),
                            "ItemName": item.get('name', ''),
                            "Amount": amt_val,
                            "Category": item.get('category', 'Item'),
                            "Icon": item.get('icon', '') or item.get('iconImg', '')
                        })
                    req_clauses.append({
                        "ClauseID": r.get('id', f"clause_{c_idx+1}"),
                        "IsAlternativeGroup": len(alts) > 1,
                        "Alternatives": alts
                    })
                elif isinstance(r, dict):
                    try:
                        amt_val = int(r.get('amount', 1))
                    except (ValueError, TypeError):
                        amt_val = 1
                    req_clauses.append({
                        "ClauseID": f"clause_{c_idx+1}",
                        "IsAlternativeGroup": False,
                        "Alternatives": [{
                            "ItemID": r.get('resourceId') or r.get('id', ''),
                            "ItemName": r.get('name', ''),
                            "Amount": amt_val,
                            "Category": r.get('category', 'Item'),
                            "Icon": r.get('icon', '') or r.get('iconImg', '')
                        }]
                    })

            rewards = []
            structured_rewards = []
            for rw in act.get('rewards', []):
                if isinstance(rw, dict):
                    name = rw.get('name', 'Reward')
                    amt = str(rw.get('amount', '')).strip()
                    icon = rw.get('icon', '')
                    prefix = f"{icon} " if icon else ""

                    if amt:
                        if amt.startswith('+') or amt.startswith('-'):
                            formatted_str = f"{prefix}{name} {amt}"
                        elif amt.startswith('x') or amt.startswith('X'):
                            formatted_str = f"{prefix}{name} {amt}"
                        else:
                            formatted_str = f"{prefix}{name} x{amt}"
                    else:
                        formatted_str = f"{prefix}{name}"

                    rewards.append(formatted_str)
                    clean_amt = amt
                    if clean_amt.lower().startswith('x'):
                        clean_amt = clean_amt[1:].strip()

                    cat = "Stat" if icon in ('🧠', '😊', '💀', '❤️', '👨‍🚀', '📜') else "Item"
                    if "spec" in name.lower() or "crew" in name.lower() or icon in ('🔬', '🔧', '⚙️', '🛡️'):
                        cat = "Specialization"

                    structured_rewards.append({
                        "ResourceID": rw.get('resourceId') or f"res_{name.lower().replace(' ', '_')}",
                        "Name": name,
                        "Amount": clean_amt,
                        "Category": cat,
                        "Icon": icon
                    })
                elif isinstance(rw, str) and rw.strip():
                    rewards.append(rw.strip())
                    structured_rewards.append(parse_reward_string(rw))

            target_node_id = act.get('targetNodeId', '') or act.get('nextNodeId', '')
            action_row = {
                "ActionIndex": idx,
                "ActionText": act.get('text', ''),
                "Tooltip": act.get('tooltip', ''),
                "Requirements": req_clauses,
                "Rewards": rewards,
                "StructuredRewards": structured_rewards,
                "ConsequenceText": act.get('consequence', ''),
                "NextEventID": target_node_id,
                "Condition": act.get('condition', ''),
                "NextStageIndex": act.get('nextStageIndex', None),
                "NextFloorIndex": act.get('nextFloorIndex', None),
                "CustomData": act.get('customData', {}) or {}
            }
            actions.append(action_row)

        lead_in_speaker = ""
        lead_in_text = ""
        lead_in_dialogue = node.get('leadInDialogue', {})
        if isinstance(lead_in_dialogue, dict):
            lead_in_speaker = lead_in_dialogue.get('speaker', '')
            lead_in_text = lead_in_dialogue.get('text', '')
        elif isinstance(lead_in_dialogue, str):
            lead_in_text = lead_in_dialogue

        row_name = f"EVENT_{node.get('id')}"
        unreal_events.append({
            "Name": row_name,
            "RowName": row_name,
            "EventID": node.get('id', ''),
            "EventTitle": node.get('title', ''),
            "EventCategory": node.get('category', 'Standard'),
            "EventType": node.get('type', 'Regular'),
            "PoolType": node.get('poolType', 'Timeline'),
            "PoolActiveByVariation": node.get('poolActiveByVariation', {}),
            "Intro": node.get('intro', ''),
            "Outro": node.get('outro', ''),
            "FloorIndex": int(node.get('floorIndex', 0)),
            "StageIndex": int(node.get('stageIndex', 0)),
            "LeadInSpeaker": lead_in_speaker,
            "LeadInDialogue": lead_in_text,
            "TimelineID": node.get('timelineId', ''),
            "VariationIDs": node.get('variationIds', []),
            "Tags": node.get('tags', []),
            "EditorPosition": {
                "X": float(node.get('position', {}).get('x', 0)),
                "Y": float(node.get('position', {}).get('y', 0))
            },
            "Actions": actions
        })

    unreal_dialogues = []
    for diag in dialogues:
        lines = []
        for l_idx, l in enumerate(diag.get('lines', [])):
            lines.append({
                "LineIndex": l_idx,
                "Speaker": l.get('speaker', ''),
                "SpeakerRole": l.get('speakerRole', ''),
                "Text": l.get('text', ''),
                "Portrait": l.get('portrait', ''),
                "AudioVoiceover": l.get('voiceover', ''),
                "CustomData": l.get('customData', {}) or {}
            })

        row_name = f"DIALOGUE_{diag.get('id')}"
        unreal_dialogues.append({
            "Name": row_name,
            "RowName": row_name,
            "DialogueID": diag.get('id', ''),
            "TargetEventID": diag.get('targetEventId', ''),
            "TriggerTiming": diag.get('triggerTiming', 'pre_event'),
            "TriggerActionID": diag.get('triggerActionId', '') or '',
            "TriggerCondition": diag.get('triggerCondition', ''),
            "DelayHours": float(diag.get('delayHours', diag.get('delayMinutes', 0))),
            "DelayUnit": diag.get('delayUnit', 'hours'),
            "VariationID": diag.get('variationId', ''),
            "Category": diag.get('category', 'KeyChain'),
            "FloorIndex": int(diag.get('floorIndex', 0)),
            "ColorScheme": diag.get('colorScheme', 'default'),
            "EditorPosition": {
                "X": float(diag.get('position', {}).get('x', 0)),
                "Y": float(diag.get('position', {}).get('y', 0))
            },
            "Lines": lines
        })

    unreal_characters = []
    for char in characters:
        char_row = f"CHAR_{char.get('id')}"
        unreal_characters.append({
            "Name": char_row,
            "RowName": char_row,
            "CharacterID": char.get('id', ''),
            "CharacterName": char.get('name', ''),
            "Role": char.get('role', ''),
            "Color": char.get('color', '#ffffff'),
            "TextColor": char.get('textColor', '#000000'),
            "Icon": char.get('icon', '👤'),
            "VariationIDs": char.get('variationIds', [])
        })

    return {
        "ProjectMeta": {
            "ExportTime": datetime.utcnow().isoformat() + "Z",
            "ToolkitVersion": "3.0",
            "GameTitle": "Rogue Carrier",
            "ProjectName": project_info.get('name', 'Rogue Carrier Scenario 1'),
            "Author": project_info.get('author', 'Wild Fields'),
            "TotalEvents": len(unreal_events),
            "TotalDialogues": len(unreal_dialogues),
            "TotalTimelines": len(timelines),
            "TotalVariations": len(variations),
            "TotalCharacters": len(characters)
        },
        "Timelines": timelines,
        "Variations": variations,
        "Characters": characters,
        "CharactersDataTable": unreal_characters,
        "EventsDataTable": unreal_events,
        "DialoguesDataTable": unreal_dialogues
    }

def save_unreal_artifacts(unreal_data):
    unreal_path = os.path.join(DIRECTORY, 'unreal-export.json')
    with open(unreal_path, 'w', encoding='utf-8') as f:
        json.dump(unreal_data, f, indent=2, ensure_ascii=False)

    events_path = os.path.join(DIRECTORY, 'unreal-events.json')
    with open(events_path, 'w', encoding='utf-8') as f:
        json.dump(unreal_data.get('EventsDataTable', []), f, indent=2, ensure_ascii=False)

    dialogues_path = os.path.join(DIRECTORY, 'unreal-dialogues.json')
    with open(dialogues_path, 'w', encoding='utf-8') as f:
        json.dump(unreal_data.get('DialoguesDataTable', []), f, indent=2, ensure_ascii=False)

    characters_path = os.path.join(DIRECTORY, 'unreal-characters.json')
    with open(characters_path, 'w', encoding='utf-8') as f:
        json.dump(unreal_data.get('CharactersDataTable', []), f, indent=2, ensure_ascii=False)

# ----------------- User & Auth System -----------------

def init_users_file():
    now_iso = datetime.utcnow().isoformat() + "Z"
    users = []
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                users = data.get('users', [])
        except Exception:
            users = []

    # Ensure admin user exists
    admin_found = False
    for u in users:
        if u.get('email', '').strip().lower() == ADMIN_EMAIL.lower():
            u['role'] = 'admin'
            u['status'] = 'approved'
            admin_found = True
            break

    if not admin_found:
        users.insert(0, {
            "email": ADMIN_EMAIL,
            "name": "Daniel Poludonnyi",
            "role": "admin",
            "status": "approved",
            "createdAt": now_iso,
            "lastLogin": now_iso
        })

    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump({"users": users}, f, indent=2, ensure_ascii=False)

init_users_file()

def load_users():
    if not os.path.exists(USERS_FILE):
        init_users_file()
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f).get('users', [])
    except Exception:
        return []

def save_users(users_list):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump({"users": users_list}, f, indent=2, ensure_ascii=False)

def is_valid_nix_email(email):
    if not email or not isinstance(email, str):
        return False
    e = email.strip().lower()
    return (e.endswith(ALLOWED_DOMAIN) and len(e) > len(ALLOWED_DOMAIN)) or e in ALLOWED_EMAILS

# ----------------- Notifications & Emails -----------------

def log_notification(to_email, subject, body, status="SENT"):
    entry = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [{status}] TO: {to_email} | SUBJECT: {subject}\nCONTENT: {body.strip()}\n{'-'*60}\n"
    try:
        with open(NOTIFICATIONS_LOG, 'a', encoding='utf-8') as f:
            f.write(entry)
    except Exception as err:
        print(f"Error logging notification: {err}", file=sys.stderr)

EMAIL_CONFIG_PATH = os.path.join(DIRECTORY, 'email_config.json')

def load_email_config():
    if os.path.exists(EMAIL_CONFIG_PATH):
        try:
            with open(EMAIL_CONFIG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def send_email_notification(to_email, subject, html_content, text_content=""):
    """
    Sends email via SMTP relay or API provider (Resend, SendGrid, Brevo).
    Returns {"success": True, "provider": ...} or {"success": False, "error": ...}.
    """
    cfg = load_email_config()

    # 1. SMTP Transport (Standard corporate SMTP, Gmail App Password, Office365, etc.)
    smtp_host = cfg.get("smtp_host") or os.environ.get("SMTP_HOST")
    if smtp_host:
        try:
            smtp_port = int(cfg.get("smtp_port") or os.environ.get("SMTP_PORT", 587))
            smtp_user = cfg.get("smtp_user") or os.environ.get("SMTP_USER", "")
            smtp_pass = cfg.get("smtp_password") or os.environ.get("SMTP_PASS", "")
            from_email = cfg.get("from_email") or os.environ.get("EMAIL_FROM", smtp_user or "narrative@n-ix.com")
            use_ssl = bool(cfg.get("use_ssl", False) or smtp_port == 465)
            use_tls = bool(cfg.get("use_tls", True)) if not use_ssl else False

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = from_email
            msg["To"] = to_email

            part1 = MIMEText(text_content or subject, "plain", "utf-8")
            part2 = MIMEText(html_content, "html", "utf-8")
            msg.attach(part1)
            msg.attach(part2)

            if use_ssl:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=12)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=12)
                if use_tls:
                    server.starttls()

            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)

            server.sendmail(from_email, [to_email], msg.as_string())
            server.quit()
            log_notification(to_email, subject, text_content or html_content, status="SMTP_OK")
            return {"success": True, "provider": "smtp"}
        except Exception as e:
            log_notification(to_email, subject, f"SMTP Error: {e}\n{text_content}", status="SMTP_FAIL")
            return {"success": False, "error": f"SMTP failed: {str(e)}"}

    # 2. Resend API
    resend_key = cfg.get("resend_api_key") or os.environ.get("RESEND_API_KEY")
    if resend_key:
        from_email = cfg.get("from_email") or os.environ.get("EMAIL_FROM", "Rogue Carrier Narrative <onboarding@resend.dev>")
        
        def _call_resend(target):
            req_data = json.dumps({
                "from": from_email,
                "to": [target],
                "subject": subject,
                "html": html_content
            }).encode('utf-8')
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=req_data,
                headers={
                    "Authorization": f"Bearer {resend_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "RogueCarrierEditor/2.6"
                }
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                log_notification(target, subject, text_content or html_content, status="RESEND_OK")
                return {"success": True, "provider": "resend", "recipient": target}

        try:
            return _call_resend(to_email)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')
            log_notification(to_email, subject, f"Resend Error: {err_body}", status="RESEND_FAIL")
            try:
                err_json = json.loads(err_body)
                msg = err_json.get("message", err_body)
            except Exception:
                msg = err_body
            return {"success": False, "error": f"Resend API rejected delivery: {msg}"}
        except Exception as e:
            log_notification(to_email, subject, f"Resend Error: {e}\n{text_content}", status="RESEND_FAIL")
            return {"success": False, "error": f"Resend API failed: {str(e)}"}

    # 3. SendGrid API
    sendgrid_key = cfg.get("sendgrid_api_key") or os.environ.get("SENDGRID_API_KEY")
    if sendgrid_key:
        try:
            from_email = cfg.get("from_email") or os.environ.get("EMAIL_FROM", "narrative@n-ix.com")
            req_data = json.dumps({
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": from_email},
                "subject": subject,
                "content": [{"type": "text/html", "value": html_content}]
            }).encode('utf-8')
            req = urllib.request.Request(
                "https://api.sendgrid.com/v3/mail/send",
                data=req_data,
                headers={
                    "Authorization": f"Bearer {sendgrid_key}",
                    "Content-Type": "application/json"
                }
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                log_notification(to_email, subject, text_content or html_content, status="SENDGRID_OK")
                return {"success": True, "provider": "sendgrid"}
        except Exception as e:
            log_notification(to_email, subject, f"SendGrid Error: {e}\n{text_content}", status="SENDGRID_FAIL")
            return {"success": False, "error": f"SendGrid API failed: {str(e)}"}

    # 4. Brevo API
    brevo_key = cfg.get("brevo_api_key") or os.environ.get("BREVO_API_KEY")
    if brevo_key:
        try:
            from_email = cfg.get("from_email") or os.environ.get("EMAIL_FROM", "narrative@n-ix.com")
            req_data = json.dumps({
                "sender": {"email": from_email, "name": "Rogue Carrier Narrative"},
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": html_content
            }).encode('utf-8')
            req = urllib.request.Request(
                "https://api.brevo.com/v3/smtp/email",
                data=req_data,
                headers={
                    "api-key": brevo_key,
                    "Content-Type": "application/json"
                }
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                log_notification(to_email, subject, text_content or html_content, status="BREVO_OK")
                return {"success": True, "provider": "brevo"}
        except Exception as e:
            log_notification(to_email, subject, f"Brevo Error: {e}\n{text_content}", status="BREVO_FAIL")
            return {"success": False, "error": f"Brevo API failed: {str(e)}"}

    # Not configured
    log_notification(to_email, subject, text_content or html_content, status="NOT_CONFIGURED")
    return {
        "success": False,
        "error": "No email delivery provider configured. Please provide SMTP credentials or an API key (Resend / SendGrid / Brevo) in email_config.json."
    }

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

    snapshot_payload = {
        "id": snapshot_id,
        "filename": filename,
        "reason": trigger_reason,
        "author": author or "System",
        "timestamp": now.isoformat(),
        "displayTime": now.strftime("%Y-%m-%d %H:%M:%S"),
        "nodeCount": len(app_data.get('nodes', [])),
        "dialogueCount": len(app_data.get('dialogues', [])),
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

        return snapshot_payload
    except Exception as err:
        print(f"Error creating backup snapshot: {err}", file=sys.stderr)
        return None


def get_github_pat():
    pat = os.environ.get("GITHUB_PAT")
    if pat:
        return pat.strip()
    token_file = os.path.join(DIRECTORY, "github_token.txt")
    if os.path.exists(token_file):
        try:
            with open(token_file, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception:
            pass
    return ""

GITHUB_PAT = get_github_pat()
GITHUB_REPO = "creativebot/rogue-carrier-narrative-editor"

def sync_project_data_to_github(app_data, author_name):
    """
    Asynchronously commits and pushes project-data.json directly to GitHub repository main branch.
    This guarantees that Render redeployments or container restarts NEVER lose saved work.
    """
    if not GITHUB_PAT or not app_data:
        return
    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/project-data.json"
        headers = {
            "Authorization": f"Bearer {GITHUB_PAT}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "RogueCarrierNarrativeEditor"
        }
        # 1. Fetch current file SHA
        sha = None
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                sha = data.get('sha')
        except Exception:
            pass

        # 2. Base64 encode JSON
        json_bytes = json.dumps(app_data, indent=2, ensure_ascii=False).encode('utf-8')
        content_b64 = base64.b64encode(json_bytes).decode('utf-8')

        node_count = len(app_data.get('nodes', []))
        diag_count = len(app_data.get('dialogues', []))
        commit_msg = f"Auto-save project-data.json ({node_count} events, {diag_count} diags) by {author_name}"

        put_body = {
            "message": commit_msg,
            "content": content_b64,
            "branch": "main"
        }
        if sha:
            put_body["sha"] = sha

        put_data = json.dumps(put_body).encode('utf-8')
        put_req = urllib.request.Request(url, data=put_data, headers={**headers, "Content-Type": "application/json"}, method="PUT")
        with urllib.request.urlopen(put_req, timeout=15) as put_resp:
            if put_resp.status in (200, 201):
                print(f"[GitHub Sync] Successfully committed and pushed project-data.json to GitHub main ({node_count} events)")
    except Exception as err:
        print(f"[GitHub Sync] GitHub background push error: {err}")

def pull_latest_from_github_on_startup():
    """
    On server boot, checks if GitHub repository has a richer or newer project-data.json than the container disk.
    """
    if not GITHUB_PAT:
        return
    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/project-data.json"
        headers = {
            "Authorization": f"Bearer {GITHUB_PAT}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "RogueCarrierNarrativeEditor"
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if 'content' in data:
                raw_bytes = base64.b64decode(data['content'])
                remote_json = json.loads(raw_bytes.decode('utf-8'))
                remote_nodes = len(remote_json.get('nodes', []))

                project_path = os.path.join(DIRECTORY, 'project-data.json')
                local_nodes = 0
                if os.path.exists(project_path):
                    try:
                        with open(project_path, 'r', encoding='utf-8') as f:
                            local_nodes = len(json.load(f).get('nodes', []))
                    except Exception:
                        pass

                if remote_nodes > local_nodes:
                    with open(project_path, 'wb') as f:
                        f.write(raw_bytes)
                    print(f"[Startup] Pulled updated project-data.json from GitHub ({remote_nodes} nodes vs local {local_nodes})")
    except Exception as e:
        print(f"[Startup] Could not check GitHub on startup: {e}")

def list_backup_snapshots():
    snapshots = []
    if os.path.exists(BACKUPS_DIR):
        for fn in os.listdir(BACKUPS_DIR):
            if fn.endswith('.json'):
                fp = os.path.join(BACKUPS_DIR, fn)
                try:
                    with open(fp, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    snapshots.append({
                        "id": data.get("id") or fn[:-5],
                        "filename": fn,
                        "reason": data.get("reason", "Snapshot"),
                        "author": data.get("author", "Unknown"),
                        "timestamp": data.get("timestamp", ""),
                        "displayTime": data.get("displayTime", datetime.fromtimestamp(os.path.getmtime(fp)).strftime("%Y-%m-%d %H:%M:%S")),
                        "nodeCount": data.get("nodeCount", 0),
                        "dialogueCount": data.get("dialogueCount", 0),
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
            return data.get('comments', [])
    except Exception:
        return []

def save_comments(comments_list):
    with open(COMMENTS_FILE, 'w', encoding='utf-8') as f:
        json.dump({"comments": comments_list}, f, indent=2, ensure_ascii=False)

def load_notifications():
    if not os.path.exists(NOTIFICATIONS_FILE):
        return []
    try:
        with open(NOTIFICATIONS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('notifications', [])
    except Exception:
        return []

def save_notifications(notifications_list):
    with open(NOTIFICATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump({"notifications": notifications_list}, f, indent=2, ensure_ascii=False)


# ----------------- HTTP Request Handler -----------------

class NarrativeEditorHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Auth-Token')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def is_local_request(self):
        # Cloudflare Tunnel sets CF-Connecting-IP, CF-Ray, or forwarded headers
        if self.headers.get('CF-Ray') or self.headers.get('CF-Connecting-IP') or self.headers.get('X-Forwarded-For'):
            return False
        host = (self.headers.get('Host') or '').lower().split(':')[0]
        client_ip = getattr(self, 'client_address', [None])[0]
        return host in ('localhost', '127.0.0.1', '0.0.0.0', '::1') or client_ip in ('127.0.0.1', '::1')

    def get_auth_user(self):
        # If running locally on user's PC, automatically grant full unrestricted Admin access without authorization
        if self.is_local_request():
            return {
                "email": ADMIN_EMAIL,
                "name": "Daniel (Local PC)",
                "role": "admin",
                "status": "approved",
                "isAdmin": True,
                "canEdit": True
            }

        auth_header = self.headers.get('Authorization', '')
        token = ""
        if auth_header.startswith('Bearer '):
            token = auth_header[7:].strip()
        elif 'X-Auth-Token' in self.headers:
            token = self.headers['X-Auth-Token'].strip()
        
        if not token:
            # Check query string
            if '?token=' in self.path:
                token = self.path.split('?token=')[-1].split('&')[0]

        if token and token in SESSIONS:
            return SESSIONS[token]
        return None

    def read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length <= 0:
            return {}
        post_data = self.rfile.read(content_length)
        return json.loads(post_data.decode('utf-8'))

    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    # ==================== POST ====================
    def do_POST(self):
        # 1. Main Project Save (with automatic snapshot creation)
        if self.path == '/api/save':
            try:
                user = self.get_auth_user()
                if not user or user.get('status') != 'approved':
                    self.send_json(403, {
                        "status": "error",
                        "message": "Read-Only: Please sign in with your @n-ix.com email to save changes."
                    })
                    return

                app_data = self.read_json_body()
                author_name = user.get('name') or user.get('email') or 'Editor User'

                # Save main active project-data.json
                project_path = os.path.join(DIRECTORY, 'project-data.json')
                with open(project_path, 'w', encoding='utf-8') as f:
                    json.dump(app_data, f, indent=2, ensure_ascii=False)

                # Generate Unreal Engine 5 compatible DataTable JSONs
                unreal_data = transform_to_unreal_schema(app_data)
                save_unreal_artifacts(unreal_data)

                # Save latest rolling autosave
                autosave_path = os.path.join(SAVES_DIR, 'latest_autosave.json')
                with open(autosave_path, 'w', encoding='utf-8') as f:
                    json.dump({
                        "id": "latest_autosave",
                        "name": "Auto-Save Backup",
                        "timestamp": datetime.now().isoformat(),
                        "displayTime": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "author": author_name,
                        "nodeCount": len(app_data.get('nodes', [])),
                        "dialogueCount": len(app_data.get('dialogues', [])),
                        "data": app_data
                    }, f, indent=2, ensure_ascii=False)

                # Automated Backup Snapshot
                snap = create_backup_snapshot("Automated Save Snapshot", author_name, app_data)

                # Asynchronous Permanent GitHub Commit & Push (Container-Reset Immune)
                threading.Thread(target=sync_project_data_to_github, args=(app_data, author_name), daemon=True).start()

                self.send_json(200, {
                    "status": "success",
                    "message": "Data saved to project-data.json, unreal-export.json, and backup snapshot created",
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                    "snapshotId": snap["id"] if snap else None
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 2. Named Version Save (User-triggered named version)
        elif self.path == '/api/saves' or self.path.startswith('/api/saves/'):
            try:
                user = self.get_auth_user()
                if not user or user.get('status') != 'approved':
                    self.send_json(403, {
                        "status": "error",
                        "message": "Read-Only: Please sign in with your @n-ix.com email to store version saves."
                    })
                    return

                payload = self.read_json_body()
                version_name = payload.get('name') or f"Save {datetime.now().strftime('%Y-%m-%d %H:%M')}"
                author = payload.get('author') or 'Wild Fields'
                app_data = payload.get('data') or {}
                
                timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
                clean_name = "".join(c for c in version_name if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')
                save_id = f"save_{timestamp_str}_{clean_name}"[:60]
                file_name = f"{save_id}.json"
                file_path = os.path.join(SAVES_DIR, file_name)

                save_payload = {
                    "id": save_id,
                    "name": version_name,
                    "filename": file_name,
                    "timestamp": datetime.now().isoformat(),
                    "displayTime": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "author": author,
                    "nodeCount": len(app_data.get('nodes', [])),
                    "dialogueCount": len(app_data.get('dialogues', [])),
                    "data": app_data
                }

                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(save_payload, f, indent=2, ensure_ascii=False)

                # Sync active project-data.json & Unreal
                project_path = os.path.join(DIRECTORY, 'project-data.json')
                with open(project_path, 'w', encoding='utf-8') as f:
                    json.dump(app_data, f, indent=2, ensure_ascii=False)

                unreal_data = transform_to_unreal_schema(app_data)
                save_unreal_artifacts(unreal_data)

                # Also create backup snapshot
                create_backup_snapshot(f"Manual Version: {version_name}", author, app_data)

                self.send_json(200, {
                    "status": "success",
                    "message": f"Version '{version_name}' saved to disk",
                    "save": save_payload
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 3. Auth: Send OTP
        elif self.path == '/api/auth/send-otp':
            try:
                payload = self.read_json_body()
                email = payload.get('email', '').strip().lower()

                if not is_valid_nix_email(email):
                    self.send_json(400, {
                        "status": "error",
                        "message": f"Access restricted. Only emails on domain {ALLOWED_DOMAIN} are authorized."
                    })
                    return

                # Generate 6-digit OTP
                otp_code = str(random.randint(100000, 999999))
                expires_at = datetime.utcnow() + timedelta(minutes=15)
                OTP_STORE[email] = {
                    "otp": otp_code,
                    "expires": expires_at
                }

                # Email notification dispatch
                subject = f"Your Rogue Carrier Narrative Editor Login Code: {otp_code}"
                html = f"""
                <div style="font-family: sans-serif; max-width: 500px; padding: 24px; border: 1px solid #1e293b; background: #0f172a; color: #f8fafc; border-radius: 8px;">
                    <h2 style="color: #38bdf8; margin-top: 0;">Rogue Carrier Narrative Editor</h2>
                    <p>Hello,</p>
                    <p>Your one-time authentication code for Rogue Carrier Editor is:</p>
                    <div style="background: #1e293b; padding: 16px; font-size: 32px; font-weight: bold; letter-spacing: 6px; text-align: center; color: #38bdf8; border-radius: 6px; margin: 20px 0;">
                        {otp_code}
                    </div>
                    <p style="color: #94a3b8; font-size: 13px;">This code will expire in 15 minutes. If you did not request this login, please ignore this email.</p>
                </div>
                """
                result = send_email_notification(email, subject, html, text_content=f"Your OTP code is {otp_code}")
                if not result.get("success"):
                    err_msg = result.get("error", "Email delivery failed.")
                    self.send_json(500, {
                        "status": "error",
                        "message": f"Could not send email to {email}: {err_msg}"
                    })
                    return

                self.send_json(200, {
                    "status": "success",
                    "message": f"Verification code sent to {email}"
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 4. Auth: Verify OTP & Login
        elif self.path == '/api/auth/verify-otp':
            try:
                payload = self.read_json_body()
                email = payload.get('email', '').strip().lower()
                otp_input = str(payload.get('otp', '')).strip()
                name_input = payload.get('name', '').strip()

                if not is_valid_nix_email(email):
                    self.send_json(400, {
                        "status": "error",
                        "message": f"Only emails on domain {ALLOWED_DOMAIN} can register."
                    })
                    return

                stored = OTP_STORE.get(email)
                if not stored or stored.get('otp') != otp_input:
                    self.send_json(401, {
                        "status": "error",
                        "message": "Invalid or expired verification code."
                    })
                    return

                # Code is valid, remove from store
                del OTP_STORE[email]

                # Find or register user
                users = load_users()
                target_user = None
                for u in users:
                    if u.get('email', '').lower() == email:
                        target_user = u
                        break

                now_iso = datetime.utcnow().isoformat() + "Z"
                is_admin = (email == ADMIN_EMAIL.lower())

                if not target_user:
                    # Register new user
                    default_name = name_input or email.split('@')[0].replace('.', ' ').title()
                    target_user = {
                        "email": email,
                        "name": default_name,
                        "role": "admin" if is_admin else "editor",
                        "status": "approved", # All @n-ix.com users can make changes and save
                        "createdAt": now_iso,
                        "lastLogin": now_iso
                    }
                    users.append(target_user)
                else:
                    if is_admin:
                        target_user['role'] = 'admin'
                        target_user['status'] = 'approved'
                    if name_input:
                        target_user['name'] = name_input
                    target_user['lastLogin'] = now_iso

                save_users(users)

                # Create session
                session_token = str(uuid.uuid4())
                SESSIONS[session_token] = {
                    "email": target_user["email"],
                    "name": target_user["name"],
                    "role": target_user["role"],
                    "status": target_user["status"],
                    "isAdmin": target_user["role"] == "admin",
                    "canEdit": target_user["status"] == "approved"
                }

                self.send_json(200, {
                    "status": "success",
                    "token": session_token,
                    "user": SESSIONS[session_token]
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 4. Google OAuth Sign-In
        elif self.path == '/api/auth/google':
            try:
                payload = self.read_json_body()
                id_token = payload.get('credential', '').strip()
                if not id_token:
                    self.send_json(400, {"status": "error", "message": "Missing Google ID token."})
                    return

                # Verify token with Google's public tokeninfo endpoint
                verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
                req = urllib.request.Request(verify_url)
                with urllib.request.urlopen(req, timeout=10) as resp:
                    google_data = json.loads(resp.read().decode('utf-8'))

                email = google_data.get('email', '').strip().lower()
                email_verified = google_data.get('email_verified')
                hd = google_data.get('hd', '')
                name = google_data.get('name', '') or email.split('@')[0].replace('.', ' ').title()
                picture = google_data.get('picture', '')

                is_verified = (str(email_verified).lower() in ('true', '1'))
                if not email or not is_verified:
                    self.send_json(401, {"status": "error", "message": "Google account email is not verified."})
                    return

                if not is_valid_nix_email(email):
                    self.send_json(403, {
                        "status": "error",
                        "message": f"Access restricted: Only {ALLOWED_DOMAIN} accounts qualify (signed in with {email})."
                    })
                    return

                users = load_users()
                target_user = None
                for u in users:
                    if u.get('email', '').lower() == email:
                        target_user = u
                        break

                now_iso = datetime.utcnow().isoformat() + "Z"
                is_admin = is_admin_email(email)

                if not target_user:
                    target_user = {
                        "email": email,
                        "name": name,
                        "picture": picture,
                        "role": "admin" if is_admin else "editor",
                        "status": "approved",
                        "authProvider": "google",
                        "createdAt": now_iso,
                        "lastLogin": now_iso
                    }
                    users.append(target_user)
                else:
                    target_user["name"] = name or target_user.get("name")
                    target_user["picture"] = picture or target_user.get("picture")
                    target_user["lastLogin"] = now_iso
                    target_user["status"] = "approved"
                    if is_admin:
                        target_user["role"] = "admin"

                save_users(users)

                session_token = str(uuid.uuid4())
                session_user = {
                    "email": target_user["email"],
                    "name": target_user["name"],
                    "role": target_user["role"],
                    "status": target_user["status"],
                    "isAdmin": target_user["role"] == "admin",
                    "canEdit": target_user["status"] == "approved",
                    "picture": target_user.get("picture", "")
                }
                SESSIONS[session_token] = session_user

                self.send_json(200, {
                    "status": "success",
                    "message": f"Welcome, {name}!",
                    "token": session_token,
                    "user": session_user
                })
            except urllib.error.HTTPError as e:
                self.send_json(401, {"status": "error", "message": "Google token validation failed."})
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 4a. Auth: Register Account (Password & Admin Approval)
        elif self.path == '/api/auth/register':
            try:
                if not REGISTRATION_ENABLED:
                    self.send_json(403, {
                        "status": "error",
                        "message": "Account registration is disabled by administrator."
                    })
                    return

                payload = self.read_json_body()
                email = payload.get('email', '').strip().lower()
                name = payload.get('name', '').strip()
                password = payload.get('password', '')

                if not is_valid_nix_email(email):
                    self.send_json(400, {
                        "status": "error",
                        "message": f"Only emails on domain {ALLOWED_DOMAIN} can register."
                    })
                    return

                if len(password) < 6:
                    self.send_json(400, {
                        "status": "error",
                        "message": "Password must be at least 6 characters long."
                    })
                    return

                users = load_users()
                target_user = None
                for u in users:
                    if u.get('email', '').lower() == email:
                        target_user = u
                        break

                if target_user and target_user.get('password_hash'):
                    self.send_json(400, {
                        "status": "error",
                        "message": "An account with this email already exists. Please sign in."
                    })
                    return

                now_iso = datetime.utcnow().isoformat() + "Z"
                is_admin = (email == ADMIN_EMAIL.lower())
                pass_hash = hash_password(password)
                default_name = name or email.split('@')[0].replace('.', ' ').title()

                if target_user:
                    target_user["name"] = default_name or target_user.get("name")
                    target_user["password_hash"] = pass_hash
                    target_user["role"] = "admin" if is_admin else target_user.get("role", "editor")
                    target_user["status"] = "approved" if is_admin else target_user.get("status", "pending")
                    target_user["lastLogin"] = now_iso
                else:
                    target_user = {
                        "email": email,
                        "name": default_name,
                        "role": "admin" if is_admin else "editor",
                        "status": "approved" if is_admin else "pending",
                        "password_hash": pass_hash,
                        "createdAt": now_iso,
                        "lastLogin": now_iso
                    }
                    users.append(target_user)

                save_users(users)

                token = str(uuid.uuid4())
                session_user = {
                    "email": target_user["email"],
                    "name": target_user["name"],
                    "role": target_user["role"],
                    "status": target_user["status"],
                    "isAdmin": target_user["role"] == "admin",
                    "canEdit": target_user["status"] == "approved"
                }
                SESSIONS[token] = session_user

                status_msg = "Account created and approved (Administrator)." if is_admin else "Account created! Submitted for approval by Administrator Daniel Poludonnyi."
                self.send_json(200, {
                    "status": "success",
                    "message": status_msg,
                    "token": token,
                    "user": session_user
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 4b. Auth: Login Account (Password)
        elif self.path == '/api/auth/login':
            try:
                payload = self.read_json_body()
                email = payload.get('email', '').strip().lower()
                password = payload.get('password', '')

                if not is_valid_nix_email(email):
                    self.send_json(400, {
                        "status": "error",
                        "message": f"Only emails on domain {ALLOWED_DOMAIN} are authorized."
                    })
                    return

                users = load_users()
                target_user = None
                for u in users:
                    if u.get('email', '').lower() == email:
                        target_user = u
                        break

                now_iso = datetime.utcnow().isoformat() + "Z"
                is_admin = (email == ADMIN_EMAIL.lower())

                # If primary admin signs in for first time without password, set it on this login!
                if is_admin and not target_user:
                    target_user = {
                        "email": email,
                        "name": "Daniel",
                        "role": "admin",
                        "status": "approved",
                        "password_hash": hash_password(password),
                        "createdAt": now_iso,
                        "lastLogin": now_iso
                    }
                    users.append(target_user)
                    save_users(users)
                elif not target_user:
                    self.send_json(401, {
                        "status": "error",
                        "message": "Account not found. Please click 'Register Account' to create your account."
                    })
                    return
                elif not target_user.get("password_hash"):
                    # Existing user without password set yet
                    target_user["password_hash"] = hash_password(password)
                    save_users(users)
                elif not verify_password(target_user.get("password_hash"), password):
                    self.send_json(401, {
                        "status": "error",
                        "message": "Incorrect password. Please try again."
                    })
                    return

                target_user["lastLogin"] = now_iso
                save_users(users)

                token = str(uuid.uuid4())
                session_user = {
                    "email": target_user["email"],
                    "name": target_user["name"],
                    "role": target_user["role"],
                    "status": target_user.get("status", "approved" if is_admin else "pending"),
                    "isAdmin": target_user["role"] == "admin",
                    "canEdit": target_user.get("status") == "approved"
                }
                SESSIONS[token] = session_user

                self.send_json(200, {
                    "status": "success",
                    "message": "Signed in successfully",
                    "token": token,
                    "user": session_user
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 5. Auth: Update user role / status (Admin only)
        elif self.path == '/api/auth/users/update':
            try:
                user = self.get_auth_user()
                if not user or user.get('role') != 'admin':
                    self.send_json(403, {"status": "error", "message": "Admin authorization required."})
                    return

                payload = self.read_json_body()
                target_email = payload.get('email', '').strip().lower()
                new_role = payload.get('role')
                new_status = payload.get('status')

                if target_email == ADMIN_EMAIL.lower() and (new_role != 'admin' or new_status != 'approved'):
                    self.send_json(400, {"status": "error", "message": "Cannot demote primary administrator."})
                    return

                users = load_users()
                updated = False
                for u in users:
                    if u.get('email', '').lower() == target_email:
                        if new_role:
                            u['role'] = new_role
                        if new_status:
                            u['status'] = new_status
                        updated = True
                        break

                if updated:
                    save_users(users)
                    for tok, sess in SESSIONS.items():
                        if sess.get('email', '').lower() == target_email:
                            if new_status:
                                sess['status'] = new_status
                                sess['canEdit'] = (new_status == 'approved')
                            if new_role:
                                sess['role'] = new_role
                                sess['isAdmin'] = (new_role == 'admin')
                    self.send_json(200, {"status": "success", "message": f"Updated user {target_email}"})
                else:
                    self.send_json(404, {"status": "error", "message": "User not found."})
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 6. Backups: Create Manual Snapshot
        elif self.path == '/api/backups/create':
            try:
                payload = self.read_json_body()
                reason = payload.get('reason') or f"Manual Snapshot ({datetime.now().strftime('%H:%M')})"
                author = payload.get('author') or 'User'
                
                # Read current project-data.json
                project_path = os.path.join(DIRECTORY, 'project-data.json')
                with open(project_path, 'r', encoding='utf-8') as f:
                    app_data = json.load(f)

                snap = create_backup_snapshot(reason, author, app_data)
                self.send_json(200, {
                    "status": "success",
                    "message": "Snapshot created successfully",
                    "snapshot": snap
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 7. Backups: Restore Snapshot
        elif self.path == '/api/backups/restore':
            try:
                user = self.get_auth_user()
                if not user or user.get('status') != 'approved':
                    self.send_json(403, {
                        "status": "error",
                        "message": "Read-Only: Please sign in with your @n-ix.com email to restore snapshots."
                    })
                    return

                payload = self.read_json_body()
                snapshot_id = payload.get('id')
                if not snapshot_id:
                    self.send_json(400, {"status": "error", "message": "Snapshot ID required"})
                    return

                filename = snapshot_id if snapshot_id.endswith('.json') else f"{snapshot_id}.json"
                fp = os.path.join(BACKUPS_DIR, filename)
                if not os.path.exists(fp):
                    self.send_json(404, {"status": "error", "message": "Snapshot file not found"})
                    return

                with open(fp, 'r', encoding='utf-8') as f:
                    snap_data = json.load(f)

                app_data = snap_data.get('data', {})

                # 1. Take a safety snapshot of current state before rollback
                project_path = os.path.join(DIRECTORY, 'project-data.json')
                if os.path.exists(project_path):
                    with open(project_path, 'r', encoding='utf-8') as f:
                        curr_data = json.load(f)
                    create_backup_snapshot(f"Safety Pre-Rollback (Before restoring {snapshot_id})", "System", curr_data)

                # 2. Overwrite project-data.json
                with open(project_path, 'w', encoding='utf-8') as f:
                    json.dump(app_data, f, indent=2, ensure_ascii=False)

                # 3. Overwrite Unreal exports
                unreal_data = transform_to_unreal_schema(app_data)
                save_unreal_artifacts(unreal_data)

                self.send_json(200, {
                    "status": "success",
                    "message": f"Successfully rolled back to snapshot {snapshot_id}",
                    "data": app_data
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 8. Comments: Add Comment & Tag/Email Notifications
        elif self.path == '/api/comments':
            try:
                payload = self.read_json_body()
                target_id = payload.get('targetId', '').strip()
                target_type = payload.get('targetType', 'event') # 'event' or 'dialogue'
                target_title = payload.get('targetTitle', target_id)
                text = payload.get('text', '').strip()
                author = payload.get('author', 'Anonymous')
                author_email = payload.get('authorEmail', '')

                if not target_id or not text:
                    self.send_json(400, {"status": "error", "message": "targetId and text are required."})
                    return

                comment_id = f"cmt_{int(datetime.now().timestamp()*1000)}"
                now_iso = datetime.utcnow().isoformat() + "Z"

                # Parse @ mentions in text (e.g., @dpoludonnyi or @dpoludonnyi@n-ix.com or @name)
                mention_matches = re.findall(r"@([a-zA-Z0-9._-]+(?:@n-ix\.com)?)", text)
                all_users = load_users()
                notified_users = []

                for match in mention_matches:
                    match_clean = match.strip().lower()
                    for u in all_users:
                        u_email = u.get('email', '').lower()
                        u_name = u.get('name', '').lower()
                        u_handle = u_email.split('@')[0]
                        if match_clean in (u_handle, u_email, u_name):
                            if u_email not in notified_users and u_email != author_email.lower():
                                notified_users.append(u_email)

                new_comment = {
                    "id": comment_id,
                    "targetId": target_id,
                    "targetType": target_type,
                    "targetTitle": target_title,
                    "text": text,
                    "author": author,
                    "authorEmail": author_email,
                    "createdAt": now_iso,
                    "displayTime": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "mentions": notified_users
                }

                comments = load_comments()
                comments.append(new_comment)
                save_comments(comments)

                # Store in-app notifications for tagged users
                if notified_users:
                    notifs = load_notifications()
                    for idx, tagged_email in enumerate(notified_users):
                        notif_item = {
                            "id": f"notif_{int(datetime.now().timestamp()*1000)}_{idx}",
                            "recipientEmail": tagged_email,
                            "senderName": author,
                            "senderEmail": author_email,
                            "targetId": target_id,
                            "targetType": target_type,
                            "targetTitle": target_title,
                            "commentText": text[:180],
                            "commentId": comment_id,
                            "createdAt": now_iso,
                            "displayTime": datetime.now().strftime("%b %d, %H:%M"),
                            "read": False
                        }
                        notifs.insert(0, notif_item)
                    save_notifications(notifs)

                # Send email notifications for mentions (best effort)
                for tagged_email in notified_users:
                    subj = f"You were tagged by {author} in Rogue Carrier: {target_title}"
                    html = f"""
                    <div style="font-family: sans-serif; max-width: 550px; padding: 24px; border: 1px solid #1e293b; background: #0f172a; color: #f8fafc; border-radius: 8px;">
                        <h3 style="color: #38bdf8; margin-top: 0;">Rogue Carrier Narrative Editor</h3>
                        <p><strong>{author}</strong> ({author_email}) mentioned you in a comment on <strong>{target_title}</strong> (<em>{target_type}</em>):</p>
                        <div style="background: #1e293b; border-left: 4px solid #38bdf8; padding: 14px; margin: 16px 0; border-radius: 4px; color: #e2e8f0; font-size: 15px;">
                            {text}
                        </div>
                        <p style="color: #94a3b8; font-size: 13px;">Open the editor to review and respond.</p>
                    </div>
                    """
                    send_email_notification(tagged_email, subj, html, text_content=f"{author} tagged you on {target_title}: {text}")

                self.send_json(200, {
                    "status": "success",
                    "comment": new_comment,
                    "notifiedCount": len(notified_users),
                    "notifiedUsers": notified_users
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 9. Notifications: Mark as Read
        elif self.path == '/api/notifications/read':
            try:
                payload = self.read_json_body()
                notif_id = payload.get('id')
                mark_all = payload.get('all', False)
                email = payload.get('email', '').strip().lower()
                user = self.get_auth_user()
                current_email = email or (user.get('email', '').lower() if user else '')

                all_notifs = load_notifications()
                updated = False
                for n in all_notifs:
                    if mark_all:
                        if not current_email or n.get('recipientEmail', '').lower() == current_email:
                            n['read'] = True
                            updated = True
                    elif notif_id and n.get('id') == notif_id:
                        n['read'] = True
                        updated = True
                        break

                if updated:
                    save_notifications(all_notifs)
                self.send_json(200, {"status": "success"})
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 10. Notifications: Clear All
        elif self.path == '/api/notifications/clear':
            try:
                payload = self.read_json_body()
                email = payload.get('email', '').strip().lower()
                user = self.get_auth_user()
                current_email = email or (user.get('email', '').lower() if user else '')

                all_notifs = load_notifications()
                if current_email:
                    kept = [n for n in all_notifs if n.get('recipientEmail', '').lower() != current_email]
                else:
                    kept = []
                save_notifications(kept)
                self.send_json(200, {"status": "success"})
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
        else:
            self.send_json(404, {"status": "error", "message": "Not Found"})

    # ==================== GET ====================
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. Main Project Load
        if path == '/api/load':
            if not self.is_local_request() and not self.get_auth_user():
                self.send_json(401, {"status": "error", "message": "Authentication required to access narrative project"})
                return
            project_path = os.path.join(DIRECTORY, 'project-data.json')
            if os.path.exists(project_path):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_cors_headers()
                self.end_headers()
                with open(project_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_json(404, {"status": "error", "message": "project-data.json not found"})

        # 2. Named Saves List
        elif path == '/api/saves':
            if not self.is_local_request() and not self.get_auth_user():
                self.send_json(401, {"status": "error", "message": "Authentication required to load saves"})
                return
            try:
                saves = []
                if os.path.exists(SAVES_DIR):
                    for fn in os.listdir(SAVES_DIR):
                        if fn.endswith('.json'):
                            fp = os.path.join(SAVES_DIR, fn)
                            try:
                                with open(fp, 'r', encoding='utf-8') as f:
                                    content = json.load(f)
                                saves.append({
                                    "id": content.get("id") or fn[:-5],
                                    "name": content.get("name") or fn[:-5],
                                    "filename": fn,
                                    "timestamp": content.get("timestamp") or "",
                                    "displayTime": content.get("displayTime") or datetime.fromtimestamp(os.path.getmtime(fp)).strftime("%Y-%m-%d %H:%M:%S"),
                                    "author": content.get("author") or "User",
                                    "nodeCount": content.get("nodeCount") or (len(content.get("data", {}).get("nodes", [])) if "data" in content else 0),
                                    "dialogueCount": content.get("dialogueCount") or (len(content.get("data", {}).get("dialogues", [])) if "data" in content else 0),
                                })
                            except Exception:
                                pass

                saves.sort(key=lambda s: s.get('timestamp') or s.get('displayTime'), reverse=True)
                self.send_json(200, {"status": "success", "saves": saves})
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 3. Specific Named Save Data
        elif path.startswith('/api/saves/'):
            save_id = path[len('/api/saves/'):].split('?')[0]
            if not save_id.endswith('.json'):
                save_id += '.json'
            fp = os.path.join(SAVES_DIR, save_id)
            if os.path.exists(fp):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_cors_headers()
                self.end_headers()
                with open(fp, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_json(404, {"status": "error", "message": "Save file not found"})

        # 4. Auth: Get Current User Profile (/api/auth/me)
        elif path == '/api/auth/me':
            is_local = self.is_local_request()
            user = self.get_auth_user()
            if user:
                self.send_json(200, {
                    "status": "success",
                    "user": user,
                    "isLocal": is_local,
                    "registrationEnabled": REGISTRATION_ENABLED,
                    "googleClientId": GOOGLE_CLIENT_ID
                })
            else:
                self.send_json(200, {
                    "status": "anonymous",
                    "user": None,
                    "isLocal": is_local,
                    "adminEmail": ADMIN_EMAIL,
                    "allowedDomain": ALLOWED_DOMAIN,
                    "registrationEnabled": REGISTRATION_ENABLED,
                    "googleClientId": GOOGLE_CLIENT_ID
                })

        # 5. Auth: Get User List (For @mention autocomplete & Admin management)
        elif path == '/api/auth/users':
            users = load_users()
            safe_users = [{
                "email": u.get("email"),
                "name": u.get("name"),
                "role": u.get("role"),
                "status": u.get("status")
            } for u in users if u.get("email") and u.get("email").lower() not in ALLOWED_EMAILS]
            self.send_json(200, {"status": "success", "users": safe_users})

        # 6. Backups: List Snapshots
        elif path == '/api/backups':
            try:
                snapshots = list_backup_snapshots()
                self.send_json(200, {"status": "success", "backups": snapshots})
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 7. Backups: Download / Get Specific Snapshot
        elif path.startswith('/api/backups/'):
            snap_id = path[len('/api/backups/'):].split('?')[0]
            if not snap_id.endswith('.json'):
                snap_id += '.json'
            fp = os.path.join(BACKUPS_DIR, snap_id)
            if os.path.exists(fp):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Disposition', f'attachment; filename="{snap_id}"')
                self.send_cors_headers()
                self.end_headers()
                with open(fp, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_json(404, {"status": "error", "message": "Backup snapshot not found"})

        # 8. Comments: Get Comments (optional ?targetId=...)
        elif path == '/api/comments':
            if not self.is_local_request() and not self.get_auth_user():
                self.send_json(401, {"status": "error", "message": "Authentication required"})
                return
            try:
                query = urllib.parse.parse_qs(parsed.query)
                target_id = query.get('targetId', [None])[0]
                all_comments = load_comments()
                if target_id:
                    filtered = [c for c in all_comments if c.get('targetId') == target_id]
                else:
                    filtered = all_comments

                # Group summary count by targetId for instant badge rendering
                counts = {}
                for c in all_comments:
                    tid = c.get('targetId')
                    if tid:
                        counts[tid] = counts.get(tid, 0) + 1

                self.send_json(200, {
                    "status": "success",
                    "comments": filtered,
                    "counts": counts
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 9. In-app Notifications: Get for current user
        elif path == '/api/notifications':
            if not self.is_local_request() and not self.get_auth_user():
                self.send_json(401, {"status": "error", "message": "Authentication required"})
                return
            try:
                query = urllib.parse.parse_qs(parsed.query)
                req_email = query.get('email', [''])[0].strip().lower()
                user = self.get_auth_user()
                current_email = req_email or (user.get('email', '').lower() if user else '')
                
                all_notifs = load_notifications()
                if current_email:
                    user_notifs = [n for n in all_notifs if n.get('recipientEmail', '').lower() == current_email]
                else:
                    user_notifs = all_notifs
                
                unread_count = sum(1 for n in user_notifs if not n.get('read', False))
                self.send_json(200, {
                    "status": "success",
                    "notifications": user_notifs,
                    "unreadCount": unread_count
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 10. Static Files Fallback
        else:
            # Block direct downloading of narrative project data files without authentication
            if path in ('/project-data.json', '/unreal-export.json', '/unreal-dialogues.json', '/unreal-events.json', '/sample-project.json', '/comments.json', '/notifications.json'):
                if not self.is_local_request() and not self.get_auth_user():
                    self.send_json(401, {"status": "error", "message": "Authentication required to access narrative project"})
                    return
            super().do_GET()

    # ==================== DELETE ====================
    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. Delete Save
        if path.startswith('/api/saves/'):
            save_id = path[len('/api/saves/'):].split('?')[0]
            if not save_id.endswith('.json'):
                save_id += '.json'
            fp = os.path.join(SAVES_DIR, save_id)
            if os.path.exists(fp):
                try:
                    os.remove(fp)
                    self.send_json(200, {"status": "success", "message": f"Deleted {save_id}"})
                except Exception as e:
                    self.send_json(500, {"status": "error", "message": str(e)})
            else:
                self.send_json(404, {"status": "error", "message": "Save file not found"})

        # 2. Delete Comment
        elif path.startswith('/api/comments/'):
            comment_id = path[len('/api/comments/'):].split('?')[0]
            comments = load_comments()
            orig_len = len(comments)
            comments = [c for c in comments if c.get('id') != comment_id]
            if len(comments) < orig_len:
                save_comments(comments)
                self.send_json(200, {"status": "success", "message": f"Deleted comment {comment_id}"})
            else:
                self.send_json(404, {"status": "error", "message": "Comment not found"})

        # 2b. Delete Notification
        elif path.startswith('/api/notifications/'):
            notif_id = path[len('/api/notifications/'):].split('?')[0]
            all_notifs = load_notifications()
            orig_len = len(all_notifs)
            all_notifs = [n for n in all_notifs if n.get('id') != notif_id]
            if len(all_notifs) < orig_len:
                save_notifications(all_notifs)
                self.send_json(200, {"status": "success", "message": f"Deleted notification {notif_id}"})
            else:
                self.send_json(404, {"status": "error", "message": "Notification not found"})

        # 3. Delete Backup Snapshot
        elif path.startswith('/api/backups/'):
            snap_id = path[len('/api/backups/'):].split('?')[0]
            if not snap_id.endswith('.json'):
                snap_id += '.json'
            fp = os.path.join(BACKUPS_DIR, snap_id)
            if os.path.exists(fp):
                try:
                    os.remove(fp)
                    self.send_json(200, {"status": "success", "message": f"Deleted snapshot {snap_id}"})
                except Exception as e:
                    self.send_json(500, {"status": "error", "message": str(e)})
            else:
                self.send_json(404, {"status": "error", "message": "Snapshot not found"})
        else:
            self.send_json(404, {"status": "error", "message": "Not Found"})

class ReusableThreadingServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

def run():
    log_path = os.path.join(DIRECTORY, "server_debug.log")
    with open(log_path, "w", encoding="utf-8") as lf:
        lf.write(f"Server starting on port {PORT} at {datetime.now()}...\n")
        lf.flush()
    try:
        httpd = ReusableThreadingServer(("0.0.0.0", PORT), NarrativeEditorHandler)
        msg = f"Rogue Carrier Narrative Server running on port {PORT} with Auth, Backups & Comments..."
        print(msg, flush=True)
        sys.stderr.write(msg + "\n")
        sys.stderr.flush()
        with open(log_path, "a", encoding="utf-8") as lf:
            lf.write(msg + "\n")
            lf.flush()
        httpd.serve_forever()
    except Exception as e:
        err = f"Server failed to start on port {PORT}: {e}"
        print(err, flush=True)
        sys.stderr.write(err + "\n")
        sys.stderr.flush()
        with open(log_path, "a", encoding="utf-8") as lf:
            lf.write(err + "\n")
            lf.flush()
        raise

if __name__ == '__main__':
    run()
