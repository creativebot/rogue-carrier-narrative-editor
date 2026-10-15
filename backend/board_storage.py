import os
import json
import threading
from datetime import datetime
from backend.config import DIRECTORY, SAVES_DIR, BACKUPS_DIR
from backend.unreal_export import transform_to_unreal_schema, save_unreal_artifacts, count_board_contents
from backend.github_sync import sync_project_data_to_github, sync_board_to_github
from backend.storage import create_backup_snapshot

BOARDS_DIR = os.path.join(DIRECTORY, 'boards')
BOARD_SAVES_DIR = os.path.join(SAVES_DIR, 'boards')
SHARED_META_FILE = os.path.join(DIRECTORY, 'shared_meta.json')
PROJECT_FILE = os.path.join(DIRECTORY, 'project-data.json')

_STORAGE_LOCK = threading.Lock()
BOARD_REVISIONS = {}

os.makedirs(BOARDS_DIR, exist_ok=True)
os.makedirs(BOARD_SAVES_DIR, exist_ok=True)

def sanitize_board_id(board_id):
    if not board_id:
        return 'KeyChain__timeline_1__var_v1'
    return str(board_id).replace(':', '__').replace('/', '__').replace('\\', '__')

def get_board_file_path(board_id):
    filename = f"{sanitize_board_id(board_id)}.json"
    return os.path.join(BOARDS_DIR, filename)

def get_board_saves_dir(board_id):
    bdir = os.path.join(BOARD_SAVES_DIR, sanitize_board_id(board_id))
    os.makedirs(bdir, exist_ok=True)
    return bdir

def load_shared_meta():
    if os.path.exists(SHARED_META_FILE):
        try:
            with open(SHARED_META_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[BoardStorage] Error reading {SHARED_META_FILE}: {e}")
    # Fallback to defaults or project-data.json
    if os.path.exists(PROJECT_FILE):
        try:
            with open(PROJECT_FILE, 'r', encoding='utf-8') as f:
                pj = json.load(f)
                return {
                    "version": pj.get("version", "2.9.2"),
                    "schemaVersion": pj.get("schemaVersion", 2),
                    "stageLayoutVersion": pj.get("stageLayoutVersion", 2),
                    "_lastModified": pj.get("_lastModified"),
                    "projectInfo": pj.get("projectInfo", {}),
                    "timelines": pj.get("timelines", []),
                    "variations": pj.get("variations", []),
                    "characters": pj.get("characters", []),
                    "criteriaPool": pj.get("criteriaPool", [])
                }
        except Exception:
            pass
    return {
        "version": "2.9.2",
        "schemaVersion": 2,
        "stageLayoutVersion": 2,
        "_lastModified": datetime.now().isoformat(),
        "projectInfo": {"name": "Rogue Carrier Narrative Project", "author": "Wild Fields"},
        "timelines": [],
        "variations": [],
        "characters": [],
        "criteriaPool": []
    }

def save_shared_meta(meta_dict, author_name=None):
    with _STORAGE_LOCK:
        current_meta = load_shared_meta()
        for k in ("timelines", "variations", "characters", "criteriaPool", "stageLayoutVersion", "projectInfo"):
            if k in meta_dict and meta_dict[k] is not None:
                current_meta[k] = meta_dict[k]
        current_meta["_lastModified"] = datetime.now().isoformat()
        if author_name and current_meta.get("projectInfo"):
            current_meta["projectInfo"]["author"] = author_name

        temp_path = SHARED_META_FILE + ".tmp"
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(current_meta, f, indent=2, ensure_ascii=False)
        os.replace(temp_path, SHARED_META_FILE)

def reassemble_full_project():
    """
    Combines shared_meta.json with all boards/*.json files into a unified project dictionary.
    Atomically writes project-data.json and exports Unreal schema.
    """
    with _STORAGE_LOCK:
        meta = load_shared_meta()
        all_nodes = []
        all_dialogues = []

        seen_node_ids = set()
        seen_diag_ids = set()

        if os.path.exists(BOARDS_DIR):
            for fn in sorted(os.listdir(BOARDS_DIR)):
                if fn.endswith('.json'):
                    fp = os.path.join(BOARDS_DIR, fn)
                    try:
                        with open(fp, 'r', encoding='utf-8') as f:
                            b_data = json.load(f)
                            for n in b_data.get('nodes', []):
                                if n and n.get('id') and n['id'] not in seen_node_ids:
                                    all_nodes.append(n)
                                    seen_node_ids.add(n['id'])
                            for d in b_data.get('dialogues', []):
                                if d and d.get('id') and d['id'] not in seen_diag_ids:
                                    all_dialogues.append(d)
                                    seen_diag_ids.add(d['id'])
                    except Exception as e:
                        print(f"[BoardStorage] Error reading board file {fn}: {e}")

        full_project = {
            "version": meta.get("version", "2.9.2"),
            "schemaVersion": meta.get("schemaVersion", 2),
            "stageLayoutVersion": meta.get("stageLayoutVersion", 2),
            "_lastModified": datetime.now().isoformat(),
            "projectInfo": meta.get("projectInfo", {}),
            "timelines": meta.get("timelines", []),
            "variations": meta.get("variations", []),
            "characters": meta.get("characters", []),
            "criteriaPool": meta.get("criteriaPool", []),
            "nodes": all_nodes,
            "dialogues": all_dialogues
        }

        # Write project-data.json atomically
        temp_path = PROJECT_FILE + ".tmp"
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(full_project, f, indent=2, ensure_ascii=False)
        os.replace(temp_path, PROJECT_FILE)

        # Unreal Engine DataTable export
        try:
            unreal_data = transform_to_unreal_schema(full_project)
            save_unreal_artifacts(unreal_data)
        except Exception as e:
            print(f"[BoardStorage] Unreal export error: {e}")

        return full_project

def load_board_slice(board_id):
    """
    Returns the isolated slice for a specific board { boardId, nodes, dialogues, _lastModified }.
    """
    fp = get_board_file_path(board_id)
    if os.path.exists(fp):
        try:
            with open(fp, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return {
                    "status": "success",
                    "boardId": board_id,
                    "nodes": data.get("nodes", []),
                    "dialogues": data.get("dialogues", []),
                    "_lastModified": data.get("_lastModified", "")
                }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # Board file does not exist yet (empty board)
    return {
        "status": "success",
        "boardId": board_id,
        "nodes": [],
        "dialogues": [],
        "_lastModified": datetime.now().isoformat()
    }

def save_board_slice(board_id, nodes, dialogues, author_name, timelines=None, variations=None, stage_layout_version=None):
    """
    Atomically saves a single board to boards/<sanitized_board_id>.json,
    creates a per-board version snapshot in saves/boards/<board_id>/,
    and updates the composite project-data.json.
    """
    now = datetime.now()
    now_iso = now.isoformat()
    time_str = now.strftime("%H:%M:%S")

    # Update shared meta if timelines/variations passed
    if timelines is not None or variations is not None or stage_layout_version is not None:
        meta_updates = {}
        if timelines is not None: meta_updates["timelines"] = timelines
        if variations is not None: meta_updates["variations"] = variations
        if stage_layout_version is not None: meta_updates["stageLayoutVersion"] = stage_layout_version
        save_shared_meta(meta_updates, author_name)

    fp = get_board_file_path(board_id)
    board_payload = {
        "boardId": board_id,
        "nodes": nodes or [],
        "dialogues": dialogues or [],
        "author": author_name or "Editor User",
        "_lastModified": now_iso
    }

    with _STORAGE_LOCK:
        # 1. Atomically write board file
        temp_path = fp + ".tmp"
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(board_payload, f, indent=2, ensure_ascii=False)
        os.replace(temp_path, fp)

        # 2. Record revision in memory
        curr_ver = (BOARD_REVISIONS.get(board_id, {}).get("version") or 0) + 1
        rev = {
            "boardId": board_id,
            "lastModified": now_iso,
            "timestamp": time_str,
            "author": author_name,
            "version": curr_ver
        }
        BOARD_REVISIONS[board_id] = rev

    # 3. Create per-board snapshot in saves/boards/<board_id>/
    b_saves_dir = get_board_saves_dir(board_id)
    timestamp_str = now.strftime('%Y%m%d_%H%M%S')
    save_id = f"save_{timestamp_str}_{curr_ver}"
    save_filename = f"{save_id}.json"
    save_filepath = os.path.join(b_saves_dir, save_filename)

    save_item = {
        "id": save_id,
        "boardId": board_id,
        "name": f"Board Save ({time_str})",
        "filename": save_filename,
        "timestamp": now_iso,
        "displayTime": now.strftime("%Y-%m-%d %H:%M:%S"),
        "author": author_name or "Editor User",
        "nodeCount": len(nodes or []),
        "dialogueCount": len(dialogues or []),
        "nodes": nodes or [],
        "dialogues": dialogues or []
    }

    try:
        with open(save_filepath, 'w', encoding='utf-8') as f:
            json.dump(save_item, f, indent=2, ensure_ascii=False)
        
        # Cleanup old board saves beyond 50
        existing_saves = [f for f in os.listdir(b_saves_dir) if f.startswith("save_") and f.endswith(".json")]
        if len(existing_saves) > 50:
            existing_saves.sort()
            for old_f in existing_saves[:-50]:
                try: os.remove(os.path.join(b_saves_dir, old_f))
                except Exception: pass
    except Exception as e:
        print(f"[BoardStorage] Error writing board save snapshot: {e}")

    # 4. Reassemble composite project-data.json
    full_project = reassemble_full_project()

    # 5. Async GitHub Sync
    threading.Thread(target=sync_project_data_to_github, args=(full_project, author_name), daemon=True).start()
    threading.Thread(target=sync_board_to_github, args=(board_id, board_payload, author_name), daemon=True).start()

    return {
        "status": "success",
        "timestamp": time_str,
        "boardId": board_id,
        "revision": rev,
        "totalNodeCount": len(full_project.get("nodes", [])),
        "totalDialogueCount": len(full_project.get("dialogues", [])),
        "boardNodeCount": len(nodes or []),
        "boardDialogueCount": len(dialogues or []),
        "saveId": save_id
    }

def list_board_saves(board_id):
    """
    Returns list of saved historical versions for this specific board.
    """
    b_saves_dir = get_board_saves_dir(board_id)
    saves = []
    if os.path.exists(b_saves_dir):
        for fn in sorted(os.listdir(b_saves_dir), reverse=True):
            if fn.endswith('.json'):
                fp = os.path.join(b_saves_dir, fn)
                try:
                    with open(fp, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        saves.append({
                            "id": data.get("id"),
                            "boardId": data.get("boardId", board_id),
                            "name": data.get("name", "Board Save"),
                            "filename": fn,
                            "timestamp": data.get("timestamp"),
                            "displayTime": data.get("displayTime"),
                            "author": data.get("author", "Editor User"),
                            "nodeCount": data.get("nodeCount", 0),
                            "dialogueCount": data.get("dialogueCount", 0)
                        })
                except Exception:
                    pass
    return saves

def restore_board_save(board_id, save_id, author_name):
    """
    Restores an isolated board from its save file without altering any other board.
    """
    b_saves_dir = get_board_saves_dir(board_id)
    filename = f"{save_id}.json" if not save_id.endswith('.json') else save_id
    fp = os.path.join(b_saves_dir, filename)

    if not os.path.exists(fp):
        return {"status": "error", "message": f"Save file {save_id} not found for board {board_id}"}

    with open(fp, 'r', encoding='utf-8') as f:
        save_data = json.load(f)

    nodes = save_data.get("nodes", [])
    dialogues = save_data.get("dialogues", [])

    result = save_board_slice(board_id, nodes, dialogues, author_name)
    result["restoredSaveId"] = save_id
    result["nodes"] = nodes
    result["dialogues"] = dialogues
    return result
