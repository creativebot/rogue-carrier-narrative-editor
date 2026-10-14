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

def load_sessions():
    if os.path.exists(SESSIONS_FILE):
        try:
            with open(SESSIONS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_sessions():
    try:
        with open(SESSIONS_FILE, 'w', encoding='utf-8') as f:
            json.dump(SESSIONS, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

import hmac

TOKEN_SECRET = os.environ.get("TOKEN_SECRET", "rc-narrative-stateless-token-secret-2026")

def sign_user_token(user_dict):
    try:
        payload_bytes = json.dumps(user_dict, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
        b64_payload = base64.urlsafe_b64encode(payload_bytes).decode('utf-8').rstrip('=')
        sig = hmac.new(TOKEN_SECRET.encode('utf-8'), b64_payload.encode('utf-8'), hashlib.sha256).hexdigest()
        return f"rctok.{b64_payload}.{sig}"
    except Exception:
        return str(uuid.uuid4())

def verify_user_token(token):
    if not token or not token.startswith("rctok."):
        return None
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        b64_payload, sig = parts[1], parts[2]
        expected_sig = hmac.new(TOKEN_SECRET.encode('utf-8'), b64_payload.encode('utf-8'), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        padding = '=' * (-len(b64_payload) % 4)
        user_dict = json.loads(base64.urlsafe_b64decode(b64_payload + padding).decode('utf-8'))
        return user_dict
    except Exception:
        return None


# Persistent Session Store across server restarts
SESSIONS = load_sessions()
OTP_STORE = {}    # email -> {"otp": "123456", "expires": datetime}


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

def save_users(users_list, sync_github=True):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump({"users": users_list}, f, indent=2, ensure_ascii=False)
    if sync_github:
        sync_users_to_github_async(users_list)

def is_valid_nix_email(email):
    if not email or not isinstance(email, str):
        return False
    e = email.strip().lower()
    return (e.endswith(ALLOWED_DOMAIN) and len(e) > len(ALLOWED_DOMAIN)) or e in ALLOWED_EMAILS

GENERIC_PLACEHOLDER_NAMES = {
    'authorized editor',
    'editor user',
    'daniel (local pc)',
    'user',
    'n-ix member',
    'member',
    'anonymous',
    'unknown'
}

def is_placeholder_name(name):
    if not name or not isinstance(name, str):
        return True
    return name.strip().lower() in GENERIC_PLACEHOLDER_NAMES

def resolve_user_display_name(email, candidate_name=''):
    clean_email = (email or '').strip().lower()
    cand = (candidate_name or '').strip()
    if cand and not is_placeholder_name(cand):
        return cand

    if clean_email:
        for u in load_users():
            if (u.get('email') or '').strip().lower() == clean_email:
                reg_name = (u.get('name') or '').strip()
                if reg_name and not is_placeholder_name(reg_name):
                    return reg_name
        if is_admin_email(clean_email):
            return "Daniel Poludyonny"
        if '@' in clean_email:
            return clean_email.split('@')[0].replace('.', ' ').replace('_', ' ').title()

    return cand or "Daniel Poludyonny"

def enrich_user_session(user_obj):
    if not isinstance(user_obj, dict):
        return user_obj
    email = (user_obj.get('email') or ADMIN_EMAIL).strip().lower()
    is_adm = is_admin_email(email)
    reg_role = None
    reg_pic = None
    reg_status = None
    for u in load_users():
        if (u.get('email') or '').strip().lower() == email:
            reg_role = u.get('role')
            reg_pic = u.get('picture')
            reg_status = u.get('status')
            break
    role = 'admin' if is_adm else (reg_role or user_obj.get('role') or 'editor')
    resolved_name = resolve_user_display_name(email, user_obj.get('name', ''))
    status = 'approved' if is_adm else (reg_status or user_obj.get('status') or 'approved')
    user_obj['email'] = email
    user_obj['name'] = resolved_name
    user_obj['role'] = role
    user_obj['status'] = status
    user_obj['isAdmin'] = (role == 'admin')
    user_obj['canEdit'] = (status == 'approved' and role != 'viewer')
    if reg_pic and not user_obj.get('picture'):
        user_obj['picture'] = reg_pic
    return user_obj

def ensure_user_registered(user_obj):
    """
    Ensures any authenticated @n-ix.com user (from Google OAuth, OTP, stateless token, or X-User-Email header)
    is persisted in users.json so they appear in @mention autocomplete and Team Manager even after container restarts.
    """
    if not isinstance(user_obj, dict):
        return
    email = (user_obj.get('email') or '').strip().lower()
    if not email or not is_valid_nix_email(email):
        return
    name = (user_obj.get('name') or '').strip()
    if is_placeholder_name(name):
        name = ''
    default_name = resolve_user_display_name(email, name)
    users = load_users()
    found = None
    for u in users:
        if (u.get('email') or '').strip().lower() == email:
            found = u
            break
    now_iso = datetime.utcnow().isoformat() + "Z"
    is_adm = is_admin_email(email)
    if not found:
        new_u = {
            "email": email,
            "name": default_name,
            "picture": user_obj.get('picture', ''),
            "role": "admin" if is_adm else user_obj.get('role', 'editor'),
            "status": "approved" if is_adm else user_obj.get('status', 'approved'),
            "authProvider": user_obj.get('authProvider', 'google'),
            "createdAt": now_iso,
            "lastLogin": now_iso
        }
        users.append(new_u)
        save_users(users, sync_github=True)
    else:
        changed = False
        if name and (not found.get('name') or is_placeholder_name(found.get('name'))):
            found['name'] = name
            changed = True
        elif is_placeholder_name(found.get('name')):
            found['name'] = default_name
            changed = True
        if is_adm and found.get('status') != 'approved':
            found['status'] = 'approved'
            changed = True
        if changed:
            save_users(users, sync_github=True)
    if found:
        user_obj['name'] = found.get('name') if not is_placeholder_name(found.get('name')) else default_name
        if not is_adm:
            user_obj['status'] = found.get('status', 'approved')
            user_obj['role'] = found.get('role', 'editor')
            user_obj['canEdit'] = (user_obj['status'] == 'approved' and user_obj['role'] != 'viewer')
    else:
        user_obj['name'] = default_name


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


def sync_users_to_github_async(users_list=None):
    try:
        from backend.github_sync import sync_users_to_github
        threading.Thread(target=sync_users_to_github, args=(users_list,), daemon=True).start()
    except Exception:
        pass