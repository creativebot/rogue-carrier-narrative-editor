import sys
import time
import json
import urllib.request
import urllib.parse
from playwright.sync_api import sync_playwright

def make_req(url, method='GET', data=None, headers=None):
    if headers is None:
        headers = {}
    body = None
    if data is not None:
        body = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def test_save_system_comprehensive():
    print("=" * 60)
    print(">>> STARTING COMPREHENSIVE SAVE & LOAD SYSTEM TESTS <<<")
    print("=" * 60)

    # ----------------------------------------------------
    # SECTION 1: Backend API & Multi-User Lock Scenarios
    # ----------------------------------------------------
    print("\n--- Section 1: Backend Multi-User & Lock Integrity ---")

    board_1 = "KeyChain:timeline_1:var_v1"
    board_2 = "SecretChain:timeline_1:var_v1"

    alice_header = {'Authorization': 'Bearer ' + json.dumps({"email": "alice@n-ix.com", "name": "Alice Editor", "role": "editor", "status": "approved", "canEdit": True})}
    bob_header = {'Authorization': 'Bearer ' + json.dumps({"email": "bob@n-ix.com", "name": "Bob Editor", "role": "editor", "status": "approved", "canEdit": True})}
    charlie_viewer = {'Authorization': 'Bearer ' + json.dumps({"email": "charlie@n-ix.com", "name": "Charlie Viewer", "role": "viewer", "status": "approved", "canEdit": False})}
    admin_daniel = {'Authorization': 'Bearer ' + json.dumps({"email": "dpoludonnyi@n-ix.com", "name": "Daniel Poludyonny", "role": "admin", "status": "approved", "canEdit": True, "isAdmin": True})}

    # Release any lingering test locks
    make_req('http://127.0.0.1:8000/api/lock/release', method='POST', data={"boardId": board_1}, headers=admin_daniel)
    make_req('http://127.0.0.1:8000/api/lock/release', method='POST', data={"boardId": board_2}, headers=admin_daniel)

    # 1.1 List all boards
    st, boards_data = make_req('http://127.0.0.1:8000/api/boards')
    assert st == 200, f"/api/boards failed: {st}"
    boards_list = boards_data.get('boards', [])
    print(f"[PASS] /api/boards returned {len(boards_list)} boards")
    assert len(boards_list) >= 20, f"Expected at least 20 boards, got {len(boards_list)}"

    # 1.2 Export single board
    st, b1_export = make_req(f'http://127.0.0.1:8000/api/export-board?id={urllib.parse.quote(board_1)}')
    assert st == 200, f"Export board_1 failed: {st}"
    print(f"[PASS] /api/export-board returned {len(b1_export.get('nodes', []))} events for {board_1}")

    # 1.3 Alice acquires lock on Board 1
    st, lock_res = make_req('http://127.0.0.1:8000/api/lock/acquire', method='POST', data={"boardId": board_1, "boardName": "Key Events"}, headers=alice_header)
    assert st == 200 and lock_res.get('success') is True, f"Alice lock failed: {lock_res}"
    print("[PASS] Alice successfully acquired lock on Board 1")

    # 1.4 Bob tries to save Board 1 -> Must be rejected (423 Locked)
    st, bob_save = make_req('http://127.0.0.1:8000/api/save-board', method='POST', data={"boardId": board_1, "nodes": [], "dialogues": []}, headers=bob_header)
    assert st == 423, f"Expected 423 Locked for Bob saving Board 1, got {st}"
    print(f"[PASS] Lock Guard: Bob prevented from saving Board 1 ({bob_save.get('message')})")

    # 1.5 Bob tries to restore Board 1 -> Must be rejected (423 Locked)
    st, bob_restore = make_req('http://127.0.0.1:8000/api/restore-board', method='POST', data={"boardId": board_1, "saveId": "dummy"}, headers=bob_header)
    assert st == 423, f"Expected 423 Locked for Bob restoring Board 1, got {st}"
    print("[PASS] Lock Guard: Bob prevented from restoring Board 1")

    # 1.6 Bob tries to import into Board 1 -> Must be rejected (423 Locked)
    st, bob_import = make_req('http://127.0.0.1:8000/api/import-board', method='POST', data={"boardId": board_1, "nodes": [], "dialogues": []}, headers=bob_header)
    assert st == 423, f"Expected 423 Locked for Bob importing into Board 1, got {st}"
    print("[PASS] Lock Guard: Bob prevented from importing into Board 1")

    # 1.7 Independent Board Lock: Bob saves Board 2 (unlocked) -> Must succeed (200)
    st, b2_export = make_req(f'http://127.0.0.1:8000/api/export-board?id={urllib.parse.quote(board_2)}')
    st, bob_b2_save = make_req('http://127.0.0.1:8000/api/save-board', method='POST', data={"boardId": board_2, "nodes": b2_export.get('nodes', []), "dialogues": b2_export.get('dialogues', []), "name": "Bob Board 2 Revision"}, headers=bob_header)
    assert st == 200, f"Bob save on Board 2 failed: {st}"
    print("[PASS] Independent Board Isolation: Bob successfully saved Board 2 while Alice held lock on Board 1")

    # 1.8 Alice saves Board 1 with named revision note -> Must succeed (200)
    st, alice_save = make_req('http://127.0.0.1:8000/api/save-board', method='POST', data={"boardId": board_1, "nodes": b1_export.get('nodes', []), "dialogues": b1_export.get('dialogues', []), "name": "Alice Certified Revision"}, headers=alice_header)
    assert st == 200, f"Alice save on Board 1 failed: {st}"
    print("[PASS] Alice successfully saved named revision on her locked Board 1")

    # 1.9 Verify revision name on Board 1
    st, b1_saves = make_req(f'http://127.0.0.1:8000/api/saves?boardId={urllib.parse.quote(board_1)}')
    assert b1_saves.get('saves', [])[0].get('name') == "Alice Certified Revision"
    print(f"[PASS] Board 1 revision history records custom note: '{b1_saves['saves'][0]['name']}'")

    # 1.10 Viewer Charlie tries to save -> Must be rejected (403 Forbidden)
    st, viewer_res = make_req('http://127.0.0.1:8000/api/save-board', method='POST', data={"boardId": board_2, "nodes": []}, headers=charlie_viewer)
    assert st == 403, f"Expected 403 for viewer save, got {st}"
    print("[PASS] Role Security: Viewer Charlie rejected from saving (403 Forbidden)")

    # 1.11 Admin Daniel overrides lock on Board 1
    st, override_res = make_req('http://127.0.0.1:8000/api/lock/override', method='POST', data={"boardId": board_1, "boardName": "Key Events"}, headers=admin_daniel)
    assert st == 200 and override_res.get('success') is True, f"Admin override failed: {override_res}"
    print("[PASS] Admin Privilege: Daniel Poludyonny successfully overrode Alice's lock")

    # 1.12 Release lock
    make_req('http://127.0.0.1:8000/api/lock/release', method='POST', data={"boardId": board_1}, headers=admin_daniel)
    print("[PASS] Cleaned up locks")

    # ----------------------------------------------------
    # SECTION 2: UI & Browser Playwright Automation Tests
    # ----------------------------------------------------
    print("\n--- Section 2: UI Browser Interactions & UX Flow ---")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        print("Navigating to http://127.0.0.1:8000 ...")
        page.goto("http://127.0.0.1:8000", wait_until="networkidle")
        time.sleep(1.5)

        # 2.1 Open Save Manager Modal
        page.evaluate("openSaveManagerModal('board')")
        time.sleep(1)

        modal_visible = page.is_visible('#modal-save-manager')
        assert modal_visible, "Save Manager modal did not open!"
        print("[PASS] Save Manager modal opened successfully")

        # 2.2 Verify Board Selector is populated
        boards_in_dropdown = page.evaluate("""() => {
            const select = document.getElementById('save-manager-board-picker');
            return select ? Array.from(select.options).map(o => ({ value: o.value, text: o.text, selected: o.selected })) : [];
        }""")
        print(f"[PASS] Save Manager Board Picker contains {len(boards_in_dropdown)} options")
        assert len(boards_in_dropdown) >= 20, f"Expected 20+ board options, got {len(boards_in_dropdown)}"

        # 2.3 Verify default active board is pre-selected and shows "Active on Canvas"
        selected_option = next((o for o in boards_in_dropdown if o['selected']), None)
        assert selected_option is not None, "No board pre-selected in picker"
        assert "Active Canvas" in selected_option['text'] or selected_option['value'].startswith('KeyChain'), f"Unexpected default selection: {selected_option}"

        active_badge_text = page.inner_text('#save-manager-active-canvas-badge')
        assert "Active on Canvas" in active_badge_text, f"Expected 'Active on Canvas' badge, got: {active_badge_text}"
        print(f"[PASS] Pre-selected board: '{selected_option['text']}' with badge '{active_badge_text}'")

        # 2.4 Switch to a different board in dropdown (e.g. Secret Events)
        page.select_option('#save-manager-board-picker', 'SecretChain:timeline_1:var_v1')
        time.sleep(0.5)

        badge_after_switch = page.inner_text('#save-manager-active-canvas-badge')
        assert "Other Board" in badge_after_switch, f"Expected 'Other Board' badge, got: {badge_after_switch}"
        view_canvas_visible = page.is_visible('#btn-save-manager-view-canvas')
        assert view_canvas_visible, "View on Canvas button should be visible when managing a different board"
        print(f"[PASS] Switched to SecretChain in modal: badge is '{badge_after_switch}' and 'View on Canvas' button is visible")

        # 2.5 Save snapshot of this chosen board with custom note
        test_note = "Playwright UI Secret Board Snapshot"
        page.fill('#input-board-save-note', test_note)
        page.click('#btn-save-selected-board')
        time.sleep(1.5)

        # 2.6 Verify the revision appears in the list
        revisions_text = page.inner_text('#saved-board-versions-list')
        assert test_note in revisions_text, f"Expected revision '{test_note}' in list, got: {revisions_text[:200]}"
        print(f"[PASS] Snapshot created via UI and verified in revision list: '{test_note}'")

        # 2.7 Click 'View on Canvas' to switch canvas to this board
        page.click('#btn-save-manager-view-canvas')
        time.sleep(1)

        badge_after_view = page.inner_text('#save-manager-active-canvas-badge')
        assert "Active on Canvas" in badge_after_view, f"Expected 'Active on Canvas' after clicking View on Canvas, got: {badge_after_view}"
        print(f"[PASS] 'View on Canvas' successfully navigated the editor to SecretChain!")

        # 2.8 Verify floating zoom buttons and cards remain intact
        page.evaluate("closeModal('modal-save-manager')")
        time.sleep(0.5)

        zoom_btns = page.evaluate("""() => {
            const btns = document.querySelectorAll('.block-zoom-in-btn, .block-zoom-out-btn');
            return btns.length;
        }""")
        assert zoom_btns > 0, "Zoom buttons disappeared after board switch!"
        print(f"[PASS] Editor cards and {zoom_btns} zoom buttons intact on canvas")

        # Screenshot
        screenshot_path = "C:/Users/DANIE/.gemini/antigravity/brain/cc4608a2-aa57-45ce-8c75-aa028ed71039/verify_save_manager_modal.png"
        page.evaluate("openSaveManagerModal('board')")
        time.sleep(0.5)
        page.screenshot(path=screenshot_path)
        print(f"[PASS] Saved modal screenshot to: {screenshot_path}")

        print("Console errors:", console_errors)
        assert len(console_errors) == 0, f"Console errors detected: {console_errors}"

        browser.close()

    print("\n" + "=" * 60)
    print(">>> ALL SAVE SYSTEM & MULTI-USER TESTS PASSED SUCCESSFULLY! <<<")
    print("=" * 60)

if __name__ == "__main__":
    test_save_system_comprehensive()
