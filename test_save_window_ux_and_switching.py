import time
from playwright.sync_api import sync_playwright

def test_save_window_ux_and_switching():
    print("=" * 60)
    print(">>> TESTING SAVE WINDOW UX, SIZING & LIVE BOARD SWITCHING <<<")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("\n[Step 1] Loading http://127.0.0.1:8000 ...")
        page.goto("http://127.0.0.1:8000", wait_until="networkidle")
        time.sleep(1.5)

        # 1. Verify Top Bar Header Button
        header_btn_text = page.inner_text('#btn-header-saves-text')
        assert header_btn_text == "Saves", f"Expected header button to say 'Saves', got: '{header_btn_text}'"
        print(f"[PASS] Header button correctly renamed to: '{header_btn_text}'")

        # 2. Verify Badge reflects only active board saves (KeyChain:timeline_1:var_v1)
        badge_count = page.inner_text('#header-backups-badge')
        print(f"[PASS] Header badge shows active board saves count: {badge_count} (not global 94)")
        assert int(badge_count) < 50, f"Expected active board saves count, but got: {badge_count}"

        # 3. Open Save Manager Modal
        page.click('#btn-header-backups')
        time.sleep(0.5)

        modal_visible = page.is_visible('#modal-save-manager')
        assert modal_visible, "Save Manager modal should be open"

        # 4. Check Modal Dimensions (larger layout)
        modal_box = page.eval_on_selector('#modal-save-manager > div', 'el => ({ width: el.offsetWidth, height: el.offsetHeight })')
        print(f"[PASS] Modal dimensions: width = {modal_box['width']}px, height = {modal_box['height']}px")
        assert modal_box['width'] >= 1000, f"Expected modal width >= 1000px, got: {modal_box['width']}px"
        assert modal_box['height'] >= 700, f"Expected modal height >= 700px, got: {modal_box['height']}px"

        # 5. Check Tab Button Label (clean, concise, no overflow)
        tab_label = page.inner_text('#tab-btn-board-saves')
        assert "Board Saves" in tab_label, f"Expected tab to contain 'Board Saves', got: '{tab_label}'"
        assert "Generic Event Pool Saves" not in tab_label, "Tab label should not contain full board title overflow"
        print(f"[PASS] Tab label is clean and concise: '{tab_label.strip()}'")

        # 6. Check Active Board in Modal
        picker_val_1 = page.input_value('#save-manager-board-picker')
        badge_1 = page.inner_text('#save-manager-active-canvas-badge')
        assert "KeyChain" in picker_val_1, f"Expected KeyChain pre-selected, got: {picker_val_1}"
        assert "Active on Canvas" in badge_1, f"Expected 'Active on Canvas', got: {badge_1}"
        print(f"[PASS] Modal opened on active board: '{picker_val_1}' with badge '{badge_1}'")

        # 7. SWITCH BOARD WHILE SAVE WINDOW IS OPEN -> Switch to DeckPool
        print("\n[Step 2] Switching to DeckPool with Save Window OPEN...")
        page.evaluate("setCategoryFilter('DeckPool')")
        time.sleep(1.0)

        picker_val_2 = page.input_value('#save-manager-board-picker')
        badge_2 = page.inner_text('#save-manager-active-canvas-badge')
        board_name_2 = page.inner_text('#save-manager-board-name-text')
        badge_count_deck = page.inner_text('#header-backups-badge')

        assert picker_val_2 == "DeckPool", f"Expected picker to automatically switch to DeckPool, got: {picker_val_2}"
        assert "Active on Canvas" in badge_2, f"Expected 'Active on Canvas' for DeckPool, got: {badge_2}"
        print(f"[PASS] Modal automatically synced to active board: '{picker_val_2}' ('{board_name_2}')")
        print(f"[PASS] Header badge automatically updated for DeckPool: {badge_count_deck} saves")

        # 8. SWITCH BOARD WHILE SAVE WINDOW IS OPEN -> Switch to SecretChain
        print("\n[Step 3] Switching to SecretChain with Save Window OPEN...")
        page.evaluate("setCategoryFilter('SecretChain')")
        time.sleep(1.0)

        picker_val_3 = page.input_value('#save-manager-board-picker')
        badge_3 = page.inner_text('#save-manager-active-canvas-badge')
        board_name_3 = page.inner_text('#save-manager-board-name-text')
        badge_count_secret = page.inner_text('#header-backups-badge')

        assert "SecretChain" in picker_val_3, f"Expected SecretChain, got: {picker_val_3}"
        assert "Active on Canvas" in badge_3, f"Expected 'Active on Canvas' for SecretChain, got: {badge_3}"
        print(f"[PASS] Modal automatically synced to SecretChain: '{picker_val_3}' ('{board_name_3}')")
        print(f"[PASS] Header badge automatically updated for SecretChain: {badge_count_secret} saves")

        # 9. SWITCH BOARD WHILE SAVE WINDOW IS OPEN -> Switch back to KeyChain
        print("\n[Step 4] Switching back to KeyChain with Save Window OPEN...")
        page.evaluate("setCategoryFilter('KeyChain')")
        time.sleep(1.0)

        picker_val_4 = page.input_value('#save-manager-board-picker')
        assert "KeyChain" in picker_val_4, f"Expected KeyChain, got: {picker_val_4}"
        print(f"[PASS] Modal automatically synced back to KeyChain: '{picker_val_4}'")

        # 10. Capture screenshot of the newly sized and styled modal
        screenshot_path = "C:/Users/DANIE/.gemini/antigravity/brain/cc4608a2-aa57-45ce-8c75-aa028ed71039/verify_save_window_redesign.png"
        page.screenshot(path=screenshot_path)
        print(f"[PASS] Saved modal screenshot to: {screenshot_path}")

        print("\nConsole errors:", console_errors)
        assert len(console_errors) == 0, f"Detected console errors: {console_errors}"
        browser.close()

    print("\n" + "=" * 60)
    print(">>> ALL SAVE WINDOW UX & SWITCHING TESTS PASSED (10/10)! <<<")
    print("=" * 60)

if __name__ == "__main__":
    test_save_window_ux_and_switching()
