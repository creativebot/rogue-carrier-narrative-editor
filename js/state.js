// ============================================================================
// js/state.js - Data Recovery, Normalization, Auto-Save, Symbol Limits & Codenames
// ============================================================================

/* ==========================================================================
   SAFE LOCALSTORAGE WRAPPER WITH AUTOMATIC QUOTA PRUNING
   ========================================================================== */

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[Storage] Quota exceeded while saving '${key}'. Pruning old snapshots to reclaim space...`, err);
    try {
      // 1. Trim rolling local saved versions to 2 items
      const rawVersions = localStorage.getItem('rc_local_saved_versions');
      if (rawVersions) {
        try {
          const list = JSON.parse(rawVersions);
          if (Array.isArray(list) && list.length > 2) {
            localStorage.setItem('rc_local_saved_versions', JSON.stringify(list.slice(-2)));
          } else {
            localStorage.removeItem('rc_local_saved_versions');
          }
        } catch (e) {
          localStorage.removeItem('rc_local_saved_versions');
        }
      }
      // 2. Remove safety backup if needed
      localStorage.removeItem('rc_safety_backup_v26');

      // Try saving again
      localStorage.setItem(key, value);
      return true;
    } catch (retryErr) {
      // If still exceeding quota, prune everything non-essential
      try {
        localStorage.removeItem('rc_local_saved_versions');
        localStorage.removeItem('rc_safety_backup_v26');
        localStorage.setItem(key, value);
        return true;
      } catch (finalErr) {
        console.warn(`[Storage] LocalStorage is full and could not store '${key}' even after pruning. Continuing in memory without throwing.`, finalErr);
        return false;
      }
    }
  }
}
window.safeLocalStorageSet = safeLocalStorageSet;

/* ==========================================================================
   DATA RECOVERY, PERSISTENCE & SAFEGUARD ARCHITECTURE
   ========================================================================== */

// Computes total characters of text across nodes, descriptions, and dialogues
function calculateDatasetTextChars(data) {
  if (!data) return 0;
  let totalChars = 0;
  if (Array.isArray(data.nodes)) {
    for (const node of data.nodes) {
      if (node.name) totalChars += node.name.length;
      if (node.eventIntro) totalChars += node.eventIntro.length;
      if (node.eventDescription) totalChars += node.eventDescription.length;
      if (node.spawnConditions) totalChars += node.spawnConditions.length;
      if (node.inactionThreat) totalChars += node.inactionThreat.length;
      if (Array.isArray(node.actions)) {
        for (const act of node.actions) {
          if (act.shortDescription) totalChars += act.shortDescription.length;
          if (act.description) totalChars += act.description.length;
          if (act.resultDescription) totalChars += act.resultDescription.length;
        }
      }
    }
  }
  if (Array.isArray(data.dialogues)) {
    for (const d of data.dialogues) {
      if (d.title) totalChars += d.title.length;
      if (d.text) totalChars += d.text.length;
      if (d.context) totalChars += d.context.length;
      if (d.speaker) totalChars += d.speaker.length;
    }
  }
  return totalChars;
}

// Checks if dataset contains custom edits in K3A (node_e2a), K3B (node_e2b), or K4A (node_e3a)
function inspectDatasetForTargetEdits(data) {
  if (!data || !Array.isArray(data.nodes)) return { hasTargetEdits: false, matches: [] };
  const targetIds = ['node_e2a', 'node_e2b', 'node_e3a'];
  const matches = [];

  const defaultTexts = {
    'node_e2a': 'Island is swarming with violent predators tracking living heat signatures.',
    'node_e2b': 'Radio silence greets your ship. Survivors have contracted a deadly mutated virus strain.',
    'node_e3a': 'Drones extract the Zephyrus orange box intact from the sea floor when a massive leviathan approaches!'
  };

  for (const n of data.nodes) {
    const isTarget = targetIds.includes(n.id) || 
      (n.codename && (n.codename.includes('K3A') || n.codename.includes('K3B') || n.codename.includes('K4A')));
    if (isTarget) {
      const desc = (n.eventDescription || '').trim();
      const def = defaultTexts[n.id] || '';
      // If description differs from default or has substantial text
      if (desc && desc !== def) {
        matches.push(n.codename || n.name || n.id);
      }
    }
  }

  return {
    hasTargetEdits: matches.length > 0,
    matches: matches
  };
}

// Accurately counts unique Event Blocks and Dialogue Blocks on the active board for any dataset snapshot
function countDatasetBlocksForActiveBoard(data, categoryFilter = activeCategoryFilter, variationId = activeVariationId) {
  if (!data || typeof data !== 'object') return { eventCount: 0, dialogueCount: 0 };
  const isPoolPage = (categoryFilter === 'GenericPool' || categoryFilter === 'DeckPool' || categoryFilter === 'SpeciesPool');
  const seenNodeIds = new Set();
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  nodes.forEach(n => {
    if (!n || !n.id || seenNodeIds.has(n.id)) return;
    const cat = n.category || 'KeyChain';
    if (cat !== categoryFilter) return;
    if (!isPoolPage && n.variationId && n.variationId !== variationId) return;
    seenNodeIds.add(n.id);
  });

  const seenDialogueIds = new Set();
  const dialogues = Array.isArray(data.dialogues) ? data.dialogues : [];
  dialogues.forEach(d => {
    if (!d || !d.id || seenDialogueIds.has(d.id)) return;
    const links = [];
    if (Array.isArray(d.links) && d.links.length > 0) {
      d.links.forEach(l => {
        if (l && l.targetEventId) links.push(l);
      });
    } else if (d.targetEventId) {
      links.push({ targetEventId: d.targetEventId });
    }

    if (links.length > 0) {
      const hasVisibleLink = links.some(link => seenNodeIds.has(link.targetEventId));
      if (!hasVisibleLink) return;
      seenDialogueIds.add(d.id);
      return;
    }

    const cat = d.category || 'KeyChain';
    if (cat !== categoryFilter) return;
    if (!isPoolPage && d.variationId && d.variationId !== variationId) return;
    seenDialogueIds.add(d.id);
  });

  return {
    eventCount: seenNodeIds.size,
    dialogueCount: seenDialogueIds.size
  };
}

// Scans all browser storage keys for saved sessions, safety snapshots, and rolling backups
function scanAllLocalRecoveryCandidates() {
  const candidates = [];
  const seenSignatures = new Set();

  function addCandidate(cand) {
    if (!cand || !cand.data) return;
    const boardCounts = countDatasetBlocksForActiveBoard(cand.data);
    const nodeCount = boardCounts.eventCount;
    const dialogueCount = boardCounts.dialogueCount;
    const rawNodesLen = Array.isArray(cand.data.nodes) ? cand.data.nodes.length : 0;
    if (rawNodesLen === 0 && dialogueCount === 0) return;

    const totalTextChars = calculateDatasetTextChars(cand.data);
    const targetInspection = inspectDatasetForTargetEdits(cand.data);

    // Signature includes text character length bucket so text modifications are preserved
    const textBucket = Math.floor(totalTextChars / 20) * 20;
    const firstNodes = (cand.data.nodes || []).slice(0, 5).map(n => n.codename || n.name || n.id).join('_');
    const sig = `${nodeCount}:${dialogueCount}:${textBucket}:${firstNodes}:${targetInspection.matches.join(',')}`;

    // Do not deduplicate rolling local_version snapshots unless identical ID or exact same millisecond
    if (cand.sourceType !== 'local_version' && cand.sourceType !== 'local_active') {
      if (seenSignatures.has(sig)) {
        return; // Deduplicate identical static datasets
      }
      seenSignatures.add(sig);
    }

    cand.nodeCount = nodeCount;
    cand.dialogueCount = dialogueCount;
    cand.totalTextChars = totalTextChars;
    cand.hasTargetEdits = targetInspection.hasTargetEdits;
    cand.targetMatches = targetInspection.matches;
    // Composite score weighing nodes, dialogues, and actual typed text content
    cand.totalScore = (nodeCount * 100) + (dialogueCount * 10) + Math.min(totalTextChars, 10000);
    cand.previewNodes = (cand.data.nodes || []).slice(0, 4).map(n => n.name || n.codename).filter(Boolean);
    cand.isLocal = true;
    candidates.push(cand);
  }

  // 1. Check rc_local_saved_versions (rolling version history)
  try {
    const raw = localStorage.getItem('rc_local_saved_versions');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((item, idx) => {
          if (item && item.data) {
            addCandidate({
              sourceType: 'local_version',
              id: item.id || `ver_${idx}_${Date.now()}`,
              name: item.name || `Session Snapshot #${idx + 1}`,
              author: item.author || 'Local Session',
              timestamp: item.timestamp || item.displayTime || new Date().toISOString(),
              displayTime: item.displayTime || (item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recent Session'),
              data: item.data
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn("Could not parse rc_local_saved_versions", e);
  }

  // 2. Check rc_safety_backup_v26
  try {
    const raw = localStorage.getItem('rc_safety_backup_v26');
    if (raw) {
      const parsed = JSON.parse(raw);
      const data = parsed.data || parsed;
      if (data && (data.nodes || data.dialogues)) {
        addCandidate({
          sourceType: 'safety_backup',
          id: 'safety_backup_v26',
          name: parsed.reason ? `Safety Backup (${parsed.reason})` : 'Safety Backup',
          author: 'Auto-Backup',
          timestamp: parsed.timestamp || new Date().toISOString(),
          displayTime: parsed.timestamp ? new Date(parsed.timestamp).toLocaleString() : 'Safety Backup',
          data: data
        });
      }
    }
  } catch (e) {}

  // 3. Check rc_narrative_project_v26
  try {
    const raw = localStorage.getItem('rc_narrative_project_v26');
    if (raw) {
      const data = JSON.parse(raw);
      if (data && (data.nodes || data.dialogues)) {
        addCandidate({
          sourceType: 'local_active',
          id: 'local_active_v26',
          name: 'Active Browser Cache (v26)',
          author: (data.projectInfo && data.projectInfo.author) || 'Current Device',
          timestamp: data._lastModified || new Date().toISOString(),
          displayTime: data._lastModified ? new Date(data._lastModified).toLocaleString() : 'Recent Edit',
          data: data
        });
      }
    }
  } catch (e) {}

  // 4. Check any other localStorage keys starting with rc_ or containing backup/narrative
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === 'rc_local_saved_versions' || k === 'rc_safety_backup_v26' || k === 'rc_narrative_project_v26') continue;
      if (k.startsWith('rc_') || k.includes('backup') || k.includes('narrative')) {
        try {
          const val = JSON.parse(localStorage.getItem(k));
          const data = val.data || val;
          if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
            addCandidate({
              sourceType: 'storage_key',
              id: k,
              name: `Saved Key (${k})`,
              author: 'LocalStorage',
              timestamp: val.timestamp || new Date().toISOString(),
              displayTime: val.timestamp ? new Date(val.timestamp).toLocaleString() : k,
              data: data
            });
          }
        } catch (err) {}
      }
    }
  } catch (e) {}

  // Sort candidates by newest timestamp first so latest state (including deletions) is prioritized
  candidates.sort((a, b) => {
    const tDiff = new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    if (tDiff !== 0 && !isNaN(tDiff)) return tDiff;
    return b.totalScore - a.totalScore;
  });

  return candidates;
}

// Stores an immutable safety snapshot into localStorage rolling versions
function archiveLocalSnapshot(reason, dataToArchive) {
  try {
    const payload = dataToArchive ? JSON.parse(JSON.stringify(dataToArchive)) : JSON.parse(JSON.stringify(appData));
    if (!payload || (!payload.nodes && !payload.dialogues)) return;

    const raw = localStorage.getItem('rc_local_saved_versions');
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    const now = new Date();
    const boardCounts = countDatasetBlocksForActiveBoard(payload);
    list.unshift({
      id: `archive_${Date.now()}`,
      name: reason || "Session Backup",
      author: (currentUser && currentUser.name) || (payload.projectInfo && payload.projectInfo.author) || 'User Session',
      timestamp: now.toISOString(),
      displayTime: now.toLocaleDateString() + ' ' + now.toLocaleTimeString(),
      nodeCount: boardCounts.eventCount,
      dialogueCount: boardCounts.dialogueCount,
      data: payload
    });

    if (list.length > 60) list = list.slice(0, 60);
    safeLocalStorageSet('rc_local_saved_versions', JSON.stringify(list));
  } catch (e) {
    console.warn("archiveLocalSnapshot quota or parse error", e);
  }
}

// Shows prominent Data Recovery banner at top of workspace
function showRecoveryBanner(text, bestId, totalCount) {
  const banner = document.getElementById('data-recovery-banner');
  const bannerText = document.getElementById('data-recovery-text');
  const badge = document.getElementById('recovery-count-badge');
  if (banner && bannerText) {
    bannerText.innerText = text;
    if (badge) badge.innerText = totalCount || '1';
    banner.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

function dismissRecoveryBanner() {
  const banner = document.getElementById('data-recovery-banner');
  if (banner) banner.classList.add('hidden');
}

// Restores the single richest/latest recovered session snapshot
async function restoreBestRecoverySession() {
  const candidates = scanAllLocalRecoveryCandidates();
  if (candidates.length === 0) {
    showToast("No local session backups found to restore.", "info");
    return;
  }
  const best = candidates[0];
  if (!confirm(`Restore recovered session '${best.name}'?\n\n• Events: ${best.nodeCount}\n• Dialogues: ${best.dialogueCount}\n• Saved: ${best.displayTime}\n\nYour current canvas will be safely backed up first, and this restored version will immediately sync to the server disk.`)) {
    return;
  }

  archiveLocalSnapshot("Before Restoring Recovered Session");
  pushUndoState();
  appData = JSON.parse(JSON.stringify(best.data));
  normalizeAllProjectData();
  saveProjectToLocalStorage();
  await saveCurrentProject(false); // Posts to server /api/save immediately
  renderApp();
  fitWholeSchematic();
  dismissRecoveryBanner();
  showToast(`Successfully restored ${best.nodeCount} events and ${best.dialogueCount} dialogues! Synced to server.`, 'success');
}

// Restores any specific candidate by its ID
async function restoreCandidate(candidateId) {
  const candidates = scanAllLocalRecoveryCandidates();
  const found = candidates.find(c => c.id === candidateId);
  if (!found || !found.data) {
    showToast("Candidate data not found", "error");
    return;
  }

  if (!confirm(`Restore snapshot '${found.name}'?\n\n• Events: ${found.nodeCount}\n• Dialogues: ${found.dialogueCount}\n• Saved: ${found.displayTime}\n\nYour current canvas will be backed up before replacing.`)) {
    return;
  }

  archiveLocalSnapshot("Before Restoring " + found.name);
  pushUndoState();
  appData = JSON.parse(JSON.stringify(found.data));
  normalizeAllProjectData();
  saveProjectToLocalStorage();
  await saveCurrentProject(false);
  renderApp();
  fitWholeSchematic();
  closeModal('modal-save-manager');
  dismissRecoveryBanner();
  showToast(`Restored '${found.name}' (${found.nodeCount} events). Synced to server.`, 'success');
}

function downloadCandidateJson(candidateId) {
  const candidates = scanAllLocalRecoveryCandidates();
  const found = candidates.find(c => c.id === candidateId) || candidates[0];
  if (!found || !found.data) {
    showToast("Backup data not found", "error");
    return;
  }
  const jsonStr = JSON.stringify(found.data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (found.name || 'backup').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `rogue_carrier_backup_${safeName}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function deleteLocalCandidate(candidateId) {
  if (!confirm("Remove this snapshot from browser storage?")) return;
  try {
    const raw = localStorage.getItem('rc_local_saved_versions');
    if (raw) {
      let list = JSON.parse(raw);
      list = list.filter(s => s.id !== candidateId);
      safeLocalStorageSet('rc_local_saved_versions', JSON.stringify(list));
    }
  } catch (e) {}
  loadBackupsList();
  renderSavedVersionsList();
  showToast("Snapshot removed from local storage", "info");
}

// Load Project Data with Intelligent Client-Server Reconciliation & Auto-Recovery
async function loadProjectData() {
  let loaded = false;
  let serverData = null;
  let serverLoadOk = false;

  // 1. Scan all local candidates first
  const localCandidates = scanAllLocalRecoveryCandidates();
  const bestLocal = localCandidates.find(c => c.sourceType === 'local_active') || (localCandidates.length > 0 ? localCandidates[0] : null);

  // 2. Fetch server disk state (/api/load)
  try {
    const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders(false) : {};
    if (authToken && !headers['Authorization']) headers['Authorization'] = `Bearer ${authToken}`;
    const serverRes = await fetch('/api/load', { headers });
    if (serverRes.ok) {
      serverData = await serverRes.json();
      serverLoadOk = true;
    }
  } catch (err) {
    console.warn("Could not reach server /api/load, checking local storage", err);
  }

  const serverCounts = countDatasetBlocksForActiveBoard(serverData);
  const serverNodesCount = serverCounts.eventCount;
  const serverDialoguesCount = serverCounts.dialogueCount;
  const serverTextChars = calculateDatasetTextChars(serverData);
  const serverScore = (serverNodesCount * 100) + (serverDialoguesCount * 10) + Math.min(serverTextChars, 10000);
  const serverModTime = (serverData && serverData._lastModified) ? new Date(serverData._lastModified).getTime() : 0;

  const localNodesCount = bestLocal ? bestLocal.nodeCount : 0;
  const localTextChars = bestLocal ? (bestLocal.totalTextChars || 0) : 0;
  const localScore = bestLocal ? bestLocal.totalScore : 0;
  const localModTime = (bestLocal && bestLocal.data && bestLocal.data._lastModified) ? new Date(bestLocal.data._lastModified).getTime() : 0;

  console.log(`[Storage Check] Server: ${serverNodesCount} events (mod: ${serverModTime}), Local: ${localNodesCount} events (mod: ${localModTime})`);

  // 3. Smart Decision Logic:
  // Prioritize whichever state has the newer _lastModified timestamp (or local if server is empty)
  const localIsNewer = bestLocal && (
    (localModTime > 0 && serverModTime > 0 && localModTime > serverModTime + 2000) ||
    (!serverLoadOk && localNodesCount > 0) ||
    (serverNodesCount === 0 && localNodesCount > 0)
  );

  if (localIsNewer) {
    console.log("[Data Recovery] Local active cache has newer edits. Merging local active board with server boards!");
    if (serverData && Array.isArray(serverData.nodes) && serverData.nodes.length > 0) {
      // Retain local edits for the active board, while preserving all other boards from the server
      const activeBoardId = (typeof getCurrentBoardIdentifier === 'function') ? getCurrentBoardIdentifier() : 'KeyChain:timeline_1:var_v1';
      const localActiveNodes = (bestLocal.data.nodes || []).filter(n => nodeBelongsToBoardId(n, activeBoardId));
      const serverOtherNodes = (serverData.nodes || []).filter(n => !nodeBelongsToBoardId(n, activeBoardId));

      const seenIds = new Set(localActiveNodes.map(n => n.id));
      serverOtherNodes.forEach(n => seenIds.add(n.id));
      const remainingLocalNodes = (bestLocal.data.nodes || []).filter(n => !seenIds.has(n.id));

      appData = {
        ...serverData,
        ...bestLocal.data,
        nodes: [...localActiveNodes, ...serverOtherNodes, ...remainingLocalNodes],
        dialogues: [
          ...(bestLocal.data.dialogues || []),
          ...(serverData.dialogues || []).filter(sd => !(bestLocal.data.dialogues || []).some(ld => ld.id === sd.id))
        ]
      };
    } else {
      appData = JSON.parse(JSON.stringify(bestLocal.data));
    }
    loaded = true;
    normalizeAllProjectData();
    saveProjectToLocalStorage();

    // Auto-heal the server disk immediately
    syncProjectToDiskServer();
  } else if (serverLoadOk && serverData && Array.isArray(serverData.nodes) && serverData.nodes.length > 0) {
    if (bestLocal && localScore > 0 && localModTime !== serverModTime) {
      archiveLocalSnapshot("Pre-Server-Sync Local State", bestLocal.data);
    }
    appData = serverData;
    loaded = true;
    normalizeAllProjectData();
    safeLocalStorageSet('rc_narrative_project_v26', JSON.stringify(appData));
  } else if (bestLocal) {
    // Offline or server not available, load best local
    appData = JSON.parse(JSON.stringify(bestLocal.data));
    loaded = true;
    normalizeAllProjectData();
    showToast(`Loaded ${bestLocal.nodeCount} events from local storage`, 'info');
  }

  if (!loaded) {
    resetToDefaultProjectData();
  } else {
    normalizeAllProjectData();
  }

  // Restore whichever variation, timeline, and category tab the user was last editing before reload
  restoreActiveWorkspacePosition();

  // Initialize periodic 1-minute auto-save
  initPeriodicAutoSave();

  // Update header board saves count
  if (typeof updateActiveBoardSavesBadge === 'function') {
    updateActiveBoardSavesBadge();
  }
}

function saveActiveWorkspacePosition() {
  try {
    if (activeVariationId) localStorage.setItem('rc_active_variation_id', activeVariationId);
    if (activeTimelineId) localStorage.setItem('rc_active_timeline_id', activeTimelineId);
    if (activeCategoryFilter) localStorage.setItem('rc_active_category_filter', activeCategoryFilter);
    if (typeof activeMobileStageIndex === 'number') {
      localStorage.setItem('rc_active_mobile_stage_index', String(activeMobileStageIndex));
    }
  } catch (e) {}
}

function restoreActiveWorkspacePosition() {
  try {
    const savedVarId = localStorage.getItem('rc_active_variation_id');
    const savedTlId = localStorage.getItem('rc_active_timeline_id');
    const savedCat = localStorage.getItem('rc_active_category_filter');
    const savedMobStage = localStorage.getItem('rc_active_mobile_stage_index');

    const variations = Array.isArray(appData.variations) ? appData.variations : [];
    if (savedVarId && variations.some(v => v.id === savedVarId)) {
      const matchedVar = variations.find(v => v.id === savedVarId);
      activeVariationId = matchedVar.id;
      activeTimelineId = matchedVar.timelineId || savedTlId || 'timeline_1';
    } else if (variations.length > 0 && !variations.some(v => v.id === activeVariationId)) {
      activeVariationId = variations[0].id;
      activeTimelineId = variations[0].timelineId || 'timeline_1';
    }

    if (savedCat && ['KeyChain', 'SecretChain', 'GenericPool', 'DeckPool', 'SpeciesPool'].includes(savedCat)) {
      activeCategoryFilter = savedCat;
      syncCategoryFilterButtonsUI(savedCat);
    }

    if (savedMobStage !== null && !isNaN(parseInt(savedMobStage, 10))) {
      activeMobileStageIndex = Math.max(0, parseInt(savedMobStage, 10));
    }
  } catch (e) {}
}

function syncCategoryFilterButtonsUI(filter) {
  const btnKeychain = document.getElementById('btn-view-keychain');
  const btnSecret = document.getElementById('btn-view-secret');
  const btnGeneric = document.getElementById('btn-view-generic');
  const btnDeck = document.getElementById('btn-view-deck');
  const btnSpecies = document.getElementById('btn-view-species');

  if (btnKeychain) {
    btnKeychain.className = filter === 'KeyChain'
      ? "px-2.5 py-1 rounded text-xs font-bold bg-amber-500 text-gray-950 shadow flex items-center gap-1 transition ring-2 ring-amber-400"
      : "px-2.5 py-1 rounded text-xs font-bold bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 border border-amber-700/60 flex items-center gap-1 transition shadow-xs";
  }
  if (btnSecret) {
    btnSecret.className = filter === 'SecretChain'
      ? "px-2.5 py-1 rounded text-xs font-bold bg-violet-600 text-white shadow-lg flex items-center gap-1 transition ring-2 ring-violet-400"
      : "px-2.5 py-1 rounded text-xs font-bold bg-violet-950/40 text-violet-300 hover:bg-violet-900/60 border border-violet-700/60 flex items-center gap-1 transition shadow-xs";
  }
  if (btnGeneric) {
    btnGeneric.className = filter === 'GenericPool'
      ? "px-2.5 py-1 rounded text-xs font-bold bg-blue-600 text-white shadow-lg flex items-center gap-1 transition ring-2 ring-blue-400"
      : "px-2.5 py-1 rounded text-xs font-bold bg-blue-950/40 text-blue-300 hover:bg-blue-900/60 border border-blue-700/60 flex items-center gap-1 transition shadow-xs";
  }
  if (btnDeck) {
    btnDeck.className = filter === 'DeckPool'
      ? "px-2.5 py-1 rounded text-xs font-bold bg-emerald-600 text-white shadow-lg flex items-center gap-1 transition ring-2 ring-emerald-400"
      : "px-2.5 py-1 rounded text-xs font-bold bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-700/60 flex items-center gap-1 transition shadow-xs";
  }
  if (btnSpecies) {
    btnSpecies.className = filter === 'SpeciesPool'
      ? "px-2.5 py-1 rounded text-xs font-bold bg-fuchsia-600 text-white shadow-lg flex items-center gap-1 transition ring-2 ring-fuchsia-400 col-span-2"
      : "px-2.5 py-1 rounded text-xs font-bold bg-fuchsia-950/40 text-fuchsia-300 hover:bg-fuchsia-900/60 border border-fuchsia-700/60 flex items-center gap-1 transition shadow-xs col-span-2";
  }

  const headerSelect = document.getElementById('header-board-select');
  if (headerSelect && headerSelect.value !== filter) {
    headerSelect.value = filter;
  }
}

function normalizeActionRequirements(act) {
  if (!act) return;
  if (!act.requirements) act.requirements = [];
  act.requirements = act.requirements.map(r => {
    if (r && Array.isArray(r.items)) {
      return r;
    } else if (r && (r.resourceId || r.name)) {
      return {
        id: `clause_${Math.random().toString(36).substring(2, 7)}`,
        isReplaceable: false,
        items: [r]
      };
    }
    return null;
  }).filter(Boolean);
}

function normalizeNodeRequirements(node) {
  if (node.reactionTimerHours === undefined || node.reactionTimerHours === null) {
    node.reactionTimerHours = "Infinite";
  }
  if (node.hasInactionThreat === undefined) {
    node.hasInactionThreat = false;
  }
  if (!node.hasInactionThreat) {
    node.inactionThreat = null;
  } else if (node.inactionThreat && node.inactionThreat.targetNodeId === node.id) {
    node.inactionThreat.targetNodeId = null;
  }

  (node.actions || []).forEach(act => {
    if (act && act.targetNodeId === node.id) {
      act.targetNodeId = null;
    }
    normalizeActionRequirements(act);
  });
}

function migrateStageLayoutV2(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.stageLayoutVersion && data.stageLayoutVersion >= 2) return false;

  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const dialogues = Array.isArray(data.dialogues) ? data.dialogues : [];

  nodes.forEach(n => {
    if (!n || !n.position || typeof n.position.y !== 'number') return;
    const cat = n.category || 'KeyChain';
    if (cat === 'KeyChain' || cat === 'SecretChain') {
      const fIdx = Number(n.floorIndex);
      const oldY = n.position.y;
      if (fIdx === 1 || (fIdx !== 0 && fIdx !== 2 && fIdx !== 3 && oldY >= 600 && oldY < 1600)) {
        n.position.y = Math.round(1690 + (oldY - 1080));
        n.floorIndex = 1;
      } else if (fIdx === 2 || (fIdx !== 0 && fIdx !== 1 && fIdx !== 3 && oldY >= 1600 && oldY < 2600)) {
        n.position.y = Math.round(3290 + (oldY - 2070));
        n.floorIndex = 2;
      } else if (fIdx === 3 || (fIdx !== 0 && fIdx !== 1 && fIdx !== 2 && oldY >= 2600)) {
        n.position.y = Math.round(4890 + (oldY - 3060));
        n.floorIndex = 3;
      }
    }
  });

  dialogues.forEach(d => {
    if (!d || !d.position || typeof d.position.y !== 'number') return;
    const cat = d.category || 'KeyChain';
    if (cat === 'KeyChain' || cat === 'SecretChain') {
      const oldY = d.position.y;
      if (oldY >= 600 && oldY < 1600) {
        d.position.y = Math.round(oldY + 610);
      } else if (oldY >= 1600 && oldY < 2600) {
        d.position.y = Math.round(oldY + 1220);
      } else if (oldY >= 2600) {
        d.position.y = Math.round(oldY + 1830);
      }
    }
  });

  data.stageLayoutVersion = 2;
  return true;
}

function normalizeAllProjectData() {
  if (!appData || typeof appData !== 'object') appData = {};
  if (!appData.schemaVersion) appData.schemaVersion = 1;
  appData._lastModified = appData._lastModified || new Date().toISOString();

  if (!appData.stageLayoutVersion || appData.stageLayoutVersion < 2) {
    migrateStageLayoutV2(appData);
  }

  if (!Array.isArray(appData.nodes)) appData.nodes = [];
  if (!Array.isArray(appData.dialogues)) appData.dialogues = [];
  if (!Array.isArray(appData.characters) || appData.characters.length === 0) {
    appData.characters = getDefaultCharactersList();
  }
  if (!Array.isArray(appData.timelines) || appData.timelines.length === 0) {
    appData.timelines = typeof getDefaultTimelinesList === 'function' ? getDefaultTimelinesList() : [
      { id: "timeline_1", number: 1, name: "The Fate of Zephyrus", description: "Main reality hypercell timeline following the collapse of Zephyrus." }
    ];
  }
  if (!Array.isArray(appData.variations) || appData.variations.length === 0) {
    appData.variations = typeof getDefaultVariationsList === 'function' ? getDefaultVariationsList() : [
      { id: "var_v1", timelineId: "timeline_1", number: 1, name: "The Moment After the End", description: "First variation containing primary critical event chain." },
      { id: "var_v2", timelineId: "timeline_1", number: 2, name: "Once More Into The Frey", description: "Debris field gravitational anomalies." },
      { id: "var_v3", timelineId: "timeline_1", number: 3, name: "Too Many Variables", description: "Keeling ocean trawler exploration." },
      { id: "var_v4", timelineId: "timeline_1", number: 4, name: "Gain The Upper Hand", description: "Keeling island predator swarms." },
      { id: "var_v5", timelineId: "timeline_1", number: 5, name: "Hunted!", description: "Ebola strain contagion response." },
      { id: "var_v6", timelineId: "timeline_1", number: 6, name: "On A Cold Trail", description: "Disassembly of smoldering wreckage." },
      { id: "var_v7", timelineId: "timeline_1", number: 7, name: "Prism Glitch", description: "Time displacement hypercell anomaly." },
      { id: "var_v8", timelineId: "timeline_1", number: 8, name: "The Problem of Probability", description: "Sunken flight recorder retrieval." },
      { id: "var_v9", timelineId: "timeline_1", number: 9, name: "Facing Shadows", description: "Combat with leviathan predator." },
      { id: "var_v10", timelineId: "timeline_1", number: 10, name: "The Finite Infinity", description: "Final escape pod signals." }
    ];
  }

  // Ensure Timeline 1 (The Fate of Zephyrus) Variations 2-10 reflect official titles
  const t1CanonicalVarNames = {
    2: "Once More Into The Frey",
    3: "Too Many Variables",
    4: "Gain The Upper Hand",
    5: "Hunted!",
    6: "On A Cold Trail",
    7: "Prism Glitch",
    8: "The Problem of Probability",
    9: "Facing Shadows",
    10: "The Finite Infinity"
  };
  const t1LegacyVarNames = new Set([
    "Orbital Rift",
    "Deep Submersion",
    "Predator Nest",
    "Bioweapon Outbreak",
    "Zephyrus Wreckage",
    "Chronos Paradox",
    "Sub-Oceanic Abyss",
    "Behemoth Encounter",
    "Echoes of the Fleet"
  ]);
  let migratedLegacyVarNames = false;
  appData.variations.forEach(v => {
    if (!v) return;
    const varNum = Number(v.number);
    const isTimeline1 = (v.timelineId === 'timeline_1' || (v.id && /^var_v\d+$/.test(v.id)));
    if (isTimeline1 && t1CanonicalVarNames[varNum]) {
      const curName = (v.name || '').trim();
      if (!curName || t1LegacyVarNames.has(curName) || /^Variation\s+\d+$/i.test(curName)) {
        v.name = t1CanonicalVarNames[varNum];
        migratedLegacyVarNames = true;
      }
    }
  });
  if (migratedLegacyVarNames) {
    try {
      safeLocalStorageSet('rc_narrative_project_v26', JSON.stringify(appData));
      if (typeof syncProjectToDiskServer === 'function') {
        setTimeout(() => syncProjectToDiskServer(), 200);
      }
    } catch (e) {}
  }

  if (!appData.projectInfo) {
    appData.projectInfo = { title: "Rogue Carrier Narrative", version: "2.6", author: "Wild Fields" };
  }

  appData.nodes.forEach((node, idx) => {
    if (!node.id) node.id = `node_${idx}_${Date.now()}`;
    if (!node.codename) node.codename = `EV-${idx + 1}`;
    if (!node.name && node.title) node.name = node.title;
    if (!node.title && node.name) node.title = node.name;
    if (!node.type) node.type = "World";
    if (!node.category) node.category = "KeyChain";
    if (node.category === 'KeyChain') {
      const varObj = (appData.variations || []).find(v => v.id === (node.variationId || 'var_v1'));
      if (varObj && varObj.name) {
        node.name = varObj.name;
        node.title = varObj.name;
      }
    }
    if (typeof node.floorIndex === 'undefined') node.floorIndex = 0;
    if (!node.position || typeof node.position.x !== 'number') {
      node.position = { x: 450, y: (typeof FLOOR_Y !== 'undefined' && FLOOR_Y[node.floorIndex]) || 150 };
    }
    if (!Array.isArray(node.actions)) node.actions = [];
    normalizeNodeRequirements(node);
    if (!Array.isArray(node.disabledVariationIds)) {
      node.disabledVariationIds = [];
    }
  });
  if (appData.dialogues) {
    appData.dialogues.forEach(d => {
      if (!d.variationId) d.variationId = "var_v1";
      if (!d.category) d.category = "KeyChain";
      if (d.delayUnit === 'hrs' || d.delayUnit === 'min') {
        d.delayUnit = 'hours';
      }
      if (d.delayHours === undefined && d.delayMinutes !== undefined) {
        d.delayHours = d.delayMinutes;
      }
      const links = getDialogueLinks(d);
      links.forEach(link => {
        const targetNode = (appData.nodes || []).find(n => n.id === link.targetEventId);
        if (targetNode) {
          const current = (link.triggerCondition || '').trim();
          const isLegacy = !current ||
            current.includes('Appears') ||
            current.startsWith('Route Suggestion:') ||
            current.startsWith('On Inaction Threat') ||
            (current.startsWith('After ') && (!current.includes(`(${targetNode.codename})`) || current.indexOf(`(${targetNode.codename})`) > 8)) ||
            (current.startsWith('Before ') && (!current.includes(`(${targetNode.codename})`)));

          if (isLegacy) {
            link.triggerCondition = formatDialogueTriggerCondition(link.triggerTiming || 'pre_event', targetNode, link.triggerActionId);
          }
        }
      });
      syncDialoguePrimaryFields(d);
    });
  }
  sanitizeAndNormalizeCharacters();

  // Normalize action codeSuffixes across all events to pure letters A, B, C...
  if (appData.nodes) {
    appData.nodes.forEach(node => {
      if (node.actions && Array.isArray(node.actions)) {
        node.actions.forEach((act, actIdx) => {
          const letter = String.fromCharCode(65 + actIdx);
          if (!act.codeSuffix || /\d/.test(act.codeSuffix) || act.codeSuffix.length > 1) {
            act.codeSuffix = letter;
          }
        });
      }
    });
  }

  // All node and dialogue coordinates placed by users are ground truth and permanently preserved
}

function sanitizeAndNormalizeCharacters() {
  if (!appData) return;
  const rawList = Array.isArray(appData.characters) ? appData.characters : [];
  const seenIds = new Set();
  const cleaned = [];

  rawList.forEach(c => {
    if (!c || typeof c !== 'object') return;
    const trimmedName = typeof c.name === 'string' ? c.name.trim() : '';
    // Automatically strip empty characters or unnamed OCR noise entries
    if (!trimmedName) return;

    const charId = (typeof c.id === 'string' && c.id.trim())
      ? c.id.trim()
      : `char_${trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;
    if (seenIds.has(charId)) return;
    seenIds.add(charId);

    const disabledVars = Array.isArray(c.disabledVariationIds)
      ? c.disabledVariationIds.filter(Boolean)
      : [];

    const allVarIds = Array.isArray(appData.variations) && appData.variations.length > 0
      ? appData.variations.map(v => v.id)
      : ['var_v1'];
    const activeVars = allVarIds.filter(vId => !disabledVars.includes(vId));

    cleaned.push({
      id: charId,
      name: trimmedName,
      role: typeof c.role === 'string' ? c.role.trim() : 'Cast Member',
      color: c.color || '#f3f4f6',
      textColor: c.textColor || '#1f2937',
      icon: (typeof c.icon === 'string' && c.icon.trim()) ? c.icon.trim() : '👤',
      disabledVariationIds: disabledVars,
      variationIds: activeVars.length > 0 ? activeVars : ['var_v1']
    });
  });

  if (cleaned.length === 0) {
    appData.characters = getDefaultCharactersList();
  } else {
    appData.characters = cleaned;
  }
}

function isCharacterEnabledInVariation(charObj, varId = activeVariationId) {
  if (!charObj) return false;
  if (Array.isArray(charObj.disabledVariationIds)) {
    return !charObj.disabledVariationIds.includes(varId);
  }
  return true;
}

function getGlobalCharactersPool() {
  if (!appData || !Array.isArray(appData.characters) || appData.characters.length === 0) {
    return getDefaultCharactersList();
  }
  return appData.characters.filter(c => c && typeof c.name === 'string' && c.name.trim().length > 0);
}

function getEnabledCharactersForVariation(varId = activeVariationId) {
  const pool = getGlobalCharactersPool();
  return pool.filter(c => isCharacterEnabledInVariation(c, varId));
}


let autoSaveDiskTimer = null;
let lastSavedTimestamp = null;
let periodicAutoSaveIntervalId = null;
let autoSaveIntervalSeconds = parseInt(localStorage.getItem('rc_autosave_interval_sec') || '60', 10);
let lastSavedContentSignature = '';

function computeBoardContentSignature(data) {
  if (!data || typeof data !== 'object') return '';
  try {
    const clone = { ...data };
    delete clone._lastModified;
    return JSON.stringify(clone);
  } catch (e) {
    return '';
  }
}

function initPeriodicAutoSave() {
  if (!lastSavedContentSignature && appData) {
    lastSavedContentSignature = computeBoardContentSignature(appData);
  }
  if (periodicAutoSaveIntervalId) {
    clearInterval(periodicAutoSaveIntervalId);
    periodicAutoSaveIntervalId = null;
  }
  if (autoSaveIntervalSeconds > 0) {
    periodicAutoSaveIntervalId = setInterval(() => {
      // Periodic automatic save to disk & backups only when board content has actually changed
      if (typeof appData === 'object' && appData && Array.isArray(appData.nodes) && appData.nodes.length > 0) {
        const currentSig = computeBoardContentSignature(appData);
        if (currentSig && currentSig !== lastSavedContentSignature) {
          saveCurrentProject(false, 'Auto-Save');
        }
      }
    }, autoSaveIntervalSeconds * 1000);
  }
  const selectEl = document.getElementById('select-autosave-interval');
  if (selectEl) {
    selectEl.value = String(autoSaveIntervalSeconds);
  }
}

function updateAutoSaveInterval(val) {
  autoSaveIntervalSeconds = parseInt(val, 10);
  localStorage.setItem('rc_autosave_interval_sec', String(autoSaveIntervalSeconds));
  initPeriodicAutoSave();
  showToast(autoSaveIntervalSeconds > 0 ? `Auto-save set to every ${autoSaveIntervalSeconds}s` : 'Auto-save disabled', 'info');
}

function saveProjectToLocalStorage() {
  appData._lastModified = new Date().toISOString();
  safeLocalStorageSet('rc_narrative_project_v26', JSON.stringify(appData));
  updateStats();

  const isReadOnly = (typeof isCurrentBoardReadOnly === 'function') 
    ? isCurrentBoardReadOnly() 
    : (typeof isCurrentBoardReadOnly === 'boolean' ? isCurrentBoardReadOnly : false);
  if (isReadOnly) {
    return;
  }

  if (typeof touchActiveBoardLock === 'function') {
    touchActiveBoardLock();
  }

  // Debounced auto-sync to server disk
  clearTimeout(autoSaveDiskTimer);
  autoSaveDiskTimer = setTimeout(() => {
    syncProjectToDiskServer();
  }, 400);
}

// Builds standard auth headers for all server API calls
function getAuthHeaders(includeJsonContentType = true) {
  const headers = {};
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const tok = authToken || localStorage.getItem('rogue_carrier_auth_token') || '';
  if (tok) {
    headers['Authorization'] = `Bearer ${tok}`;
    headers['X-Auth-Token'] = tok;
  }
  let userObj = currentUser;
  if (!userObj) {
    try {
      const savedUser = localStorage.getItem('rogue_carrier_auth_user');
      if (savedUser) userObj = JSON.parse(savedUser);
    } catch (e) {}
  }
  if (userObj && typeof sanitizeUserProfile === 'function') {
    userObj = sanitizeUserProfile(userObj);
  }
  if (userObj) {
    if (userObj.email) headers['X-User-Email'] = userObj.email;
    if (userObj.name && (typeof isGenericPlaceholderName !== 'function' || !isGenericPlaceholderName(userObj.name))) {
      headers['X-User-Name'] = userObj.name;
    }
  }
  return headers;
}

function nodeBelongsToBoardId(node, boardId) {
  if (!node || !boardId) return false;
  if (boardId === 'GenericPool') return (node.category === 'GenericPool' || node.category === 'generic' || node.pool === 'generic');
  if (boardId === 'DeckPool') {
    const cat = node.category || 'KeyChain';
    const varId = node.variationId || '';
    return cat === 'DeckPool' || cat === 'deck' || varId === 'deck_events';
  }
  if (boardId === 'SpeciesPool') {
    const cat = node.category || 'KeyChain';
    const varId = node.variationId || '';
    return cat === 'SpeciesPool' || cat === 'species' || varId === 'species_events';
  }

  const parts = boardId.includes(':') ? boardId.split(':') : boardId.split('__');
  const expectedCat = parts[0] || 'KeyChain';
  const expectedVar = parts[2] || '';

  const cat = node.category || 'KeyChain';
  const varId = node.variationId || '';

  if (cat !== expectedCat) return false;
  if (expectedVar && varId && varId !== expectedVar) return false;
  return true;
}

function dialogueBelongsToBoardId(diag, boardId, activeNodeIds) {
  if (!diag || !boardId) return false;
  const links = Array.isArray(diag.links) ? diag.links : (diag.targetEventId ? [{ targetEventId: diag.targetEventId }] : []);
  const linkedIds = links.map(l => l.targetEventId).filter(Boolean);
  if (diag.targetEventId) linkedIds.push(diag.targetEventId);

  if (linkedIds.length > 0 && activeNodeIds && activeNodeIds.size > 0) {
    return linkedIds.some(eid => activeNodeIds.has(eid));
  }

  if (boardId === 'GenericPool') return (diag.category === 'GenericPool' || diag.category === 'generic' || diag.pool === 'generic');
  if (boardId === 'DeckPool') {
    const cat = diag.category || 'KeyChain';
    const varId = diag.variationId || '';
    return cat === 'DeckPool' || cat === 'deck' || varId === 'deck_events';
  }
  if (boardId === 'SpeciesPool') {
    const cat = diag.category || 'KeyChain';
    const varId = diag.variationId || '';
    return cat === 'SpeciesPool' || cat === 'species' || varId === 'species_events';
  }

  const parts = boardId.includes(':') ? boardId.split(':') : boardId.split('__');
  const expectedCat = parts[0] || 'KeyChain';
  const expectedVar = parts[2] || '';

  const cat = diag.category || 'KeyChain';
  const varId = diag.variationId || '';

  if (cat !== expectedCat) return false;
  if (expectedVar && varId && varId !== expectedVar) return false;
  return true;
}

function getActiveBoardPartitionPayload() {
  const boardId = (typeof getCurrentBoardIdentifier === 'function') ? getCurrentBoardIdentifier() : 'KeyChain:timeline_1:var_v1';
  
  const boardNodes = (appData.nodes || []).filter(n => nodeBelongsToBoardId(n, boardId));
  const activeNodeIds = new Set(boardNodes.map(n => n.id));
  const boardDialogues = (appData.dialogues || []).filter(d => dialogueBelongsToBoardId(d, boardId, activeNodeIds));

  return {
    boardId,
    nodes: boardNodes,
    dialogues: boardDialogues,
    author: (currentUser && currentUser.name) || (appData.projectInfo && appData.projectInfo.author) || 'Editor User',
    timelines: appData.timelines,
    variations: appData.variations,
    stageLayoutVersion: appData.stageLayoutVersion || 2,
    symbolLimits: (appData && appData.symbolLimits) ? appData.symbolLimits : (typeof getSymbolLimits === 'function' ? getSymbolLimits() : undefined),
    recommendedLimits: (appData && appData.recommendedLimits) ? appData.recommendedLimits : (typeof getRecommendedLimits === 'function' ? getRecommendedLimits() : undefined),
    characters: appData.characters,
    criteriaPool: appData.criteriaPool
  };
}

// Syncs only the active board partition from the server into local memory
async function syncBoardFromServer(boardId) {
  if (!boardId) {
    boardId = (typeof getCurrentBoardIdentifier === 'function') ? getCurrentBoardIdentifier() : 'KeyChain:timeline_1:var_v1';
  }
  try {
    const res = await fetch(`/api/board?id=${encodeURIComponent(boardId)}`, {
      headers: getAuthHeaders(false)
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.status !== 'success') return false;

    const serverNodes = data.nodes || [];
    const serverDialogues = data.dialogues || [];

    // Replace active board's slice in appData
    appData.nodes = (appData.nodes || []).filter(n => !nodeBelongsToBoardId(n, boardId)).concat(serverNodes);
    const activeNodeIds = new Set(serverNodes.map(n => n.id));
    appData.dialogues = (appData.dialogues || []).filter(d => !dialogueBelongsToBoardId(d, boardId, activeNodeIds)).concat(serverDialogues);

    normalizeAllProjectData();
    safeLocalStorageSet('rc_narrative_project_v26', JSON.stringify(appData));
    updateStats();
    return true;
  } catch (e) {
    console.warn('[SyncBoard] Network error syncing board:', e);
    return false;
  }
}

// Full manual or automated save triggered by Ctrl+S, Save button, or periodic timer
async function saveCurrentProject(isManual = false, triggerLabel = 'Save') {
  clearTimeout(autoSaveDiskTimer);
  if (!appData || !Array.isArray(appData.nodes)) return;

  const isReadOnly = (typeof isCurrentBoardReadOnly === 'function') 
    ? isCurrentBoardReadOnly() 
    : (typeof isCurrentBoardReadOnly === 'boolean' ? isCurrentBoardReadOnly : false);
  if (isReadOnly) {
    if (isManual) {
      if (typeof requireAuthToEdit === 'function') {
        requireAuthToEdit("save changes to this board");
      } else {
        showToast("🔒 Board is currently in Read-Only mode. Changes cannot be saved to server.", "warning");
      }
    }
    return;
  }

  const currentSig = computeBoardContentSignature(appData);
  const hasContentChanged = (currentSig !== lastSavedContentSignature);
  lastSavedContentSignature = currentSig;

  appData._lastModified = new Date().toISOString();
  // Always keep a local copy in browser storage as well
  safeLocalStorageSet('rc_narrative_project_v26', JSON.stringify(appData));
  updateStats();

  const timeStr = new Date().toLocaleTimeString();
  lastSavedTimestamp = timeStr;

  const btnSave = document.getElementById('btn-save-project');
  if (btnSave && isManual) {
    btnSave.classList.add('save-pulse');
    setTimeout(() => btnSave.classList.remove('save-pulse'), 800);
  }

  const badgeText = document.getElementById('save-status-text');
  const managerSavedText = document.getElementById('save-manager-last-saved');
  if (managerSavedText) managerSavedText.innerText = `(Last saved: ${timeStr})`;

  try {
    if (currentUser && currentUser.name && appData.projectInfo) {
      appData.projectInfo.author = currentUser.name;
    }

    const boardPayload = getActiveBoardPartitionPayload();
    let res = await fetch('/api/save-board', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify(boardPayload)
    });

    if (res.ok) {
      const resp = await res.json();
      if (badgeText) badgeText.innerText = `Saved to Server (${resp.timestamp || timeStr})`;
      if (isManual) {
        showToast(`Saved ${boardPayload.boardId} (${resp.boardNodeCount ?? boardPayload.nodes.length} events) to server`, 'success');
      }
    } else {
      if (badgeText) badgeText.innerText = `Saved Locally (${timeStr})`;
      if (isManual) {
        showToast(`Saved local copy (${timeStr}) — server returned ${res.status}`, 'warning');
      }
    }
  } catch (e) {
    if (badgeText) badgeText.innerText = `Saved Locally (${timeStr})`;
    if (isManual) {
      showToast(`Offline: Saved local copy (${timeStr})`, 'info');
    }
  }

  // Record rolling version snapshot on server disk and local storage if manual or content changed
  if (isManual || hasContentChanged) {
    const author = (currentUser && currentUser.name) || (appData.projectInfo && appData.projectInfo.author) || 'User';
    recordVersionSnapshot(`${triggerLabel} (${timeStr})`, author, false);
  }
}

async function syncProjectToDiskServer() {
  const isReadOnly = (typeof isCurrentBoardReadOnly === 'function') 
    ? isCurrentBoardReadOnly() 
    : (typeof isCurrentBoardReadOnly === 'boolean' ? isCurrentBoardReadOnly : false);
  if (isReadOnly) {
    console.warn("[Storage] Guarded: active board is read-only, suppressing auto-sync to server disk.");
    return;
  }
  const badgeText = document.getElementById('save-status-text');
  try {
    if (currentUser && currentUser.name && appData.projectInfo) {
      appData.projectInfo.author = currentUser.name;
    }

    const boardPayload = getActiveBoardPartitionPayload();
    let res = await fetch('/api/save-board', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify(boardPayload)
    });
    if (!res.ok) {
      res = await fetch('/api/save', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(appData)
      });
    }
    if (res.ok) {
      const resp = await res.json();
      if (badgeText) badgeText.innerText = `Saved to Server (${resp.timestamp || 'Synced'})`;
      return true;
    }
    return false;
  } catch (e) {
    if (badgeText) badgeText.innerText = 'Saved Locally';
    return false;
  }
}

// Stores a version snapshot on server disk (/api/saves) and browser localStorage
async function recordVersionSnapshot(name, author = 'Wild Fields', notify = false) {
  const time = new Date();
  const timestamp = time.toISOString();
  const displayTime = time.toLocaleDateString() + ' ' + time.toLocaleTimeString();
  const boardCounts = countDatasetBlocksForActiveBoard(appData);

  let serverSaveId = `save_${Date.now()}`;

  // 1. Save to server disk /api/saves
  try {
    const res = await fetch('/api/saves', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        name: name,
        author: author,
        data: appData
      })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.save && json.save.id) {
        serverSaveId = json.save.id;
      }
    }
  } catch (e) {
    console.warn("Could not reach /api/saves on server, persisting in localStorage", e);
  }

  const versionMeta = {
    id: serverSaveId,
    name: name,
    author: author,
    timestamp: timestamp,
    displayTime: displayTime,
    nodeCount: boardCounts.eventCount,
    dialogueCount: boardCounts.dialogueCount,
    data: appData
  };

  // 2. Always persist in localStorage as well (local copy & offline fallback)
  try {
    const raw = localStorage.getItem('rc_local_saved_versions');
    let list = raw ? JSON.parse(raw) : [];
    list.unshift({
      id: versionMeta.id,
      name: versionMeta.name,
      author: versionMeta.author,
      timestamp: versionMeta.timestamp,
      displayTime: versionMeta.displayTime,
      nodeCount: versionMeta.nodeCount,
      dialogueCount: versionMeta.dialogueCount,
      data: versionMeta.data
    });
    if (list.length > 60) list = list.slice(0, 60);
    safeLocalStorageSet('rc_local_saved_versions', JSON.stringify(list));
  } catch (e) {
    console.warn("localStorage version store quota reached", e);
  }

  if (notify) {
    showToast(`Version '${name}' saved to server & local copy!`, 'success');
  }
}

async function saveSafetyBackup(reason) {
  try {
    safeLocalStorageSet('rc_safety_backup_v26', JSON.stringify({
      reason,
      timestamp: new Date().toISOString(),
      data: appData
    }));
    await fetch('/api/saves', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        name: `Backup (${reason})`,
        author: 'Auto Backup',
        data: appData
      })
    });
  } catch (e) {
    console.warn("Failed to create safety backup", e);
  }
}

async function fetchAllSavedVersions() {
  let serverSaves = [];
  try {
    const qs = `?category=${encodeURIComponent(activeCategoryFilter)}&variationId=${encodeURIComponent(activeVariationId)}`;
    const res = await fetch(`/api/saves${qs}`, {
      headers: getAuthHeaders(false)
    });
    if (res.ok) {
      const json = await res.json();
      serverSaves = json.saves || [];
    }
  } catch (e) {
    console.warn("Server saves not reachable, using local versions", e);
  }

  let localSaves = [];
  try {
    const raw = localStorage.getItem('rc_local_saved_versions');
    if (raw) localSaves = JSON.parse(raw);
  } catch (e) {}

  const map = new Map();
  serverSaves.forEach(s => {
    map.set(s.id, { ...s, source: 'disk' });
  });
  localSaves.forEach(s => {
    if (!s) return;
    const boardCounts = s.data ? countDatasetBlocksForActiveBoard(s.data) : {
      eventCount: s.nodeCount || 0,
      dialogueCount: s.dialogueCount || 0
    };
    const normalizedLocal = {
      ...s,
      nodeCount: boardCounts.eventCount,
      dialogueCount: boardCounts.dialogueCount,
      source: 'local'
    };
    if (!map.has(s.id)) {
      // Also check if a server save with the exact same name was created at the same time
      const dupServer = serverSaves.find(srv => srv.name === s.name && Math.abs(new Date(srv.timestamp || 0) - new Date(s.timestamp || 0)) < 5000);
      if (!dupServer) {
        map.set(s.id, normalizedLocal);
      }
    }
  });

  const combined = Array.from(map.values());
  combined.sort((a, b) => new Date(b.timestamp || b.displayTime) - new Date(a.timestamp || a.displayTime));
  return combined;
}

let selectedSaveManagerBoardId = null;
let boardSavesCountCache = {};

async function updateActiveBoardSavesBadge() {
  const headerBadge = document.getElementById('header-backups-badge');
  const headerBtn = document.getElementById('btn-header-backups');
  if (!headerBadge) return;

  const boardId = (typeof getCurrentBoardIdentifier === 'function') 
    ? getCurrentBoardIdentifier() 
    : 'KeyChain:timeline_1:var_v1';
  const boardName = (typeof getCurrentBoardDisplayName === 'function') 
    ? getCurrentBoardDisplayName() 
    : 'Selected Board';

  if (boardSavesCountCache[boardId] !== undefined) {
    const count = boardSavesCountCache[boardId];
    headerBadge.innerText = count;
    headerBadge.classList.remove('hidden');
    if (headerBtn) headerBtn.title = `${boardName} Saves (${count})`;
  }

  try {
    const res = await fetch(`/api/saves?boardId=${encodeURIComponent(boardId)}`, {
      headers: (typeof getAuthHeaders === 'function') ? getAuthHeaders(false) : {}
    });
    if (res.ok) {
      const data = await res.json();
      const saves = data.saves || [];
      const count = saves.length;
      boardSavesCountCache[boardId] = count;
      headerBadge.innerText = count;
      headerBadge.classList.remove('hidden');
      if (headerBtn) headerBtn.title = `${boardName} Saves (${count})`;
    }
  } catch (err) {}
}

async function onActiveBoardChanged() {
  const activeBoardId = (typeof getCurrentBoardIdentifier === 'function') 
    ? getCurrentBoardIdentifier() 
    : 'KeyChain:timeline_1:var_v1';

  await updateActiveBoardSavesBadge();

  const modal = document.getElementById('modal-save-manager');
  if (modal && !modal.classList.contains('hidden')) {
    await syncSaveManagerToActiveBoard(activeBoardId);
  }
}

async function syncSaveManagerToActiveBoard(newBoardId) {
  selectedSaveManagerBoardId = newBoardId;
  const picker = document.getElementById('save-manager-board-picker');
  if (picker) {
    if (!Array.from(picker.options).some(o => o.value === newBoardId)) {
      await populateSaveManagerBoardPicker();
    } else {
      Array.from(picker.options).forEach(opt => {
        const cleanName = opt.innerText.replace(' (Active Canvas)', '');
        opt.innerText = cleanName + (opt.value === newBoardId ? ' (Active Canvas)' : '');
        if (opt.value === newBoardId) {
          opt.selected = true;
        }
      });
      picker.value = newBoardId;
    }
  }
  await updateSaveManagerSelectedBoardUI();
  await renderBoardSavedVersionsList();
}

async function openSaveManagerModal(targetTab = 'board') {
  const managerSavedText = document.getElementById('save-manager-last-saved');
  if (managerSavedText) {
    managerSavedText.innerText = lastSavedTimestamp ? `(Last saved: ${lastSavedTimestamp})` : '(Auto-saved)';
  }

  selectedSaveManagerBoardId = (typeof getCurrentBoardIdentifier === 'function') 
    ? getCurrentBoardIdentifier() 
    : 'KeyChain:timeline_1:var_v1';

  openModal('modal-save-manager');
  if (typeof switchSaveManagerTab === 'function') {
    switchSaveManagerTab(targetTab);
  }

  await populateSaveManagerBoardPicker();
}

async function populateSaveManagerBoardPicker() {
  const picker = document.getElementById('save-manager-board-picker');
  if (!picker) return;

  const activeBoardId = (typeof getCurrentBoardIdentifier === 'function') ? getCurrentBoardIdentifier() : 'KeyChain:timeline_1:var_v1';
  if (!selectedSaveManagerBoardId) selectedSaveManagerBoardId = activeBoardId;

  let boards = [];
  try {
    const res = await fetch('/api/boards', { headers: getAuthHeaders(false) });
    if (res.ok) {
      const data = await res.json();
      boards = data.boards || [];
    }
  } catch (e) {
    console.warn("Could not fetch /api/boards, building local list:", e);
  }

  if (boards.length === 0) {
    // Fallback: build from active appData
    const timelines = appData.timelines || [{ id: 'timeline_1', number: 1, name: 'Timeline 1' }];
    const variations = appData.variations || [{ id: 'var_v1', number: 1, name: 'Main Flow', timelineId: 'timeline_1' }];
    timelines.forEach(tl => {
      const tlVars = variations.filter(v => v.timelineId === tl.id);
      const varsToUse = tlVars.length > 0 ? tlVars : [{ id: 'var_v1', number: 1, name: 'Main Flow' }];
      varsToUse.forEach(v => {
        boards.push({ id: `KeyChain:${tl.id}:${v.id}`, name: `T${tl.number || 1} V${v.number || 1}: ${tl.name} — Key Events` });
        boards.push({ id: `SecretChain:${tl.id}:${v.id}`, name: `T${tl.number || 1} V${v.number || 1}: ${tl.name} — Secret Events` });
      });
    });
    boards.push({ id: 'GenericPool', name: 'Generic Pool (World Events)' });
    boards.push({ id: 'DeckPool', name: 'Deck Pool (Carrier Events)' });
    boards.push({ id: 'SpeciesPool', name: 'Species Events (Species Pool)' });
  }

  picker.innerHTML = '';
  boards.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    const isAct = (b.id === activeBoardId);
    opt.innerText = b.name + (isAct ? ' (Active Canvas)' : '');
    if (b.id === selectedSaveManagerBoardId) {
      opt.selected = true;
    }
    picker.appendChild(opt);
  });

  await updateSaveManagerSelectedBoardUI();
  await renderBoardSavedVersionsList();
}

async function onSaveManagerBoardSelected(boardId) {
  selectedSaveManagerBoardId = boardId;
  await updateSaveManagerSelectedBoardUI();
  await renderBoardSavedVersionsList();
}

async function updateSaveManagerSelectedBoardUI() {
  const activeBoardId = (typeof getCurrentBoardIdentifier === 'function') ? getCurrentBoardIdentifier() : 'KeyChain:timeline_1:var_v1';
  const isCanvasActive = (selectedSaveManagerBoardId === activeBoardId);

  const activeCanvasBadge = document.getElementById('save-manager-active-canvas-badge');
  const viewCanvasBtn = document.getElementById('btn-save-manager-view-canvas');
  const lockBadge = document.getElementById('save-manager-board-lock-badge');
  const boardNameText = document.getElementById('save-manager-board-name-text');
  const picker = document.getElementById('save-manager-board-picker');

  const selectedName = picker && picker.selectedOptions[0] ? picker.selectedOptions[0].innerText.replace(' (Active Canvas)', '') : selectedSaveManagerBoardId;
  if (boardNameText) boardNameText.innerText = selectedName;

  if (activeCanvasBadge) {
    if (isCanvasActive) {
      activeCanvasBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1';
      activeCanvasBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active on Canvas';
    } else {
      activeCanvasBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700 flex items-center gap-1';
      activeCanvasBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-gray-500"></span> Other Board';
    }
  }

  if (viewCanvasBtn) {
    viewCanvasBtn.classList.toggle('hidden', isCanvasActive);
  }

  // Check lock status
  if (lockBadge) {
    try {
      const res = await fetch('/api/locks', { headers: getAuthHeaders(false) });
      if (res.ok) {
        const data = await res.json();
        const lock = data.locks && data.locks[selectedSaveManagerBoardId];
        const userEmail = (currentUser && currentUser.email) ? currentUser.email.toLowerCase() : '';
        if (lock && lock.remainingSeconds > 0) {
          const isOwner = (lock.userEmail && lock.userEmail.toLowerCase() === userEmail);
          if (isOwner) {
            lockBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800';
            lockBadge.innerText = '🔒 Locked by You';
          } else {
            lockBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800';
            lockBadge.innerText = `🔒 Locked by ${lock.userName || 'Other'}`;
          }
        } else {
          lockBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700';
          lockBadge.innerText = '🔓 Unlocked';
        }
      }
    } catch (e) {}
  }

  if (window.lucide) lucide.createIcons();
}

function switchCanvasToSelectedBoard() {
  if (!selectedSaveManagerBoardId) return;
  const parts = selectedSaveManagerBoardId.split(':');
  if (selectedSaveManagerBoardId === 'GenericPool') {
    setCategoryFilter('GenericPool');
  } else if (selectedSaveManagerBoardId === 'DeckPool') {
    setCategoryFilter('DeckPool');
  } else if (selectedSaveManagerBoardId === 'SpeciesPool') {
    setCategoryFilter('SpeciesPool');
  } else if (parts.length >= 3) {
    activeCategoryFilter = parts[0];
    activeTimelineId = parts[1];
    activeVariationId = parts[2];
    saveActiveWorkspacePosition();
    renderApp();
    if (typeof syncActiveBoardLock === 'function') syncActiveBoardLock();
  }
  updateSaveManagerSelectedBoardUI();
  populateSaveManagerBoardPicker();
  showToast(`Switched canvas to ${selectedSaveManagerBoardId}`, 'info');
}

async function saveSelectedBoardSnapshot() {
  if (!selectedSaveManagerBoardId) return;
  if (!canUserEdit()) {
    requireAuthToEdit("save this board");
    return;
  }

  const noteInput = document.getElementById('input-board-save-note');
  const note = noteInput ? noteInput.value.trim() : '';
  const activeBoardId = (typeof getCurrentBoardIdentifier === 'function') ? getCurrentBoardIdentifier() : 'KeyChain:timeline_1:var_v1';

  let boardPayload;
  if (selectedSaveManagerBoardId === activeBoardId) {
    boardPayload = getActiveBoardPartitionPayload();
  } else {
    // Pull nodes and dialogues from appData belonging to selected board
    const bNodes = (appData.nodes || []).filter(n => nodeBelongsToBoardId(n, selectedSaveManagerBoardId));
    const bNodeIds = new Set(bNodes.map(n => n.id));
    const bDiags = (appData.dialogues || []).filter(d => dialogueBelongsToBoardId(d, selectedSaveManagerBoardId, bNodeIds));
    boardPayload = {
      boardId: selectedSaveManagerBoardId,
      nodes: bNodes,
      dialogues: bDiags
    };
  }

  if (note) {
    boardPayload.name = note;
    boardPayload.note = note;
  }

  try {
    const res = await fetch('/api/save-board', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify(boardPayload)
    });

    if (res.status === 423) {
      const err = await res.json();
      showToast(`🔒 ${err.message || 'Board is locked by another user!'}`, 'error');
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(`Save failed (${res.status}): ${err.message || 'Unknown error'}`, 'error');
      return;
    }

    const resp = await res.json();
    if (noteInput) noteInput.value = '';
    showToast(`Saved snapshot for ${selectedSaveManagerBoardId} (${resp.boardNodeCount ?? boardPayload.nodes.length} events)`, 'success');
    boardSavesCountCache[selectedSaveManagerBoardId] = (boardSavesCountCache[selectedSaveManagerBoardId] || 0) + 1;
    updateActiveBoardSavesBadge();
    renderBoardSavedVersionsList();
  } catch (err) {
    showToast(`Error saving board: ${err.message}`, 'error');
  }
}

async function exportSelectedBoardJSON() {
  if (!selectedSaveManagerBoardId) return;
  try {
    const res = await fetch(`/api/export-board?id=${encodeURIComponent(selectedSaveManagerBoardId)}`, {
      headers: getAuthHeaders(false)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const cleanFilename = `${selectedSaveManagerBoardId.replace(/[:\\/]/g, '__')}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${cleanFilename} (${data.nodes?.length || 0} events)`, 'success');
  } catch (err) {
    showToast(`Export error: ${err.message}`, 'error');
  }
}

async function handleImportBoardFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file || !selectedSaveManagerBoardId) return;

  if (!canUserEdit()) {
    requireAuthToEdit("import into this board");
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      let nodes = [];
      let dialogues = [];

      if (Array.isArray(parsed)) {
        nodes = parsed;
      } else if (parsed && typeof parsed === 'object') {
        nodes = parsed.nodes || [];
        dialogues = parsed.dialogues || [];
      }

      if (!Array.isArray(nodes)) {
        showToast("Invalid board file format: nodes array missing.", 'error');
        return;
      }

      const confirmed = confirm(
        `IMPORT BOARD CONFIRMATION\n\n` +
        `Target Board: ${selectedSaveManagerBoardId}\n` +
        `File: ${file.name}\n` +
        `Contents: ${nodes.length} Event(s), ${dialogues.length} Dialogue(s)\n\n` +
        `• A safety rollback snapshot of the existing board state will be saved automatically.\n` +
        `• ONLY this target board will be updated.\n` +
        `• ALL other boards are 100% safe and untouched.\n\n` +
        `Proceed with import?`
      );
      if (!confirmed) {
        e.target.value = '';
        return;
      }

      const res = await fetch('/api/import-board', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          boardId: selectedSaveManagerBoardId,
          nodes,
          dialogues,
          note: `Imported from ${file.name}`
        })
      });

      if (res.status === 423) {
        const err = await res.json();
        showToast(`🔒 ${err.message || 'Board is locked by another user!'}`, 'error');
        e.target.value = '';
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(`Import failed (${res.status}): ${err.message || 'Unknown error'}`, 'error');
        e.target.value = '';
        return;
      }

      const resp = await res.json();
      // Update appData slice
      appData.nodes = (appData.nodes || []).filter(n => !nodeBelongsToBoardId(n, selectedSaveManagerBoardId)).concat(nodes);
      const importedNodeIds = new Set(nodes.map(n => n.id));
      appData.dialogues = (appData.dialogues || []).filter(d => !dialogueBelongsToBoardId(d, selectedSaveManagerBoardId, importedNodeIds)).concat(dialogues);

      normalizeAllProjectData();
      safeLocalStorageSet('rc_narrative_project_v26', JSON.stringify(appData));
      updateStats();

      const activeBoardId = (typeof getCurrentBoardIdentifier === 'function') ? getCurrentBoardIdentifier() : 'KeyChain:timeline_1:var_v1';
      if (selectedSaveManagerBoardId === activeBoardId) {
        renderApp();
        fitWholeSchematic();
      }

      showToast(`Imported ${nodes.length} events into ${selectedSaveManagerBoardId}. Other boards safe!`, 'success');
      boardSavesCountCache[selectedSaveManagerBoardId] = (boardSavesCountCache[selectedSaveManagerBoardId] || 0) + 1;
      updateActiveBoardSavesBadge();
      renderBoardSavedVersionsList();
    } catch (parseErr) {
      showToast(`Error parsing JSON: ${parseErr.message}`, 'error');
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
}

async function renderBoardSavedVersionsList() {
  const container = document.getElementById('saved-board-versions-list');
  const countEl = document.getElementById('save-manager-board-save-count');
  if (!container) return;

  const targetBoardId = selectedSaveManagerBoardId || ((typeof getCurrentBoardIdentifier === 'function') ? getCurrentBoardIdentifier() : 'KeyChain:timeline_1:var_v1');

  container.innerHTML = '<div class="text-center py-6 text-gray-500 flex items-center justify-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-cyan-400"></i> Loading board saves...</div>';
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch(`/api/saves?boardId=${encodeURIComponent(targetBoardId)}`, {
      headers: getAuthHeaders(false)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const saves = data.saves || [];

    if (countEl) countEl.innerText = `${saves.length} save${saves.length === 1 ? '' : 's'}`;

    boardSavesCountCache[targetBoardId] = saves.length;
    const activeBoardId = (typeof getCurrentBoardIdentifier === 'function') ? getCurrentBoardIdentifier() : 'KeyChain:timeline_1:var_v1';
    if (targetBoardId === activeBoardId) {
      const headerBadge = document.getElementById('header-backups-badge');
      if (headerBadge) {
        headerBadge.innerText = saves.length;
        headerBadge.classList.remove('hidden');
      }
    }

    if (saves.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 bg-gray-950/60 rounded-xl border border-dashed border-gray-800 text-gray-400">
          <i data-lucide="layers" class="w-8 h-8 text-cyan-500/40 mx-auto mb-2"></i>
          <p class="font-semibold text-gray-300">No revisions found for ${targetBoardId}</p>
          <p class="text-[11px] text-gray-500 mt-1">Click <strong>Save Snapshot</strong> above to create the first point-in-time version.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = '';
    saves.forEach((s) => {
      const card = document.createElement('div');
      card.className = 'board-save-item bg-gray-900/80 hover:bg-gray-900 border border-gray-800 hover:border-cyan-700/60 rounded-xl p-3 flex items-center justify-between gap-3 transition shadow-sm';
      card.innerHTML = `
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-white text-xs truncate">${s.name || 'Board Save'}</span>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              ${s.boardId || targetBoardId}
            </span>
            <span class="text-[10px] text-gray-400 bg-gray-800/80 px-1.5 py-0.5 rounded border border-gray-700">
              ${s.author || 'User'}
            </span>
          </div>
          <div class="flex items-center gap-3 text-[11px] text-gray-400 mt-1">
            <span>🕒 ${s.displayTime || s.timestamp || 'Recent'}</span>
            <span>•</span>
            <span class="text-amber-400 font-semibold">${s.nodeCount || 0} Events</span>
            <span>•</span>
            <span class="text-purple-400 font-semibold">${s.dialogueCount || 0} Dialogues</span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button class="btn-restore-board-ver bg-cyan-700 hover:bg-cyan-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow active:scale-95 transition" title="Restore this revision into ${targetBoardId}">
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Restore
          </button>
        </div>
      `;

      card.querySelector('.btn-restore-board-ver').onclick = () => restoreBoardVersion(s.id, s.name, targetBoardId);
      container.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<div class="text-center py-6 text-red-400 text-xs">Failed to load board revisions: ${err.message}</div>`;
  }
}

async function restoreBoardVersion(saveId, saveName = 'Board Save', overrideBoardId = null) {
  const boardId = overrideBoardId || selectedSaveManagerBoardId || ((typeof getCurrentBoardIdentifier === 'function') ? getCurrentBoardIdentifier() : 'KeyChain:timeline_1:var_v1');

  if (!canUserEdit()) {
    requireAuthToEdit("restore this board");
    return;
  }

  const confirmed = confirm(
    `RESTORE BOARD REVISION\n\n` +
    `Revision: "${saveName}"\n` +
    `Target: ${boardId}\n\n` +
    `• ONLY events and dialogues in ${boardId} will be restored.\n` +
    `• ALL other boards are 100% safe and untouched.\n\n` +
    `Proceed?`
  );
  if (!confirmed) return;

  try {
    const res = await fetch('/api/restore-board', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ boardId, saveId })
    });

    if (res.status === 423) {
      const err = await res.json();
      showToast(`🔒 ${err.message || 'Board is locked by another user!'}`, 'error');
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.message || 'Failed to restore board save.', 'error');
      return;
    }

    const data = await res.json();
    const restoredNodes = data.nodes || [];
    const restoredDialogues = data.dialogues || [];

    // Replace target board's slice in appData
    appData.nodes = (appData.nodes || []).filter(n => !nodeBelongsToBoardId(n, boardId)).concat(restoredNodes);
    const restoredNodeIds = new Set(restoredNodes.map(n => n.id));
    appData.dialogues = (appData.dialogues || []).filter(d => !dialogueBelongsToBoardId(d, boardId, restoredNodeIds)).concat(restoredDialogues);

    normalizeAllProjectData();
    safeLocalStorageSet('rc_narrative_project_v26', JSON.stringify(appData));
    updateStats();

    const activeBoardId = (typeof getCurrentBoardIdentifier === 'function') ? getCurrentBoardIdentifier() : 'KeyChain:timeline_1:var_v1';
    if (boardId === activeBoardId) {
      renderApp();
      fitWholeSchematic();
    }
    showToast(`Restored ${saveName} for ${boardId} (${restoredNodes.length} events). Other boards kept intact!`, 'success');
    renderBoardSavedVersionsList();
  } catch (e) {
    showToast(`Error restoring board: ${e.message}`, 'error');
  }
}

window.populateSaveManagerBoardPicker = populateSaveManagerBoardPicker;
window.onSaveManagerBoardSelected = onSaveManagerBoardSelected;
window.updateSaveManagerSelectedBoardUI = updateSaveManagerSelectedBoardUI;
window.switchCanvasToSelectedBoard = switchCanvasToSelectedBoard;
window.saveSelectedBoardSnapshot = saveSelectedBoardSnapshot;
window.exportSelectedBoardJSON = exportSelectedBoardJSON;
window.handleImportBoardFile = handleImportBoardFile;
window.renderBoardSavedVersionsList = renderBoardSavedVersionsList;
window.restoreBoardVersion = restoreBoardVersion;

async function renderSavedVersionsList() {
  const container = document.getElementById('saved-versions-list');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-4 text-gray-500 flex items-center justify-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-cyan-400"></i> Loading saved versions...</div>';
  if (window.lucide) lucide.createIcons();

  const saves = await fetchAllSavedVersions();

  if (saves.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 bg-gray-950/60 rounded-lg border border-dashed border-gray-800 text-gray-400">
        <i data-lucide="hard-drive" class="w-8 h-8 text-gray-600 mx-auto mb-2"></i>
        <p class="font-semibold text-gray-300">No saved versions yet</p>
        <p class="text-[11px] text-gray-500 mt-1">Press <strong>Ctrl + S</strong> or enter a name above and click 'Store Version'.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = '';
  saves.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'save-version-card';
    card.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-white text-xs truncate">${s.name || 'Untitled Version'}</span>
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded ${s.source === 'disk' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-cyan-950 text-cyan-300 border border-cyan-800'}">
            ${s.source === 'disk' ? '☁️ Server & Local' : '🌐 Local Copy'}
          </span>
          <span class="text-[10px] text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
            ${s.author || 'User'}
          </span>
        </div>
        <div class="flex items-center gap-3 text-[11px] text-gray-400 mt-1">
          <span>🕒 ${s.displayTime || s.timestamp || 'Recent'}</span>
          <span>•</span>
          <span class="text-amber-400 font-semibold">${s.nodeCount || 0} Events</span>
          <span>•</span>
          <span class="text-purple-400 font-semibold">${s.dialogueCount || 0} Dialogues</span>
        </div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button class="btn-load-this-version bg-cyan-700 hover:bg-cyan-600 text-white font-bold px-2.5 py-1 rounded text-xs flex items-center gap-1 shadow" title="Load and restore this version into editor">
          <i data-lucide="play" class="w-3 h-3 fill-current"></i> Load
        </button>
        <button class="btn-download-this-version bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-2 py-1 rounded text-xs" title="Download version as JSON file">
          <i data-lucide="download" class="w-3.5 h-3.5"></i>
        </button>
        <button class="btn-delete-this-version bg-gray-800 hover:bg-red-900/60 text-gray-400 hover:text-red-300 px-2 py-1 rounded text-xs" title="Delete this version">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    card.querySelector('.btn-load-this-version').onclick = () => loadSpecificVersion(s.id, s.name, s.filename);
    card.querySelector('.btn-download-this-version').onclick = () => downloadSpecificVersion(s.id, s.name, s.filename);
    card.querySelector('.btn-delete-this-version').onclick = () => deleteSpecificVersion(s.id, s.name, s.filename);

    container.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

async function loadSpecificVersion(saveId, saveName, filename) {
  if (!confirm(`Load version '${saveName}' into the canvas?\n\nAny unsaved changes will be replaced. A safety backup of your current canvas will be created automatically.`)) {
    return;
  }

  await saveSafetyBackup("Before loading " + saveName);

  let loadedData = null;

  try {
    const fn = filename || `${saveId}.json`;
    const res = await fetch(`/api/saves/${fn}`, { headers: getAuthHeaders(false) });
    if (res.ok) {
      const json = await res.json();
      loadedData = json.data || json;
    }
  } catch (e) {
    console.warn("Could not load from server disk, checking localStorage", e);
  }

  if (!loadedData) {
    try {
      const raw = localStorage.getItem('rc_local_saved_versions');
      if (raw) {
        const list = JSON.parse(raw);
        const item = list.find(s => s.id === saveId);
        if (item && item.data) loadedData = item.data;
      }
    } catch (e) {}
  }

  if (loadedData && (loadedData.nodes || loadedData.timelines)) {
    pushUndoState();
    appData = loadedData;
    normalizeAllProjectData();
    saveProjectToLocalStorage();
    renderApp();
    fitWholeSchematic();
    closeModal('modal-save-manager');
    showToast(`Loaded version '${saveName}' successfully!`, 'success');
  } else {
    alert(`Could not load version data for '${saveName}'.`);
  }
}

async function downloadSpecificVersion(saveId, saveName, filename) {
  let dataToDownload = null;
  try {
    const fn = filename || `${saveId}.json`;
    const res = await fetch(`/api/saves/${fn}`, { headers: getAuthHeaders(false) });
    if (res.ok) {
      dataToDownload = await res.json();
    }
  } catch (e) {}

  if (!dataToDownload) {
    try {
      const raw = localStorage.getItem('rc_local_saved_versions');
      if (raw) {
        const list = JSON.parse(raw);
        const item = list.find(s => s.id === saveId);
        if (item) dataToDownload = item;
      }
    } catch (e) {}
  }

  if (!dataToDownload) dataToDownload = appData;

  const jsonStr = JSON.stringify(dataToDownload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${saveName.replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function deleteSpecificVersion(saveId, saveName, filename) {
  if (!confirm(`Delete saved version '${saveName}'? This cannot be undone.`)) return;

  try {
    const fn = filename || `${saveId}.json`;
    await fetch(`/api/saves/${fn}`, { method: 'DELETE', headers: getAuthHeaders(false) });
  } catch (e) {}

  try {
    const raw = localStorage.getItem('rc_local_saved_versions');
    if (raw) {
      let list = JSON.parse(raw);
      list = list.filter(s => s.id !== saveId);
      safeLocalStorageSet('rc_local_saved_versions', JSON.stringify(list));
    }
  } catch (e) {}

  showToast(`Deleted version '${saveName}'`, 'info');
  renderSavedVersionsList();
}

function handleLoadProjectFromFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const projectPayload = parsed.data || parsed;
      if (!projectPayload || (!projectPayload.nodes && !projectPayload.timelines)) {
        alert("Invalid project file: missing nodes or timelines data.");
        return;
      }

      if (!confirm(`Load project from '${file.name}' into editor?\n\nA safety backup of your current canvas will be created first.`)) {
        event.target.value = '';
        return;
      }

      await saveSafetyBackup("Before importing " + file.name);

      pushUndoState();
      appData = projectPayload;
      normalizeAllProjectData();
      saveProjectToLocalStorage();
      renderApp();
      fitWholeSchematic();
      closeModal('modal-save-manager');
      showToast(`Loaded '${file.name}' successfully!`, 'success');
    } catch (err) {
      alert("Error parsing JSON file: " + err.message);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}


/* ==========================================================================
   SYMBOL COUNT TRACKING & LIMITATIONS ENGINE + CRITERIA + MULTI-TARGET LINKS
   ========================================================================== */
const DEFAULT_SYMBOL_LIMITS = {
  eventIntro: 475,
  eventDescription: 475,
  actionDescription: 120,
  actionDescription3Opt: 200,
  actionButtonText: 24,
  eventOutcome: 925,
  inactionResult: 475,
  variationDescription: 280
};

const DEFAULT_RECOMMENDED_LIMITS = {
  eventIntro: 120,
  eventDescription: 180,
  actionDescription: 40,
  actionDescription3Opt: 60,
  actionButtonText: 8,
  eventOutcome: 200,
  inactionResult: 120,
  variationDescription: 80
};

const SYMBOL_LIMIT_FIELD_CONFIGS = [
  { key: 'eventIntro', label: 'Event Intro', max: 475, rec: 120 },
  { key: 'eventDescription', label: 'Event Description', max: 475, rec: 180 },
  { key: 'actionDescription', label: 'Action Description / Event Choice (2 Options)', max: 120, rec: 40 },
  { key: 'actionDescription3Opt', label: 'Action Description / Event Choice (3 Options)', max: 200, rec: 60 },
  { key: 'actionButtonText', label: 'Action Button Text', max: 24, rec: 8 },
  { key: 'eventOutcome', label: 'Event Outcome (Action Result)', max: 925, rec: 200 },
  { key: 'inactionResult', label: 'Event Inaction Result', max: 475, rec: 120 },
  { key: 'variationDescription', label: 'Variation Description (Timeline Editor)', max: 280, rec: 80 }
];

function getActionChoiceLimitKey(node) {
  const count = (node && Array.isArray(node.actions)) ? node.actions.length : 0;
  return count >= 3 ? 'actionDescription3Opt' : 'actionDescription';
}

function getSymbolLimits() {
  let savedLocal = {};
  try {
    const raw = localStorage.getItem('rc_symbol_limits');
    if (raw) savedLocal = JSON.parse(raw) || {};
  } catch (e) {}
  const fromProject = (appData && appData.symbolLimits && typeof appData.symbolLimits === 'object') ? appData.symbolLimits : {};
  const merged = { ...DEFAULT_SYMBOL_LIMITS, ...savedLocal, ...fromProject };
  Object.keys(DEFAULT_SYMBOL_LIMITS).forEach(k => {
    const n = parseInt(merged[k], 10);
    merged[k] = (!isNaN(n) && n > 0) ? n : DEFAULT_SYMBOL_LIMITS[k];
  });
  return merged;
}

function getRecommendedLimits() {
  let savedLocal = {};
  try {
    const raw = localStorage.getItem('rc_recommended_limits');
    if (raw) savedLocal = JSON.parse(raw) || {};
  } catch (e) {}
  const fromProject = (appData && appData.recommendedLimits && typeof appData.recommendedLimits === 'object')
    ? appData.recommendedLimits
    : ((appData && appData.symbolLimits && typeof appData.symbolLimits === 'object') ? appData.symbolLimits : {});
  const merged = { ...DEFAULT_RECOMMENDED_LIMITS, ...savedLocal, ...fromProject };
  Object.keys(DEFAULT_RECOMMENDED_LIMITS).forEach(k => {
    const candidate = fromProject[k + '_rec'] !== undefined ? fromProject[k + '_rec'] : (fromProject[k] !== undefined && fromProject[k] < DEFAULT_SYMBOL_LIMITS[k] ? fromProject[k] : undefined);
    const val = fromProject[k] !== undefined ? fromProject[k] : (candidate !== undefined ? candidate : savedLocal[k]);
    const n = parseInt(val, 10);
    merged[k] = (!isNaN(n) && n >= 0) ? n : DEFAULT_RECOMMENDED_LIMITS[k];
  });
  return merged;
}

function getSymbolLimitKeyForFieldPath(fieldPath, node = null) {
  if (!fieldPath) return null;
  if (fieldPath === 'eventIntro') return 'eventIntro';
  if (fieldPath === 'eventDescription') return 'eventDescription';
  if (/^actions\.\d+\.description$/.test(fieldPath)) return getActionChoiceLimitKey(node);
  if (/^actions\.\d+\.shortDescription$/.test(fieldPath)) return 'actionButtonText';
  if (/^actions\.\d+\.resultDescription$/.test(fieldPath)) return 'eventOutcome';
  if (fieldPath === 'inactionThreat.resultDescription') return 'inactionResult';
  if (fieldPath === 'variationDescription') return 'variationDescription';
  return null;
}

function isFieldTextOverLimit(text, limitKey) {
  const limits = getSymbolLimits();
  const limit = limits[limitKey] || DEFAULT_SYMBOL_LIMITS[limitKey] || 475;
  const count = (text !== undefined && text !== null) ? String(text).length : 0;
  return count > limit;
}

function isFieldTextUnderRecommended(text, limitKey) {
  const recs = getRecommendedLimits();
  const rec = recs[limitKey] || DEFAULT_RECOMMENDED_LIMITS[limitKey] || 0;
  const count = (text !== undefined && text !== null) ? String(text).length : 0;
  return count > 0 && count < rec;
}

function getSymbolCounterBadgeHTML(text, limitKey, isDarkBg = false, extraId = '') {
  const limits = getSymbolLimits();
  const recs = getRecommendedLimits();
  const limit = limits[limitKey] || DEFAULT_SYMBOL_LIMITS[limitKey] || 475;
  const rec = recs[limitKey] || DEFAULT_RECOMMENDED_LIMITS[limitKey] || 0;
  const count = (text !== undefined && text !== null) ? String(text).length : 0;
  const isOver = count > limit;
  const isUnder = count > 0 && count < rec;
  const idAttr = extraId ? `id="${extraId}"` : '';
  const tooltip = `Symbol count: ${count} / ${limit} (Recommended min: ${rec})${isOver ? ' (LIMIT SURPASSED!)' : (isUnder ? ' (Below recommended length)' : '')}`;
  return `<span ${idAttr} class="symbol-count-badge ${isDarkBg ? 'is-dark-bg' : ''} ${isOver ? 'is-over-limit' : (isUnder ? 'is-under-rec' : '')}" data-limit-key="${limitKey}" title="${tooltip}">${count}/${limit}<span class="symbol-rec-tag" title="Recommended minimum"> (rec: ${rec})</span></span>`;
}

function ensureSymbolLimitsModalFields() {
  const modal = document.getElementById('modal-symbol-limits');
  if (!modal) return;
  const grid = modal.querySelector('.grid');
  if (!grid) return;

  const limits = getSymbolLimits();
  const recs = getRecommendedLimits();

  grid.innerHTML = SYMBOL_LIMIT_FIELD_CONFIGS.map(cfg => {
    const k = cfg.key;
    const maxVal = limits[k] !== undefined ? limits[k] : cfg.max;
    const recVal = recs[k] !== undefined ? recs[k] : cfg.rec;
    return `
      <div class="bg-gray-950 p-3 rounded-xl border border-gray-800 flex flex-col justify-between">
        <label class="text-[11px] font-bold uppercase text-amber-300 block mb-2">${cfg.label}</label>
        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <span class="text-[9px] uppercase tracking-wider text-gray-400 font-bold block mb-1">Max Limit</span>
            <div class="flex items-center gap-1.5">
              <input type="number" id="limit-input-${k}" min="1" class="w-full bg-gray-900 border border-gray-700 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none" value="${maxVal}">
              <span class="text-[10px] text-gray-500 font-mono shrink-0">sym</span>
            </div>
          </div>
          <div>
            <span class="text-[9px] uppercase tracking-wider text-cyan-400 font-bold block mb-1">Recommended (Min)</span>
            <div class="flex items-center gap-1.5">
              <input type="number" id="limit-rec-input-${k}" min="0" class="w-full bg-gray-900 border border-cyan-700/60 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-cyan-200 focus:outline-none" value="${recVal}">
              <span class="text-[10px] text-gray-500 font-mono shrink-0">sym</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openSymbolLimitsModal() {
  ensureSymbolLimitsModalFields();
  const limits = getSymbolLimits();
  const recs = getRecommendedLimits();
  SYMBOL_LIMIT_FIELD_CONFIGS.forEach(cfg => {
    const k = cfg.key;
    const inp = document.getElementById(`limit-input-${k}`);
    if (inp) inp.value = limits[k] !== undefined ? limits[k] : cfg.max;
    const recInp = document.getElementById(`limit-rec-input-${k}`);
    if (recInp) recInp.value = recs[k] !== undefined ? recs[k] : cfg.rec;
  });
  openModal('modal-symbol-limits');
  if (window.lucide) lucide.createIcons();
}

function saveSymbolLimitsFromModal() {
  const currentLimits = getSymbolLimits();
  const currentRecs = getRecommendedLimits();
  const updatedLimits = { ...currentLimits };
  const updatedRecs = { ...currentRecs };

  SYMBOL_LIMIT_FIELD_CONFIGS.forEach(cfg => {
    const k = cfg.key;
    const inp = document.getElementById(`limit-input-${k}`);
    if (inp) {
      const val = parseInt(inp.value, 10);
      updatedLimits[k] = (!isNaN(val) && val > 0) ? val : cfg.max;
    }
    const recInp = document.getElementById(`limit-rec-input-${k}`);
    if (recInp) {
      const val = parseInt(recInp.value, 10);
      updatedRecs[k] = (!isNaN(val) && val >= 0) ? val : cfg.rec;
    }
  });

  if (appData) {
    appData.symbolLimits = updatedLimits;
    appData.recommendedLimits = updatedRecs;
  }
  try {
    localStorage.setItem('rc_symbol_limits', JSON.stringify(updatedLimits));
    localStorage.setItem('rc_recommended_limits', JSON.stringify(updatedRecs));
  } catch (e) {}

  saveProjectToLocalStorage();
  if (typeof saveCurrentProject === 'function') {
    saveCurrentProject(true, 'Character Limits Saved');
  }
  closeModal('modal-symbol-limits');
  const timelinesModal = document.getElementById('modal-timelines');
  if (timelinesModal && !timelinesModal.classList.contains('hidden')) {
    renderTimelinesManager();
  }
  renderApp();
  showToast("Symbol maximum & recommended limits saved!", "success");
}

function resetSymbolLimitsToDefault() {
  SYMBOL_LIMIT_FIELD_CONFIGS.forEach(cfg => {
    const k = cfg.key;
    const inp = document.getElementById(`limit-input-${k}`);
    if (inp) inp.value = cfg.max;
    const recInp = document.getElementById(`limit-rec-input-${k}`);
    if (recInp) recInp.value = cfg.rec;
  });
  showToast("Reset inputs to default symbol limits — click Save Limits to apply", "info");
}

window.openSymbolLimitsModal = openSymbolLimitsModal;
window.saveSymbolLimitsFromModal = saveSymbolLimitsFromModal;
window.resetSymbolLimitsToDefault = resetSymbolLimitsToDefault;

// Multi-Target Action Link Helpers (allows 1 action to link to multiple downstream events, or loop back to itself)
function getActionTargetIds(act, sourceNodeId = null) {
  if (!act) return [];
  const rawList = [];
  if (Array.isArray(act.targetNodeIds)) {
    act.targetNodeIds.forEach(id => {
      if (id && typeof id === 'string') rawList.push(id);
    });
  }
  if (act.targetNodeId && typeof act.targetNodeId === 'string' && !rawList.includes(act.targetNodeId)) {
    rawList.unshift(act.targetNodeId);
  }
  const existingNodeIds = new Set(((appData && appData.nodes) || []).map(n => n.id));
  const seen = new Set();
  const valid = [];
  rawList.forEach(id => {
    if (existingNodeIds.size > 0 && !existingNodeIds.has(id)) return;
    if (!seen.has(id)) {
      seen.add(id);
      valid.push(id);
    }
  });
  act.targetNodeIds = valid;
  act.targetNodeId = valid[0] || null;
  return valid;
}

function addActionTargetId(act, targetId, sourceNodeId = null) {
  if (!act || !targetId) return false;
  const current = getActionTargetIds(act, sourceNodeId);
  if (!current.includes(targetId)) {
    current.push(targetId);
  }
  act.targetNodeIds = current;
  act.targetNodeId = current[0] || null;
  return true;
}

function removeActionTargetId(act, targetId = null, sourceNodeId = null) {
  if (!act) return;
  if (!targetId) {
    act.targetNodeIds = [];
    act.targetNodeId = null;
    return;
  }
  const current = getActionTargetIds(act, sourceNodeId).filter(id => id !== targetId);
  act.targetNodeIds = current;
  act.targetNodeId = current[0] || null;
}

// Criteria (Story Flags / Textual Variables) Helpers
function isCriteriaObject(item) {
  if (!item) return false;
  if (typeof item === 'object') {
    return item.category === 'Criteria' || item.kind === 'criteria' || String(item.resourceId || '').startsWith('criteria_');
  }
  if (typeof item === 'string') {
    return item.trim().startsWith('🔑') || item.trim().toLowerCase().startsWith('criteria:');
  }
  return false;
}

function isStatusEffectObject(item) {
  if (!item) return false;
  if (typeof item === 'object') {
    return Boolean(
      item.isStatusEffect || 
      item.kind === 'status_effect' || 
      item.category === 'Status Effect' || 
      String(item.resourceId || '').startsWith('status_effect_') ||
      (window.statusEffectsCatalog && window.statusEffectsCatalog.some(se => se.id === item.resourceId || (item.name && se.name.toLowerCase() === item.name.toLowerCase())))
    );
  }
  if (typeof item === 'string') {
    return item.trim().startsWith('✨') || (window.statusEffectsCatalog && window.statusEffectsCatalog.some(se => se.name.toLowerCase() === item.trim().toLowerCase()));
  }
  return false;
}
window.isStatusEffectObject = isStatusEffectObject;

function getGlobalCriteriaPool() {
  if (!appData) return ['Orange Box'];
  if (!Array.isArray(appData.criteriaPool)) {
    appData.criteriaPool = ['Orange Box'];
  }
  const seen = new Map();
  const addName = (rawName) => {
    const clean = String(rawName || '').replace(/^🔑\s*/, '').replace(/^criteria:\s*/i, '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (!seen.has(key)) seen.set(key, clean);
  };
  appData.criteriaPool.forEach(addName);
  if (seen.size === 0) addName('Orange Box');

  // Also scan all nodes' requirements and rewards for any Criteria items
  (appData.nodes || []).forEach(n => {
    (n.actions || []).forEach(act => {
      (act.requirements || []).forEach(clause => {
        const items = (clause && Array.isArray(clause.items)) ? clause.items : [clause];
        items.forEach(it => {
          if (isCriteriaObject(it)) addName(typeof it === 'object' ? it.name : it);
        });
      });
      (act.rewards || []).forEach(rw => {
        if (isCriteriaObject(rw)) addName(typeof rw === 'object' ? rw.name : rw);
      });
    });
  });

  appData.criteriaPool = Array.from(seen.values());
  return appData.criteriaPool;
}

// Format Reward & Penalty Pills with Resource Icons, Ranges, Criteria Flags & Deck Status Effects
function formatRewardPillHTML(rw, nodeId, actionIdx, rwIdx, isPenalty = false) {
  if (isCriteriaObject(rw)) {
    const rawName = typeof rw === 'object' ? (rw.name || 'Criteria') : String(rw).replace(/^🔑\s*/, '').replace(/^criteria:\s*/i, '').trim();
    const removeFn = isPenalty
      ? `removeInactionPenalty('${nodeId}', ${rwIdx})`
      : `removeRewardItem('${nodeId}', ${actionIdx}, ${rwIdx})`;
    const editFn = isPenalty
      ? `openResourcePickerModal('${nodeId}', -1, 'inaction_penalty', ${rwIdx})`
      : `openResourcePickerModal('${nodeId}', ${actionIdx}, 'reward', ${rwIdx})`;
    return `
      <span class="req-pill criteria-pill inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
            onclick="event.stopPropagation(); ${editFn}"
            title="Story Criteria Flag (Textual Variable) — Click to change">
        <span class="text-xs">🔑</span>
        <span class="text-[9px] font-mono font-extrabold uppercase px-1 py-0.2 rounded bg-fuchsia-200/90 text-fuchsia-950 border border-fuchsia-400">Criteria</span>
        <span class="font-bold text-fuchsia-950">${rawName}</span>
        <button type="button" class="req-remove-btn" title="Remove criteria"
                onclick="event.stopPropagation(); event.preventDefault(); ${removeFn}">×</button>
      </span>
    `;
  }

  if (isStatusEffectObject(rw)) {
    let name = '';
    let category = '';
    let target = '';
    let effect = '';
    let effectType = '';
    let posNeg = isPenalty ? 'negative' : 'positive';
    let iconImg = '';
    let amount = '';
    let hasN = false;
    let species = '';

    if (typeof rw === 'object' && rw !== null) {
      name = rw.name || 'Status Effect';
      category = rw.effectCategory || rw.category || '';
      target = rw.target || '';
      effect = rw.effect || '';
      effectType = rw.effectType || '';
      posNeg = rw.posNeg || (isPenalty ? 'negative' : 'positive');
      iconImg = rw.iconImg || '';
      amount = rw.amount !== undefined ? String(rw.amount) : (rw.nValue !== undefined ? String(rw.nValue) : '');
      hasN = Boolean(rw.hasN || (rw.nValue !== undefined && rw.nValue !== '') || /(\bN\b|\{N\})/.test(effect));
      species = rw.species || '';
    } else {
      name = String(rw).replace(/^✨\s*/, '').trim();
    }

    const catalog = window.statusEffectsCatalog || [];
    const matched = catalog.find(se => 
      (rw && rw.resourceId && se.id === rw.resourceId) || 
      (se.name && se.name.toLowerCase() === name.toLowerCase()) ||
      (rw && rw.rawName && se.name.toLowerCase() === rw.rawName.toLowerCase())
    );
    if (matched) {
      if (!iconImg) iconImg = matched.iconImg || '';
      if (!category || category === 'Status Effect') category = matched.category || '';
      if (!target) target = matched.target || '';
      if (!effect) effect = matched.effect || '';
      if (!effectType) effectType = matched.effectType || '';
      if (!posNeg && !isPenalty) posNeg = matched.posNeg || 'positive';
      if (!hasN && (matched.hasN || /(\bN\b|\{N\})/.test(matched.effect || '') || /(\bN\b|\{N\})/.test(matched.name || ''))) {
        hasN = true;
      }
    }

    if (species) {
      name = name.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, species);
      target = target.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, species);
      effect = effect.replace(/\{SpeciesName\}|\{Species\}|SpeciesName|Species/gi, species);
    }
    if (hasN && amount) {
      name = name.replace(/\{N\}/g, amount).replace(/\bN\b/g, amount);
      effect = effect.replace(/\{N\}/g, amount).replace(/\bN\b/g, amount);
    }

    // Strip all leftover { } brackets completely
    name = (name || '').replace(/[{}]/g, '').trim();
    target = (target || '').replace(/[{}]/g, '').trim();
    effect = (effect || '').replace(/[{}]/g, '').trim();
    category = (category || '').replace(/[{}]/g, '').trim();
    effectType = (effectType || '').replace(/[{}]/g, '').trim();

    const isNeg = isPenalty || (posNeg === 'negative');
    const pillBorder = isNeg
      ? 'border-rose-500/80 bg-rose-950/30 hover:bg-rose-900/40 text-rose-200'
      : 'border-teal-500/80 bg-teal-950/30 hover:bg-teal-900/40 text-teal-200';

    const removeFn = isPenalty
      ? `removeInactionPenalty('${nodeId}', ${rwIdx})`
      : `removeRewardItem('${nodeId}', ${actionIdx}, ${rwIdx})`;
    const editFn = isPenalty
      ? `openResourcePickerModal('${nodeId}', -1, 'inaction_penalty', ${rwIdx})`
      : `openResourcePickerModal('${nodeId}', ${actionIdx}, 'reward', ${rwIdx})`;

    const tooltipLines = [
      `Name: ${name}`,
      category ? `Category: ${category}` : '',
      target ? `Target: ${target}` : '',
      effect ? `Effect: ${effect}` : '',
      effectType ? `Effect Type: ${effectType}` : ''
    ].filter(Boolean).join('\n');

    const iconMarkup = iconImg ? `
      <img src="${iconImg}" alt="${name}" class="w-4 h-4 object-contain inline-block shrink-0 mr-1 drop-shadow-xs" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline';">
      <span style="display:none;" class="mr-1 shrink-0 text-xs">${isPenalty ? '⚡' : '✨'}</span>
    ` : `<span class="mr-1 shrink-0 text-xs">${isPenalty ? '⚡' : '✨'}</span>`;

    // Only show number where applicable (instead of buff/debuff)
    let numberBadge = '';
    const badgeAmount = (amount && amount !== '') ? amount : (hasN ? (rw.nValue || (effect.match(/for\s+(\d+)\s+hours/i)?.[1]) || '24') : '');
    if (badgeAmount) {
      if (typeof rw === 'object' && rw !== null) {
        if (!rw.amount) rw.amount = badgeAmount;
        if (!rw.nValue) rw.nValue = badgeAmount;
        rw.hasN = true;
      }
      const numBadgeStyle = isNeg
        ? 'bg-rose-950/90 text-rose-300 border-rose-500/60'
        : 'bg-teal-950/90 text-teal-300 border-teal-500/60';
      numberBadge = `<span class="text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded border ${numBadgeStyle}">${badgeAmount}</span>`;
    }

    const seMetaJson = JSON.stringify({ name, category, target, effect, effectType, posNeg: isNeg ? 'negative' : 'positive', iconImg, species, amount, hasN }).replace(/"/g, '&quot;');

    return `
      <span class="req-pill inline-flex items-center gap-1 cursor-pointer transition shadow-2xs ${pillBorder}"
            onclick="event.stopPropagation(); ${editFn}"
            title="${tooltipLines.replace(/"/g, '&quot;')}"
            data-status-effect-name="${name.replace(/"/g, '&quot;')}"
            onmouseenter="if(window.showStatusEffectFloatingTooltip) window.showStatusEffectFloatingTooltip(JSON.parse('${seMetaJson.replace(/'/g, "\\'")}'), event)"
            onmousemove="if(window.updateStatusEffectFloatingTooltip) window.updateStatusEffectFloatingTooltip(event)"
            onmouseleave="if(window.hideStatusEffectFloatingTooltip) window.hideStatusEffectFloatingTooltip()">
        ${iconMarkup}
        ${numberBadge}
        <span class="font-bold text-gray-100">${name}</span>
        <button type="button" class="req-remove-btn" title="Remove status effect"
                onclick="event.stopPropagation(); event.preventDefault(); if(window.hideStatusEffectFloatingTooltip) window.hideStatusEffectFloatingTooltip(); ${removeFn}">×</button>
      </span>
    `;
  }

  let name = '';
  let amount = '';
  let iconImg = '';
  let icon = isPenalty ? '💀' : '🎁';

  if (typeof rw === 'object' && rw !== null) {
    name = rw.name || (isPenalty ? 'Penalty' : 'Reward');
    amount = rw.amount !== undefined ? String(rw.amount) : '';
    iconImg = rw.iconImg || '';
    icon = rw.icon || (isPenalty ? '💀' : '📦');
  } else if (typeof rw === 'string') {
    const raw = rw.trim();
    // Check if string starts with an emoji, e.g. "🧠 Knowledge +500", "💀 Entropy +5"
    const emojiMatch = raw.match(/^([\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|\p{Extended_Pictographic})\s*(.*)$/u);
    if (emojiMatch) {
      icon = emojiMatch[1];
      const rest = emojiMatch[2].trim();
      const deltaMatch = rest.match(/^(.*?)\s*([+\-]\s*[0-9]+(?:-[0-9]+)?|[0-9]+(?:-[0-9]+)?)$/);
      if (deltaMatch) {
        name = deltaMatch[1].trim();
        amount = deltaMatch[2].trim();
      } else {
        name = rest;
      }
    } else {
      // String without emoji, e.g. "Lose: Med Kit x2", "Explosive Charges x20-30", "Scrap 20-30"
      let cleanRaw = raw;
      if (cleanRaw.toLowerCase().startsWith('lose:')) {
        cleanRaw = cleanRaw.substring(5).trim();
      }
      const multMatch = cleanRaw.match(/^(.*?)\s*[xX]\s*([0-9]+(?:-[0-9]+)?)$/);
      const rangeMatch = cleanRaw.match(/^(.*?)\s+([0-9]+-[0-9]+)$/);
      const deltaMatch = cleanRaw.match(/^(.*?)\s*([+\-][0-9]+(?:-[0-9]+)?)$/);

      if (multMatch) {
        name = multMatch[1].trim();
        amount = multMatch[2].trim();
      } else if (rangeMatch) {
        name = rangeMatch[1].trim();
        amount = rangeMatch[2].trim();
      } else if (deltaMatch) {
        name = deltaMatch[1].trim();
        amount = deltaMatch[2].trim();
      } else {
        name = cleanRaw;
      }
    }
  }

  // Cross-reference with resourceCatalog for real game iconImg
  const allRes = (resourceCatalog && resourceCatalog.resources) ? resourceCatalog.resources : [];
  if (!iconImg && name) {
    const cleanName = name.replace(/^[^\w\s]+/, '').trim().toLowerCase();
    const matchedRes = allRes.find(r => 
      r.name.toLowerCase() === cleanName || 
      r.id.toLowerCase() === cleanName ||
      cleanName.includes(r.name.toLowerCase()) ||
      r.name.toLowerCase().includes(cleanName)
    );
    if (matchedRes) {
      if (matchedRes.iconImg) iconImg = matchedRes.iconImg;
      if (matchedRes.icon) icon = matchedRes.icon;
    }
  }

  let iconMarkup = '';
  if (iconImg) {
    iconMarkup = `<img src="${iconImg}" alt="${name}" class="w-4 h-4 object-contain inline-block shrink-0 mr-1 drop-shadow-xs" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline';"><span style="display:none;" class="mr-1 shrink-0 text-xs">${icon}</span>`;
  } else {
    iconMarkup = `<span class="mr-1 shrink-0 text-xs">${icon}</span>`;
  }

  let amountDisplay = '';
  if (amount) {
    amountDisplay = (amount.startsWith('+') || amount.startsWith('-')) ? amount : `x${amount}`;
  }

  if (isPenalty) {
    return `
      <span class="req-pill border-red-300 bg-red-100 text-red-950 inline-flex items-center gap-1 cursor-pointer hover:bg-red-200 transition shadow-2xs" 
            onclick="event.stopPropagation(); openResourcePickerModal('${nodeId}', -1, 'inaction_penalty', ${rwIdx})"
            title="Click to edit penalty">
        ${iconMarkup}
        <span class="font-bold">${name}</span>
        ${amountDisplay ? `<span class="font-mono text-red-900 bg-red-200/80 border border-red-300 px-1 py-0.2 rounded text-[10px] font-bold">${amountDisplay}</span>` : ''}
        <button type="button" class="req-remove-btn" title="Remove penalty" 
                onclick="event.stopPropagation(); event.preventDefault(); removeInactionPenalty('${nodeId}', ${rwIdx})">×</button>
      </span>
    `;
  }

  return `
    <span class="req-pill reward-pill inline-flex items-center gap-1 cursor-pointer hover:border-amber-400 hover:bg-amber-100 transition shadow-2xs" 
          onclick="event.stopPropagation(); openResourcePickerModal('${nodeId}', ${actionIdx}, 'reward', ${rwIdx})"
          title="Click to edit reward (Resource / Amount / Range)">
      ${iconMarkup}
      <span class="font-bold text-gray-900">${name}</span>
      ${amountDisplay ? `<span class="font-mono text-amber-900 bg-amber-200/70 border border-amber-300 px-1 py-0.2 rounded text-[10px] font-bold">${amountDisplay}</span>` : ''}
      <button type="button" class="req-remove-btn" title="Remove reward" 
              onclick="event.stopPropagation(); event.preventDefault(); removeRewardItem('${nodeId}', ${actionIdx}, ${rwIdx})">×</button>
    </span>
  `;
}

// Pool Variation State Engine (Generic & Deck Pools)
function isPoolNodeDimmed(nodeId, variationId, visited = new Set()) {
  if (!nodeId || visited.has(nodeId)) return false;
  visited.add(nodeId);

  const targetVarId = variationId || activeVariationId;
  const node = (appData.nodes || []).find(n => n.id === nodeId);
  if (!node) return false;

  // 1. Directly disabled in target variation
  if (Array.isArray(node.disabledVariationIds) && node.disabledVariationIds.includes(targetVarId)) {
    return true;
  }

  // 2. Upstream connecting parent is disabled (cascades dimming to downstream connected events)
  const isUpstreamDisabled = (appData.nodes || []).some(parent => {
    if (parent.id === nodeId) return false;
    if ((parent.category || 'KeyChain') !== (node.category || 'KeyChain')) return false;
    const leadsToThis = (parent.actions || []).some(a => {
      const tgts = getActionTargetIds(a, parent.id);
      return tgts.includes(nodeId) || a.targetEventId === nodeId || a.targetNodeId === nodeId;
    }) || Boolean(parent.inactionThreat && (
      parent.inactionThreat.targetNodeId === nodeId || 
      parent.inactionThreat.targetEventId === nodeId ||
      (Array.isArray(parent.inactionThreat.targetNodeIds) && parent.inactionThreat.targetNodeIds.includes(nodeId))
    ));
    if (leadsToThis) {
      return isPoolNodeDimmed(parent.id, targetVarId, visited);
    }
    return false;
  });

  return isUpstreamDisabled;
}

function getConnectedPoolEventIds(startNodeId) {
  const connectedIds = new Set();
  const queue = [startNodeId];
  while (queue.length > 0) {
    const currId = queue.shift();
    if (!currId || connectedIds.has(currId)) continue;
    connectedIds.add(currId);

    const currNode = (appData.nodes || []).find(n => n.id === currId);
    if (!currNode) continue;

    (currNode.actions || []).forEach(act => {
      const tgts = getActionTargetIds(act, currNode.id);
      if (act.targetEventId && !tgts.includes(act.targetEventId)) tgts.push(act.targetEventId);
      if (act.targetNodeId && !tgts.includes(act.targetNodeId)) tgts.push(act.targetNodeId);
      tgts.forEach(tgt => {
        if (tgt && !connectedIds.has(tgt)) queue.push(tgt);
      });
    });

    if (currNode.inactionThreat) {
      const inactTgts = [];
      if (currNode.inactionThreat.targetNodeId) inactTgts.push(currNode.inactionThreat.targetNodeId);
      if (currNode.inactionThreat.targetEventId) inactTgts.push(currNode.inactionThreat.targetEventId);
      if (Array.isArray(currNode.inactionThreat.targetNodeIds)) inactTgts.push(...currNode.inactionThreat.targetNodeIds);
      inactTgts.forEach(t => {
        if (t && !connectedIds.has(t)) queue.push(t);
      });
    }
  }
  return Array.from(connectedIds);
}

function getUpstreamPoolEventIds(targetNodeId) {
  const upstreamIds = new Set();
  const queue = [targetNodeId];
  while (queue.length > 0) {
    const currId = queue.shift();
    (appData.nodes || []).forEach(parent => {
      if (parent.id === currId || upstreamIds.has(parent.id)) return;
      const leadsToThis = (parent.actions || []).some(a => {
        const tgts = getActionTargetIds(a, parent.id);
        return tgts.includes(currId) || a.targetEventId === currId || a.targetNodeId === currId;
      }) || Boolean(parent.inactionThreat && (
        parent.inactionThreat.targetNodeId === currId || 
        parent.inactionThreat.targetEventId === currId ||
        (Array.isArray(parent.inactionThreat.targetNodeIds) && parent.inactionThreat.targetNodeIds.includes(currId))
      ));
      if (leadsToThis) {
        upstreamIds.add(parent.id);
        queue.push(parent.id);
      }
    });
  }
  return Array.from(upstreamIds);
}

function togglePoolNodeVariationState(nodeId, e) {
  if (e) e.stopPropagation();
  if (typeof canUserEdit === 'function' && !canUserEdit()) {
    if (typeof requireAuthToEdit === 'function') requireAuthToEdit("enable or disable pool events");
    return;
  }
  pushUndoState();
  const node = (appData.nodes || []).find(n => n.id === nodeId);
  if (!node) return;

  const currentDisabled = isPoolNodeDimmed(nodeId, activeVariationId);
  const willDisable = !currentDisabled;

  // Find this node and all connecting downstream nodes
  const targetIds = getConnectedPoolEventIds(nodeId);

  targetIds.forEach(id => {
    const targetNode = (appData.nodes || []).find(n => n.id === id);
    if (!targetNode) return;
    if (!Array.isArray(targetNode.disabledVariationIds)) {
      targetNode.disabledVariationIds = [];
    }
    const idx = targetNode.disabledVariationIds.indexOf(activeVariationId);
    if (willDisable) {
      if (idx === -1) targetNode.disabledVariationIds.push(activeVariationId);
    } else {
      if (idx !== -1) targetNode.disabledVariationIds.splice(idx, 1);
    }
  });

  if (!willDisable) {
    // When switching ON, also ensure all upstream nodes in the chain leading to this node are enabled
    const upstreamIds = getUpstreamPoolEventIds(nodeId);
    upstreamIds.forEach(upId => {
      const upNode = (appData.nodes || []).find(n => n.id === upId);
      if (upNode && Array.isArray(upNode.disabledVariationIds)) {
        const upIdx = upNode.disabledVariationIds.indexOf(activeVariationId);
        if (upIdx !== -1) upNode.disabledVariationIds.splice(upIdx, 1);
      }
    });
  }

  saveProjectToLocalStorage();
  renderApp();

  const activeVar = (appData.variations || []).find(v => v.id === activeVariationId);
  const varLabel = activeVar ? `V${activeVar.number}` : 'Variation';
  const countStr = targetIds.length > 1 ? ` (and ${targetIds.length - 1} connected event${targetIds.length > 2 ? 's' : ''})` : '';
  showToast(`${node.codename}${countStr} switched ${willDisable ? 'OFF' : 'ON'} for ${varLabel}`, willDisable ? 'info' : 'success');
}

window.togglePoolNodeVariationState = togglePoolNodeVariationState;
window.getConnectedPoolEventIds = getConnectedPoolEventIds;
window.getUpstreamPoolEventIds = getUpstreamPoolEventIds;
window.isPoolNodeDimmed = isPoolNodeDimmed;
window.getPoolSwitchBarHTML = getPoolSwitchBarHTML;

function getPoolSwitchBarHTML(node, isDimmed, currentVar) {
  const varLabel = `V${currentVar.number}`;
  const varName = currentVar.name || `Variation ${currentVar.number}`;
  const statusTitle = isDimmed 
    ? `Currently DISABLED for ${varLabel} (${varName}). Click to switch ON.`
    : `Currently ACTIVE for ${varLabel} (${varName}). Click to switch OFF.`;

  return `
    <div class="pool-event-switch-bar ${isDimmed ? 'is-off' : 'is-on'}"
         onclick="event.stopPropagation(); window.togglePoolNodeVariationState('${node.id}', event)"
         onmousedown="event.stopPropagation()"
         title="${statusTitle}">
      <div class="flex items-center gap-2 min-w-0">
        <span class="pool-switch-tag">${isDimmed ? '✕ DISABLED' : '✔ ACTIVE'}</span>
        <span class="pool-switch-var-badge">${varLabel}</span>
        <span class="pool-switch-status-text font-bold text-xs truncate">
          ${isDimmed ? `Turned OFF for ${varLabel}` : `Included in ${varLabel}`}
        </span>
      </div>
      <button type="button" class="pool-switch-toggle-btn ${isDimmed ? 'is-off' : 'is-on'} shrink-0"
              onclick="event.stopPropagation(); window.togglePoolNodeVariationState('${node.id}', event)"
              onmousedown="event.stopPropagation()">
        <span class="pool-switch-thumb"></span>
        <span class="pool-switch-btn-label">${isDimmed ? 'SWITCH ON' : 'SWITCH OFF'}</span>
      </button>
    </div>
  `;
}


/* ==========================================================================
   EVENT CODENAME PARSING, GENERATION & LETTER SWAPPING ENGINE
   Format: T{timeline}-V{variation}-{K|S}{stage}{letter} (e.g. T1-V1-K1A, T1-V1-S2B)
   Action Suffix: Strictly A, B, C (no digits)
   ========================================================================== */

function getNodeTimelineNumber(node) {
  const vId = (node && node.variationId) || activeVariationId;
  const v = (appData.variations || []).find(x => x.id === vId);
  if (v && v.timelineId) {
    const tl = (appData.timelines || []).find(t => t.id === v.timelineId);
    if (tl && tl.number) return tl.number;
  }
  const actTl = (appData.timelines || []).find(t => t.id === activeTimelineId);
  return (actTl && actTl.number) || 1;
}

function getNodeVariationNumber(node) {
  const vId = (node && node.variationId) || activeVariationId;
  const v = (appData.variations || []).find(x => x.id === vId);
  return (v && v.number) || 1;
}

function getNodeStageNumber(node) {
  if (node && node.floorIndex !== undefined && node.floorIndex !== null) {
    return Number(node.floorIndex) + 1;
  }
  if (node && node.tier) return Number(node.tier);
  return (activeMobileStageIndex || 0) + 1;
}

function parseStructuredCodename(codeStr) {
  if (!codeStr || typeof codeStr !== 'string') return null;
  const match = codeStr.trim().toUpperCase().match(/^T(\d+)-V(\d+)-([KS])(\d+)([A-Z])$/);
  if (match) {
    return {
      timeline: Number(match[1]),
      variation: Number(match[2]),
      type: match[3],
      stage: Number(match[4]),
      letter: match[5],
      isStructured: true
    };
  }
  const shortMatch = codeStr.trim().toUpperCase().match(/^([KS])(\d+)([A-Z])$/);
  if (shortMatch) {
    return {
      timeline: 1,
      variation: 1,
      type: shortMatch[1],
      stage: Number(shortMatch[2]),
      letter: shortMatch[3],
      isStructured: true
    };
  }
  return { isStructured: false, raw: codeStr };
}

function buildStructuredCodename(tlNum, varNum, type, stageNum, letter) {
  return `T${tlNum}-V${varNum}-${type}${stageNum}${letter.toUpperCase()}`;
}

function getUsedLettersOnStage(stageIndex, category, variationId, excludeNodeId = null) {
  const letters = new Set();
  const vId = variationId || activeVariationId;
  const stageNum = stageIndex + 1;
  const isSecret = (category === 'SecretChain');
  const targetType = isSecret ? 'S' : 'K';

  (appData.nodes || []).forEach(n => {
    if (n.id === excludeNodeId) return;
    if ((n.category || 'KeyChain') !== category) return;
    const nVar = n.variationId || activeVariationId;
    if (nVar !== vId) return;
    const nFloor = (n.floorIndex !== undefined && n.floorIndex !== null) ? Number(n.floorIndex) : 0;
    if (nFloor !== stageIndex) return;

    const parsed = parseStructuredCodename(n.codename);
    if (parsed && parsed.isStructured && parsed.type === targetType && parsed.stage === stageNum) {
      letters.add(parsed.letter);
    }
  });
  return letters;
}

function getNextAvailableEventLetter(stageIndex, category, variationId) {
  const used = getUsedLettersOnStage(stageIndex, category, variationId);
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (!used.has(letter)) {
      return letter;
    }
  }
  return 'Z';
}

function generateNewEventCodename(category, stageIndex, variationId) {
  if (category === 'GenericPool' || category === 'DeckPool' || category === 'SpeciesPool') {
    const prefix = category === 'DeckPool' ? 'DECK' : (category === 'SpeciesPool' ? 'SPECIES' : 'GEN');
    const count = (appData.nodes || []).filter(n => n.category === category).length + 1;
    return `${prefix}-S${stageIndex + 1}-E${count}`;
  }

  const vId = variationId || activeVariationId;
  const dummyNode = { variationId: vId, floorIndex: stageIndex, category };
  const tlNum = getNodeTimelineNumber(dummyNode);
  const varNum = getNodeVariationNumber(dummyNode);
  const type = (category === 'SecretChain') ? 'S' : 'K';
  const stageNum = stageIndex + 1;
  const letter = getNextAvailableEventLetter(stageIndex, category, vId);

  return buildStructuredCodename(tlNum, varNum, type, stageNum, letter);
}

function updateEventCodenameWithSwapping(nodeId, rawInput) {
  const node = (appData.nodes || []).find(n => n.id === nodeId);
  if (!node) return;

  const trimmed = (rawInput || '').trim();
  if (!trimmed) return;

  // Generic and Deck events allow free-form custom naming
  if (node.category !== 'KeyChain' && node.category !== 'SecretChain') {
    if (trimmed !== node.codename) {
      pushUndoState();
      const oldCode = node.codename;
      node.codename = trimmed;
      cascadeCodenameChanges(nodeId, oldCode, trimmed);
      saveProjectToLocalStorage();
      renderApp();
      showToast(`Updated generic codename to "${trimmed}"`, "info");
    }
    return;
  }

  // KeyChain and SecretChain follow structured T{t}-V{v}-{K|S}{s}{L}
  const isSecret = (node.category === 'SecretChain');
  const type = isSecret ? 'S' : 'K';
  const stageNum = getNodeStageNumber(node);
  const stageIndex = stageNum - 1;
  const tlNum = getNodeTimelineNumber(node);
  const varNum = getNodeVariationNumber(node);

  let targetLetter = null;
  const fullParsed = parseStructuredCodename(trimmed);
  if (fullParsed && fullParsed.isStructured) {
    targetLetter = fullParsed.letter;
  } else {
    // Extract letter from partial input (e.g. "K1B", "1B", "B", "b")
    const match = trimmed.toUpperCase().match(/[A-Z]$/);
    if (match) targetLetter = match[0];
  }

  if (!targetLetter || !/^[A-Z]$/.test(targetLetter)) {
    showToast(`Invalid codename format. Must end with letter A-Z (e.g. T${tlNum}-V${varNum}-${type}${stageNum}A)`, "warning");
    renderApp();
    return;
  }

  const currentParsed = parseStructuredCodename(node.codename);
  const currentLetter = (currentParsed && currentParsed.isStructured) ? currentParsed.letter : 'A';

  if (targetLetter === currentLetter && node.codename === buildStructuredCodename(tlNum, varNum, type, stageNum, targetLetter)) {
    return; // No change
  }

  pushUndoState();

  const newTargetCodename = buildStructuredCodename(tlNum, varNum, type, stageNum, targetLetter);
  const vId = node.variationId || activeVariationId;

  // Cross-check: find sibling event with target letter on same canvas & stage
  const siblingNodes = (appData.nodes || []).filter(n =>
    n.id !== node.id &&
    (n.category || 'KeyChain') === node.category &&
    (n.floorIndex || 0) === (node.floorIndex || 0) &&
    (n.variationId || activeVariationId) === vId
  );

  const conflictingNode = siblingNodes.find(n => {
    const p = parseStructuredCodename(n.codename);
    return p && p.isStructured && p.letter === targetLetter;
  });

  const oldCode = node.codename;

  if (conflictingNode) {
    // Swap letters! Conflicting node takes the vacated currentLetter
    const conflictingOldCode = conflictingNode.codename;
    const conflictingNewCode = buildStructuredCodename(tlNum, varNum, type, stageNum, currentLetter);

    node.codename = newTargetCodename;
    conflictingNode.codename = conflictingNewCode;

    cascadeCodenameChanges(node.id, oldCode, newTargetCodename);
    cascadeCodenameChanges(conflictingNode.id, conflictingOldCode, conflictingNewCode);

    saveProjectToLocalStorage();
    renderApp();
    showToast(`Swapped codenames: "${newTargetCodename}" ↔ "${conflictingNewCode}"`, "success");
  } else {
    // No conflict: allocate target letter directly
    node.codename = newTargetCodename;
    cascadeCodenameChanges(node.id, oldCode, newTargetCodename);

    saveProjectToLocalStorage();
    renderApp();
    showToast(`Updated codename to "${newTargetCodename}"`, "success");
  }
}

function makeInlineCodenameEditable(element, nodeId) {
  if (isArrangeMode || (typeof canvasDragMoved !== 'undefined' && canvasDragMoved)) return;
  if (!requireAuthToEdit("edit event codename")) return;
  if (typeof commitAndCloseActiveInlineEditor === 'function') {
    commitAndCloseActiveInlineEditor(false);
  }
  if (element.querySelector('input')) return;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const currentCode = node.codename;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-input font-mono font-bold w-40 text-center text-amber-900 bg-amber-100 border-2 border-amber-500 rounded';
  input.value = currentCode;
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
  input.addEventListener('keyup', stopProp);

  let saved = false;
  const saveCodename = () => {
    if (saved) return;
    saved = true;
    const rawVal = input.value.trim();
    updateEventCodenameWithSwapping(nodeId, rawVal);
  };

  input.onblur = saveCodename;
}

function cascadeCodenameChanges(nodeId, oldCode, newCode) {
  if (!oldCode || !newCode || oldCode === newCode) return;
  (appData.nodes || []).forEach(n => {
    if (n.spawnConditions && n.spawnConditions.includes(oldCode)) {
      n.spawnConditions = n.spawnConditions.replaceAll(oldCode, newCode);
    }
    (n.actions || []).forEach(a => {
      if (a.shortDescription && a.shortDescription.includes(oldCode)) {
        a.shortDescription = a.shortDescription.replaceAll(oldCode, newCode);
      }
      if (a.description && a.description.includes(oldCode)) {
        a.description = a.description.replaceAll(oldCode, newCode);
      }
    });
  });

  (appData.dialogues || []).forEach(d => {
    if (d.triggerCondition && d.triggerCondition.includes(oldCode)) {
      d.triggerCondition = d.triggerCondition.replaceAll(oldCode, newCode);
    }
  });
}

function resequenceStageEventCodenames(stageIndex, category, variationId) {
  const cat = category || activeCategoryFilter || 'KeyChain';
  if (cat !== 'KeyChain' && cat !== 'SecretChain') return;
  const vId = variationId || activeVariationId;
  const stageNum = stageIndex + 1;
  const isSecret = (cat === 'SecretChain');
  const type = isSecret ? 'S' : 'K';

  // Find all events on this stage for this variation
  const stageNodes = (appData.nodes || []).filter(n => {
    const nCat = n.category || 'KeyChain';
    if (nCat !== cat) return false;
    const nVar = n.variationId || activeVariationId;
    if (nVar !== vId) return false;
    const nFloor = (n.floorIndex !== undefined && n.floorIndex !== null) ? Number(n.floorIndex) : 0;
    return nFloor === stageIndex;
  });

  if (stageNodes.length === 0) return;

  // Sort strictly by position.x ascending (left to right)
  stageNodes.sort((a, b) => {
    const ax = (a.position && a.position.x !== undefined) ? a.position.x : 0;
    const bx = (b.position && b.position.x !== undefined) ? b.position.x : 0;
    if (ax !== bx) return ax - bx;
    return (a.id || '').localeCompare(b.id || '');
  });

  // Calculate target structured codenames: T{t}-V{v}-{K|S}{stage}{letter}
  const changes = [];
  stageNodes.forEach((node, idx) => {
    const letter = String.fromCharCode(65 + Math.min(idx, 25)); // A, B, C...
    const tlNum = getNodeTimelineNumber(node);
    const varNum = getNodeVariationNumber(node);
    const targetCode = buildStructuredCodename(tlNum, varNum, type, stageNum, letter);
    if (node.codename !== targetCode) {
      changes.push({
        node,
        oldCode: node.codename,
        tempPlaceholder: `__TMP_REORDER_${node.id}_${Date.now()}_${idx}__`,
        newCode: targetCode
      });
    }
  });

  if (changes.length === 0) return;

  // Phase 1: assign temporary unique placeholders to break cyclic dependency (e.g. A <-> B swap)
  changes.forEach(({ node, oldCode, tempPlaceholder }) => {
    node.codename = tempPlaceholder;
    cascadeCodenameChanges(node.id, oldCode, tempPlaceholder);
  });

  // Phase 2: assign final target codenames
  changes.forEach(({ node, tempPlaceholder, newCode }) => {
    node.codename = newCode;
    cascadeCodenameChanges(node.id, tempPlaceholder, newCode);
  });
}


// Deep scan all local storage and session version arrays to instantly extract and restore target edits
async function deepScanAndRestoreTargetEdits() {
  const candidates = scanAllLocalRecoveryCandidates();
  // 1. Look for candidate with target edits (K3A, K3B, K4A)
  let best = candidates.find(c => c.hasTargetEdits);
  
  // 2. If not flagged, find candidate with the highest text length
  if (!best) {
    let maxChars = 0;
    candidates.forEach(c => {
      const chars = c.totalTextChars || calculateDatasetTextChars(c.data);
      if (chars > maxChars) {
        maxChars = chars;
        best = c;
      }
    });
  }

  // 3. Check directly in raw arrays if candidate list was somehow filtered
  if (!best) {
    try {
      const raw = localStorage.getItem('rc_local_saved_versions');
      if (raw) {
        const list = JSON.parse(raw);
        for (const item of list) {
          if (item && item.data) {
            const insp = inspectDatasetForTargetEdits(item.data);
            if (insp.hasTargetEdits) {
              best = {
                id: item.id || 'raw_detected',
                name: item.name || 'Recovered Raw Snapshot',
                displayTime: item.displayTime || 'Recent',
                nodeCount: (item.data.nodes || []).length,
                dialogueCount: (item.data.dialogues || []).length,
                hasTargetEdits: true,
                targetMatches: insp.matches,
                data: item.data
              };
              break;
            }
          }
        }
      }
    } catch (e) {}
  }

  if (!best || !best.data) {
    alert("Deep Scan completed: No custom text modifications found in browser history beyond the default template.\n\nTip: You can inspect each individual snapshot in the list below.");
    return false;
  }

  const details = best.hasTargetEdits 
    ? `Found session with edits in: ${best.targetMatches.join(', ')}!\nSaved: ${best.displayTime}`
    : `Found richest session with ${best.nodeCount} events and ${best.totalTextChars || 0} characters!\nSaved: ${best.displayTime}`;

  if (confirm(`Recover Found Session?\n\n${details}\n\nClick OK to restore this immediately into your active canvas and sync to the server disk.`)) {
    archiveLocalSnapshot("Before Deep Scan Restoration");
    pushUndoState();
    appData = JSON.parse(JSON.stringify(best.data));
    normalizeAllProjectData();
    saveProjectToLocalStorage();
    await saveCurrentProject(false);
    renderApp();
    fitWholeSchematic();
    closeModal('modal-save-manager');
    dismissRecoveryBanner();
    showToast(`Successfully restored session with ${best.nodeCount} events! Synced to server.`, 'success');
    return true;
  }
  return false;
}

// Global console recovery helper for direct user access
window.recoverLostSessionData = deepScanAndRestoreTargetEdits;
window.deepScanAndRestoreTargetEdits = deepScanAndRestoreTargetEdits;

window.updateAutoSaveInterval = updateAutoSaveInterval;
window.initPeriodicAutoSave = initPeriodicAutoSave;
window.scanAllLocalRecoveryCandidates = scanAllLocalRecoveryCandidates;
window.restoreBestRecoverySession = restoreBestRecoverySession;
window.restoreCandidate = restoreCandidate;
window.downloadCandidateJson = downloadCandidateJson;
window.deleteLocalCandidate = deleteLocalCandidate;
window.archiveLocalSnapshot = archiveLocalSnapshot;
window.nodeBelongsToBoardId = nodeBelongsToBoardId;
window.dialogueBelongsToBoardId = dialogueBelongsToBoardId;
window.getActiveBoardPartitionPayload = getActiveBoardPartitionPayload;
window.syncBoardFromServer = syncBoardFromServer;
window.renderBoardSavedVersionsList = renderBoardSavedVersionsList;
window.restoreBoardVersion = restoreBoardVersion;
window.openSaveManagerModal = openSaveManagerModal;
window.updateActiveBoardSavesBadge = updateActiveBoardSavesBadge;
window.onActiveBoardChanged = onActiveBoardChanged;
window.syncSaveManagerToActiveBoard = syncSaveManagerToActiveBoard;


