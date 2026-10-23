// ============================================================================
// js/data-catalog.js - Global State, Constants, Resource Catalog & Default Dataset
// ============================================================================

/**
 * Rogue Carrier - Narrative Editor Toolkit Engine v2.6
 * Pure Stage Coordinates (Zero-Drift Orthogonal Lines), Fix Text Editing (No Drag Interception),
 * Intangible Resource Amounts (+/- Delta), Purple Dots on Event Header & Action Results,
 * and Structured Dialogue Time Delay Engine.
 */

// Global Application State
let appData = {
  version: "2.6.0",
  projectInfo: { name: "Rogue Carrier Scenario 1", author: "Wild Fields" },
  timelines: [
    { id: "timeline_1", number: 1, name: "The Fate of Zephyrus", description: "Main reality hypercell timeline following the collapse of Zephyrus." }
  ],
  variations: [
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
  ],
  characters: [],
  nodes: [],
  dialogues: []
};
Object.defineProperty(window, 'appData', {
  get: () => appData,
  set: (val) => { appData = val; },
  configurable: true
});

let resourceCatalog = { resources: [], characters: [] };
let activeTimelineId = "timeline_1";
let activeVariationId = "var_v1";
let activeCategoryFilter = "KeyChain"; // KeyChain | GenericPool | DeckPool | SpeciesPool
let maxZoomedBlockId = null; // Block ID currently in max zoom focus
let maxZoomScale = 1.0; // The scale when max zoom was activated
let minOverviewScale = 0.35; // The scale of the full schematic overview
let selectedBlockId = null;
let currentAppViewMode = 'desktop'; // 'desktop' | 'mobile-stage'
let activeMobileStageIndex = 0; // 0 = Stage 1 / Tier 1, 1 = Stage 2 / Tier 2, etc.

const FLOOR_Y = [90, 1690, 3290, 4890, 6490];
const STAGE_BAND_HEIGHT = 1500;

// Vertical Difficulty Tier Column X Coordinates (Tier I to Tier V for Generic & Deck Pools)
const TIER_X = [80, 1040, 2000, 2960, 3920];

// Undo & Redo History Engine (Ctrl + Z / Ctrl + Y / Ctrl + Shift + Z)
const undoStack = [];
const redoStack = [];
const MAX_UNDO_DEPTH = 50;

function pushUndoState() {
  try {
    const snapshot = JSON.stringify(appData);
    if (undoStack.length > 0 && undoStack[undoStack.length - 1] === snapshot) {
      return;
    }
    undoStack.push(snapshot);
    if (undoStack.length > MAX_UNDO_DEPTH) {
      undoStack.shift();
    }
    redoStack.length = 0;
    if (typeof touchActiveBoardLock === 'function') {
      touchActiveBoardLock();
    }
  } catch (e) {
    console.warn("Undo snapshot failed", e);
  }
}

function performUndo() {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("undo actions")) return;
  if (undoStack.length === 0) {
    showToast("Nothing to undo", "warning");
    return;
  }
  try {
    const currentSnapshot = JSON.stringify(appData);
    redoStack.push(currentSnapshot);
    if (redoStack.length > MAX_UNDO_DEPTH) redoStack.shift();

    const prevSnapshot = undoStack.pop();
    appData = JSON.parse(prevSnapshot);
    saveProjectToLocalStorage();
    renderApp();
    showToast("Action undone (Ctrl+Z)", "success");
  } catch (e) {
    console.error("Undo restore failed", e);
  }
}

function performRedo() {
  if (typeof requireAuthToEdit === 'function' && !requireAuthToEdit("redo actions")) return;
  if (redoStack.length === 0) {
    showToast("Nothing to redo", "warning");
    return;
  }
  try {
    const currentSnapshot = JSON.stringify(appData);
    undoStack.push(currentSnapshot);
    if (undoStack.length > MAX_UNDO_DEPTH) undoStack.shift();

    const nextSnapshot = redoStack.pop();
    appData = JSON.parse(nextSnapshot);
    saveProjectToLocalStorage();
    renderApp();
    showToast("Action redone (Ctrl+Y)", "success");
  } catch (e) {
    console.error("Redo restore failed", e);
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.pushUndoState = pushUndoState;
window.performUndo = performUndo;
window.performRedo = performRedo;

async function manualSave() {
  await saveCurrentProject(true);
}

function showToast(msg, type = "info") {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-800 text-white border-emerald-500' : (type === 'warning' ? 'bg-amber-800 text-white border-amber-500' : 'bg-gray-900 text-white border-gray-700');
  toast.className = `px-4 py-2 rounded-lg border shadow-2xl text-xs font-semibold flex items-center gap-2 transform transition-all duration-200 opacity-0 translate-y-2 pointer-events-auto ${bg}`;
  toast.innerHTML = `<span class="font-mono text-cyan-300">●</span> <span>${msg}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
    toast.classList.add('opacity-100', 'translate-y-0');
  });
  setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 250);
  }, 2200);
}

// Canvas Transform State
let transform = { x: 40, y: 30, scale: 0.8 };
window.transform = transform;
let isDraggingCanvas = false;
let dragStart = { x: 0, y: 0 };
let parsedImportData = { nodes: [], dialogues: [] };

// Interactive Connector Port Drag State
let portDragState = {
  isDragging: false,
  sourceType: null, // 'action' | 'pre_event_dialogue' | 'post_action_dialogue'
  sourceNodeId: null,
  sourceActionId: null,
  startPos: { x: 0, y: 0 }
};

// Context Resource Picker State
let activePickerTarget = { nodeId: null, actionIdx: 0, type: 'requirement', itemIdx: null };

// DOM Elements
let canvasContainer, canvasStage, svgConnectors, nodesLayer, floorBandsLayer, variationSelect;


// Crew Specialization Categories (Science, Engineering, Operations, Defense)
const CREW_SPECIALIZATIONS = [
  { id: "spec_science", name: "Science", category: "Specialization", kind: "specialization", icon: "🔬", color: "#06b6d4" },
  { id: "spec_engineering", name: "Engineering", category: "Specialization", kind: "specialization", icon: "🔧", color: "#f97316" },
  { id: "spec_operations", name: "Operations", category: "Specialization", kind: "specialization", icon: "⚙️", color: "#10b981" },
  { id: "spec_defense", name: "Defense", category: "Specialization", kind: "specialization", icon: "🛡️", color: "#ef4444" }
];

let statusEffectsCatalog = [];
window.statusEffectsCatalog = statusEffectsCatalog;

function isTraderStatusEffect(item) {
  if (!item) return false;
  if (typeof item === 'object') {
    return Boolean(
      item.hasSpecies || 
      item.category === 'Trade' || 
      item.effectCategory === 'Trade' || 
      /trader/i.test(item.name || '') || 
      /trader/i.test(item.rawName || '') || 
      /\{SpeciesName\}/i.test(item.name || '')
    );
  }
  if (typeof item === 'string') {
    return /trader/i.test(item);
  }
  return false;
}
window.isTraderStatusEffect = isTraderStatusEffect;

// Load Resources Catalog
async function loadResourceCatalog() {
  try {
    const res = await fetch('resources.json');
    if (res.ok) {
      resourceCatalog = await res.json();
    }
  } catch (err) {
    console.warn('Using default catalog');
  }

  try {
    const sRes = await fetch('status_effects.json?v=' + Date.now());
    if (sRes.ok) {
      statusEffectsCatalog = await sRes.json();
      window.statusEffectsCatalog = statusEffectsCatalog;
    }
  } catch (err) {
    console.warn('Could not load status_effects.json', err);
  }

  if (!resourceCatalog.resources) resourceCatalog.resources = [];
  CREW_SPECIALIZATIONS.forEach(spec => {
    if (!resourceCatalog.resources.some(r => r.id === spec.id)) {
      resourceCatalog.resources.push(spec);
    }
  });
}


function getDefaultTimelinesList() {
  return [
    { id: "timeline_1", number: 1, name: "The Fate of Zephyrus", description: "Main reality hypercell timeline following the collapse of Zephyrus." }
  ];
}

function getDefaultVariationsList() {
  return [
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

function resetToDefaultProjectData(skipBackup = false) {
  if (!skipBackup && appData && appData.nodes && appData.nodes.length > 0) {
    saveSafetyBackup("Before Reset to Default");
  }
  appData.timelines = getDefaultTimelinesList();
  appData.variations = getDefaultVariationsList();
  appData.characters = getDefaultCharactersList();
  appData.nodes = getDefaultNodesDataset();
  appData.dialogues = getDefaultDialoguesDataset();
  normalizeAllProjectData();
  saveProjectToLocalStorage();
}

function getDefaultCharactersList() {
  return [
    { id: "voss", name: "Elias Voss", role: "Behemoth Captain", color: "#fef08a", textColor: "#713f12", icon: "👨‍✈️", disabledVariationIds: [], variationIds: ["var_v1"] },
    { id: "mnemosyne", name: "Mnemosyne", role: "Ship AI System", color: "#e0e7ff", textColor: "#3730a3", icon: "🤖", disabledVariationIds: [], variationIds: ["var_v1"] },
    { id: "khalil", name: "Khalil Arida", role: "Communication Officer", color: "#dcfce7", textColor: "#166534", icon: "📻", disabledVariationIds: [], variationIds: ["var_v1"] },
    { id: "tuuli", name: "Tuuli Korpela", role: "Chief Engineer", color: "#ffedd5", textColor: "#9a3412", icon: "🔧", disabledVariationIds: [], variationIds: ["var_v1"] },
    { id: "abbadie", name: "Mars Abbadie", role: "Head of R&D", color: "#f3e8ff", textColor: "#6b21a8", icon: "🔬", disabledVariationIds: [], variationIds: ["var_v1"] },
    { id: "orest", name: "Orest Demchuck", role: "Scout Leader", color: "#fee2e2", textColor: "#991b1b", icon: "🎯", disabledVariationIds: [], variationIds: ["var_v1"] },
    { id: "survivor", name: "Survivor", role: "Keeling Island Refugee", color: "#f3f4f6", textColor: "#1f2937", icon: "👤", disabledVariationIds: [], variationIds: ["var_v1"] }
  ];
}

// Full PDF Dataset Restoration (Default: Infinite Reaction Timer, No Inaction Threat, Clause-Based Requirements)
function getDefaultNodesDataset() {
  return [
    {
      id: "node_e0",
      codename: "T1-V1-K1A",
      name: "The Moment After the End",
      type: "World",
      category: "KeyChain",
      variationId: "var_v1",
      floorIndex: 0,
      spawnConditions: "End of Tutorial / Zephyrus Collapse",
      eventIntro: "Contact with Zephyrus is lost. Visual analysis suggests total destruction.",
      eventDescription: "BCEV-07M mothership Zephyrus has been destroyed. Captain Elias Voss assumes full mission command in primordial orbit.",
      reactionTimerHours: "Infinite",
      hasInactionThreat: false,
      inactionThreat: null,
      position: { x: 450, y: FLOOR_Y[0] },
      actions: [
        {
          id: "act_e0_1", codeSuffix: "A", shortDescription: "Investigate Signal", description: "Track keeling island distress signal.",
          requirements: [
            { id: "c_e0_1_1", isReplaceable: false, items: [{ resourceId: "crafting_01", name: "Multi-Tool", amount: 1, iconImg: "icons/T_Multi-Tool.png" }] },
            { id: "c_e0_1_2", isReplaceable: false, items: [{ resourceId: "processing_01", name: "Assembly Matrix", amount: 1, iconImg: "icons/T_AssemblyMatrix.png" }] }
          ],
          timerHours: 5, resultDescription: "Distress signal located at Keeling shore.", rewards: ["😊 Morale +5", "🧠 Knowledge +250"], targetNodeId: "node_e1"
        },
        {
          id: "act_e0_2", codeSuffix: "B", shortDescription: "Scan Wreckage", description: "Deploy long-range sensors to scan orbit.",
          requirements: [
            { id: "c_e0_2_1", isReplaceable: false, items: [{ resourceId: "processing_04", name: "Conductive Materials", amount: 1, iconImg: "icons/T_Conductive-Materials.png" }] },
            { id: "c_e0_2_2", isReplaceable: false, items: [{ resourceId: "synthesis_01", name: "Thermoplastic", amount: 1, iconImg: "icons/T_Thermoplastic.png" }] }
          ],
          timerHours: 5, resultDescription: "Crash site calculated.", rewards: ["😊 Morale -1", "🧠 Knowledge +300"], targetNodeId: "node_e1b"
        },
        {
          id: "act_e0_3", codeSuffix: "C", shortDescription: "Deploy Scout Probes", description: "Launch high-altitude recon drones directly toward orbital decay corridors.",
          requirements: [
            { id: "c_e0_3_1", isReplaceable: false, items: [{ resourceId: "electronics_05", name: "Electronic Components", amount: 15, iconImg: "icons/T_Holo_Display.png" }] },
            { id: "c_e0_3_2", isReplaceable: false, items: [{ resourceId: "processing_04", name: "Conductive Materials", amount: 15, iconImg: "icons/T_Conductive-Materials.png" }] }
          ],
          timerHours: 5, resultDescription: "Scout drones acquire telemetry on three descending craft, establishing immediate visual confirmation.", rewards: ["🧠 Knowledge +250", "📜 Blueprints +1"], targetNodeId: "node_e1"
        }
      ]
    },
    {
      id: "node_e1",
      codename: "T1-V1-K2A",
      name: "Escape Pod Signal",
      type: "World",
      category: "KeyChain",
      variationId: "var_v1",
      floorIndex: 1,
      spawnConditions: "Transmitter completed",
      eventIntro: "Distress signal coming from Keeling island.",
      eventDescription: "Shredded EVAs and claw marks greet your scouts inside the escape pod. refugees are missing.",
      reactionTimerHours: "Infinite",
      hasInactionThreat: false,
      inactionThreat: null,
      position: { x: 140, y: FLOOR_Y[1] },
      actions: [
        {
          id: "act_e1_1", codeSuffix: "A", shortDescription: "Comb island", description: "Search island for survivors.",
          requirements: [
            {
              id: "c_e1_1_1",
              isReplaceable: true,
              items: [
                { resourceId: "machinery_03", name: "Defense Kit", amount: 1, iconImg: "icons/T_DefensiveGear.png" },
                { resourceId: "machinery_02", name: "Portable Force Shield", amount: 1, iconImg: "icons/T_ForceField.png" }
              ]
            }
          ],
          timerHours: 5,
          resultDescription: "Predators discovered.", rewards: ["Prebiotic Matter", "🧠 Knowledge +350"], targetNodeId: "node_e2a"
        },
        {
          id: "act_e1_2", codeSuffix: "B", shortDescription: "Examine pod", description: "Investigate scene for clues.",
          requirements: [
            { id: "c_e1_2_1", isReplaceable: false, items: [{ resourceId: "questres_03", name: "Tricorder", amount: 1, iconImg: "icons/T_Tricoder.png" }] },
            { id: "c_e1_2_2", isReplaceable: false, items: [{ resourceId: "processing_03", name: "Modular Container", amount: 1, iconImg: "icons/T_Container.png" }] }
          ],
          timerHours: 5,
          resultDescription: "Missing lifeboat discovered.", rewards: ["🧠 Knowledge +350"], targetNodeId: "node_e2b"
        }
      ]
    },
    {
      id: "node_e1b",
      codename: "T1-V1-K2B",
      name: "Smoldering Crater",
      type: "World",
      category: "KeyChain",
      variationId: "var_v1",
      floorIndex: 1,
      spawnConditions: "Data processed",
      eventIntro: "Mothership fragment crash site.",
      eventDescription: "Scouts follow smoke column to smoldering crater with twisted metal fragment.",
      reactionTimerHours: "Infinite",
      hasInactionThreat: false,
      inactionThreat: null,
      position: { x: 1080, y: FLOOR_Y[1] },
      actions: [
        {
          id: "act_e1b_1", codeSuffix: "B", shortDescription: "Disassemble", description: "Extract flight recorder.",
          requirements: [
            { id: "c_e1b_1", isReplaceable: false, items: [{ resourceId: "ammunition_03", name: "Explosive Charges", amount: 1, iconImg: "icons/T_ExplosiveCharges.png" }] }
          ],
          timerHours: 6,
          resultDescription: "Orange box missing. Recalculating.", rewards: ["🧠 Knowledge +400"], targetNodeId: "node_e2b"
        }
      ]
    },
    {
      id: "node_e2a",
      codename: "T1-V1-K3A",
      name: "Predator Ambush",
      type: "World",
      category: "KeyChain",
      variationId: "var_v1",
      floorIndex: 2,
      spawnConditions: "Scouts sweep island",
      eventIntro: "Swarming alien fauna detected.",
      eventDescription: "Island is swarming with violent predators tracking living heat signatures.",
      reactionTimerHours: "Infinite",
      hasInactionThreat: false,
      inactionThreat: null,
      position: { x: 140, y: FLOOR_Y[2] },
      actions: [
        {
          id: "act_e2a_1", codeSuffix: "A", shortDescription: "Set perimeter", description: "Deploy defensive force field.",
          requirements: [
            { id: "c_e2a_1", isReplaceable: false, items: [{ resourceId: "machinery_02", name: "Portable Force Shield", amount: 1, iconImg: "icons/T_ForceField.png" }] }
          ],
          timerHours: 5,
          resultDescription: "Island cleared of threat.", rewards: ["🧠 Knowledge +400"], targetNodeId: "node_e3a"
        }
      ]
    },
    {
      id: "node_e2b",
      codename: "T1-V1-K3B",
      name: "Lifeboat Reunion",
      type: "World",
      category: "KeyChain",
      variationId: "var_v1",
      floorIndex: 2,
      spawnConditions: "Lifeboat located",
      eventIntro: "Lifeboat tossed by turbulent ocean waves.",
      eventDescription: "Radio silence greets your ship. Survivors have contracted a deadly mutated virus strain.",
      reactionTimerHours: "Infinite",
      hasInactionThreat: false,
      inactionThreat: null,
      position: { x: 1080, y: FLOOR_Y[2] },
      actions: [
        {
          id: "act_e2b_1", codeSuffix: "A", shortDescription: "Rescue & Quarantine", description: "Bring survivors to Health Care Center immediately.",
          requirements: [
            { id: "c_e2b_1_1", isReplaceable: false, items: [{ resourceId: "questres_03", name: "Tricorder", amount: 1, iconImg: "icons/T_Tricoder.png" }] },
            { id: "c_e2b_1_2", isReplaceable: false, items: [{ resourceId: "medres_01", name: "Med Kit", amount: 2, iconImg: "icons/T_Med-Kit.png" }] }
          ],
          timerHours: 5,
          resultDescription: "Scouts admitted to med bay. Virus isolated as Ebola derivative.", rewards: ["🧠 Knowledge +150", "💀 Entropy +10"], targetNodeId: "node_e3b"
        },
        {
          id: "act_e2b_2", codeSuffix: "B", shortDescription: "Study distantly", description: "Examine remotely using worker drones to prevent outbreak.",
          requirements: [
            { id: "c_e2b_2_1", isReplaceable: false, items: [{ resourceId: "questres_03", name: "Tricorder", amount: 1, iconImg: "icons/T_Tricoder.png" }] },
            { id: "c_e2b_2_2", isReplaceable: false, items: [{ resourceId: "machinery_01", name: "Worker Drone", amount: 1, iconImg: "icons/T_WorkerDrone.png" }] }
          ],
          timerHours: 5,
          resultDescription: "Remote telemetry indicates airborne Ebola strain.", rewards: ["🧠 Knowledge +300"], targetNodeId: "node_e3b"
        }
      ]
    },
    {
      id: "node_e3a",
      codename: "T1-V1-K4A",
      name: "Submerged Orange Box",
      type: "World",
      category: "KeyChain",
      variationId: "var_v1",
      floorIndex: 3,
      spawnConditions: "Deep sea extraction drones deployed",
      eventIntro: "Sub oceanic trench operations.",
      eventDescription: "Drones extract the Zephyrus orange box intact from the sea floor when a massive leviathan approaches!",
      reactionTimerHours: "Infinite",
      hasInactionThreat: false,
      inactionThreat: null,
      position: { x: 140, y: FLOOR_Y[3] },
      actions: [
        {
          id: "act_e3a_1", codeSuffix: "A", shortDescription: "Defeat Leviathan", description: "Engage predator creature to safeguard orange box.",
          requirements: [
            { id: "c_e3a_1", isReplaceable: false, items: [{ resourceId: "ammunition_03", name: "Explosive Charges", amount: 2, iconImg: "icons/T_ExplosiveCharges.png" }] }
          ],
          timerHours: 6,
          resultDescription: "Orange box retrieved intact. Last 10 minutes data missing!", rewards: ["🧠 Knowledge +500", "😊 Morale +15"]
        }
      ]
    },
    {
      id: "node_e3b",
      codename: "T1-V1-K4B",
      name: "Bioweapon Resolution",
      type: "World",
      category: "KeyChain",
      variationId: "var_v1",
      floorIndex: 3,
      spawnConditions: "R&D virus investigation complete",
      eventIntro: "Outbreak containment protocol.",
      eventDescription: "Mars Abbadie concludes the virus is a bioengineered weapon originated from outer space inside the escape pod.",
      reactionTimerHours: "Infinite",
      hasInactionThreat: false,
      inactionThreat: null,
      position: { x: 1080, y: FLOOR_Y[3] },
      actions: [
        {
          id: "act_e3b_1", codeSuffix: "B", shortDescription: "Mass Produce Medkits", description: "Fully man Health Care Center to eradicate virus.",
          requirements: [
            { id: "c_e3b_1", isReplaceable: false, items: [{ resourceId: "medres_01", name: "Med Kit", amount: 5, iconImg: "icons/T_Med-Kit.png" }] }
          ],
          timerHours: 5,
          resultDescription: "Virus eradicated. Crew saved.", rewards: ["👨‍🚀 Crew Count +3", "🧠 Knowledge +600"]
        }
      ]
    },
    {
      id: "node_sec_1",
      codename: "T1-V1-S1A",
      name: "Encrypted Black-Box Beacon",
      type: "World",
      category: "SecretChain",
      variationId: "var_v1",
      floorIndex: 0,
      spawnConditions: "Decrypted Hypercell Signal",
      eventIntro: "A low-frequency burst signal emerges from the wreckage perimeter.",
      eventDescription: "Sensors detect an encrypted automated transmission bearing classified Mothership command codes.",
      reactionTimerHours: "Infinite",
      hasInactionThreat: false,
      inactionThreat: null,
      position: { x: 450, y: FLOOR_Y[0] },
      actions: [
        {
          id: "act_sec_1_1",
          codeSuffix: "A",
          shortDescription: "Crack Encryption",
          description: "Override classified security cypher.",
          requirements: [],
          timerHours: 4,
          resultDescription: "Coordinates extracted to hidden vessel.",
          rewards: ["🧠 Knowledge +300"],
          targetNodeId: "node_sec_2"
        },
        {
          id: "act_sec_1_2",
          codeSuffix: "B",
          shortDescription: "Triangulate Source",
          description: "Scan directional telemetry.",
          requirements: [],
          timerHours: 4,
          resultDescription: "Origin pinpointed at ocean ridge.",
          rewards: ["😊 Morale +10"],
          targetNodeId: "node_sec_2"
        }
      ]
    },
    {
      id: "node_sec_2",
      codename: "T1-V1-S2A",
      name: "The Ghost Skiff",
      type: "World",
      category: "SecretChain",
      variationId: "var_v1",
      floorIndex: 1,
      spawnConditions: "Coordinates Decoded",
      eventIntro: "A derelict stealth vessel is tethered to a sunken ridge.",
      eventDescription: "The skiff belongs to an unlisted expedition team that arrived secretly prior to the collapse of Zephyrus.",
      reactionTimerHours: "Infinite",
      hasInactionThreat: false,
      inactionThreat: null,
      position: { x: 450, y: FLOOR_Y[1] },
      actions: [
        {
          id: "act_sec_2_1",
          codeSuffix: "A",
          shortDescription: "Retrieve Black Core",
          description: "Extract mission flight logs from terminal.",
          requirements: [],
          timerHours: 6,
          resultDescription: "Black Core retrieved! Conspiracy revealed.",
          rewards: ["🧠 Knowledge +600", "😊 Morale +20"]
        }
      ]
    }
  ];
}

// Full PDF Dialogue Dataset with Structured Timing & Delays
function getDefaultDialoguesDataset() {
  return [
    {
      id: "diag_intro",
      targetEventId: "node_e0",
      triggerTiming: "pre_event",
      triggerActionId: null,
      delayHours: 0,
      delayUnit: "hours",
      triggerCondition: "Before (T1-V1-K1A)",
      position: { x: 1400, y: FLOOR_Y[0] },
      variationId: "var_v1",
      category: "KeyChain",
      floorIndex: 0,
      lines: [
        { id: "l1", speakerId: "mnemosyne", speakerName: "Mnemosyne", text: "Contact with Zephyrus is lost, Captain. Visual analysis suggests it has been destroyed." },
        { id: "l2", speakerId: "voss", speakerName: "Voss", text: "No, it... it can't be... Just give a moment..." },
        { id: "l3", speakerId: "mnemosyne", speakerName: "Mnemosyne", text: "Captain, per protocol, you are now in charge of the entire mission." },
        { id: "l4", speakerId: "khalil", speakerName: "Khalil Arida", text: "I just wanted to say, you know, you shouldn't lose hope just yet." }
      ]
    },
    {
      id: "diag_orest",
      targetEventId: "node_e0",
      triggerTiming: "post_action",
      triggerActionId: "act_e0_1",
      delayHours: 3,
      delayUnit: "hours",
      triggerCondition: "After (T1-V1-K1A) Investigate Signal",
      position: { x: 1400, y: FLOOR_Y[0] + 340 },
      variationId: "var_v1",
      category: "KeyChain",
      floorIndex: 0,
      lines: [
        { id: "l5", speakerId: "orest", speakerName: "Orest Demchuck", text: "Captain, with all due respect, but it is not too late to turn back and start looking for survivors." },
        { id: "l6", speakerId: "voss", speakerName: "Voss", text: "Believe me, I do not forget about those people. But first, we must retrieve the flight recorder." },
        { id: "l7", speakerId: "orest", speakerName: "Orest Demchuck", text: "What good will finding the orange box do?! Why choose an obituary over people's lives?!" }
      ]
    },
    {
      id: "diag_route_opt1",
      targetEventId: "node_e0",
      triggerTiming: "action_option",
      triggerActionId: "act_e0_1",
      delayHours: 0,
      delayUnit: "hours",
      triggerCondition: "During (T1-V1-K1A) Investigate Signal",
      position: { x: 1540, y: FLOOR_Y[0] },
      variationId: "var_v1",
      category: "KeyChain",
      floorIndex: 0,
      lines: [
        { id: "l_r1", speakerId: "voss", speakerName: "Voss", text: "We should prioritize investigating the distress signal. Survivors may be waiting on that shore." }
      ]
    },
    {
      id: "diag_route_opt2",
      targetEventId: "node_e0",
      triggerTiming: "action_option",
      triggerActionId: "act_e0_2",
      delayHours: 0,
      delayUnit: "hours",
      triggerCondition: "During (T1-V1-K1A) Scan Wreckage",
      position: { x: 1540, y: FLOOR_Y[0] + 280 },
      variationId: "var_v1",
      category: "KeyChain",
      floorIndex: 0,
      lines: [
        { id: "l_r2", speakerId: "mnemosyne", speakerName: "Mnemosyne", text: "Scanning the orbital wreckage is mathematically optimal. The orange box contains critical telemetry." }
      ]
    },
    {
      id: "diag_route_opt3",
      targetEventId: "node_e0",
      triggerTiming: "action_option",
      triggerActionId: "act_e0_3",
      delayHours: 0,
      delayUnit: "hours",
      triggerCondition: "During (T1-V1-K1A) Deploy Scout Probes",
      position: { x: 1540, y: FLOOR_Y[0] + 560 },
      variationId: "var_v1",
      category: "KeyChain",
      floorIndex: 0,
      lines: [
        { id: "l_r3", speakerId: "orest", speakerName: "Orest Demchuck", text: "Direct recon gives our scouting teams immediate eyes on the targets. We shouldn't rely solely on distorted radio chatter." }
      ]
    },
    {
      id: "diag_2b",
      targetEventId: "node_e2b",
      triggerTiming: "pre_event",
      triggerActionId: null,
      delayHours: 0,
      delayUnit: "hours",
      triggerCondition: "Before (T1-V1-K3B)",
      position: { x: 2020, y: FLOOR_Y[2] },
      variationId: "var_v1",
      category: "KeyChain",
      floorIndex: 2,
      lines: [
        { id: "l8", speakerId: "mnemosyne", speakerName: "Mnemosyne", text: "Captain, we've located the lifeboat within comm link reach." },
        { id: "l9", speakerId: "voss", speakerName: "Voss", text: "Finally... let me speak to them." },
        { id: "l10", speakerId: "voss", speakerName: "Voss", text: "This is Elias Voss, captain of BCEV-07M. Can someone hear me?" },
        { id: "l11", speakerId: "survivor", speakerName: "Survivor", text: "Oh, thank goodness... We contracted something on that island. It hurts so much." }
      ]
    },
    {
      id: "diag_survivor",
      targetEventId: "node_e2b",
      triggerTiming: "post_action",
      triggerActionId: "act_e2b_1",
      delayHours: 0.5,
      delayUnit: "hours",
      triggerCondition: "After (T1-V1-E2-A1) Rescue & Quarantine",
      position: { x: 2020, y: FLOOR_Y[2] + 340 },
      variationId: "var_v1",
      category: "KeyChain",
      floorIndex: 2,
      lines: [
        { id: "l12", speakerId: "khalil", speakerName: "Khalil Arida", text: "The lifepod's log states there was a child on board..." },
        { id: "l13", speakerId: "voss", speakerName: "Voss", text: "I wasn't the only parent back on Zephyrus. It means nothing." },
        { id: "l14", speakerId: "survivor", speakerName: "Survivor", text: "Listen... is it true that there is a child with you?" },
        { id: "l15", speakerId: "voss", speakerName: "Voss", text: "Yes, I've got my daughter here." }
      ]
    },
    {
      id: "diag_rnd",
      targetEventId: "node_e3b",
      triggerTiming: "post_action",
      triggerActionId: "act_e3b_1",
      delayHours: 0.5,
      delayUnit: "hours",
      triggerCondition: "After (T1-V1-E3-A2) Medkit Mass Production",
      position: { x: 2020, y: FLOOR_Y[3] },
      variationId: "var_v1",
      category: "KeyChain",
      floorIndex: 3,
      lines: [
        { id: "l16", speakerId: "abbadie", speakerName: "Mars Abbadie", text: "That's the thing—it shouldn't have happened! The virus couldn't have bypassed their suits." },
        { id: "l17", speakerId: "voss", speakerName: "Voss", text: "So we're not going to have our brains bleed out of our eyes. That's nice." },
        { id: "l18", speakerId: "abbadie", speakerName: "Mars Abbadie", text: "I believe it was a bioweapon." }
      ]
    },
    {
      id: "diag_engineer",
      targetEventId: "node_e3a",
      triggerTiming: "post_action",
      triggerActionId: "act_e3a_1",
      delayHours: 0.25,
      delayUnit: "hours",
      triggerCondition: "After (T1-V1-E3-A1) Leviathan Defeat",
      position: { x: 2020, y: FLOOR_Y[3] + 340 },
      variationId: "var_v1",
      category: "KeyChain",
      floorIndex: 3,
      lines: [
        { id: "l19", speakerId: "tuuli", speakerName: "Tuuli Korpela", text: "Captain, we got the orange box! But... it doesn't have anything about the last ten minutes." },
        { id: "l20", speakerId: "voss", speakerName: "Voss", text: "Inside job?" },
        { id: "l21", speakerId: "tuuli", speakerName: "Tuuli Korpela", text: "I can't see how an outside force could have paralyzed Zephyrus's entire nervous system." }
      ]
    }
  ];
}

window.getDefaultTimelinesList = getDefaultTimelinesList;
window.getDefaultVariationsList = getDefaultVariationsList;
window.resetToDefaultProjectData = resetToDefaultProjectData;

