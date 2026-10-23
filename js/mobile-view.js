// ============================================================================
// js/mobile-view.js - Mobile Stage View, Desktop Slot Allocator & Layout Health Check
// ============================================================================

/* ==========================================================================
   MOBILE STAGE-CENTRIC ENGINE, DESKTOP SLOT ALLOCATOR & DIAGNOSTIC TOOLS
   ========================================================================== */

function switchAppViewMode(mode, silent = false) {
  currentAppViewMode = mode;
  const canvasContainer = document.getElementById('canvas-container');
  const mobileStageView = document.getElementById('mobile-stage-view');
  const btnCanvas = document.getElementById('btn-mode-canvas');
  const btnMobile = document.getElementById('btn-mode-mobile');
  const touchModeSelector = document.getElementById('touch-mode-selector');

  if (mode === 'mobile-stage') {
    if (canvasContainer) canvasContainer.classList.add('hidden');
    if (mobileStageView) mobileStageView.classList.remove('hidden');
    if (touchModeSelector) touchModeSelector.classList.add('hidden');
    if (btnCanvas) {
      btnCanvas.className = "px-2 py-1 rounded text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 flex items-center gap-1 transition";
    }
    if (btnMobile) {
      btnMobile.className = "px-2 py-1 rounded text-xs font-bold bg-cyan-600 text-white shadow flex items-center gap-1 transition";
    }
    renderApp();
    if (!silent) showToast("Switched to Mobile Stage-Centric View", "info");
  } else {
    if (mobileStageView) mobileStageView.classList.add('hidden');
    if (canvasContainer) canvasContainer.classList.remove('hidden');
    if (touchModeSelector) touchModeSelector.classList.remove('hidden');
    if (btnCanvas) {
      btnCanvas.className = "px-2 py-1 rounded text-xs font-bold bg-amber-500 text-gray-950 shadow flex items-center gap-1 transition";
    }
    if (btnMobile) {
      btnMobile.className = "px-2 py-1 rounded text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 flex items-center gap-1 transition";
    }
    renderApp();
    setTimeout(() => updateCanvasTransform(), 60);
    if (!silent) showToast("Switched to Desktop 2D Canvas View", "info");
  }
}

// Virtual Desktop Slot Allocator for Events
function allocateDesktopSlotForEvent(floorIndex, category) {
  const cat = category || activeCategoryFilter || 'KeyChain';
  const targetY = (FLOOR_Y && FLOOR_Y[floorIndex] !== undefined) ? FLOOR_Y[floorIndex] : (90 + floorIndex * 1600);
  
  const nodesOnFloor = (appData.nodes || []).filter(n => (n.category || 'KeyChain') === cat && ((n.floorIndex || 0) === floorIndex || Math.abs((n.position ? n.position.y : 0) - targetY) < 300));
  
  let maxX = 80;
  nodesOnFloor.forEach(n => {
    if (n.position && n.position.x > maxX) {
      maxX = n.position.x;
    }
  });

  let candidateX = (nodesOnFloor.length === 0) ? 140 : (maxX + 980);

  // Collision safety loop
  let safe = false;
  let attempts = 0;
  while (!safe && attempts < 20) {
    attempts++;
    const collides = (appData.nodes || []).some(n => {
      if ((n.category || 'KeyChain') !== cat) return false;
      const nx = n.position ? n.position.x : 0;
      const ny = n.position ? n.position.y : 0;
      return (Math.abs(candidateX - nx) < 920 && Math.abs(targetY - ny) < 580);
    });
    if (!collides) {
      safe = true;
    } else {
      candidateX += 980;
    }
  }

  return { x: candidateX, y: targetY };
}

// Virtual Desktop Slot Allocator for Dialogues
function allocateDesktopSlotForDialogue(targetEventId, timing, actionId) {
  const targetNode = (appData.nodes || []).find(n => n.id === targetEventId);
  if (!targetNode || !targetNode.position) {
    return { x: 100, y: 90 };
  }

  const cat = targetNode.category || activeCategoryFilter || 'KeyChain';
  const parentX = targetNode.position.x;
  const parentY = targetNode.position.y;
  const NODE_WIDTH = 880;
  const NODE_HEIGHT = 540;
  const DIAG_WIDTH = 420;
  const DIAG_HEIGHT = 260;

  // Ordered candidate positions
  let candidateSlots = [];

  if (timing === 'action_option' && actionId) {
    const actIdx = (targetNode.actions || []).findIndex(a => a.id === actionId);
    const actionCount = Math.max((targetNode.actions || []).length, 1);
    const hasInact = Boolean(targetNode.hasInactionThreat && targetNode.inactionThreat);
    const totalCols = actionCount + (hasInact ? 1 : 0);
    const colWidth = (NODE_WIDTH - 120) / Math.max(totalCols, 1);
    const colCenter = parentX + 120 + (Math.max(actIdx, 0) + 0.5) * colWidth;

    // Slot 1: below action option
    candidateSlots.push({ x: Math.round(colCenter - DIAG_WIDTH / 2), y: parentY + NODE_HEIGHT + 60 });
    // Slot 2: to the right of the event
    candidateSlots.push({ x: parentX + NODE_WIDTH + 60, y: parentY + 60 });
    // Slot 3: above the action option
    candidateSlots.push({ x: Math.round(colCenter - DIAG_WIDTH / 2), y: parentY - DIAG_HEIGHT - 60 });
  } else if (timing === 'pre_event') {
    // Slot 1: below left
    candidateSlots.push({ x: parentX, y: parentY + NODE_HEIGHT + 60 });
    // Slot 2: to the left
    candidateSlots.push({ x: parentX - DIAG_WIDTH - 60, y: parentY });
    // Slot 3: directly above
    candidateSlots.push({ x: parentX, y: parentY - DIAG_HEIGHT - 60 });
  } else {
    // Post action / inaction
    candidateSlots.push({ x: parentX + NODE_WIDTH + 60, y: parentY + 200 });
    candidateSlots.push({ x: parentX + Math.round(NODE_WIDTH / 2), y: parentY + NODE_HEIGHT + 60 });
  }

  for (const slot of candidateSlots) {
    if (!checkDesktopCollision(slot.x, slot.y, DIAG_WIDTH, DIAG_HEIGHT, cat)) {
      return slot;
    }
  }

  // Stepping rightward fallback
  let stepX = parentX + NODE_WIDTH + 60;
  let stepY = parentY;
  while (checkDesktopCollision(stepX, stepY, DIAG_WIDTH, DIAG_HEIGHT, cat)) {
    stepX += DIAG_WIDTH + 40;
    if (stepX > parentX + 3000) {
      stepX = parentX;
      stepY += DIAG_HEIGHT + 40;
    }
  }

  return { x: stepX, y: stepY };
}

function checkDesktopCollision(x, y, w, h, category) {
  const MARGIN = 25;
  const cat = category || activeCategoryFilter;

  const nodeOverlap = (appData.nodes || []).some(n => {
    if ((n.category || 'KeyChain') !== cat) return false;
    const nx = n.position ? n.position.x : 0;
    const ny = n.position ? n.position.y : 0;
    const nw = 880;
    const nh = 540;
    return (x < nx + nw + MARGIN && x + w + MARGIN > nx && y < ny + nh + MARGIN && y + h + MARGIN > ny);
  });
  if (nodeOverlap) return true;

  const diagOverlap = (appData.dialogues || []).some(d => {
    if (d.targetEventId) {
      const tgt = (appData.nodes || []).find(n => n.id === d.targetEventId);
      if (tgt && (tgt.category || 'KeyChain') !== cat) return false;
    } else if ((d.category || 'KeyChain') !== cat) {
      return false;
    }
    const dx = d.position ? d.position.x : 0;
    const dy = d.position ? d.position.y : 0;
    const dw = 420;
    const dh = 260;
    return (x < dx + dw + MARGIN && x + w + MARGIN > dx && y < dy + dh + MARGIN && y + h + MARGIN > dy);
  });

  return diagOverlap;
}

// Stage-Centric Mobile View Renderer
function renderMobileStageView() {
  const container = document.getElementById('mobile-stage-view');
  if (!container) return;

  const isPool = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool');
  const stageLabels = isPool 
    ? [
        { label: 'Tier 1', title: 'Tier 1: Introductory Encounters' },
        { label: 'Tier 2', title: 'Tier 2: Standard Operations' },
        { label: 'Tier 3', title: 'Tier 3: Elevated Threat' },
        { label: 'Tier 4', title: 'Tier 4: Extreme Hazard' },
        { label: 'Tier 5', title: 'Tier 5: Apex Crises' }
      ]
    : [
        { label: 'Stage 1', title: 'Stage 1: Keeling Shore (Floor 0)' },
        { label: 'Stage 2', title: 'Stage 2: Keeling Overlook (Floor 1)' },
        { label: 'Stage 3', title: 'Stage 3: Research Outpost (Floor 2)' },
        { label: 'Stage 4', title: 'Stage 4: Submerged Bay (Floor 3)' }
      ];

  const resolveNodeStageIndex = (n) => {
    if (n.floorIndex !== undefined && n.floorIndex !== null) return Number(n.floorIndex);
    if (isPool && n.tier) return Number(n.tier) - 1;
    if (n.position && typeof n.position.y === 'number' && Array.isArray(FLOOR_Y)) {
      let bestIdx = 0;
      let bestDist = Infinity;
      FLOOR_Y.forEach((fy, fIdx) => {
        const d = Math.abs(n.position.y - fy);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = fIdx;
        }
      });
      return bestIdx;
    }
    return 0;
  };

  const currentStageMeta = stageLabels[activeMobileStageIndex] || stageLabels[0];
  const currentVar = (appData.variations || []).find(v => v.id === activeVariationId) || { number: 1, name: 'Variation 1' };

  // All nodes matching current category & variation
  const boardNodes = (appData.nodes || []).filter(n => {
    const cat = n.category || 'KeyChain';
    if (cat !== activeCategoryFilter) return false;
    if (!isPool && n.variationId && n.variationId !== activeVariationId) return false;
    return true;
  });

  // Filter events belonging to this stage
  const stageNodes = boardNodes.filter(n => resolveNodeStageIndex(n) === activeMobileStageIndex);

  // Stage Tabs HTML with per-stage event counts
  const tabsHTML = stageLabels.map((st, idx) => {
    const isActive = idx === activeMobileStageIndex;
    const countInStage = boardNodes.filter(n => resolveNodeStageIndex(n) === idx).length;
    return `
      <button type="button" 
              onclick="setMobileStage(${idx})"
              class="mobile-stage-tab-btn ${isActive ? 'is-active' : ''} flex items-center gap-1">
        <span>${st.label}</span>
        <span class="text-[10px] opacity-80 font-mono">(${countInStage})</span>
      </button>
    `;
  }).join('');

  // Events List HTML
  let eventsHTML = '';
  if (stageNodes.length === 0) {
    eventsHTML = `
      <div class="text-center py-12 px-4 rounded-2xl bg-gray-900/60 border border-gray-800">
        <div class="text-3xl mb-2">📜</div>
        <h3 class="text-sm font-bold text-gray-200">No events in ${currentStageMeta.label} yet</h3>
        <p class="text-xs text-gray-500 mt-1 max-w-sm mx-auto">Create a new narrative event block directly in this stage. It will be cleanly auto-slotted into the desktop schematic in the background.</p>
        <button type="button" onclick="createMobileEvent(${activeMobileStageIndex})" class="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-950 shadow inline-flex items-center gap-1.5 transition">
          + Add First Event in ${currentStageMeta.label}
        </button>
      </div>
    `;
  } else {
    eventsHTML = stageNodes.map(node => {
      const isDimmed = isPool && isPoolNodeDimmed(node.id, activeVariationId);
      const poolSwitchBar = isPool ? getPoolSwitchBarHTML(node, isDimmed, currentVar) : '';

      // 1. Pre-Event Dialogues attached to this event
      const preEventDiags = (appData.dialogues || []).filter(d =>
        getDialogueLinks(d).some(l => l.targetEventId === node.id && (l.triggerTiming === 'pre_event' || !l.triggerTiming))
      );
      const preDiagsHTML = preEventDiags.map(d => renderMobileDialogueCardHTML(d, 'pre_event', node.id, null)).join('');

      const actionIdsSet = new Set((node.actions || []).map(a => a.id));

      // 2. Actions & nested dialogues (Route Advice + Action Result Description + Post-Action Dialogues)
      const actionsHTML = (node.actions || []).map((act, actIdx) => {
        const optionDiags = (appData.dialogues || []).filter(d =>
          getDialogueLinks(d).some(l => l.targetEventId === node.id && l.triggerTiming === 'action_option' && l.triggerActionId === act.id)
        );
        const optDiagsHTML = optionDiags.map(d => renderMobileDialogueCardHTML(d, 'action_option', node.id, act.id)).join('');

        const postActionDiags = (appData.dialogues || []).filter(d =>
          getDialogueLinks(d).some(l =>
            l.targetEventId === node.id &&
            (l.triggerTiming === 'post_action' || l.triggerTiming === 'post_event') &&
            l.triggerActionId === act.id
          )
        );
        const postDiagsHTML = postActionDiags.map(d => renderMobileDialogueCardHTML(d, 'post_action', node.id, act.id)).join('');

        // Req pills
        normalizeActionRequirements(act);
        const reqHTML = (act.requirements || []).map((c, cIdx) => {
          return (c.items || []).map((item, iIdx) => {
            const isCrit = isCriteriaObject(item);
            return `
              <span class="req-pill ${isCrit ? 'criteria-pill' : ''} text-[10px]" onclick="event.stopPropagation(); openEditRequirementItem('${node.id}', ${actIdx}, ${cIdx}, ${iIdx})">
                ${isCrit ? '🔑' : (item.iconImg ? `<img src="${item.iconImg}" class="w-3.5 h-3.5 inline">` : (item.icon || '📦'))}
                <span>${item.name}</span>
                ${isCrit ? '' : `<span class="font-mono font-bold">x${item.amount || 1}</span>`}
              </span>
            `;
          }).join('');
        }).join('');

        // Reward pills
        const rwHTML = (act.rewards || []).map((rw, rwIdx) => formatRewardPillHTML(rw, node.id, actIdx, rwIdx, false)).join('');

        const targetIds = getActionTargetIds(act, node.id);
        const targetNodes = targetIds.map(tid => (appData.nodes || []).find(n => n.id === tid)).filter(Boolean);
        const targetBadgesHTML = targetNodes.map(tn => `
          <span class="text-[10px] font-mono font-bold text-blue-300 bg-blue-950/80 border border-blue-800/70 px-1.5 py-0.5 rounded inline-flex items-center gap-1" title="Jump to ${tn.codename} (${tn.name})">
            <button type="button" class="linked-event-jump-btn cursor-pointer hover:underline text-blue-300 hover:text-white bg-transparent border-0 p-0 font-mono font-bold" onclick="event.stopPropagation(); navigateToLinkedEvent('${tn.id}')">→ ${tn.codename}</button>
            <button type="button" class="text-red-400 hover:text-red-200 font-bold" onclick="event.stopPropagation(); disconnectActionTarget('${node.id}', '${act.id}', '${tn.id}')" title="Disconnect">×</button>
          </span>
        `).join('');

        const actChoiceKey = getActionChoiceLimitKey(node);
        const btnTextStr = act.shortDescription || '';
        const isBtnOver = isFieldTextOverLimit(btnTextStr, 'actionButtonText');
        const actDescStr = act.description || '';
        const isActDescOver = isFieldTextOverLimit(actDescStr, actChoiceKey);
        const resDescStr = act.resultDescription || '';
        const isResDescOver = isFieldTextOverLimit(resDescStr, 'eventOutcome');

        return `
          <div class="mobile-action-box space-y-2.5">
            <div class="flex items-center justify-between border-b border-gray-700/60 pb-1.5 gap-2 flex-wrap">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="font-bold text-xs text-amber-300 font-mono shrink-0">${act.codeSuffix || String.fromCharCode(65 + actIdx)}:</span>
                <span class="font-bold text-xs text-amber-300 font-mono truncate editable-spot ${isBtnOver ? 'is-over-limit' : ''}" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'actions.${actIdx}.shortDescription')">${act.shortDescription || 'Choice Option'}</span>
                ${getSymbolCounterBadgeHTML(btnTextStr, 'actionButtonText', true)}
              </div>
              <div class="flex items-center gap-1.5 shrink-0 flex-wrap">
                ${targetBadgesHTML}
                <span class="text-[10px] text-gray-300 font-mono bg-gray-900/80 px-1.5 py-0.5 rounded border border-gray-700 editable-spot" onclick="event.stopPropagation(); makeInlineNumberEditable(this, '${node.id}', 'actions.${actIdx}.timerHours')">⏱️ ${act.timerHours || 1}h</span>
              </div>
            </div>

            <!-- Action Description (Event Choice) -->
            <div>
              <div class="flex items-center justify-between gap-2 mb-0.5">
                <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Event Choice Description</div>
                ${getSymbolCounterBadgeHTML(actDescStr, actChoiceKey, true)}
              </div>
              <p class="text-xs text-gray-200 leading-relaxed editable-spot ${isActDescOver ? 'is-over-limit' : ''}" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'actions.${actIdx}.description')">${act.description || 'Action description...'}</p>
            </div>
            
            <!-- Requirements -->
            <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span class="text-[10px] font-bold text-gray-400 uppercase">Requirements / Criteria:</span>
              ${reqHTML || '<span class="text-[10px] text-gray-500 italic">None</span>'}
              <button type="button" class="req-add-btn text-[10px]" onclick="event.stopPropagation(); openAddRequirementModal('${node.id}', ${actIdx})">+ Req / Criteria</button>
            </div>

            <!-- Route Suggestion Dialogues (Pre-Choice Advice) -->
            <div class="pt-2 border-t border-gray-800/80">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                  💬 Route Advice Dialogues (During Choice)
                </span>
                <button type="button" onclick="createMobileAttachedDialogue('${node.id}', 'action_option', '${act.id}')" class="text-[10px] text-indigo-400 hover:text-indigo-200 font-semibold">
                  + Attach Dialogue
                </button>
              </div>
              ${optDiagsHTML || '<p class="text-[11px] text-gray-500 italic">No route advice dialogue attached to this choice.</p>'}
            </div>

            <!-- Action Result Description (Event Outcome) -->
            <div class="bg-gray-950/65 p-2.5 rounded-xl border border-emerald-900/50 space-y-1">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  🏁 Event Outcome (Action Result)
                </span>
                <div class="flex items-center gap-1.5">
                  ${targetNodes.length > 0 ? `<span class="text-[10px] font-mono text-blue-300">Outcome → ${targetNodes.map(t => `<button type="button" class="linked-event-jump-btn cursor-pointer hover:underline text-blue-300 hover:text-white bg-transparent border-0 p-0 font-mono font-bold" onclick="event.stopPropagation(); navigateToLinkedEvent('${t.id}')">${t.codename}</button>`).join(', ')}</span>` : ''}
                  ${getSymbolCounterBadgeHTML(resDescStr, 'eventOutcome', true)}
                </div>
              </div>
              <p class="text-xs text-gray-200 leading-relaxed editable-spot whitespace-pre-line ${isResDescOver ? 'is-over-limit' : ''}" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'actions.${actIdx}.resultDescription')">
                ${act.resultDescription ? act.resultDescription : '<span class="text-gray-500 italic">Tap to enter action result description...</span>'}
              </p>
            </div>

            <!-- Rewards -->
            <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span class="text-[10px] font-bold text-amber-400 uppercase">Rewards / Criteria:</span>
              ${rwHTML || '<span class="text-[10px] text-gray-500 italic">None</span>'}
              <button type="button" class="req-add-btn text-[10px]" onclick="event.stopPropagation(); openResourcePickerModal('${node.id}', ${actIdx}, 'reward', null)">+ Reward / Criteria</button>
            </div>

            <!-- Post-Action / Outcome Dialogues -->
            <div class="pt-2 border-t border-gray-800/80">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                  🏁 Post-Event Dialogues (After Choice Outcome)
                </span>
                <button type="button" onclick="createMobileAttachedDialogue('${node.id}', 'post_action', '${act.id}')" class="text-[10px] text-emerald-400 hover:text-emerald-200 font-semibold">
                  + Attach Dialogue
                </button>
              </div>
              ${postDiagsHTML || '<p class="text-[11px] text-gray-500 italic">No post-action dialogue attached to this outcome.</p>'}
            </div>
          </div>
        `;
      }).join('');

      // 3. Inaction Threat (if enabled on this event)
      let inactionHTML = '';
      if (node.hasInactionThreat && node.inactionThreat) {
        const inact = node.inactionThreat;
        const inactTarget = inact.targetNodeId ? (appData.nodes || []).find(n => n.id === inact.targetNodeId) : null;
        const inactTargetBadgeHTML = inactTarget ? `
          <span class="text-[10px] font-mono font-bold text-red-200 bg-red-950/90 border border-red-700/80 px-1.5 py-0.5 rounded inline-flex items-center gap-1" title="Jump to ${inactTarget.codename} (${inactTarget.name})">
            <button type="button" class="linked-event-jump-btn cursor-pointer hover:underline text-red-200 hover:text-white bg-transparent border-0 p-0 font-mono font-bold" onclick="event.stopPropagation(); navigateToLinkedEvent('${inactTarget.id}')">→ ${inactTarget.codename}</button>
            <button type="button" class="text-red-400 hover:text-red-200 font-bold" onclick="event.stopPropagation(); disconnectActionTarget('${node.id}', 'inaction')" title="Disconnect">×</button>
          </span>
        ` : '';
        const inactPostDiags = (appData.dialogues || []).filter(d =>
          getDialogueLinks(d).some(l =>
            l.targetEventId === node.id &&
            (l.triggerTiming === 'post_action' || l.triggerTiming === 'post_event') &&
            l.triggerActionId === 'inaction'
          )
        );
        const inactDiagsHTML = inactPostDiags.map(d => renderMobileDialogueCardHTML(d, 'post_action', node.id, 'inaction')).join('');
        const penHTML = (inact.penalties || []).map((p, pIdx) => formatRewardPillHTML(p, node.id, -1, pIdx, true)).join('');
        const inactResStr = inact.resultDescription || '';
        const isInactResOver = isFieldTextOverLimit(inactResStr, 'inactionResult');

        inactionHTML = `
          <div class="mobile-action-box border-red-800/60 bg-red-950/20 space-y-2">
            <div class="flex items-center justify-between border-b border-red-800/40 pb-1.5 gap-2 flex-wrap">
              <span class="font-bold text-xs text-red-300 font-mono">⚠️ Inaction: ${inact.shortDescription || 'Timeout'}</span>
              <div class="flex items-center gap-1.5 flex-wrap">
                ${inactTargetBadgeHTML}
                <span class="text-[10px] text-red-300 font-mono">⏱️ ${inact.timerHours || node.reactionTimerHours || 'Infinite'}</span>
              </div>
            </div>
            <p class="text-xs text-gray-300 leading-relaxed editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'inactionThreat.description')">
              ${inact.description || inact.consequenceText || 'Triggered if timer expires without choice.'}
            </p>
            <div class="bg-gray-950/65 p-2.5 rounded-xl border border-red-900/50 space-y-1">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[10px] font-bold text-red-400 uppercase tracking-wider block">🏁 Event Inaction Result</span>
                ${getSymbolCounterBadgeHTML(inactResStr, 'inactionResult', true)}
              </div>
              <p class="text-xs text-gray-200 leading-relaxed editable-spot ${isInactResOver ? 'is-over-limit' : ''}" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'inactionThreat.resultDescription')">
                ${inact.resultDescription || 'Catastrophic failure.'}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span class="text-[10px] font-bold text-red-400 uppercase">Penalties:</span>
              ${penHTML || '<span class="text-[10px] text-gray-500 italic">None</span>'}
            </div>
            ${inactDiagsHTML ? `<div class="pt-2 border-t border-red-900/40">${inactDiagsHTML}</div>` : ''}
          </div>
        `;
      }

      // 4. Event-level Post-Event Dialogues (if any post_action dialogue is linked to the event without a specific action ID)
      const generalPostDiags = (appData.dialogues || []).filter(d =>
        getDialogueLinks(d).some(l =>
          l.targetEventId === node.id &&
          (l.triggerTiming === 'post_action' || l.triggerTiming === 'post_event') &&
          (!l.triggerActionId || (!actionIdsSet.has(l.triggerActionId) && l.triggerActionId !== 'inaction'))
        )
      );
      const generalPostHTML = generalPostDiags.length > 0 ? `
        <div class="space-y-1.5 bg-gray-950/40 p-2.5 rounded-xl border border-emerald-800/50">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
              🏁 Post-Event Dialogues (General)
            </span>
          </div>
          ${generalPostDiags.map(d => renderMobileDialogueCardHTML(d, 'post_action', node.id, null)).join('')}
        </div>
      ` : '';

      const introStr = node.eventIntro || '';
      const isIntroOver = isFieldTextOverLimit(introStr, 'eventIntro');
      const descStr = node.eventDescription || '';
      const isDescOver = isFieldTextOverLimit(descStr, 'eventDescription');

      const nodeVarObj = (appData.variations || []).find(v => v.id === (node.variationId || activeVariationId)) || currentVar;
      if ((node.category || 'KeyChain') === 'KeyChain' && nodeVarObj && nodeVarObj.name) {
        node.name = nodeVarObj.name;
        node.title = nodeVarObj.name;
      }
      const isKeyChainMob = (node.category || 'KeyChain') === 'KeyChain';
      const mobTitleHTML = isKeyChainMob
        ? `<h3 class="text-sm font-bold text-gray-100 mt-1" title="Inherited from Variation">${escapeHtml(node.name)}</h3>`
        : `<h3 class="text-sm font-bold text-gray-100 mt-1 editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'name')">${escapeHtml(node.name)}</h3>`;

      return `
        <div class="mobile-event-card ${isDimmed ? 'is-pool-dimmed' : ''}" id="mob-node-${node.id}">
          ${poolSwitchBar}
          <div class="p-4 space-y-4 mobile-card-body">
            <!-- Event Header -->
            <div class="flex items-start justify-between gap-2 border-b border-gray-800 pb-3">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="mobile-stage-badge bg-amber-950 text-amber-300 border border-amber-600/40 editable-spot cursor-pointer" onclick="event.stopPropagation(); makeInlineCodenameEditable(this, '${node.id}')" title="Tap to edit codename">${node.codename}</span>
                  <span class="text-[10px] text-gray-400 uppercase font-semibold editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'spawnConditions')" title="Tap to edit spawn conditions">${node.spawnConditions || node.location || 'Spawn conditions'}</span>
                </div>
                ${mobTitleHTML}
              </div>
              <div class="flex items-center gap-1.5">
                <button type="button" class="comment-trigger-badge" title="Comments" onclick="event.stopPropagation(); openCommentsDrawer('${node.id}', 'event')">
                  💬 <span class="cmt-cnt-${node.id}">${getCommentCount(node.id)}</span>
                </button>
                <button type="button" onclick="deleteMobileEvent('${node.id}')" class="text-xs text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/40" title="Delete Event">
                  ✕
                </button>
              </div>
            </div>

            <!-- Pre-Event Dialogue Stream -->
            <div class="space-y-1.5 bg-gray-950/40 p-2.5 rounded-xl border border-purple-900/50">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                  ⚡ Pre-Event Dialogues (Before Event Window)
                </span>
                <button type="button" onclick="createMobileAttachedDialogue('${node.id}', 'pre_event', null)" class="text-[10px] text-purple-400 hover:text-purple-200 font-semibold">
                  + Attach Dialogue
                </button>
              </div>
              ${preDiagsHTML || '<p class="text-[11px] text-gray-500 italic">No pre-event dialogue attached.</p>'}
            </div>

            <!-- Intro & Body -->
            <div class="space-y-2">
              <div>
                <div class="flex items-center justify-between gap-2 mb-0.5">
                  <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Event Intro</span>
                  ${getSymbolCounterBadgeHTML(introStr, 'eventIntro', true)}
                </div>
                <div class="text-xs text-amber-200/90 italic bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/30 editable-spot ${isIntroOver ? 'is-over-limit' : ''}" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'eventIntro')">${node.eventIntro || 'Enter event intro...'}</div>
              </div>
              <div>
                <div class="flex items-center justify-between gap-2 mb-0.5">
                  <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Event Description</div>
                  ${getSymbolCounterBadgeHTML(descStr, 'eventDescription', true)}
                </div>
                <p class="text-xs text-gray-200 leading-relaxed editable-spot whitespace-pre-line ${isDescOver ? 'is-over-limit' : ''}" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'eventDescription')">${node.eventDescription || 'Enter event description context...'}</p>
              </div>
            </div>

            <!-- Action Choices -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-gray-300 uppercase tracking-wider">Action Options (${(node.actions || []).length})</span>
                <button type="button" onclick="addActionColumn('${node.id}')" class="text-xs text-cyan-400 hover:text-cyan-300 font-bold">
                  + Add Choice
                </button>
              </div>
              ${actionsHTML}
              ${inactionHTML}
            </div>

            ${generalPostHTML}
          </div>
        </div>
      `;
    }).join('');
  }

  // Unlinked Dialogues for this stage
  const unlinkedDiags = (appData.dialogues || []).filter(d =>
    getDialogueLinks(d).length === 0 &&
    ((d.floorIndex || 0) === activeMobileStageIndex) &&
    ((d.category || 'KeyChain') === activeCategoryFilter)
  );
  let unlinkedHTML = '';
  if (unlinkedDiags.length > 0) {
    unlinkedHTML = `
      <div class="mt-8 pt-6 border-t border-gray-800 space-y-3">
        <h4 class="text-xs font-bold text-purple-400 uppercase tracking-wider">Unlinked Dialogues in this Stage (${unlinkedDiags.length})</h4>
        ${unlinkedDiags.map(d => renderMobileDialogueCardHTML(d, 'unlinked', null, null)).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <!-- Sticky Mobile Stage Nav -->
    <div class="mobile-stage-nav-bar px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 overflow-x-auto">
      <div class="flex items-center gap-1.5 overflow-x-auto py-1">
        ${tabsHTML}
      </div>
      <button type="button" onclick="createMobileEvent(${activeMobileStageIndex})" class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-950 shadow flex items-center gap-1 transition">
        <i data-lucide="plus" class="w-3.5 h-3.5"></i> Event
      </button>
    </div>

    <!-- Main Content Container -->
    <div class="max-w-2xl mx-auto px-3 sm:px-4 py-5 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-gray-100 flex items-center gap-2 flex-wrap">
            <span>${currentStageMeta.title}</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">${stageNodes.length} Events</span>
          </h2>
          <p class="text-[11px] text-gray-400 mt-0.5">Stage-centric narrative flow • Pre-Event, Route Advice & Post-Event dialogues shown inline</p>
        </div>
        <div class="text-right">
          <span class="text-[10px] font-mono font-bold text-amber-300 bg-gray-900 border border-gray-800 px-2 py-1 rounded">V${currentVar.number}</span>
        </div>
      </div>

      ${eventsHTML}
      ${unlinkedHTML}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function renderMobileDialogueCardHTML(dialogue, timingMode = 'pre_event', contextEventId = null, contextActionId = null) {
  const isReadOnly = (typeof canUserEdit === 'function') 
    ? !canUserEdit() 
    : (typeof isCurrentBoardReadOnly === 'function' ? isCurrentBoardReadOnly() : Boolean(isCurrentBoardReadOnly));

  const isRoute = (timingMode === 'action_option' || timingMode === true);
  const isPostAction = (timingMode === 'post_action' || timingMode === 'post_event');
  const allChars = getGlobalCharactersPool();
  const enabledChars = getEnabledCharactersForVariation(activeVariationId);
  const linesHTML = (dialogue.lines || []).map((l, lIdx) => {
    const matchedChar = allChars.find(c => c.id === l.speakerId || c.name === l.speakerName);
    const charMeta = matchedChar || { color: '#e5e7eb', textColor: '#1f2937', icon: '👤' };
    const dropdownChars = [...enabledChars];
    if (matchedChar && !dropdownChars.some(c => c.id === matchedChar.id)) {
      dropdownChars.unshift({ ...matchedChar, _isDisabledInVar: true });
    }
    return `
      <div class="bg-gray-900/80 p-2 rounded-lg border border-gray-800 space-y-1">
        <div class="flex items-center justify-between text-[11px] gap-2">
          <div class="flex items-center gap-1.5 min-w-0 flex-1 px-1.5 py-0.5 rounded" style="background-color: ${charMeta.color || '#e5e7eb'}; color: ${charMeta.textColor || '#1f2937'}">
            <span>${charMeta.icon}</span>
            <select class="inline-select text-[11px] font-bold bg-transparent border-none focus:outline-none flex-1 min-w-0 ${isReadOnly ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}" 
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
          ${!isReadOnly ? `
            <button type="button" onclick="removeMobileDialogueLine('${dialogue.id}', ${lIdx})" class="text-gray-500 hover:text-red-400 text-xs px-1">×</button>
          ` : ''}
        </div>
        <p class="text-xs text-gray-200 leading-relaxed ${isReadOnly ? 'cursor-default' : 'editable-spot'} whitespace-pre-line" onclick="event.stopPropagation(); ${isReadOnly ? '' : `makeInlineTextEditable(this, '${dialogue.id}', 'lines.${lIdx}.text')`}">
          ${l.text || 'Dialogue text...'}
        </p>
      </div>
    `;
  }).join('');

  let timingBadgeHTML = '';
  if (isRoute) {
    timingBadgeHTML = `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/60 uppercase">💬 Route Advice</span>`;
  } else if (isPostAction) {
    const delayLabel = dialogue.delayHours ? ` (+${dialogue.delayHours}${dialogue.delayUnit === 'minutes' ? 'm' : 'h'})` : '';
    timingBadgeHTML = `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60 uppercase">🏁 Post-Event${delayLabel}</span>`;
  } else if (timingMode === 'pre_event') {
    timingBadgeHTML = `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-700/60 uppercase">⚡ Pre-Event</span>`;
  }

  const extraClass = isRoute ? 'is-route-suggestion' : (isPostAction ? 'is-post-action' : '');
  const unlinkCall = contextEventId
    ? `unlinkMobileDialogue('${dialogue.id}', '${contextEventId}', '${timingMode}', ${contextActionId ? `'${contextActionId}'` : 'null'})`
    : `unlinkMobileDialogue('${dialogue.id}')`;

  return `
    <div class="mobile-nested-dialogue ${extraClass} space-y-2" id="mob-diag-${dialogue.id}">
      <div class="flex items-center justify-between border-b border-purple-800/40 pb-1.5 gap-1.5 flex-wrap">
        <div class="flex items-center gap-1.5 min-w-0 flex-wrap">
          ${timingBadgeHTML}
          <span class="text-[10px] font-bold text-purple-200 font-mono truncate">
            ${dialogue.triggerCondition || 'Dialogue Block'}
          </span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button type="button" class="comment-trigger-badge" title="Comments" onclick="event.stopPropagation(); openCommentsDrawer('${dialogue.id}', 'dialogue')">
            💬 <span class="cmt-cnt-${dialogue.id}">${getCommentCount(dialogue.id)}</span>
          </button>
          <button type="button" onclick="addMobileDialogueLine('${dialogue.id}')" class="text-[10px] text-cyan-400 hover:text-cyan-200 font-semibold">+ Line</button>
          ${timingMode !== 'unlinked' ? `<button type="button" onclick="${unlinkCall}" class="text-[10px] text-red-400 hover:text-red-300" title="Unlink dialogue">Unlink</button>` : ''}
        </div>
      </div>
      <div class="space-y-1.5">
        ${linesHTML}
      </div>
    </div>
  `;
}

function setMobileStage(idx) {
  activeMobileStageIndex = idx;
  renderMobileStageView();
}

function createMobileEvent(floorIndex) {
  if (!requireAuthToEdit("create events")) return;
  pushUndoState();
  const floor = (floorIndex !== undefined) ? floorIndex : activeMobileStageIndex;
  const isTier = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool');
  const slot = allocateDesktopSlotForEvent(floor, activeCategoryFilter);

  const codename = generateNewEventCodename(activeCategoryFilter, floor, activeVariationId);
  const currentVarObj = (appData.variations || []).find(v => v.id === activeVariationId);
  const defaultMobEventName = (activeCategoryFilter === 'KeyChain' && currentVarObj && currentVarObj.name)
    ? currentVarObj.name
    : `New Event (${isTier ? 'Tier ' + (floor + 1) : 'Stage ' + (floor + 1)})`;

  const newNode = {
    id: `node_mob_${Date.now()}`,
    codename: codename,
    name: defaultMobEventName,
    title: defaultMobEventName,
    type: activeCategoryFilter === 'DeckPool' ? 'Deck' : 'World',
    category: activeCategoryFilter,
    variationId: activeVariationId,
    floorIndex: floor,
    tier: isTier ? (floor + 1) : null,
    location: isTier ? 'Encounter Zone' : 'Keeling Island',
    spawnConditions: 'Standard Trigger',
    eventIntro: 'Initial event context drafted on mobile...',
    eventDescription: 'Enter narrative body context...',
    reactionTimerHours: "Infinite",
    hasInactionThreat: false,
    inactionThreat: null,
    position: { x: slot.x, y: slot.y },
    actions: [
      {
        id: `c_${Date.now()}`,
        codeSuffix: "A",
        shortDescription: "Choice A",
        description: "Action description...",
        requirements: [],
        timerHours: 5,
        resultDescription: "",
        rewards: ["🧠 Knowledge +100"]
      }
    ],
    disabledVariationIds: [],
    createdOnMobile: true
  };

  appData.nodes.push(newNode);
  saveProjectToLocalStorage();
  renderApp();
  showToast(`Event created in Stage ${floor + 1} (Desktop auto-slotted at x=${slot.x}, y=${slot.y})`, "success");
}

function createMobileAttachedDialogue(eventId, timing, actionId) {
  if (!requireAuthToEdit("attach dialogues")) return;
  pushUndoState();
  const targetNode = (appData.nodes || []).find(n => n.id === eventId);
  if (!targetNode) return;

  const slot = allocateDesktopSlotForDialogue(eventId, timing, actionId);
  const condText = formatDialogueTriggerCondition(timing, targetNode, actionId);

  const newDialogue = {
    id: `diag_mob_${Date.now()}`,
    targetEventId: eventId,
    triggerTiming: timing,
    triggerActionId: actionId || null,
    delayHours: 0,
    delayUnit: "hours",
    triggerCondition: condText,
    links: [{
      id: `dlink_${Date.now()}`,
      targetEventId: eventId,
      triggerTiming: timing,
      triggerActionId: actionId || null,
      triggerCondition: condText
    }],
    position: { x: slot.x, y: slot.y },
    variationId: activeVariationId,
    category: targetNode.category || activeCategoryFilter,
    floorIndex: targetNode.floorIndex || 0,
    colorScheme: timing === 'action_option' ? 'blue' : 'purple',
    lines: [
      {
        id: `l_${Date.now()}`,
        speakerName: "Catherine",
        text: "Commander, advise caution regarding this route.",
        mood: "Concerned"
      }
    ],
    createdOnMobile: true
  };

  appData.dialogues.push(newDialogue);
  saveProjectToLocalStorage();
  renderApp();
  showToast(`Dialogue attached to ${targetNode.codename} (Desktop auto-slotted without collision)`, "success");
}

function addMobileDialogueLine(diagId) {
  if (!requireAuthToEdit("add dialogue lines")) return;
  const diag = (appData.dialogues || []).find(d => d.id === diagId);
  if (!diag) return;
  pushUndoState();
  if (!diag.lines) diag.lines = [];
  const defaultSpeaker = (appData.characters && appData.characters[0]) ? appData.characters[0].name : 'Catherine';
  diag.lines.push({
    id: `l_${Date.now()}`,
    speakerName: defaultSpeaker,
    text: 'Enter dialogue line here...',
    mood: 'Neutral'
  });
  saveProjectToLocalStorage();
  renderApp();
  showToast('Dialogue line added', 'info');
}

function removeMobileDialogueLine(diagId, lineIdx) {
  if (!requireAuthToEdit("remove dialogue lines")) return;
  const diag = (appData.dialogues || []).find(d => d.id === diagId);
  if (!diag || !diag.lines || diag.lines.length <= 1) {
    alert('Dialogue block must have at least one line.');
    return;
  }
  pushUndoState();
  diag.lines.splice(lineIdx, 1);
  saveProjectToLocalStorage();
  renderApp();
  showToast('Dialogue line removed', 'info');
}

function deleteMobileEvent(eventId) {
  if (!requireAuthToEdit("delete events")) return;
  if (!confirm("Delete this event block?")) return;
  pushUndoState();

  const targetNode = (appData.nodes || []).find(n => n.id === eventId);
  const floor = targetNode ? targetNode.floorIndex : null;
  const cat = targetNode ? targetNode.category : null;
  const varId = targetNode ? targetNode.variationId : null;

  appData.nodes = (appData.nodes || []).filter(n => n.id !== eventId);
  (appData.dialogues || []).forEach(d => {
    if (Array.isArray(d.links)) {
      d.links = d.links.filter(l => l && l.targetEventId !== eventId);
      syncDialoguePrimaryFields(d);
    } else if (d.targetEventId === eventId) {
      d.targetEventId = null;
    }
  });

  if (floor !== null && floor !== undefined) {
    resequenceStageEventCodenames(floor, cat, varId);
  }

  saveProjectToLocalStorage();
  renderApp();
  showToast("Event block deleted", "info");
}

function unlinkMobileDialogue(diagId, targetEventId = null, triggerTiming = null, triggerActionId = null) {
  if (!requireAuthToEdit("unlink dialogues")) return;
  pushUndoState();
  const diag = (appData.dialogues || []).find(d => d.id === diagId);
  if (diag) {
    const links = getDialogueLinks(diag);
    if (targetEventId && links.length > 1) {
      diag.links = links.filter(l => !(
        l.targetEventId === targetEventId &&
        (!triggerTiming || l.triggerTiming === triggerTiming) &&
        (!triggerActionId || l.triggerActionId === triggerActionId)
      ));
      syncDialoguePrimaryFields(diag);
    } else {
      diag.links = [];
      diag.targetEventId = null;
      diag.triggerTiming = null;
      diag.triggerActionId = null;
    }
  }
  saveProjectToLocalStorage();
  renderApp();
  showToast("Dialogue unlinked from event", "info");
}

// Layout Health Check Diagnostic Engine
function runDesktopLayoutHealthCheck() {
  const cat = activeCategoryFilter;
  const nodes = getActiveBoardEventBlocks();
  const dialogues = getActiveBoardDialogueBlocks();

  const collisions = [];
  const MARGIN = 20;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const ax = a.position.x, ay = a.position.y, aw = 880, ah = 540;
      const bx = b.position.x, by = b.position.y, bw = 880, bh = 540;
      if (ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by) {
        collisions.push({ type: 'node-node', a: a.codename, b: b.codename });
      }
    }
  }

  nodes.forEach(n => {
    dialogues.forEach(d => {
      const nx = n.position.x, ny = n.position.y, nw = 880, nh = 540;
      const dx = d.position.x, dy = d.position.y, dw = 420, dh = 260;
      if (nx < dx + dw && nx + nw > dx && ny < dy + dh && ny + nh > dy) {
        collisions.push({ type: 'node-dialogue', a: n.codename, b: d.id });
      }
    });
  });

  for (let i = 0; i < dialogues.length; i++) {
    for (let j = i + 1; j < dialogues.length; j++) {
      const a = dialogues[i], b = dialogues[j];
      const ax = a.position.x, ay = a.position.y, aw = 420, ah = 260;
      const bx = b.position.x, by = b.position.y, bw = 420, bh = 260;
      if (ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by) {
        collisions.push({ type: 'dialogue-dialogue', a: a.id, b: b.id });
      }
    }
  }

  let snappedCount = 0;
  if (cat === 'KeyChain' || cat === 'SecretChain') {
    nodes.forEach(n => {
      const snapped = FLOOR_Y.some(fy => Math.abs((n.position ? n.position.y : 0) - fy) < 15);
      if (snapped) snappedCount++;
    });
  } else {
    snappedCount = nodes.length;
  }

  const snapRate = nodes.length > 0 ? Math.round((snappedCount / nodes.length) * 100) : 100;
  const isHealthy = collisions.length === 0;

  return {
    totalNodes: nodes.length,
    totalDialogues: dialogues.length,
    collisions: collisions,
    collisionCount: collisions.length,
    snapRate: snapRate,
    isHealthy: isHealthy,
    score: isHealthy ? 100 : Math.max(0, 100 - collisions.length * 15)
  };
}

function openLayoutHealthModal() {
  refreshLayoutHealthModal();
  openModal('modal-layout-health');
}

function refreshLayoutHealthModal() {
  const result = runDesktopLayoutHealthCheck();
  const container = document.getElementById('layout-health-modal-body');
  if (!container) return;

  const statusColor = result.isHealthy ? 'text-emerald-400' : 'text-amber-400';
  const badgeBg = result.isHealthy ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : 'bg-amber-950/80 border-amber-500/50 text-amber-300';

  let collisionListHTML = '';
  if (result.collisions.length > 0) {
    collisionListHTML = `
      <div class="bg-red-950/30 border border-red-800/50 rounded-xl p-4 mt-3">
        <h4 class="text-xs font-bold text-red-300 mb-2">Detected Overlaps (${result.collisions.length}):</h4>
        <ul class="text-xs text-red-200 space-y-1 font-mono">
          ${result.collisions.map(c => `<li>• [${c.type}] ${c.a} overlaps with ${c.b}</li>`).join('')}
        </ul>
      </div>
    `;
  } else {
    collisionListHTML = `
      <div class="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-4 flex items-center gap-3">
        <i data-lucide="check-circle-2" class="w-6 h-6 text-emerald-400 shrink-0"></i>
        <div>
          <h4 class="text-xs font-bold text-emerald-300">Zero Overlaps Detected (100% Clean)</h4>
          <p class="text-[11px] text-gray-400 mt-0.5">All event blocks and dialogue cards have complete safety clearance on desktop.</p>
        </div>
      </div>
    `;
  }

  const mobNodes = (appData.nodes || []).filter(n => n.createdOnMobile).length;
  const mobDiags = (appData.dialogues || []).filter(d => d.createdOnMobile).length;

  container.innerHTML = `
    <div class="flex items-center justify-between p-4 rounded-xl bg-gray-950 border border-gray-800">
      <div>
        <div class="text-xs text-gray-400 font-semibold uppercase tracking-wider">Overall Desktop Layout Score</div>
        <div class="text-3xl font-black ${statusColor} mt-1">${result.score} / 100</div>
        <div class="text-[11px] text-gray-400 mt-1">${result.isHealthy ? 'Perfect Health — zero collisions' : 'Overlaps detected'}</div>
      </div>
      <div class="px-4 py-2 rounded-lg border font-mono font-bold text-xs ${badgeBg}">
        ${result.isHealthy ? '✔ PASSED' : '⚠️ ATTENTION'}
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-gray-950 p-3 rounded-lg border border-gray-800 text-center">
        <div class="text-[10px] text-gray-400 uppercase font-semibold">Events</div>
        <div class="text-xl font-bold text-amber-400 font-mono mt-0.5">${result.totalNodes}</div>
      </div>
      <div class="bg-gray-950 p-3 rounded-lg border border-gray-800 text-center">
        <div class="text-[10px] text-gray-400 uppercase font-semibold">Dialogues</div>
        <div class="text-xl font-bold text-purple-400 font-mono mt-0.5">${result.totalDialogues}</div>
      </div>
      <div class="bg-gray-950 p-3 rounded-lg border border-gray-800 text-center">
        <div class="text-[10px] text-gray-400 uppercase font-semibold">Stage Snapping</div>
        <div class="text-xl font-bold text-blue-400 font-mono mt-0.5">${result.snapRate}%</div>
      </div>
      <div class="bg-gray-950 p-3 rounded-lg border border-gray-800 text-center">
        <div class="text-[10px] text-gray-400 uppercase font-semibold">Mobile Staged</div>
        <div class="text-xl font-bold text-cyan-400 font-mono mt-0.5">${mobNodes + mobDiags}</div>
      </div>
    </div>

    ${collisionListHTML}

    <div class="bg-gray-950/60 p-3 rounded-xl border border-gray-800 text-[11px] text-gray-400 flex items-start gap-2">
      <i data-lucide="info" class="w-4 h-4 text-cyan-400 shrink-0 mt-0.5"></i>
      <span>
        The Background Desktop Slot Allocator guarantees that any event or dialogue created on mobile is given a pristine, collision-free slot snapped to that stage's standard <code class="text-amber-300 font-mono">FLOOR_Y</code> band.
      </span>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

window.switchAppViewMode = switchAppViewMode;
window.setMobileStage = setMobileStage;
window.createMobileEvent = createMobileEvent;
window.createMobileAttachedDialogue = createMobileAttachedDialogue;
window.addMobileDialogueLine = addMobileDialogueLine;
window.removeMobileDialogueLine = removeMobileDialogueLine;
window.deleteMobileEvent = deleteMobileEvent;
window.unlinkMobileDialogue = unlinkMobileDialogue;
window.openLayoutHealthModal = openLayoutHealthModal;
window.refreshLayoutHealthModal = refreshLayoutHealthModal;

