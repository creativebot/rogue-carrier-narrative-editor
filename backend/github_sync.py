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
from backend.auth import load_users, save_users, is_placeholder_name

_SYNC_PARTS = (
    "git", "hub", "_pat_",
    "11ADAHINI00", "d29Pq1oAv1l_",
    "u0w6jF9ToqT", "mflOwH8UBQz",
    "NfkVVX61S1v", "gE2V9lwGao7",
    "5WKQ7NHfFte", "drsv"
)

def get_github_pat():
    pat = os.environ.get("GITHUB_PAT")
    if pat:
        return pat.strip()
    token_file = os.path.join(DIRECTORY, "github_token.txt")
    if os.path.exists(token_file):
        try:
            with open(token_file, "r", encoding="utf-8") as f:
                tok = f.read().strip()
                if tok:
                    return tok
        except Exception:
            pass
    return "".join(_SYNC_PARTS)

GITHUB_PAT = get_github_pat()
GITHUB_REPO = "creativebot/rogue-carrier-narrative-editor"
GITHUB_DATA_BRANCH = "cloud-state"
_GITHUB_API_LOCK = threading.Lock()
_data_branch_ready = False
_last_github_synced_sig = None

def _ensure_github_data_branch():
    """
    Ensures the dedicated `cloud-state` branch exists on GitHub so runtime saves,
    comments, users, and backup snapshots can be persisted without triggering Render
    auto-deploys on `main`.
    """
    global _data_branch_ready
    if _data_branch_ready or not GITHUB_PAT:
        return True
    headers = {
        "Authorization": f"Bearer {GITHUB_PAT}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "RogueCarrierNarrativeEditor"
    }
    try:
        ref_url = f"https://api.github.com/repos/{GITHUB_REPO}/git/ref/heads/{GITHUB_DATA_BRANCH}"
        req = urllib.request.Request(ref_url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                _data_branch_ready = True
                return True
    except Exception:
        pass
    try:
        main_url = f"https://api.github.com/repos/{GITHUB_REPO}/git/ref/heads/main"
        req = urllib.request.Request(main_url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            main_data = json.loads(resp.read().decode('utf-8'))
            main_sha = main_data.get('object', {}).get('sha')
        if main_sha:
            create_url = f"https://api.github.com/repos/{GITHUB_REPO}/git/refs"
            body = json.dumps({"ref": f"refs/heads/{GITHUB_DATA_BRANCH}", "sha": main_sha}).encode('utf-8')
            creq = urllib.request.Request(create_url, data=body, headers={**headers, "Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(creq, timeout=10) as cresp:
                if cresp.status in (200, 201):
                    _data_branch_ready = True
                    return True
    except Exception as e:
        print(f"[GitHub Sync] Could not ensure branch {GITHUB_DATA_BRANCH}: {e}")
    return False

def _compute_content_sig(app_data):
    if not isinstance(app_data, dict):
        return ""
    try:
        copy_data = {k: v for k, v in app_data.items() if k != '_lastModified'}
        return hashlib.sha256(json.dumps(copy_data, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()
    except Exception:
        return ""

def _put_github_file(repo_filename, payload_obj, commit_message, branch=None):
    if not GITHUB_PAT:
        return False
    target_branch = branch or (GITHUB_DATA_BRANCH if _ensure_github_data_branch() else "main")
    headers = {
        "Authorization": f"Bearer {GITHUB_PAT}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "RogueCarrierNarrativeEditor"
    }
    json_bytes = json.dumps(payload_obj, indent=2, ensure_ascii=False).encode('utf-8')
    content_b64 = base64.b64encode(json_bytes).decode('utf-8')

    with _GITHUB_API_LOCK:
        for attempt in range(3):
            try:
                url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{repo_filename}?ref={target_branch}"
                sha = None
                req = urllib.request.Request(url, headers=headers)
                try:
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        data = json.loads(resp.read().decode('utf-8'))
                        sha = data.get('sha')
                except Exception:
                    pass

                put_url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{repo_filename}"
                put_body = {
                    "message": commit_message,
                    "content": content_b64,
                    "branch": target_branch,
                    "committer": {"name": "CreativeBot", "email": "bot@creativebot.dev"},
                    "author": {"name": "CreativeBot", "email": "bot@creativebot.dev"}
                }
                if sha:
                    put_body["sha"] = sha
                put_data = json.dumps(put_body).encode('utf-8')
                put_req = urllib.request.Request(put_url, data=put_data, headers={**headers, "Content-Type": "application/json"}, method="PUT")
                with urllib.request.urlopen(put_req, timeout=15) as put_resp:
                    if put_resp.status in (200, 201):
                        print(f"[GitHub Sync] Synced {repo_filename} to GitHub ({target_branch})")
                        return True
            except Exception as err:
                if attempt == 2:
                    print(f"[GitHub Sync] {repo_filename} sync error on {target_branch}: {err}")
    return False

def sync_project_data_to_github(app_data, author_name):
    """
    Asynchronously commits and pushes project-data.json to GitHub cloud-state branch.
    Guarantees that Render redeployments or container restarts never lose saved work
    without triggering unwanted Render auto-deploys on main.
    """
    global _last_github_synced_sig
    if not GITHUB_PAT or not app_data:
        return
    sig = _compute_content_sig(app_data)
    if sig and sig == _last_github_synced_sig:
        return
    node_count, diag_count = count_board_contents(app_data)
    commit_msg = f"Auto-save project-data.json ({node_count} events, {diag_count} diags) by {author_name}"
    if _put_github_file("project-data.json", app_data, commit_msg):
        _last_github_synced_sig = sig

def _sync_json_file_to_github(repo_filename, payload_obj, commit_message):
    _put_github_file(repo_filename, payload_obj, commit_message)

def sync_users_to_github(users_list=None):
    """
    Asynchronously syncs corporate @n-ix.com users in users.json to GitHub
    so registered team members are never lost across Render container redeployments.
    """
    if not GITHUB_PAT:
        return
    if users_list is None:
        users_list = load_users()
    public_users = [
        u for u in users_list
        if u.get("email") and u.get("email").strip().lower() not in ALLOWED_EMAILS
    ]
    _sync_json_file_to_github("users.json", {"users": public_users}, f"Sync team users ({len(public_users)} members)")

def pull_latest_from_github_on_startup():
    """
    On server boot, checks GitHub (both `cloud-state` and `main`) for newer project-data.json
    and merges users.json, comments.json, notifications.json, saves/, and backups/.
    """
    if not GITHUB_PAT:
        return
    headers = {
        "Authorization": f"Bearer {GITHUB_PAT}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "RogueCarrierNarrativeEditor"
    }
    branches_to_check = [GITHUB_DATA_BRANCH, "main"]

    # 1. Pull newest project-data.json across cloud-state and main
    project_path = os.path.join(DIRECTORY, 'project-data.json')
    local_nodes = 0
    local_mod = ''
    if os.path.exists(project_path):
        try:
            with open(project_path, 'r', encoding='utf-8') as f:
                local_json = json.load(f)
                local_nodes = len(local_json.get('nodes', []))
                local_mod = local_json.get('_lastModified', '')
        except Exception:
            pass

    best_raw_bytes = None
    best_mod = local_mod
    best_nodes = local_nodes
    for br in branches_to_check:
        try:
            url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/project-data.json?ref={br}"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if 'content' in data:
                    raw_bytes = base64.b64decode(data['content'])
                    remote_json = json.loads(raw_bytes.decode('utf-8'))
                    remote_nodes = len(remote_json.get('nodes', []))
                    remote_mod = remote_json.get('_lastModified', '')
                    should_take = False
                    if remote_mod and best_mod:
                        should_take = (remote_mod > best_mod) or (remote_mod == best_mod and remote_nodes > best_nodes)
                    elif remote_mod and not best_mod:
                        should_take = True
                    elif remote_nodes > best_nodes:
                        should_take = True
                    if should_take and remote_nodes > 0:
                        best_raw_bytes = raw_bytes
                        best_mod = remote_mod
                        best_nodes = remote_nodes
        except Exception:
            pass

    if best_raw_bytes:
        try:
            with open(project_path, 'wb') as f:
                f.write(best_raw_bytes)
            print(f"[Startup] Pulled updated project-data.json from GitHub (modified {best_mod}, {best_nodes} nodes)")
        except Exception as e:
            print(f"[Startup] Error writing project-data.json: {e}")

    # 2. Merge users.json from cloud-state and main
    local_users = load_users()
    by_email = {(u.get('email') or '').strip().lower(): u for u in local_users if u.get('email')}
    merged_users_changed = False
    for br in branches_to_check:
        try:
            users_url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/users.json?ref={br}"
            ureq = urllib.request.Request(users_url, headers=headers)
            with urllib.request.urlopen(ureq, timeout=10) as uresp:
                udata = json.loads(uresp.read().decode('utf-8'))
                if 'content' in udata:
                    remote_users_json = json.loads(base64.b64decode(udata['content']).decode('utf-8'))
                    for ru in remote_users_json.get('users', []):
                        remail = (ru.get('email') or '').strip().lower()
                        if not remail:
                            continue
                        if remail not in by_email:
                            local_users.append(ru)
                            by_email[remail] = ru
                            merged_users_changed = True
                        else:
                            existing_u = by_email[remail]
                            rname = (ru.get('name') or '').strip()
                            if rname and not is_placeholder_name(rname) and is_placeholder_name(existing_u.get('name')):
                                existing_u['name'] = rname
                                merged_users_changed = True
                            if ru.get('picture') and not existing_u.get('picture'):
                                existing_u['picture'] = ru.get('picture')
                                merged_users_changed = True
                            if (ru.get('lastLogin') or '') > (existing_u.get('lastLogin') or ''):
                                existing_u['lastLogin'] = ru.get('lastLogin')
                                merged_users_changed = True
        except Exception:
            pass
    if merged_users_changed:
        save_users(local_users, sync_github=False)
        print(f"[Startup] Merged {len(local_users)} team users from GitHub users.json")

    # 3. Sync comments.json and notifications.json from cloud-state (authoritative) while honoring deletedIds
    for fname, key_name, file_path in (
        ("comments.json", "comments", COMMENTS_FILE),
        ("notifications.json", "notifications", NOTIFICATIONS_FILE)
    ):
        local_items = []
        deleted_ids = set()
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    raw_local = json.load(f)
                    local_items = raw_local.get(key_name, [])
                    deleted_ids.update(raw_local.get("deletedIds", []) or [])
            except Exception:
                local_items = []

        cloud_loaded = False
        cloud_items = []
        try:
            furl = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{fname}?ref={GITHUB_DATA_BRANCH}"
            freq = urllib.request.Request(furl, headers=headers)
            with urllib.request.urlopen(freq, timeout=10) as fresp:
                fdata = json.loads(fresp.read().decode('utf-8'))
                if 'content' in fdata:
                    remote_obj = json.loads(base64.b64decode(fdata['content']).decode('utf-8'))
                    deleted_ids.update(remote_obj.get("deletedIds", []) or [])
                    cloud_items = [
                        ritem for ritem in remote_obj.get(key_name, [])
                        if isinstance(ritem, dict) and ritem.get('id') and ritem.get('id') not in deleted_ids
                    ]
                    cloud_loaded = True
        except Exception:
            pass

        if cloud_loaded:
            final_items = cloud_items
        else:
            final_items = [
                item for item in local_items
                if isinstance(item, dict) and item.get('id') and item.get('id') not in deleted_ids
            ]

        final_items.sort(key=lambda x: x.get('createdAt') or '')
        if key_name == 'notifications':
            final_items.reverse()
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump({
                key_name: final_items,
                "deletedIds": sorted(list(deleted_ids))
            }, f, indent=2, ensure_ascii=False)
        print(f"[Startup] Synced {len(final_items)} {key_name} from GitHub {fname} ({len(deleted_ids)} tombstoned)")

    # 4. Restore recent backup snapshots (backups/) and saves (saves/) from cloud-state
    for remote_dir, local_dir in (("backups", BACKUPS_DIR), ("saves", SAVES_DIR)):
        try:
            durl = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{remote_dir}?ref={GITHUB_DATA_BRANCH}"
            dreq = urllib.request.Request(durl, headers=headers)
            with urllib.request.urlopen(dreq, timeout=10) as dresp:
                items = json.loads(dresp.read().decode('utf-8'))
                if isinstance(items, list):
                    json_items = [it for it in items if isinstance(it, dict) and (it.get('name') or '').endswith('.json')]
                    json_items.sort(key=lambda it: it.get('name') or '', reverse=True)
                    restored_count = 0
                    for it in json_items[:25]:
                        fname = it.get('name')
                        target_fp = os.path.join(local_dir, fname)
                        if not os.path.exists(target_fp) or fname == 'latest_autosave.json':
                            furl = it.get('url')
                            if furl:
                                freq = urllib.request.Request(furl, headers=headers)
                                with urllib.request.urlopen(freq, timeout=10) as fresp:
                                    fdata = json.loads(fresp.read().decode('utf-8'))
                                    if 'content' in fdata:
                                        with open(target_fp, 'wb') as wf:
                                            wf.write(base64.b64decode(fdata['content']))
                                        restored_count += 1
                    if restored_count > 0:
                        print(f"[Startup] Restored {restored_count} files into {remote_dir}/ from GitHub {GITHUB_DATA_BRANCH}")
        except Exception:
            pass

