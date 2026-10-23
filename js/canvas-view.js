// ============================================================================
// js/canvas-view.js - Canvas Viewport, Node/Dialogue DOM Builders, Inline Editors & Drag Engine
// ============================================================================

// ==========================================================================
// iPad Air & Tablet Touch Interaction: Pan vs Arrange Mode
// ==========================================================================
let isArrangeMode = false;
let isSpacePressed = false;
let rightClickStartPos = { x: 0, y: 0 };
let rightClickDragged = false;
let canvasDragMoved = false;
let canvasDragStartPos = { x: 0, y: 0 };

function setArrangeMode(active) {
  isArrangeMode = Boolean(active);
  const btnPan = document.getElementById('btn-mode-pan');
  const btnArrange = document.getElementById('btn-mode-arrange');
  const banner = document.getElementById('arrange-mode-banner');
  const tools = document.getElementById('canvas-creation-tools');
  const container = document.getElementById('canvas-container');

  if (isArrangeMode) {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    if (btnPan) {
      btnPan.className = 'px-2 py-1 rounded text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1 transition';
    }
    if (btnArrange) {
      btnArrange.className = 'px-2 py-1 rounded text-xs font-bold bg-amber-500 text-gray-950 flex items-center gap-1 shadow transition';
    }
    if (banner) banner.classList.remove('hidden');
    if (tools) tools.classList.add('arrange-glow');
    if (container) container.classList.add('arrange-mode-active');
    showToast("📐 Arrange Mode: Editing locked. Drag blocks to move, or use ports/lines to connect & disconnect.", "info");
  } else {
    if (btnPan) {
      btnPan.className = 'px-2 py-1 rounded text-xs font-bold bg-amber-500 text-gray-950 flex items-center gap-1 shadow transition';
    }
    if (btnArrange) {
      btnArrange.className = 'px-2 py-1 rounded text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1 transition';
    }
    if (banner) banner.classList.add('hidden');
    if (tools) tools.classList.remove('arrange-glow');
    if (container) container.classList.remove('arrange-mode-active');
    showToast("🖐️ Pan & Edit Mode: Swipe to pan, tap fields to edit content.", "info");
  }
}

function toggleMasterMenu(event) {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  const menu = document.getElementById('dropdown-master-menu');
  if (!menu) return;
  const isHidden = menu.classList.contains('hidden');
  if (isHidden) {
    menu.classList.remove('hidden');
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  } else {
    menu.classList.add('hidden');
  }
}

// Close master menu when clicking outside or clicking any action button inside it
window.addEventListener('click', (e) => {
  const menu = document.getElementById('dropdown-master-menu');
  const container = document.getElementById('container-master-menu');
  if (menu && !menu.classList.contains('hidden')) {
    if (container && !container.contains(e.target)) {
      menu.classList.add('hidden');
    } else if (menu.contains(e.target) && e.target.closest('button, a')) {
      menu.classList.add('hidden');
    }
  }
});

// Universal Panning & Multi-Touch Gestures for iPad / Tablet / Desktop
function setupCanvasEvents() {
  if (!canvasContainer) return;

  // Desktop Mouse Events - Universal Panning Engine
  canvasContainer.addEventListener('mousedown', (e) => {
    // Middle-click (1) or Right-click (2) or Space+Left-click: ALWAYS initiate universal pan!
    if (e.button === 1 || e.button === 2 || (e.button === 0 && isSpacePressed)) {
      isDraggingCanvas = true;
      canvasDragMoved = false;
      canvasDragStartPos = { x: e.clientX, y: e.clientY };
      dragStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      rightClickStartPos = { x: e.clientX, y: e.clientY };
      rightClickDragged = false;
      canvasContainer.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    // Only primary (left) button continues below
    if (e.button !== 0) return;

    if (document.activeElement && typeof document.activeElement.blur === 'function' && !e.target.closest('input, textarea, select')) {
      document.activeElement.blur();
    }

    // Return if clicking on interactive controls
    if (isArrangeMode) {
      if (e.target.closest('.connector-port, .dialogue-trigger-port, .btn-zoom-corner, .block-floating-btn, .connector-path-ortho, .connector-path-dialogue, .pool-event-switch-bar, .pool-switch-toggle-btn')) {
        return;
      }
    } else {
      // Pan & Edit Mode: Do not pan if clicking inside an interactive button, active input, port, or editable text spot
      if (
        e.target.closest('button') || 
        e.target.closest('input') || 
        e.target.closest('textarea') || 
        e.target.closest('select') || 
        e.target.closest('.editable-spot') ||
        e.target.closest('.connector-port') ||
        e.target.closest('.dialogue-trigger-port') ||
        e.target.closest('.req-pill') ||
        e.target.closest('.pool-event-switch-bar') ||
        e.target.closest('.pool-switch-toggle-btn') ||
        e.target.closest('.btn-zoom-corner') ||
        e.target.closest('.block-floating-btn') ||
        e.target.closest('.linked-event-jump-btn')
      ) {
        return;
      }
    }

    // Clicking on canvas background starts panning
    isDraggingCanvas = true;
    canvasDragMoved = false;
    canvasDragStartPos = { x: e.clientX, y: e.clientY };
    dragStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    canvasContainer.style.cursor = 'grabbing';
  });

  let panRafId = null;
  function scheduleCanvasTransform() {
    if (!panRafId) {
      panRafId = requestAnimationFrame(() => {
        updateCanvasTransform();
        panRafId = null;
      });
    }
  }

  window.addEventListener('mousemove', (e) => {
    if (isDraggingCanvas) {
      if (Math.hypot(e.clientX - canvasDragStartPos.x, e.clientY - canvasDragStartPos.y) > 4) {
        canvasDragMoved = true;
      }
      if (Math.hypot(e.clientX - rightClickStartPos.x, e.clientY - rightClickStartPos.y) > 4) {
        rightClickDragged = true;
      }
      transform.x = e.clientX - dragStart.x;
      transform.y = e.clientY - dragStart.y;
      scheduleCanvasTransform();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingCanvas) {
      isDraggingCanvas = false;
      canvasContainer.style.cursor = isSpacePressed ? 'grab' : 'default';
      if (panRafId) {
        cancelAnimationFrame(panRafId);
        panRafId = null;
      }
      updateCanvasTransform();
      updateBlockZoomButtons();
      setTimeout(() => {
        canvasDragMoved = false;
      }, 60);
    }
  });

  window.addEventListener('contextmenu', (e) => {
    if (rightClickDragged) {
      e.preventDefault();
      rightClickDragged = false;
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.closest('input, textarea, select')) {
      isSpacePressed = true;
      if (canvasContainer && !isDraggingCanvas) {
        canvasContainer.style.cursor = 'grab';
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      isSpacePressed = false;
      if (canvasContainer && !isDraggingCanvas) {
        canvasContainer.style.cursor = 'default';
      }
    }
  });

  let wheelEndTimer = null;
  let cachedContainerRect = null;
  let cachedRectTimestamp = 0;

  canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const now = performance.now();
    if (!cachedContainerRect || (now - cachedRectTimestamp) > 250) {
      cachedContainerRect = canvasContainer.getBoundingClientRect();
      cachedRectTimestamp = now;
    }

    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newScale = Math.min(Math.max(transform.scale * zoomFactor, 0.15), 3.0);

    const mouseX = e.clientX - cachedContainerRect.left;
    const mouseY = e.clientY - cachedContainerRect.top;

    transform.x = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    transform.y = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
    transform.scale = newScale;

    if (maxZoomedBlockId && newScale < maxZoomScale * 0.95) {
      maxZoomedBlockId = null;
    }

    scheduleCanvasTransform();

    if (wheelEndTimer) clearTimeout(wheelEndTimer);
    wheelEndTimer = setTimeout(() => {
      updateBlockZoomButtons();
    }, 120);
  }, { passive: false });

  // -------------------------------------------------------------
  // Multi-Touch Handlers for iPad Air, Tablets & Mobile Devices
  // -------------------------------------------------------------
  let touchState = {
    mode: 'none', // 'pan' | 'pinch' | 'node-drag'
    startX: 0,
    startY: 0,
    transformStart: { x: 0, y: 0, scale: 1 },
    pinchDist: 0,
    pinchMid: { x: 0, y: 0 },
    dragNodeObj: null,
    dragNodeEl: null,
    dragNodeStart: { x: 0, y: 0 },
    dragPreSnapshot: null
  };

  canvasContainer.addEventListener('touchstart', (e) => {
    // 2-Finger Gesture: Pinch-to-Zoom & Pan around Midpoint
    if (e.touches.length === 2) {
      touchState.mode = 'pinch';
      touchState.pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchState.pinchMid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };
      touchState.transformStart = { ...transform };
      return;
    }

    // 1-Finger Gesture
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const targetCard = e.target.closest('.event-card, .deck-event-card, .generic-event-card, .dialogue-card');
      const isPortOrZoom = e.target.closest('.connector-port, .dialogue-trigger-port, .btn-zoom-corner, .block-floating-btn, .connector-path-ortho, .connector-path-dialogue, .pool-event-switch-bar, .pool-switch-toggle-btn');
      const isInteractive = isArrangeMode
        ? isPortOrZoom
        : e.target.closest('button, input, textarea, select, .connector-port, .dialogue-trigger-port, .req-pill, .editable-spot, .btn-zoom-corner, .block-floating-btn, .pool-event-switch-bar, .pool-switch-toggle-btn');

      // If in Arrange Mode AND touch starts on an event/dialogue card body:
      if (isArrangeMode && targetCard && !isInteractive) {
        if (!canUserEdit()) {
          requireAuthToEdit("move blocks in Arrange Mode");
          return;
        }
        const isEvent = targetCard.classList.contains('event-card') || targetCard.classList.contains('deck-event-card') || targetCard.classList.contains('generic-event-card');
        const nodeId = targetCard.id.replace(isEvent ? 'node-' : 'dialogue-', '');
        const obj = isEvent ? appData.nodes.find(n => n.id === nodeId) : appData.dialogues.find(d => d.id === nodeId);

        if (obj) {
          touchState.mode = 'node-drag';
          touchState.hasDragged = false;
          touchState.dragNodeObj = obj;
          touchState.dragNodeEl = targetCard;
          touchState.startX = touch.clientX;
          touchState.startY = touch.clientY;
          touchState.dragNodeStart = { ...obj.position };
          touchState.dragPreSnapshot = JSON.stringify(appData);
          return;
        }
      }

      // Default (Pan Mode) or touching background in Arrange Mode
      if (!isInteractive) {
        touchState.mode = 'pan';
        touchState.startX = touch.clientX;
        touchState.startY = touch.clientY;
        touchState.transformStart = { ...transform };
      }
    }
  }, { passive: false });

  canvasContainer.addEventListener('touchmove', (e) => {
    // 2-Finger Pinch-to-Zoom
    if (touchState.mode === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (touchState.pinchDist > 0) {
        const factor = currentDist / touchState.pinchDist;
        const newScale = Math.min(Math.max(touchState.transformStart.scale * factor, 0.15), 3.0);

        const rect = canvasContainer.getBoundingClientRect();
        const midX = touchState.pinchMid.x - rect.left;
        const midY = touchState.pinchMid.y - rect.top;

        transform.x = midX - (midX - touchState.transformStart.x) * (newScale / touchState.transformStart.scale);
        transform.y = midY - (midY - touchState.transformStart.y) * (newScale / touchState.transformStart.scale);
        transform.scale = newScale;

        updateCanvasTransform();
      }
      return;
    }

    // 1-Finger Move Element in Arrange Mode
    if (touchState.mode === 'node-drag' && e.touches.length === 1 && touchState.dragNodeObj && touchState.dragNodeEl) {
      const touch = e.touches[0];
      const rawDist = Math.hypot(touch.clientX - touchState.startX, touch.clientY - touchState.startY);
      if (!touchState.hasDragged && rawDist < 4) {
        return;
      }
      if (!touchState.hasDragged) {
        touchState.hasDragged = true;
        if (typeof cacheAllNodeDimensions === 'function') {
          cacheAllNodeDimensions();
        }
      }
      e.preventDefault();
      const dx = (touch.clientX - touchState.startX) / transform.scale;
      const dy = (touch.clientY - touchState.startY) / transform.scale;

      touchState.dragNodeObj.position.x = Math.round(touchState.dragNodeStart.x + dx);
      touchState.dragNodeObj.position.y = Math.round(touchState.dragNodeStart.y + dy);

      touchState.dragNodeEl.style.left = `${touchState.dragNodeObj.position.x}px`;
      touchState.dragNodeEl.style.top = `${touchState.dragNodeObj.position.y}px`;

      const isEventNode = (appData.nodes || []).some(n => n.id === touchState.dragNodeObj.id);
      if (typeof updateConnectedConnectorsForNode === 'function') {
        updateConnectedConnectorsForNode(touchState.dragNodeObj.id, !isEventNode);
      } else {
        renderConnectors();
      }
      return;
    }

    // 1-Finger Pan Canvas (Default Pan Mode)
    if (touchState.mode === 'pan' && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - touchState.startX;
      const dy = touch.clientY - touchState.startY;

      transform.x = touchState.transformStart.x + dx;
      transform.y = touchState.transformStart.y + dy;
      scheduleCanvasTransform();
      return;
    }
  }, { passive: false });

  const finishTouch = () => {
    if (touchState.mode === 'node-drag' && touchState.dragNodeObj && touchState.hasDragged) {
      const obj = touchState.dragNodeObj;
      const el = touchState.dragNodeEl;
      finalizeNodeDrop(obj, el, touchState.dragNodeStart, touchState.dragPreSnapshot);
    }
    touchState.mode = 'none';
    touchState.hasDragged = false;
    touchState.dragNodeObj = null;
    touchState.dragNodeEl = null;
    updateBlockZoomButtons();
  };

  canvasContainer.addEventListener('touchend', finishTouch);
  canvasContainer.addEventListener('touchcancel', finishTouch);
}

// Clean Unified Hardware-Accelerated Canvas Transform
let lastAppliedScale = null;
function updateCanvasTransform() {
  if (!canvasStage) {
    canvasStage = document.getElementById('canvas-stage');
  }
  if (!canvasStage) return;

  const tx = Math.round(transform.x);
  const ty = Math.round(transform.y);
  canvasStage.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${transform.scale})`;

  if (lastAppliedScale !== transform.scale) {
    lastAppliedScale = transform.scale;
    const resetBtn = document.getElementById('btn-zoom-reset');
    if (resetBtn) resetBtn.innerText = `${Math.round(transform.scale * 100)}%`;
  }
  schedulePersistBoardView();
}

function getActiveBoardViewKey() {
  if (activeCategoryFilter === 'GenericPool') return 'rc_board_view_GenericPool';
  if (activeCategoryFilter === 'DeckPool') return 'rc_board_view_DeckPool';
  if (activeCategoryFilter === 'SpeciesPool') return 'rc_board_view_SpeciesPool';
  const tl = (typeof activeTimelineId !== 'undefined' && activeTimelineId) ? activeTimelineId : 'tl1';
  const v = (typeof activeVariationId !== 'undefined' && activeVariationId) ? activeVariationId : 'v1';
  return `rc_board_view_${activeCategoryFilter || 'KeyChain'}_${tl}_${v}`;
}

let boardViewSaveTimeout = null;
function persistCurrentBoardView() {
  try {
    const key = getActiveBoardViewKey();
    if (!key) return;
    const viewData = {
      x: Math.round(transform.x),
      y: Math.round(transform.y),
      scale: parseFloat(transform.scale.toFixed(4)),
      time: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(viewData));
  } catch (e) {}
}

function schedulePersistBoardView() {
  if (boardViewSaveTimeout) clearTimeout(boardViewSaveTimeout);
  boardViewSaveTimeout = setTimeout(persistCurrentBoardView, 200);
}

function restoreBoardViewTransform() {
  try {
    const key = getActiveBoardViewKey();
    if (!key) return false;
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const viewData = JSON.parse(raw);
    if (viewData && typeof viewData.x === 'number' && typeof viewData.y === 'number' && typeof viewData.scale === 'number') {
      transform.x = viewData.x;
      transform.y = viewData.y;
      transform.scale = Math.min(Math.max(viewData.scale, 0.15), 3.0);
      updateCanvasTransform();
      return true;
    }
  } catch (e) {}
  return false;
}

window.persistCurrentBoardView = persistCurrentBoardView;
window.restoreBoardViewTransform = restoreBoardViewTransform;
window.addEventListener('beforeunload', persistCurrentBoardView);

function updateLodUIState() {}
function toggleLodMode() {}
window.toggleLodMode = toggleLodMode;
window.updateLodUIState = updateLodUIState;

function setupToolbarEvents() {
  if (variationSelect) {
    variationSelect.addEventListener('change', (e) => {
      persistCurrentBoardView();
      activeVariationId = e.target.value;
      const vObj = (appData.variations || []).find(v => v.id === activeVariationId);
      if (vObj && vObj.timelineId) {
        activeTimelineId = vObj.timelineId;
      }
      saveActiveWorkspacePosition();
      const afterBoardUpdate = () => {
        renderApp();
        if (typeof syncActiveBoardLock === 'function') {
          syncActiveBoardLock();
        }
        if (currentAppViewMode !== 'mobile-stage') {
          const restored = restoreBoardViewTransform();
          if (!restored) {
            const isPool = activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool';
            if (!isPool) {
              setTimeout(() => fitWholeSchematic(), 50);
            }
          }
        }
      };

      if (typeof syncBoardFromServer === 'function') {
        syncBoardFromServer().then(afterBoardUpdate);
      } else {
        afterBoardUpdate();
      }
    });
  }

  const btnTimelines = document.getElementById('btn-tab-timelines');
  if (btnTimelines) btnTimelines.onclick = () => renderTimelinesManager();
  
  const btnKeychain = document.getElementById('btn-view-keychain');
  if (btnKeychain) btnKeychain.onclick = () => setCategoryFilter('KeyChain');
  
  const btnSecret = document.getElementById('btn-view-secret');
  if (btnSecret) btnSecret.onclick = () => setCategoryFilter('SecretChain');
  
  const btnGeneric = document.getElementById('btn-view-generic');
  if (btnGeneric) btnGeneric.onclick = () => setCategoryFilter('GenericPool');
  
  const btnDeck = document.getElementById('btn-view-deck');
  if (btnDeck) btnDeck.onclick = () => setCategoryFilter('DeckPool');

  const btnSpecies = document.getElementById('btn-view-species');
  if (btnSpecies) btnSpecies.onclick = () => setCategoryFilter('SpeciesPool');

  const btnModeCanvas = document.getElementById('btn-mode-canvas');
  if (btnModeCanvas) btnModeCanvas.onclick = () => switchAppViewMode('desktop');

  const btnModeMobile = document.getElementById('btn-mode-mobile');
  if (btnModeMobile) btnModeMobile.onclick = () => switchAppViewMode('mobile-stage');

  const btnLayoutHealth = document.getElementById('btn-layout-health');
  if (btnLayoutHealth) btnLayoutHealth.onclick = () => openLayoutHealthModal();

  const btnFit = document.getElementById('btn-fit-schematic');
  if (btnFit) btnFit.onclick = () => fitWholeSchematic();



  // Save (Ctrl+S) Button
  const btnSaveProject = document.getElementById('btn-save-project');
  if (btnSaveProject) {
    btnSaveProject.onclick = () => saveCurrentProject(true);
  }

  // Load / Saves Manager Button
  const btnLoadManager = document.getElementById('btn-load-manager');
  if (btnLoadManager) {
    btnLoadManager.onclick = () => openSaveManagerModal();
  }

  // Modal Save / Load Controls
  const btnModalQuickSave = document.getElementById('btn-modal-quick-save');
  if (btnModalQuickSave) {
    btnModalQuickSave.onclick = () => saveCurrentProject(true);
  }

  const btnModalExport = document.getElementById('btn-modal-export-json');
  if (btnModalExport) {
    btnModalExport.onclick = () => exportProjectJSON();
  }

  const btnModalBrowse = document.getElementById('btn-modal-browse-file');
  const fileInputProject = document.getElementById('file-input-project-load');
  if (btnModalBrowse && fileInputProject) {
    btnModalBrowse.onclick = () => fileInputProject.click();
    fileInputProject.onchange = (e) => handleLoadProjectFromFile(e);
  }

  const btnConfirmSave = document.getElementById('btn-confirm-save-version');
  if (btnConfirmSave) {
    btnConfirmSave.onclick = async () => {
      const nameInput = document.getElementById('input-save-version-name');
      const authorInput = document.getElementById('input-save-author');
      const name = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : `Version ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      const author = (authorInput && authorInput.value.trim()) ? authorInput.value.trim() : 'Wild Fields';
      await recordVersionSnapshot(name, author, true);
      if (nameInput) nameInput.value = '';
      renderSavedVersionsList();
    };
  }

  const btnRefreshSaves = document.getElementById('btn-refresh-saves-list');
  if (btnRefreshSaves) {
    btnRefreshSaves.onclick = () => renderSavedVersionsList();
  }
  
  const btnResetDefault = document.getElementById('btn-reset-default');
  if (btnResetDefault) {
    btnResetDefault.onclick = () => {
      if (confirm("Reset the entire schematic back to the original PDF specification?\n\nA safety backup will be stored automatically in Load / Saves.")) {
        pushUndoState();
        resetToDefaultProjectData(false);
        renderApp();
        fitWholeSchematic();
        showToast("Schematic reset. Backup stored in Load / Saves.", "info");
      }
    };
  }

  const btnAddEvent = document.getElementById('btn-add-event');
  if (btnAddEvent) btnAddEvent.onclick = () => openCreateEventModal();
  
  const btnAddDialogue = document.getElementById('btn-add-dialogue');
  if (btnAddDialogue) btnAddDialogue.onclick = () => createStandaloneDialogue();

  const btnCharacters = document.getElementById('btn-manage-characters');
  if (btnCharacters) btnCharacters.onclick = () => renderCharactersManager();

  const btnAddChar = document.getElementById('btn-add-character');
  if (btnAddChar) btnAddChar.onclick = () => createCharacterFromModalForm();

  const btnAddTimeline = document.getElementById('btn-add-timeline');
  if (btnAddTimeline) btnAddTimeline.onclick = () => addNewTimeline();

  const btnZoomIn = document.getElementById('btn-zoom-in');
  if (btnZoomIn) btnZoomIn.onclick = () => { transform.scale = Math.min(transform.scale * 1.2, 3.0); updateCanvasTransform(); };
  
  const btnZoomOut = document.getElementById('btn-zoom-out');
  if (btnZoomOut) btnZoomOut.onclick = () => { transform.scale = Math.max(transform.scale / 1.2, 0.15); updateCanvasTransform(); };
  
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  if (btnZoomReset) btnZoomReset.onclick = () => { transform.scale = 0.8; transform.x = 40; transform.y = 30; updateCanvasTransform(); };

  const btnAutoLayout = document.getElementById('btn-auto-layout');
  if (btnAutoLayout) btnAutoLayout.onclick = () => { pushUndoState(); autoArrangeTreeLayout(); };
  
  const btnExport = document.getElementById('btn-export-json');
  if (btnExport) btnExport.onclick = () => exportProjectJSON();

  const btnExportUnreal = document.getElementById('btn-export-unreal');
  if (btnExportUnreal) btnExportUnreal.onclick = async () => {
    saveProjectToLocalStorage();
    await syncProjectToDiskServer();
    openModal('modal-export-unreal');
  };
  
  const btnImportPdf = document.getElementById('btn-import-pdf');
  if (btnImportPdf) btnImportPdf.onclick = () => openModal('modal-import-pdf');

  // Requirement: Global Shortcuts for Undo (Ctrl+Z), Redo (Ctrl+Y / Ctrl+Shift+Z), and Save (Ctrl+S)
  window.addEventListener('keydown', (e) => {
    const isZ = (e.key.toLowerCase() === 'z' || e.code === 'KeyZ');
    const isY = (e.key.toLowerCase() === 'y' || e.code === 'KeyY');
    const isS = (e.key.toLowerCase() === 's' || e.code === 'KeyS');

    const activeEl = document.activeElement;
    const tag = activeEl ? activeEl.tagName.toLowerCase() : '';
    // Only yield to native text undo if the user is actively typing in a visible input or textarea
    const isTyping = (tag === 'input' || tag === 'textarea') && activeEl.offsetParent !== null;

    if ((e.ctrlKey || e.metaKey) && isZ && !e.shiftKey) {
      if (isTyping) return;
      e.preventDefault();
      performUndo();
    } else if ((e.ctrlKey || e.metaKey) && ((isZ && e.shiftKey) || isY)) {
      if (isTyping) return;
      e.preventDefault();
      performRedo();
    } else if ((e.ctrlKey || e.metaKey) && isS) {
      e.preventDefault();
      saveCurrentProject(true);
    }
  });
}

function setCategoryFilter(filter) {
  persistCurrentBoardView();
  activeCategoryFilter = filter;
  syncCategoryFilterButtonsUI(filter);
  saveActiveWorkspacePosition();
  const afterCategoryUpdate = () => {
    renderApp();
    if (typeof syncActiveBoardLock === 'function') {
      syncActiveBoardLock();
    }
    if (currentAppViewMode !== 'mobile-stage') {
      const restored = restoreBoardViewTransform();
      if (!restored) {
        const isPool = activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool';
        if (!isPool) {
          setTimeout(() => fitWholeSchematic(), 50);
        }
      }
    }
  };

  if (typeof syncBoardFromServer === 'function') {
    syncBoardFromServer().then(afterCategoryUpdate);
  } else {
    afterCategoryUpdate();
  }
}

function updateProjectSubtitle() {
  const subtitleEl = document.getElementById('project-subtitle');
  if (!subtitleEl) return;
  const activeVar = (appData.variations || []).find(v => v.id === activeVariationId);
  const activeTl = activeVar ? ((appData.timelines || []).find(tl => tl.id === activeVar.timelineId) || { name: 'The Fate of Zephyrus', number: 1 }) : { name: 'The Fate of Zephyrus', number: 1 };
  subtitleEl.innerText = `Timeline ${activeTl.number || 1}: ${activeTl.name}`;
}

function renderApp() {
  saveActiveWorkspacePosition();
  updateProjectSubtitle();
  renderVariationSelect();
  if (typeof invalidateNodeDimensionsCache === 'function') {
    invalidateNodeDimensionsCache();
  }
  if (currentAppViewMode === 'mobile-stage') {
    renderMobileStageView();
  } else {
    renderFloorBands();
    renderNodes();
    setTimeout(() => renderConnectors(), 50);
  }
  updateStats();
  if (typeof onActiveBoardChanged === 'function') {
    onActiveBoardChanged();
  }
}

function renderVariationSelect() {
  if (!variationSelect) return;
  if (!Array.isArray(appData.variations) || appData.variations.length === 0) {
    if (typeof getDefaultVariationsList === 'function') {
      appData.variations = getDefaultVariationsList();
    }
  }
  if (!Array.isArray(appData.timelines) || appData.timelines.length === 0) {
    if (typeof getDefaultTimelinesList === 'function') {
      appData.timelines = getDefaultTimelinesList();
    }
  }
  variationSelect.innerHTML = '';
  const timelines = appData.timelines || [];
  const sortedVariations = [...(appData.variations || [])].sort((a, b) => {
    const tlA = timelines.find(tl => tl.id === a.timelineId);
    const tlB = timelines.find(tl => tl.id === b.timelineId);
    const numTlA = tlA ? Number(tlA.number || 1) : 999;
    const numTlB = tlB ? Number(tlB.number || 1) : 999;
    if (numTlA !== numTlB) return numTlA - numTlB;
    return Number(a.number || 0) - Number(b.number || 0);
  });
  if (sortedVariations.length > 0 && (!activeVariationId || !sortedVariations.some(v => v.id === activeVariationId))) {
    activeVariationId = sortedVariations[0].id;
  }
  sortedVariations.forEach(v => {
    const t = timelines.find(tl => tl.id === v.timelineId) || { name: 'Timeline 1', number: 1 };
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.innerText = `${t.name} — V${v.number}: ${v.name}`;
    if (v.id === activeVariationId) {
      opt.selected = true;
      variationSelect.title = opt.innerText;
    }
    variationSelect.appendChild(opt);
  });
}


function renderFloorBands() {
  if (!floorBandsLayer) return;
  floorBandsLayer.innerHTML = '';

  if (activeCategoryFilter === 'KeyChain' || activeCategoryFilter === 'SecretChain') {
    const isSecret = activeCategoryFilter === 'SecretChain';

    // Infinite continuous stage bands with lightweight zero-overhead CSS geometry
    const bandLeft = -100000;
    const bandWidth = 200000;

    FLOOR_Y.forEach((y, idx) => {
      const band = document.createElement('div');
      band.id = `stage-band-${idx}`;
      band.className = `stage-band floor-band ${isSecret ? 'secret-stage-band' : ''}`;
      band.style.top = `${y - 45}px`;
      band.style.height = `${STAGE_BAND_HEIGHT}px`;
      band.style.left = `${bandLeft}px`;
      band.style.width = `${bandWidth}px`;
      floorBandsLayer.appendChild(band);

      // Clean repeating stage badges across visible pan spectrum
      for (let lx = -16000; lx <= 24000; lx += 1600) {
        const label = document.createElement('div');
        label.className = `stage-label floor-label ${isSecret ? 'secret-stage-label' : ''}`;
        label.style.top = `${y - 59}px`;
        label.style.left = `${lx + 40}px`;
        label.innerText = isSecret ? `SECRET STAGE ${idx + 1}` : `STAGE ${idx + 1}`;
        floorBandsLayer.appendChild(label);
      }
    });
  } else {
    // 5 Vertical Difficulty Tier Columns (Tier I to Tier V for Generic & Deck Event Pools)
    const tierLabels = [
      'TIER I (Introductory / Low Risk)',
      'TIER II (Standard Operations)',
      'TIER III (Challenging / Hostile)',
      'TIER IV (High Risk / Severe Threat)',
      'TIER V (Apex / Extreme Hazard)'
    ];
    const isDeck = activeCategoryFilter === 'DeckPool';
    const isSpecies = activeCategoryFilter === 'SpeciesPool';
    const poolNodes = (appData.nodes || []).filter(n => (n.category || 'GenericPool') === activeCategoryFilter);

    // 1. Calculate dynamic width for each tier based on the largest element in it
    const tierWidths = [1020, 1020, 1020, 1020, 1020];
    for (let t = 0; t < 5; t++) {
      const tierNum = t + 1;
      const nodesInTier = poolNodes.filter(n => (Number(n.tier) || 1) === tierNum);
      let maxWidth = 940;
      nodesInTier.forEach(node => {
        const actionCols = (node.actions || []).length;
        const hasInaction = Boolean(node.hasInactionThreat && node.inactionThreat);
        const totalCols = actionCols + (hasInaction ? 1 : 0);
        let nodeWidth = 940;
        if (totalCols >= 4) nodeWidth = 1220;
        else if (totalCols === 3) nodeWidth = 1060;
        if (nodeWidth > maxWidth) maxWidth = nodeWidth;
      });
      tierWidths[t] = Math.max(1020, maxWidth + 80); // 40px buffer on each side
    }

    // 2. Compute dynamic start X for each tier column
    const tierStarts = [];
    let currentX = 80;
    const tierGap = 50;
    for (let t = 0; t < 5; t++) {
      tierStarts.push(currentX);
      TIER_X[t] = currentX + 30; // node snap anchor
      currentX += tierWidths[t] + tierGap;
    }

    // 3. Render vertical column bands with infinite continuous span & periodic headers
    const headerYPositions = [-5000, -2500, 40, 2500, 5000, 7500, 10000, 12500, 15000, 17500, 20000];
    for (let t = 0; t < 5; t++) {
      const band = document.createElement('div');
      band.id = `tier-band-${t}`;
      const bandClass = isDeck ? 'tier-column-band-deck' : (isSpecies ? 'tier-column-band-species' : '');
      band.className = `tier-column-band ${bandClass}`.trim();
      band.style.left = `${tierStarts[t]}px`;
      band.style.width = `${tierWidths[t]}px`;
      band.style.top = `-100000px`;
      band.style.height = `200000px`;
      floorBandsLayer.appendChild(band);

      const headerClass = isDeck ? 'tier-column-header-deck' : (isSpecies ? 'tier-column-header-species' : '');
      headerYPositions.forEach(hy => {
        const header = document.createElement('div');
        header.className = `tier-column-header ${headerClass}`.trim();
        header.style.top = `${hy}px`;
        header.style.left = `${tierStarts[t] + Math.round((tierWidths[t] - 280) / 2)}px`;
        header.style.width = `280px`;
        header.style.textAlign = 'center';
        header.innerText = tierLabels[t];
        floorBandsLayer.appendChild(header);
      });
    }
  }
}

function updateDynamicBandDimensions() {
  if (!nodesLayer || !floorBandsLayer) return;

  if (activeCategoryFilter === 'KeyChain' || activeCategoryFilter === 'SecretChain') {
    FLOOR_Y.forEach((y, idx) => {
      const band = document.getElementById(`stage-band-${idx}`);
      if (!band) return;
      const bandTop = y - 45;

      let maxBottomInStage = bandTop + STAGE_BAND_HEIGHT;
      const stageMinY = idx === 0 ? -Infinity : (FLOOR_Y[idx] + FLOOR_Y[idx - 1]) / 2;
      const stageMaxY = (idx === FLOOR_Y.length - 1) ? Infinity : (FLOOR_Y[idx] + FLOOR_Y[idx + 1]) / 2;

      const cardsInStage = Array.from(nodesLayer.children).filter(el => {
        const top = parseFloat(el.style.top) || 0;
        return top >= stageMinY && top < stageMaxY;
      });

      cardsInStage.forEach(cardEl => {
        const top = parseFloat(cardEl.style.top) || 0;
        const h = cardEl.offsetHeight || 0;
        const bottom = top + h;
        if (bottom > maxBottomInStage) {
          maxBottomInStage = bottom;
        }
      });

      const isLastStage = (idx === FLOOR_Y.length - 1);
      if (isLastStage) {
        // Last stage has no subsequent stage below it: expand generously to fit all elements + bottom buffer
        const requiredHeight = Math.max(STAGE_BAND_HEIGHT, (maxBottomInStage - bandTop) + 120);
        band.style.height = `${requiredHeight}px`;
      } else {
        // Earlier stages (Stages 1-3): clamp so bottom border NEVER exceeds or overlaps the top of the next stage
        const nextStageTop = FLOOR_Y[idx + 1] - 45;
        const maxSafeHeight = Math.max(STAGE_BAND_HEIGHT, nextStageTop - bandTop - 15);
        const calculatedHeight = Math.max(STAGE_BAND_HEIGHT, (maxBottomInStage - bandTop) + 60);
        const finalHeight = Math.min(calculatedHeight, maxSafeHeight);
        band.style.height = `${finalHeight}px`;
      }
    });
  } else {
    // Generic / Deck Pools: Check if any rendered card in a tier is wider than allocated
    const tierCards = Array.from(nodesLayer.children);
    let needsTierReflow = false;

    for (let t = 0; t < 5; t++) {
      const band = document.getElementById(`tier-band-${t}`);
      if (!band) continue;
      const currentWidth = parseFloat(band.style.width) || 1020;
      const bandLeft = parseFloat(band.style.left) || 80;

      tierCards.forEach(cardEl => {
        const left = parseFloat(cardEl.style.left) || 0;
        const width = cardEl.offsetWidth || 0;
        if (left >= bandLeft - 50 && left < bandLeft + currentWidth) {
          const cardRequiredWidth = (left - bandLeft) + width + 60;
          if (cardRequiredWidth > currentWidth) {
            band.style.width = `${Math.round(cardRequiredWidth)}px`;
            needsTierReflow = true;
          }
        }
      });
    }

    if (needsTierReflow) {
      let curX = 80;
      const tierGap = 50;
      for (let t = 0; t < 5; t++) {
        const band = document.getElementById(`tier-band-${t}`);
        if (!band) continue;
        const w = parseFloat(band.style.width) || 1020;
        band.style.left = `${curX}px`;
        TIER_X[t] = curX + 30;
        curX += w + tierGap;
      }
    }
  }
}



// Render All Nodes on Stage (Unified Event Block Layout for Critical, Generic & Deck Pools)
function renderNodes() {
  if (!nodesLayer) return;
  nodesLayer.innerHTML = '';

  const isPoolPage = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool');

  const filteredNodes = appData.nodes.filter(n => {
    const cat = n.category || 'KeyChain';
    if (cat !== activeCategoryFilter) return false;
    // On Generic and Deck Pool pages, the entire pool is present regardless of selected timeline and variation
    if (!isPoolPage && n.variationId && n.variationId !== activeVariationId) return false;
    return true;
  });

  filteredNodes.forEach(node => {
    // If on a pool page and node has a tier, align its position to the dynamic tier anchor
    if (isPoolPage && node.tier) {
      const tierIdx = Math.max(0, Math.min(4, Number(node.tier) - 1));
      if (TIER_X[tierIdx] !== undefined) {
        node.position.x = TIER_X[tierIdx];
      }
    }
    const nodeEl = createEventNodeDOM(node);
    nodesLayer.appendChild(nodeEl);
  });

  // Dialogues: Filter by active category (and variation for critical chains, all pool dialogues for pool pages)
  const filteredDialogues = appData.dialogues.filter(d => {
    const links = getDialogueLinks(d);
    if (links.length > 0) {
      return links.some(link => {
        const targetNode = appData.nodes.find(n => n.id === link.targetEventId);
        if (!targetNode) return false;
        const targetCat = targetNode.category || 'KeyChain';
        if (targetCat !== activeCategoryFilter) return false;
        if (!isPoolPage && targetNode.variationId && targetNode.variationId !== activeVariationId) return false;
        return true;
      });
    }
    const cat = d.category || 'KeyChain';
    if (cat !== activeCategoryFilter) return false;
    if (!isPoolPage && d.variationId && d.variationId !== activeVariationId) return false;
    return true;
  });

  filteredDialogues.forEach(dialogue => {
    const diagEl = createDialogueNodeDOM(dialogue);
    nodesLayer.appendChild(diagEl);
  });

  updateDynamicBandDimensions();
  makeNodesDraggable();
  if (window.lucide) lucide.createIcons();
}


// Key Event Block DOM Creation (with Symbol Count Tracking, Criteria Flags & Multi-Target Links)
function createEventNodeDOM(node) {
  const isReadOnly = (typeof canUserEdit === 'function') 
    ? !canUserEdit() 
    : (typeof isCurrentBoardReadOnly === 'function' ? isCurrentBoardReadOnly() : Boolean(isCurrentBoardReadOnly));

  const hasInaction = Boolean(node.hasInactionThreat && node.inactionThreat);
  const actionCols = node.actions || [];
  const actionColsCount = Math.max(actionCols.length, 1);
  const totalColumns = actionColsCount + (hasInaction ? 1 : 0);
  const actionWidthPercent = (100 / (totalColumns || 1)).toFixed(2);

  const isPoolEvent = (node.category === 'GenericPool' || node.category === 'DeckPool' || node.category === 'SpeciesPool' || activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool');
  const isDimmed = isPoolEvent && isPoolNodeDimmed(node.id, activeVariationId);
  const currentVar = (appData.variations || []).find(v => v.id === activeVariationId) || { number: 1, name: 'Variation 1' };

  const wrapper = document.createElement('div');
  wrapper.id = `node-${node.id}`;
  const theme = node.colorScheme || 'amber';
  wrapper.className = `absolute event-card event-card-theme-${theme} cols-${totalColumns} cursor-move ${isDimmed ? 'is-pool-disabled' : ''}`;
  wrapper.style.left = `${node.position.x}px`;
  wrapper.style.top = `${node.position.y}px`;

  const limits = getSymbolLimits();

  let actionHeadersHTML = '';
  let actionDescHTML = '';
  let actionShortDescHTML = '';
  let actionReqHTML = '';
  let actionTimerHTML = '';
  let actionResultHTML = '';
  let actionRewardHTML = '';
  let actionButtonsHTML = '';

  actionCols.forEach((act, idx) => {
    const removeBtn = (actionCols.length > 1 && !isReadOnly) ? `
      <button type="button" class="text-xs text-red-600 hover:text-red-800 font-bold ml-1 bg-red-100/80 px-1 rounded" 
              onclick="event.stopPropagation(); removeActionColumn('${node.id}', ${idx})" title="Remove Action Option">
        ×
      </button>` : '';

    // Check if this action option has connected route suggestion dialogues (shown during event window review)
    const linkedRouteDialogues = (appData.dialogues || []).filter(d => 
      getDialogueLinks(d).some(l =>
        l.targetEventId === node.id && 
        l.triggerTiming === 'action_option' && 
        l.triggerActionId === act.id
      )
    );
    const hasRouteDiag = linkedRouteDialogues.length > 0;

    let routeDiagPills = '';
    if (hasRouteDiag) {
      routeDiagPills = linkedRouteDialogues.map(d => {
        const firstSpeaker = d.lines && d.lines[0] ? d.lines[0].speakerName : 'Advice';
        return `
          <button type="button" 
                  class="ml-1 text-[10px] font-bold text-indigo-800 hover:text-indigo-950 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 px-1.5 py-0.5 rounded-full transition flex items-center gap-0.5 shadow-xs" 
                  title="Side-screen route suggestion: jump to dialogue block (${firstSpeaker})"
                  onclick="event.stopPropagation(); zoomInToBlock('${d.id}', true)">
            <span>💬</span><span class="truncate max-w-[65px]">${firstSpeaker}</span>
          </button>
        `;
      }).join('');
    }

    actionHeadersHTML += `
      <th class="action-column-head" style="width: ${actionWidthPercent}%; padding: 4px 6px;">
        <div class="flex items-center justify-between px-1 gap-1">
          <div class="flex items-center gap-1 min-w-0">
            <span class="truncate">Action ${act.codeSuffix || String.fromCharCode(65 + idx)}</span>
            <div class="dialogue-trigger-port action-option-port shrink-0 cursor-pointer ${hasRouteDiag ? 'has-connected-diag' : ''}" 
                 data-node-id="${node.id}" data-action-id="${act.id}" 
                 title="Click to spawn side-screen route suggestion dialogue for this option (or drag to connect)" 
                 onclick="event.stopPropagation(); createConnectedDialogueFromPort('${node.id}', 'action_option', '${act.id}')">
            </div>
            ${routeDiagPills}
          </div>
          ${removeBtn}
        </div>
      </th>`;

    const actChoiceLimitKey = getActionChoiceLimitKey(node);
    const actDescText = act.description || '';
    const actDescOver = isFieldTextOverLimit(actDescText, actChoiceLimitKey);
    actionDescHTML += `
      <td class="event-value-cell">
        <div class="flex flex-col gap-1 w-full">
          <div class="flex items-center justify-end w-full">
            ${getSymbolCounterBadgeHTML(actDescText, actChoiceLimitKey)}
          </div>
          <div class="editable-spot w-full block min-w-0 ${actDescOver ? 'is-over-limit' : ''}" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'actions.${idx}.description')">${actDescText || 'Add description...'}</div>
        </div>
      </td>`;

    const actBtnText = act.shortDescription || '';
    const actBtnOver = isFieldTextOverLimit(actBtnText, 'actionButtonText');
    actionShortDescHTML += `
      <td class="event-value-cell">
        <div class="flex flex-col gap-1 w-full">
          <div class="flex items-center justify-end w-full">
            ${getSymbolCounterBadgeHTML(actBtnText, 'actionButtonText')}
          </div>
          <div class="font-bold text-center editable-spot w-full block min-w-0 ${actBtnOver ? 'is-over-limit' : ''}" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'actions.${idx}.shortDescription')">${actBtnText || 'Choice'}</div>
        </div>
      </td>`;
    
    // Interactive Requirement Clauses with AND / OR Badges, Alternatives & Criteria Flags
    normalizeActionRequirements(act);
    const reqList = act.requirements || [];
    let clausesHTML = reqList.map((clause, clauseIdx) => {
      const itemsList = clause.items || [];
      let itemsHTML = itemsList.map((r, itemIdx) => {
        if (isCriteriaObject(r)) {
          return `
            <span class="req-pill criteria-pill" onclick="event.stopPropagation(); openEditRequirementItem('${node.id}', ${idx}, ${clauseIdx}, ${itemIdx})" title="Required Story Criteria Flag — click to change">
              <span>🔑</span>
              <span class="text-[9px] font-mono font-extrabold uppercase px-1 py-0.2 rounded bg-fuchsia-200/90 text-fuchsia-950 border border-fuchsia-400">Criteria</span>
              <span class="font-bold text-fuchsia-950">${r.name}</span>
              <button type="button" class="req-remove-btn" title="Remove requirement item" onclick="event.stopPropagation(); event.preventDefault(); removeRequirementItem('${node.id}', ${idx}, ${clauseIdx}, ${itemIdx})">×</button>
            </span>`;
        }
        const iconMarkup = r.iconImg ? `<img src="${r.iconImg}" class="w-4 h-4 object-contain inline-block mr-1">` : `${r.icon || '📦'} `;
        return `
          <span class="req-pill" onclick="event.stopPropagation(); openEditRequirementItem('${node.id}', ${idx}, ${clauseIdx}, ${itemIdx})">
            ${iconMarkup}<span>${r.name}</span><span class="font-mono text-gray-600 font-bold">x${r.amount || 1}</span>
            <button type="button" class="req-remove-btn" title="Remove requirement item" onclick="event.stopPropagation(); event.preventDefault(); removeRequirementItem('${node.id}', ${idx}, ${clauseIdx}, ${itemIdx})">×</button>
          </span>`;
      }).join('<span class="req-or-badge">OR</span>');

      const addAltBtn = itemsList.length < 3 ? `
        <button type="button" class="req-alt-add-btn" title="Add substitute replacement resource (max 3)" onclick="event.stopPropagation(); addRequirementAlternative('${node.id}', ${idx}, ${clauseIdx})">
          + OR
        </button>` : '';

      const showParen = itemsList.length > 1;
      return `
        <div class="req-clause-box">
          ${showParen ? '<span class="req-clause-paren">(</span>' : ''}
          ${itemsHTML}
          ${addAltBtn}
          ${showParen ? '<span class="req-clause-paren">)</span>' : ''}
        </div>`;
    }).join('<span class="req-and-badge">AND</span>');

    const addReqBtn = reqList.length < 4 ? `
      <button type="button" class="req-add-btn" onclick="event.stopPropagation(); openAddRequirementModal('${node.id}', ${idx})">
        + Add Req
      </button>` : '';

    actionReqHTML += `
      <td class="event-value-cell">
        <div class="flex flex-wrap items-center gap-1">
          ${clausesHTML}
          ${addReqBtn}
        </div>
      </td>`;

    actionTimerHTML += `<td class="event-value-cell text-center font-semibold editable-spot" onclick="event.stopPropagation(); makeInlineNumberEditable(this, '${node.id}', 'actions.${idx}.timerHours')">${act.timerHours ? act.timerHours + ' hours' : '—'}</td>`;
    
    // Check if this action option has connected post-action dialogues
    const linkedPostDialogues = (appData.dialogues || []).filter(d =>
      getDialogueLinks(d).some(l =>
        l.targetEventId === node.id &&
        (l.triggerTiming === 'post_action' || l.triggerTiming === 'post_event') &&
        l.triggerActionId === act.id
      )
    );
    const hasPostDiag = linkedPostDialogues.length > 0;
    let postDiagPills = '';
    if (hasPostDiag) {
      postDiagPills = `<div class="flex flex-wrap items-center gap-1 mt-1.5 pt-1 border-t border-gray-200/70">` +
        linkedPostDialogues.map(d => {
          const firstSpeaker = d.lines && d.lines[0] ? d.lines[0].speakerName : 'Dialogue';
          const delayBadge = d.delayHours ? ` (+${d.delayHours}h)` : '';
          return `
            <button type="button"
                    class="text-[10px] font-bold text-purple-900 hover:text-purple-950 bg-purple-100 hover:bg-purple-200 border border-purple-300 px-1.5 py-0.5 rounded-full transition inline-flex items-center gap-0.5 shadow-2xs"
                    title="Post-Action Dialogue (${firstSpeaker}${delayBadge}) — click to jump to dialogue block"
                    onclick="event.stopPropagation(); zoomInToBlock('${d.id}', true)">
              <span>💬</span><span class="truncate max-w-[95px]">${firstSpeaker}${delayBadge}</span>
            </button>
          `;
        }).join('') + `</div>`;
    }

    // Action Result with Symbol Counter & Post-Action Purple Dot
    const actResText = act.resultDescription || '';
    const actResOver = isFieldTextOverLimit(actResText, 'eventOutcome');
    actionResultHTML += `
      <td class="event-value-cell">
        <div class="flex flex-col gap-1 w-full">
          <div class="flex items-center justify-between w-full">
            <div class="dialogue-trigger-port post-action-port shrink-0 cursor-pointer ${hasPostDiag ? 'has-connected-diag' : ''}" data-node-id="${node.id}" data-action-id="${act.id}" title="Click to spawn connected Dialogue (or drag to existing)" onclick="event.stopPropagation(); createConnectedDialogueFromPort('${node.id}', 'post_action', '${act.id}')"></div>
            ${getSymbolCounterBadgeHTML(actResText, 'eventOutcome')}
          </div>
          <div class="w-full">
            <div class="editable-spot w-full block ${actResOver ? 'is-over-limit' : ''}" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'actions.${idx}.resultDescription')">${actResText || 'Action result description...'}</div>
            ${postDiagPills}
          </div>
        </div>
      </td>`;
    
    // Interactive Reward Pills
    let rewardPills = (act.rewards || []).map((rw, rwIdx) => {
      return formatRewardPillHTML(rw, node.id, idx, rwIdx, false);
    }).join(' ');

    actionRewardHTML += `
      <td class="event-value-cell">
        <div class="flex flex-wrap items-center gap-1">
          ${rewardPills}
          <button type="button" class="req-add-btn" onclick="event.stopPropagation(); openResourcePickerModal('${node.id}', ${idx}, 'reward', null)">
            + Add Reward
          </button>
        </div>
      </td>`;

    // Action Button with Multi-Target Event Links & Blue Connector Port
    const targetIds = getActionTargetIds(act, node.id);
    const targetNodeObjs = targetIds.map(tid => (appData.nodes || []).find(n => n.id === tid)).filter(Boolean);
    const targetPillsHTML = targetNodeObjs.map(tObj => `
      <span class="inline-flex items-center gap-0.5 bg-blue-100 hover:bg-blue-200 text-blue-950 border border-blue-400 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold shadow-2xs transition"
            onmousedown="event.stopPropagation();">
        <button type="button"
                class="linked-event-jump-btn cursor-pointer hover:underline text-blue-950 font-mono font-bold bg-transparent border-0 p-0 leading-none"
                title="Jump to ${tObj.codename} (${tObj.name})"
                onmousedown="event.stopPropagation();"
                onclick="event.stopPropagation(); navigateToLinkedEvent('${tObj.id}')">→ ${tObj.codename}</button>
        <button type="button" class="ml-0.5 text-red-600 hover:text-red-800 font-bold leading-none px-0.5 cursor-pointer"
                title="Disconnect link to ${tObj.codename}"
                onmousedown="event.stopPropagation();"
                onclick="event.stopPropagation(); disconnectActionTarget('${node.id}', '${act.id}', '${tObj.id}')">×</button>
      </span>
    `).join('');

    actionButtonsHTML += `
      <td class="event-value-cell text-center py-2 bg-yellow-100/50" id="action-btn-cell-${node.id}-${idx}">
        <div class="action-handle-group flex-wrap justify-center gap-1">
          <button type="button" class="action-handle" title="Click to link another target event by codename or spawn a new branch event" onmousedown="event.stopPropagation();" onclick="event.stopPropagation(); linkOrEditChoice('${node.id}', '${act.id}')">
            ${act.codeSuffix || String.fromCharCode(65 + idx)}: ${act.shortDescription || 'Choice'}
          </button>
          ${targetPillsHTML}
          <div class="connector-port action-port" data-node-id="${node.id}" data-action-id="${act.id}" title="${targetNodeObjs.length > 0 ? `Connected to ${targetNodeObjs.map(t => t.codename).join(', ')} — drag from blue circle to link additional events!` : 'Drag from blue circle to connect to one or more events'}"></div>
        </div>
      </td>`;
  });

  const addActionColHeader = (actionCols.length < 4 && !isReadOnly) ? `
    <button type="button" class="action-opt-icon-btn add-action-btn" 
            onclick="event.stopPropagation(); addActionColumn('${node.id}')" 
            title="Add Action Option (up to 4)">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>` : '';

  const addInactionBtn = (!hasInaction && !isReadOnly) ? `
    <button type="button" class="action-opt-icon-btn add-inaction-btn" 
            onclick="event.stopPropagation(); addInactionThreat('${node.id}')" 
            title="Add Inaction Threat">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    </button>` : '';

  // Inaction Threat Column Content (Rendered conditionally)
  let inactionHeaderHTML = '';
  let inactionDescCell = '';
  let inactionShortDescCell = '';
  let inactionReqCell = '';
  let inactionTimerCell = '';
  let inactionResultCell = '';
  let inactionRewardCell = '';
  let inactionBtnCell = '';

  if (hasInaction) {
    const inaction = node.inactionThreat || {};
    const inactionDesc = inaction.description || inaction.consequenceText || 'Survivors perish.';
    const inactionShort = inaction.shortDescription || 'Timeout';
    const inactionTimer = inaction.timerHours !== undefined ? inaction.timerHours : (node.reactionTimerHours || 'Infinite');
    const inactionResult = inaction.resultDescription || '';
    const inactResOver = isFieldTextOverLimit(inactionResult, 'inactionResult');

    let inactionPenaltyPills = (inaction.penalties || []).map((p, pIdx) => {
      return formatRewardPillHTML(p, node.id, -1, pIdx, true);
    }).join(' ');

    inactionHeaderHTML = `
      <th class="action-column-head inaction-column-head bg-red-100/90 text-red-950 border-red-300 font-bold" style="width: ${actionWidthPercent}%; padding: 4px 6px;">
        <div class="flex items-center justify-between px-1">
          <span class="truncate">⚠️ Inaction</span>
          ${!isReadOnly ? `
            <button type="button" class="text-xs text-red-600 hover:text-red-800 font-bold ml-1 bg-red-200/80 hover:bg-red-300 px-1.5 py-0.5 rounded transition" 
                    onclick="event.stopPropagation(); removeInactionThreat('${node.id}')" title="Remove Inaction Threat">
              ×
            </button>
          ` : ''}
        </div>
      </th>`;

    inactionDescCell = `
      <td class="event-value-cell bg-red-50/70 text-red-950 editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'inactionThreat.description')">${inactionDesc}</td>`;

    inactionShortDescCell = `
      <td class="event-value-cell bg-red-50/70 text-center font-bold text-red-900 editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'inactionThreat.shortDescription')">${inactionShort}</td>`;

    inactionReqCell = `
      <td class="event-value-cell bg-red-50/70 text-red-800 italic text-[11px]">
        Triggered if timer expires without choice
      </td>`;

    inactionTimerCell = `
      <td class="event-value-cell bg-red-50/70 text-center font-semibold text-red-900 editable-spot" onclick="event.stopPropagation(); makeInlineNumberEditable(this, '${node.id}', 'inactionThreat.timerHours')">
        ${inactionTimer === 'Infinite' ? '∞ Infinite' : inactionTimer + ' hours'}
      </td>`;

    inactionResultCell = `
      <td class="event-value-cell bg-red-50/70">
        <div class="flex flex-col gap-1 w-full">
          <div class="flex items-center justify-between w-full">
            <div class="dialogue-trigger-port post-action-port shrink-0 cursor-pointer" data-node-id="${node.id}" data-action-id="inaction" title="Click to spawn connected Dialogue (or drag to existing)" onclick="event.stopPropagation(); createConnectedDialogueFromPort('${node.id}', 'post_action', 'inaction')"></div>
            ${getSymbolCounterBadgeHTML(inactionResult, 'inactionResult')}
          </div>
          <div class="w-full editable-spot block text-red-950 ${inactResOver ? 'is-over-limit' : ''}" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'inactionThreat.resultDescription')">${inactionResult || 'Catastrophic failure'}</div>
        </div>
      </td>`;

    inactionRewardCell = `
      <td class="event-value-cell bg-red-50/70">
        <div class="flex flex-wrap items-center gap-1">
          ${inactionPenaltyPills}
          <button type="button" class="req-add-btn text-red-800 border-red-300 hover:bg-red-100" onclick="event.stopPropagation(); openResourcePickerModal('${node.id}', -1, 'inaction_penalty', null)">
            + Add Penalty
          </button>
        </div>
      </td>`;

    if (inaction.targetNodeId === node.id) {
      inaction.targetNodeId = null;
    }
    const inactionTargetObj = inaction.targetNodeId ? (appData.nodes || []).find(n => n.id === inaction.targetNodeId) : null;
    const inactionTargetPillHTML = inactionTargetObj ? `
      <span class="inline-flex items-center gap-0.5 bg-red-100 hover:bg-red-200 text-red-950 border border-red-400 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold shadow-2xs transition"
            onmousedown="event.stopPropagation();">
        <button type="button"
                class="linked-event-jump-btn cursor-pointer hover:underline text-red-950 font-mono font-bold bg-transparent border-0 p-0 leading-none"
                title="Jump to ${inactionTargetObj.codename} (${inactionTargetObj.name})"
                onmousedown="event.stopPropagation();"
                onclick="event.stopPropagation(); navigateToLinkedEvent('${inactionTargetObj.id}')">→ ${inactionTargetObj.codename}</button>
        <button type="button" class="ml-0.5 text-red-600 hover:text-red-800 font-bold leading-none px-0.5 cursor-pointer"
                title="Disconnect inaction link to ${inactionTargetObj.codename}"
                onmousedown="event.stopPropagation();"
                onclick="event.stopPropagation(); disconnectActionTarget('${node.id}', 'inaction')">×</button>
      </span>` : '';

    inactionBtnCell = `
      <td class="event-value-cell text-center py-2 bg-red-100/60" id="inaction-btn-cell-${node.id}">
        <div class="action-handle-group flex-wrap justify-center gap-1">
          <button type="button" class="action-handle bg-red-800 hover:bg-red-900 text-white border-red-700 font-bold" onmousedown="event.stopPropagation();" onclick="event.stopPropagation(); linkOrEditInaction('${node.id}')">
            Penalty Resolution
          </button>
          ${inactionTargetPillHTML}
          <div class="connector-port action-port" data-node-id="${node.id}" data-action-id="inaction" title="Drag line to connect Inaction consequence event"></div>
        </div>
      </td>`;
  }

  // Check if this event has connected pre-event dialogues
  const linkedPreDialogues = (appData.dialogues || []).filter(d =>
    getDialogueLinks(d).some(l => l.targetEventId === node.id && l.triggerTiming === 'pre_event')
  );
  const hasPreDiag = linkedPreDialogues.length > 0;
  const preDiagPills = hasPreDiag ? linkedPreDialogues.map(d => {
    const firstSpeaker = d.lines && d.lines[0] ? d.lines[0].speakerName : 'Pre-Event';
    return `
      <button type="button"
              class="text-[10px] font-bold text-purple-900 hover:text-purple-950 bg-purple-100 hover:bg-purple-200 border border-purple-300 px-1.5 py-0.5 rounded-full transition flex items-center gap-0.5 shadow-2xs"
              title="Pre-Event Dialogue (${firstSpeaker}) — click to jump to dialogue block"
              onclick="event.stopPropagation(); zoomInToBlock('${d.id}', true)">
        <span>⚡</span><span class="truncate max-w-[75px]">${firstSpeaker}</span>
      </button>
    `;
  }).join('') : '';

  const introText = node.eventIntro || '';
  const introOver = isFieldTextOverLimit(introText, 'eventIntro');
  const descText = node.eventDescription || '';
  const descOver = isFieldTextOverLimit(descText, 'eventDescription');

  const nodeVarObj = (appData.variations || []).find(v => v.id === (node.variationId || activeVariationId)) || currentVar;
  if ((node.category || 'KeyChain') === 'KeyChain' && nodeVarObj && nodeVarObj.name) {
    node.name = nodeVarObj.name;
    node.title = nodeVarObj.name;
  }
  const isKeyChainNode = (node.category || 'KeyChain') === 'KeyChain';
  const titleSpanHTML = isKeyChainNode
    ? `<span class="font-bold text-xs" title="Inherited from Variation (${escapeHtml(node.name)})">${escapeHtml(node.name)}</span>`
    : `<span class="font-bold text-xs editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'name')">${escapeHtml(node.name)}</span>`;

  const zoomControlsHTML = getFloatingZoomButtonsHTML(node.id, false);
  const poolSwitchBarHTML = isPoolEvent ? getPoolSwitchBarHTML(node, isDimmed, currentVar) : '';

  wrapper.innerHTML = `${zoomControlsHTML}<div class="event-card-inner">${poolSwitchBarHTML}<div class="event-card-body ${isDimmed ? 'is-pool-dimmed' : ''}">
        <!-- Event Block Header with Inbound Attachment Port and Pre-Event Trigger Port -->
      <div class="event-header flex justify-between items-center px-3 py-1.5">
        <div class="flex items-center gap-2">
          <div class="inbound-event-port cursor-pointer" data-node-id="${node.id}" title="Inbound attachment node: drop action choice connectors here to lead into this event (including from this block's own choices)" onclick="event.stopPropagation(); showInboundConnectionsInfo('${node.id}')"><div class="inbound-port-dot"></div></div>
          <span class="codename-badge editable-spot font-mono font-bold" onclick="event.stopPropagation(); makeInlineCodenameEditable(this, '${node.id}')">
            ${node.codename}
          </span>
          ${titleSpanHTML}
          <div class="dialogue-trigger-port pre-event-port shrink-0 cursor-pointer ${hasPreDiag ? 'has-connected-diag' : ''}" data-node-id="${node.id}" title="Click to spawn connected Dialogue (or drag to existing)" onclick="event.stopPropagation(); createConnectedDialogueFromPort('${node.id}', 'pre_event', null)"></div>
          ${preDiagPills}
        </div>

        <div class="flex items-center gap-1.5">
          <button type="button" class="comment-trigger-badge" title="Comments & Discussions" onclick="event.stopPropagation(); openCommentsDrawer('${node.id}', 'event')">
            💬 <span class="cmt-cnt-${node.id}">${getCommentCount(node.id)}</span>
          </button>
          <select class="event-theme-select ${isReadOnly ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}" 
                  title="Change Event Block Color Scheme"
                  ${isReadOnly ? 'disabled' : ''}
                  onclick="event.stopPropagation();"
                  onmousedown="event.stopPropagation();"
                  onchange="updateNodeColorScheme('${node.id}', this.value)">
            <option value="amber" ${theme === 'amber' ? 'selected' : ''}>🟡 Amber</option>
            <option value="blue" ${theme === 'blue' ? 'selected' : ''}>🔵 Blue</option>
            <option value="emerald" ${theme === 'emerald' ? 'selected' : ''}>🟢 Green</option>
            <option value="purple" ${theme === 'purple' ? 'selected' : ''}>🟣 Purple</option>
            <option value="rose" ${theme === 'rose' ? 'selected' : ''}>🔴 Red</option>
            <option value="slate" ${theme === 'slate' ? 'selected' : ''}>⚪ Slate</option>
            <option value="orange" ${theme === 'orange' ? 'selected' : ''}>🟠 Orange</option>
            <option value="teal" ${theme === 'teal' ? 'selected' : ''}>🌊 Teal</option>
          </select>

          ${!isReadOnly ? `
            <button type="button" class="card-btn card-btn-delete" 
                    onclick="event.stopPropagation(); deleteEventNode('${node.id}')" title="Delete Event Block">
              ✕ Delete
            </button>
          ` : ''}
        </div>
      </div>

    <!-- Event Appearance Spawn conditions Row -->
    <div class="event-location-row px-3 py-1 flex items-center gap-2 text-xs">
      <span class="font-bold text-[11px] uppercase tracking-wider shrink-0 theme-substrip-label">Spawn conditions:</span>
      <div class="editable-spot italic text-gray-800 flex-1 truncate" 
           title="Click to specify spawn conditions for this event"
           onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'spawnConditions')">${(node.spawnConditions !== undefined && node.spawnConditions !== null && node.spawnConditions !== '') ? node.spawnConditions : (node.location || 'Click to set spawn conditions...')}</div>
    </div>

    <!-- Event-Level Metadata Header Strip -->
    <div class="event-meta-row px-3 py-1.5 flex items-start justify-between gap-3 text-xs">
      <div class="flex items-center gap-2 shrink-0 pt-0.5">
        <span class="font-bold text-[11px] uppercase tracking-wider theme-substrip-label">Type:</span>
        <select class="inline-select bg-white border font-bold text-xs py-0.5 px-2 rounded ${isReadOnly ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}" 
                ${isReadOnly ? 'disabled' : ''}
                onchange="updateNodeField('${node.id}', 'type', this.value)">
          <option value="World" ${node.type === 'World' ? 'selected' : ''}>World Event</option>
          <option value="Deck" ${node.type === 'Deck' ? 'selected' : ''}>Deck Event</option>
        </select>
      </div>

      <div class="flex flex-col gap-0.5 flex-1 min-w-0 mx-1">
        <div class="flex items-center justify-between w-full">
          <span class="font-bold text-[11px] uppercase tracking-wider shrink-0 theme-substrip-label">Intro:</span>
          ${getSymbolCounterBadgeHTML(introText, 'eventIntro')}
        </div>
        <div class="editable-spot text-xs italic leading-snug text-gray-800 w-full block break-words ${introOver ? 'is-over-limit' : ''}" 
             title="Click to edit event intro text"
             onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'eventIntro')">${introText || 'Distress signal coming from Keeling island...'}</div>
      </div>

      <div class="flex items-center gap-1.5 shrink-0 pt-0.5 whitespace-nowrap">
        <span class="font-bold text-[11px] uppercase tracking-wider theme-substrip-label">Reaction:</span>
        <select class="rx-timer-select ${isReadOnly ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}"
                title="Reaction time limit (Infinite or hours)"
                ${isReadOnly ? 'disabled' : ''}
                onclick="event.stopPropagation();"
                onmousedown="event.stopPropagation();"
                onchange="updateNodeReactionTimer('${node.id}', this.value)">
          ${getReactionTimerOptionsHTML(node.reactionTimerHours)}
        </select>
      </div>
    </div>

    <div class="event-desc-row px-3 py-1.5 text-xs">
      <div class="flex flex-col gap-0.5 w-full">
        <div class="flex items-center justify-between w-full">
          <span class="font-bold text-[11px] uppercase tracking-wider shrink-0 theme-substrip-label">Description:</span>
          ${getSymbolCounterBadgeHTML(descText, 'eventDescription')}
        </div>
        <div class="editable-spot leading-snug text-gray-800 w-full block ${descOver ? 'is-over-limit' : ''}" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'eventDescription')">${descText || 'Event context description...'}</div>
      </div>
    </div>

    <!-- Actions & Inaction Threat Table -->
    <table class="event-table">
      <thead>
        <tr>
          <th class="event-label-cell" style="width: 180px; min-width: 180px; max-width: 180px; padding: 4px 6px;">
            <div class="flex items-center justify-between px-2 py-0.5 gap-1">
              <span class="font-bold text-[11px] uppercase tracking-wide truncate">Action Options</span>
              <div class="flex items-center gap-1 shrink-0">
                ${addActionColHeader}
                ${addInactionBtn}
              </div>
            </div>
          </th>
          ${actionHeadersHTML}
          ${inactionHeaderHTML}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="event-label-cell">
            <div>Event Choice</div>
            <div class="text-[9px] font-mono text-gray-500 font-normal">Limit: ${limits[getActionChoiceLimitKey(node)]} (${actionCols.length >= 3 ? '3 opt' : '2 opt'})</div>
          </td>
          ${actionDescHTML}
          ${inactionDescCell}
        </tr>

        <tr>
          <td class="event-label-cell">
            <div>Action Button Text</div>
            <div class="text-[9px] font-mono text-gray-500 font-normal">Limit: ${limits.actionButtonText}</div>
          </td>
          ${actionShortDescHTML}
          ${inactionShortDescCell}
        </tr>

        <tr>
          <td class="event-label-cell">Action Requirements</td>
          ${actionReqHTML}
          ${inactionReqCell}
        </tr>

        <tr>
          <td class="event-label-cell">Action Timer</td>
          ${actionTimerHTML}
          ${inactionTimerCell}
        </tr>

        <tr>
          <td class="event-label-cell">
            <div>Event Outcome</div>
            <div class="text-[9px] font-mono text-gray-500 font-normal">Limit: ${limits.eventOutcome}${hasInaction ? ` (Inact: ${limits.inactionResult})` : ''}</div>
          </td>
          ${actionResultHTML}
          ${inactionResultCell}
        </tr>

        <tr>
          <td class="event-label-cell">Reward / Outcome</td>
          ${actionRewardHTML}
          ${inactionRewardCell}
        </tr>

        <tr>
          <td class="event-label-cell font-bold text-amber-900">Action Resolution</td>
          ${actionButtonsHTML}
          ${inactionBtnCell}
        </tr>
      </tbody>
    </table>
      </div>
    </div>
  `;

  return wrapper;
}

function deleteEventNode(nodeId) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("delete event block")) return;
  if (!confirm("Are you sure you want to delete this event block?")) return;
  pushUndoState();

  const targetNode = (appData.nodes || []).find(n => n.id === nodeId);
  const floor = targetNode ? targetNode.floorIndex : null;
  const cat = targetNode ? targetNode.category : null;
  const varId = targetNode ? targetNode.variationId : null;

  appData.nodes = appData.nodes.filter(n => n.id !== nodeId);

  // Clear incoming target references
  appData.nodes.forEach(n => {
    (n.actions || []).forEach(act => {
      removeActionTargetId(act, nodeId, n.id);
    });
    if (n.inactionThreat && n.inactionThreat.targetNodeId === nodeId) {
      n.inactionThreat.targetNodeId = null;
    }
  });

  // Clear dialogue links
  appData.dialogues.forEach(d => {
    if (d.targetEventId === nodeId) d.targetEventId = null;
  });

  if (selectedBlockId === nodeId) {
    selectedBlockId = null;
  }
  if (maxZoomedBlockId === nodeId) {
    maxZoomedBlockId = null;
    window.maxZoomedBlockId = null;
  }

  if (floor !== null && floor !== undefined) {
    resequenceStageEventCodenames(floor, cat, varId);
  }

  saveProjectToLocalStorage();
  renderApp();
  showToast("Event block deleted", "info");
}

function deleteDialogueNode(dialogueId, skipConfirm = false) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("delete dialogue block")) return;
  if (!skipConfirm && !confirm("Are you sure you want to delete this dialogue block?")) return;
  pushUndoState();

  appData.dialogues = (appData.dialogues || []).filter(d => d.id !== dialogueId);

  if (selectedBlockId === dialogueId) {
    selectedBlockId = null;
  }
  if (maxZoomedBlockId === dialogueId) {
    maxZoomedBlockId = null;
    window.maxZoomedBlockId = null;
  }

  saveProjectToLocalStorage();
  renderApp();
  showToast("Dialogue block deleted", "info");
}

function updateNodeColorScheme(nodeId, colorScheme) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("change event color scheme")) {
    renderApp();
    return;
  }
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;
  pushUndoState();
  node.colorScheme = colorScheme;
  saveProjectToLocalStorage();
  renderApp();
  showToast(`Color scheme updated to ${colorScheme}`, "info");
}

function updateDialogueColorScheme(dialogueId, colorScheme) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("change dialogue color scheme")) {
    renderApp();
    return;
  }
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (!diag) return;
  pushUndoState();
  diag.colorScheme = colorScheme;
  saveProjectToLocalStorage();
  renderApp();
  showToast(`Dialogue color scheme updated to ${colorScheme}`, "info");
}

window.deleteDialogueNode = deleteDialogueNode;
window.updateNodeColorScheme = updateNodeColorScheme;
window.updateDialogueColorScheme = updateDialogueColorScheme;

function addActionColumn(nodeId) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("add action option")) return;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;
  if (!node.actions) node.actions = [];
  if (node.actions.length >= 4) {
    alert("Maximum of 4 action options allowed per event block.");
    return;
  }

  pushUndoState();
  const newIdx = node.actions.length;
  const nextLetter = String.fromCharCode(65 + newIdx);

  node.actions.push({
    id: `act_${Date.now()}`,
    codeSuffix: nextLetter,
    shortDescription: `Choice ${nextLetter}`,
    description: `Description for action choice ${nextLetter}...`,
    requirements: [],
    timerHours: 5,
    resultDescription: "",
    rewards: ["🧠 Knowledge +100"]
  });

  saveProjectToLocalStorage();
  renderApp();
  showToast(`Action Option ${nextLetter} added`, "success");
}

function removeActionColumn(nodeId, actionIdx) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("remove action option")) return;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node || !node.actions || node.actions.length <= 1) return;

  pushUndoState();
  node.actions.splice(actionIdx, 1);
  saveProjectToLocalStorage();
  renderApp();
  showToast("Action column removed", "info");
}

// Deck Event Node Layout
function createDeckNodeDOM(node) {
  const wrapper = document.createElement('div');
  wrapper.id = `node-${node.id}`;
  wrapper.className = 'absolute deck-event-card cursor-move';
  wrapper.style.left = `${node.position.x}px`;
  let choicesHTML = (node.actions || []).map((act, idx) => {
    let reqPills = (act.requirements || []).map(r => {
      const iconMarkup = r.iconImg ? `<img src="${r.iconImg}" class="w-5 h-5 object-contain inline-block">` : `${r.icon || '📦'} `;
      return `<div class="text-center font-bold text-xs">${iconMarkup}<div class="text-[10px] text-gray-700">${r.name}</div></div>`;
    }).join(' ');

    return `
      <div class="flex-1 bg-white border border-gray-300 rounded-lg p-3 shadow-sm flex flex-col justify-between">
        <div>
          <div class="font-bold text-xs text-center border-b pb-1 text-gray-900">${act.shortDescription || 'Choice'}</div>
          <p class="text-[11px] text-gray-600 my-2 leading-tight">${act.description || ''}</p>
        </div>
        <div>
          <div class="text-[10px] font-bold text-gray-500 uppercase mb-1">Requirements:</div>
          <div class="flex flex-wrap justify-around items-center bg-gray-50 p-1 rounded">${reqPills || '<span class="text-xs text-gray-400">None</span>'}</div>
        </div>
      </div>
    `;
  }).join('');

  const zoomControlsHTML = getFloatingZoomButtonsHTML(node.id, false);
  wrapper.innerHTML = `${zoomControlsHTML}
    <div class="flex justify-between items-start mb-3">
      <div class="inbound-event-port cursor-pointer mr-2 mt-1" data-node-id="${node.id}" title="Inbound attachment node: drop action choice connectors here to lead into this event (including from this block's own choices)" onclick="event.stopPropagation(); showInboundConnectionsInfo('${node.id}')"><div class="inbound-port-dot"></div></div>
      <div class="space-y-2">
        <div class="deck-tag-condition">Conditions: <span class="editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'conditions')">${node.conditions || 'in the open sea'}</span></div>
        <div class="deck-tag-target">Target: <span class="editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'target')">${node.target || 'Behemoth'}</span></div>
      </div>

      <div class="deck-title-box flex-1 mx-4 font-mono">
        ${node.codename}
        <span class="text-xs font-sans text-emerald-800 block font-normal">✔ Verified Deck Quest</span>
      </div>

      <div class="deck-premise-card w-48 flex justify-between items-start">
        <div>
          <h4 class="font-bold text-xs mb-1">${node.name}</h4>
          <p class="text-[11px] leading-tight editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'eventDescription')">${node.eventDescription}</p>
        </div>
        <button type="button" onclick="event.stopPropagation(); deleteEventNode('${node.id}')" class="text-xs font-bold text-red-600 hover:text-red-800">✕</button>
      </div>
    </div>

    <div class="flex space-x-3 my-3">
      ${choicesHTML}
      <div class="w-48 bg-white border border-gray-300 rounded-lg p-3 shadow-sm flex flex-col justify-between">
        <div>
          <div class="font-bold text-xs text-gray-800 text-center border-b pb-1">Inaction Penalty</div>
          <p class="text-xs text-red-700 italic my-2 editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'inactionThreat.consequenceText')">${node.inactionThreat ? node.inactionThreat.consequenceText : 'Default penalty'}</p>
        </div>
        <div class="text-center"><span class="text-2xl">😡</span><div class="font-bold text-xs text-red-600">Morale</div><div class="font-mono text-xs text-red-600">-10</div></div>
      </div>
    </div>
  `;

  return wrapper;
}

// Generic Event Node Layout
function createGenericNodeDOM(node) {
  const wrapper = document.createElement('div');
  wrapper.id = `node-${node.id}`;
  wrapper.className = 'absolute generic-event-card cursor-move';
  wrapper.style.left = `${node.position.x}px`;
  wrapper.style.top = `${node.position.y}px`;

  let choicesHTML = (node.actions || []).map((act, idx) => {
    let reqPills = (act.requirements || []).map(r => {
      const iconMarkup = r.iconImg ? `<img src="${r.iconImg}" class="w-6 h-6 object-contain inline-block">` : `${r.icon || '📦'} `;
      return `<div class="text-center font-bold text-xs">${iconMarkup}<div class="text-[10px] text-gray-700 font-semibold">${r.name}</div><div class="font-mono text-xs text-gray-900">${r.amount || 1}</div></div>`;
    }).join(' ');

    return `
      <div class="flex-1 generic-card-box">
        <div class="font-bold text-xs text-center border-b pb-1">${act.shortDescription || 'Choice'}</div>
        <div class="py-2 flex justify-around items-center">${reqPills || '<span class="text-xs text-gray-400">None</span>'}</div>
      </div>
    `;
  }).join('');

  const zoomControlsHTML = getFloatingZoomButtonsHTML(node.id, false);
  wrapper.innerHTML = `${zoomControlsHTML}
    <div class="flex justify-between items-center mb-3">
      <div class="inbound-event-port cursor-pointer mr-2" data-node-id="${node.id}" title="Inbound attachment node: drop action choice connectors here to lead into this event (including from this block's own choices)" onclick="event.stopPropagation(); showInboundConnectionsInfo('${node.id}')"><div class="inbound-port-dot"></div></div>
      <div class="generic-banner flex-1">${node.codename}</div>
      <div class="generic-premise-card ml-4 w-64 bg-amber-100 border border-amber-300 p-2 rounded text-xs text-amber-900 editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'eventDescription')">${node.eventDescription}</div>
      <button type="button" onclick="event.stopPropagation(); deleteEventNode('${node.id}')" class="text-xs font-bold text-red-600 hover:text-red-800 ml-2">✕</button>
    </div>

    <div class="generic-title-block mb-3 font-mono">${node.name}</div>

    <div class="flex space-x-3 mb-3">
      ${choicesHTML}
    </div>

    <div class="flex space-x-3">
      <div class="flex-1 generic-card-box flex justify-around items-center">
        <div class="text-center"><img src="icons/T_Fruit-Paste.png" class="w-6 h-6 inline-block"><div class="text-[10px]">Omni Fruit</div><div class="font-bold text-xs">40</div></div>
        <div class="text-center"><img src="icons/T_Comm_Link.png" class="w-6 h-6 inline-block"><div class="text-[10px]">Cryocapsules</div><div class="font-bold text-xs">2 - 5</div></div>
        <div class="text-center"><span class="text-xl">🧠</span><div class="text-[10px] text-purple-700">Knowledge</div><div class="font-bold text-xs">30</div></div>
      </div>
    </div>
  `;

  return wrapper;
}

// Multi-Link Dialogue Helpers: Allow connecting one dialogue block to multiple action outcomes / events
function getDialogueLinks(diag) {
  if (!diag) return [];
  if (Array.isArray(diag.links)) {
    diag.links = diag.links.filter(l => l && l.targetEventId);
    if (diag.links.length > 0) {
      return diag.links;
    }
  }
  if (diag.targetEventId) {
    const sourceNode = (appData && appData.nodes) ? appData.nodes.find(n => n.id === diag.targetEventId) : null;
    const timing = diag.triggerTiming || 'pre_event';
    const actId = diag.triggerActionId || null;
    diag.links = [{
      id: `dlink_0`,
      targetEventId: diag.targetEventId,
      triggerTiming: timing,
      triggerActionId: actId,
      triggerCondition: diag.triggerCondition || formatDialogueTriggerCondition(timing, sourceNode, actId)
    }];
    return diag.links;
  }
  diag.links = [];
  return diag.links;
}

function syncDialoguePrimaryFields(diag) {
  if (!diag) return;
  const links = Array.isArray(diag.links) ? diag.links.filter(l => l && l.targetEventId) : [];
  diag.links = links;
  if (links.length > 0) {
    diag.targetEventId = links[0].targetEventId;
    diag.triggerTiming = links[0].triggerTiming || 'pre_event';
    diag.triggerActionId = links[0].triggerActionId || null;
    if (links.length === 1) {
      diag.triggerCondition = links[0].triggerCondition || '';
    } else {
      diag.triggerCondition = links.map(l => l.triggerCondition || 'Trigger').join(' • ');
    }
  } else {
    diag.targetEventId = null;
    diag.triggerTiming = null;
    diag.triggerActionId = null;
  }
}

function addDialogueLink(diag, targetEventId, triggerTiming, triggerActionId) {
  if (!diag || !targetEventId) return;
  const links = getDialogueLinks(diag);
  const timing = triggerTiming || 'post_action';
  const actId = triggerActionId || null;
  const sourceNode = (appData.nodes || []).find(n => n.id === targetEventId);
  const cond = formatDialogueTriggerCondition(timing, sourceNode, actId);

  const existingIdx = links.findIndex(l =>
    l.targetEventId === targetEventId &&
    (l.triggerTiming || 'pre_event') === timing &&
    (l.triggerActionId || null) === actId
  );

  if (existingIdx !== -1) {
    links[existingIdx].triggerCondition = cond;
  } else {
    links.push({
      id: `dlink_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      targetEventId,
      triggerTiming: timing,
      triggerActionId: actId,
      triggerCondition: cond
    });
  }
  syncDialoguePrimaryFields(diag);
}

function removeDialogueLinkAt(dialogueId, linkIdx) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("disconnect dialogue link")) return;
  const diag = (appData.dialogues || []).find(d => d.id === dialogueId);
  if (!diag) return;
  const links = getDialogueLinks(diag);
  if (linkIdx < 0 || linkIdx >= links.length) return;
  pushUndoState();
  links.splice(linkIdx, 1);
  syncDialoguePrimaryFields(diag);
  saveProjectToLocalStorage();
  renderApp();
  showToast("Disconnected dialogue link", "info");
}

// Dialogue Block DOM Creation (REQUIREMENT 4 FIX: Structured Time Delay & Trigger Badges + Multi-Link Support)
function createDialogueNodeDOM(dialogue) {
  const isReadOnly = (typeof canUserEdit === 'function') 
    ? !canUserEdit() 
    : (typeof isCurrentBoardReadOnly === 'function' ? isCurrentBoardReadOnly() : Boolean(isCurrentBoardReadOnly));

  const wrapper = document.createElement('div');
  wrapper.id = `dialogue-${dialogue.id}`;
  wrapper.className = 'absolute dialogue-card cursor-move';
  wrapper.style.left = `${dialogue.position.x}px`;
  wrapper.style.top = `${dialogue.position.y}px`;

  const allChars = getGlobalCharactersPool();
  const enabledChars = getEnabledCharactersForVariation(activeVariationId);

  const links = getDialogueLinks(dialogue);
  const validLinks = links.map((l, idx) => ({
    link: l,
    idx,
    node: appData.nodes.find(n => n.id === l.targetEventId)
  })).filter(item => Boolean(item.node));

  const primaryItem = validLinks[0] || null;
  const targetNode = primaryItem ? primaryItem.node : null;
  const primaryLink = primaryItem ? primaryItem.link : null;
  const isDetached = validLinks.length === 0;
  const isActionOption = !isDetached && validLinks.some(item => item.link.triggerTiming === 'action_option');

  const isTargetDimmed = !isDetached && validLinks.every(item => isPoolNodeDimmed(item.node.id, activeVariationId));
  const theme = dialogue.colorScheme || 'purple';
  wrapper.className = `absolute dialogue-card dialogue-theme-${theme} cursor-move ${isDetached ? 'is-detached' : ''} ${isActionOption ? 'is-action-option' : ''} ${isTargetDimmed ? 'is-pool-dimmed' : ''}`;

  let linesHTML = dialogue.lines.map((l, lIdx) => {
    const matchedChar = allChars.find(c => c.id === l.speakerId || c.name === l.speakerName);
    const charMeta = matchedChar || { color: '#e5e7eb', textColor: '#1f2937', icon: '👤' };
    const isFirst = lIdx === 0;
    const isLast = lIdx === dialogue.lines.length - 1;

    // Build dropdown options from enabled characters in this variation;
    // if the line's current character is disabled in this variation, include it with a (Disabled in V#) indicator so it doesn't silently switch
    const dropdownChars = [...enabledChars];
    if (matchedChar && !dropdownChars.some(c => c.id === matchedChar.id)) {
      dropdownChars.unshift({ ...matchedChar, _isDisabledInVar: true });
    }

    return `
      <div class="dialogue-row" data-line-index="${lIdx}">
        <div class="dialogue-speaker-banner flex items-center justify-between" style="background-color:${charMeta.color}; color:${charMeta.textColor}">
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <span>${charMeta.icon}</span>
            <select class="inline-select text-xs font-bold ${isReadOnly ? 'opacity-80 cursor-not-allowed pointer-events-none' : ''}" 
                    ${isReadOnly ? 'disabled' : ''} 
                    onchange="updateDialogueSpeaker('${dialogue.id}', ${lIdx}, this.value)">
              ${dropdownChars.map(c => {
                const isSelected = (matchedChar && c.id === matchedChar.id) || c.id === l.speakerId;
                const roleSuffix = c.role ? ` (${c.role})` : '';
                const disabledBadge = c._isDisabledInVar ? ' [Disabled]' : '';
                return `<option value="${c.id}" ${isSelected ? 'selected' : ''}>${c.name}${roleSuffix}${disabledBadge}</option>`;
              }).join('')}
            </select>
          </div>

          <div class="flex items-center gap-1 shrink-0 ml-1">
            <!-- Move Line Up -->
            <button type="button" 
                    class="line-move-btn px-1.5 py-0.5 rounded text-[11px] font-bold transition ${(isFirst || isReadOnly) ? 'opacity-25 cursor-not-allowed pointer-events-none' : 'hover:bg-black/15 hover:scale-110 active:scale-95'}" 
                    title="Move line up" 
                    ${(isFirst || isReadOnly) ? 'disabled' : ''} 
                    onclick="event.stopPropagation(); moveDialogueLine('${dialogue.id}', ${lIdx}, -1)">
              ▲
            </button>

            <!-- Move Line Down -->
            <button type="button" 
                    class="line-move-btn px-1.5 py-0.5 rounded text-[11px] font-bold transition ${(isLast || isReadOnly) ? 'opacity-25 cursor-not-allowed pointer-events-none' : 'hover:bg-black/15 hover:scale-110 active:scale-95'}" 
                    title="Move line down" 
                    ${(isLast || isReadOnly) ? 'disabled' : ''} 
                    onclick="event.stopPropagation(); moveDialogueLine('${dialogue.id}', ${lIdx}, 1)">
              ▼
            </button>

            <!-- Add Line Below -->
            <button type="button" 
                    class="line-add-btn text-[11px] px-1.5 py-0.5 rounded font-bold transition ${isReadOnly ? 'opacity-25 cursor-not-allowed pointer-events-none' : 'bg-black/10 hover:bg-black/20 hover:scale-105 active:scale-95'}" 
                    title="Insert new dialogue line under this line" 
                    ${isReadOnly ? 'disabled' : ''}
                    onclick="event.stopPropagation(); insertDialogueLineBelow('${dialogue.id}', ${lIdx})">
              + Line
            </button>

            <!-- Delete Line -->
            <button type="button" 
                    class="line-delete-btn text-xs px-1 rounded font-bold transition ml-0.5 ${isReadOnly ? 'opacity-25 cursor-not-allowed pointer-events-none' : 'text-red-600 hover:text-red-800 hover:bg-red-200/50'}" 
                    title="Delete Line" 
                    ${isReadOnly ? 'disabled' : ''} 
                    onclick="event.stopPropagation(); deleteDialogueLine('${dialogue.id}', ${lIdx})">
              ×
            </button>
          </div>
        </div>

        <div class="dialogue-text ${isReadOnly ? 'cursor-default' : 'editable-spot'}" onclick="event.stopPropagation(); ${isReadOnly ? '' : `makeInlineDialogueTextEditable(this, '${dialogue.id}', ${lIdx})`}">${l.text || 'Speech text...'}</div>
      </div>
    `;
  }).join('');

  const buildLinkControlsHTML = (item, showRemoveBtn) => {
    const lNode = item.node;
    const lObj = item.link;
    const lIdx = item.idx;
    const lIsActionOpt = lObj.triggerTiming === 'action_option';
    return `
      <div class="flex items-center gap-1 min-w-0">
        <select class="inline-select text-[10px] font-bold uppercase tracking-wider ${lIsActionOpt ? 'bg-indigo-100 text-indigo-950 border-indigo-400' : 'bg-purple-200 text-purple-950 border-purple-400'} border rounded px-1.5 py-0.5 max-w-[170px] truncate shadow-xs shrink ${isReadOnly ? 'opacity-75 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}"
                title="Change dialogue trigger timing: Pre-Event, Route Suggestion, or Post-Action"
                ${isReadOnly ? 'disabled' : ''}
                onchange="updateDialogueTriggerTiming('${dialogue.id}', this.value, ${lIdx})">
          <option value="pre_event" ${lObj.triggerTiming === 'pre_event' ? 'selected' : ''}>⚡ Pre-Event (Before Window)</option>
          ${(lNode.actions || []).map((act, aIdx) => `
            <option value="action_option:${act.id}" ${(lObj.triggerTiming === 'action_option' && lObj.triggerActionId === act.id) ? 'selected' : ''}>
              💬 Suggest Route: Option ${aIdx + 1} (${act.shortDescription || 'Choice'})
            </option>
          `).join('')}
          ${(lNode.actions || []).map((act, aIdx) => `
            <option value="post_action:${act.id}" ${(lObj.triggerTiming === 'post_action' && lObj.triggerActionId === act.id) ? 'selected' : ''}>
              🏁 Post-Action: Option ${aIdx + 1} (${act.shortDescription || 'Choice'})
            </option>
          `).join('')}
          ${lNode.hasInactionThreat ? `
            <option value="post_action:inaction" ${(lObj.triggerTiming === 'post_action' && lObj.triggerActionId === 'inaction') ? 'selected' : ''}>
              💀 Post-Inaction Failure
            </option>
          ` : ''}
        </select>
        <button type="button" 
                class="card-btn card-btn-jump shrink-0" 
                title="Jump to Event ${lNode.codename}"
                onclick="event.stopPropagation(); zoomInToBlock('${lNode.id}', false)">
          ${lNode.codename} ↗
        </button>
        ${(showRemoveBtn && !isReadOnly) ? `
          <button type="button"
                  class="text-[11px] font-bold text-red-700 hover:text-red-900 bg-red-100 hover:bg-red-200 border border-red-300 rounded px-1.5 py-0.5 shrink-0 transition"
                  title="Disconnect this specific trigger link"
                  onclick="event.stopPropagation(); removeDialogueLinkAt('${dialogue.id}', ${lIdx})">
            ×
          </button>
        ` : ''}
      </div>
    `;
  };

  const extraLinksHTML = validLinks.length > 1
    ? `<div class="flex flex-col gap-1 mb-1.5 pl-4 border-l-2 border-purple-400/60">
        ${validLinks.slice(1).map(item => buildLinkControlsHTML(item, true)).join('')}
       </div>`
    : '';

  const zoomControlsHTML = getFloatingZoomButtonsHTML(dialogue.id, true);

  wrapper.innerHTML = `${zoomControlsHTML}<div class="dialogue-card-inner">
      <div class="dialogue-header pb-1.5">
        <div class="flex justify-between items-center gap-2 mb-1.5 flex-nowrap">
          <div class="flex items-center gap-1.5 cursor-grab flex-1 min-w-0" title="Drag dialogue block anywhere">
            <span class="text-purple-600 font-bold select-none cursor-grab text-xs px-0.5 shrink-0" title="Drag dialogue block">⠿</span>
            ${isDetached ? `
              <span class="text-[10px] font-bold uppercase tracking-wider text-amber-950 bg-amber-300 border border-amber-400 px-2 py-0.5 rounded cursor-grab shadow-xs shrink-0">
                Detached Dialogue
              </span>
              <span class="text-[10px] font-semibold text-amber-700 italic px-0.5 truncate">
                (No Event Linked)
              </span>
            ` : buildLinkControlsHTML(primaryItem, validLinks.length > 1)}
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" class="comment-trigger-badge" title="Comments & Discussions" onclick="event.stopPropagation(); openCommentsDrawer('${dialogue.id}', 'dialogue')">
              💬 <span class="cmt-cnt-${dialogue.id}">${getCommentCount(dialogue.id)}</span>
            </button>
            ${(!isDetached && !isReadOnly) ? `
              <button type="button" class="card-btn card-btn-unlink" 
                      title="${validLinks.length > 1 ? 'Disconnect all linked triggers' : 'Disconnect from Event'}" onclick="event.stopPropagation(); disconnectDialogueLink('${dialogue.id}')">
                ⊘ ${validLinks.length > 1 ? 'Unlink All' : 'Unlink'}
              </button>
            ` : ''}
            ${!isReadOnly ? `
              <button type="button" class="card-btn card-btn-delete" 
                      title="Delete Dialogue Block" onclick="event.stopPropagation(); deleteDialogueNode('${dialogue.id}')">
                ✕ Delete
              </button>
            ` : ''}
          </div>
        </div>
        ${extraLinksHTML}

        <!-- Structured Time Delay Controls (Measured strictly in hours) -->
        <div class="dialogue-delay-strip flex items-center justify-between p-1.5 rounded-lg border text-xs">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-[11px]">⏱ Delay:</span>
            <input type="number" class="inline-input w-16 font-bold text-center px-1.5 py-0.5 rounded ${isReadOnly ? 'opacity-70 cursor-not-allowed bg-gray-100/90 text-gray-500 pointer-events-none' : ''}" 
                   value="${dialogue.delayHours !== undefined ? dialogue.delayHours : (dialogue.delayMinutes !== undefined ? (dialogue.delayMinutes >= 60 ? dialogue.delayMinutes/60 : dialogue.delayMinutes) : 0)}" 
                   min="0" step="0.5" 
                   ${isReadOnly ? 'disabled readonly' : ''}
                   onchange="updateDialogueDelayHours('${dialogue.id}', this.value)">
            <span class="font-bold text-xs">hours</span>
          </div>

          <div class="text-[10px] font-semibold italic truncate ${isReadOnly ? 'cursor-default text-purple-900/70' : 'cursor-pointer hover:underline editable-spot'} flex-1 text-right ml-2" 
               title="${isReadOnly ? 'Trigger condition' : 'Click to edit trigger condition'}"
               onclick="event.stopPropagation(); ${isReadOnly ? '' : `makeInlineDialogueConditionEditable(this, '${dialogue.id}', 0)`}">
            ${dialogue.triggerCondition || (isDetached ? 'Detached Conversation' : 'Dialog spawn trigger')}
          </div>
        </div>
      </div>
      <div class="divide-y divide-gray-200">
        ${linesHTML}
      </div>
      <div class="dialogue-footer relative p-2 border-t flex items-center justify-center">
        <button type="button" 
                class="dialogue-add-btn text-xs font-bold border rounded-lg px-3.5 py-1.5 flex items-center gap-1.5 transition shadow-sm ${isReadOnly ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'active:scale-95'}"
                ${isReadOnly ? 'disabled' : ''}
                onclick="event.stopPropagation(); addDialogueLineTurn('${dialogue.id}')" 
                title="Add new dialogue line under existing lines">
          <span class="text-sm font-bold leading-none">+</span> <span>Add Line of Dialogue</span>
        </button>

        <div class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
          <select class="event-theme-select ${isReadOnly ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}" 
                  title="Change Dialogue Block Color Scheme"
                  ${isReadOnly ? 'disabled' : ''}
                  onclick="event.stopPropagation();"
                  onmousedown="event.stopPropagation();"
                  onchange="updateDialogueColorScheme('${dialogue.id}', this.value)">
            <option value="purple" ${theme === 'purple' ? 'selected' : ''}>🟣 Purple</option>
            <option value="amber" ${theme === 'amber' ? 'selected' : ''}>🟡 Amber</option>
            <option value="blue" ${theme === 'blue' ? 'selected' : ''}>🔵 Blue</option>
            <option value="emerald" ${theme === 'emerald' ? 'selected' : ''}>🟢 Green</option>
            <option value="rose" ${theme === 'rose' ? 'selected' : ''}>🔴 Red</option>
            <option value="slate" ${theme === 'slate' ? 'selected' : ''}>⚪ Slate</option>
            <option value="orange" ${theme === 'orange' ? 'selected' : ''}>🟠 Orange</option>
            <option value="teal" ${theme === 'teal' ? 'selected' : ''}>🌊 Teal</option>
          </select>
        </div>
      </div>
    </div>
  `;

  return wrapper;
}

function makeInlineDialogueConditionEditable(element, dialogueId, linkIdx = 0) {
  if (isArrangeMode || canvasDragMoved) return;
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("edit dialogue condition")) return;
  if (element.querySelector('input')) return;
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (!diag) return;

  const links = getDialogueLinks(diag);
  const targetLink = links[linkIdx] || null;
  const currentText = targetLink ? (targetLink.triggerCondition || '') : (diag.triggerCondition || '');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-input font-semibold text-[11px] text-purple-950 bg-purple-50 border border-purple-400 w-full px-1 py-0.5 rounded';
  input.value = currentText;
  element.innerHTML = '';
  element.appendChild(input);
  input.focus();
  input.select();

  const stopProp = (e) => e.stopPropagation();
  input.addEventListener('mousedown', stopProp);
  input.addEventListener('click', stopProp);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
  });

  let saved = false;
  input.onblur = () => {
    if (saved) return;
    saved = true;
    pushUndoState();
    const val = input.value.trim();
    if (targetLink) {
      targetLink.triggerCondition = val;
      syncDialoguePrimaryFields(diag);
    } else {
      diag.triggerCondition = val;
    }
    saveProjectToLocalStorage();
    renderApp();
  };
}

function makeInlineDialogueTriggerBadgeEditable(badgeEl, dialogueId, linkIdx = 0) {
  if (isArrangeMode || canvasDragMoved) return;
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("edit dialogue trigger badge")) return;
  if (badgeEl.querySelector('input')) return;
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (!diag) return;

  const links = getDialogueLinks(diag);
  const targetLink = links[linkIdx] || null;
  const currentText = targetLink ? (targetLink.triggerCondition || '') : (diag.triggerCondition || '');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'dialogue-trigger-inline-input';
  input.value = currentText;
  input.placeholder = 'Dialog spawn trigger';
  
  badgeEl.innerHTML = '';
  badgeEl.appendChild(input);
  input.focus();
  input.select();

  const stopProp = (e) => e.stopPropagation();
  input.addEventListener('mousedown', stopProp);
  input.addEventListener('click', stopProp);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
  });

  let saved = false;
  input.onblur = () => {
    if (saved) return;
    saved = true;
    pushUndoState();
    const val = input.value.trim();
    if (targetLink) {
      targetLink.triggerCondition = val;
      syncDialoguePrimaryFields(diag);
    } else {
      diag.triggerCondition = val;
    }
    saveProjectToLocalStorage();
    renderApp();
  };
}

function formatDialogueTriggerCondition(timing, sourceNode, actionId) {
  if (!sourceNode) {
    if (timing === 'pre_event') return 'Before Event';
    if (timing === 'action_option') return 'During Event Choice';
    if (timing === 'post_action') return 'After Event Choice';
    return 'Dialog spawn trigger';
  }

  const eventId = sourceNode.codename || sourceNode.id;

  let actDesc = '';
  if (actionId === 'inaction') {
    actDesc = 'Inaction Threat';
  } else if (actionId) {
    const actIdx = (sourceNode.actions || []).findIndex(a => a.id === actionId);
    if (actIdx !== -1) {
      const act = sourceNode.actions[actIdx];
      actDesc = act.shortDescription || `Option ${actIdx + 1}`;
    }
  }

  if (timing === 'pre_event') {
    return actDesc ? `Before (${eventId}) ${actDesc}` : `Before (${eventId})`;
  } else if (timing === 'action_option') {
    return actDesc ? `During (${eventId}) ${actDesc}` : `During (${eventId})`;
  } else if (timing === 'post_action') {
    return actDesc ? `After (${eventId}) ${actDesc}` : `After (${eventId})`;
  }

  return `Trigger (${eventId})`;
}

let lastDialogueCreatedTime = 0;
// Requirement 2: Create Connected Empty Dialogue from Event Block Purple Dot
function createConnectedDialogueFromPort(nodeId, timing, actionId, customX, customY) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("create connected dialogue")) return;
  if (Date.now() - lastDialogueCreatedTime < 350) return;
  lastDialogueCreatedTime = Date.now();
  pushUndoState();
  const sourceNode = appData.nodes.find(n => n.id === nodeId);
  if (!sourceNode) return;

  const NODE_WIDTH = 880;
  let targetX = (customX !== undefined && customX !== null) ? customX : (sourceNode.position.x + NODE_WIDTH + 60);
  let targetY = (customY !== undefined && customY !== null) ? customY : sourceNode.position.y;
  let condText = formatDialogueTriggerCondition(timing, sourceNode, actionId);
  let defaultLineText = 'Enter dialogue line here...';

  if (timing === 'action_option') {
    const actIdx = (sourceNode.actions || []).findIndex(a => a.id === actionId);
    const act = (sourceNode.actions || [])[actIdx];
    const actDesc = act ? (act.shortDescription || 'Choice') : 'Choice';
    defaultLineText = `We should consider choosing "${actDesc}". It offers strong tactical advantages for our mission.`;
    if (customY === null || customY === undefined) {
      targetY = sourceNode.position.y + 40 + (actIdx !== -1 ? actIdx * 160 : 0);
    }
    if (customX === null || customX === undefined) {
      targetX = sourceNode.position.x + NODE_WIDTH + 60;
    }
  } else if (timing === 'post_action') {
    if (actionId === 'inaction') {
      if (customY === null || customY === undefined) targetY = sourceNode.position.y + 280;
    } else {
      const actIdx = (sourceNode.actions || []).findIndex(a => a.id === actionId);
      if (customY === null || customY === undefined) targetY = sourceNode.position.y + Math.max(actIdx * 180 + 120, 100);
    }
  }

  const newDiag = {
    id: `diag_${Date.now()}`,
    targetEventId: sourceNode.id,
    triggerTiming: timing,
    triggerActionId: actionId,
    links: [{
      id: `dlink_${Date.now()}`,
      targetEventId: sourceNode.id,
      triggerTiming: timing,
      triggerActionId: actionId || null,
      triggerCondition: condText
    }],
    delayHours: 0,
    delayUnit: 'hours',
    triggerCondition: condText,
    position: { x: targetX, y: targetY },
    variationId: sourceNode.variationId || activeVariationId,
    category: sourceNode.category || activeCategoryFilter,
    lines: [
      {
        id: `l_${Date.now()}`,
        speakerId: 'voss',
        speakerName: 'Voss',
        text: defaultLineText
      }
    ]
  };

  appData.dialogues.push(newDiag);
  preventNodeOverlap(newDiag.id);
  saveProjectToLocalStorage();
  renderApp();
  showToast(timing === 'action_option' ? "Route Suggestion Dialogue created for Option" : "Connected Dialogue created from Event port", "success");
}

// Requirement 4: Find closest empty space on canvas relative to current viewport center without overlapping existing cards
function findClosestEmptyCanvasPosition(width, height) {
  const containerW = (canvasContainer && canvasContainer.clientWidth) ? canvasContainer.clientWidth : (window.innerWidth || 1200);
  const containerH = (canvasContainer && canvasContainer.clientHeight) ? canvasContainer.clientHeight : (window.innerHeight || 800);

  const curScale = Math.max(transform.scale || 1, 0.1);
  // Viewport center in canvas stage coordinates
  const stageCenterX = (containerW / 2 - transform.x) / curScale;
  const stageCenterY = (containerH / 2 - transform.y) / curScale;

  const idealX = Math.round(stageCenterX - width / 2);
  const idealY = Math.round(stageCenterY - height / 2);

  const padding = 50; // Safety clearance so blocks never touch or overlap

  // Collect bounding boxes of all relevant items in the current active category
  const isPoolPage = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool');
  const boxes = [];

  (appData.nodes || []).forEach(n => {
    if (!n.position) return;
    if (!isPoolPage && n.variationId && n.variationId !== activeVariationId) return;
    if ((n.category || 'KeyChain') !== activeCategoryFilter) return;

    const el = document.getElementById(`node-${n.id}`);
    const w = (el && el.offsetWidth > 100) ? el.offsetWidth : (n.type === 'Deck' ? 820 : 880);
    const h = (el && el.offsetHeight > 100) ? el.offsetHeight : 540;
    boxes.push({ x: n.position.x, y: n.position.y, w, h });
  });

  (appData.dialogues || []).forEach(d => {
    if (!d.position) return;
    if (d.targetEventId) {
      const targetNode = appData.nodes.find(n => n.id === d.targetEventId);
      if (targetNode) {
        if (!isPoolPage && targetNode.variationId && targetNode.variationId !== activeVariationId) return;
        if ((targetNode.category || 'KeyChain') !== activeCategoryFilter) return;
      }
    } else {
      if (!isPoolPage && d.variationId && d.variationId !== activeVariationId) return;
      if (d.category && d.category !== activeCategoryFilter) return;
    }

    const el = document.getElementById(`dialogue-${d.id}`);
    const w = (el && el.offsetWidth > 100) ? el.offsetWidth : 490;
    const h = (el && el.offsetHeight > 100) ? el.offsetHeight : 240;
    boxes.push({ x: d.position.x, y: d.position.y, w, h });
  });

  function hasOverlap(cx, cy) {
    for (const b of boxes) {
      const intersectX = (cx < b.x + b.w + padding) && (cx + width + padding > b.x);
      const intersectY = (cy < b.y + b.h + padding) && (cy + height + padding > b.y);
      if (intersectX && intersectY) {
        return true;
      }
    }
    return false;
  }

  // 1. If ideal center spot is clear, place directly there!
  if (!hasOverlap(idealX, idealY)) {
    return { x: idealX, y: idealY };
  }

  // 2. Search outward in concentric rings around ideal position
  const stepX = 120;
  const stepY = 90;
  const maxRings = 20;

  for (let ring = 1; ring <= maxRings; ring++) {
    let bestInRing = null;
    let minRingDist = Infinity;

    for (let rx = -ring; rx <= ring; rx++) {
      for (let ry = -ring; ry <= ring; ry++) {
        if (Math.abs(rx) !== ring && Math.abs(ry) !== ring) continue; // Perimeter only

        const candX = Math.round(idealX + rx * stepX);
        const candY = Math.round(idealY + ry * stepY);

        if (!hasOverlap(candX, candY)) {
          const dist = Math.hypot(candX - idealX, candY - idealY);
          if (dist < minRingDist) {
            minRingDist = dist;
            bestInRing = { x: candX, y: candY };
          }
        }
      }
    }

    if (bestInRing) {
      return bestInRing;
    }
  }

  return { x: idealX + width + padding, y: idealY };
}

// Requirement 2: Create Standalone Unconnected Dialogue Card
function createStandaloneDialogue() {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("create standalone dialogue")) return;
  pushUndoState();
  const spawnPos = findClosestEmptyCanvasPosition(490, 240);

  const newDiag = {
    id: `diag_${Date.now()}`,
    targetEventId: null,
    triggerTiming: null,
    triggerActionId: null,
    delayHours: 0,
    delayUnit: 'hours',
    triggerCondition: 'Standalone Conversation',
    position: spawnPos,
    variationId: activeVariationId,
    category: activeCategoryFilter,
    lines: [
      {
        id: `l_${Date.now()}`,
        speakerId: 'voss',
        speakerName: 'Voss',
        text: 'Enter dialogue line here...'
      }
    ]
  };

  appData.dialogues.push(newDiag);
  saveProjectToLocalStorage();
  renderApp();
  showToast("Standalone Dialogue card created", "success");
}

function updateDialogueDelayHours(dialogueId, val) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("change dialogue delay hours")) {
    renderApp();
    return;
  }
  pushUndoState();
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (diag) {
    diag.delayHours = parseFloat(val) || 0;
    saveProjectToLocalStorage();
    renderApp();
  }
}

function updateDialogueTriggerTiming(dialogueId, combinedVal, linkIdx = 0) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("change dialogue trigger timing")) {
    renderApp();
    return;
  }
  pushUndoState();
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (!diag) return;
  const links = getDialogueLinks(diag);
  const targetLink = links[linkIdx] || links[0];
  if (!targetLink) return;
  const targetNode = appData.nodes.find(n => n.id === targetLink.targetEventId);

  if (combinedVal === 'pre_event') {
    targetLink.triggerTiming = 'pre_event';
    targetLink.triggerActionId = null;
    targetLink.triggerCondition = formatDialogueTriggerCondition('pre_event', targetNode, null);
  } else if (combinedVal.startsWith('action_option:')) {
    const actId = combinedVal.split(':')[1];
    targetLink.triggerTiming = 'action_option';
    targetLink.triggerActionId = actId;
    targetLink.triggerCondition = formatDialogueTriggerCondition('action_option', targetNode, actId);
  } else if (combinedVal.startsWith('post_action:')) {
    const actId = combinedVal.split(':')[1];
    targetLink.triggerTiming = 'post_action';
    targetLink.triggerActionId = actId;
    targetLink.triggerCondition = formatDialogueTriggerCondition('post_action', targetNode, actId);
  }

  syncDialoguePrimaryFields(diag);
  saveProjectToLocalStorage();
  renderApp();
  showToast("Dialogue trigger timing updated", "success");
}

function disconnectDialogueLink(dialogueId) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("disconnect dialogue")) return;
  pushUndoState();
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (diag) {
    diag.links = [];
    syncDialoguePrimaryFields(diag);
    saveProjectToLocalStorage();
    renderApp();
    showToast("Disconnected dialogue links", "info");
  }
}


// -------------------------------------------------------------
// Single Active Inline Editor Manager (Guarantees at most ONE active input,
// restores text display cleanly without destroying surrounding DOM,
// enables immediate clicking on "+ Add Req", "+ Choice", and cards)
// -------------------------------------------------------------
let currentActiveInlineEditor = null;

function restoreInlineElementDisplay(element, type, nodeId, fieldPath, finalVal) {
  if (!element) return;
  const targetNode = (appData && Array.isArray(appData.nodes)) ? appData.nodes.find(n => n.id === nodeId) : null;
  const limitKey = (type === 'node-text') ? getSymbolLimitKeyForFieldPath(fieldPath, targetNode) : null;
  const limits = limitKey ? getSymbolLimits() : null;
  const limitVal = (limits && limitKey) ? limits[limitKey] : null;

  if (type === 'dialogue-text') {
    element.textContent = finalVal || 'Dialogue text...';
    return;
  }

  if (type === 'node-number') {
    const num = parseInt(finalVal);
    element.textContent = (!isNaN(num) && num > 0) ? `${num} hours` : '—';
    return;
  }

  // node-text
  let text = String(finalVal || '').trim();
  if (!text) {
    if (fieldPath === 'spawnConditions' || fieldPath === 'location') text = 'Click to set spawn conditions...';
    else if (fieldPath === 'eventIntro') text = 'Initial event context...';
    else if (fieldPath === 'eventDescription') text = 'Enter narrative body text...';
    else if (fieldPath.endsWith('.resultDescription')) text = fieldPath.startsWith('inactionThreat') ? 'Catastrophic failure' : 'Action result description...';
    else if (fieldPath.endsWith('.description')) text = fieldPath.startsWith('inactionThreat') ? 'Survivors perish.' : 'Describe action choice narrative...';
    else if (fieldPath.endsWith('.shortDescription')) text = fieldPath.startsWith('inactionThreat') ? 'Timeout' : 'Choice';
    else if (fieldPath === 'name') text = 'Event Title';
    else text = 'Click to edit...';
  }
  element.textContent = text;

  // Update limit badges and warning classes
  if (limitVal) {
    const len = String(finalVal || '').length;
    const isOver = len > limitVal;
    element.classList.toggle('is-over-limit', isOver);
    const badge = element.parentElement?.querySelector('.symbol-count-badge')
      || element.closest('.event-value-cell, .event-desc-row, .theme-substrip, tr, div')?.querySelector('.symbol-count-badge');
    if (badge) {
      const recs = (typeof getRecommendedLimits === 'function') ? getRecommendedLimits() : {};
      const rec = (limitKey && recs[limitKey]) ? recs[limitKey] : 0;
      const isUnder = len > 0 && rec > 0 && len < rec;
      badge.innerHTML = `${len}/${limitVal}<span class="symbol-rec-tag" title="Recommended minimum"> (rec: ${rec})</span>`;
      badge.classList.toggle('is-over-limit', isOver);
      badge.classList.toggle('is-under-rec', isUnder);
    }
  }

  // If action shortDescription changed, update the action handle button text
  if (fieldPath && fieldPath.includes('actions.') && fieldPath.endsWith('.shortDescription')) {
    const parts = fieldPath.split('.');
    const actIdx = parseInt(parts[1]);
    const btnCell = document.getElementById(`action-btn-cell-${nodeId}-${actIdx}`);
    if (btnCell) {
      const handle = btnCell.querySelector('.action-handle');
      if (handle && targetNode && targetNode.actions && targetNode.actions[actIdx]) {
        const act = targetNode.actions[actIdx];
        handle.textContent = `${act.codeSuffix || String.fromCharCode(65 + actIdx)}: ${act.shortDescription || 'Choice'}`;
      }
    }
  }
}

function commitAndCloseActiveInlineEditor(cancel = false) {
  if (!currentActiveInlineEditor) return;
  const editor = currentActiveInlineEditor;
  currentActiveInlineEditor = null; // Clear first to prevent re-entrancy

  if (typeof canUserEdit === 'function' && !canUserEdit()) {
    cancel = true;
  }

  const { type, element, input, nodeId, fieldPath, originalVal } = editor;
  const currentVal = input.value;
  const hasChanged = !cancel && (currentVal !== originalVal);

  if (hasChanged) {
    pushUndoState();
    if (type === 'node-text') {
      updateNodeFieldByPath(nodeId, fieldPath, currentVal);
    } else if (type === 'node-number') {
      const num = parseInt(currentVal) || 0;
      updateNodeFieldByPath(nodeId, fieldPath, num);
    } else if (type === 'dialogue-text') {
      const diag = (appData.dialogues || []).find(d => d.id === nodeId);
      if (diag && diag.lines && diag.lines[fieldPath]) {
        diag.lines[fieldPath].text = currentVal;
      }
    }
    saveProjectToLocalStorage();
  }

  const finalVal = cancel ? originalVal : (type === 'node-number' ? (parseInt(currentVal) || 0) : currentVal);
  restoreInlineElementDisplay(element, type, nodeId, fieldPath, finalVal);
  updateStats();
}


// REQUIREMENT 2 FIX: Instant Working Inline Text Editing (Click or Double Click)
function makeInlineDialogueTextEditable(element, dialogueId, lineIdx) {
  if (isArrangeMode || canvasDragMoved) return;
  if (!requireAuthToEdit("edit dialogue lines")) return;

  if (currentActiveInlineEditor) {
    if (currentActiveInlineEditor.element === element) return;
    commitAndCloseActiveInlineEditor(false);
  }

  if (element.querySelector('textarea')) return;
  const diag = (appData.dialogues || []).find(d => d.id === dialogueId);
  const currentText = (diag && diag.lines && diag.lines[lineIdx] && typeof diag.lines[lineIdx].text === 'string')
    ? diag.lines[lineIdx].text
    : element.innerText;

  const targetMinHeight = 110;
  const input = document.createElement('textarea');
  input.className = 'inline-input font-normal text-xs';
  input.value = currentText;
  input.rows = 5;
  input.style.minHeight = `${targetMinHeight}px`;
  input.style.width = '100%';
  input.style.boxSizing = 'border-box';
  input.style.resize = 'vertical';
  input.style.whiteSpace = 'pre-wrap';
  input.style.lineHeight = '1.45';

  element.innerHTML = '';
  element.appendChild(input);

  const autoGrow = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.max(targetMinHeight, input.scrollHeight + 4)}px`;
  };
  autoGrow();

  input.focus();
  input.select();

  currentActiveInlineEditor = {
    type: 'dialogue-text',
    element,
    input,
    nodeId: dialogueId,
    fieldPath: lineIdx,
    originalVal: currentText
  };

  const stopProp = (e) => e.stopPropagation();
  input.addEventListener('mousedown', stopProp);
  input.addEventListener('click', stopProp);
  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    // Allow adding breaks with Enter in dialogue text
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      commitAndCloseActiveInlineEditor(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      commitAndCloseActiveInlineEditor(true);
    }
  });
  input.addEventListener('keyup', stopProp);

  input.onblur = () => {
    setTimeout(() => {
      if (currentActiveInlineEditor && currentActiveInlineEditor.input === input) {
        commitAndCloseActiveInlineEditor(false);
      }
    }, 120);
  };
}

function updateDialogueSpeaker(dialogueId, lineIdx, speakerId) {
  if (isArrangeMode) return;
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("change dialogue speaker")) {
    renderApp();
    return;
  }
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (diag && diag.lines[lineIdx] && diag.lines[lineIdx].speakerId !== speakerId) {
    pushUndoState();
    diag.lines[lineIdx].speakerId = speakerId;
    const charMeta = (appData.characters || []).find(c => c.id === speakerId);
    if (charMeta) diag.lines[lineIdx].speakerName = charMeta.name;
    saveProjectToLocalStorage();
    renderApp();
  }
}

function deleteDialogueLine(dialogueId, lineIdx) {
  if (isArrangeMode) return;
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("delete dialogue line")) return;
  pushUndoState();
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (diag && diag.lines) {
    diag.lines.splice(lineIdx, 1);
    saveProjectToLocalStorage();
    renderApp();
  }
}

function moveDialogueLine(dialogueId, lineIdx, direction) {
  if (isArrangeMode) return;
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("reorder dialogue lines")) return;
  pushUndoState();
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (!diag || !diag.lines) return;
  const targetIdx = lineIdx + direction;
  if (targetIdx < 0 || targetIdx >= diag.lines.length) return;

  const temp = diag.lines[lineIdx];
  diag.lines[lineIdx] = diag.lines[targetIdx];
  diag.lines[targetIdx] = temp;

  saveProjectToLocalStorage();
  renderApp();
}

function insertDialogueLineBelow(dialogueId, lineIdx) {
  if (isArrangeMode) return;
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("insert dialogue line")) return;
  pushUndoState();
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (!diag || !diag.lines) return;

  const enabledChars = getEnabledCharactersForVariation(activeVariationId);
  const allChars = getGlobalCharactersPool();
  const defaultChar = enabledChars[0] || allChars[0] || { id: 'voss', name: 'Voss' };
  const currentLine = diag.lines[lineIdx];
  const currentSpeakerId = currentLine ? currentLine.speakerId : defaultChar.id;
  const currentChar = allChars.find(c => c.id === currentSpeakerId) || { id: currentSpeakerId, name: (currentLine ? currentLine.speakerName : defaultChar.name) };

  const newLine = {
    id: `l_${Date.now()}`,
    speakerId: currentChar.id,
    speakerName: currentChar.name,
    text: 'New dialogue speech text...'
  };

  diag.lines.splice(lineIdx + 1, 0, newLine);
  saveProjectToLocalStorage();
  renderApp();
}

function addDialogueLineTurn(dialogueId) {
  if (isArrangeMode) return;
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("add dialogue turn")) return;
  pushUndoState();
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (diag) {
    const enabledChars = getEnabledCharactersForVariation(activeVariationId);
    const pool = enabledChars.length > 0 ? enabledChars : getGlobalCharactersPool();
    const lastLine = diag.lines && diag.lines.length > 0 ? diag.lines[diag.lines.length - 1] : null;
    const lastSpeaker = lastLine ? lastLine.speakerId : null;
    const altChar = pool.find(c => c.id !== lastSpeaker) || pool[0];

    diag.lines.push({
      id: `l_${Date.now()}`,
      speakerId: altChar ? altChar.id : 'voss',
      speakerName: altChar ? altChar.name : 'Voss',
      text: 'New dialogue speech text...'
    });
    saveProjectToLocalStorage();
    renderApp();
  }
}

function getRawModelValueByPath(nodeId, fieldPath) {
  const obj = (appData.nodes || []).find(n => n.id === nodeId) || (appData.dialogues || []).find(d => d.id === nodeId);
  if (!obj || !fieldPath) return null;
  const parts = fieldPath.split('.');
  let curr = obj;
  for (let i = 0; i < parts.length; i++) {
    if (curr === null || curr === undefined) return null;
    curr = curr[parts[i]];
  }
  return (typeof curr === 'string') ? curr : null;
}

function makeInlineTextEditable(element, nodeId, fieldPath) {
  if (isArrangeMode || canvasDragMoved) return;
  if (!requireAuthToEdit("edit text content")) return;

  if (currentActiveInlineEditor) {
    if (currentActiveInlineEditor.element === element) return;
    commitAndCloseActiveInlineEditor(false);
  }

  if (element.querySelector('textarea')) return;
  const rawVal = getRawModelValueByPath(nodeId, fieldPath);
  const currentText = (rawVal !== null && rawVal !== undefined) ? rawVal : element.innerText;

  const targetNode = (appData && Array.isArray(appData.nodes)) ? appData.nodes.find(n => n.id === nodeId) : null;
  const limitKey = getSymbolLimitKeyForFieldPath(fieldPath, targetNode);
  const limits = limitKey ? getSymbolLimits() : null;
  const limitVal = (limits && limitKey) ? limits[limitKey] : null;

  const isSingleLine = (fieldPath === 'name' || fieldPath.endsWith('.shortDescription') || (limitVal && limitVal <= 30));

  // Enlarge the textual field to correspond to the maximum number of symbols specified for this field
  let targetMinHeight = 85;
  let targetRows = 4;
  if (isSingleLine) {
    targetRows = 1;
    targetMinHeight = 28;
  } else if (limitVal) {
    if (limitVal >= 800) { // e.g. eventOutcome / Action Result (925 symbols)
      targetRows = 12;
      targetMinHeight = 240;
    } else if (limitVal >= 400) { // e.g. eventDescription (475), eventIntro (475), inactionResult (475)
      targetRows = 8;
      targetMinHeight = 160;
    } else if (limitVal >= 180) { // e.g. actionDescription3Opt (200), variationDescription (280)
      targetRows = 6;
      targetMinHeight = 120;
    } else { // e.g. actionDescription (120)
      targetRows = 5;
      targetMinHeight = 95;
    }
  } else {
    targetRows = 5;
    targetMinHeight = 100;
  }

  const input = document.createElement('textarea');
  input.className = 'inline-input';
  input.value = currentText;
  input.rows = targetRows;
  input.style.minHeight = `${targetMinHeight}px`;
  input.style.width = '100%';
  input.style.boxSizing = 'border-box';
  input.style.resize = isSingleLine ? 'none' : 'vertical';
  input.style.whiteSpace = 'pre-wrap';
  input.style.lineHeight = '1.45';

  element.innerHTML = '';
  element.appendChild(input);

  const autoGrow = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.max(targetMinHeight, input.scrollHeight + 4)}px`;
  };
  autoGrow();

  input.focus();
  input.select();

  currentActiveInlineEditor = {
    type: 'node-text',
    element,
    input,
    nodeId,
    fieldPath,
    originalVal: currentText,
    limitKey,
    limitVal
  };

  const updateLiveBadge = (valStr) => {
    if (!limitVal) return;
    const len = String(valStr || '').length;
    const isOver = len > limitVal;
    element.classList.toggle('is-over-limit', isOver);
    const container = element.parentElement;
    const badge = container ? container.querySelector('.symbol-count-badge') : null;
    if (badge) {
      const recs = (typeof getRecommendedLimits === 'function') ? getRecommendedLimits() : {};
      const rec = (limitKey && recs[limitKey]) ? recs[limitKey] : 0;
      const isUnder = len > 0 && rec > 0 && len < rec;
      badge.innerHTML = `${len}/${limitVal}<span class="symbol-rec-tag" title="Recommended minimum"> (rec: ${rec})</span>`;
      badge.classList.toggle('is-over-limit', isOver);
      badge.classList.toggle('is-under-rec', isUnder);
    }
  };

  input.addEventListener('input', () => {
    autoGrow();
    updateLiveBadge(input.value);
  });

  const stopProp = (e) => e.stopPropagation();
  input.addEventListener('mousedown', stopProp);
  input.addEventListener('click', stopProp);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (isSingleLine) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitAndCloseActiveInlineEditor(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        commitAndCloseActiveInlineEditor(true);
      }
    } else {
      // Allow adding breaks (like empty line) with Enter in textual descriptions!
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        commitAndCloseActiveInlineEditor(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        commitAndCloseActiveInlineEditor(true);
      }
    }
  });
  input.addEventListener('keyup', stopProp);

  input.onblur = () => {
    setTimeout(() => {
      if (currentActiveInlineEditor && currentActiveInlineEditor.input === input) {
        commitAndCloseActiveInlineEditor(false);
      }
    }, 120);
  };
}

function makeInlineNumberEditable(element, nodeId, fieldPath) {
  if (isArrangeMode || canvasDragMoved) return;
  if (!requireAuthToEdit("edit numerical values")) return;

  if (currentActiveInlineEditor) {
    if (currentActiveInlineEditor.element === element) return;
    commitAndCloseActiveInlineEditor(false);
  }

  if (element.querySelector('input')) return;
  const currentVal = parseInt(element.innerText) || 5;
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'inline-input w-16 font-bold';
  input.value = currentVal;
  element.innerHTML = '';
  element.appendChild(input);
  input.focus();
  input.select();

  currentActiveInlineEditor = {
    type: 'node-number',
    element,
    input,
    nodeId,
    fieldPath,
    originalVal: currentVal
  };

  const stopProp = (e) => e.stopPropagation();
  input.addEventListener('mousedown', stopProp);
  input.addEventListener('click', stopProp);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      commitAndCloseActiveInlineEditor(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      commitAndCloseActiveInlineEditor(true);
    }
  });
  input.addEventListener('keyup', stopProp);

  input.onblur = () => {
    setTimeout(() => {
      if (currentActiveInlineEditor && currentActiveInlineEditor.input === input) {
        commitAndCloseActiveInlineEditor(false);
      }
    }, 120);
  };
}

function getReactionTimerOptionsHTML(currentVal) {
  const cur = (currentVal === undefined || currentVal === null || currentVal === 'Infinite') ? 'Infinite' : currentVal;
  const presets = [
    { val: "Infinite", label: "∞ Infinite" },
    { val: "1", label: "1 hour" },
    { val: "2", label: "2 hours" },
    { val: "3", label: "3 hours" },
    { val: "4", label: "4 hours" },
    { val: "5", label: "5 hours" },
    { val: "6", label: "6 hours" },
    { val: "8", label: "8 hours" },
    { val: "10", label: "10 hours" },
    { val: "12", label: "12 hours" },
    { val: "24", label: "24 hours" },
    { val: "48", label: "48 hours" }
  ];

  let matched = false;
  let opts = presets.map(p => {
    const isSelected = String(cur).toLowerCase() === String(p.val).toLowerCase();
    if (isSelected) matched = true;
    return `<option value="${p.val}" ${isSelected ? 'selected' : ''}>${p.label}</option>`;
  }).join('');

  if (!matched && cur !== 'Infinite') {
    opts += `<option value="${cur}" selected>${cur} hours</option>`;
  }

  opts += `<option value="custom">Custom hours...</option>`;
  return opts;
}

function updateNodeReactionTimer(nodeId, val) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("change reaction timer")) {
    renderApp();
    return;
  }
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;

  if (val === 'custom') {
    const prev = typeof node.reactionTimerHours === 'number' ? node.reactionTimerHours : 5;
    const input = prompt("Enter reaction time in hours (number):", prev);
    if (input !== null && input.trim() !== '') {
      const num = parseFloat(input);
      if (!isNaN(num) && num > 0) {
        pushUndoState();
        node.reactionTimerHours = num;
        saveProjectToLocalStorage();
        renderApp();
        showToast(`Reaction timer set to ${num} hours`, 'success');
        return;
      }
    }
    renderApp();
    return;
  }

  pushUndoState();
  if (val === 'Infinite') {
    node.reactionTimerHours = "Infinite";
    showToast(`Reaction timer set to Infinite`, 'info');
  } else {
    const num = parseFloat(val);
    node.reactionTimerHours = !isNaN(num) ? num : "Infinite";
    showToast(`Reaction timer set to ${node.reactionTimerHours} hours`, 'success');
  }
  saveProjectToLocalStorage();
  renderApp();
}

function makeInlineReactionTimerEditable(element, nodeId) {
  if (isArrangeMode) return;
  if (!requireAuthToEdit("edit reaction timer")) return;
  if (currentActiveInlineEditor) {
    commitAndCloseActiveInlineEditor(false);
  }
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const select = document.createElement('select');
  select.className = 'rx-timer-select';
  select.innerHTML = getReactionTimerOptionsHTML(node.reactionTimerHours);
  element.innerHTML = '';
  element.appendChild(select);
  select.focus();
  select.onchange = () => updateNodeReactionTimer(nodeId, select.value);
  select.onblur = () => renderApp();
}


function finalizeNodeDrop(obj, el, nodeStartPos, preDragSnapshot) {
  if (!obj) return;
  const isEvent = (appData.nodes || []).some(n => n.id === obj.id);
  const prevFloorIndex = (obj.floorIndex !== undefined && obj.floorIndex !== null) ? Number(obj.floorIndex) : 0;

  const hasMoved = (!nodeStartPos || obj.position.x !== nodeStartPos.x || obj.position.y !== nodeStartPos.y);
  if (hasMoved && preDragSnapshot) {
    undoStack.push(preDragSnapshot);
    if (undoStack.length > MAX_UNDO_DEPTH) undoStack.shift();
    redoStack.length = 0;
  }

  if (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool') {
    // Snap horizontally to nearest Tier Column X
    let closestTierIdx = 0;
    let minTierDist = Infinity;
    TIER_X.forEach((tx, idx) => {
      const dist = Math.abs(obj.position.x - tx);
      if (dist < minTierDist) {
        minTierDist = dist;
        closestTierIdx = idx;
      }
    });

    if (isEvent) {
      obj.position.x = TIER_X[closestTierIdx];
      obj.tier = closestTierIdx + 1;
      obj.floorIndex = Math.max(0, Math.floor((obj.position.y - 100) / 700));
    }
  } else {
    // KeyChain / SecretChain: Lock vertically to nearest stage row FLOOR_Y
    let closestFloorIdx = 0;
    let minDistance = Infinity;

    FLOOR_Y.forEach((fy, idx) => {
      const dist = Math.abs(obj.position.y - fy);
      if (dist < minDistance) {
        minDistance = dist;
        closestFloorIdx = idx;
      }
    });

    if (isEvent) {
      obj.position.y = FLOOR_Y[closestFloorIdx];
      obj.floorIndex = closestFloorIdx;
    } else {
      // Dialogues: allow placing anywhere on canvas, but update floorIndex
      obj.floorIndex = closestFloorIdx;
    }
  }

  if (el) {
    el.style.left = `${obj.position.x}px`;
    el.style.top = `${obj.position.y}px`;
  }

  preventNodeOverlap(obj.id);

  // If this is an event in KeyChain or SecretChain, automatically re-sequence codename letters (A, B, C...) from left to right
  if (isEvent && (activeCategoryFilter === 'KeyChain' || activeCategoryFilter === 'SecretChain')) {
    resequenceStageEventCodenames(obj.floorIndex, obj.category || activeCategoryFilter, obj.variationId || activeVariationId);
    if (prevFloorIndex !== obj.floorIndex) {
      resequenceStageEventCodenames(prevFloorIndex, obj.category || activeCategoryFilter, obj.variationId || activeVariationId);
    }
  }

  saveProjectToLocalStorage();
  renderApp();
}

function updateNodeFieldByPath(nodeId, fieldPath, value) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("edit event property")) return;
  const node = (appData.nodes || []).find(n => n.id === nodeId) || (appData.dialogues || []).find(d => d.id === nodeId);
  if (!node) return;

  const parts = fieldPath.split('.');
  let curr = node;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!curr[parts[i]]) curr[parts[i]] = {};
    curr = curr[parts[i]];
  }
  curr[parts[parts.length - 1]] = value;
  if (fieldPath === 'spawnConditions') {
    node.location = value;
  } else if (fieldPath === 'location') {
    node.spawnConditions = value;
  }
}

function updateNodeField(nodeId, field, value) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit(`change ${field}`)) {
    renderApp();
    return;
  }
  const node = appData.nodes.find(n => n.id === nodeId);
  if (node) {
    node[field] = value;
    saveProjectToLocalStorage();
    renderApp();
  }
}

function spawnChildBranchNode(nodeId, actionId) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("create branch event")) return;
  const sourceNode = (appData.nodes || []).find(n => n.id === nodeId);
  if (!sourceNode) return;
  const act = (sourceNode.actions || []).find(a => a.id === actionId);
  if (!act) return;

  pushUndoState();
  const nextFloorIdx = Math.min((Number(sourceNode.floorIndex) || 0) + 1, FLOOR_Y.length - 1);
  const targetCat = sourceNode.category || 'KeyChain';
  const targetVarId = sourceNode.variationId || activeVariationId;
  const targetVarObj = (appData.variations || []).find(v => v.id === targetVarId);
  const inheritedName = (targetCat === 'KeyChain' && targetVarObj && targetVarObj.name)
    ? targetVarObj.name
    : `Outcome from ${sourceNode.name || sourceNode.codename}`;
  const newCodename = generateNewEventCodename(targetCat, nextFloorIdx, targetVarId);
  const newNode = {
    id: `node_${Date.now()}`,
    codename: newCodename,
    name: inheritedName,
    title: inheritedName,
    type: sourceNode.type || 'World',
    category: targetCat,
    variationId: targetVarId,
    floorIndex: nextFloorIdx,
    spawnConditions: `Triggered by ${sourceNode.codename}`,
    eventIntro: "Initial event context...",
    eventDescription: "Enter new outcome narrative body text...",
    reactionTimerHours: "Infinite",
    hasInactionThreat: false,
    inactionThreat: null,
    position: { x: Math.round((sourceNode.position ? sourceNode.position.x : 140) + 200), y: FLOOR_Y[nextFloorIdx] },
    actions: [
      { id: `c_${Date.now()}`, codeSuffix: "A", shortDescription: "Continue", description: "Next step narrative", requirements: [], timerHours: 5, resultDescription: "", rewards: ["🧠 Knowledge +100"] }
    ]
  };
  appData.nodes.push(newNode);
  addActionTargetId(act, newNode.id, sourceNode.id);
  preventNodeOverlap(newNode.id);
  resequenceStageEventCodenames(nextFloorIdx, sourceNode.category || 'KeyChain', sourceNode.variationId || activeVariationId);
  saveProjectToLocalStorage();
  renderApp();
  showToast(`Created & linked branch event ${newNode.codename}`, 'success');
}

function linkOrEditChoice(nodeId, actionId) {
  if (isArrangeMode) return;
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("link event choice")) return;
  const targetName = prompt("Enter Target Event Codename to add link (or leave empty to create a new connected branch event):");
  if (targetName === null) return;

  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const act = (node.actions || []).find(a => a.id === actionId);
  if (!act) return;

  if (targetName.trim() === '') {
    spawnChildBranchNode(nodeId, actionId);
  } else {
    const existing = appData.nodes.find(n => n.codename && n.codename.toLowerCase() === targetName.trim().toLowerCase());
    if (existing) {
      if (existing.id === nodeId) {
        alert("An event cannot lead into itself.");
        return;
      }
      pushUndoState();
      addActionTargetId(act, existing.id, nodeId);
      saveProjectToLocalStorage();
      renderApp();
      showToast(`Linked ${node.codename} (${act.shortDescription || 'Choice'}) → ${existing.codename}`, 'success');
    } else {
      alert(`Node with codename ${targetName} not found.`);
    }
  }
}

function linkOrEditInaction(nodeId) {
  if (isArrangeMode) return;
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("link inaction consequence")) return;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node || !node.inactionThreat) return;

  const targetName = prompt("Enter Target Event Codename for Inaction consequence (or leave empty to create a new connected consequence event):");
  if (targetName === null) return;

  if (targetName.trim() === '') {
    pushUndoState();
    const nextFloorIdx = Math.min((Number(node.floorIndex) || 0) + 1, FLOOR_Y.length - 1);
    const targetCat = node.category || 'KeyChain';
    const targetVarId = node.variationId || activeVariationId;
    const targetVarObj = (appData.variations || []).find(v => v.id === targetVarId);
    const inheritedName = (targetCat === 'KeyChain' && targetVarObj && targetVarObj.name)
      ? targetVarObj.name
      : `Inaction Consequence from ${node.name || node.codename}`;
    const newCodename = generateNewEventCodename(targetCat, nextFloorIdx, targetVarId);
    const newNode = {
      id: `node_${Date.now()}`,
      codename: newCodename,
      name: inheritedName,
      title: inheritedName,
      type: node.type || 'World',
      category: targetCat,
      variationId: targetVarId,
      floorIndex: nextFloorIdx,
      spawnConditions: `Triggered by ${node.codename} Inaction`,
      eventIntro: "Initial event context...",
      eventDescription: "Enter inaction consequence narrative body text...",
      reactionTimerHours: "Infinite",
      hasInactionThreat: false,
      inactionThreat: null,
      position: { x: Math.round((node.position ? node.position.x : 140) + 200), y: FLOOR_Y[nextFloorIdx] },
      actions: [
        { id: `c_${Date.now()}`, codeSuffix: "A", shortDescription: "Continue", description: "Next step narrative", requirements: [], timerHours: 5, resultDescription: "", rewards: ["🧠 Knowledge +100"] }
      ]
    };
    appData.nodes.push(newNode);
    node.inactionThreat.targetNodeId = newNode.id;
    preventNodeOverlap(newNode.id);
    resequenceStageEventCodenames(nextFloorIdx, node.category || 'KeyChain', node.variationId || activeVariationId);
    saveProjectToLocalStorage();
    renderApp();
    showToast(`Created & linked inaction consequence event ${newNode.codename}`, 'success');
  } else {
    const existing = appData.nodes.find(n => n.codename && n.codename.toLowerCase() === targetName.trim().toLowerCase());
    if (existing) {
      if (existing.id === nodeId) {
        alert("An event cannot lead into itself.");
        return;
      }
      pushUndoState();
      node.inactionThreat.targetNodeId = existing.id;
      saveProjectToLocalStorage();
      renderApp();
      showToast(`Linked ${node.codename} (Inaction) → ${existing.codename}`, 'success');
    } else {
      alert(`Node with codename ${targetName} not found.`);
    }
  }
}

function pulseTargetBlockHighlight(el) {
  if (!el) return;
  el.style.transition = 'box-shadow 0.25s ease, outline 0.25s ease';
  el.style.outline = '4px solid #22d3ee';
  el.style.boxShadow = '0 0 0 8px rgba(34, 211, 238, 0.35), 0 20px 35px rgba(0, 0, 0, 0.5)';
  setTimeout(() => {
    if (el) {
      el.style.outline = '';
      el.style.boxShadow = '';
    }
  }, 1800);
}

function navigateToLinkedEvent(targetIdOrCodename) {
  if (!targetIdOrCodename) return;
  const raw = String(targetIdOrCodename).trim();
  const targetNode = (appData.nodes || []).find(n => n.id === raw) ||
    (appData.nodes || []).find(n => n.codename && n.codename.toLowerCase() === raw.toLowerCase());
  if (!targetNode) {
    showToast(`Linked event "${raw}" not found`, 'warning');
    return;
  }

  const targetCat = targetNode.category || 'KeyChain';
  const isPool = (targetCat === 'GenericPool' || targetCat === 'DeckPool' || targetCat === 'SpeciesPool');
  let needsReRender = false;

  if (targetCat !== activeCategoryFilter) {
    activeCategoryFilter = targetCat;
    syncCategoryFilterButtonsUI(targetCat);
    needsReRender = true;
  }

  if (!isPool && targetNode.variationId && targetNode.variationId !== activeVariationId) {
    activeVariationId = targetNode.variationId;
    const vObj = (appData.variations || []).find(v => v.id === activeVariationId);
    if (vObj && vObj.timelineId) {
      activeTimelineId = vObj.timelineId;
    }
    needsReRender = true;
  }

  if (currentAppViewMode === 'mobile-stage') {
    const targetFloor = (targetNode.floorIndex !== undefined && targetNode.floorIndex !== null)
      ? Number(targetNode.floorIndex)
      : (targetNode.tier ? Math.max(0, Number(targetNode.tier) - 1) : 0);
    if (activeMobileStageIndex !== targetFloor || needsReRender) {
      activeMobileStageIndex = targetFloor;
      renderApp();
    }
    setTimeout(() => {
      const mobEl = document.getElementById(`mob-node-${targetNode.id}`);
      if (mobEl) {
        mobEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pulseTargetBlockHighlight(mobEl);
      }
    }, 40);
    showToast(`Jumped to ${targetNode.codename}`, 'info');
    return;
  }

  if (needsReRender) {
    renderApp();
  }

  zoomInToBlock(targetNode.id, false);
  const desktopEl = document.getElementById(`node-${targetNode.id}`);
  if (desktopEl) {
    pulseTargetBlockHighlight(desktopEl);
  }
  showToast(`Jumped to ${targetNode.codename}`, 'info');
}

window.linkOrEditChoice = linkOrEditChoice;
window.linkOrEditInaction = linkOrEditInaction;
window.navigateToLinkedEvent = navigateToLinkedEvent;

// Block-Specific Floating Zoom-In & Zoom-Out Engine
function getFloatingZoomButtonsHTML(blockId, isDialogue = false) {
  const currentScale = transform.scale;
  const isThisBlockAtMax = (maxZoomedBlockId === blockId && currentScale >= (maxZoomScale * 0.95));
  const isAtMin = (currentScale <= (minOverviewScale * 1.05));

  const zoomInDisplay = isThisBlockAtMax ? 'none' : 'flex';
  const zoomOutDisplay = isAtMin ? 'none' : 'flex';

  return `
    <button type="button" class="block-floating-btn block-zoom-in-btn" 
            onclick="event.stopPropagation(); zoomInToBlock('${blockId}', ${isDialogue ? 'true' : 'false'});" 
            onmousedown="event.stopPropagation();"
            title="Zoom in to block" aria-label="Zoom in to block"
            style="display: ${zoomInDisplay};">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="7"></circle>
        <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
        <line x1="11" y1="8" x2="11" y2="14"></line>
        <line x1="8" y1="11" x2="14" y2="11"></line>
      </svg>
    </button>
    <button type="button" class="block-floating-btn block-zoom-out-btn" 
            onclick="event.stopPropagation(); zoomOutToWholeScheme();" 
            onmousedown="event.stopPropagation();"
            title="Show the entire scheme" aria-label="Show the entire scheme"
            style="display: ${zoomOutDisplay};">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
      </svg>
    </button>
  `;
}

function updateBlockZoomButtons() {
  const currentScale = transform.scale;
  const isAtMin = (currentScale <= (minOverviewScale * 1.05));

  const cards = document.querySelectorAll('.event-card, .dialogue-card, .deck-event-card, .generic-event-card');
  cards.forEach(card => {
    const isEvent = card.classList.contains('event-card') || card.classList.contains('deck-event-card') || card.classList.contains('generic-event-card');
    const blockId = card.id.replace(isEvent ? 'node-' : 'dialogue-', '');
    const isThisBlockAtMax = (maxZoomedBlockId === blockId && currentScale >= (maxZoomScale * 0.95));
    card.classList.toggle('is-max-zoomed', isThisBlockAtMax);

    const zoomInBtn = card.querySelector('.block-zoom-in-btn');
    if (zoomInBtn) {
      zoomInBtn.style.display = isThisBlockAtMax ? 'none' : 'flex';
    }

    const zoomOutBtn = card.querySelector('.block-zoom-out-btn');
    if (zoomOutBtn) {
      zoomOutBtn.style.display = isAtMin ? 'none' : 'flex';
    }
  });
}

function zoomInToBlock(blockId, isDialogue) {
  const obj = isDialogue ? appData.dialogues.find(d => d.id === blockId) : appData.nodes.find(n => n.id === blockId);
  if (!obj || !obj.position) return;

  if (!isDialogue) {
    const targetCat = obj.category || 'KeyChain';
    const isPool = (targetCat === 'GenericPool' || targetCat === 'DeckPool' || targetCat === 'SpeciesPool');
    let switched = false;
    if (targetCat !== activeCategoryFilter) {
      activeCategoryFilter = targetCat;
      syncCategoryFilterButtonsUI(targetCat);
      switched = true;
    }
    if (!isPool && obj.variationId && obj.variationId !== activeVariationId) {
      activeVariationId = obj.variationId;
      const vObj = (appData.variations || []).find(v => v.id === activeVariationId);
      if (vObj && vObj.timelineId) activeTimelineId = vObj.timelineId;
      switched = true;
    }
    if (switched) {
      renderApp();
    }
  }

  const el = document.getElementById(isDialogue ? `dialogue-${blockId}` : `node-${blockId}`);
  const blockW = isDialogue ? 490 : 880;
  const blockH = (el && el.offsetHeight > 50) ? el.offsetHeight : (isDialogue ? 240 : 540);

  const containerW = (canvasContainer && canvasContainer.clientWidth) ? canvasContainer.clientWidth : (window.innerWidth || 1200);
  const containerH = (canvasContainer && canvasContainer.clientHeight) ? canvasContainer.clientHeight : (window.innerHeight || 800);

  // 68px horizontal margin accommodates side floating buttons; 48px vertical margin clears top header & bottom status bar
  const marginH = 68;
  const marginV = 48;

  const availableW = Math.max(containerW - (marginH * 2), 320);
  const availableH = Math.max(containerH - (marginV * 2), 240);

  const scaleX = availableW / blockW;
  const scaleY = availableH / blockH;

  // Zoom in bounding strictly by whichever dimension (height or width) is limiting the block,
  // guaranteeing the ENTIRE card fits comfortably on screen without any truncation or cutoff.
  const targetScale = Math.max(Math.min(scaleX, scaleY), 0.2);

  maxZoomedBlockId = blockId;
  window.maxZoomedBlockId = blockId;
  maxZoomScale = targetScale;
  transform.scale = targetScale;

  // Perfectly center in both X and Y so 100% of the block is directly in view
  transform.x = Math.round((containerW - (blockW * targetScale)) / 2 - (obj.position.x * targetScale));
  transform.y = Math.round((containerH - (blockH * targetScale)) / 2 - (obj.position.y * targetScale));

  // Seamlessly update button visibility in place without DOM re-render (NO SCREEN BLINK!)
  updateBlockZoomButtons();

  if (canvasStage) {
    canvasStage.style.transition = 'none';
  }

  updateCanvasTransform();
}

function zoomOutToWholeScheme() {
  if (canvasStage) {
    canvasStage.style.transition = 'none';
  }
  maxZoomedBlockId = null;
  window.maxZoomedBlockId = null;
  updateBlockZoomButtons();
  fitWholeSchematic(false);
}

window.zoomInToBlock = zoomInToBlock;
window.zoomOutToWholeScheme = zoomOutToWholeScheme;

// "View Whole Schematic" Engine
function fitWholeSchematic(keepZoomLock = false) {
  if (canvasStage) {
    canvasStage.style.transition = 'none';
  }
  if (!keepZoomLock) {
    maxZoomedBlockId = null;
    window.maxZoomedBlockId = null;
    updateBlockZoomButtons();
  }
  const isPoolPage = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool');
  const visibleNodes = appData.nodes.filter(n => {
    if (!isPoolPage && n.variationId && n.variationId !== activeVariationId) return false;
    return (n.category || 'KeyChain') === activeCategoryFilter;
  });

  const visibleDialogues = appData.dialogues.filter(d => {
    if (d.targetEventId) {
      const targetNode = appData.nodes.find(n => n.id === d.targetEventId);
      if (!targetNode) return false;
      if (!isPoolPage && targetNode.variationId && targetNode.variationId !== activeVariationId) return false;
      return (targetNode.category || 'KeyChain') === activeCategoryFilter;
    }
    if (!isPoolPage && d.variationId && d.variationId !== activeVariationId) return false;
    return (d.category || 'KeyChain') === activeCategoryFilter;
  });

  if (visibleNodes.length === 0 && visibleDialogues.length === 0) {
    transform.scale = 0.8;
    transform.x = 40;
    transform.y = 30;
    updateCanvasTransform();
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  visibleNodes.forEach(n => {
    const px = n.position ? n.position.x : 100;
    const py = n.position ? n.position.y : 100;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px + 920 > maxX) maxX = px + 920;
    if (py + 700 > maxY) maxY = py + 700;
  });

  visibleDialogues.forEach(d => {
    const px = d.position ? d.position.x : 100;
    const py = d.position ? d.position.y : 100;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px + 440 > maxX) maxX = px + 440;
    if (py + 400 > maxY) maxY = py + 400;
  });

  const width = Math.max(maxX - minX + 240, 1000);
  const height = Math.max(maxY - minY + 240, 800);

  const containerW = (canvasContainer && canvasContainer.clientWidth) ? canvasContainer.clientWidth : (window.innerWidth || 1200);
  const containerH = (canvasContainer && canvasContainer.clientHeight) ? canvasContainer.clientHeight : (window.innerHeight || 800);

  const scaleX = containerW / width;
  const scaleY = containerH / height;
  const fitScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.25), 1.0);

  minOverviewScale = fitScale;
  transform.scale = fitScale;
  transform.x = Math.round((containerW / 2) - ((minX + maxX) / 2) * fitScale);
  transform.y = Math.round((containerH / 2) - ((minY + maxY) / 2) * fitScale);

  updateCanvasTransform();
  updateBlockZoomButtons();
}

// Auto Arrange Tree Layout
function autoArrangeTreeLayout() {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("auto arrange blocks")) return;
  const floorNodes = {};
  appData.nodes.forEach(n => {
    const floor = n.floorIndex || 0;
    if (!floorNodes[floor]) floorNodes[floor] = [];
    floorNodes[floor].push(n);
  });

  Object.keys(floorNodes).sort().forEach(floor => {
    const nodes = floorNodes[floor];
    const floorY = FLOOR_Y[Math.min(parseInt(floor), 3)];
    const startX = 140;

    nodes.forEach((n, idx) => {
      n.position.x = startX + idx * 900;
      n.position.y = floorY;
    });
  });

  preventNodeOverlap();
  [0, 1, 2, 3].forEach(f => {
    resequenceStageEventCodenames(f, activeCategoryFilter, activeVariationId);
  });
  saveProjectToLocalStorage();
  renderApp();
}

// Drag & Snap Node to Nearest Floor Row (DO NOT HIJACK EDITABLE SPOTS)
function makeNodesDraggable() {
  const nodes = document.querySelectorAll('.event-card, .deck-event-card, .generic-event-card, .dialogue-card');
  nodes.forEach(el => {
    if (el._isDraggableInitialized) return;
    el._isDraggableInitialized = true;
    let isDraggingNode = false;
    let nodeStartPos = { x: 0, y: 0 };
    let mouseStartPos = { x: 0, y: 0 };

    el.addEventListener('mousedown', (e) => {
      // If right-click (2) or middle-click (1) or Space held down: yield to universal pan engine
      if (e.button === 1 || e.button === 2 || isSpacePressed) {
        return;
      }

      // Only primary left button initiates block movement
      if (e.button !== 0) return;

      if (!canUserEdit()) {
        requireAuthToEdit("move blocks on the board");
        return;
      }

      // Do not drag block if clicking inside editable text spots, inputs, buttons, ports, or interactive controls
      if (
        e.target.closest('.editable-spot') || 
        e.target.closest('button') || 
        e.target.closest('.linked-event-jump-btn') ||
        e.target.closest('.action-handle-group') ||
        e.target.closest('input') || 
        e.target.closest('textarea') || 
        e.target.closest('select') || 
        e.target.closest('.rx-timer-select') ||
        e.target.closest('.inline-select') ||
        e.target.closest('.connector-port') ||
        e.target.closest('.dialogue-trigger-port') ||
        e.target.closest('.pool-event-switch-bar') ||
        e.target.closest('.pool-switch-toggle-btn') ||
        e.target.closest('.btn-zoom-corner') ||
        e.target.closest('.block-floating-btn') ||
        e.target.closest('.req-pill')
      ) {
        return;
      }

      if (document.activeElement && typeof document.activeElement.blur === 'function' && !e.target.closest('input, textarea, select')) {
        document.activeElement.blur();
      }

      isDraggingNode = true;
      let hasExceededDragThreshold = false;
      e.stopPropagation();

      const isEvent = el.classList.contains('event-card') || el.classList.contains('deck-event-card') || el.classList.contains('generic-event-card');
      const nodeId = el.id.replace(isEvent ? 'node-' : 'dialogue-', '');

      const obj = isEvent ? appData.nodes.find(n => n.id === nodeId) : appData.dialogues.find(d => d.id === nodeId);
      if (!obj) return;

      let preDragSnapshot = null;
      nodeStartPos = { ...obj.position };
      mouseStartPos = { x: e.clientX, y: e.clientY };

      let dragRafId = null;
      const onMouseMove = (ev) => {
        if (!isDraggingNode) return;
        const rawDist = Math.hypot(ev.clientX - mouseStartPos.x, ev.clientY - mouseStartPos.y);
        if (!hasExceededDragThreshold) {
          if (rawDist < 4) return;
          hasExceededDragThreshold = true;
          preDragSnapshot = JSON.stringify(appData);
          if (typeof cacheAllNodeDimensions === 'function') {
            cacheAllNodeDimensions();
          }
        }
        const dx = (ev.clientX - mouseStartPos.x) / transform.scale;
        const dy = (ev.clientY - mouseStartPos.y) / transform.scale;

        obj.position.x = Math.round(nodeStartPos.x + dx);
        obj.position.y = Math.round(nodeStartPos.y + dy);

        el.style.left = `${obj.position.x}px`;
        el.style.top = `${obj.position.y}px`;

        if (!dragRafId) {
          dragRafId = requestAnimationFrame(() => {
            dragRafId = null;
            if (typeof updateConnectedConnectorsForNode === 'function') {
              updateConnectedConnectorsForNode(obj.id, !isEvent);
            } else {
              renderConnectors();
            }
          });
        }
      };

      const onMouseUp = () => {
        if (!isDraggingNode) return;
        isDraggingNode = false;
        if (dragRafId) {
          cancelAnimationFrame(dragRafId);
          dragRafId = null;
        }

        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (hasExceededDragThreshold) {
          finalizeNodeDrop(obj, el, nodeStartPos, preDragSnapshot);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  });
}


// Targeted Single-Node & Single-Dialogue Re-Render Helpers (Phase 1 Optimization)
function rerenderNode(nodeId) {
  if (currentAppViewMode === 'mobile-stage') {
    renderApp();
    return;
  }
  const node = (appData.nodes || []).find(n => n.id === nodeId);
  const existingEl = document.getElementById(`node-${nodeId}`);
  if (!node || !existingEl || !nodesLayer) {
    renderApp();
    return;
  }
  if (typeof invalidateNodeDimensionsCache === 'function') {
    invalidateNodeDimensionsCache(nodeId);
  }
  const newEl = createEventNodeDOM(node);
  existingEl.replaceWith(newEl);
  updateDynamicBandDimensions();
  makeNodesDraggable();
  setupPortDragEvents();
  renderConnectors();
  updateStats();
  if (window.lucide) lucide.createIcons();
}

function rerenderDialogue(dialogueId) {
  if (currentAppViewMode === 'mobile-stage') {
    renderApp();
    return;
  }
  const diag = (appData.dialogues || []).find(d => d.id === dialogueId);
  const existingEl = document.getElementById(`dialogue-${dialogueId}`);
  if (!diag || !existingEl || !nodesLayer) {
    renderApp();
    return;
  }
  if (typeof invalidateNodeDimensionsCache === 'function') {
    invalidateNodeDimensionsCache(dialogueId);
  }
  const newEl = createDialogueNodeDOM(diag);
  existingEl.replaceWith(newEl);
  updateDynamicBandDimensions();
  makeNodesDraggable();
  setupPortDragEvents();
  renderConnectors();
  updateStats();
  if (window.lucide) lucide.createIcons();
}

function showInboundConnectionsInfo(nodeId) {
  const node = (appData.nodes || []).find(n => n.id === nodeId);
  if (!node) return;
  
  const inboundSources = [];
  (appData.nodes || []).forEach(src => {
    (src.actions || []).forEach(act => {
      const targets = getActionTargetIds(act, src.id);
      if (targets.includes(nodeId)) {
        inboundSources.push({
          sourceNode: src,
          action: act,
          isSelf: (src.id === nodeId),
          label: `${src.codename} → Choice: ${act.shortDescription || 'Action'}`
        });
      }
    });
    if (src.inactionThreat && src.inactionThreat.targetNodeId === nodeId) {
      inboundSources.push({
        sourceNode: src,
        action: { id: 'inaction', shortDescription: 'Inaction Timeout' },
        isSelf: (src.id === nodeId),
        label: `${src.codename} → Inaction Timeout`
      });
    }
  });

  if (inboundSources.length === 0) {
    showToast(`Inbound Attachment Node: No actions currently lead into ${node.codename}. Drag an action port from the bottom of any event (or this block) to connect here.`, 'info');
    return;
  }

  const lines = inboundSources.map(s => `• ${s.label}${s.isSelf ? ' (Self-loop)' : ''}`).join('\n');
  showToast(`Inbound Connections to ${node.codename} (${inboundSources.length}):\n${lines}`, 'info');
}

window.showInboundConnectionsInfo = showInboundConnectionsInfo;
window.rerenderNode = rerenderNode;
window.rerenderDialogue = rerenderDialogue;