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
  closeModal('modal-req-type');
  const { nodeId, actionIdx } = pendingReqContext;
  openResourcePickerModal(nodeId, actionIdx, 'requirement', null);
}

function addRequirementAlternative(nodeId, actionIdx, clauseIdx) {
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
  openResourcePickerModal(nodeId, actionIdx, 'requirement_edit', itemIdx, clauseIdx);
}

function removeRequirementItem(nodeId, actionIdx, clauseIdx, itemIdx) {
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

function setPickerCategoryFilter(cat, btn) {
  activePickerCategory = cat;
  document.querySelectorAll('.picker-cat-tab').forEach(b => {
    b.className = 'picker-cat-tab px-3 py-1 rounded text-xs font-semibold bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 hover:border-gray-700 transition flex items-center gap-1';
  });
  if (btn) {
    btn.className = 'picker-cat-tab px-3 py-1 rounded text-xs font-bold bg-amber-500 text-gray-950 transition flex items-center gap-1';
  }
  const input = document.getElementById('picker-search-input');
  filterPickerResources(input ? input.value : '');
}

function openResourcePickerModal(nodeId, actionIdx, type, itemIdx, clauseIdx = null) {
  activePickerTarget = { nodeId, actionIdx, type, itemIdx, clauseIdx, clauseType: 'single' };
  const grid = document.getElementById('picker-resource-grid');
  if (!grid) return;

  activePickerCategory = 'all';
  const tabs = document.querySelectorAll('.picker-cat-tab');
  tabs.forEach((b, idx) => {
    if (idx === 0) {
      b.className = 'picker-cat-tab px-3 py-1 rounded text-xs font-bold bg-amber-500 text-gray-950 transition flex items-center gap-1';
    } else {
      b.className = 'picker-cat-tab px-3 py-1 rounded text-xs font-semibold bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 hover:border-gray-700 transition flex items-center gap-1';
    }
  });

  const input = document.getElementById('picker-search-input');
  if (input) input.value = '';

  const criteriaInput = document.getElementById('picker-criteria-input');
  if (criteriaInput) {
    criteriaInput.value = '';
    if (type === 'reward') {
      const node = appData.nodes.find(n => n.id === nodeId);
      const act = (node && node.actions) ? node.actions[actionIdx] : null;
      const existingRw = (act && act.rewards && itemIdx !== null) ? act.rewards[itemIdx] : null;
      if (existingRw && isCriteriaObject(existingRw)) {
        criteriaInput.value = existingRw.name || '';
      }
    } else if (type === 'requirement_edit') {
      const node = appData.nodes.find(n => n.id === nodeId);
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
      const node = appData.nodes.find(n => n.id === nodeId);
      const act = (node && node.actions) ? node.actions[actionIdx] : null;
      const existingRw = (act && act.rewards && itemIdx !== null) ? act.rewards[itemIdx] : null;
      if (existingRw) {
        if (typeof existingRw === 'object' && existingRw.amount !== undefined) {
          amountInput.value = existingRw.amount;
        } else if (typeof existingRw === 'string') {
          const match = existingRw.match(/(?:[xX]|[+\-])\s*([0-9]+(?:-[0-9]+)?)|([0-9]+-[0-9]+)/);
          amountInput.value = match ? (match[1] || match[2]) : '20-30';
        } else {
          amountInput.value = '20-30';
        }
      } else {
        amountInput.value = '20-30';
      }
    } else if (type === 'requirement_edit') {
      const node = appData.nodes.find(n => n.id === nodeId);
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
  filterPickerResources('');
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

  if (!items || items.length === 0) {
    grid.innerHTML = `
      <div class="col-span-4 py-12 text-center text-gray-400">
        <i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 text-gray-500 opacity-60"></i>
        <div class="font-bold text-sm text-gray-300">No resources found</div>
        <p class="text-xs text-gray-500 mt-1">Try clearing your search query or selecting a different category tab.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ root: grid });
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    const isBuilding = item.kind === 'building' || item.category === 'Building';
    const isCriteria = Boolean(item.isCriteria || item.category === 'Criteria');
    
    card.className = `bg-gray-950 border ${isCriteria ? 'border-fuchsia-600/80 hover:border-fuchsia-400 bg-fuchsia-950/20' : (isBuilding ? 'border-amber-900/60 hover:border-amber-400 bg-amber-950/10' : 'border-gray-800 hover:border-cyan-400')} p-3 rounded-lg cursor-pointer flex flex-col items-center text-center transition shadow-sm hover:shadow-lg group relative`;
    
    const iconMarkup = item.iconImg ? `
      <div class="w-14 h-14 flex items-center justify-center mb-1.5 p-1 bg-slate-900/90 rounded-lg border border-slate-700/80 group-hover:border-amber-400 group-hover:scale-105 transition shadow-md">
        <img src="${item.iconImg}" alt="${item.name}" class="w-12 h-12 object-contain drop-shadow" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline';">
        <span style="display:none;" class="text-2xl">${item.icon || (isBuilding ? '🏛️' : '📦')}</span>
      </div>` : `
      <div class="w-14 h-14 flex items-center justify-center mb-1.5 ${isCriteria ? 'bg-fuchsia-950/70 border-fuchsia-700/80' : 'bg-slate-900/50 border-slate-800/80'} rounded-lg border">
        <span class="text-2xl">${item.icon || (isCriteria ? '🔑' : (isBuilding ? '🏛️' : '📦'))}</span>
      </div>`;
    
    card.innerHTML = `
      ${iconMarkup}
      <div class="font-bold ${isCriteria ? 'text-fuchsia-200' : 'text-gray-200'} text-xs truncate w-full group-hover:text-amber-300 transition" title="${item.name}">${item.name}</div>
      <div class="text-[10px] ${isCriteria ? 'text-fuchsia-400' : 'text-gray-400'} uppercase font-mono mt-0.5">${item.category || (isBuilding ? 'Building' : 'Item')}${item.tier !== undefined ? ` • T${item.tier}` : ''}</div>
    `;

    card.onclick = () => {
      if (isCriteria) {
        selectCriteriaFromPicker(item.name);
      } else {
        selectResourceFromPicker(item);
      }
    };
    grid.appendChild(card);
  });
}

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

  if (activePickerCategory === 'criteria') {
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
    items = [...criteriaItems, ...items];
  }

  const q = (query || '').toLowerCase().trim();
  if (q) {
    items = items.filter(i => 
      (i.name && i.name.toLowerCase().includes(q)) || 
      (i.category && i.category.toLowerCase().includes(q)) ||
      (i.id && i.id.toLowerCase().includes(q))
    );
  }

  renderPickerResources(items);
}

// Select Crew Specialization (Science, Engineering, Operations, Defense)
function selectCrewSpecialization(categoryName, icon, color) {
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

function selectResourceFromPicker(item) {
  if (item.category === 'Specialization' || item.kind === 'specialization') {
    selectCrewSpecialization(item.name, item.icon || '👨‍🚀', item.color || '#3b82f6');
    return;
  }
  const { nodeId, actionIdx, type, itemIdx, clauseIdx, clauseType } = activePickerTarget;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;

  pushUndoState();
  const qtyInput = document.getElementById('picker-amount-input');
  const amountStr = (qtyInput && qtyInput.value.trim()) ? qtyInput.value.trim() : '1';

  if (type === 'inaction_penalty') {
    if (!node.inactionThreat) node.inactionThreat = {};
    if (!node.inactionThreat.penalties) node.inactionThreat.penalties = [];
    const penaltyObj = {
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
      const rewardObj = {
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
  showToast(type === 'reward' ? `Reward '${item.name} (${amountStr})' added` : "Resource added", "success");
}

function removeInactionPenalty(nodeId, penaltyIdx) {
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

function addNewTimeline() {
  if (!requireAuthToEdit("create timelines")) return;
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
  if (!requireAuthToEdit("create variations")) return;
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
  renderTimelinesManager();
  renderApp();
  showToast(`Added V${nextNum} to ${tlName}`, "success");
}

function deleteVariation(varId) {
  if (!requireAuthToEdit("delete variations")) return;
  const targetVar = (appData.variations || []).find(v => v.id === varId);
  if (!targetVar) return;

  const tlId = targetVar.timelineId;
  const tl = (appData.timelines || []).find(t => t.id === tlId);
  const tlVars = (appData.variations || []).filter(v => v.timelineId === tlId);
  if (tlVars.length <= 1) {
    showToast("Cannot delete the last variation in a timeline. Delete the timeline instead if needed.", "warning");
    return;
  }

  const isPoolCat = (cat) => cat === 'GenericPool' || cat === 'DeckPool';
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
  if (typeof syncProjectToDiskServer === 'function') {
    syncProjectToDiskServer();
  }
  renderTimelinesManager();
  renderApp();
  showToast(`Deleted Variation "${targetVar.name}"`, "info");
}
window.deleteVariation = deleteVariation;

function deleteTimeline(tlId) {
  if (!requireAuthToEdit("delete timelines")) return;
  const timelines = appData.timelines || [];
  const targetTl = timelines.find(t => t.id === tlId);
  if (!targetTl) return;

  if (timelines.length <= 1) {
    showToast("Cannot delete the only remaining timeline.", "warning");
    return;
  }

  const tlVars = (appData.variations || []).filter(v => v.timelineId === tlId);
  const tlVarIds = new Set(tlVars.map(v => v.id));
  const isPoolCat = (cat) => cat === 'GenericPool' || cat === 'DeckPool';

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

  // Remove timeline and its variations
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
  if (typeof syncProjectToDiskServer === 'function') {
    syncProjectToDiskServer();
  }
  renderTimelinesManager();
  renderApp();
  showToast(`Deleted Timeline "${targetTl.name}" and its ${tlVars.length} variations`, "info");
}
window.deleteTimeline = deleteTimeline;

function getActiveBoardEventBlocks() {
  const isPoolPage = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool');
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
  const isPoolPage = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool');
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
  const isPool = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool');
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
      const typeLabel = activeCategoryFilter === 'DeckPool' ? 'Deck Events' : 'Generic Events';
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
  pushUndoState();
  const isTier = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool');

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
    type: activeCategoryFilter === 'DeckPool' ? 'Deck' : 'World',
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

