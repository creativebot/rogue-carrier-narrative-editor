// ============================================================================
// js/modals.js - Resource/Criteria Picker, Characters, Timelines/Variations, OCR & Stats
// ============================================================================

// Visual Resource Context Picker Modal Handlers & Intangible Amounts (REQUIREMENT 3 FIX)
function setupPickerEvents() {
  const input = document.getElementById('picker-search-input');
  if (input) {
    input.oninput = (e) => filterPickerResources(e.target.value);
  }
}

let pendingReqContext = { nodeId: null, actionIdx: null };

function openAddRequirementModal(nodeId, actionIdx) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("add requirements")) return;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const act = (node.actions || [])[actionIdx];
  if (!act) return;
  if (!act.requirements) act.requirements = [];
  if (act.requirements.length >= 4) {
    alert("Maximum 4 requirement clauses allowed per action.");
    return;
  }
  
  // Directly open resource picker without intermediary popup modal
  openResourcePickerModal(nodeId, actionIdx, 'requirement', null);
}

function chooseRequirementType(type) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("choose requirement type")) return;
  closeModal('modal-req-type');
  const { nodeId, actionIdx } = pendingReqContext;
  openResourcePickerModal(nodeId, actionIdx, 'requirement', null);
}

function addRequirementAlternative(nodeId, actionIdx, clauseIdx) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("add requirement alternative")) return;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const act = (node.actions || [])[actionIdx];
  if (!act || !act.requirements || !act.requirements[clauseIdx]) return;
  const clause = act.requirements[clauseIdx];
  if (clause.items && clause.items.length >= 3) {
    alert("Maximum 3 replacement resources allowed per requirement clause.");
    return;
  }
  openResourcePickerModal(nodeId, actionIdx, 'requirement_alternative', null, clauseIdx);
}

function openEditRequirementItem(nodeId, actionIdx, clauseIdx, itemIdx) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("edit requirement")) return;
  openResourcePickerModal(nodeId, actionIdx, 'requirement_edit', itemIdx, clauseIdx);
}

function removeRequirementItem(nodeId, actionIdx, clauseIdx, itemIdx) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("remove requirement")) return;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const act = (node.actions || [])[actionIdx];
  if (!act || !act.requirements || !act.requirements[clauseIdx]) return;
  pushUndoState();
  const clause = act.requirements[clauseIdx];
  if (clause.items) {
    clause.items.splice(itemIdx, 1);
    if (clause.items.length === 0) {
      act.requirements.splice(clauseIdx, 1);
    }
  } else {
    act.requirements.splice(clauseIdx, 1);
  }
  saveProjectToLocalStorage();
  renderApp();
  showToast("Requirement item removed", "info");
}

function addInactionThreat(nodeId) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("add inaction threat")) return;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;
  pushUndoState();
  node.hasInactionThreat = true;
  node.inactionThreat = {
    description: "Event times out without choice made.",
    shortDescription: "Timeout",
    timerHours: "Infinite",
    resultDescription: "Catastrophic failure occurs due to delay.",
    penalties: ["💀 Entropy +10"]
  };
  saveProjectToLocalStorage();
  renderApp();
  showToast("Inaction Threat added", "success");
}

function removeInactionThreat(nodeId) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("remove inaction threat")) return;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;
  pushUndoState();
  node.hasInactionThreat = false;
  node.inactionThreat = null;
  // If dialogues were triggered on inaction for this event, unlink
  appData.dialogues.forEach(d => {
    if (d.targetEventId === nodeId && d.triggerActionId === 'inaction') {
      d.triggerActionId = null;
      d.triggerTiming = 'pre_event';
      d.triggerCondition = formatDialogueTriggerCondition('pre_event', node, null);
    }
  });
  saveProjectToLocalStorage();
  renderApp();
  showToast("Inaction Threat removed", "info");
}

let activePickerCategory = 'all';

function showStatusEffectFloatingTooltip(item, ev) {
  let tip = document.getElementById('status-effect-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'status-effect-tooltip';
    tip.className = 'fixed z-[9999] pointer-events-none bg-slate-950 border border-teal-500/80 shadow-2xl rounded-xl p-3.5 max-w-sm text-left transition-opacity duration-150 backdrop-blur-md';
    document.body.appendChild(tip);
  }
  
  const curSpecies = (document.getElementById('picker-species-select') && document.getElementById('picker-species-select').value) || item.species || 'Auri';
  const curAmount = (document.getElementById('picker-amount-input') && document.getElementById('picker-amount-input').value.trim()) || item.nValue || item.amount || '4';

  let displayName = item.name || '';
  let displayEffect = item.effect || '';
  let displayTarget = item.target || '';
  let displayComments = item.comments || '';

  const hasSpecies = Boolean(item.hasSpecies || /\{SpeciesName\}|\{Species\}|SpeciesName|Species/i.test(displayName) || /\{SpeciesName\}|\{Species\}|SpeciesName|Species/i.test(displayEffect) || /\{SpeciesName\}|\{Species\}|SpeciesName|Species/i.test(displayTarget));
  if (hasSpecies) {
    displayName = displayName.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, curSpecies);
    displayEffect = displayEffect.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, curSpecies);
    displayTarget = displayTarget.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, curSpecies);
    displayComments = displayComments.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, curSpecies);
  }

  const hasN = Boolean(item.hasN || /(\bN\b|\{N\})/.test(displayEffect) || /(\bN\b|\{N\})/.test(displayName));
  if (hasN) {
    displayName = displayName.replace(/\{N\}/g, curAmount).replace(/\bN\b/g, curAmount);
    displayEffect = displayEffect.replace(/\{N\}/g, curAmount).replace(/\bN\b/g, curAmount);
    displayComments = displayComments.replace(/\{N\}/g, curAmount).replace(/\bN\b/g, curAmount);
  }

  // Strip all leftover { } brackets anywhere in strings
  displayName = displayName.replace(/[{}]/g, '').trim();
  displayEffect = displayEffect.replace(/[{}]/g, '').trim();
  displayTarget = displayTarget.replace(/[{}]/g, '').trim();
  displayComments = displayComments.replace(/[{}]/g, '').trim();

  const isNeg = item.posNeg === 'negative';
  const badgeBorder = isNeg ? 'border-rose-500/50 bg-rose-950/80 text-rose-300' : 'border-teal-500/50 bg-teal-950/80 text-teal-300';
  const iconImg = item.iconImg ? `<img src="${item.iconImg}" alt="${displayName}" class="w-8 h-8 object-contain shrink-0 drop-shadow">` : `<span class="text-2xl">${item.icon || '✨'}</span>`;

  tip.innerHTML = `
    <div class="flex items-start gap-2.5 pb-2 mb-2 border-b border-slate-800">
      ${iconImg}
      <div class="flex-1 min-w-0">
        <div class="font-extrabold text-sm text-white flex items-center justify-between gap-2">
          <span class="truncate">${displayName}</span>
          <span class="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${badgeBorder}">${item.posNeg || 'Buff'}</span>
        </div>
        <div class="text-[10px] text-teal-400 font-mono mt-0.5 font-bold uppercase">${item.effectType || 'Buff/Debuff'}</div>
      </div>
    </div>
    <div class="space-y-1.5 text-xs">
      <div class="flex items-baseline gap-1.5">
        <span class="text-[10px] font-bold uppercase text-gray-400 tracking-wider w-20 shrink-0">Name:</span>
        <span class="text-gray-100 font-semibold">${displayName}</span>
      </div>
      <div class="flex items-baseline gap-1.5">
        <span class="text-[10px] font-bold uppercase text-gray-400 tracking-wider w-20 shrink-0">Category:</span>
        <span class="text-amber-300 font-semibold">${item.category}</span>
      </div>
      <div class="flex items-baseline gap-1.5">
        <span class="text-[10px] font-bold uppercase text-gray-400 tracking-wider w-20 shrink-0">Target:</span>
        <span class="text-purple-300 font-semibold">${displayTarget}</span>
      </div>
      <div class="flex items-baseline gap-1.5">
        <span class="text-[10px] font-bold uppercase text-gray-400 tracking-wider w-20 shrink-0">Effect:</span>
        <span class="text-cyan-300 font-bold">${displayEffect}</span>
      </div>
      <div class="flex items-baseline gap-1.5">
        <span class="text-[10px] font-bold uppercase text-gray-400 tracking-wider w-20 shrink-0">Effect Type:</span>
        <span class="text-emerald-300 font-semibold">${item.effectType}</span>
      </div>
      ${displayComments ? `
        <div class="pt-1.5 mt-1 border-t border-slate-800 text-[11px] text-gray-400 italic leading-snug">
          ${displayComments}
        </div>` : ''}
    </div>
  `;
  
  tip.style.display = 'block';
  tip.style.opacity = '1';
  updateStatusEffectFloatingTooltip(ev);
}

function updateStatusEffectFloatingTooltip(ev) {
  const tip = document.getElementById('status-effect-tooltip');
  if (!tip || tip.style.display === 'none') return;
  const pad = 16;
  let x = ev.clientX + pad;
  let y = ev.clientY + pad;
  const tipRect = tip.getBoundingClientRect();
  if (x + tipRect.width > window.innerWidth - 10) {
    x = ev.clientX - tipRect.width - pad;
  }
  if (y + tipRect.height > window.innerHeight - 10) {
    y = ev.clientY - tipRect.height - pad;
  }
  tip.style.left = `${Math.max(10, x)}px`;
  tip.style.top = `${Math.max(10, y)}px`;
}

function hideStatusEffectFloatingTooltip() {
  const tip = document.getElementById('status-effect-tooltip');
  if (tip) {
    tip.style.display = 'none';
    tip.style.opacity = '0';
  }
}

window.showStatusEffectFloatingTooltip = showStatusEffectFloatingTooltip;
window.updateStatusEffectFloatingTooltip = updateStatusEffectFloatingTooltip;
window.hideStatusEffectFloatingTooltip = hideStatusEffectFloatingTooltip;

function setPickerCategoryFilter(cat, btn) {
  activePickerCategory = cat;
  const canPickStatusEffects = Boolean(activePickerTarget && activePickerTarget.canPickStatusEffects);
  const canPickAllStatusEffects = Boolean(activePickerTarget && activePickerTarget.canPickAllStatusEffects);
  const tabs = document.querySelectorAll('.picker-cat-tab');
  tabs.forEach(b => {
    const isStatusTab = (b.id === 'picker-tab-status-effects');
    const hiddenClass = (isStatusTab && !canPickStatusEffects) ? ' hidden' : '';
    b.className = 'picker-cat-tab px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 hover:border-gray-700 transition flex items-center gap-1 shrink-0' + hiddenClass;
    if (isStatusTab) {
      b.innerHTML = canPickAllStatusEffects ? '<span>✨ Status Effects</span>' : '<span>🤝 Trader Effects</span>';
    }
  });
  if (btn) {
    btn.className = 'picker-cat-tab px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-gray-950 transition flex items-center gap-1 shrink-0';
  } else {
    const catMap = { all: 0, criteria: 1, stat: 2, specialization: 3, item: 4, building: 5, status_effect: 6 };
    const tabIdx = catMap[cat];
    if (tabIdx !== undefined && tabs[tabIdx]) {
      tabs[tabIdx].className = 'picker-cat-tab px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-gray-950 transition flex items-center gap-1 shrink-0';
    }
  }

  // Update section visibility
  const criteriaSec = document.getElementById('section-picker-criteria');
  const currenciesSec = document.getElementById('section-picker-currencies');
  const specsSec = document.getElementById('section-picker-specializations');
  const gridSec = document.getElementById('section-picker-grid');
  const gridTitle = document.getElementById('picker-grid-title');

  if (criteriaSec) criteriaSec.style.display = (cat === 'all' || cat === 'criteria') ? 'block' : 'none';
  if (currenciesSec) currenciesSec.style.display = (cat === 'all' || cat === 'stat') ? 'block' : 'none';
  if (specsSec) specsSec.style.display = (cat === 'all' || cat === 'specialization') ? 'block' : 'none';
  if (gridSec) gridSec.style.display = 'block';

  if (gridTitle) {
    if (cat === 'status_effect') {
      gridTitle.innerHTML = canPickAllStatusEffects 
        ? '<span>✨ Deck Event Status Effects (Buffs, Debuffs &amp; Crew Conditions)</span>'
        : '<span>🤝 Trader Status Effects</span>';
    }
    else if (cat === 'criteria') gridTitle.innerHTML = '<span>🔑 All Criteria Story Flags</span>';
    else if (cat === 'stat') gridTitle.innerHTML = '<span>🧠 Intangible Stats &amp; Currencies</span>';
    else if (cat === 'specialization') gridTitle.innerHTML = '<span>👨‍🚀 Crew Specializations</span>';
    else if (cat === 'item') gridTitle.innerHTML = '<span>📦 Items, Tools &amp; Raw Materials</span>';
    else if (cat === 'building') gridTitle.innerHTML = '<span>🏛️ Carrier Buildings &amp; Facilities</span>';
    else gridTitle.innerHTML = '<span>Catalog Resources &amp; Items</span>';
  }

  const input = document.getElementById('picker-search-input');
  filterPickerResources(input ? input.value : '');

  const scrollBody = document.getElementById('picker-scroll-body');
  if (scrollBody) scrollBody.scrollTop = 0;
}

function openResourcePickerModal(nodeId, actionIdx, type, itemIdx, clauseIdx = null) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("modify requirements or rewards")) return;
  const node = (appData.nodes || []).find(n => n.id === nodeId);
  const isDeckEvent = Boolean(
    (node && (node.category === 'DeckPool' || node.category === 'SpeciesPool' || node.category === 'deck' || node.variationId === 'deck_events')) ||
    (typeof getCurrentBoardIdentifier === 'function' && (getCurrentBoardIdentifier() === 'DeckPool' || getCurrentBoardIdentifier() === 'SpeciesPool')) ||
    activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool'
  );
  const isRewardOrPenalty = (type === 'reward' || type === 'inaction_penalty');
  const canPickAllStatusEffects = Boolean(isRewardOrPenalty && isDeckEvent);
  const canPickTraderStatusEffects = Boolean(isRewardOrPenalty);
  const canPickStatusEffects = Boolean(canPickAllStatusEffects || canPickTraderStatusEffects);

  activePickerTarget = { 
    nodeId, 
    actionIdx, 
    type, 
    itemIdx, 
    clauseIdx, 
    clauseType: 'single', 
    canPickStatusEffects,
    canPickAllStatusEffects,
    canPickTraderStatusEffects
  };

  const statusTab = document.getElementById('picker-tab-status-effects');
  if (statusTab) {
    if (canPickStatusEffects) {
      statusTab.classList.remove('hidden');
      statusTab.innerHTML = canPickAllStatusEffects ? '<span>✨ Status Effects</span>' : '<span>🤝 Trader Effects</span>';
    } else {
      statusTab.classList.add('hidden');
    }
  }

  const speciesWrapper = document.getElementById('picker-species-wrapper');
  if (speciesWrapper) {
    if (canPickStatusEffects) {
      speciesWrapper.classList.remove('hidden');
    } else {
      speciesWrapper.classList.add('hidden');
    }
  }

  const amountLabel = document.getElementById('picker-amount-label');
  if (amountLabel) {
    amountLabel.innerText = canPickStatusEffects ? 'Amount / N:' : 'Amount / Delta:';
  }

  const grid = document.getElementById('picker-resource-grid');
  if (!grid) return;

  const hintEl = document.getElementById('picker-target-hint');
  if (hintEl) {
    if (type === 'reward') {
      hintEl.innerText = canPickAllStatusEffects 
        ? 'Configure deck event outcome reward (items, buildings, currencies, or deck status effects).' 
        : (canPickTraderStatusEffects
            ? 'Configure outcome reward (items, buildings, currencies, or trader status effects).'
            : 'Configure outcome reward (supports quantities or ranges, e.g. 20-30).');
    } else if (type === 'inaction_penalty') {
      hintEl.innerText = canPickAllStatusEffects
        ? 'Configure deck event inaction penalty (resources, stats, or deck status effects).'
        : (canPickTraderStatusEffects
            ? 'Configure inaction timeout penalty (resources, stats, or trader status effects).'
            : 'Configure inaction timeout penalty (negative delta, e.g. -10).');
    } else if (type === 'requirement' || type === 'requirement_alternative' || type === 'requirement_edit') {
      hintEl.innerText = 'Configure action choice requirement condition.';
    } else {
      hintEl.innerText = 'Choose an item, building, currency, specialization, or story criteria.';
    }
  }

  const input = document.getElementById('picker-search-input');
  if (input) input.value = '';

  const speciesSelect = document.getElementById('picker-species-select');
  if (speciesSelect) {
    speciesSelect.value = 'Auri';
  }

  const criteriaInput = document.getElementById('picker-criteria-input');
  if (criteriaInput) {
    criteriaInput.value = '';
    if (type === 'reward') {
      const act = (node && node.actions) ? node.actions[actionIdx] : null;
      const existingRw = (act && act.rewards && itemIdx !== null) ? act.rewards[itemIdx] : null;
      if (existingRw && isCriteriaObject(existingRw)) {
        criteriaInput.value = existingRw.name || '';
      }
    } else if (type === 'requirement_edit') {
      const act = (node && node.actions) ? node.actions[actionIdx] : null;
      const clause = (act && act.requirements && clauseIdx !== null) ? act.requirements[clauseIdx] : null;
      const existingReq = (clause && clause.items && itemIdx !== null) ? clause.items[itemIdx] : null;
      if (existingReq && isCriteriaObject(existingReq)) {
        criteriaInput.value = existingReq.name || '';
      }
    }
  }

  const amountInput = document.getElementById('picker-amount-input');
  if (amountInput) {
    if (type === 'reward') {
      const act = (node && node.actions) ? node.actions[actionIdx] : null;
      const existingRw = (act && act.rewards && itemIdx !== null) ? act.rewards[itemIdx] : null;
      if (existingRw) {
        if (typeof existingRw === 'object') {
          amountInput.value = (existingRw.amount !== undefined && existingRw.amount !== '') 
            ? existingRw.amount 
            : (existingRw.nValue || (canPickStatusEffects ? '4' : '20-30'));
          if (speciesSelect && existingRw.species) {
            speciesSelect.value = existingRw.species;
          }
        } else if (typeof existingRw === 'string') {
          const match = existingRw.match(/(?:[xX]|[+\-])\s*([0-9]+(?:-[0-9]+)?)|([0-9]+-[0-9]+)/);
          amountInput.value = match ? (match[1] || match[2]) : (canPickStatusEffects ? '4' : '20-30');
        } else {
          amountInput.value = canPickStatusEffects ? '4' : '20-30';
        }
      } else {
        amountInput.value = canPickStatusEffects ? '4' : '20-30';
      }
    } else if (type === 'inaction_penalty') {
      const pen = (node && node.inactionThreat && node.inactionThreat.penalties && itemIdx !== null) ? node.inactionThreat.penalties[itemIdx] : null;
      if (pen) {
        if (typeof pen === 'object') {
          amountInput.value = (pen.amount !== undefined && pen.amount !== '') 
            ? pen.amount 
            : (pen.nValue || (canPickStatusEffects ? '4' : '-10'));
          if (speciesSelect && pen.species) {
            speciesSelect.value = pen.species;
          }
        } else {
          amountInput.value = String(pen);
        }
      } else {
        amountInput.value = canPickStatusEffects ? '4' : '-10';
      }
    } else if (type === 'requirement_edit') {
      const act = (node && node.actions) ? node.actions[actionIdx] : null;
      const clause = (act && act.requirements && clauseIdx !== null) ? act.requirements[clauseIdx] : null;
      const existingReq = (clause && clause.items && itemIdx !== null) ? clause.items[itemIdx] : null;
      amountInput.value = (existingReq && existingReq.amount !== undefined) ? existingReq.amount : '1';
    } else if (type === 'requirement' || type === 'requirement_alternative') {
      amountInput.value = '1';
    } else {
      amountInput.value = '10';
    }
  }

  renderPickerCriteriaPool();
  setPickerCategoryFilter('all');
  openModal('modal-resource-picker');
}

function renderPickerCriteriaPool() {
  const listEl = document.getElementById('picker-criteria-list');
  if (!listEl) return;
  const pool = getGlobalCriteriaPool();
  if (pool.length === 0) {
    listEl.innerHTML = `<span class="text-[11px] text-gray-500 italic">No criteria flags created yet. Type a name above (e.g. "Orange Box") and click "+ Add & Select".</span>`;
    return;
  }
  listEl.innerHTML = pool.map(critName => {
    const safeAttr = critName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeHtml = critName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
      <span class="inline-flex items-center gap-1.5 bg-fuchsia-950/80 hover:bg-fuchsia-900/90 border border-fuchsia-600/80 text-fuchsia-200 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition shadow-xs"
            onclick="selectCriteriaFromPicker('${safeAttr}')"
            title="Click to select Criteria '${safeHtml}'">
        <span>🔑 ${safeHtml}</span>
        <button type="button"
                class="text-fuchsia-400 hover:text-red-300 font-bold ml-1 px-1 rounded hover:bg-black/30"
                onclick="event.stopPropagation(); deleteCriteriaFromPool('${safeAttr}')"
                title="Remove from Criteria pool">×</button>
      </span>
    `;
  }).join('');
}

function createAndSelectCriteriaFromPicker() {
  const input = document.getElementById('picker-criteria-input');
  const rawName = input ? input.value.trim() : '';
  if (!rawName) {
    showToast('Please enter a Criteria name (e.g. "Orange Box")', 'warning');
    if (input) input.focus();
    return;
  }
  selectCriteriaFromPicker(rawName);
}

function selectCriteriaFromPicker(criteriaName) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("select criteria")) return;
  const cleanName = String(criteriaName || '').trim();
  if (!cleanName) return;

  const { nodeId, actionIdx, type, itemIdx, clauseIdx } = activePickerTarget;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;

  pushUndoState();

  if (!Array.isArray(appData.criteriaPool)) appData.criteriaPool = [];
  if (!appData.criteriaPool.some(c => String(c).toLowerCase() === cleanName.toLowerCase())) {
    appData.criteriaPool.push(cleanName);
  }

  const critId = `criteria_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  const criteriaObj = {
    resourceId: critId,
    name: cleanName,
    amount: 1,
    icon: '🔑',
    iconImg: '',
    category: 'Criteria',
    isCriteria: true
  };

  if (type === 'inaction_penalty') {
    if (!node.inactionThreat) node.inactionThreat = {};
    if (!node.inactionThreat.penalties) node.inactionThreat.penalties = [];
    if (itemIdx !== null && node.inactionThreat.penalties[itemIdx] !== undefined) {
      node.inactionThreat.penalties[itemIdx] = criteriaObj;
    } else {
      node.inactionThreat.penalties.push(criteriaObj);
    }
  } else {
    const act = (node.actions || [])[actionIdx];
    if (!act) return;

    if (type === 'requirement') {
      if (!act.requirements) act.requirements = [];
      act.requirements.push({
        id: `clause_${Date.now()}`,
        isReplaceable: false,
        items: [criteriaObj]
      });
    } else if (type === 'requirement_alternative') {
      const clause = act.requirements[clauseIdx];
      if (clause) {
        if (!clause.items) clause.items = [];
        clause.items.push(criteriaObj);
        clause.isReplaceable = true;
      }
    } else if (type === 'requirement_edit') {
      const clause = act.requirements[clauseIdx];
      if (clause && clause.items && clause.items[itemIdx]) {
        clause.items[itemIdx] = criteriaObj;
      }
    } else if (type === 'reward') {
      if (!act.rewards) act.rewards = [];
      if (itemIdx !== null && act.rewards[itemIdx] !== undefined) {
        act.rewards[itemIdx] = criteriaObj;
      } else {
        act.rewards.push(criteriaObj);
      }
    }
  }

  saveProjectToLocalStorage();
  closeModal('modal-resource-picker');
  renderApp();
  showToast(`${type === 'reward' ? 'Granted Criteria' : 'Required Criteria'}: "🔑 ${cleanName}"`, 'success');
}

function deleteCriteriaFromPool(criteriaName) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("delete criteria")) return;
  const cleanName = String(criteriaName || '').trim();
  if (!cleanName) return;
  if (Array.isArray(appData.criteriaPool)) {
    appData.criteriaPool = appData.criteriaPool.filter(c => String(c).toLowerCase() !== cleanName.toLowerCase());
  }
  saveProjectToLocalStorage();
  renderPickerCriteriaPool();
  const input = document.getElementById('picker-search-input');
  filterPickerResources(input ? input.value : '');
  showToast(`Removed "${cleanName}" from global Criteria list`, 'info');
}

window.createAndSelectCriteriaFromPicker = createAndSelectCriteriaFromPicker;
window.selectCriteriaFromPicker = selectCriteriaFromPicker;
window.deleteCriteriaFromPool = deleteCriteriaFromPool;

function renderPickerResources(items) {
  const grid = document.getElementById('picker-resource-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const countEl = document.getElementById('picker-grid-count');
  if (countEl) countEl.innerText = `(${items ? items.length : 0} items)`;

  if (!items || items.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-gray-400">
        <i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 text-gray-500 opacity-60"></i>
        <div class="font-bold text-sm text-gray-300">No resources found</div>
        <p class="text-xs text-gray-500 mt-1">Try clearing your search query or selecting a different category tab.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ root: grid });
    return;
  }

  const curSpecies = (document.getElementById('picker-species-select') && document.getElementById('picker-species-select').value) || 'Auri';
  const curAmount = (document.getElementById('picker-amount-input') && document.getElementById('picker-amount-input').value.trim()) || '4';

  items.forEach(item => {
    const card = document.createElement('div');
    const isBuilding = item.kind === 'building' || item.category === 'Building';
    const isCriteria = Boolean(item.isCriteria || item.category === 'Criteria');
    const isStatusEffect = Boolean(item.isStatusEffect || item.kind === 'status_effect');
    
    let displayName = item.name;
    let displayEffect = item.effect || '';
    let displayTarget = item.target || '';
    
    if (isStatusEffect) {
      if (item.hasSpecies || /\{SpeciesName\}|\{Species\}|SpeciesName|Species/i.test(displayName) || /\{SpeciesName\}|\{Species\}|SpeciesName|Species/i.test(displayEffect) || /\{SpeciesName\}|\{Species\}|SpeciesName|Species/i.test(displayTarget)) {
        displayName = displayName.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, curSpecies);
        displayEffect = displayEffect.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, curSpecies);
        displayTarget = displayTarget.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, curSpecies);
      }
      if (item.hasN || /(\bN\b|\{N\})/.test(displayEffect) || /(\bN\b|\{N\})/.test(displayName)) {
        displayName = displayName.replace(/\{N\}/g, curAmount).replace(/\bN\b/g, curAmount);
        displayEffect = displayEffect.replace(/\{N\}/g, curAmount).replace(/\bN\b/g, curAmount);
      }
      displayName = displayName.replace(/[{}]/g, '').trim();
      displayEffect = displayEffect.replace(/[{}]/g, '').trim();
      displayTarget = displayTarget.replace(/[{}]/g, '').trim();
    }

    let borderHoverClass = 'border-gray-800 hover:border-cyan-400 hover:bg-slate-900/50';
    if (isCriteria) {
      borderHoverClass = 'border-fuchsia-600/80 hover:border-fuchsia-400 bg-fuchsia-950/20';
    } else if (isStatusEffect) {
      const isNeg = item.posNeg === 'negative';
      borderHoverClass = isNeg 
        ? 'border-rose-700/80 hover:border-rose-400 bg-rose-950/25 status-effect-card' 
        : 'border-teal-700/80 hover:border-teal-400 bg-teal-950/25 status-effect-card';
    } else if (isBuilding) {
      borderHoverClass = 'border-amber-900/60 hover:border-amber-400 bg-amber-950/15';
    }

    card.className = `bg-gray-950/90 border ${borderHoverClass} p-2.5 rounded-xl cursor-pointer flex flex-col items-center text-center transition shadow-sm hover:shadow-lg hover:scale-[1.03] active:scale-95 group relative select-none`;
    
    let iconBoxClass = 'bg-slate-900/50 border-slate-800/80';
    if (isCriteria) {
      iconBoxClass = 'bg-fuchsia-950/70 border-fuchsia-700/80';
    } else if (isStatusEffect) {
      iconBoxClass = item.posNeg === 'negative' ? 'bg-rose-950/70 border-rose-700/80' : 'bg-teal-950/70 border-teal-700/80';
    }

    const iconMarkup = item.iconImg ? `
      <div class="w-12 h-12 flex items-center justify-center mb-1.5 p-1 bg-slate-900/90 rounded-lg border border-slate-700/80 group-hover:border-amber-400 group-hover:scale-105 transition shadow-md">
        <img src="${item.iconImg}" alt="${displayName}" class="w-10 h-10 object-contain drop-shadow" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline';">
        <span style="display:none;" class="text-xl">${item.icon || (isStatusEffect ? '✨' : (isBuilding ? '🏛️' : '📦'))}</span>
      </div>` : `
      <div class="w-12 h-12 flex items-center justify-center mb-1.5 ${iconBoxClass} rounded-lg border">
        <span class="text-xl">${item.icon || (isCriteria ? '🔑' : (isStatusEffect ? '✨' : (isBuilding ? '🏛️' : '📦')))}</span>
      </div>`;
    
    let subText = item.category || (isBuilding ? 'Building' : 'Item');
    if (isStatusEffect) {
      subText = `${item.category} • ${item.effectType || (item.posNeg === 'negative' ? 'Debuff' : 'Buff')}`;
    } else if (item.tier !== undefined) {
      subText += ` • T${item.tier}`;
    }

    let nameColorClass = 'text-gray-200';
    if (isCriteria) nameColorClass = 'text-fuchsia-200';
    else if (isStatusEffect) nameColorClass = item.posNeg === 'negative' ? 'text-rose-200' : 'text-teal-200';

    let subColorClass = 'text-gray-400';
    if (isCriteria) subColorClass = 'text-fuchsia-400';
    else if (isStatusEffect) subColorClass = item.posNeg === 'negative' ? 'text-rose-400' : 'text-teal-400';

    card.innerHTML = `
      ${iconMarkup}
      <div class="font-bold ${nameColorClass} text-xs truncate w-full group-hover:text-amber-300 transition" title="${displayName}">${displayName}</div>
      <div class="text-[9px] ${subColorClass} uppercase font-mono mt-0.5 truncate w-full">${subText}</div>
    `;

    if (isStatusEffect) {
      card.title = `Name: ${displayName}\nCategory: ${item.category}\nTarget: ${displayTarget}\nEffect: ${displayEffect}\nEffect Type: ${item.effectType}`;
      card.setAttribute('data-status-effect-id', item.id);
      card.setAttribute('data-status-effect-name', displayName);
      const hoverItem = { ...item, name: displayName, effect: displayEffect, target: displayTarget, species: curSpecies, nValue: curAmount, amount: curAmount };
      card.onmouseenter = (ev) => showStatusEffectFloatingTooltip(hoverItem, ev);
      card.onmousemove = (ev) => updateStatusEffectFloatingTooltip(ev);
      card.onmouseleave = () => hideStatusEffectFloatingTooltip();
    }

    card.onclick = () => {
      hideStatusEffectFloatingTooltip();
      if (isCriteria) {
        selectCriteriaFromPicker(item.name);
      } else {
        selectResourceFromPicker(item);
      }
    };
    grid.appendChild(card);
  });
}

function onPickerSpeciesChange(species) {
  const input = document.getElementById('picker-search-input');
  filterPickerResources(input ? input.value : '');
}
window.onPickerSpeciesChange = onPickerSpeciesChange;

function filterPickerResources(query) {
  let items = resourceCatalog.resources || [];
  const criteriaItems = getGlobalCriteriaPool().map(cName => ({
    id: `criteria_${cName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    name: cName,
    category: 'Criteria',
    kind: 'criteria',
    icon: '🔑',
    iconImg: '',
    isCriteria: true
  }));

  const canPickAllStatusEffects = Boolean(activePickerTarget && activePickerTarget.canPickAllStatusEffects);
  const canPickTraderStatusEffects = Boolean(activePickerTarget && activePickerTarget.canPickTraderStatusEffects);

  let statusEffects = [];
  if (canPickAllStatusEffects) {
    statusEffects = window.statusEffectsCatalog || [];
  } else if (canPickTraderStatusEffects) {
    statusEffects = (window.statusEffectsCatalog || []).filter(se => (typeof isTraderStatusEffect === 'function' && isTraderStatusEffect(se)));
  }

  if (activePickerCategory === 'status_effect') {
    items = statusEffects;
  } else if (activePickerCategory === 'criteria') {
    items = criteriaItems;
  } else if (activePickerCategory === 'specialization') {
    items = items.filter(i => i.category === 'Specialization' || i.kind === 'specialization');
  } else if (activePickerCategory === 'building') {
    items = items.filter(i => i.kind === 'building' || i.category === 'Building');
  } else if (activePickerCategory === 'item') {
    items = items.filter(i => i.kind !== 'building' && i.category !== 'Building' && i.category !== 'Stat' && i.category !== 'People' && i.category !== 'Tech' && i.category !== 'Specialization' && i.kind !== 'specialization');
  } else if (activePickerCategory === 'stat') {
    items = items.filter(i => i.category === 'Stat' || i.category === 'People' || i.category === 'Tech' || i.category === 'Key Item');
  } else {
    items = [...criteriaItems, ...items, ...statusEffects];
  }

  const q = (query || '').toLowerCase().trim();
  if (q) {
    items = items.filter(i => 
      (i.name && i.name.toLowerCase().includes(q)) || 
      (i.category && i.category.toLowerCase().includes(q)) ||
      (i.id && i.id.toLowerCase().includes(q)) ||
      (i.target && i.target.toLowerCase().includes(q)) ||
      (i.effect && i.effect.toLowerCase().includes(q)) ||
      (i.effectType && i.effectType.toLowerCase().includes(q))
    );
  }

  renderPickerResources(items);
}

// Select Crew Specialization (Science, Engineering, Operations, Defense)
function selectCrewSpecialization(categoryName, icon, color) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("assign specialization")) return;
  const { nodeId, actionIdx, type, itemIdx, clauseIdx, clauseType } = activePickerTarget;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;

  pushUndoState();
  const qtyInput = document.getElementById('picker-amount-input');
  let amountStr = (qtyInput && qtyInput.value.trim()) ? qtyInput.value.trim() : '1';

  if (type === 'inaction_penalty') {
    if (!node.inactionThreat) node.inactionThreat = {};
    if (!node.inactionThreat.penalties) node.inactionThreat.penalties = [];
    let formattedSign = amountStr;
    if (!amountStr.startsWith('+') && !amountStr.startsWith('-')) {
      formattedSign = `-${amountStr}`;
    }
    const penaltyObj = {
      resourceId: `spec_${categoryName.toLowerCase()}`,
      name: `${categoryName} Crew`,
      amount: formattedSign,
      icon: icon,
      iconImg: '',
      category: 'Specialization'
    };
    if (itemIdx !== null && node.inactionThreat.penalties[itemIdx] !== undefined) {
      node.inactionThreat.penalties[itemIdx] = penaltyObj;
    } else {
      node.inactionThreat.penalties.push(penaltyObj);
    }
  } else {
    const act = (node.actions || [])[actionIdx];
    if (!act) return;

    if (type === 'requirement') {
      if (!act.requirements) act.requirements = [];
      const numAmount = parseInt(amountStr) || 1;
      const newItem = {
        resourceId: `spec_${categoryName.toLowerCase()}`,
        name: `${categoryName} Crew`,
        amount: numAmount,
        icon: icon,
        iconImg: '',
        category: 'Specialization'
      };
      act.requirements.push({
        id: `clause_${Date.now()}`,
        isReplaceable: false,
        items: [newItem]
      });
    } else if (type === 'requirement_alternative') {
      const clause = act.requirements[clauseIdx];
      if (clause) {
        if (!clause.items) clause.items = [];
        const numAmount = parseInt(amountStr) || 1;
        clause.items.push({
          resourceId: `spec_${categoryName.toLowerCase()}`,
          name: `${categoryName} Crew`,
          amount: numAmount,
          icon: icon,
          iconImg: '',
          category: 'Specialization'
        });
        clause.isReplaceable = true;
      }
    } else if (type === 'requirement_edit') {
      const clause = act.requirements[clauseIdx];
      if (clause && clause.items && clause.items[itemIdx]) {
        const numAmount = parseInt(amountStr) || 1;
        clause.items[itemIdx] = {
          resourceId: `spec_${categoryName.toLowerCase()}`,
          name: `${categoryName} Crew`,
          amount: numAmount,
          icon: icon,
          iconImg: '',
          category: 'Specialization'
        };
      }
    } else if (type === 'reward') {
      if (!act.rewards) act.rewards = [];
      let formattedDelta = amountStr;
      if (!amountStr.startsWith('+') && !amountStr.startsWith('-')) {
        formattedDelta = `+${amountStr}`;
      }
      const rewardObj = {
        resourceId: `spec_${categoryName.toLowerCase()}`,
        name: `${categoryName} Spec`,
        amount: formattedDelta,
        icon: icon,
        iconImg: '',
        category: 'Specialization'
      };
      if (itemIdx !== null && act.rewards[itemIdx] !== undefined) {
        act.rewards[itemIdx] = rewardObj;
      } else {
        act.rewards.push(rewardObj);
      }
    }
  }

  saveProjectToLocalStorage();
  closeModal('modal-resource-picker');
  renderApp();
  showToast(`Specialization ${categoryName} updated`, "success");
}

// Select Intangible Stat with Specific Amount or Range & Support Inaction Penalties + Requirement Clauses
function selectIntangibleStat(statName, icon, color) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("assign stat")) return;
  const { nodeId, actionIdx, type, itemIdx, clauseIdx, clauseType } = activePickerTarget;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;

  pushUndoState();
  const qtyInput = document.getElementById('picker-amount-input');
  const amountStr = (qtyInput && qtyInput.value.trim()) ? qtyInput.value.trim() : '10';

  let formattedSign = amountStr;
  if (!amountStr.startsWith('+') && !amountStr.startsWith('-')) {
    formattedSign = `+${amountStr}`;
  }
  const statText = `${icon} ${statName} ${formattedSign}`;

  if (type === 'inaction_penalty') {
    if (!node.inactionThreat) node.inactionThreat = {};
    if (!node.inactionThreat.penalties) node.inactionThreat.penalties = [];
    const penaltyObj = {
      resourceId: `stat_${statName.toLowerCase()}`,
      name: statName,
      amount: formattedSign,
      icon: icon,
      iconImg: ''
    };
    if (itemIdx !== null && node.inactionThreat.penalties[itemIdx] !== undefined) {
      node.inactionThreat.penalties[itemIdx] = penaltyObj;
    } else {
      node.inactionThreat.penalties.push(penaltyObj);
    }
  } else {
    const act = (node.actions || [])[actionIdx];
    if (!act) return;

    if (type === 'requirement') {
      if (!act.requirements) act.requirements = [];
      const numAmount = parseInt(amountStr) || 10;
      const newItem = { resourceId: `stat_${statName.toLowerCase()}`, name: `${icon} ${statName}`, amount: numAmount, icon: icon };
      act.requirements.push({
        id: `clause_${Date.now()}`,
        isReplaceable: false,
        items: [newItem]
      });
    } else if (type === 'requirement_alternative') {
      const clause = act.requirements[clauseIdx];
      if (clause) {
        if (!clause.items) clause.items = [];
        const numAmount = parseInt(amountStr) || 10;
        clause.items.push({ resourceId: `stat_${statName.toLowerCase()}`, name: `${icon} ${statName}`, amount: numAmount, icon: icon });
        clause.isReplaceable = true;
      }
    } else if (type === 'requirement_edit') {
      const clause = act.requirements[clauseIdx];
      if (clause && clause.items && clause.items[itemIdx]) {
        const numAmount = parseInt(amountStr) || 10;
        clause.items[itemIdx] = { resourceId: `stat_${statName.toLowerCase()}`, name: `${icon} ${statName}`, amount: numAmount, icon: icon };
      }
    } else if (type === 'reward') {
      if (!act.rewards) act.rewards = [];
      const rewardObj = {
        resourceId: `stat_${statName.toLowerCase()}`,
        name: statName,
        amount: formattedSign,
        icon: icon,
        iconImg: ''
      };
      if (itemIdx !== null && act.rewards[itemIdx] !== undefined) {
        act.rewards[itemIdx] = rewardObj;
      } else {
        act.rewards.push(rewardObj);
      }
    }
  }

  saveProjectToLocalStorage();
  closeModal('modal-resource-picker');
  renderApp();
  showToast(`Updated stat ${statName} (${formattedSign})`, "success");
}


function applyPickerAmountEdit() {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("modify amount")) return;
  const { nodeId, actionIdx, type, itemIdx, clauseIdx } = activePickerTarget || {};
  const qtyInput = document.getElementById('picker-amount-input');
  const amountStr = qtyInput ? qtyInput.value.trim() : '';
  if (!amountStr) {
    showToast("Please enter an amount or N value", "warning");
    return;
  }
  const node = (appData.nodes || []).find(n => n.id === nodeId);
  if (!node) return;

  if (itemIdx === null || itemIdx === undefined) {
    showToast(`Amount set to "${amountStr}". Now click any card below to add it.`, "info");
    return;
  }

  pushUndoState();

  if (type === 'inaction_penalty') {
    const pen = (node.inactionThreat && node.inactionThreat.penalties) ? node.inactionThreat.penalties[itemIdx] : null;
    if (pen) {
      pen.amount = amountStr;
      pen.nValue = amountStr;
      pen.hasN = true;
      if (pen.effect) {
        pen.effect = pen.effect.replace(/\{N\}/g, amountStr).replace(/for\s+\d+\s+hours/i, `for ${amountStr} hours`);
      }
    }
  } else if (type === 'reward') {
    const act = (node.actions || [])[actionIdx];
    const rw = (act && act.rewards) ? act.rewards[itemIdx] : null;
    if (rw) {
      rw.amount = amountStr;
      rw.nValue = amountStr;
      rw.hasN = true;
      if (rw.effect) {
        rw.effect = rw.effect.replace(/\{N\}/g, amountStr).replace(/for\s+\d+\s+hours/i, `for ${amountStr} hours`);
      }
    }
  } else if (type === 'requirement_edit' || type === 'requirement') {
    const act = (node.actions || [])[actionIdx];
    const clause = (act && act.requirements && clauseIdx !== null) ? act.requirements[clauseIdx] : null;
    const req = (clause && clause.items) ? clause.items[itemIdx] : null;
    if (req) {
      req.amount = parseInt(amountStr) || amountStr;
    }
  }

  saveProjectToLocalStorage();
  closeModal('modal-resource-picker');
  renderApp();
  showToast(`Updated value to: ${amountStr}`, "success");
}
window.applyPickerAmountEdit = applyPickerAmountEdit;

function selectResourceFromPicker(item) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("select resource item")) return;
  if (item.category === 'Specialization' || item.kind === 'specialization') {
    selectCrewSpecialization(item.name, item.icon || '👨‍🚀', item.color || '#3b82f6');
    return;
  }
  const isStatusEffect = Boolean(item.isStatusEffect || item.kind === 'status_effect');
  const { nodeId, actionIdx, type, itemIdx, clauseIdx, clauseType, canPickAllStatusEffects, canPickTraderStatusEffects, canPickStatusEffects } = activePickerTarget || {};
  
  if (isStatusEffect) {
    const isTrader = (typeof isTraderStatusEffect === 'function') && isTraderStatusEffect(item);
    const allowed = (type === 'reward' || type === 'inaction_penalty') && (canPickAllStatusEffects || (canPickTraderStatusEffects && isTrader));
    if (!allowed) {
      showToast(isTrader 
        ? "Trader status effects can only be assigned as rewards or penalties" 
        : "Non-trader status effects can only be assigned in deck events", "warning");
      return;
    }
  }

  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;

  pushUndoState();
  const qtyInput = document.getElementById('picker-amount-input');
  const amountStr = (qtyInput && qtyInput.value.trim()) ? qtyInput.value.trim() : '';

  const curSpecies = (document.getElementById('picker-species-select') && document.getElementById('picker-species-select').value) || 'Auri';
  const catalogMatch = (window.statusEffectsCatalog || []).find(se => (item && item.id && se.id === item.id) || (se.name && se.name.toLowerCase() === ((item && item.name) || '').toLowerCase()));

  let resolvedName = (item && item.name) || '';
  let resolvedEffect = (catalogMatch && catalogMatch.effect) ? catalogMatch.effect : ((item && item.effect) || '');
  let resolvedDesc = (catalogMatch && catalogMatch.description) ? catalogMatch.description : ((item && item.description) || '');
  let resolvedTarget = (catalogMatch && catalogMatch.target) ? catalogMatch.target : ((item && item.target) || 'crew');
  let resolvedComments = (catalogMatch && catalogMatch.comments) ? catalogMatch.comments : ((item && item.comments) || '');

  const hasN = Boolean(
    (item && item.hasN) || 
    (catalogMatch && catalogMatch.hasN) ||
    /(\bN\b|\{N\})/.test(resolvedDesc) || 
    /(\bN\b|\{N\})/.test(resolvedEffect) || 
    /(\bN\b|\{N\})/.test(resolvedName) ||
    (item && item.description && /(\bN\b|\{N\})/.test(item.description)) ||
    (item && item.effect && /(\bN\b|\{N\})/.test(item.effect)) ||
    (catalogMatch && catalogMatch.description && /(\bN\b|\{N\})/.test(catalogMatch.description)) ||
    (catalogMatch && catalogMatch.effect && /(\bN\b|\{N\})/.test(catalogMatch.effect)) ||
    /Weakened Morale|Food Savings|Fasting|Slowdown|Productivity|Traders/i.test(resolvedName)
  );

  const finalAmount = amountStr || (hasN ? '4' : (isStatusEffect ? '' : '1'));
  const hasSpecies = Boolean(
    (item && item.hasSpecies) || 
    (catalogMatch && catalogMatch.hasSpecies) ||
    /\{SpeciesName\}|\{Species\}|SpeciesName|Species/i.test(resolvedName) || 
    /\{SpeciesName\}|\{Species\}|SpeciesName|Species/i.test(resolvedEffect) || 
    /\{SpeciesName\}|\{Species\}|SpeciesName|Species/i.test(resolvedTarget)
  );

  if (hasSpecies) {
    resolvedName = resolvedName.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, curSpecies);
    resolvedEffect = resolvedEffect.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, curSpecies);
    resolvedTarget = resolvedTarget.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, curSpecies);
    resolvedComments = resolvedComments.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, curSpecies);
  }

  if (hasN && finalAmount) {
    resolvedName = resolvedName.replace(/\{N\}/g, finalAmount).replace(/\bN\b/g, finalAmount);
    resolvedEffect = resolvedEffect.replace(/\{N\}/g, finalAmount).replace(/\bN\b/g, finalAmount);
    resolvedDesc = resolvedDesc.replace(/\{N\}/g, finalAmount).replace(/\bN\b/g, finalAmount);
    resolvedComments = resolvedComments.replace(/\{N\}/g, finalAmount).replace(/\bN\b/g, finalAmount);
  }

  // Strip all leftover { } brackets anywhere in strings
  resolvedName = resolvedName.replace(/[{}]/g, '').trim();
  resolvedEffect = resolvedEffect.replace(/[{}]/g, '').trim();
  resolvedTarget = resolvedTarget.replace(/[{}]/g, '').trim();
  resolvedDesc = resolvedDesc.replace(/[{}]/g, '').trim();
  resolvedComments = resolvedComments.replace(/[{}]/g, '').trim();

  if (type === 'inaction_penalty') {
    if (!node.inactionThreat) node.inactionThreat = {};
    if (!node.inactionThreat.penalties) node.inactionThreat.penalties = [];
    const penaltyObj = isStatusEffect ? {
      resourceId: item.id,
      name: resolvedName,
      rawName: item.name,
      amount: hasN ? finalAmount : '',
      hasN: hasN,
      nValue: hasN ? finalAmount : '',
      hasSpecies: hasSpecies,
      species: hasSpecies ? curSpecies : '',
      iconImg: item.iconImg || (catalogMatch ? catalogMatch.iconImg : '') || '',
      icon: item.icon || (catalogMatch ? catalogMatch.icon : '⚡') || '⚡',
      isStatusEffect: true,
      kind: 'status_effect',
      category: 'Status Effect',
      effectCategory: item.category || (catalogMatch ? catalogMatch.category : ''),
      target: resolvedTarget,
      effect: resolvedEffect,
      effectType: item.effectType || (catalogMatch ? catalogMatch.effectType : ''),
      posNeg: item.posNeg || (catalogMatch ? catalogMatch.posNeg : 'negative'),
      description: resolvedDesc,
      comments: resolvedComments
    } : {
      resourceId: item.id,
      name: item.name,
      amount: amountStr,
      iconImg: item.iconImg || '',
      icon: item.icon || '📦'
    };
    if (itemIdx !== null && node.inactionThreat.penalties[itemIdx] !== undefined) {
      node.inactionThreat.penalties[itemIdx] = penaltyObj;
    } else {
      node.inactionThreat.penalties.push(penaltyObj);
    }
  } else {
    const act = (node.actions || [])[actionIdx];
    if (!act) return;

    if (type === 'requirement') {
      if (!act.requirements) act.requirements = [];
      const numAmount = parseInt(amountStr) || 1;
      const newItem = { resourceId: item.id, name: item.name, amount: numAmount, iconImg: item.iconImg || '', icon: item.icon || '📦' };
      act.requirements.push({
        id: `clause_${Date.now()}`,
        isReplaceable: false,
        items: [newItem]
      });
    } else if (type === 'requirement_alternative') {
      const clause = act.requirements[clauseIdx];
      if (clause) {
        if (!clause.items) clause.items = [];
        const numAmount = parseInt(amountStr) || 1;
        clause.items.push({ resourceId: item.id, name: item.name, amount: numAmount, iconImg: item.iconImg || '', icon: item.icon || '📦' });
        clause.isReplaceable = true;
      }
    } else if (type === 'requirement_edit') {
      const clause = act.requirements[clauseIdx];
      if (clause && clause.items && clause.items[itemIdx]) {
        const numAmount = parseInt(amountStr) || 1;
        clause.items[itemIdx] = { resourceId: item.id, name: item.name, amount: numAmount, iconImg: item.iconImg || '', icon: item.icon || '📦' };
      }
    } else if (type === 'reward') {
      if (!act.rewards) act.rewards = [];
      const rewardObj = isStatusEffect ? {
        resourceId: item.id,
        name: resolvedName,
        rawName: item.name,
        amount: hasN ? finalAmount : '',
        hasN: hasN,
        nValue: hasN ? finalAmount : '',
        hasSpecies: hasSpecies,
        species: hasSpecies ? curSpecies : '',
        iconImg: item.iconImg || (catalogMatch ? catalogMatch.iconImg : '') || '',
        icon: item.icon || (catalogMatch ? catalogMatch.icon : '✨') || '✨',
        isStatusEffect: true,
        kind: 'status_effect',
        category: 'Status Effect',
        effectCategory: item.category || (catalogMatch ? catalogMatch.category : ''),
        target: resolvedTarget,
        effect: resolvedEffect,
        effectType: item.effectType || (catalogMatch ? catalogMatch.effectType : ''),
        posNeg: item.posNeg || (catalogMatch ? catalogMatch.posNeg : 'positive'),
        description: resolvedDesc,
        comments: resolvedComments
      } : {
        resourceId: item.id,
        name: item.name,
        amount: amountStr, // supports range string e.g. "20-30" or "5"
        iconImg: item.iconImg || '',
        icon: item.icon || '📦'
      };
      if (itemIdx !== null && act.rewards[itemIdx] !== undefined) {
        act.rewards[itemIdx] = rewardObj;
      } else {
        act.rewards.push(rewardObj);
      }
    }
  }

  saveProjectToLocalStorage();
  closeModal('modal-resource-picker');
  renderApp();
  showToast(
    isStatusEffect 
      ? (type === 'inaction_penalty' ? `Added Inaction Penalty: "${resolvedName}"` : `Added Status Effect: "${resolvedName}"`)
      : (type === 'reward' ? `Reward '${item.name} (${amountStr})' added` : "Resource added"), 
    "success"
  );
}

function removeInactionPenalty(nodeId, penaltyIdx) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("remove penalty")) return;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (node && node.inactionThreat && node.inactionThreat.penalties) {
    pushUndoState();
    node.inactionThreat.penalties.splice(penaltyIdx, 1);
    saveProjectToLocalStorage();
    renderApp();
    showToast("Penalty removed", "info");
  }
}

function removeRewardItem(nodeId, actionIdx, rwIdx) {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("remove reward")) return;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (node && node.actions && node.actions[actionIdx] && node.actions[actionIdx].rewards) {
    pushUndoState();
    node.actions[actionIdx].rewards.splice(rwIdx, 1);
    saveProjectToLocalStorage();
    renderApp();
    showToast("Reward removed", "info");
  }
}

// Dialogue Characters Cast Meta Manager — Global Pool + Per-Variation Dropdown Enable/Disable + Deletion
function getCharacterDialogueUsageCount(charObj) {
  if (!charObj || !appData || !Array.isArray(appData.dialogues)) return 0;
  let count = 0;
  appData.dialogues.forEach(d => {
    (d.lines || []).forEach(l => {
      if (l.speakerId === charObj.id || (l.speakerName && charObj.name && l.speakerName.toLowerCase() === charObj.name.toLowerCase())) {
        count++;
      }
    });
  });
  return count;
}

function renderCharactersManager() {
  const grid = document.getElementById('characters-list-grid');
  if (!grid) return;
  grid.innerHTML = '';

  sanitizeAndNormalizeCharacters();
  const allChars = getGlobalCharactersPool();
  const currentVar = (appData.variations || []).find(v => v.id === activeVariationId) || { id: activeVariationId, name: 'Variation 1', number: 1 };

  // Remove any legacy #char-assign-section if present
  const oldAssignSection = document.getElementById('char-assign-section');
  if (oldAssignSection) oldAssignSection.remove();

  // Count enabled in active variation
  const enabledCount = allChars.filter(c => isCharacterEnabledInVariation(c, activeVariationId)).length;

  // Render Variation Control Bar
  const varBar = document.getElementById('characters-variation-bar');
  if (varBar) {
    varBar.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap">
        <span class="px-2.5 py-1 rounded-md bg-amber-950/80 border border-amber-700/70 text-amber-300 font-bold text-xs">
          Active Variation: V${currentVar.number} — ${currentVar.name}
        </span>
        <span class="text-xs text-gray-300">
          <strong class="text-emerald-400">${enabledCount}</strong> of <strong>${allChars.length}</strong> global characters enabled in V${currentVar.number} dropdowns
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <button type="button" onclick="setAllCharactersInActiveVariation(true)" class="text-[11px] bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/70 font-bold px-2.5 py-1 rounded transition">
          ✓ Enable All in V${currentVar.number}
        </button>
        <button type="button" onclick="setAllCharactersInActiveVariation(false)" class="text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-bold px-2.5 py-1 rounded transition">
          Disable All in V${currentVar.number}
        </button>
      </div>
    `;
  }

  allChars.forEach((c, idx) => {
    const isEnabled = isCharacterEnabledInVariation(c, activeVariationId);
    const usageCount = getCharacterDialogueUsageCount(c);
    const card = document.createElement('div');
    card.className = `p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition shadow-md ${
      isEnabled
        ? 'bg-gray-950 border border-purple-800/70'
        : 'bg-gray-950/60 border border-gray-800 opacity-75'
    }`;

    const safeName = (c.name || '').replace(/"/g, '&quot;');
    const safeRole = (c.role || '').replace(/"/g, '&quot;');
    const safeIcon = (c.icon || '👤').replace(/"/g, '&quot;');

    card.innerHTML = `
      <div class="flex items-center gap-2.5 flex-1 min-w-0">
        <!-- Enable / Disable Toggle for Active Variation -->
        <button type="button"
                onclick="toggleCharacterInActiveVariation('${c.id}')"
                class="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition flex items-center gap-1.5 ${
                  isEnabled
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/80 hover:bg-emerald-900/80'
                    : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-gray-200'
                }"
                title="${isEnabled ? `Enabled in V${currentVar.number} dropdown menus (click to disable)` : `Disabled in V${currentVar.number} dropdown menus (click to enable)`}">
          <span class="w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-400' : 'bg-gray-500'}"></span>
          <span>${isEnabled ? `In V${currentVar.number}` : `Off in V${currentVar.number}`}</span>
        </button>

        <!-- Preview Badge -->
        <span class="text-xl px-2.5 py-1 rounded-lg border border-white/20 shrink-0 font-bold flex items-center gap-1"
              style="background-color:${c.color || '#e5e7eb'}; color:${c.textColor || '#1f2937'}"
              title="Speaker Banner Preview">
          ${safeIcon}
        </span>

        <!-- Name & Role Inputs -->
        <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
          <div>
            <label class="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Name</label>
            <input type="text"
                   class="char-input font-bold text-white text-xs bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 w-full focus:outline-none focus:border-purple-400"
                   value="${safeName}"
                   onchange="updateCharacterField(${idx}, 'name', this.value)"
                   placeholder="Character Name">
          </div>
          <div>
            <label class="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Role / Title</label>
            <input type="text"
                   class="char-input text-purple-200 text-xs bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 w-full focus:outline-none focus:border-purple-400"
                   value="${safeRole}"
                   onchange="updateCharacterField(${idx}, 'role', this.value)"
                   placeholder="Officer / Role">
          </div>
        </div>
      </div>

      <!-- Right Controls: Icon, Banner Color, Text Color, Usage Badge, Delete -->
      <div class="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-800/80">
        <div class="flex items-center gap-1.5">
          <input type="text"
                 class="char-input w-9 text-center text-sm font-bold text-white bg-gray-900 border border-gray-700 rounded py-1 focus:outline-none focus:border-purple-400"
                 value="${safeIcon}"
                 onchange="updateCharacterField(${idx}, 'icon', this.value)"
                 title="Icon Emoji">
          <input type="color"
                 class="w-7 h-7 rounded cursor-pointer border border-gray-700 bg-gray-900 p-0.5"
                 value="${c.color || '#e5e7eb'}"
                 onchange="updateCharacterField(${idx}, 'color', this.value)"
                 title="Banner Background Color">
          <input type="color"
                 class="w-7 h-7 rounded cursor-pointer border border-gray-700 bg-gray-900 p-0.5"
                 value="${c.textColor || '#1f2937'}"
                 onchange="updateCharacterField(${idx}, 'textColor', this.value)"
                 title="Banner Text Color">
        </div>

        <span class="text-[10px] font-mono px-2 py-1 rounded bg-gray-900 border border-gray-800 text-gray-400" title="Number of dialogue lines using this character">
          💬 ${usageCount}
        </span>

        <button type="button"
                onclick="deleteCharacterById('${c.id}')"
                class="text-xs text-red-400 hover:text-red-200 font-bold px-2.5 py-1.5 rounded-lg bg-red-950/50 border border-red-800/70 hover:bg-red-900/70 transition flex items-center gap-1"
                title="Permanently delete character from Global Pool">
          🗑 Delete
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  if (allChars.length === 0) {
    const emptyNotice = document.createElement('div');
    emptyNotice.className = 'p-6 text-center text-gray-400 italic bg-gray-950 rounded-xl border border-gray-800 col-span-full';
    emptyNotice.innerHTML = `No characters in the Global Pool yet. Use the form above to add a character.`;
    grid.appendChild(emptyNotice);
  }

  openModal('modal-characters');
}

function toggleCharacterInActiveVariation(charId) {
  if (!requireAuthToEdit("toggle character variation availability")) return;
  pushUndoState();
  const c = (appData.characters || []).find(ch => ch.id === charId);
  if (!c) return;
  if (!Array.isArray(c.disabledVariationIds)) {
    c.disabledVariationIds = [];
  }
  const currentlyEnabled = isCharacterEnabledInVariation(c, activeVariationId);
  if (currentlyEnabled) {
    if (!c.disabledVariationIds.includes(activeVariationId)) {
      c.disabledVariationIds.push(activeVariationId);
    }
  } else {
    c.disabledVariationIds = c.disabledVariationIds.filter(id => id !== activeVariationId);
  }
  saveProjectToLocalStorage();
  renderCharactersManager();
  renderApp();
  showToast(currentlyEnabled ? `Disabled "${c.name}" in dropdowns for this variation` : `Enabled "${c.name}" in dropdowns for this variation`, "info");
}

function setAllCharactersInActiveVariation(enableAll) {
  if (!requireAuthToEdit("change character variation availability")) return;
  pushUndoState();
  (appData.characters || []).forEach(c => {
    if (!Array.isArray(c.disabledVariationIds)) c.disabledVariationIds = [];
    if (enableAll) {
      c.disabledVariationIds = c.disabledVariationIds.filter(id => id !== activeVariationId);
    } else {
      if (!c.disabledVariationIds.includes(activeVariationId)) {
        c.disabledVariationIds.push(activeVariationId);
      }
    }
  });
  saveProjectToLocalStorage();
  renderCharactersManager();
  renderApp();
  showToast(enableAll ? "All characters enabled for this variation" : "All characters disabled for this variation", "info");
}

function createCharacterFromModalForm() {
  if (!requireAuthToEdit("add characters")) return;
  const nameInput = document.getElementById('new-char-name-input');
  const roleInput = document.getElementById('new-char-role-input');
  const iconInput = document.getElementById('new-char-icon-input');
  const colorInput = document.getElementById('new-char-color-input');
  const textColorInput = document.getElementById('new-char-textcolor-input');

  const rawName = nameInput ? nameInput.value.trim() : '';
  if (!rawName) {
    showToast("Please enter a Character Name first", "warning");
    if (nameInput) nameInput.focus();
    return;
  }

  // Prevent duplicate character names
  const existing = (appData.characters || []).find(c => (c.name || '').trim().toLowerCase() === rawName.toLowerCase());
  if (existing) {
    showToast(`Character "${existing.name}" already exists in the Global Pool`, "warning");
    return;
  }

  pushUndoState();
  const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 24) || 'char';
  const uniqueId = (appData.characters || []).some(c => c.id === slug) ? `${slug}_${Date.now().toString().slice(-4)}` : slug;

  const newChar = {
    id: uniqueId,
    name: rawName,
    role: (roleInput && roleInput.value.trim()) ? roleInput.value.trim() : 'Officer',
    icon: (iconInput && iconInput.value.trim()) ? iconInput.value.trim() : '👤',
    color: (colorInput && colorInput.value) ? colorInput.value : '#e0f2fe',
    textColor: (textColorInput && textColorInput.value) ? textColorInput.value : '#0369a1',
    disabledVariationIds: []
  };

  if (!appData.characters) appData.characters = [];
  appData.characters.push(newChar);

  if (nameInput) nameInput.value = '';
  if (roleInput) roleInput.value = '';

  saveProjectToLocalStorage();
  renderCharactersManager();
  renderApp();
  showToast(`Added "${newChar.name}" to Global Pool`, "success");
}

function updateCharacterField(idx, field, value) {
  if (!requireAuthToEdit("edit characters")) return;
  if (appData.characters && appData.characters[idx]) {
    const charObj = appData.characters[idx];
    if (field === 'name') {
      const trimmed = (value || '').trim();
      if (!trimmed) {
        showToast("Character name cannot be empty. Use Delete to remove a character.", "warning");
        renderCharactersManager();
        return;
      }
      value = trimmed;
      // Also update speakerName on dialogue lines referencing this character ID
      const oldName = charObj.name;
      (appData.dialogues || []).forEach(d => {
        (d.lines || []).forEach(l => {
          if (l.speakerId === charObj.id || (oldName && l.speakerName === oldName)) {
            l.speakerId = charObj.id;
            l.speakerName = trimmed;
          }
        });
      });
    }
    pushUndoState();
    charObj[field] = value;
    saveProjectToLocalStorage();
    renderCharactersManager();
    renderApp();
  }
}

function addNewCharacter() {
  createCharacterFromModalForm();
}

function deleteCharacterById(charId) {
  if (!requireAuthToEdit("delete characters")) return;
  if (!appData.characters) return;
  if (appData.characters.length <= 1) {
    showToast("Cannot delete the last remaining character in the Global Pool", "warning");
    return;
  }
  const idx = appData.characters.findIndex(c => c.id === charId);
  if (idx === -1) return;
  const targetChar = appData.characters[idx];
  const usageCount = getCharacterDialogueUsageCount(targetChar);

  if (usageCount > 0) {
    const ok = confirm(`"${targetChar.name}" is currently used in ${usageCount} dialogue line(s).\n\nDelete "${targetChar.name}" from the Global Pool anyway?`);
    if (!ok) return;
  }

  pushUndoState();
  appData.characters.splice(idx, 1);
  saveProjectToLocalStorage();
  renderCharactersManager();
  renderApp();
  showToast(`Deleted "${targetChar.name}" from Global Pool`, "info");
}

function deleteCharacter(idx) {
  if (appData.characters && appData.characters[idx]) {
    deleteCharacterById(appData.characters[idx].id);
  }
}


function renderTimelinesManager() {
  const container = document.getElementById('timelines-list-container');
  if (!container) return;
  container.innerHTML = '';

  const timelines = [...(appData.timelines || [])].sort((a, b) => Number(a.number || 1) - Number(b.number || 1));
  const variations = appData.variations || [];

  timelines.forEach(tl => {
    const tlSection = document.createElement('div');
    tlSection.className = 'bg-cyan-950/30 border border-cyan-800/60 p-4 rounded-xl space-y-3';

    const tlVars = variations
      .filter(v => v.timelineId === tl.id)
      .sort((a, b) => Number(a.number || 0) - Number(b.number || 0));

    const safeTlName = (tl.name || '').replace(/"/g, '&quot;');
    const safeTlDesc = (tl.description || '').replace(/"/g, '&quot;');

    const varListHTML = tlVars.map((v, vIdx) => {
      const isFirst = vIdx === 0;
      const isLast = vIdx === tlVars.length - 1;
      const isActive = v.id === activeVariationId;
      const safeVarName = (v.name || '').replace(/"/g, '&quot;');
      const safeVarDesc = (v.description || '').replace(/"/g, '&quot;');

      return `
        <div class="bg-gray-950 border ${isActive ? 'border-amber-500/80 ring-1 ring-amber-500/30' : 'border-gray-800'} p-2.5 sm:p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition">
          <div class="flex items-center gap-2.5 flex-1 min-w-0">
            <!-- Reorder Variation Up / Down Buttons -->
            <div class="flex flex-col gap-0.5 shrink-0">
              <button type="button"
                      onclick="moveVariationOrder('${v.id}', -1)"
                      ${isFirst ? 'disabled' : ''}
                      class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gray-900 border border-gray-700 text-cyan-300 hover:bg-cyan-900/60 hover:border-cyan-600 transition ${isFirst ? 'opacity-25 cursor-not-allowed' : 'active:scale-95'}"
                      title="Move variation up (to V${v.number - 1})">
                ▲
              </button>
              <button type="button"
                      onclick="moveVariationOrder('${v.id}', 1)"
                      ${isLast ? 'disabled' : ''}
                      class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gray-900 border border-gray-700 text-cyan-300 hover:bg-cyan-900/60 hover:border-cyan-600 transition ${isLast ? 'opacity-25 cursor-not-allowed' : 'active:scale-95'}"
                      title="Move variation down (to V${v.number + 1})">
                ▼
              </button>
            </div>

            <!-- Variation Number Badge -->
            <span class="font-mono font-bold text-xs ${isActive ? 'text-amber-300 bg-amber-950/80 border-amber-600' : 'text-cyan-300 bg-cyan-950 border-cyan-800'} px-2.5 py-1.5 rounded border shrink-0">
              V${v.number}
            </span>

            <!-- Editable Variation Name & Description -->
            <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
              <div>
                <label class="text-[9px] text-gray-500 uppercase font-bold tracking-wider block mb-0.5">Variation Name</label>
                <input type="text"
                       value="${safeVarName}"
                       onchange="updateVariationField('${v.id}', 'name', this.value)"
                       placeholder="Variation Name"
                       class="w-full bg-gray-900 border border-gray-700 focus:border-cyan-400 rounded px-2.5 py-1 text-xs font-bold text-white focus:outline-none">
              </div>
              <div>
                <div class="flex items-center justify-between gap-1 mb-0.5">
                  <label class="text-[9px] text-gray-500 uppercase font-bold tracking-wider block">Variation Description</label>
                  ${getSymbolCounterBadgeHTML(v.description || '', 'variationDescription', true, `var-desc-badge-${v.id}`)}
                </div>
                <input type="text"
                       value="${safeVarDesc}"
                       oninput="updateVariationDescLiveCounter('${v.id}', this)"
                       onchange="updateVariationField('${v.id}', 'description', this.value)"
                       placeholder="Variation description..."
                       class="w-full bg-gray-900 border ${isFieldTextOverLimit(v.description || '', 'variationDescription') ? 'border-red-500 bg-red-950/30 text-red-200' : 'border-gray-800 text-gray-300'} focus:border-cyan-500 rounded px-2.5 py-1 text-[11px] focus:outline-none">
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 shrink-0">
            <button type="button"
                    onclick="selectVariationFromManager('${v.id}')"
                    class="px-3 py-1.5 ${isActive ? 'bg-amber-500 hover:bg-amber-400 text-gray-950' : 'bg-cyan-600 hover:bg-cyan-500 text-white'} font-bold rounded-lg text-xs transition shadow">
              ${isActive ? '✓ Active' : 'Open Variation'}
            </button>
            <button type="button"
                    onclick="deleteVariation('${v.id}')"
                    class="px-2.5 py-1.5 bg-red-950/70 hover:bg-red-800 text-red-300 hover:text-white border border-red-800/70 font-bold rounded-lg text-xs transition shadow"
                    title="Delete Variation V${v.number}">
              🗑 Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    tlSection.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-900/60 pb-3">
        <div class="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
          <span class="font-mono font-bold bg-cyan-900/90 text-cyan-200 border border-cyan-700 px-2.5 py-1.5 rounded-lg text-xs shrink-0">
            T${tl.number}
          </span>
          <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
            <div>
              <label class="text-[9px] text-cyan-400/80 uppercase font-bold tracking-wider block mb-0.5">Timeline Name</label>
              <input type="text"
                     value="${safeTlName}"
                     onchange="updateTimelineField('${tl.id}', 'name', this.value)"
                     placeholder="Timeline Name"
                     class="w-full bg-gray-950 border border-cyan-800/80 focus:border-cyan-400 rounded px-2.5 py-1 text-xs font-bold text-cyan-200 focus:outline-none">
            </div>
            <div>
              <label class="text-[9px] text-cyan-400/80 uppercase font-bold tracking-wider block mb-0.5">Timeline Description</label>
              <input type="text"
                     value="${safeTlDesc}"
                     onchange="updateTimelineField('${tl.id}', 'description', this.value)"
                     placeholder="Timeline description..."
                     class="w-full bg-gray-950 border border-cyan-900/60 focus:border-cyan-500 rounded px-2.5 py-1 text-[11px] text-gray-300 focus:outline-none">
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button type="button" onclick="addNewVariation('${tl.id}')" class="bg-cyan-700 hover:bg-cyan-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow">
            + Add Variation to T${tl.number}
          </button>
          <button type="button" onclick="deleteTimeline('${tl.id}')" class="bg-red-900/80 hover:bg-red-700 text-red-200 hover:text-white border border-red-700/80 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow transition" title="Delete Timeline T${tl.number} and all its variations">
            🗑 Delete T${tl.number}
          </button>
        </div>
      </div>

      <div class="space-y-2">
        ${varListHTML || '<div class="text-gray-500 italic p-2">No variations in this timeline yet.</div>'}
      </div>
    `;

    container.appendChild(tlSection);
  });

  openModal('modal-timelines');
}

function updateVariationDescLiveCounter(varId, inputEl) {
  const val = inputEl ? inputEl.value : '';
  const limits = getSymbolLimits();
  const limit = limits.variationDescription || DEFAULT_SYMBOL_LIMITS.variationDescription;
  const len = String(val || '').length;
  const isOver = len > limit;
  const badge = document.getElementById(`var-desc-badge-${varId}`);
  if (badge) {
    badge.textContent = `${len}/${limit}`;
    badge.classList.toggle('is-over-limit', isOver);
  }
  if (inputEl) {
    if (isOver) {
      inputEl.classList.remove('border-gray-800', 'text-gray-300');
      inputEl.classList.add('border-red-500', 'bg-red-950/30', 'text-red-200');
    } else {
      inputEl.classList.remove('border-red-500', 'bg-red-950/30', 'text-red-200');
      inputEl.classList.add('border-gray-800', 'text-gray-300');
    }
  }
}
window.updateVariationDescLiveCounter = updateVariationDescLiveCounter;

function updateTimelineField(tlId, field, value) {
  if (!requireAuthToEdit("edit timeline details")) return;
  const tl = (appData.timelines || []).find(t => t.id === tlId);
  if (!tl) return;
  const trimmed = (value || '').trim();
  if (field === 'name' && !trimmed) {
    showToast("Timeline name cannot be empty", "warning");
    renderTimelinesManager();
    return;
  }
  pushUndoState();
  tl[field] = field === 'name' ? trimmed : value;
  saveProjectToLocalStorage();
  renderTimelinesManager();
  renderApp();
  showToast(field === 'name' ? `Renamed Timeline T${tl.number} to "${tl.name}"` : `Updated Timeline T${tl.number} description`, "success");
}

function updateVariationField(varId, field, value) {
  if (!requireAuthToEdit("edit variation details")) return;
  const v = (appData.variations || []).find(x => x.id === varId);
  if (!v) return;
  const trimmed = (value || '').trim();
  if (field === 'name' && !trimmed) {
    showToast("Variation name cannot be empty", "warning");
    renderTimelinesManager();
    return;
  }
  pushUndoState();
  v[field] = field === 'name' ? trimmed : value;
  if (field === 'name') {
    (appData.nodes || []).forEach(n => {
      if ((n.category || 'KeyChain') === 'KeyChain' && n.variationId === varId) {
        n.name = v.name;
        n.title = v.name;
      }
    });
  }
  saveProjectToLocalStorage();
  renderTimelinesManager();
  renderApp();
  showToast(field === 'name' ? `Renamed V${v.number} to "${v.name}"` : `Updated V${v.number} description`, "success");
}

function moveVariationOrder(varId, direction) {
  if (!requireAuthToEdit("reorder variations")) return;
  if (!appData.variations) return;
  const targetVar = appData.variations.find(v => v.id === varId);
  if (!targetVar) return;

  const tlId = targetVar.timelineId;
  const tlVars = appData.variations
    .filter(v => v.timelineId === tlId)
    .sort((a, b) => Number(a.number || 0) - Number(b.number || 0));

  const currentIdx = tlVars.findIndex(v => v.id === varId);
  const swapIdx = currentIdx + direction;
  if (currentIdx === -1 || swapIdx < 0 || swapIdx >= tlVars.length) return;

  pushUndoState();

  // Swap positions in the timeline's variation list
  const temp = tlVars[currentIdx];
  tlVars[currentIdx] = tlVars[swapIdx];
  tlVars[swapIdx] = temp;

  // Re-number sequentially 1..N within this timeline
  tlVars.forEach((v, idx) => {
    v.number = idx + 1;
  });

  // Update structured event codenames (T{tl}-V{num}-{K|S}{stage}{letter}) if any events belong to the moved variations
  const swappedIds = new Set([tlVars[currentIdx].id, tlVars[swapIdx].id]);
  const newNumById = {};
  tlVars.forEach(v => { newNumById[v.id] = v.number; });

  (appData.nodes || []).forEach(node => {
    if (node && node.variationId && swappedIds.has(node.variationId) && node.codename) {
      const parsed = parseStructuredCodename(node.codename);
      if (parsed && parsed.isStructured) {
        const oldCodename = node.codename;
        const newCodename = buildStructuredCodename(parsed.timeline, newNumById[node.variationId], parsed.type, parsed.stage, parsed.letter);
        if (oldCodename !== newCodename) {
          node.codename = newCodename;
          if (typeof updateDialogueConditionsForRenamedCodename === 'function') {
            updateDialogueConditionsForRenamedCodename(node.id, oldCodename, newCodename);
          }
        }
      }
    }
  });

  // Keep appData.variations sorted cleanly by timeline number then variation number
  const timelines = appData.timelines || [];
  appData.variations.sort((a, b) => {
    const tlA = timelines.find(tl => tl.id === a.timelineId);
    const tlB = timelines.find(tl => tl.id === b.timelineId);
    const numTlA = tlA ? Number(tlA.number || 1) : 999;
    const numTlB = tlB ? Number(tlB.number || 1) : 999;
    if (numTlA !== numTlB) return numTlA - numTlB;
    return Number(a.number || 0) - Number(b.number || 0);
  });

  saveProjectToLocalStorage();
  renderTimelinesManager();
  renderApp();
  showToast(`Moved "${targetVar.name}" to V${targetVar.number}`, "info");
}

async function addNewTimeline() {
  const isAuth = (typeof isLocalEnvironment === 'function' && isLocalEnvironment()) ||
                 (currentUser && currentUser.status === 'approved' && currentUser.canEdit !== false);
  if (!isAuth) {
    showToast("🔒 Please sign in with an approved editor account to create timelines.", "warning");
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }
  const num = (appData.timelines || []).length + 1;
  const name = prompt("Enter New Timeline Name:", `Timeline ${num}: Multiverse Branch`);
  if (!name) return;

  pushUndoState();
  const newTl = {
    id: `timeline_${num}`,
    number: num,
    name: name.trim(),
    description: "New parallel timeline hypercell reality branch."
  };

  if (!appData.timelines) appData.timelines = [];
  appData.timelines.push(newTl);

  if (!appData.variations) appData.variations = [];
  const newVariations = [];
  for (let v = 1; v <= 10; v++) {
    newVariations.push({
      id: `var_t${num}_v${v}`,
      timelineId: newTl.id,
      number: v,
      name: `${newTl.name} - Variation ${v}`,
      description: `Variation ${v} for ${newTl.name}`
    });
  }

  appData.variations.push(...newVariations);
  activeTimelineId = newTl.id;
  activeVariationId = newVariations[0].id;

  saveProjectToLocalStorage();
  try {
    await fetch('/api/save-timelines', {
      method: 'POST',
      headers: (typeof getAuthHeaders === 'function') ? getAuthHeaders(true) : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timelines: appData.timelines, variations: appData.variations })
    });
  } catch (e) {
    console.warn("Could not sync new timeline to server:", e);
  }
  renderTimelinesManager();
  renderApp();
  showToast(`Timeline ${num} created with 10 variations (V1 to V10)`, "success");
}

function selectVariationFromManager(varId) {
  const v = appData.variations.find(v => v.id === varId);
  if (v) {
    activeVariationId = v.id;
    activeTimelineId = v.timelineId;
  }
  closeModal('modal-timelines');
  renderApp();
}

function addNewVariation(targetTimelineId) {
  const isAuth = (typeof isLocalEnvironment === 'function' && isLocalEnvironment()) ||
                 (currentUser && currentUser.status === 'approved' && currentUser.canEdit !== false);
  if (!isAuth) {
    showToast("🔒 Please sign in with an approved editor account to create variations.", "warning");
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }
  const tlId = targetTimelineId || activeTimelineId;
  const tl = (appData.timelines || []).find(t => t.id === tlId);
  const existingInTl = (appData.variations || []).filter(v => v.timelineId === tlId);
  const nextNum = existingInTl.length + 1;
  const tlName = tl ? tl.name : `Timeline`;
  const name = prompt("Enter Variation Name:", `Variation ${nextNum}`);
  if (!name) return;

  pushUndoState();
  const newVar = {
    id: `var_${tlId}_v${nextNum}_${Date.now()}`,
    timelineId: tlId,
    number: nextNum,
    name: name.trim(),
    description: `Variation ${nextNum} for ${tlName}`
  };

  appData.variations.push(newVar);
  activeTimelineId = tlId;
  activeVariationId = newVar.id;
  saveProjectToLocalStorage();
  fetch('/api/save-timelines', {
    method: 'POST',
    headers: (typeof getAuthHeaders === 'function') ? getAuthHeaders(true) : { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timelines: appData.timelines, variations: appData.variations })
  }).catch(e => console.warn("Could not sync new variation:", e));
  renderTimelinesManager();
  renderApp();
  showToast(`Added V${nextNum} to ${tlName}`, "success");
}

function deleteVariation(varId) {
  const isAuth = (typeof isLocalEnvironment === 'function' && isLocalEnvironment()) ||
                 (currentUser && currentUser.status === 'approved' && currentUser.canEdit !== false);
  if (!isAuth) {
    showToast("🔒 Please sign in with an approved editor account to delete variations.", "warning");
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }
  const targetVar = (appData.variations || []).find(v => v.id === varId);
  if (!targetVar) return;

  const tlId = targetVar.timelineId;
  const tl = (appData.timelines || []).find(t => t.id === tlId);
  const tlVars = (appData.variations || []).filter(v => v.timelineId === tlId);
  if (tlVars.length <= 1) {
    showToast("Cannot delete the last variation in a timeline. Delete the timeline instead if needed.", "warning");
    return;
  }

  const isPoolCat = (cat) => cat === 'GenericPool' || cat === 'DeckPool' || cat === 'SpeciesPool';
  const varNodes = (appData.nodes || []).filter(n => n && n.variationId === varId && !isPoolCat(n.category));
  const varNodeIds = new Set(varNodes.map(n => n.id));
  const varDialogues = (appData.dialogues || []).filter(d => {
    if (!d) return false;
    if (d.variationId === varId && !isPoolCat(d.category)) return true;
    const links = Array.isArray(d.links) && d.links.length > 0
      ? d.links
      : (d.targetEventId ? [{ targetEventId: d.targetEventId }] : []);
    if (links.length > 0 && links.every(l => l && varNodeIds.has(l.targetEventId))) return true;
    return false;
  });

  const tlLabel = tl ? `T${tl.number} (${tl.name})` : tlId;
  const confirmMsg = `Delete Variation V${targetVar.number}: "${targetVar.name}" from ${tlLabel}?\n\n` +
    (varNodes.length > 0 || varDialogues.length > 0
      ? `WARNING: This will also delete ${varNodes.length} event(s) and ${varDialogues.length} dialogue(s) belonging to this variation.`
      : `This variation currently has 0 events and 0 dialogues.`);
  if (!confirm(confirmMsg)) return;

  pushUndoState();

  // Remove variation
  appData.variations = (appData.variations || []).filter(v => v.id !== varId);

  // Remove non-pool events in this variation and clean up pool disabledVariationIds
  appData.nodes = (appData.nodes || []).filter(n => {
    if (!n) return false;
    if (n.variationId === varId && !isPoolCat(n.category)) return false;
    if (Array.isArray(n.disabledVariationIds)) {
      n.disabledVariationIds = n.disabledVariationIds.filter(id => id !== varId);
    }
    return true;
  });

  // Remove dialogues in this variation or clean up links pointing to deleted nodes
  appData.dialogues = (appData.dialogues || []).filter(d => {
    if (!d) return false;
    if (d.variationId === varId && !isPoolCat(d.category)) return false;
    if (Array.isArray(d.links) && d.links.length > 0) {
      d.links = d.links.filter(l => !l || !varNodeIds.has(l.targetEventId));
      if (d.links.length === 0 && d.targetEventId && varNodeIds.has(d.targetEventId)) return false;
      if (d.links.length > 0) d.targetEventId = d.links[0].targetEventId;
    } else if (d.targetEventId && varNodeIds.has(d.targetEventId)) {
      return false;
    }
    return true;
  });

  // Re-number remaining variations in this timeline 1..N and update structured event codenames
  const remainingTlVars = (appData.variations || [])
    .filter(v => v.timelineId === tlId)
    .sort((a, b) => Number(a.number || 0) - Number(b.number || 0));

  const newNumById = {};
  remainingTlVars.forEach((v, idx) => {
    v.number = idx + 1;
    newNumById[v.id] = v.number;
  });

  (appData.nodes || []).forEach(node => {
    if (node && node.variationId && newNumById[node.variationId] && node.codename) {
      const parsed = parseStructuredCodename(node.codename);
      if (parsed && parsed.isStructured) {
        const oldCodename = node.codename;
        const newCodename = buildStructuredCodename(parsed.timeline, newNumById[node.variationId], parsed.type, parsed.stage, parsed.letter);
        if (oldCodename !== newCodename) {
          node.codename = newCodename;
          if (typeof updateDialogueConditionsForRenamedCodename === 'function') {
            updateDialogueConditionsForRenamedCodename(node.id, oldCodename, newCodename);
          }
        }
      }
    }
  });

  if (activeVariationId === varId) {
    const fallbackVar = remainingTlVars[0] || (appData.variations || [])[0];
    if (fallbackVar) {
      activeVariationId = fallbackVar.id;
      activeTimelineId = fallbackVar.timelineId;
    }
  }

  saveProjectToLocalStorage();
  fetch('/api/save-timelines', {
    method: 'POST',
    headers: (typeof getAuthHeaders === 'function') ? getAuthHeaders(true) : { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timelines: appData.timelines, variations: appData.variations })
  }).catch(e => console.warn("Could not sync variation deletion:", e));
  renderTimelinesManager();
  renderApp();
  showToast(`Deleted Variation "${targetVar.name}"`, "info");
}
window.deleteVariation = deleteVariation;

async function deleteTimeline(tlId) {
  const isAuth = (typeof isLocalEnvironment === 'function' && isLocalEnvironment()) ||
                 (currentUser && currentUser.status === 'approved' && currentUser.canEdit !== false);
  if (!isAuth) {
    showToast("🔒 Please sign in with an approved editor account to delete timelines.", "warning");
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }
  const timelines = appData.timelines || [];
  const targetTl = timelines.find(t => t.id === tlId);
  if (!targetTl) return;

  if (timelines.length <= 1) {
    showToast("Cannot delete the only remaining timeline.", "warning");
    return;
  }

  const tlVars = (appData.variations || []).filter(v => v.timelineId === tlId);
  const tlVarIds = new Set(tlVars.map(v => v.id));
  const isPoolCat = (cat) => cat === 'GenericPool' || cat === 'DeckPool' || cat === 'SpeciesPool';

  const tlNodes = (appData.nodes || []).filter(n => n && tlVarIds.has(n.variationId) && !isPoolCat(n.category));
  const tlNodeIds = new Set(tlNodes.map(n => n.id));
  const tlDialogues = (appData.dialogues || []).filter(d => {
    if (!d) return false;
    if (tlVarIds.has(d.variationId) && !isPoolCat(d.category)) return true;
    const links = Array.isArray(d.links) && d.links.length > 0
      ? d.links
      : (d.targetEventId ? [{ targetEventId: d.targetEventId }] : []);
    if (links.length > 0 && links.every(l => l && tlNodeIds.has(l.targetEventId))) return true;
    return false;
  });

  const confirmMsg = `Delete Timeline T${targetTl.number}: "${targetTl.name}" and all ${tlVars.length} of its variations?\n\n` +
    (tlNodes.length > 0 || tlDialogues.length > 0
      ? `WARNING: This will permanently delete ${tlNodes.length} event(s) and ${tlDialogues.length} dialogue(s) belonging to this timeline.`
      : `This timeline currently has 0 events and 0 dialogues.`);
  if (!confirm(confirmMsg)) return;

  pushUndoState();

  // Remove timeline and its variations in local memory
  appData.timelines = (appData.timelines || []).filter(t => t.id !== tlId);
  appData.variations = (appData.variations || []).filter(v => v.timelineId !== tlId);

  // Remove non-pool events in this timeline and clean up pool disabledVariationIds
  appData.nodes = (appData.nodes || []).filter(n => {
    if (!n) return false;
    if (tlVarIds.has(n.variationId) && !isPoolCat(n.category)) return false;
    if (Array.isArray(n.disabledVariationIds)) {
      n.disabledVariationIds = n.disabledVariationIds.filter(id => !tlVarIds.has(id));
    }
    return true;
  });

  // Remove dialogues in this timeline or clean up links pointing to deleted nodes
  appData.dialogues = (appData.dialogues || []).filter(d => {
    if (!d) return false;
    if (tlVarIds.has(d.variationId) && !isPoolCat(d.category)) return false;
    if (Array.isArray(d.links) && d.links.length > 0) {
      d.links = d.links.filter(l => !l || !tlNodeIds.has(l.targetEventId));
      if (d.links.length === 0 && d.targetEventId && tlNodeIds.has(d.targetEventId)) return false;
      if (d.links.length > 0) d.targetEventId = d.links[0].targetEventId;
    } else if (d.targetEventId && tlNodeIds.has(d.targetEventId)) {
      return false;
    }
    return true;
  });

  // Re-number remaining timelines 1..M and update structured event codenames if timeline numbers shifted
  const remainingTimelines = (appData.timelines || []).sort((a, b) => Number(a.number || 1) - Number(b.number || 1));
  const newTlNumById = {};
  remainingTimelines.forEach((t, idx) => {
    t.number = idx + 1;
    newTlNumById[t.id] = t.number;
  });

  const varToTlNum = {};
  (appData.variations || []).forEach(v => {
    if (newTlNumById[v.timelineId]) {
      varToTlNum[v.id] = newTlNumById[v.timelineId];
    }
  });

  (appData.nodes || []).forEach(node => {
    if (node && node.variationId && varToTlNum[node.variationId] && node.codename) {
      const parsed = parseStructuredCodename(node.codename);
      if (parsed && parsed.isStructured) {
        const oldCodename = node.codename;
        const newCodename = buildStructuredCodename(varToTlNum[node.variationId], parsed.variation, parsed.type, parsed.stage, parsed.letter);
        if (oldCodename !== newCodename) {
          node.codename = newCodename;
          if (typeof updateDialogueConditionsForRenamedCodename === 'function') {
            updateDialogueConditionsForRenamedCodename(node.id, oldCodename, newCodename);
          }
        }
      }
    }
  });

  if (activeTimelineId === tlId || tlVarIds.has(activeVariationId)) {
    const firstTl = remainingTimelines[0];
    const firstVar = (appData.variations || []).find(v => firstTl && v.timelineId === firstTl.id) || (appData.variations || [])[0];
    if (firstTl) activeTimelineId = firstTl.id;
    if (firstVar) activeVariationId = firstVar.id;
  }

  saveProjectToLocalStorage();

  // Call dedicated /api/delete-timeline server endpoint to atomically delete on server disk & GitHub
  try {
    const res = await fetch('/api/delete-timeline', {
      method: 'POST',
      headers: (typeof getAuthHeaders === 'function') ? getAuthHeaders(true) : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timelineId: tlId })
    });
    if (res.ok) {
      const resp = await res.json();
      if (resp.remainingTimelines) appData.timelines = resp.remainingTimelines;
      if (resp.remainingVariations) appData.variations = resp.remainingVariations;
    } else {
      console.warn("Server /api/delete-timeline error:", res.status);
    }
  } catch (err) {
    console.warn("Network error deleting timeline on server:", err);
  }

  renderTimelinesManager();
  renderApp();
  showToast(`Deleted Timeline "${targetTl.name}" and its ${tlVars.length} variations`, "info");
}
window.deleteTimeline = deleteTimeline;

function getActiveBoardEventBlocks() {
  const isPoolPage = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool');
  const seenIds = new Set();
  return (appData.nodes || []).filter(n => {
    if (!n || !n.id || seenIds.has(n.id)) return false;
    const cat = n.category || 'KeyChain';
    if (cat !== activeCategoryFilter) return false;
    if (!isPoolPage && n.variationId && n.variationId !== activeVariationId) return false;
    seenIds.add(n.id);
    return true;
  });
}

function getActiveBoardDialogueBlocks() {
  const isPoolPage = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool');
  const seenIds = new Set();
  return (appData.dialogues || []).filter(d => {
    if (!d || !d.id || seenIds.has(d.id)) return false;
    const links = getDialogueLinks(d);
    if (links.length > 0) {
      const hasVisibleLink = links.some(link => {
        const targetNode = (appData.nodes || []).find(n => n.id === link.targetEventId);
        if (!targetNode) return false;
        const targetCat = targetNode.category || 'KeyChain';
        if (targetCat !== activeCategoryFilter) return false;
        if (!isPoolPage && targetNode.variationId && targetNode.variationId !== activeVariationId) return false;
        return true;
      });
      if (!hasVisibleLink) return false;
      seenIds.add(d.id);
      return true;
    }
    const cat = d.category || 'KeyChain';
    if (cat !== activeCategoryFilter) return false;
    if (!isPoolPage && d.variationId && d.variationId !== activeVariationId) return false;
    seenIds.add(d.id);
    return true;
  });
}

function calculateActiveBoardSymbolStats() {
  const isPool = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool');
  const varObj = (appData.variations || []).find(v => v.id === activeVariationId);
  const vNum = varObj ? varObj.number : 1;
  const vName = varObj ? varObj.name : 'Variation';

  const activeNodes = getActiveBoardEventBlocks();
  const activeDialogues = getActiveBoardDialogueBlocks();

  let eventSymbols = 0;
  let dialogueSymbols = 0;
  let varDescSymbols = 0;
  let overLimitCount = 0;
  let underRecCount = 0;

  if (activeCategoryFilter === 'KeyChain' && varObj && varObj.description) {
    varDescSymbols = String(varObj.description).length;
    if (isFieldTextOverLimit(varObj.description, 'variationDescription')) overLimitCount++;
    if (isFieldTextUnderRecommended(varObj.description, 'variationDescription')) underRecCount++;
  }

  activeNodes.forEach(n => {
    if (!n) return;
    const introStr = String(n.eventIntro || '');
    const descStr = String(n.eventDescription || '');
    const nameStr = String(n.name || '');
    eventSymbols += nameStr.length + introStr.length + descStr.length;

    if (isFieldTextOverLimit(introStr, 'eventIntro')) overLimitCount++;
    if (isFieldTextOverLimit(descStr, 'eventDescription')) overLimitCount++;
    if (isFieldTextUnderRecommended(introStr, 'eventIntro')) underRecCount++;
    if (isFieldTextUnderRecommended(descStr, 'eventDescription')) underRecCount++;

    const choiceKey = getActionChoiceLimitKey(n);
    (n.actions || []).forEach(act => {
      if (!act) return;
      const btnStr = String(act.shortDescription || '');
      const choiceStr = String(act.description || '');
      const outStr = String(act.resultDescription || '');
      eventSymbols += btnStr.length + choiceStr.length + outStr.length;

      if (isFieldTextOverLimit(btnStr, 'actionButtonText')) overLimitCount++;
      if (isFieldTextOverLimit(choiceStr, choiceKey)) overLimitCount++;
      if (isFieldTextOverLimit(outStr, 'eventOutcome')) overLimitCount++;

      if (isFieldTextUnderRecommended(btnStr, 'actionButtonText')) underRecCount++;
      if (isFieldTextUnderRecommended(choiceStr, choiceKey)) underRecCount++;
      if (isFieldTextUnderRecommended(outStr, 'eventOutcome')) underRecCount++;
    });

    if (n.hasInactionThreat && n.inactionThreat) {
      const inactDesc = String(n.inactionThreat.description || '');
      const inactRes = String(n.inactionThreat.resultDescription || '');
      eventSymbols += inactDesc.length + inactRes.length;
      if (isFieldTextOverLimit(inactRes, 'inactionResult')) overLimitCount++;
      if (isFieldTextUnderRecommended(inactRes, 'inactionResult')) underRecCount++;
    }
  });

  activeDialogues.forEach(d => {
    if (!d) return;
    (d.lines || []).forEach(l => {
      if (l && l.text) {
        dialogueSymbols += String(l.text).length;
      }
    });
  });

  let boardTypeLabel = 'Key Chain';
  let symbolsTag = `Symbols (Key V${vNum})`;
  if (activeCategoryFilter === 'SecretChain') {
    boardTypeLabel = 'Secret Chain';
    symbolsTag = `Symbols (Secret V${vNum})`;
  } else if (activeCategoryFilter === 'GenericPool') {
    boardTypeLabel = 'Generic Pool';
    symbolsTag = `Symbols (Generic Pool)`;
  } else if (activeCategoryFilter === 'DeckPool') {
    boardTypeLabel = 'Deck Pool';
    symbolsTag = `Symbols (Deck Pool)`;
  } else if (activeCategoryFilter === 'SpeciesPool') {
    boardTypeLabel = 'Species Events';
    symbolsTag = `Symbols (Species Events)`;
  }

  return {
    category: activeCategoryFilter,
    boardTypeLabel,
    symbolsTag,
    totalSymbols: eventSymbols + dialogueSymbols + varDescSymbols,
    eventSymbols,
    dialogueSymbols,
    varDescSymbols,
    overLimitCount,
    underRecCount,
    activeEventsCount: activeNodes.length,
    activeDialoguesCount: activeDialogues.length,
    varNumber: vNum,
    varName: vName
  };
}

function updateStats() {
  const stats = calculateActiveBoardSymbolStats();
  const activeEvents = getActiveBoardEventBlocks();
  const activeDialogues = getActiveBoardDialogueBlocks();

  const evStat = document.getElementById('stat-event-count');
  if (evStat) {
    if (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool') {
      const activeInVar = activeEvents.filter(n => !isPoolNodeDimmed(n.id, activeVariationId)).length;
      const typeLabel = activeCategoryFilter === 'DeckPool' ? 'Deck Events' : (activeCategoryFilter === 'SpeciesPool' ? 'Species Events' : 'Generic Events');
      evStat.innerText = `${typeLabel}: ${activeEvents.length} (${activeInVar} active in V${stats.varNumber})`;
      evStat.title = `${typeLabel} in pool: ${activeEvents.length} total, ${activeInVar} currently active/included in V${stats.varNumber}`;
    } else {
      const typeLabel = activeCategoryFilter === 'SecretChain' ? 'Secret Events' : 'Key Events';
      evStat.innerText = `${typeLabel}: ${activeEvents.length}`;
      evStat.title = `${typeLabel} in V${stats.varNumber} (${stats.varName}): ${activeEvents.map(n => n.codename || n.id).join(', ')}`;
    }
  }

  const diagStat = document.getElementById('stat-dialogue-count');
  if (diagStat) {
    diagStat.innerText = `Dialogues: ${activeDialogues.length}`;
    diagStat.title = `Dialogue cards belonging to current board: ${activeDialogues.length}`;
  }

  const symStat = document.getElementById('stat-variation-symbols');
  if (symStat) {
    if (stats.overLimitCount > 0) {
      symStat.innerHTML = `<span class="text-red-400 font-bold">${stats.symbolsTag}: ${stats.totalSymbols.toLocaleString()} ⚠️ (${stats.overLimitCount} over limit)</span>`;
    } else {
      symStat.innerHTML = `${stats.symbolsTag}: <span class="text-white">${stats.totalSymbols.toLocaleString()}</span>`;
    }
    const underInfo = stats.underRecCount > 0 ? `\n💡 ${stats.underRecCount} field(s) below recommended length` : '';
    const overInfo = stats.overLimitCount > 0 ? `\n⚠️ ${stats.overLimitCount} field(s) exceed configured maximum limits` : '';
    symStat.title = `${stats.boardTypeLabel} Total Symbols: ${stats.totalSymbols.toLocaleString()}\n• Events (Intro, Desc, Choices, Buttons, Outcomes): ${stats.eventSymbols.toLocaleString()} symbols\n• Dialogues: ${stats.dialogueSymbols.toLocaleString()} symbols${stats.varDescSymbols > 0 ? `\n• Variation Description: ${stats.varDescSymbols.toLocaleString()} symbols` : ''}${overInfo}${underInfo}`;
  }

  const hintEl = document.getElementById('stat-footer-hint');
  if (hintEl) {
    if (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool') {
      hintEl.innerText = `5 Vertical Tier Columns (Tier I–V) • Common pool • Toggle switch bar to include/exclude in V${stats.varNumber}`;
    } else if (activeCategoryFilter === 'SecretChain') {
      hintEl.innerText = `Nodes snap to 4 Secret Stages • Secret Chain flow for V${stats.varNumber} • Click (+) / (x) to edit requirements`;
    } else {
      hintEl.innerText = `Nodes snap to 4 Horizontal Stages • Key Chain flow for V${stats.varNumber} • Click (+) / (x) to edit requirements`;
    }
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  if (id === 'modal-resource-picker' || !id) {
    if (typeof hideStatusEffectFloatingTooltip === 'function') {
      hideStatusEffectFloatingTooltip();
    }
  }
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function setupPdfImportEvents() {
  const dropzone = document.getElementById('dropzone-pdf');
  const fileInput = document.getElementById('file-input-pdf');
  const confirmBtn = document.getElementById('btn-confirm-pdf-import');
  const tabImg = document.getElementById('tab-import-image');
  const tabTxt = document.getElementById('tab-import-text');
  const btnParseScript = document.getElementById('btn-parse-script-text');

  if (tabImg) tabImg.onclick = () => switchImportTab('image');
  if (tabTxt) tabTxt.onclick = () => switchImportTab('text');

  if (btnParseScript) {
    btnParseScript.onclick = () => {
      const textInput = document.getElementById('import-script-text-input');
      const text = textInput ? textInput.value : '';
      if (!text.trim()) {
        showToast("Please enter or paste script text first", "warning");
        return;
      }
      const parsed = parseScriptTextToDialogue(text);
      renderImportPreview(parsed);
    };
  }

  if (dropzone && fileInput) {
    dropzone.onclick = () => fileInput.click();

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-indigo-400', 'bg-indigo-950/40');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-indigo-400', 'bg-indigo-950/40');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-indigo-400', 'bg-indigo-950/40');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleImportFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImportFile(e.target.files[0]);
      }
    };
  }

  if (confirmBtn) {
    confirmBtn.onclick = () => confirmImportToCanvas();
  }

  // Global Clipboard Paste Support (Ctrl+V) for Image Screenshots
  window.addEventListener('paste', (e) => {
    const activeEl = document.activeElement;
    const tag = activeEl ? activeEl.tagName.toLowerCase() : '';
    // Allow standard text pasting if actively typing in an input/textarea
    if (tag === 'textarea' || (tag === 'input' && activeEl.id !== 'file-input-pdf')) {
      return;
    }

    if (e.clipboardData && e.clipboardData.items) {
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.type && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            openModal('modal-import-pdf');
            switchImportTab('image');
            runImageOcr(blob);
            showToast("Processing pasted image from clipboard...", "info");
            return;
          }
        }
      }
    }
  });
}

function switchImportTab(tabName) {
  const tabImg = document.getElementById('tab-import-image');
  const tabTxt = document.getElementById('tab-import-text');
  const paneImg = document.getElementById('pane-import-image');
  const paneTxt = document.getElementById('pane-import-text');

  if (tabName === 'image') {
    if (tabImg) tabImg.className = 'px-3 py-1.5 rounded text-xs font-bold bg-indigo-600 text-white flex items-center gap-1.5 transition';
    if (tabTxt) tabTxt.className = 'px-3 py-1.5 rounded text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 flex items-center gap-1.5 transition';
    if (paneImg) paneImg.classList.remove('hidden');
    if (paneTxt) paneTxt.classList.add('hidden');
  } else {
    if (tabTxt) tabTxt.className = 'px-3 py-1.5 rounded text-xs font-bold bg-indigo-600 text-white flex items-center gap-1.5 transition';
    if (tabImg) tabImg.className = 'px-3 py-1.5 rounded text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 flex items-center gap-1.5 transition';
    if (paneTxt) paneTxt.classList.remove('hidden');
    if (paneImg) paneImg.classList.add('hidden');
  }
}

function handleImportFile(file) {
  if (!file) return;

  if (file.name.toLowerCase().endsWith('.json')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data && (data.nodes || data.dialogues)) {
          pushUndoState();
          appData = data;
          normalizeAllProjectData();
          saveProjectToLocalStorage();
          closeModal('modal-import-pdf');
          renderApp();
          fitWholeSchematic();
          showToast("Imported project file successfully", "success");
        }
      } catch (err) {
        alert("Failed to parse JSON project file.");
      }
    };
    reader.readAsText(file);
    return;
  }

  // Treat as Image Screenshot
  runImageOcr(file);
}

// 100% In-Browser Client-Side WebAssembly OCR Engine (Tesseract.js)
async function runImageOcr(fileOrBlob) {
  const progressContainer = document.getElementById('ocr-progress-container');
  const statusText = document.getElementById('ocr-status-text');
  const progressBar = document.getElementById('ocr-progress-bar');
  const percentText = document.getElementById('ocr-progress-percent');
  const previewSection = document.getElementById('import-preview-section');
  const previewList = document.getElementById('import-detected-list');
  const confirmBtn = document.getElementById('btn-confirm-pdf-import');

  if (progressContainer) progressContainer.classList.remove('hidden');
  if (previewSection) previewSection.classList.remove('hidden');
  if (previewList) previewList.innerHTML = `<div class="p-4 text-center text-indigo-300 font-semibold flex items-center justify-center gap-2">Scanning image with in-browser OCR...</div>`;
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    if (typeof Tesseract === 'undefined') {
      throw new Error("Tesseract.js OCR library is loading or blocked. You can still paste script text in the 'Paste Script Text' tab.");
    }

    const res = await Tesseract.recognize(
      fileOrBlob,
      'eng',
      {
        logger: m => {
          if (m.status === 'recognizing text' && m.progress !== undefined) {
            const pct = Math.round(m.progress * 100);
            if (statusText) statusText.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Recognizing dialogue text (${pct}%)...`;
            if (progressBar) progressBar.style.width = `${pct}%`;
            if (percentText) percentText.innerText = `${pct}%`;
            if (window.lucide) lucide.createIcons();
          } else if (m.status) {
            if (statusText) statusText.innerText = `OCR: ${m.status}...`;
          }
        }
      }
    );

    const extractedText = res && res.data ? res.data.text : '';
    if (progressBar) progressBar.style.width = '100%';
    if (percentText) percentText.innerText = '100%';
    if (statusText) statusText.innerText = 'OCR extraction complete! Splitting speech turns...';

    // Populate the text tab too so the user can see/edit raw text if desired
    const textInput = document.getElementById('import-script-text-input');
    if (textInput && extractedText) {
      textInput.value = extractedText;
    }

    const parsed = parseScriptTextToDialogue(extractedText);
    renderImportPreview(parsed);
  } catch (err) {
    console.error("Client OCR failed:", err);
    if (statusText) statusText.innerText = `OCR Notice: ${err.message}`;
    if (previewList) {
      previewList.innerHTML = `
        <div class="p-3 text-amber-300 text-xs bg-amber-950/40 border border-amber-800 rounded space-y-2">
          <p><strong>OCR encountered an issue:</strong> ${err.message}</p>
          <p class="text-gray-300">You can paste the script text directly into the <strong>"Paste Script Text"</strong> tab above for instant 100% accurate parsing.</p>
        </div>
      `;
    }
  }
}

// Character matching helper (fuzzy & known characters)
function findMatchingCharacter(speakerQuery) {
  if (!speakerQuery) return null;
  const q = speakerQuery.trim().toLowerCase().replace(/[:—\-\*\#_]/g, '').trim();
  if (!q) return null;

  const characters = getGlobalCharactersPool();

  // 1. Exact match by ID or full name
  let found = characters.find(c => (c.id || '').toLowerCase() === q || (c.name || '').toLowerCase() === q);
  if (found) return found;

  // 2. Starts-with or includes match (e.g. "Khalil" -> "Khalil Arida", "Voss" -> "Voss")
  found = characters.find(c => {
    const cName = (c.name || '').toLowerCase();
    const cId = (c.id || '').toLowerCase();
    return (cName && (cName.includes(q) || q.includes(cName))) || (cId && cId.includes(q));
  });
  if (found) return found;

  // 3. Match individual words (e.g. "Arida", "Demchuck", "Abbadie")
  const qWords = q.split(/\s+/).filter(w => w.length > 2);
  for (const w of qWords) {
    found = characters.find(c => (c.name || '').toLowerCase().includes(w) || (c.id || '').toLowerCase().includes(w));
    if (found) return found;
  }

  // 4. Character not registered yet - only create if cleanName is non-empty and looks like a valid name
  const cleanName = speakerQuery.replace(/[:—\-\*\#_]/g, '').trim();
  if (!cleanName || cleanName.length < 2) {
    return characters[0] || null;
  }
  const fallbackId = q.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '').substring(0, 20) || 'speaker';
  const titleName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  const newChar = {
    id: fallbackId,
    name: titleName,
    role: "Cast Member",
    color: "#f3f4f6",
    textColor: "#1f2937",
    icon: "👤",
    disabledVariationIds: []
  };

  if (!appData.characters) appData.characters = [];
  appData.characters.push(newChar);
  return newChar;
}

// Intelligent Dialogue Script Parser Engine
function parseScriptTextToDialogue(rawText) {
  if (!rawText || !rawText.trim()) return { type: 'dialogue', lines: [] };

  // Normalize line endings and cleanup OCR noise
  let cleanText = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^[\|\+\-\=]{3,}$/gm, '') // Remove ASCII table lines
    .replace(/^\|(.*)\|$/gm, '$1');   // Remove table border bars

  const lines = cleanText.split('\n');
  const parsedLines = [];
  let currentSpeaker = null;
  let currentParagraphs = [];
  let currentBuffer = [];

  function flushBufferToParagraph() {
    if (currentBuffer.length > 0) {
      const pText = currentBuffer.join(' ').replace(/\s+/g, ' ').trim();
      if (pText.length > 0) {
        currentParagraphs.push(pText);
      }
      currentBuffer = [];
    }
  }

  function flushTurn() {
    flushBufferToParagraph();
    if (currentSpeaker && currentParagraphs.length > 0) {
      currentParagraphs.forEach(text => {
        parsedLines.push({
          id: `line_${Math.random().toString(36).substring(2, 8)}`,
          speakerId: currentSpeaker.id,
          speakerName: currentSpeaker.name,
          text: text
        });
      });
    }
    currentParagraphs = [];
  }

  // Speaker Header detection: "Khalil Arida:", "Voss:", "Khalil Arida -", "**Voss:**"
  const speakerHeaderRegex = /^[*_#\s]*([A-Za-z0-9\s'\.\-]{2,30}?)[*_#\s]*[:—\-]\s*(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    // Strip leading OCR / bullet noise (e.g. "- » ", "> ", "• ", "| ")
    const cleanLine = rawLine.replace(/^[-—»>•*#_~|&+\s]+/, '').trim();
    if (!cleanLine) {
      flushBufferToParagraph();
      continue;
    }

    const headerMatch = cleanLine.match(speakerHeaderRegex);
    let matchedSpeaker = null;
    let remainder = '';

    if (headerMatch) {
      const candidateName = headerMatch[1].trim();
      const matched = findMatchingCharacter(candidateName);
      if (matched) {
        matchedSpeaker = matched;
        remainder = headerMatch[2].replace(/^[-—»>•*#_~|&+\s]+/, '').trim();
      }
    } else {
      // Check if line is JUST a known character name (e.g. table header cell "Khalil Arida" or "Voss")
      const candidate = cleanLine.replace(/[:—\-\*\#_]/g, '').trim();
      const allKnown = (appData.characters && appData.characters.length > 0) ? appData.characters : getDefaultCharactersList();
      const isKnown = allKnown.some(c => 
        c.name.toLowerCase() === candidate.toLowerCase() || c.id.toLowerCase() === candidate.toLowerCase()
      );
      if (isKnown) {
        matchedSpeaker = findMatchingCharacter(candidate);
        remainder = '';
      }
    }

    if (matchedSpeaker) {
      flushTurn();
      currentSpeaker = matchedSpeaker;
      if (remainder.length > 0) {
        currentBuffer.push(remainder);
      }
    } else {
      if (!currentSpeaker) {
        currentSpeaker = findMatchingCharacter('Voss') || { id: 'voss', name: 'Voss' };
      }
      currentBuffer.push(cleanLine);
    }
  }

  flushTurn();

  // Fallback if no structured speakers detected
  if (parsedLines.length === 0) {
    const defaultChar = findMatchingCharacter('Voss') || { id: 'voss', name: 'Voss' };
    const chunks = cleanText.split(/\n\s*\n/).map(c => c.trim()).filter(c => c.length > 0);
    chunks.forEach(chunk => {
      parsedLines.push({
        id: `line_${Math.random().toString(36).substring(2, 8)}`,
        speakerId: defaultChar.id,
        speakerName: defaultChar.name,
        text: chunk.replace(/\s+/g, ' ')
      });
    });
  }

  return {
    type: 'dialogue',
    lines: parsedLines
  };
}

// Render Interactive Dialogue Block Preview in Importer Modal
function renderImportPreview(parsedData) {
  parsedImportData = parsedData;

  const previewSection = document.getElementById('import-preview-section');
  const previewList = document.getElementById('import-detected-list');
  const countBadge = document.getElementById('import-detected-count');
  const confirmBtn = document.getElementById('btn-confirm-pdf-import');

  if (previewSection) previewSection.classList.remove('hidden');

  const lines = parsedData.lines || [];
  if (countBadge) countBadge.innerText = `${lines.length} lines detected`;
  if (confirmBtn) confirmBtn.disabled = lines.length === 0;

  if (!previewList) return;

  if (lines.length === 0) {
    previewList.innerHTML = `<div class="p-4 text-center text-gray-500 italic">No dialogue lines detected. Try pasting script text directly.</div>`;
    return;
  }

  const allChars = (appData.characters && appData.characters.length > 0) ? appData.characters : getDefaultCharactersList();

  previewList.innerHTML = lines.map((l, idx) => {
    const char = allChars.find(c => c.id === l.speakerId || c.name === l.speakerName) || {
      name: l.speakerName || 'Speaker',
      color: '#fef08a',
      textColor: '#713f12',
      icon: '👤'
    };

    return `
      <div class="py-2 px-1 flex flex-col gap-1 text-xs" data-preview-index="${idx}">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 px-2 py-0.5 rounded font-bold text-[11px] shadow-xs" 
               style="background-color: ${char.color}; color: ${char.textColor};">
            <span>${char.icon || '👤'}</span>
            <span>${char.name}</span>
          </div>
          <button type="button" class="text-gray-500 hover:text-red-400 font-bold px-1 rounded transition" 
                  title="Remove this line" onclick="removeImportPreviewLine(${idx})">
            ×
          </button>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded p-1.5 text-gray-200 text-xs focus-within:border-indigo-500">
          <textarea class="w-full bg-transparent resize-none focus:outline-none" rows="2" 
                    oninput="updateImportPreviewLineText(${idx}, this.value)">${l.text}</textarea>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function removeImportPreviewLine(idx) {
  if (parsedImportData && parsedImportData.lines) {
    parsedImportData.lines.splice(idx, 1);
    renderImportPreview(parsedImportData);
  }
}

function updateImportPreviewLineText(idx, val) {
  if (parsedImportData && parsedImportData.lines && parsedImportData.lines[idx]) {
    parsedImportData.lines[idx].text = val;
  }
}

// Commit Imported Dialogue to Canvas as Detached Dialogue
function confirmImportToCanvas() {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("import dialogue")) return;
  if (!parsedImportData || !parsedImportData.lines || parsedImportData.lines.length === 0) {
    showToast("No dialogue lines to import", "warning");
    return;
  }

  pushUndoState();

  // Determine placement coordinate on canvas (placed prominently to the right of current view)
  const visibleNodes = appData.nodes.filter(n => {
    if (n.variationId && n.variationId !== activeVariationId) return false;
    return (n.category || 'KeyChain') === activeCategoryFilter;
  });

  const visibleDialogues = appData.dialogues.filter(d => {
    if (d.variationId && d.variationId !== activeVariationId) return false;
    return (d.category || 'KeyChain') === activeCategoryFilter;
  });

  let maxX = 100;
  visibleNodes.forEach(n => {
    if (n.position && n.position.x > maxX) maxX = n.position.x;
  });
  visibleDialogues.forEach(d => {
    if (d.position && d.position.x > maxX) maxX = d.position.x;
  });

  const posX = maxX + 960;
  const posY = FLOOR_Y[0] || 90;

  const newDialogue = {
    id: `diag_imp_${Date.now()}`,
    targetEventId: null, // Detached Dialogue! (Triggers Detached Dialogue badge)
    triggerTiming: null,
    triggerActionId: null,
    delayHours: 0,
    delayUnit: "hours",
    triggerCondition: "Imported Dialogue Script",
    position: { x: posX, y: posY },
    variationId: activeVariationId,
    category: activeCategoryFilter,
    floorIndex: 0,
    colorScheme: "amber",
    lines: parsedImportData.lines.map((l, idx) => ({
      id: `l_imp_${Date.now()}_${idx}`,
      speakerId: l.speakerId,
      speakerName: l.speakerName,
      text: l.text
    }))
  };

  if (!appData.dialogues) appData.dialogues = [];
  appData.dialogues.push(newDialogue);

  preventNodeOverlap(newDialogue.id);
  saveProjectToLocalStorage();
  closeModal('modal-import-pdf');
  renderApp();

  // Focus zoom on newly created dialogue card
  zoomInToBlock(newDialogue.id, true);

  showToast(`Imported Detached Dialogue with ${newDialogue.lines.length} lines! (Ctrl+Z to undo)`, "success");
}

function openCreateEventModal() {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("create event block")) return;
  pushUndoState();
  const isTier = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool' || activeCategoryFilter === 'SpeciesPool');

  const spawnPos = findClosestEmptyCanvasPosition(880, 540);
  let floor = 0;
  if (!isTier) {
    let closestFloorIdx = 0;
    let minDistance = Infinity;
    FLOOR_Y.forEach((fy, idx) => {
      const dist = Math.abs(spawnPos.y - fy);
      if (dist < minDistance) {
        minDistance = dist;
        closestFloorIdx = idx;
      }
    });
    spawnPos.y = FLOOR_Y[closestFloorIdx];
    floor = closestFloorIdx;
  }

  const newCodename = generateNewEventCodename(activeCategoryFilter, floor, activeVariationId);
  const currentVarObj = (appData.variations || []).find(v => v.id === activeVariationId);
  const defaultEventName = (activeCategoryFilter === 'KeyChain' && currentVarObj && currentVarObj.name)
    ? currentVarObj.name
    : 'New Event Block';

  const newNode = {
    id: `node_${Date.now()}`,
    codename: newCodename,
    name: defaultEventName,
    title: defaultEventName,
    type: activeCategoryFilter === 'DeckPool' ? 'Deck' : (activeCategoryFilter === 'SpeciesPool' ? 'Species' : 'World'),
    category: activeCategoryFilter,
    variationId: activeVariationId,
    floorIndex: floor,
    tier: isTier ? 1 : null,
    location: '',
    spawnConditions: '',
    eventIntro: 'Initial event context...',
    eventDescription: 'Enter narrative body context...',
    reactionTimerHours: "Infinite",
    hasInactionThreat: false,
    inactionThreat: null,
    position: spawnPos,
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
    ]
  };
  appData.nodes.push(newNode);
  preventNodeOverlap(newNode.id);
  if (!isTier) {
    resequenceStageEventCodenames(floor, activeCategoryFilter, activeVariationId);
  }
  saveProjectToLocalStorage();
  renderApp();
  showToast(`New Event Block created (${newNode.codename})`, "success");
}

window.openCreateEventModal = openCreateEventModal;
window.createStandaloneDialogue = createStandaloneDialogue;

function exportProjectJSON() {
  const jsonStr = JSON.stringify(appData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rogue_carrier_narrative_v26_export_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

