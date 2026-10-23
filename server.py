import threading
import http.server
import socketserver
import json
import os
import sys
import re
import random
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timedelta

from backend.config import *
from backend.unreal_export import (
    count_board_contents,
    parse_reward_string,
    transform_to_unreal_schema,
    save_unreal_artifacts,
)
from backend.auth import (
    is_admin_email,
    hash_password,
    verify_password,
    load_sessions,
    save_sessions,
    sign_user_token,
    verify_user_token,
    SESSIONS,
    OTP_STORE,
    init_users_file,
    load_users,
    save_users,
    is_valid_nix_email,
    is_placeholder_name,
    resolve_user_display_name,
    enrich_user_session,
    ensure_user_registered,
    log_notification,
    load_email_config,
    send_email_notification,
)
from backend.github_sync import (
    get_github_pat,
    GITHUB_PAT,
    GITHUB_REPO,
    GITHUB_DATA_BRANCH,
    _put_github_file,
    sync_project_data_to_github,
    _sync_json_file_to_github,
    sync_users_to_github,
    sync_analytics_to_github,
    pull_latest_from_github_on_startup,
)
from backend.analytics import (
    record_active_editing_time,
    get_analytics_summary,
    export_analytics_csv,
)
from backend.presence import (
    record_presence,
    remove_presence,
    get_active_presence,
)
from backend.storage import (
    create_backup_snapshot,
    list_backup_snapshots,
    load_comments,
    save_comments,
    delete_comment_by_id,
    load_notifications,
    save_notifications,
    delete_notification_by_id,
    T1_CANONICAL_VAR_NAMES,
    T1_LEGACY_VAR_NAMES,
    normalize_t1_variations,
)
from backend.locks import (
    acquire_board_lock,
    heartbeat_board_lock,
    release_board_lock,
    override_board_lock,
    get_all_locks,
    merge_and_save_board,
    is_admin_user,
    get_board_revisions,
    record_board_save,
    check_board_lock_access,
)
from backend.board_storage import (
    save_board_slice,
    load_board_slice,
    list_board_saves,
    restore_board_save,
    reassemble_full_project,
    save_shared_meta,
    list_all_boards_summary,
    import_board_payload,
)
class NarrativeEditorHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Auth-Token, X-User-Email, X-User-Name')

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
        auth_header = self.headers.get('Authorization', '')
        token = ""
        if auth_header.startswith('Bearer '):
            token = auth_header[7:].strip()
        elif 'X-Auth-Token' in self.headers:
            token = self.headers['X-Auth-Token'].strip()
        
        if not token:
            cookie_header = self.headers.get('Cookie', '')
            if 'rc_session_token=' in cookie_header:
                for part in cookie_header.split(';'):
                    part = part.strip()
                    if part.startswith('rc_session_token='):
                        token = part[len('rc_session_token='):].strip()
                        break
        
        if not token:
            # Check query string
            if 'token=' in self.path:
                token = self.path.split('token=')[-1].split('&')[0]

        header_email = (self.headers.get('X-User-Email') or '').strip().lower()
        header_name = (self.headers.get('X-User-Name') or '').strip()
        if is_placeholder_name(header_name):
            header_name = ""

        # Support JSON mock user in Bearer token (for testing/multi-user simulation)
        if token and token.startswith('{') and token.endswith('}'):
            try:
                raw_u = json.loads(token)
                if isinstance(raw_u, dict) and raw_u.get('email'):
                    enrich_user_session(raw_u)
                    return raw_u
            except Exception:
                pass

        if token and token in SESSIONS:
            sess = SESSIONS[token]
            if header_email and is_valid_nix_email(header_email) and sess.get('email') != header_email:
                sess['email'] = header_email
            if header_name and is_placeholder_name(sess.get('name')):
                sess['name'] = header_name
            enrich_user_session(sess)
            ensure_user_registered(sess)
            return sess

        # Stateless signed token check (survives container restarts/redeployments)
        if token:
            verified = verify_user_token(token)
            if verified:
                enrich_user_session(verified)
                SESSIONS[token] = verified
                save_sessions()
                ensure_user_registered(verified)
                return verified

        # If explicit non-admin X-User-Email was provided
        if header_email:
            custom_user = {
                "email": header_email,
                "name": header_name or resolve_user_display_name(header_email, ""),
                "role": "editor",
                "status": "approved",
                "canEdit": True
            }
            enrich_user_session(custom_user)
            return custom_user

        # If running locally on user's PC without specific auth header, grant default Admin access
        if self.is_local_request():
            return {
                "email": ADMIN_EMAIL,
                "name": resolve_user_display_name(ADMIN_EMAIL, ""),
                "role": "admin",
                "status": "approved",
                "isAdmin": True,
                "canEdit": True
            }

        # Fallback: X-User-Email header from an already-signed-in @n-ix.com client after container restart
        if header_email and is_valid_nix_email(header_email):
            user_obj = enrich_user_session({
                "email": header_email,
                "name": header_name
            })
            if token:
                SESSIONS[token] = user_obj
                save_sessions()
            ensure_user_registered(user_obj)
            return user_obj

        # Legacy UUID session token recovery after server restart
        if token and len(token) >= 16:
            restored_user = enrich_user_session({
                "email": header_email if (header_email and is_valid_nix_email(header_email)) else ADMIN_EMAIL,
                "name": header_name
            })
            SESSIONS[token] = restored_user
            save_sessions()
            ensure_user_registered(restored_user)
            return restored_user

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
        # 0. Board-Scoped Save (Saves only active board, preventing cross-board overwrites)
        if self.path == '/api/save-board':
            try:
                body = self.read_json_body()
                board_id = body.get('boardId')
                board_nodes = body.get('nodes', [])
                board_dialogues = body.get('dialogues', [])
                timelines = body.get('timelines')
                variations = body.get('variations')
                stage_layout_version = body.get('stageLayoutVersion')
                save_name = body.get('name') or body.get('note')
                symbol_limits = body.get('symbolLimits')
                recommended_limits = body.get('recommendedLimits')
                characters = body.get('characters')
                criteria_pool = body.get('criteriaPool')
                user = self.get_auth_user()
                if not user:
                    user = {
                        "email": ADMIN_EMAIL,
                        "name": body.get('author') or 'Editor User',
                        "role": "editor",
                        "status": "approved",
                        "canEdit": True
                    }
                if not user or user.get('status') != 'approved' or user.get('canEdit') is False or user.get('role') == 'viewer':
                    self.send_json(403, {"status": "error", "message": "Sign-in and editor permissions required to save board."})
                    return

                # Lock validation
                allowed, reason, lock = check_board_lock_access(board_id, user)
                if not allowed:
                    self.send_json(423, {
                        "status": "locked",
                        "message": f"Cannot save board: {reason}",
                        "lock": lock
                    })
                    return

                author_name = user.get('name') or user.get('email') or 'Editor User'
                result = save_board_slice(
                    board_id,
                    board_nodes,
                    board_dialogues,
                    author_name,
                    timelines=timelines,
                    variations=variations,
                    stage_layout_version=stage_layout_version,
                    save_name=save_name,
                    symbol_limits=symbol_limits,
                    recommended_limits=recommended_limits,
                    characters=characters,
                    criteria_pool=criteria_pool
                )
                self.send_json(200, result)
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # Restore Single Board from History
        elif self.path == '/api/restore-board':
            try:
                body = self.read_json_body()
                board_id = body.get('boardId')
                save_id = body.get('saveId')
                user = self.get_auth_user()
                if not user:
                    user = {
                        "email": ADMIN_EMAIL,
                        "name": 'Editor User',
                        "role": "editor",
                        "status": "approved",
                        "canEdit": True
                    }
                if not user or user.get('status') != 'approved' or user.get('canEdit') is False or user.get('role') == 'viewer':
                    self.send_json(403, {"status": "error", "message": "Sign-in and editor permissions required to restore board."})
                    return

                # Lock validation
                allowed, reason, lock = check_board_lock_access(board_id, user)
                if not allowed:
                    self.send_json(423, {
                        "status": "locked",
                        "message": f"Cannot restore board: {reason}",
                        "lock": lock
                    })
                    return

                author_name = (user.get('name') or user.get('email')) if user else 'Editor User'
                result = restore_board_save(board_id, save_id, author_name)
                code = 200 if result.get('status') == 'success' else 400
                self.send_json(code, result)
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # Import Single Board from File/Payload
        elif self.path == '/api/import-board':
            try:
                body = self.read_json_body()
                board_id = body.get('boardId')
                nodes = body.get('nodes', [])
                dialogues = body.get('dialogues', [])
                note = body.get('note') or body.get('name')
                user = self.get_auth_user()
                if not user:
                    user = {
                        "email": ADMIN_EMAIL,
                        "name": body.get('author') or 'Editor User',
                        "role": "editor",
                        "status": "approved",
                        "canEdit": True
                    }
                if not user or user.get('status') != 'approved' or user.get('canEdit') is False or user.get('role') == 'viewer':
                    self.send_json(403, {"status": "error", "message": "Sign-in and editor permissions required to import board."})
                    return

                # Lock validation
                allowed, reason, lock = check_board_lock_access(board_id, user)
                if not allowed:
                    self.send_json(423, {
                        "status": "locked",
                        "message": f"Cannot import board: {reason}",
                        "lock": lock
                    })
                    return

                author_name = user.get('name') or user.get('email') or 'Editor User'
                result = import_board_payload(board_id, nodes, dialogues, author_name, import_note=note)
                code = 200 if result.get('status') == 'success' else 400
                self.send_json(code, result)
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # Dedicated Timeline Deletion Endpoint (Guarantees persistence across server & disk)
        elif self.path == '/api/delete-timeline':
            try:
                body = self.read_json_body()
                tl_id = body.get('timelineId')
                if not tl_id:
                    self.send_json(400, {"status": "error", "message": "Missing timelineId parameter"})
                    return
                user = self.get_auth_user()
                author_name = (user.get('name') or user.get('email')) if user else 'Editor User'

                meta = load_shared_meta()
                timelines = [t for t in meta.get('timelines', []) if t.get('id') != tl_id]
                for idx, t in enumerate(sorted(timelines, key=lambda x: int(x.get('number') or 1))):
                    t['number'] = idx + 1
                variations = [v for v in meta.get('variations', []) if v.get('timelineId') != tl_id]
                meta['timelines'] = timelines
                meta['variations'] = variations
                save_shared_meta(meta, author_name)

                # Delete any board files associated with this deleted timeline
                if os.path.exists(BOARDS_DIR):
                    for fn in os.listdir(BOARDS_DIR):
                        if tl_id in fn and fn.endswith('.json'):
                            try: os.remove(os.path.join(BOARDS_DIR, fn))
                            except Exception: pass

                saves_boards_dir = os.path.join('saves', 'boards')
                if os.path.exists(saves_boards_dir):
                    for dn in os.listdir(saves_boards_dir):
                        if tl_id in dn:
                            try: shutil.rmtree(os.path.join(saves_boards_dir, dn), ignore_errors=True)
                            except Exception: pass

                full_project = reassemble_full_project()
                threading.Thread(target=sync_project_data_to_github, args=(full_project, author_name), daemon=True).start()

                self.send_json(200, {
                    "status": "success",
                    "deletedTimelineId": tl_id,
                    "remainingTimelines": timelines,
                    "remainingVariations": variations
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # Dedicated Timeline Metadata Save Endpoint
        elif self.path == '/api/save-timelines':
            try:
                body = self.read_json_body()
                timelines = body.get('timelines')
                variations = body.get('variations')
                user = self.get_auth_user()
                author_name = (user.get('name') or user.get('email')) if user else 'Editor User'

                meta_updates = {}
                if timelines is not None: meta_updates['timelines'] = timelines
                if variations is not None: meta_updates['variations'] = variations
                save_shared_meta(meta_updates, author_name)

                full_project = reassemble_full_project()
                threading.Thread(target=sync_project_data_to_github, args=(full_project, author_name), daemon=True).start()

                self.send_json(200, {"status": "success", "timelines": timelines, "variations": variations})
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # Board Lock: Acquire
        elif self.path == '/api/lock/acquire':
            try:
                body = self.read_json_body()
                board_id = body.get('boardId')
                board_name = body.get('boardName')
                user = self.get_auth_user()
                if not user:
                    user = {
                        "email": ADMIN_EMAIL,
                        "name": "Local Editor",
                        "role": "admin",
                        "status": "approved",
                        "canEdit": True
                    }
                if user.get('status') != 'approved' or user.get('canEdit') is False or user.get('role') == 'viewer':
                    self.send_json(403, {"success": False, "status": "forbidden", "message": "You do not have editing permissions."})
                    return
                res = acquire_board_lock(board_id, board_name, user)
                code = 200 if res.get('success') else 423
                self.send_json(code, res)
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # Board Lock: Heartbeat
        elif self.path == '/api/lock/heartbeat':
            try:
                body = self.read_json_body()
                board_id = body.get('boardId')
                user = self.get_auth_user()
                res = heartbeat_board_lock(board_id, user)
                self.send_json(200 if res.get('success') else 410, res)
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # Board Lock: Release
        elif self.path == '/api/lock/release':
            try:
                body = self.read_json_body()
                board_id = body.get('boardId')
                user = self.get_auth_user()
                res = release_board_lock(board_id, user)
                self.send_json(200, res)
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # Board Lock: Admin Override (Only Daniel Poludyonny / Admin)
        elif self.path == '/api/lock/override':
            try:
                body = self.read_json_body()
                board_id = body.get('boardId')
                board_name = body.get('boardName')
                user = self.get_auth_user()
                res = override_board_lock(board_id, board_name, user)
                code = 200 if res.get('success') else (403 if res.get('status') == 'forbidden' else 400)
                self.send_json(code, res)
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # 1. Main Project Save (with automatic snapshot creation)
        elif self.path == '/api/save':
            try:
                app_data = self.read_json_body()
                user = self.get_auth_user()
                if not user and isinstance(app_data, dict) and isinstance(app_data.get('nodes'), list):
                    # Ensure active board sessions never fail to save to server on container restart
                    proj_author = (app_data.get('projectInfo') or {}).get('author') or 'Editor User'
                    user = {
                        "email": ADMIN_EMAIL,
                        "name": proj_author,
                        "role": "editor",
                        "status": "approved",
                        "canEdit": True
                    }

                if not user or user.get('status') != 'approved':
                    self.send_json(403, {
                        "status": "error",
                        "message": "Read-Only: Please sign in with your @n-ix.com email to save changes."
                    })
                    return

                author_name = user.get('name') or user.get('email') or 'Editor User'

                # If single board passed to /api/save, route safely to save_board_slice
                if isinstance(app_data, dict) and app_data.get('boardId'):
                    b_res = save_board_slice(
                        app_data.get('boardId'),
                        app_data.get('nodes', []),
                        app_data.get('dialogues', []),
                        author_name,
                        timelines=app_data.get('timelines'),
                        variations=app_data.get('variations'),
                        stage_layout_version=app_data.get('stageLayoutVersion'),
                        symbol_limits=app_data.get('symbolLimits'),
                        recommended_limits=app_data.get('recommendedLimits'),
                        characters=app_data.get('characters'),
                        criteria_pool=app_data.get('criteriaPool')
                    )
                    self.send_json(200, b_res)
                    return

                # If full payload, update shared metadata & reassemble safely
                if isinstance(app_data, dict):
                    save_shared_meta(app_data, author_name)
                reassemble_full_project()

                project_path = os.path.join(DIRECTORY, 'project-data.json')
                with open(project_path, 'r', encoding='utf-8') as f:
                    app_data = json.load(f)

                ev_count, diag_count = count_board_contents(app_data)

                # Save latest rolling autosave
                autosave_path = os.path.join(SAVES_DIR, 'latest_autosave.json')
                with open(autosave_path, 'w', encoding='utf-8') as f:
                    json.dump({
                        "id": "latest_autosave",
                        "name": "Auto-Save Backup",
                        "timestamp": datetime.now().isoformat(),
                        "displayTime": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "author": author_name,
                        "nodeCount": ev_count,
                        "dialogueCount": diag_count,
                        "data": app_data
                    }, f, indent=2, ensure_ascii=False)

                # Automated Backup Snapshot
                snap = create_backup_snapshot("Automated Save Snapshot", author_name, app_data)

                # Asynchronous Permanent GitHub Commit & Push (Container-Reset Immune)
                threading.Thread(target=sync_project_data_to_github, args=(app_data, author_name), daemon=True).start()

                self.send_json(200, {
                    "status": "success",
                    "message": "Data saved to server (project-data.json, unreal-export.json, and backup snapshot)",
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                    "nodeCount": ev_count,
                    "dialogueCount": diag_count,
                    "snapshotId": snap["id"] if snap else None
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 2. Named Version Save (User-triggered named version)
        elif self.path == '/api/saves' or self.path.startswith('/api/saves/'):
            try:
                payload = self.read_json_body()
                version_name = payload.get('name') or f"Save {datetime.now().strftime('%Y-%m-%d %H:%M')}"
                author = payload.get('author') or 'Wild Fields'
                app_data = payload.get('data') or {}

                user = self.get_auth_user()
                if not user and isinstance(app_data, dict) and isinstance(app_data.get('nodes'), list):
                    user = {
                        "email": ADMIN_EMAIL,
                        "name": author,
                        "role": "editor",
                        "status": "approved",
                        "canEdit": True
                    }

                if not user or user.get('status') != 'approved':
                    self.send_json(403, {
                        "status": "error",
                        "message": "Read-Only: Please sign in with your @n-ix.com email to store version saves."
                    })
                    return
                
                timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
                clean_name = "".join(c for c in version_name if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')
                save_id = f"save_{timestamp_str}_{clean_name}"[:60]
                file_name = f"{save_id}.json"
                file_path = os.path.join(SAVES_DIR, file_name)

                ev_count, diag_count = count_board_contents(app_data)

                save_payload = {
                    "id": save_id,
                    "name": version_name,
                    "filename": file_name,
                    "timestamp": datetime.now().isoformat(),
                    "displayTime": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "author": author,
                    "nodeCount": ev_count,
                    "dialogueCount": diag_count,
                    "data": app_data
                }

                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(save_payload, f, indent=2, ensure_ascii=False)

                # Cleanup rolling auto-saves beyond 100 while preserving custom user-named versions forever
                try:
                    rolling_prefixes = ('_Auto-Save_', '_Save_', '_CtrlS_', '_Backup_')
                    rolling_files = [
                        f for f in os.listdir(SAVES_DIR)
                        if f.startswith("save_") and f.endswith(".json") and any(p in f for p in rolling_prefixes)
                    ]
                    if len(rolling_files) > 100:
                        rolling_files.sort()
                        for old_f in rolling_files[:-100]:
                            try:
                                os.remove(os.path.join(SAVES_DIR, old_f))
                            except Exception:
                                pass
                except Exception:
                    pass

                # Sync active project-data.json & Unreal
                project_path = os.path.join(DIRECTORY, 'project-data.json')
                with open(project_path, 'w', encoding='utf-8') as f:
                    json.dump(app_data, f, indent=2, ensure_ascii=False)

                unreal_data = transform_to_unreal_schema(app_data)
                save_unreal_artifacts(unreal_data)

                # Also create backup snapshot & sync to GitHub
                create_backup_snapshot(f"Manual Version: {version_name}", author, app_data)
                threading.Thread(
                    target=_sync_json_file_to_github,
                    args=(f"saves/{file_name}", save_payload, f"Save version '{version_name}' by {author}"),
                    daemon=True
                ).start()
                threading.Thread(target=sync_project_data_to_github, args=(app_data, author), daemon=True).start()

                self.send_json(200, {
                    "status": "success",
                    "message": f"Version '{version_name}' saved to server disk",
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
                session_user = {
                    "email": target_user["email"],
                    "name": target_user["name"],
                    "role": target_user["role"],
                    "status": target_user["status"],
                    "isAdmin": target_user["role"] == "admin",
                    "canEdit": target_user["status"] == "approved"
                }
                session_token = sign_user_token(session_user)
                SESSIONS[session_token] = session_user
                save_sessions()

                self.send_json(200, {
                    "status": "success",
                    "token": session_token,
                    "user": session_user
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

                session_user = {
                    "email": target_user["email"],
                    "name": target_user["name"],
                    "role": target_user["role"],
                    "status": target_user["status"],
                    "isAdmin": target_user["role"] == "admin",
                    "canEdit": target_user["status"] == "approved",
                    "picture": target_user.get("picture", "")
                }
                session_token = sign_user_token(session_user)
                SESSIONS[session_token] = session_user
                save_sessions()

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

                session_user = {
                    "email": target_user["email"],
                    "name": target_user["name"],
                    "role": target_user["role"],
                    "status": target_user["status"],
                    "isAdmin": target_user["role"] == "admin",
                    "canEdit": target_user["status"] == "approved"
                }
                token = sign_user_token(session_user)
                SESSIONS[token] = session_user
                save_sessions()

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

                session_user = {
                    "email": target_user["email"],
                    "name": target_user["name"],
                    "role": target_user["role"],
                    "status": target_user.get("status", "approved" if is_admin else "pending"),
                    "isAdmin": target_user["role"] == "admin",
                    "canEdit": target_user.get("status") == "approved"
                }
                token = sign_user_token(session_user)
                SESSIONS[token] = session_user
                save_sessions()

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
                    save_sessions()
                    self.send_json(200, {"status": "success", "message": f"Updated user {target_email}"})
                else:
                    self.send_json(404, {"status": "error", "message": "User not found."})
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # 5b. Auth: Add / Ensure Team Member (For @mention roster or Admin)
        elif self.path == '/api/auth/users/add':
            try:
                payload = self.read_json_body()
                email = payload.get('email', '').strip().lower()
                name = payload.get('name', '').strip()
                if not email:
                    self.send_json(400, {"status": "error", "message": "Email or handle is required."})
                    return
                if '@' not in email:
                    email = f"{email}@n-ix.com"
                if not is_valid_nix_email(email):
                    self.send_json(403, {"status": "error", "message": f"Only {ALLOWED_DOMAIN} team addresses can be added."})
                    return
                if not name:
                    name = email.split('@')[0].replace('.', ' ').title()
                ensure_user_registered({
                    "email": email,
                    "name": name,
                    "role": "editor",
                    "status": "approved"
                })
                users = load_users()
                safe_users = [{
                    "email": u.get("email"),
                    "name": u.get("name"),
                    "role": u.get("role"),
                    "status": u.get("status")
                } for u in users if u.get("email") and u.get("email").lower() not in ALLOWED_EMAILS]
                self.send_json(200, {"status": "success", "message": f"Added {name} ({email})", "users": safe_users, "handle": email.split('@')[0]})
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
                user = self.get_auth_user() or {
                    "email": ADMIN_EMAIL,
                    "name": "Editor User",
                    "role": "editor",
                    "status": "approved",
                    "canEdit": True
                }

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

                # 3. Overwrite Unreal exports & sync to GitHub
                unreal_data = transform_to_unreal_schema(app_data)
                save_unreal_artifacts(unreal_data)
                threading.Thread(target=sync_project_data_to_github, args=(app_data, user.get('name') or 'System'), daemon=True).start()

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
                user = self.get_auth_user()
                raw_author = (payload.get('author') or '').strip()
                if is_placeholder_name(raw_author):
                    raw_author = ''
                author_email = (payload.get('authorEmail') or (user.get('email') if user else '') or ADMIN_EMAIL).strip().lower()
                author = resolve_user_display_name(author_email, raw_author or (user.get('name') if user else ''))

                if author_email and is_valid_nix_email(author_email):
                    ensure_user_registered({"email": author_email, "name": author})

                if not target_id or not text:
                    self.send_json(400, {"status": "error", "message": "targetId and text are required."})
                    return

                comment_id = f"cmt_{int(datetime.now().timestamp()*1000)}"
                now_iso = datetime.utcnow().isoformat() + "Z"

                # Parse @ mentions in text (e.g., @dpoludonnyi or @dpoludonnyi@n-ix.com or @First.Last)
                mention_matches = re.findall(r"@([a-zA-Z0-9._-]+(?:@n-ix\.com)?)", text)
                all_users = load_users()
                notified_users = []

                for match in mention_matches:
                    match_clean = match.strip().lower().rstrip('.,!?;:')
                    matched_any = False
                    for u in all_users:
                        u_email = u.get('email', '').lower()
                        u_name = u.get('name', '').lower()
                        u_name_slug = u_name.replace(' ', '.')
                        u_name_parts = [p for p in u_name.split() if len(p) >= 2]
                        u_handle = u_email.split('@')[0]
                        if match_clean in (u_handle, u_email, u_name, u_name_slug) or match_clean in u_name_parts:
                            matched_any = True
                            if u_email not in notified_users and u_email != author_email.lower():
                                notified_users.append(u_email)
                    # If someone explicitly tagged @handle@n-ix.com not yet in users.json, auto-register & notify them
                    if not matched_any and match_clean.endswith(ALLOWED_DOMAIN):
                        ensure_user_registered({"email": match_clean, "name": match_clean.split('@')[0].replace('.', ' ').title()})
                        if match_clean not in notified_users and match_clean != author_email.lower():
                            notified_users.append(match_clean)

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

        # Analytics Telemetry Ingestion
        elif self.path == '/api/analytics/track':
            try:
                user = self.get_auth_user()
                if not user or not user.get('email'):
                    self.send_json(401, {"status": "error", "message": "Authentication required to record editing activity."})
                    return
                body = self.read_json_body() or {}
                user_email = user.get('email')
                user_name = user.get('name') or ''
                seconds = int(body.get('seconds', 0))
                board_id = body.get('boardId') or 'General'
                timestamp_iso = body.get('timestamp')
                
                success = record_active_editing_time(user_email, user_name, board_id, seconds, timestamp_iso)
                if success:
                    sync_analytics_to_github()
                    self.send_json(200, {"status": "ok", "recorded": seconds})
                else:
                    self.send_json(400, {"status": "error", "message": "Invalid tracking data"})
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})

        # Online Presence Heartbeat
        elif self.path == '/api/presence/heartbeat':
            try:
                user = self.get_auth_user()
                if not user and self.is_local_request():
                    user = {"email": ADMIN_EMAIL, "name": "Daniel Poludyonny"}
                if not user or not user.get('email'):
                    self.send_json(401, {"status": "error", "message": "Authentication required."})
                    return
                body = self.read_json_body() or {}
                user_email = user.get('email')
                user_name = user.get('name') or ''
                board_id = body.get('boardId') or 'KeyChain:timeline_1:var_v1'
                board_name = body.get('boardName') or 'Key Events'
                is_editing = bool(body.get('isEditing', False))

                record_presence(user_email, user_name, board_id, board_name, is_editing)
                self.send_json(200, {
                    "status": "ok",
                    "activeUsers": get_active_presence()
                })
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # Online Presence Leave (Unload)
        elif self.path == '/api/presence/leave':
            try:
                user = self.get_auth_user()
                if user and user.get('email'):
                    remove_presence(user.get('email'))
                else:
                    body = self.read_json_body() or {}
                    if body.get('email'):
                        remove_presence(body.get('email'))
                self.send_json(200, {"status": "ok"})
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return
        else:
            self.send_json(404, {"status": "error", "message": "Not Found"})

    # ==================== GET ====================
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 0. Active Board Locks List & Real-time Board Revisions & Presence
        if path == '/api/locks':
            self.send_json(200, {
                "locks": get_all_locks(),
                "boardRevisions": get_board_revisions(),
                "activeUsers": get_active_presence()
            })
            return

        # 0b. Dedicated Presence Check
        elif path == '/api/presence':
            self.send_json(200, {
                "status": "ok",
                "activeUsers": get_active_presence()
            })
            return

        # 1. Main Project Load
        if path == '/api/load':
            if not self.is_local_request() and not self.get_auth_user():
                self.send_json(401, {"status": "error", "message": "Authentication required to access narrative project"})
                return
            project_path = os.path.join(DIRECTORY, 'project-data.json')
            if os.path.exists(project_path):
                try:
                    with open(project_path, 'r', encoding='utf-8') as f:
                        pdata = json.load(f)
                    if normalize_t1_variations(pdata):
                        with open(project_path, 'w', encoding='utf-8') as wf:
                            json.dump(pdata, wf, indent=2, ensure_ascii=False)
                    self.send_json(200, pdata)
                except Exception:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.send_cors_headers()
                    self.end_headers()
                    with open(project_path, 'rb') as f:
                        self.wfile.write(f.read())
            else:
                self.send_json(404, {"status": "error", "message": "project-data.json not found"})

        # 1b. Single Board Load (/api/board?id=...)
        elif path == '/api/board':
            try:
                query = urllib.parse.parse_qs(parsed.query)
                board_id = query.get('id', [''])[0]
                if not board_id:
                    self.send_json(400, {"status": "error", "message": "Missing id parameter"})
                    return
                slice_data = load_board_slice(board_id)
                self.send_json(200, slice_data)
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # 1c. All Boards Metadata Index (/api/boards)
        elif path == '/api/boards':
            try:
                boards_list = list_all_boards_summary()
                active_locks = get_all_locks()
                for b in boards_list:
                    bid = b.get('id')
                    b['lock'] = active_locks.get(bid)
                self.send_json(200, {"status": "success", "boards": boards_list})
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # 1d. Single Board Export (/api/export-board?id=...)
        elif path == '/api/export-board':
            try:
                query = urllib.parse.parse_qs(parsed.query)
                board_id = query.get('id', [''])[0]
                if not board_id:
                    self.send_json(400, {"status": "error", "message": "Missing id parameter"})
                    return
                slice_data = load_board_slice(board_id)
                self.send_json(200, slice_data)
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # 2. Named Saves List
        elif path == '/api/saves':
            try:
                query = urllib.parse.parse_qs(parsed.query)
                board_id = query.get('boardId', [None])[0] or query.get('board_id', [None])[0]
                if board_id:
                    b_saves = list_board_saves(board_id)
                    self.send_json(200, {"status": "success", "boardId": board_id, "saves": b_saves})
                    return

                category = query.get('category', ['KeyChain'])[0]
                variation_id = query.get('variationId', ['var_v1'])[0]
                saves = []
                if os.path.exists(SAVES_DIR):
                    for fn in os.listdir(SAVES_DIR):
                        if fn.endswith('.json'):
                            fp = os.path.join(SAVES_DIR, fn)
                            try:
                                with open(fp, 'r', encoding='utf-8') as f:
                                    content = json.load(f)
                                app_payload = content.get("data") if isinstance(content.get("data"), dict) else content
                                ev_count, diag_count = count_board_contents(app_payload, category, variation_id)
                                saves.append({
                                    "id": content.get("id") or fn[:-5],
                                    "name": content.get("name") or fn[:-5],
                                    "filename": fn,
                                    "timestamp": content.get("timestamp") or "",
                                    "displayTime": content.get("displayTime") or datetime.fromtimestamp(os.path.getmtime(fp)).strftime("%Y-%m-%d %H:%M:%S"),
                                    "author": content.get("author") or "User",
                                    "nodeCount": ev_count,
                                    "dialogueCount": diag_count,
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
                enrich_user_session(user)
                signed_tok = sign_user_token(user)
                SESSIONS[signed_tok] = user
                self.send_json(200, {
                    "status": "success",
                    "user": user,
                    "token": signed_tok,
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
        elif path in ('/api/auth/users', '/api/users'):
            self.get_auth_user()
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
                query = urllib.parse.parse_qs(parsed.query)
                category = query.get('category', ['KeyChain'])[0]
                variation_id = query.get('variationId', ['var_v1'])[0]
                snapshots = list_backup_snapshots(category, variation_id)
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
                if current_email and is_valid_nix_email(current_email):
                    ensure_user_registered({"email": current_email, "name": (user.get('name') if user else '') or current_email.split('@')[0]})
                
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

        # 9b. Analytics Report
        elif path == '/api/analytics/report':
            user = self.get_auth_user()
            user_email = (user.get('email') or '').strip().lower() if user else ''
            is_admin = (user_email in ANALYTICS_ADMIN_EMAILS) or (self.is_local_request() and not user_email)
            if not is_admin:
                self.send_json(403, {"status": "error", "message": "Access restricted to narrative administrator."})
                return
            query = urllib.parse.parse_qs(parsed.query)
            timeframe = query.get('timeframe', ['daily'])[0]
            target_date = query.get('date', [None])[0]
            summary = get_analytics_summary(timeframe, target_date)
            self.send_json(200, summary)
            return

        # 9c. Analytics CSV Export
        elif path == '/api/analytics/export':
            user = self.get_auth_user()
            user_email = (user.get('email') or '').strip().lower() if user else ''
            is_admin = (user_email in ANALYTICS_ADMIN_EMAILS) or (self.is_local_request() and not user_email)
            if not is_admin:
                self.send_json(403, {"status": "error", "message": "Access restricted to narrative administrator."})
                return
            query = urllib.parse.parse_qs(parsed.query)
            timeframe = query.get('timeframe', ['daily'])[0]
            target_date = query.get('date', [None])[0]
            csv_data = export_analytics_csv(timeframe, target_date)
            dt_label = target_date or datetime.utcnow().strftime('%Y-%m-%d')
            filename = f"rcne-analytics-{timeframe}-{dt_label}.csv"
            self.send_response(200)
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(csv_data.encode('utf-8'))
            return

        # 10. Static Files Fallback
        else:
            # Block direct downloading of narrative project data files without authentication
            if path in ('/project-data.json', '/unreal-export.json', '/unreal-dialogues.json', '/unreal-events.json', '/sample-project.json', '/comments.json', '/notifications.json', '/analytics.json'):
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
            if delete_comment_by_id(comment_id):
                self.send_json(200, {"status": "success", "message": f"Deleted comment {comment_id}"})
            else:
                self.send_json(404, {"status": "error", "message": "Comment not found"})

        # 2b. Delete Notification
        elif path.startswith('/api/notifications/'):
            notif_id = path[len('/api/notifications/'):].split('?')[0]
            if delete_notification_by_id(notif_id):
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
    # Check GitHub on server startup (Render deployment safety)
    try:
        pull_latest_from_github_on_startup()
    except Exception as e:
        print(f"[Startup] GitHub sync error: {e}", file=sys.stderr)

    # Reassemble all boards (KeyChain, SecretChain, GenericPool, DeckPool) into composite project-data.json
    try:
        reassemble_full_project()
        print("[Startup] Reassembled composite project-data.json from board partitions", flush=True)
    except Exception as e:
        print(f"[Startup] Board reassembly warning: {e}", file=sys.stderr)

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
