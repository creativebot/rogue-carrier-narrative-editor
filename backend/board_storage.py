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

DEFAULT_SYMBOL_LIMITS = {
    "eventIntro": 475,
    "eventDescription": 475,
    "actionDescription": 120,
    "actionDescription3Opt": 200,
    "actionButtonText": 24,
    "eventOutcome": 925,
    "inactionResult": 475,
    "variationDescription": 280
}

DEFAULT_RECOMMENDED_LIMITS = {
    "eventIntro": 120,
    "eventDescription": 180,
    "actionDescription": 40,
    "actionDescription3Opt": 60,
    "actionButtonText": 8,
    "eventOutcome": 200,
    "inactionResult": 120,
    "variationDescription": 80
}

def load_shared_meta():
    if os.path.exists(SHARED_META_FILE):
        try:
            with open(SHARED_META_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if not data.get("symbolLimits"):
                    data["symbolLimits"] = DEFAULT_SYMBOL_LIMITS.copy()
                if not data.get("recommendedLimits"):
                    data["recommendedLimits"] = DEFAULT_RECOMMENDED_LIMITS.copy()
                return data
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
                    "criteriaPool": pj.get("criteriaPool", []),
                    "symbolLimits": pj.get("symbolLimits") or DEFAULT_SYMBOL_LIMITS.copy(),
                    "recommendedLimits": pj.get("recommendedLimits") or DEFAULT_RECOMMENDED_LIMITS.copy()
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
        "criteriaPool": [],
        "symbolLimits": DEFAULT_SYMBOL_LIMITS.copy(),
        "recommendedLimits": DEFAULT_RECOMMENDED_LIMITS.copy()
    }

def save_shared_meta(meta_dict, author_name=None):
    with _STORAGE_LOCK:
        current_meta = load_shared_meta()
        for k in ("timelines", "variations", "characters", "criteriaPool", "stageLayoutVersion", "projectInfo", "symbolLimits", "recommendedLimits"):
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
                        with open(fp, 'r', encoding='utf-8-sig') as f:
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

        # Safety safeguard: if project-data.json already exists and has valid nodes not in seen_node_ids, preserve them
        if os.path.exists(PROJECT_FILE):
            try:
                with open(PROJECT_FILE, 'r', encoding='utf-8') as pf:
                    existing_proj = json.load(pf)
                    missing_nodes = []
                    for n in existing_proj.get('nodes', []):
                        if n and n.get('id') and n['id'] not in seen_node_ids:
                            all_nodes.append(n)
                            seen_node_ids.add(n['id'])
                            missing_nodes.append(n)
                    for d in existing_proj.get('dialogues', []):
                        if d and d.get('id') and d['id'] not in seen_diag_ids:
                            all_dialogues.append(d)
                            seen_diag_ids.add(d['id'])

                    # If any missing nodes were found, partition them into their board files
                    if missing_nodes:
                        for mn in missing_nodes:
                            cat = mn.get('category') or 'KeyChain'
                            var_id = mn.get('variationId') or 'var_v1'
                            tl_id = mn.get('timelineId') or 'timeline_1'
                            if cat == 'GenericPool':
                                b_fn = 'GenericPool.json'
                            elif cat == 'DeckPool':
                                b_fn = 'DeckPool.json'
                            elif cat == 'SpeciesPool':
                                b_fn = 'SpeciesPool.json'
                            elif cat == 'SecretChain':
                                b_fn = f"SecretChain__{tl_id}__{var_id}.json"
                            else:
                                b_fn = f"KeyChain__{tl_id}__{var_id}.json"
                            
                            b_fp = os.path.join(BOARDS_DIR, b_fn)
                            b_nodes = []
                            b_diags = []
                            if os.path.exists(b_fp):
                                try:
                                    with open(b_fp, 'r', encoding='utf-8-sig') as bf:
                                        b_json = json.load(bf)
                                        b_nodes = b_json.get('nodes', [])
                                        b_diags = b_json.get('dialogues', [])
                                except Exception:
                                    pass
                            if not any(bn.get('id') == mn['id'] for bn in b_nodes):
                                b_nodes.append(mn)
                                with open(b_fp, 'w', encoding='utf-8') as bf:
                                    json.dump({
                                        "status": "success",
                                        "boardId": b_fn.replace('.json', '').replace('__', ':'),
                                        "nodes": b_nodes,
                                        "dialogues": b_diags,
                                        "_lastModified": datetime.now().isoformat()
                                    }, bf, indent=2, ensure_ascii=False)
            except Exception as e:
                print(f"[BoardStorage] Error checking existing project file: {e}")

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
            "symbolLimits": meta.get("symbolLimits") or DEFAULT_SYMBOL_LIMITS.copy(),
            "recommendedLimits": meta.get("recommendedLimits") or DEFAULT_RECOMMENDED_LIMITS.copy(),
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
            with open(fp, 'r', encoding='utf-8-sig') as f:
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


def merge_nodes_losslessly(existing_nodes, incoming_nodes):
    """
    Comprehensive non-destructive merge:
    Protects all narrative text, action options, choices, requirements,
    rewards, inaction threats, penalties, and node metadata from being
    accidentally wiped by partial, blanked, or stale incoming saves.
    """
    if not existing_nodes:
        return incoming_nodes or []
    if not incoming_nodes:
        return existing_nodes

    ex_map = {n.get('id'): n for n in existing_nodes if isinstance(n, dict) and n.get('id')}
    merged_list = []

    for in_node in incoming_nodes:
        if not isinstance(in_node, dict) or not in_node.get('id'):
            merged_list.append(in_node)
            continue

        ex_node = ex_map.get(in_node['id'])
        if not ex_node:
            merged_list.append(in_node)
            continue

        merged = dict(ex_node)

        for k, v in in_node.items():
            if k in ('actions', 'inactionThreat'):
                continue
            elif k in ('eventDescription', 'eventIntro', 'description', 'location', 'spawnConditions'):
                if str(v or '').strip() or not str(ex_node.get(k) or '').strip():
                    merged[k] = v
            else:
                merged[k] = v

        in_acts = in_node.get('actions')
        ex_acts = ex_node.get('actions')
        if isinstance(in_acts, list) and isinstance(ex_acts, list):
            merged_acts = []
            for idx, in_act in enumerate(in_acts):
                ex_act = next((a for a in ex_acts if a.get('id') == in_act.get('id')), None)
                if not ex_act and idx < len(ex_acts):
                    ex_act = ex_acts[idx]
                if ex_act:
                    m_act = dict(ex_act)
                    for ak, av in in_act.items():
                        if ak == 'rewards' and (not av or len(av) == 0) and ex_act.get('rewards') and len(ex_act['rewards']) > 0:
                            continue
                        if ak == 'requirements' and (not av or len(av) == 0) and ex_act.get('requirements') and len(ex_act['requirements']) > 0:
                            continue
                        if ak in ('description', 'resultDescription', 'shortDescription') and not str(av or '').strip() and str(ex_act.get(ak) or '').strip():
                            continue
                        m_act[ak] = av
                    merged_acts.append(m_act)
                else:
                    merged_acts.append(in_act)
            merged['actions'] = merged_acts
        elif in_acts is not None:
            merged['actions'] = in_acts

        in_threat = in_node.get('inactionThreat')
        ex_threat = ex_node.get('inactionThreat')
        if isinstance(in_threat, dict) and isinstance(ex_threat, dict):
            m_threat = dict(ex_threat)
            for tk, tv in in_threat.items():
                if tk == 'penalties' and (not tv or len(tv) == 0) and ex_threat.get('penalties') and len(ex_threat['penalties']) > 0:
                    continue
                if tk in ('description', 'consequenceText') and not str(tv or '').strip() and str(ex_threat.get(tk) or '').strip():
                    continue
                m_threat[tk] = tv
            merged['inactionThreat'] = m_threat
        elif in_threat is not None:
            merged['inactionThreat'] = in_threat

        merged_list.append(merged)

    return merged_list

def save_board_slice(board_id, nodes, dialogues, author_name, timelines=None, variations=None, stage_layout_version=None, save_name=None, symbol_limits=None, recommended_limits=None, characters=None, criteria_pool=None):
    """
    Atomically saves a single board to boards/<sanitized_board_id>.json,
    creates a per-board version snapshot in saves/boards/<board_id>/,
    and updates the composite project-data.json.
    """
    now = datetime.now()
    now_iso = now.isoformat()
    time_str = now.strftime("%H:%M:%S")

    # Guard against saving boards for timelines that have been deleted
    meta = load_shared_meta()
    existing_tl_ids = {t.get('id') for t in meta.get('timelines', [])}
    sanitized_id = sanitize_board_id(board_id)
    for part in sanitized_id.split('__'):
        if part.startswith('timeline_') and part not in existing_tl_ids:
            return {
                "status": "ignored",
                "message": f"Timeline {part} is deleted. Board save ignored."
            }

    # Update shared metadata if passed
    meta_updates = {}
    if stage_layout_version is not None:
        meta_updates["stageLayoutVersion"] = stage_layout_version
    if symbol_limits is not None and isinstance(symbol_limits, dict):
        meta_updates["symbolLimits"] = symbol_limits
    if recommended_limits is not None and isinstance(recommended_limits, dict):
        meta_updates["recommendedLimits"] = recommended_limits
    if characters is not None and isinstance(characters, list):
        meta_updates["characters"] = characters
    if criteria_pool is not None and isinstance(criteria_pool, list):
        meta_updates["criteriaPool"] = criteria_pool
    if meta_updates:
        save_shared_meta(meta_updates, author_name)
        meta = load_shared_meta()

    fp = get_board_file_path(board_id)
    final_nodes = nodes or []
    if os.path.exists(fp):
        try:
            with open(fp, 'r', encoding='utf-8-sig') as f:
                existing_slice = json.load(f)
                ex_nodes = existing_slice.get('nodes', [])
                if ex_nodes:
                    final_nodes = merge_nodes_losslessly(ex_nodes, nodes or [])
        except Exception:
            pass
    board_payload = {
        "boardId": board_id,
        "nodes": final_nodes,
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

    displayName = (save_name.strip() if save_name and str(save_name).strip() else f"Board Save ({time_str})")
    save_item = {
        "id": save_id,
        "boardId": board_id,
        "name": displayName,
        "filename": save_filename,
        "timestamp": now_iso,
        "displayTime": now.strftime("%Y-%m-%d %H:%M:%S"),
        "author": author_name or "Editor User",
        "nodeCount": len(nodes or []),
        "dialogueCount": len(dialogues or []),
        "nodes": nodes or [],
        "dialogues": dialogues or [],
        "symbolLimits": meta.get("symbolLimits") or DEFAULT_SYMBOL_LIMITS.copy(),
        "recommendedLimits": meta.get("recommendedLimits") or DEFAULT_RECOMMENDED_LIMITS.copy()
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

    # 5. Automated Backup Snapshot & Cloud Sync
    try:
        create_backup_snapshot(f"Board Save ({board_id}): {displayName}", author_name, full_project)
    except Exception as se:
        print(f"[BoardStorage] Error creating backup snapshot: {se}")

    try:
        from backend.github_sync import _sync_json_file_to_github
        threading.Thread(target=_sync_json_file_to_github, args=(f"saves/boards/{sanitized_id}/{save_filename}", save_item, f"Board save {save_id} by {author_name}"), daemon=True).start()
    except Exception as ge:
        pass

    # 6. Async GitHub Sync
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
                    with open(fp, 'r', encoding='utf-8-sig') as f:
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

    with open(fp, 'r', encoding='utf-8-sig') as f:
        save_data = json.load(f)

    nodes = save_data.get("nodes", [])
    dialogues = save_data.get("dialogues", [])

    result = save_board_slice(board_id, nodes, dialogues, author_name)
    result["restoredSaveId"] = save_id
    result["nodes"] = nodes
    result["dialogues"] = dialogues
    return result

def list_all_boards_summary():
    """
    Returns a unified summary of all existing boards in the project:
    Timeline Key/Secret boards, GenericPool, DeckPool.
    """
    meta = load_shared_meta()
    timelines = meta.get("timelines", [])
    variations = meta.get("variations", [])
    boards = []

    # 1. Timeline Variations (KeyChain & SecretChain)
    for tl in sorted(timelines, key=lambda t: int(t.get('number') or 1)):
        tl_id = tl.get("id")
        tl_num = tl.get("number", 1)
        tl_name = tl.get("name", f"Timeline {tl_num}")
        tl_vars = [v for v in variations if v.get("timelineId") == tl_id]
        if not tl_vars:
            tl_vars = [{"id": "var_v1", "number": 1, "name": "Main Flow", "timelineId": tl_id}]

        for var in sorted(tl_vars, key=lambda v: int(v.get('number') or 1)):
            var_id = var.get("id")
            var_num = var.get("number", 1)
            var_name = var.get("name", f"Variation {var_num}")

            # KeyChain board
            kc_id = f"KeyChain:{tl_id}:{var_id}"
            kc_slice = load_board_slice(kc_id)
            boards.append({
                "id": kc_id,
                "name": f"T{tl_num} V{var_num}: {tl_name} — Key Events",
                "shortName": f"T{tl_num}-V{var_num} Key Events",
                "category": "KeyChain",
                "timelineId": tl_id,
                "timelineNumber": tl_num,
                "timelineName": tl_name,
                "variationId": var_id,
                "variationNumber": var_num,
                "variationName": var_name,
                "nodeCount": len(kc_slice.get("nodes", [])),
                "dialogueCount": len(kc_slice.get("dialogues", [])),
                "lastModified": kc_slice.get("_lastModified", "")
            })

            # SecretChain board
            sc_id = f"SecretChain:{tl_id}:{var_id}"
            sc_slice = load_board_slice(sc_id)
            boards.append({
                "id": sc_id,
                "name": f"T{tl_num} V{var_num}: {tl_name} — Secret Events",
                "shortName": f"T{tl_num}-V{var_num} Secret Events",
                "category": "SecretChain",
                "timelineId": tl_id,
                "timelineNumber": tl_num,
                "timelineName": tl_name,
                "variationId": var_id,
                "variationNumber": var_num,
                "variationName": var_name,
                "nodeCount": len(sc_slice.get("nodes", [])),
                "dialogueCount": len(sc_slice.get("dialogues", [])),
                "lastModified": sc_slice.get("_lastModified", "")
            })

    # 2. Standalone Pools
    gen_slice = load_board_slice("GenericPool")
    boards.append({
        "id": "GenericPool",
        "name": "Generic Pool (World Events)",
        "shortName": "Generic Pool",
        "category": "GenericPool",
        "timelineId": None,
        "timelineNumber": None,
        "timelineName": None,
        "variationId": None,
        "variationNumber": None,
        "variationName": None,
        "nodeCount": len(gen_slice.get("nodes", [])),
        "dialogueCount": len(gen_slice.get("dialogues", [])),
        "lastModified": gen_slice.get("_lastModified", "")
    })

    deck_slice = load_board_slice("DeckPool")
    boards.append({
        "id": "DeckPool",
        "name": "Deck Pool (Carrier Events)",
        "shortName": "Deck Pool",
        "category": "DeckPool",
        "timelineId": None,
        "timelineNumber": None,
        "timelineName": None,
        "variationId": None,
        "variationNumber": None,
        "variationName": None,
        "nodeCount": len(deck_slice.get("nodes", [])),
        "dialogueCount": len(deck_slice.get("dialogues", [])),
        "lastModified": deck_slice.get("_lastModified", "")
    })

    species_slice = load_board_slice("SpeciesPool")
    boards.append({
        "id": "SpeciesPool",
        "name": "Species Events (Species Pool)",
        "shortName": "Species Events",
        "category": "SpeciesPool",
        "timelineId": None,
        "timelineNumber": None,
        "timelineName": None,
        "variationId": None,
        "variationNumber": None,
        "variationName": None,
        "nodeCount": len(species_slice.get("nodes", [])),
        "dialogueCount": len(species_slice.get("dialogues", [])),
        "lastModified": species_slice.get("_lastModified", "")
    })

    return boards

def import_board_payload(board_id, nodes, dialogues, author_name, import_note=None):
    """
    Imports nodes and dialogues directly into board_id.
    Automatically creates a safety backup snapshot of the existing board state first.
    """
    existing_slice = load_board_slice(board_id)
    if existing_slice.get("status") == "success" and (existing_slice.get("nodes") or existing_slice.get("dialogues")):
        now = datetime.now()
        b_saves_dir = get_board_saves_dir(board_id)
        backup_id = f"save_{now.strftime('%Y%m%d_%H%M%S')}_pre_import"
        backup_item = {
            "id": backup_id,
            "boardId": board_id,
            "name": f"Pre-Import Safety Snapshot ({now.strftime('%H:%M:%S')})",
            "filename": f"{backup_id}.json",
            "timestamp": now.isoformat(),
            "displayTime": now.strftime("%Y-%m-%d %H:%M:%S"),
            "author": author_name or "System",
            "nodeCount": len(existing_slice.get("nodes", [])),
            "dialogueCount": len(existing_slice.get("dialogues", [])),
            "nodes": existing_slice.get("nodes", []),
            "dialogues": existing_slice.get("dialogues", [])
        }
        try:
            with open(os.path.join(b_saves_dir, f"{backup_id}.json"), 'w', encoding='utf-8') as f:
                json.dump(backup_item, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[BoardStorage] Pre-import snapshot warning: {e}")

    note = import_note or f"Imported from JSON ({datetime.now().strftime('%H:%M:%S')})"
    return save_board_slice(board_id, nodes, dialogues, author_name, save_name=note)

