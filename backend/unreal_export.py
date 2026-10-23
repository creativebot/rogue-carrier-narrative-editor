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

def count_board_contents(app_data, category='KeyChain', variation_id='var_v1'):
    """
    Counts unique Event Blocks and Dialogue Blocks on the active board
    (defaulting to KeyChain + var_v1), matching the editor footer logic
    and excluding hidden template categories (SecretChain, GenericPool, DeckPool).
    """
    if not isinstance(app_data, dict):
        return 0, 0
    nodes = app_data.get('nodes') or []
    dialogues = app_data.get('dialogues') or []
    is_pool_page = category in ('GenericPool', 'DeckPool', 'SpeciesPool')

    seen_node_ids = set()
    for n in nodes:
        if not isinstance(n, dict):
            continue
        nid = n.get('id')
        if not nid or nid in seen_node_ids:
            continue
        cat = n.get('category') or 'KeyChain'
        if cat != category:
            continue
        var_id = n.get('variationId')
        if not is_pool_page and var_id and var_id != variation_id:
            continue
        seen_node_ids.add(nid)

    seen_diag_ids = set()
    for d in dialogues:
        if not isinstance(d, dict):
            continue
        did = d.get('id')
        if not did or did in seen_diag_ids:
            continue
        links = []
        if isinstance(d.get('links'), list) and len(d.get('links')) > 0:
            for l in d.get('links'):
                if isinstance(l, dict) and l.get('targetEventId'):
                    links.append(l)
        elif d.get('targetEventId'):
            links.append({'targetEventId': d.get('targetEventId')})

        if len(links) > 0:
            if any(l.get('targetEventId') in seen_node_ids for l in links):
                seen_diag_ids.add(did)
            continue

        cat = d.get('category') or 'KeyChain'
        if cat != category:
            continue
        var_id = d.get('variationId')
        if not is_pool_page and var_id and var_id != variation_id:
            continue
        seen_diag_ids.add(did)

    return len(seen_node_ids), len(seen_diag_ids)


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

