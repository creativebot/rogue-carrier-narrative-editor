// ============================================================================
// js/connectors.js - SVG Orthogonal Line Routing, Port Dragging & Collision Engine
// ============================================================================

// Interactive Port Drag Engine (Action Ports & Purple Dialogue Ports on Events)
function setupPortDragEvents() {
  if (window._portDragEventsInitialized) return;
  window._portDragEventsInitialized = true;
  function startPortDrag(targetEl, clientX, clientY) {
    if (!targetEl) return false;
    const actionPort = targetEl.closest('.action-port');
    const preEventPort = targetEl.closest('.pre-event-port');
    const postActionPort = targetEl.closest('.post-action-port');
    const actionOptionPort = targetEl.closest('.action-option-port');

    if (!actionPort && !preEventPort && !postActionPort && !actionOptionPort) return false;

    if (!canUserEdit()) {
      requireAuthToEdit("connect ports");
      return false;
    }

    if (actionPort) {
      document.body.classList.add('is-port-dragging');
      const nodeId = actionPort.getAttribute('data-node-id');
      const actionId = actionPort.getAttribute('data-action-id');
      const sourceNode = appData.nodes.find(n => n.id === nodeId);
      if (!sourceNode) return false;

      const hasInaction = Boolean(sourceNode.hasInactionThreat && sourceNode.inactionThreat);
      const actIdx = (sourceNode.actions || []).findIndex(a => a.id === actionId);
      const actionCount = Math.max((sourceNode.actions || []).length, 1);
      const totalCols = actionCount + (hasInaction ? 1 : 0);
      const colWidth = (820 - 140) / Math.max(totalCols, 1);
      const colIdx = actionId === 'inaction' ? actionCount : (actIdx !== -1 ? actIdx : 0);

      const sourceEl = document.getElementById(`node-${sourceNode.id}`);
      const sourceHeight = sourceEl ? sourceEl.offsetHeight : 520;

      let startX = sourceNode.position.x + 140 + (colIdx + 0.5) * colWidth;
      let startY = sourceNode.position.y + sourceHeight;
      if (canvasStage) {
        const portRect = actionPort.getBoundingClientRect();
        const stageRect = canvasStage.getBoundingClientRect();
        startX = (portRect.left + portRect.width / 2 - stageRect.left) / transform.scale;
        startY = (portRect.top + portRect.height / 2 - stageRect.top) / transform.scale;
      }

      portDragState = {
        isDragging: true,
        sourceType: 'action',
        sourceNodeId: nodeId,
        sourceActionId: actionId,
        startPos: { x: startX, y: startY }
      };
      return true;
    } else if (preEventPort) {
      document.body.classList.add('is-port-dragging');
      const nodeId = preEventPort.getAttribute('data-node-id');
      const sourceNode = appData.nodes.find(n => n.id === nodeId);
      if (!sourceNode) return false;

      let startX = sourceNode.position.x + 280;
      let startY = sourceNode.position.y + 20;
      if (canvasStage) {
        const portRect = preEventPort.getBoundingClientRect();
        const stageRect = canvasStage.getBoundingClientRect();
        startX = (portRect.left + portRect.width / 2 - stageRect.left) / transform.scale;
        startY = (portRect.top + portRect.height / 2 - stageRect.top) / transform.scale;
      }

      portDragState = {
        isDragging: true,
        sourceType: 'pre_event_dialogue',
        sourceNodeId: nodeId,
        sourceActionId: null,
        startPos: { x: startX, y: startY }
      };
      return true;
    } else if (actionOptionPort) {
      document.body.classList.add('is-port-dragging');
      const nodeId = actionOptionPort.getAttribute('data-node-id');
      const actionId = actionOptionPort.getAttribute('data-action-id');
      const sourceNode = appData.nodes.find(n => n.id === nodeId);
      if (!sourceNode) return false;

      let startX = sourceNode.position.x + 350;
      let startY = sourceNode.position.y + 50;
      if (canvasStage) {
        const portRect = actionOptionPort.getBoundingClientRect();
        const stageRect = canvasStage.getBoundingClientRect();
        startX = (portRect.left + portRect.width / 2 - stageRect.left) / transform.scale;
        startY = (portRect.top + portRect.height / 2 - stageRect.top) / transform.scale;
      }

      portDragState = {
        isDragging: true,
        sourceType: 'action_option_dialogue',
        sourceNodeId: nodeId,
        sourceActionId: actionId,
        startPos: { x: startX, y: startY }
      };
      return true;
    } else if (postActionPort) {
      document.body.classList.add('is-port-dragging');
      const nodeId = postActionPort.getAttribute('data-node-id');
      const actionId = postActionPort.getAttribute('data-action-id');
      const sourceNode = appData.nodes.find(n => n.id === nodeId);
      if (!sourceNode) return false;

      let startX = sourceNode.position.x + 880;
      let startY = sourceNode.position.y + 320;
      if (canvasStage) {
        const portRect = postActionPort.getBoundingClientRect();
        const stageRect = canvasStage.getBoundingClientRect();
        startX = (portRect.left + portRect.width / 2 - stageRect.left) / transform.scale;
        startY = (portRect.top + portRect.height / 2 - stageRect.top) / transform.scale;
      }

      portDragState = {
        isDragging: true,
        sourceType: 'post_action_dialogue',
        sourceNodeId: nodeId,
        sourceActionId: actionId,
        startPos: { x: startX, y: startY }
      };
      return true;
    }
    return false;
  }

  function movePortDrag(clientX, clientY) {
    if (!portDragState.isDragging || !canvasStage) return;

    const stageRect = canvasStage.getBoundingClientRect();
    const mouseX = (clientX - stageRect.left) / transform.scale;
    const mouseY = (clientY - stageRect.top) / transform.scale;

    renderTempConnectorPath(portDragState.startPos.x, portDragState.startPos.y, mouseX, mouseY);
  }

  function endPortDrag(clientX, clientY) {
    if (!portDragState.isDragging) return;
    document.body.classList.remove('is-port-dragging');

    const tempPath = document.getElementById('svg-temp-path');
    if (tempPath) tempPath.remove();

    const stageRect = canvasStage.getBoundingClientRect();
    const mouseX = (clientX - stageRect.left) / transform.scale;
    const mouseY = (clientY - stageRect.top) / transform.scale;
    const dragDist = Math.hypot(mouseX - portDragState.startPos.x, mouseY - portDragState.startPos.y);

    const elementUnderMouse = document.elementFromPoint(clientX, clientY);
    const targetInbound = elementUnderMouse ? elementUnderMouse.closest('.inbound-event-port') : null;
    const targetCard = elementUnderMouse ? elementUnderMouse.closest('.event-card, .deck-event-card, .generic-event-card') : null;
    const targetId = targetInbound ? targetInbound.getAttribute('data-node-id') : (targetCard ? targetCard.id.replace('node-', '') : null);
    const targetDialogue = elementUnderMouse ? elementUnderMouse.closest('.dialogue-card') : null;

    if (portDragState.sourceType === 'action') {
      const sourceNode = appData.nodes.find(n => n.id === portDragState.sourceNodeId);
      if (sourceNode) {
        if (portDragState.sourceActionId === 'inaction') {
          if (!sourceNode.inactionThreat) sourceNode.inactionThreat = {};
          if (targetId) {
            if (targetId === sourceNode.id) {
              if (dragDist < 20 && sourceNode.inactionThreat.targetNodeId === sourceNode.id) {
                portDragState.isDragging = false;
                disconnectActionTarget(sourceNode.id, 'inaction', sourceNode.id);
                return;
              }
              pushUndoState();
              sourceNode.inactionThreat.targetNodeId = sourceNode.id;
              showToast(`Inaction timeout loops back to ${sourceNode.codename}`, 'success');
            } else {
              pushUndoState();
              sourceNode.inactionThreat.targetNodeId = targetId;
              const linkedNode = appData.nodes.find(n => n.id === targetId);
              if (linkedNode) {
                showToast(`Inaction failure links ${sourceNode.codename} → ${linkedNode.codename}`, 'success');
              }
            }
          } else if (dragDist >= 30) {
            pushUndoState();
            let closestFloorIdx = 0;
            let minDistance = Infinity;
            FLOOR_Y.forEach((fy, idx) => {
              const dist = Math.abs(mouseY - fy);
              if (dist < minDistance) { minDistance = dist; closestFloorIdx = idx; }
            });
            const newCodename = generateNewEventCodename(sourceNode.category || 'KeyChain', closestFloorIdx, sourceNode.variationId || activeVariationId);
            const newNode = {
              id: `node_${Date.now()}`,
              codename: newCodename,
              name: `Consequence of ${sourceNode.name || sourceNode.codename}`,
              type: sourceNode.type || 'World',
              category: sourceNode.category || 'KeyChain',
              variationId: sourceNode.variationId || activeVariationId,
              floorIndex: closestFloorIdx,
              spawnConditions: `Inaction Failure on ${sourceNode.codename}`,
              eventDescription: "Catastrophic outcome occurred due to inaction...",
              reactionTimerHours: "Infinite",
              hasInactionThreat: false,
              inactionThreat: null,
              position: { x: Math.round(mouseX - 200), y: FLOOR_Y[closestFloorIdx] },
              actions: [
                { id: `c_${Date.now()}`, codeSuffix: "A", shortDescription: "Recover", description: "Attempt salvage", requirements: [], timerHours: 5, resultDescription: "", rewards: ["💀 Entropy +5"] }
              ]
            };
            appData.nodes.push(newNode);
            if (!sourceNode.inactionThreat) sourceNode.inactionThreat = {};
            sourceNode.inactionThreat.targetNodeId = newNode.id;
            preventNodeOverlap(newNode.id);
            resequenceStageEventCodenames(closestFloorIdx, sourceNode.category || 'KeyChain', sourceNode.variationId || activeVariationId);
          } else {
            portDragState.isDragging = false;
            renderApp();
            return;
          }
        } else {
          const action = (sourceNode.actions || []).find(a => a.id === portDragState.sourceActionId);
          if (action) {
            const currentTargets = getActionTargetIds(action, sourceNode.id);
            if (targetId) {
              if (targetId === sourceNode.id) {
                if (dragDist < 20 && currentTargets.includes(sourceNode.id)) {
                  portDragState.isDragging = false;
                  disconnectActionTarget(sourceNode.id, action.id, sourceNode.id);
                  return;
                }
                pushUndoState();
                addActionTargetId(action, sourceNode.id, null);
                showToast(`Action "${action.shortDescription || 'Choice'}" loops back to ${sourceNode.codename}`, 'success');
              } else {
                pushUndoState();
                addActionTargetId(action, targetId, sourceNode.id);
                const linkedNode = appData.nodes.find(n => n.id === targetId);
                if (linkedNode) {
                  showToast(`Linked ${sourceNode.codename} (${action.shortDescription || 'Choice'}) → ${linkedNode.codename}`, 'success');
                }
              }
            } else if (dragDist >= 30) {
              pushUndoState();
              let closestFloorIdx = 0;
              let minDistance = Infinity;
              FLOOR_Y.forEach((fy, idx) => {
                const dist = Math.abs(mouseY - fy);
                if (dist < minDistance) { minDistance = dist; closestFloorIdx = idx; }
              });

              const newCodename = generateNewEventCodename(sourceNode.category || 'KeyChain', closestFloorIdx, sourceNode.variationId || activeVariationId);
              const newNode = {
                id: `node_${Date.now()}`,
                codename: newCodename,
                name: `Outcome from ${sourceNode.name || sourceNode.codename}`,
                type: sourceNode.type || 'World',
                category: sourceNode.category || 'KeyChain',
                variationId: sourceNode.variationId || activeVariationId,
                floorIndex: closestFloorIdx,
                spawnConditions: `Triggered by ${sourceNode.codename}`,
                eventDescription: "Enter new outcome narrative body text...",
                reactionTimerHours: "Infinite",
                hasInactionThreat: false,
                inactionThreat: null,
                position: { x: Math.round(mouseX - 200), y: FLOOR_Y[closestFloorIdx] },
                actions: [
                  { id: `c_${Date.now()}`, codeSuffix: "A", shortDescription: "Continue", description: "Next step narrative", requirements: [], timerHours: 5, resultDescription: "", rewards: ["🧠 Knowledge +100"] }
                ]
              };

              appData.nodes.push(newNode);
              addActionTargetId(action, newNode.id, sourceNode.id);
              preventNodeOverlap(newNode.id);
              resequenceStageEventCodenames(closestFloorIdx, sourceNode.category || 'KeyChain', sourceNode.variationId || activeVariationId);
            } else {
              portDragState.isDragging = false;
              renderApp();
              return;
            }
          }
        }
      }
    } else if (portDragState.sourceType === 'pre_event_dialogue' || portDragState.sourceType === 'post_action_dialogue' || portDragState.sourceType === 'action_option_dialogue') {
      pushUndoState();
      if (targetDialogue) {
        const diagId = targetDialogue.id.replace('dialogue-', '');
        const diag = appData.dialogues.find(d => d.id === diagId);
        const sourceNode = appData.nodes.find(n => n.id === portDragState.sourceNodeId);

        if (diag && sourceNode) {
          let timing = 'post_action';
          let actId = portDragState.sourceActionId || null;
          if (portDragState.sourceType === 'pre_event_dialogue') {
            timing = 'pre_event';
            actId = null;
          } else if (portDragState.sourceType === 'action_option_dialogue') {
            timing = 'action_option';
          }
          addDialogueLink(diag, sourceNode.id, timing, actId);
          showToast(`Connected ${sourceNode.codename} to dialogue`, 'success');
        }
      } else {
        // Released on empty canvas or clicked: spawn new connected dialogue block!
        let timing = 'pre_event';
        if (portDragState.sourceType === 'action_option_dialogue') timing = 'action_option';
        else if (portDragState.sourceType === 'post_action_dialogue') timing = 'post_action';

        const dist = Math.hypot(mouseX - portDragState.startPos.x, mouseY - portDragState.startPos.y);
        const spawnX = dist > 20 ? Math.round(mouseX) : null;
        const spawnY = dist > 20 ? Math.round(mouseY) : null;
        createConnectedDialogueFromPort(portDragState.sourceNodeId, timing, portDragState.sourceActionId, spawnX, spawnY);
      }
    }

    if (!canUserEdit()) {
      portDragState.isDragging = false;
      return;
    }

    portDragState.isDragging = false;
    saveProjectToLocalStorage();
    renderApp();
  }

  // Mouse Listeners
  document.addEventListener('mousedown', (e) => {
    if (startPortDrag(e.target, e.clientX, e.clientY)) {
      e.stopPropagation();
    }
  });

  document.addEventListener('mousemove', (e) => {
    movePortDrag(e.clientX, e.clientY);
  });

  document.addEventListener('mouseup', (e) => {
    endPortDrag(e.clientX, e.clientY);
  });

  // Touch Listeners (Arrange Mode on iPad/Touchscreen)
  let lastTouchPos = { x: 0, y: 0 };
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    lastTouchPos = { x: t.clientX, y: t.clientY };
    if (startPortDrag(e.target, t.clientX, t.clientY)) {
      e.stopPropagation();
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!portDragState.isDragging || e.touches.length !== 1) return;
    const t = e.touches[0];
    lastTouchPos = { x: t.clientX, y: t.clientY };
    movePortDrag(t.clientX, t.clientY);
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!portDragState.isDragging) return;
    endPortDrag(lastTouchPos.x, lastTouchPos.y);
  });
}

function disconnectActionTarget(nodeId, actionId, specificTargetNodeId = null) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("disconnect connector wire")) return;
  const sourceNode = (appData.nodes || []).find(n => n.id === nodeId);
  if (!sourceNode) return;

  if (actionId === 'inaction') {
    if (!sourceNode.inactionThreat || !sourceNode.inactionThreat.targetNodeId) return;
    const targetNode = (appData.nodes || []).find(n => n.id === sourceNode.inactionThreat.targetNodeId);
    const isSelf = targetNode && targetNode.id === sourceNode.id;
    const targetLabel = targetNode ? (isSelf ? `${targetNode.codename} (Self-loop)` : targetNode.codename) : sourceNode.inactionThreat.targetNodeId;
    if (confirm(`Remove inaction failure link from ${sourceNode.codename} to ${targetLabel}?`)) {
      pushUndoState();
      sourceNode.inactionThreat.targetNodeId = null;
      saveProjectToLocalStorage();
      renderApp();
      showToast(`Disconnected ${sourceNode.codename} inaction link`, 'info');
    }
    return;
  }

  const action = (sourceNode.actions || []).find(a => a.id === actionId);
  if (!action) return;
  const targetIds = getActionTargetIds(action, sourceNode.id);
  if (targetIds.length === 0) return;

  if (specificTargetNodeId) {
    const targetNode = (appData.nodes || []).find(n => n.id === specificTargetNodeId);
    const isSelf = targetNode && targetNode.id === sourceNode.id;
    const targetLabel = targetNode ? (isSelf ? `${targetNode.codename} (Self-loop)` : targetNode.codename) : specificTargetNodeId;
    if (confirm(`Remove connection link from ${sourceNode.codename} (${action.shortDescription || 'Choice'}) to ${targetLabel}?`)) {
      pushUndoState();
      removeActionTargetId(action, specificTargetNodeId, sourceNode.id);
      saveProjectToLocalStorage();
      renderApp();
      showToast(`Disconnected ${sourceNode.codename} → ${targetLabel}`, 'info');
    }
    return;
  }

  if (targetIds.length === 1) {
    const onlyId = targetIds[0];
    const targetNode = (appData.nodes || []).find(n => n.id === onlyId);
    const isSelf = targetNode && targetNode.id === sourceNode.id;
    const targetLabel = targetNode ? (isSelf ? `${targetNode.codename} (Self-loop)` : targetNode.codename) : onlyId;
    if (confirm(`Remove connection link from ${sourceNode.codename} (${action.shortDescription || 'Choice'}) to ${targetLabel}?`)) {
      pushUndoState();
      removeActionTargetId(action, onlyId, sourceNode.id);
      saveProjectToLocalStorage();
      renderApp();
      showToast(`Disconnected ${sourceNode.codename} → ${targetLabel}`, 'info');
    }
  } else {
    const labels = targetIds.map(tid => {
      const tn = (appData.nodes || []).find(n => n.id === tid);
      return tn ? (tn.id === sourceNode.id ? `${tn.codename} (Self-loop)` : tn.codename) : tid;
    }).join(', ');
    if (confirm(`Remove all ${targetIds.length} connection links (${labels}) from ${sourceNode.codename} (${action.shortDescription || 'Choice'})?`)) {
      pushUndoState();
      action.targetNodeIds = [];
      action.targetNodeId = null;
      saveProjectToLocalStorage();
      renderApp();
      showToast(`Disconnected all links from ${sourceNode.codename} (${action.shortDescription || 'Choice'})`, 'info');
    }
  }
}
window.disconnectActionTarget = disconnectActionTarget;

function renderTempConnectorPath(x1, y1, x2, y2) {
  let tempPath = document.getElementById('svg-temp-path');
  if (!tempPath) {
    tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('id', 'svg-temp-path');
    tempPath.setAttribute('class', 'connector-path-temp');
    svgConnectors.appendChild(tempPath);
  }
  const isDialogue = portDragState && (portDragState.sourceType === 'pre_event_dialogue' || portDragState.sourceType === 'post_action_dialogue' || portDragState.sourceType === 'action_option_dialogue');
  let sourceRect = null;
  if (!isDialogue && portDragState && portDragState.sourceNodeId) {
    const sourceNode = appData.nodes.find(n => n.id === portDragState.sourceNodeId);
    if (sourceNode) {
      const sourceEl = document.getElementById(`node-${sourceNode.id}`);
      const sw = (sourceEl && sourceEl.offsetWidth > 100) ? sourceEl.offsetWidth : 940;
      const sh = (sourceEl && sourceEl.offsetHeight > 100) ? sourceEl.offsetHeight : 520;
      sourceRect = { x: sourceNode.position.x, y: sourceNode.position.y, w: sw, h: sh };
    }
  }
  const d = drawOrthogonalLine(x1, y1, x2, y2, sourceRect, null, 0);
  tempPath.setAttribute('d', d);
  if (isDialogue) {
    tempPath.style.stroke = (portDragState && portDragState.sourceType === 'action_option_dialogue') ? '#8b5cf6' : '#a855f7';
  } else {
    tempPath.style.stroke = '#22c55e';
  }
}

// Dimension caching to eliminate layout thrashing during 60 FPS schematic drag
const _nodeDimensionsCache = new Map();

function invalidateNodeDimensionsCache(nodeId = null) {
  if (nodeId) {
    _nodeDimensionsCache.delete('node_' + nodeId);
    _nodeDimensionsCache.delete('diag_' + nodeId);
  } else {
    _nodeDimensionsCache.clear();
  }
}
window.invalidateNodeDimensionsCache = invalidateNodeDimensionsCache;

function getNodeDimensions(id, isDialogue) {
  const key = (isDialogue ? 'diag_' : 'node_') + id;
  const cached = _nodeDimensionsCache.get(key);
  if (cached) return cached;

  let w = isDialogue ? 420 : 940;
  let h = isDialogue ? 260 : 520;

  const el = document.getElementById(isDialogue ? `dialogue-${id}` : `node-${id}`);
  if (el) {
    if (el.offsetWidth > 100) w = el.offsetWidth;
    if (el.offsetHeight > 100) h = el.offsetHeight;
  }
  const dims = { w, h };
  _nodeDimensionsCache.set(key, dims);
  return dims;
}
window.getNodeDimensions = getNodeDimensions;

function cacheAllNodeDimensions() {
  if (window.appData && Array.isArray(appData.nodes)) {
    appData.nodes.forEach(n => {
      const el = document.getElementById(`node-${n.id}`);
      if (el) {
        const w = el.offsetWidth > 100 ? el.offsetWidth : 940;
        const h = el.offsetHeight > 100 ? el.offsetHeight : 520;
        _nodeDimensionsCache.set('node_' + n.id, { w, h });
      }
    });
  }
  if (window.appData && Array.isArray(appData.dialogues)) {
    appData.dialogues.forEach(d => {
      const el = document.getElementById(`dialogue-${d.id}`);
      if (el) {
        const w = el.offsetWidth > 100 ? el.offsetWidth : 420;
        const h = el.offsetHeight > 100 ? el.offsetHeight : 260;
        _nodeDimensionsCache.set('diag_' + d.id, { w, h });
      }
    });
  }
}
window.cacheAllNodeDimensions = cacheAllNodeDimensions;

// Real-Time In-Place Connector Updates (Pure 90-degree orthogonal, 0ms overhead, no DOM recreation)
function updateDialogueConnectorGroups(diagGroups) {
  const LABEL_WIDTH = 190;
  diagGroups.forEach(group => {
    const dialogueId = group.dataset.dialogueId;
    const sourceId = group.dataset.sourceId;
    const linkIdx = parseInt(group.dataset.linkIdx, 10);
    const activeIdx = parseInt(group.dataset.activeIdx || '0', 10);
    const activeCount = parseInt(group.dataset.activeCount || '1', 10);
    const triggerTiming = group.dataset.triggerTiming || '';
    const triggerActionId = group.dataset.triggerActionId || '';

    const dialogue = (appData.dialogues || []).find(d => d.id === dialogueId);
    const sourceNode = (appData.nodes || []).find(n => n.id === sourceId);
    if (!dialogue || !sourceNode) return;

    const dDim = getNodeDimensions(dialogueId, true);
    const sDim = getNodeDimensions(sourceId, false);

    let sourceRect = { x: sourceNode.position.x, y: sourceNode.position.y, w: sDim.w, h: sDim.h };
    if ((triggerTiming === 'action_option' || triggerTiming === 'post_action') && triggerActionId) {
      const hasInaction = Boolean(sourceNode.hasInactionThreat && sourceNode.inactionThreat);
      const actionCount = Math.max((sourceNode.actions || []).length, 1);
      const totalCols = actionCount + (hasInaction ? 1 : 0);
      const actIdx = triggerActionId === 'inaction'
        ? actionCount
        : (sourceNode.actions || []).findIndex(a => a.id === triggerActionId);

      if (actIdx !== -1) {
        const colWidth = (sDim.w - LABEL_WIDTH) / Math.max(totalCols, 1);
        const colCenterX = sourceNode.position.x + LABEL_WIDTH + (actIdx + 0.5) * colWidth;

        if (dialogue.position.y + dDim.h <= sourceNode.position.y + 40 || dialogue.position.y >= sourceNode.position.y + sDim.h - 40) {
          sourceRect = {
            x: colCenterX - 35,
            y: sourceNode.position.y,
            w: 70,
            h: sDim.h
          };
        }
      }
    }

    const laneOffset = activeCount > 1
      ? Math.round((activeIdx - (activeCount - 1) / 2) * 34)
      : 0;

    const {
      path: orthoPath,
      startX, startY,
      endX, endY,
      midX, midY,
      startAngle, endAngle,
      startVec, endVec
    } = calculateOrthogonalDialogueConnector(
      sourceRect,
      { x: dialogue.position.x, y: dialogue.position.y, w: dDim.w, h: dDim.h },
      laneOffset
    );

    const hitPath = group.querySelector('.connector-path-hit');
    const diagPath = group.querySelector('.connector-path-dialogue');
    if (hitPath) hitPath.setAttribute('d', orthoPath);
    if (diagPath) diagPath.setAttribute('d', orthoPath);

    // Update overlay elements in place
    const arrowBtn1 = document.getElementById(`dialogue-arrow-event-${dialogueId}-${linkIdx}`);
    const arrowBtn2 = document.getElementById(`dialogue-arrow-diag-${dialogueId}-${linkIdx}`);
    const badge = document.getElementById(`dialogue-badge-${dialogueId}-${linkIdx}`);

    const lineDist = Math.hypot(endX - startX, endY - startY);
    const arrowMargin = Math.max(16, Math.min(26, Math.floor(lineDist * 0.22)));

    if (arrowBtn1) {
      const arrow1X = Math.round(startX + startVec.x * arrowMargin);
      const arrow1Y = Math.round(startY + startVec.y * arrowMargin);
      arrowBtn1.style.left = `${arrow1X}px`;
      arrowBtn1.style.top = `${arrow1Y}px`;
      const svgIcon = arrowBtn1.querySelector('svg');
      if (svgIcon) svgIcon.style.transform = `rotate(${startAngle}deg)`;
    }

    if (arrowBtn2) {
      const arrow2X = Math.round(endX + endVec.x * arrowMargin);
      const arrow2Y = Math.round(endY + endVec.y * arrowMargin);
      arrowBtn2.style.left = `${arrow2X}px`;
      arrowBtn2.style.top = `${arrow2Y}px`;
      const svgIcon = arrowBtn2.querySelector('svg');
      if (svgIcon) svgIcon.style.transform = `rotate(${endAngle}deg)`;
    }

    if (badge) {
      badge.style.left = `${midX}px`;
      badge.style.top = `${midY}px`;
    }
  });
}

function updateConnectedConnectorsForNode(draggedId, isDialogue) {
  if (!svgConnectors) return;
  const LABEL_WIDTH = 190;

  if (!isDialogue) {
    // 1. Event node dragged: update all connected event-to-event links
    const eventGroups = svgConnectors.querySelectorAll(
      `g.connector-link-group[data-link-type="event"][data-source-id="${draggedId}"], g.connector-link-group[data-link-type="event"][data-target-id="${draggedId}"]`
    );

    eventGroups.forEach(group => {
      const sourceId = group.dataset.sourceId;
      const targetId = group.dataset.targetId;
      const actIdx = parseInt(group.dataset.actIdx, 10);
      const targetSubIdx = parseInt(group.dataset.targetSubIdx || '0', 10);
      const incomingIdx = parseInt(group.dataset.incomingIdx || '0', 10);
      const incomingCount = parseInt(group.dataset.incomingCount || '1', 10);

      const sourceNode = (appData.nodes || []).find(n => n.id === sourceId);
      const targetNode = (appData.nodes || []).find(n => n.id === targetId);
      if (!sourceNode || !targetNode) return;

      const sDim = getNodeDimensions(sourceId, false);
      const tDim = getNodeDimensions(targetId, false);
      const sourceRect = { x: sourceNode.position.x, y: sourceNode.position.y, w: sDim.w, h: sDim.h };
      const targetRect = { x: targetNode.position.x, y: targetNode.position.y, w: tDim.w, h: tDim.h };

      const hasInaction = Boolean(sourceNode.hasInactionThreat && sourceNode.inactionThreat);
      const actionCount = Math.max((sourceNode.actions || []).length, 1);
      const totalCols = actionCount + (hasInaction ? 1 : 0);
      const colWidth = (sDim.w - LABEL_WIDTH) / Math.max(totalCols, 1);

      const startX = sourceNode.position.x + LABEL_WIDTH + (actIdx + 0.5) * colWidth;
      const startY = sourceNode.position.y + sDim.h;

      const topEntryOffset = incomingCount > 1
        ? Math.round((incomingIdx - (incomingCount - 1) / 2) * 32)
        : 0;

      const endX = targetNode.position.x + (tDim.w / 2) + topEntryOffset;
      const endY = targetNode.position.y;

      const orthoPath = drawOrthogonalLine(startX, startY, endX, endY, sourceRect, targetRect, incomingIdx + targetSubIdx);

      const hitPath = group.querySelector('.connector-path-hit');
      const orthoPathEl = group.querySelector('.connector-path-ortho');
      if (hitPath) hitPath.setAttribute('d', orthoPath);
      if (orthoPathEl) orthoPathEl.setAttribute('d', orthoPath);
    });

    // 2. Event node dragged: update dialogue links where this node is the event source
    const diagGroups = svgConnectors.querySelectorAll(
      `g.connector-link-group[data-link-type="dialogue"][data-source-id="${draggedId}"]`
    );
    updateDialogueConnectorGroups(diagGroups);
  } else {
    // Dialogue node dragged: update dialogue links where this dialogue is connected
    const diagGroups = svgConnectors.querySelectorAll(
      `g.connector-link-group[data-link-type="dialogue"][data-dialogue-id="${draggedId}"]`
    );
    updateDialogueConnectorGroups(diagGroups);
  }
}
window.updateConnectedConnectorsForNode = updateConnectedConnectorsForNode;

// Stage-Embedded Pure Stage Coordinate Connector Renderer (Zero Drift on Zoom/Pan)
function renderConnectors() {
  if (!svgConnectors) return;
  
  const defs = svgConnectors.querySelector('defs');
  svgConnectors.innerHTML = '';
  if (defs) svgConnectors.appendChild(defs);

  const overlaysLayer = document.getElementById('connector-overlays-layer');
  if (overlaysLayer) overlaysLayer.innerHTML = '';

  const NODE_WIDTH = 940;
  const LABEL_WIDTH = 190;

  const isPoolPage = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool');

  // 1. Collect & Draw Action/Inaction -> Event Connections (including self-loops and multi-target links)
  const eventLinks = [];
  appData.nodes.forEach(sourceNode => {
    if (!isPoolPage && sourceNode.variationId && sourceNode.variationId !== activeVariationId) return;
    if ((sourceNode.category || 'KeyChain') !== activeCategoryFilter) return;

    const sourceDims = getNodeDimensions(sourceNode.id, false);
    const sourceHeight = sourceDims.h;
    const sourceWidth = sourceDims.w;
    const sourceRect = { x: sourceNode.position.x, y: sourceNode.position.y, w: sourceWidth, h: sourceHeight };
    const hasInaction = Boolean(sourceNode.hasInactionThreat && sourceNode.inactionThreat);
    const actionCount = Math.max((sourceNode.actions || []).length, 1);
    const totalCols = actionCount + (hasInaction ? 1 : 0);
    const colWidth = (sourceWidth - LABEL_WIDTH) / Math.max(totalCols, 1);

    (sourceNode.actions || []).forEach((action, actIdx) => {
      const targetIds = getActionTargetIds(action, sourceNode.id);
      if (targetIds.length === 0) return;

      targetIds.forEach((targetId, targetSubIdx) => {
        const targetNode = appData.nodes.find(n => n.id === targetId);
        if (!targetNode) return;
        if (!isPoolPage && targetNode.variationId && targetNode.variationId !== activeVariationId) return;
        if ((targetNode.category || 'KeyChain') !== activeCategoryFilter) return;

        const targetDims = getNodeDimensions(targetNode.id, false);
        const targetWidth = targetDims.w;
        const targetHeight = targetDims.h;
        const targetRect = { x: targetNode.position.x, y: targetNode.position.y, w: targetWidth, h: targetHeight };

        const startX = sourceNode.position.x + LABEL_WIDTH + (actIdx + 0.5) * colWidth;
        const startY = sourceNode.position.y + sourceHeight;

        eventLinks.push({
          type: 'action',
          sourceNode,
          targetNode,
          action,
          actIdx,
          targetSubIdx,
          startX,
          startY,
          sourceRect,
          targetRect,
          targetWidth
        });
      });
    });

    // Inaction Threat -> Consequence Node Connection (supports consequence in self or external event)
    if (hasInaction && sourceNode.inactionThreat && sourceNode.inactionThreat.targetNodeId) {
      const targetNode = appData.nodes.find(n => n.id === sourceNode.inactionThreat.targetNodeId);
      if (targetNode) {
        if (!isPoolPage && targetNode.variationId && targetNode.variationId !== activeVariationId) return;
        if ((targetNode.category || 'KeyChain') !== activeCategoryFilter) return;

        const targetDims = getNodeDimensions(targetNode.id, false);
        const targetWidth = targetDims.w;
        const targetHeight = targetDims.h;
        const targetRect = { x: targetNode.position.x, y: targetNode.position.y, w: targetWidth, h: targetHeight };

        const startX = sourceNode.position.x + LABEL_WIDTH + (actionCount + 0.5) * colWidth;
        const startY = sourceNode.position.y + sourceHeight;

        eventLinks.push({
          type: 'inaction',
          sourceNode,
          targetNode,
          action: null,
          actIdx: actionCount,
          startX,
          startY,
          sourceRect,
          targetRect,
          targetWidth
        });
      }
    }
  });

  // Group incoming links by targetNode.id so multiple lines entering the same event top edge stay distinct
  const incomingByTarget = new Map();
  eventLinks.forEach(link => {
    const tid = link.targetNode.id;
    if (!incomingByTarget.has(tid)) incomingByTarget.set(tid, []);
    incomingByTarget.get(tid).push(link);
  });
  incomingByTarget.forEach(list => {
    list.sort((a, b) => a.startX - b.startX);
  });

  // Update inbound port classes and tooltips across all rendered nodes (only mutate when changed)
  appData.nodes.forEach(node => {
    const el = document.getElementById(`node-${node.id}`);
    if (!el) return;
    const ports = el.querySelectorAll('.inbound-event-port');
    const incList = incomingByTarget.get(node.id) || [];
    const hasInbound = incList.length > 0;
    ports.forEach(p => {
      const alreadyHas = p.classList.contains('has-inbound-links');
      if (hasInbound !== alreadyHas) {
        p.classList.toggle('has-inbound-links', hasInbound);
        p.title = hasInbound
          ? `Attachment node: ${incList.length} incoming action link(s). Click to view details.`
          : `Inbound attachment node: drop action choice connectors here to lead into this event (including from this block's own choices).`;
      }
    });
  });

  eventLinks.forEach((link) => {
    const { sourceNode, targetNode, action, startX, startY, sourceRect, targetRect, targetWidth } = link;
    const incomingList = incomingByTarget.get(targetNode.id) || [link];
    const incomingIdx = incomingList.indexOf(link);
    const incomingCount = incomingList.length;

    const topEntryOffset = incomingCount > 1
      ? Math.round((incomingIdx - (incomingCount - 1) / 2) * 32)
      : 0;

    const endX = targetNode.position.x + (targetWidth / 2) + topEntryOffset;
    const endY = targetNode.position.y;

    const orthoPath = drawOrthogonalLine(startX, startY, endX, endY, sourceRect, targetRect, incomingIdx + (link.targetSubIdx || 0));
    const isDimmedLink = isPoolPage && (isPoolNodeDimmed(sourceNode.id) || isPoolNodeDimmed(targetNode.id));

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'connector-link-group');
    group.dataset.linkType = 'event';
    group.dataset.sourceId = sourceNode.id;
    group.dataset.targetId = targetNode.id;
    group.dataset.linkKind = link.type;
    group.dataset.actionId = link.type === 'inaction' ? 'inaction' : (action ? action.id : '');
    group.dataset.actIdx = link.actIdx;
    group.dataset.targetSubIdx = link.targetSubIdx || 0;
    group.dataset.incomingIdx = incomingIdx;
    group.dataset.incomingCount = incomingCount;

    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', orthoPath);
    hitPath.setAttribute('class', 'connector-path-hit');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', orthoPath);
    path.setAttribute('class', 'connector-path-ortho' + (isDimmedLink ? ' is-pool-dimmed' : ''));
    path.setAttribute('marker-end', 'url(#arrow)');

    const handleDisconnect = (e) => {
      e.stopPropagation();
      disconnectActionTarget(sourceNode.id, link.type === 'inaction' ? 'inaction' : action.id, targetNode.id);
    };

    if (link.type === 'inaction') {
      path.style.stroke = '#ef4444';
    }
    group.onclick = handleDisconnect;
    hitPath.onclick = handleDisconnect;
    path.onclick = handleDisconnect;

    group.appendChild(hitPath);
    group.appendChild(path);
    svgConnectors.appendChild(group);
  });

  // 2. Draw Event -> Dialogue Connections (Supports multiple action outcomes / event triggers connected to a single dialogue block)
  appData.dialogues.forEach(dialogue => {
    const links = getDialogueLinks(dialogue);
    if (!links || links.length === 0) return;

    const diagDims = getNodeDimensions(dialogue.id, true);
    const w2 = diagDims.w;
    const h2 = diagDims.h;

    // Collect valid links visible on the active board
    const activeLinks = [];
    links.forEach((link, linkIdx) => {
      if (!link || !link.targetEventId) return;
      const sourceNode = appData.nodes.find(n => n.id === link.targetEventId);
      if (!sourceNode) return;
      if (!isPoolPage && sourceNode.variationId && sourceNode.variationId !== activeVariationId) return;
      if ((sourceNode.category || 'KeyChain') !== activeCategoryFilter) return;
      activeLinks.push({ link, linkIdx, sourceNode });
    });

    activeLinks.forEach(({ link, linkIdx, sourceNode }, activeIdx) => {
      const sourceDims = getNodeDimensions(sourceNode.id, false);
      const w1 = sourceDims.w;
      const h1 = sourceDims.h;

      const laneOffset = activeLinks.length > 1
        ? Math.round((activeIdx - (activeLinks.length - 1) / 2) * 34)
        : 0;

      let sourceRect = { x: sourceNode.position.x, y: sourceNode.position.y, w: w1, h: h1 };
      if ((link.triggerTiming === 'action_option' || link.triggerTiming === 'post_action') && link.triggerActionId) {
        const hasInaction = Boolean(sourceNode.hasInactionThreat && sourceNode.inactionThreat);
        const actionCount = Math.max((sourceNode.actions || []).length, 1);
        const totalCols = actionCount + (hasInaction ? 1 : 0);
        const actIdx = link.triggerActionId === 'inaction'
          ? actionCount
          : (sourceNode.actions || []).findIndex(a => a.id === link.triggerActionId);

        if (actIdx !== -1) {
          const colWidth = (w1 - LABEL_WIDTH) / Math.max(totalCols, 1);
          const colCenterX = sourceNode.position.x + LABEL_WIDTH + (actIdx + 0.5) * colWidth;

          // If dialogue is above or below the event card, anchor to this specific action column bounds
          if (dialogue.position.y + h2 <= sourceNode.position.y + 40 || dialogue.position.y >= sourceNode.position.y + h1 - 40) {
            sourceRect = {
              x: colCenterX - 35,
              y: sourceNode.position.y,
              w: 70,
              h: h1
            };
          }
        }
      }

      const {
        path: orthoPath,
        startX, startY,
        endX, endY,
        midX, midY,
        startAngle, endAngle,
        startVec, endVec
      } = calculateOrthogonalDialogueConnector(
        sourceRect,
        { x: dialogue.position.x, y: dialogue.position.y, w: w2, h: h2 },
        laneOffset
      );

      const isDimmedDiag = isPoolPage && isPoolNodeDimmed(sourceNode.id);

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'connector-link-group');
      group.dataset.linkType = 'dialogue';
      group.dataset.dialogueId = dialogue.id;
      group.dataset.sourceId = sourceNode.id;
      group.dataset.linkIdx = linkIdx;
      group.dataset.activeIdx = activeIdx;
      group.dataset.activeCount = activeLinks.length;
      group.dataset.triggerTiming = link.triggerTiming || '';
      group.dataset.triggerActionId = link.triggerActionId || '';

      const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitPath.setAttribute('d', orthoPath);
      hitPath.setAttribute('class', 'connector-path-hit');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('id', `connector-path-diag-${dialogue.id}-${linkIdx}`);
      path.setAttribute('d', orthoPath);
      path.setAttribute('class', 'connector-path-dialogue' + (link.triggerTiming === 'action_option' ? ' is-action-option' : '') + (isDimmedDiag ? ' is-pool-dimmed' : ''));
      path.title = "Click to disconnect this dialogue link";

      const handleDiagDisconnect = (e) => {
        e.stopPropagation();
        const condLabel = link.triggerCondition || sourceNode.codename;
        if (confirm(`Disconnect dialogue link "${condLabel}" from ${sourceNode.codename}?`)) {
          removeDialogueLinkAt(dialogue.id, linkIdx);
        }
      };

      group.onclick = handleDiagDisconnect;
      hitPath.onclick = handleDiagDisconnect;
      path.onclick = handleDiagDisconnect;

      group.appendChild(hitPath);
      group.appendChild(path);
      svgConnectors.appendChild(group);

      if (overlaysLayer) {
        // Dynamic margin along the connector line: keeps purple jump arrows clearly separated from card edges and zoom controls
        const lineDist = Math.hypot(endX - startX, endY - startY);
        const arrowMargin = Math.max(16, Math.min(26, Math.floor(lineDist * 0.22)));

        // 1. Arrow Button at Event edge pointing toward dialogue
        const arrow1X = Math.round(startX + startVec.x * arrowMargin);
        const arrow1Y = Math.round(startY + startVec.y * arrowMargin);

        const arrowBtn1 = document.createElement('button');
        arrowBtn1.type = 'button';
        arrowBtn1.id = `dialogue-arrow-event-${dialogue.id}-${linkIdx}`;
        arrowBtn1.className = 'dialogue-jump-arrow-btn dialogue-arrow-to-dialogue' + (isDimmedDiag ? ' is-pool-dimmed' : '');
        arrowBtn1.style.left = `${arrow1X}px`;
        arrowBtn1.style.top = `${arrow1Y}px`;
        arrowBtn1.title = "Jump to connected dialogue block";
        arrowBtn1.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${startAngle}deg);">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        `;
        arrowBtn1.onclick = (e) => {
          e.stopPropagation();
          zoomInToBlock(dialogue.id, true);
        };
        overlaysLayer.appendChild(arrowBtn1);

        // 2. Return Arrow Button at Dialogue edge pointing back toward event
        const arrow2X = Math.round(endX + endVec.x * arrowMargin);
        const arrow2Y = Math.round(endY + endVec.y * arrowMargin);

        const arrowBtn2 = document.createElement('button');
        arrowBtn2.type = 'button';
        arrowBtn2.id = `dialogue-arrow-diag-${dialogue.id}-${linkIdx}`;
        arrowBtn2.className = 'dialogue-jump-arrow-btn dialogue-arrow-to-event' + (isDimmedDiag ? ' is-pool-dimmed' : '');
        arrowBtn2.style.left = `${arrow2X}px`;
        arrowBtn2.style.top = `${arrow2Y}px`;
        arrowBtn2.title = `Jump back to event block: ${sourceNode.codename}`;
        arrowBtn2.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${endAngle}deg);">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        `;
        arrowBtn2.onclick = (e) => {
          e.stopPropagation();
          zoomInToBlock(sourceNode.id, false);
        };
        overlaysLayer.appendChild(arrowBtn2);

        // 3. Middle Trigger Description Badge
        const rawCond = link.triggerCondition || dialogue.triggerCondition || '';
        const triggerText = rawCond.trim() !== '' ? rawCond.trim() : 'Dialog spawn trigger';
        const isDefault = rawCond.trim() === '';

        const badge = document.createElement('div');
        badge.id = `dialogue-badge-${dialogue.id}-${linkIdx}`;
        badge.className = `dialogue-trigger-badge ${isDefault ? 'is-default' : ''}${isDimmedDiag ? ' is-pool-dimmed' : ''}`;
        badge.style.left = `${midX}px`;
        badge.style.top = `${midY}px`;
        badge.title = "Click to edit dialogue spawn trigger description";
        badge.innerHTML = `<span class="truncate">${triggerText}</span>`;
        badge.onclick = (e) => {
          e.stopPropagation();
          makeInlineDialogueTriggerBadgeEditable(badge, dialogue.id, linkIdx);
        };
        overlaysLayer.appendChild(badge);
      }
    });
  });
}

function drawOrthogonalLine(x1, y1, x2, y2, sourceRect = null, targetRect = null, routeOffset = 0) {
  const EXIT_DROP = 38 + (routeOffset * 10);
  const ENTRY_CLEARANCE = 44 + (routeOffset * 10);

  // Standard forward/downward connection (target event top edge is comfortably below source port)
  if (y2 >= y1 + 68) {
    const midY = Math.round(y1 + (y2 - y1) / 2);
    return `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`;
  }

  // Same-stage, earlier-stage, or vertically close/overlapping connection:
  // Always exit downward from the source port, break orthogonally to a clear vertical corridor,
  // route above the target event's top edge, and drop straight down into the top edge (x2, y2).
  const exitY = Math.round(y1 + EXIT_DROP);
  const entryY = Math.round(y2 - ENTRY_CLEARANCE);

  let corridorX;
  if (sourceRect && targetRect) {
    const sLeft = sourceRect.x;
    const sRight = sourceRect.x + sourceRect.w;
    const tLeft = targetRect.x;
    const tRight = targetRect.x + targetRect.w;

    if (tLeft >= sRight + 24) {
      // Target is to the right of source: route up through the horizontal gap between them
      corridorX = Math.round((sRight + tLeft) / 2 + (routeOffset * 12));
    } else if (sLeft >= tRight + 24) {
      // Target is to the left of source: route up through the horizontal gap between them
      corridorX = Math.round((tRight + sLeft) / 2 - (routeOffset * 12));
    } else {
      // Cards overlap horizontally (e.g. Stage 2 event connecting back up to Stage 1 event above it):
      // Route around the closer outer vertical side of both cards
      const outerLeft = Math.min(sLeft, tLeft) - 48 - (routeOffset * 12);
      const outerRight = Math.max(sRight, tRight) + 48 + (routeOffset * 12);
      const distLeft = Math.abs(x1 - outerLeft) + Math.abs(x2 - outerLeft);
      const distRight = Math.abs(outerRight - x1) + Math.abs(outerRight - x2);
      corridorX = Math.round(distLeft <= distRight ? outerLeft : outerRight);
    }
  } else if (sourceRect) {
    const sLeft = sourceRect.x;
    const sRight = sourceRect.x + sourceRect.w;
    if (x2 >= sRight + 24) {
      corridorX = Math.round((sRight + x2) / 2);
    } else if (x2 <= sLeft - 24) {
      corridorX = Math.round((sLeft + x2) / 2);
    } else {
      const outerLeft = sLeft - 48;
      const outerRight = sRight + 48;
      const distLeft = Math.abs(x1 - outerLeft) + Math.abs(x2 - outerLeft);
      const distRight = Math.abs(outerRight - x1) + Math.abs(outerRight - x2);
      corridorX = Math.round(distLeft <= distRight ? outerLeft : outerRight);
    }
  } else {
    corridorX = Math.abs(x2 - x1) > 80
      ? Math.round(x1 + (x2 - x1) / 2)
      : Math.round(x1 + (x2 >= x1 ? 240 : -240));
  }

  return `M ${x1} ${y1} V ${exitY} H ${corridorX} V ${entryY} H ${x2} V ${y2}`;
}

// Orthogonal Connector Engine for Dialogue Cards:
// 1. Tries to be a single straight horizontal or vertical line if overlapping on that axis.
// 2. Only if it cannot be a single line (diagonal), breaks orthogonally with right angles (90 degrees).
function calculateOrthogonalDialogueConnector(sourceRect, diagRect, laneOffset = 0) {
  const x1 = sourceRect.x, y1 = sourceRect.y, w1 = sourceRect.w, h1 = sourceRect.h;
  const x2 = diagRect.x, y2 = diagRect.y, w2 = diagRect.w, h2 = diagRect.h;

  const c1x = x1 + w1 / 2, c1y = y1 + h1 / 2;
  const c2x = x2 + w2 / 2, c2y = y2 + h2 / 2;

  const overlapX = (x1 < x2 + w2) && (x1 + w1 > x2);
  const overlapY = (y1 < y2 + h2) && (y1 + h1 > y2);

  let path = '';
  let startX = 0, startY = 0, endX = 0, endY = 0;
  let midX = 0, midY = 0;
  let startAngle = 0;
  let endAngle = 0;
  let startVec = { x: 1, y: 0 };
  let endVec = { x: -1, y: 0 };

  // PRIORITY 1: Purely horizontal straight line (vertical overlap with dialogue to right or left)
  if (overlapY && (x2 >= x1 + w1 || x2 + w2 <= x1)) {
    const minY = Math.max(y1, y2);
    const maxY = Math.min(y1 + h1, y2 + h2);
    let yStar = Math.round((minY + maxY) / 2 + laneOffset);

    // Margin safety: keep horizontal connector lines and purple arrows from overlapping header-level zoom buttons (top 50px)
    if (yStar < minY + 52 && (maxY - minY > 70)) {
      yStar = Math.min(maxY - 25, minY + 62);
    }
    yStar = Math.max(minY + 24, Math.min(maxY - 20, yStar));

    if (x2 >= x1 + w1) {
      // Dialogue is to the right
      startX = x1 + w1;
      startY = yStar;
      endX = x2;
      endY = yStar;
      startAngle = 0;
      endAngle = 180;
      startVec = { x: 1, y: 0 };
      endVec = { x: -1, y: 0 };
    } else {
      // Dialogue is to the left
      startX = x1;
      startY = yStar;
      endX = x2 + w2;
      endY = yStar;
      startAngle = 180;
      endAngle = 0;
      startVec = { x: -1, y: 0 };
      endVec = { x: 1, y: 0 };
    }
    path = `M ${startX} ${startY} H ${endX}`;
    midX = Math.round((startX + endX) / 2);
    midY = yStar;
  }
  // PRIORITY 2: Purely vertical straight line (horizontal overlap with dialogue above or below)
  else if (overlapX && (y2 >= y1 + h1 || y2 + h2 <= y1)) {
    const minX = Math.max(x1, x2);
    const maxX = Math.min(x1 + w1, x2 + w2);
    const xStar = Math.round(Math.max(minX + 20, Math.min(maxX - 20, (minX + maxX) / 2 + laneOffset)));

    if (y2 >= y1 + h1) {
      // Dialogue is below event
      startX = xStar;
      startY = y1 + h1;
      endX = xStar;
      endY = y2;
      startAngle = 90;
      endAngle = -90;
      startVec = { x: 0, y: 1 };
      endVec = { x: 0, y: -1 };
    } else {
      // Dialogue is above event
      startX = xStar;
      startY = y1;
      endX = xStar;
      endY = y2 + h2;
      startAngle = -90;
      endAngle = 90;
      startVec = { x: 0, y: -1 };
      endVec = { x: 0, y: 1 };
    }
    path = `M ${startX} ${startY} V ${endY}`;
    midX = xStar;
    midY = Math.round((startY + endY) / 2);
  }
  // PRIORITY 3: Diagonal - Break orthogonally at 90 degrees
  else {
    const dx = c2x - c1x;
    const dy = c2y - c1y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      // Horizontal dominant: step horizontally then vertically (clearing top zoom buttons)
      if (dx >= 0) {
        // Dialogue to the right
        startX = x1 + w1;
        startY = Math.round(Math.min(Math.max(c2y + laneOffset, y1 + 55), y1 + h1 - 35));
        endX = x2;
        endY = Math.round(Math.min(Math.max(c1y + laneOffset, y2 + 55), y2 + h2 - 25));
        startAngle = 0;
        endAngle = 180;
        startVec = { x: 1, y: 0 };
        endVec = { x: -1, y: 0 };
      } else {
        // Dialogue to the left
        startX = x1;
        startY = Math.round(Math.min(Math.max(c2y + laneOffset, y1 + 55), y1 + h1 - 35));
        endX = x2 + w2;
        endY = Math.round(Math.min(Math.max(c1y + laneOffset, y2 + 55), y2 + h2 - 25));
        startAngle = 180;
        endAngle = 0;
        startVec = { x: -1, y: 0 };
        endVec = { x: 1, y: 0 };
      }
      midX = Math.round((startX + endX) / 2 + (laneOffset * 0.4));
      midY = Math.round((startY + endY) / 2);
      path = `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
    } else {
      // Vertical dominant: step vertically then horizontally
      if (dy >= 0) {
        // Dialogue below
        startY = y1 + h1;
        startX = Math.round(Math.min(Math.max(c1x, x1 + 35), x1 + w1 - 35));
        endY = y2;
        endX = Math.round(Math.min(Math.max(c2x + laneOffset, x2 + 30), x2 + w2 - 30));
        startAngle = 90;
        endAngle = -90;
        startVec = { x: 0, y: 1 };
        endVec = { x: 0, y: -1 };
      } else {
        // Dialogue above
        startY = y1;
        startX = Math.round(Math.min(Math.max(c1x, x1 + 35), x1 + w1 - 35));
        endY = y2 + h2;
        endX = Math.round(Math.min(Math.max(c2x + laneOffset, x2 + 30), x2 + w2 - 30));
        startAngle = -90;
        endAngle = 90;
        startVec = { x: 0, y: -1 };
        endVec = { x: 0, y: 1 };
      }
      midX = Math.round((startX + endX) / 2);
      midY = Math.round((startY + endY) / 2 + (laneOffset * 0.4));
      path = `M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`;
    }
  }

  return {
    path,
    startX, startY,
    endX, endY,
    midX, midY,
    startAngle, endAngle,
    startVec, endVec
  };
}

// Non-Overlapping Collision Prevention Engine
function preventNodeOverlap(movedId) {
  const MIN_MARGIN = 30;
  const allElements = [];
  const isPoolPage = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool');

  appData.nodes.forEach(n => {
    if (!isPoolPage && n.variationId && n.variationId !== activeVariationId) return;
    if ((n.category || 'KeyChain') !== activeCategoryFilter) return;
    const el = document.getElementById(`node-${n.id}`);
    allElements.push({
      id: n.id,
      isEvent: true,
      obj: n,
      width: el ? el.offsetWidth : 880,
      height: el ? el.offsetHeight : 540
    });
  });

  appData.dialogues.forEach(d => {
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
    allElements.push({
      id: d.id,
      isEvent: false,
      obj: d,
      width: el ? el.offsetWidth : 420,
      height: el ? el.offsetHeight : 260
    });
  });

  const moved = allElements.find(item => item.id === movedId);
  if (!moved) return;

  // Relaxation loop: push moved block away from overlapping blocks
  for (let pass = 0; pass < 5; pass++) {
    let hadCollision = false;
    for (const other of allElements) {
      if (other.id === moved.id) continue;

      const mX = moved.obj.position.x;
      const mY = moved.obj.position.y;
      const mW = moved.width;
      const mH = moved.height;

      const oX = other.obj.position.x;
      const oY = other.obj.position.y;
      const oW = other.width;
      const oH = other.height;

      // Two elements collide ONLY IF their bounding boxes literally intersect
      const isIntersecting = (mX < oX + oW) && (mX + mW > oX) && (mY < oY + oH) && (mY + mH > oY);

      if (isIntersecting) {
        hadCollision = true;
        const pushRight = (oX + oW + 10) - mX;
        const pushLeft = (mX + mW + 10) - oX;
        const pushDown = (oY + oH + 10) - mY;
        const pushUp = (mY + mH + 10) - oY;

        if (moved.isEvent) {
          // Event cards resolve horizontally along their stage floor (no artificial left wall)
          if (pushRight <= pushLeft) {
            moved.obj.position.x += pushRight;
          } else {
            moved.obj.position.x -= pushLeft;
          }
        } else {
          // Dialogues resolve in the closest direction (can move vertically or horizontally)
          const candidates = [];
          candidates.push({ dx: pushRight, dy: 0, cost: pushRight });
          candidates.push({ dx: -pushLeft, dy: 0, cost: pushLeft });
          candidates.push({ dx: 0, dy: pushDown, cost: pushDown });
          candidates.push({ dx: 0, dy: -pushUp, cost: pushUp });

          candidates.sort((a, b) => a.cost - b.cost);
          moved.obj.position.x += candidates[0].dx;
          moved.obj.position.y += candidates[0].dy;
        }
      }
    }
    if (!hadCollision) break;
  }

  const movedDom = document.getElementById(moved.isEvent ? `node-${moved.id}` : `dialogue-${moved.id}`);
  if (movedDom) {
    movedDom.style.left = `${moved.obj.position.x}px`;
    movedDom.style.top = `${moved.obj.position.y}px`;
  }
}

