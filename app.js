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
    { id: "var_v2", timelineId: "timeline_1", number: 2, name: "Orbital Rift", description: "Debris field gravitational anomalies." },
    { id: "var_v3", timelineId: "timeline_1", number: 3, name: "Deep Submersion", description: "Keeling ocean trawler exploration." },
    { id: "var_v4", timelineId: "timeline_1", number: 4, name: "Predator Nest", description: "Keeling island predator swarms." },
    { id: "var_v5", timelineId: "timeline_1", number: 5, name: "Bioweapon Outbreak", description: "Ebola strain contagion response." },
    { id: "var_v6", timelineId: "timeline_1", number: 6, name: "Zephyrus Wreckage", description: "Disassembly of smoldering wreckage." },
    { id: "var_v7", timelineId: "timeline_1", number: 7, name: "Chronos Paradox", description: "Time displacement hypercell anomaly." },
    { id: "var_v8", timelineId: "timeline_1", number: 8, name: "Sub-Oceanic Abyss", description: "Sunken flight recorder retrieval." },
    { id: "var_v9", timelineId: "timeline_1", number: 9, name: "Behemoth Encounter", description: "Combat with leviathan predator." },
    { id: "var_v10", timelineId: "timeline_1", number: 10, name: "Echoes of the Fleet", description: "Final escape pod signals." }
  ],
  characters: [],
  nodes: [],
  dialogues: []
};

let resourceCatalog = { resources: [], characters: [] };
let activeTimelineId = "timeline_1";
let activeVariationId = "var_v1";
let activeCategoryFilter = "KeyChain"; // KeyChain | GenericPool | DeckPool
let maxZoomedBlockId = null; // Block ID currently in max zoom focus
let maxZoomScale = 1.0; // The scale when max zoom was activated
let minOverviewScale = 0.35; // The scale of the full schematic overview
let selectedBlockId = null;
let currentAppViewMode = 'desktop'; // 'desktop' | 'mobile-stage'
let activeMobileStageIndex = 0; // 0 = Stage 1 / Tier 1, 1 = Stage 2 / Tier 2, etc.

// Floor Snap Y Positions - Extra clearance to guarantee enlarged event blocks fit comfortably inside stage stripes
const FLOOR_Y = [90, 1080, 2070, 3060];
const STAGE_BAND_HEIGHT = 940;

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
  } catch (e) {
    console.warn("Undo snapshot failed", e);
  }
}

function performUndo() {
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

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  canvasContainer = document.getElementById('canvas-container');
  canvasStage = document.getElementById('canvas-stage');
  svgConnectors = document.getElementById('svg-connectors');
  nodesLayer = document.getElementById('nodes-layer');
  floorBandsLayer = document.getElementById('floor-bands-layer');
  variationSelect = document.getElementById('variation-select');

  await loadResourceCatalog();
  await loadProjectData();
  await initAuthSystem();
  await loadAllCommentCounts();
  setupCanvasEvents();
  setupToolbarEvents();
  setupAuthAndCollaborationEvents();
  setupPdfImportEvents();
  setupPickerEvents();
  setupPortDragEvents();

  // Auto-detect mobile devices or narrow screen viewports (<= 768px, phones, Pixel, iPhone, etc.)
  const isMobileDevice = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobileDevice) {
    switchAppViewMode('mobile-stage', true);
  } else {
    renderApp();
    setTimeout(() => {
      updateCanvasTransform();
      fitWholeSchematic();
    }, 150);
  }
});

// Crew Specialization Categories (Science, Engineering, Operations, Defense)
const CREW_SPECIALIZATIONS = [
  { id: "spec_science", name: "Science", category: "Specialization", kind: "specialization", icon: "🔬", color: "#06b6d4" },
  { id: "spec_engineering", name: "Engineering", category: "Specialization", kind: "specialization", icon: "🔧", color: "#f97316" },
  { id: "spec_operations", name: "Operations", category: "Specialization", kind: "specialization", icon: "⚙️", color: "#10b981" },
  { id: "spec_defense", name: "Defense", category: "Specialization", kind: "specialization", icon: "🛡️", color: "#ef4444" }
];

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

  if (!resourceCatalog.resources) resourceCatalog.resources = [];
  CREW_SPECIALIZATIONS.forEach(spec => {
    if (!resourceCatalog.resources.some(r => r.id === spec.id)) {
      resourceCatalog.resources.push(spec);
    }
  });
}

// Load Project Data (Server Disk Auto-Sync & LocalStorage)
async function loadProjectData() {
  let loaded = false;

  // 1. Try loading directly from server disk (project-data.json)
  try {
    const serverRes = await fetch('/api/load');
    if (serverRes.ok) {
      const serverData = await serverRes.json();
      if (serverData && serverData.nodes && serverData.nodes.length > 0) {
        appData = serverData;
        if (!appData.characters || appData.characters.length === 0) {
          appData.characters = getDefaultCharactersList();
        }
        loaded = true;
        console.log("Narrative Project successfully loaded from disk (project-data.json)");
      }
    }
  } catch (err) {
    console.log("No disk save found or server offline, trying localStorage");
  }

  // 2. Try loading from localStorage
  if (!loaded) {
    const localSaved = localStorage.getItem('rc_narrative_project_v26');
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        if (parsed && parsed.nodes && parsed.nodes.length > 0) {
          appData = parsed;
          if (!appData.characters || appData.characters.length === 0) {
            appData.characters = getDefaultCharactersList();
          }
          loaded = true;
        }
      } catch (e) {
        console.warn('Resetting corrupt localStorage');
      }
    }
  }

  if (!loaded) {
    resetToDefaultProjectData();
  } else {
    normalizeAllProjectData();
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
  }

  (node.actions || []).forEach(normalizeActionRequirements);
}

function normalizeAllProjectData() {
  if (!appData.nodes) appData.nodes = [];
  appData.nodes.forEach(node => {
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
      if (d.targetEventId) {
        const targetNode = (appData.nodes || []).find(n => n.id === d.targetEventId);
        if (targetNode) {
          const current = (d.triggerCondition || '').trim();
          const isLegacy = !current ||
            current.includes('Appears') ||
            current.startsWith('Route Suggestion:') ||
            current.startsWith('On Inaction Threat') ||
            (current.startsWith('After ') && (!current.includes(`(${targetNode.codename})`) || current.indexOf(`(${targetNode.codename})`) > 8)) ||
            (current.startsWith('Before ') && (!current.includes(`(${targetNode.codename})`)));
          
          if (isLegacy) {
            d.triggerCondition = formatDialogueTriggerCondition(d.triggerTiming || 'pre_event', targetNode, d.triggerActionId);
          }
        }
      }
    });
  }
  if (appData.characters) {
    appData.characters.forEach(c => {
      if (!c.variationIds || c.variationIds.length === 0) {
        c.variationIds = ["var_v1"];
      }
    });
  }

  // Seamless migration of old stage coordinates to new enlarged FLOOR_Y
  const oldFloorY = [90, 840, 1590, 2340];
  if (appData.nodes) {
    appData.nodes.forEach(node => {
      if (node.category === 'KeyChain' && node.position) {
        for (let i = 1; i < oldFloorY.length; i++) {
          if (Math.abs(node.position.y - oldFloorY[i]) < 10) {
            const deltaY = FLOOR_Y[i] - node.position.y;
            node.position.y = FLOOR_Y[i];
            if (appData.dialogues) {
              appData.dialogues.forEach(d => {
                if (d.targetEventId === node.id && d.position) {
                  d.position.y += deltaY;
                }
              });
            }
            break;
          }
        }
      }
    });
  }
}

function resetToDefaultProjectData(skipBackup = false) {
  if (!skipBackup && appData && appData.nodes && appData.nodes.length > 0) {
    saveSafetyBackup("Before Reset to Default");
  }
  appData.characters = getDefaultCharactersList();
  appData.nodes = getDefaultNodesDataset();
  appData.dialogues = getDefaultDialoguesDataset();
  normalizeAllProjectData();
  saveProjectToLocalStorage();
}

function getDefaultCharactersList() {
  return [
    { id: "voss", name: "Voss", role: "Mothership Captain", color: "#fef08a", textColor: "#713f12", icon: "👨‍✈️", variationIds: ["var_v1"] },
    { id: "mnemosyne", name: "Mnemosyne", role: "Ship AI System", color: "#e0e7ff", textColor: "#3730a3", icon: "🤖", variationIds: ["var_v1"] },
    { id: "khalil", name: "Khalil Arida", role: "Communication Officer", color: "#dcfce7", textColor: "#166534", icon: "📻", variationIds: ["var_v1"] },
    { id: "tuuli", name: "Tuuli Korpela", role: "Chief Engineer", color: "#ffedd5", textColor: "#9a3412", icon: "🔧", variationIds: ["var_v1"] },
    { id: "abbadie", name: "Mars Abbadie", role: "Head of R&D", color: "#f3e8ff", textColor: "#6b21a8", icon: "🔬", variationIds: ["var_v1"] },
    { id: "orest", name: "Orest Demchuck", role: "Scout Leader", color: "#fee2e2", textColor: "#991b1b", icon: "🎯", variationIds: ["var_v1"] },
    { id: "survivor", name: "Survivor", role: "Keeling Island Refugee", color: "#f3f4f6", textColor: "#1f2937", icon: "👤", variationIds: ["var_v1"] }
  ];
}

// Full PDF Dataset Restoration (Default: Infinite Reaction Timer, No Inaction Threat, Clause-Based Requirements)
function getDefaultNodesDataset() {
  return [
    {
      id: "node_e0",
      codename: "T1-V1-E0-A0",
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
          id: "act_e0_1", codeSuffix: "A1", shortDescription: "Investigate Signal", description: "Track keeling island distress signal.",
          requirements: [
            { id: "c_e0_1_1", isReplaceable: false, items: [{ resourceId: "crafting_01", name: "Multi-Tool", amount: 1, iconImg: "icons/T_Multi-Tool.png" }] },
            { id: "c_e0_1_2", isReplaceable: false, items: [{ resourceId: "processing_01", name: "Assembly Matrix", amount: 1, iconImg: "icons/T_AssemblyMatrix.png" }] }
          ],
          timerHours: 5, resultDescription: "Distress signal located at Keeling shore.", rewards: ["😊 Morale +5", "🧠 Knowledge +250"], targetNodeId: "node_e1"
        },
        {
          id: "act_e0_2", codeSuffix: "B1", shortDescription: "Scan Wreckage", description: "Deploy long-range sensors to scan orbit.",
          requirements: [
            { id: "c_e0_2_1", isReplaceable: false, items: [{ resourceId: "processing_04", name: "Conductive Materials", amount: 1, iconImg: "icons/T_Conductive-Materials.png" }] },
            { id: "c_e0_2_2", isReplaceable: false, items: [{ resourceId: "synthesis_01", name: "Thermoplastic", amount: 1, iconImg: "icons/T_Thermoplastic.png" }] }
          ],
          timerHours: 5, resultDescription: "Crash site calculated.", rewards: ["😊 Morale -1", "🧠 Knowledge +300"], targetNodeId: "node_e1b"
        },
        {
          id: "act_e0_3", codeSuffix: "C1", shortDescription: "Deploy Scout Probes", description: "Launch high-altitude recon drones directly toward orbital decay corridors.",
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
      codename: "T1-V1-E1-A1",
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
          id: "act_e1_1", codeSuffix: "A2", shortDescription: "Comb island", description: "Search island for survivors.",
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
          id: "act_e1_2", codeSuffix: "B2", shortDescription: "Examine pod", description: "Investigate scene for clues.",
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
      codename: "T1-V1-E1-B1",
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
          id: "act_e1b_1", codeSuffix: "B2", shortDescription: "Disassemble", description: "Extract flight recorder.",
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
      codename: "T1-V1-E2-A2",
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
          id: "act_e2a_1", codeSuffix: "A3", shortDescription: "Set perimeter", description: "Deploy defensive force field.",
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
      codename: "T1-V1-E2-B2",
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
          id: "act_e2b_1", codeSuffix: "A3", shortDescription: "Rescue & Quarantine", description: "Bring survivors to Health Care Center immediately.",
          requirements: [
            { id: "c_e2b_1_1", isReplaceable: false, items: [{ resourceId: "questres_03", name: "Tricorder", amount: 1, iconImg: "icons/T_Tricoder.png" }] },
            { id: "c_e2b_1_2", isReplaceable: false, items: [{ resourceId: "medres_01", name: "Med Kit", amount: 2, iconImg: "icons/T_Med-Kit.png" }] }
          ],
          timerHours: 5,
          resultDescription: "Scouts admitted to med bay. Virus isolated as Ebola derivative.", rewards: ["🧠 Knowledge +150", "💀 Entropy +10"], targetNodeId: "node_e3b"
        },
        {
          id: "act_e2b_2", codeSuffix: "B3", shortDescription: "Study distantly", description: "Examine remotely using worker drones to prevent outbreak.",
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
      codename: "T1-V1-E3-A3",
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
          id: "act_e3a_1", codeSuffix: "A4", shortDescription: "Defeat Leviathan", description: "Engage predator creature to safeguard orange box.",
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
      codename: "T1-V1-E3-B3",
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
          id: "act_e3b_1", codeSuffix: "B4", shortDescription: "Mass Produce Medkits", description: "Fully man Health Care Center to eradicate virus.",
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
      codename: "T1-V1-SEC-1",
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
          codeSuffix: "S1",
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
          codeSuffix: "S2",
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
      codename: "T1-V1-SEC-2",
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
          codeSuffix: "S3",
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
      triggerCondition: "Before (T1-V1-E1-A0)",
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
      triggerCondition: "After (T1-V1-E1-A0) Investigate Signal",
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
      triggerCondition: "During (T1-V1-E1-A0) Investigate Signal",
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
      triggerCondition: "During (T1-V1-E1-A0) Scan Wreckage",
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
      triggerCondition: "During (T1-V1-E1-A0) Deploy Scout Probes",
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
      triggerCondition: "Before (T1-V1-E2-A1)",
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

let autoSaveDiskTimer = null;
let lastSavedTimestamp = null;

function saveProjectToLocalStorage() {
  localStorage.setItem('rc_narrative_project_v26', JSON.stringify(appData));
  updateStats();

  // Debounced auto-sync to server disk (project-data.json and unreal-export.json)
  clearTimeout(autoSaveDiskTimer);
  autoSaveDiskTimer = setTimeout(() => {
    syncProjectToDiskServer();
  }, 350);
}

// Immediate manual save triggered by Ctrl+S or Save button
async function saveCurrentProject(isManual = false) {
  if (!requireAuthToEdit("save project changes")) return;
  clearTimeout(autoSaveDiskTimer);
  localStorage.setItem('rc_narrative_project_v26', JSON.stringify(appData));
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
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    if (currentUser && currentUser.name && appData.projectInfo) {
      appData.projectInfo.author = currentUser.name;
    }

    const res = await fetch('/api/save', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(appData)
    });
    if (res.ok) {
      const resp = await res.json();
      if (badgeText) badgeText.innerText = `Saved (${resp.timestamp || timeStr})`;
      if (isManual) {
        showToast(`Project saved to project-data.json (${resp.timestamp || timeStr})`, 'success');
      }
    } else {
      if (badgeText) badgeText.innerText = `Saved (${timeStr})`;
      if (isManual) {
        showToast(`Saved locally (${timeStr})`, 'success');
      }
    }
  } catch (e) {
    if (badgeText) badgeText.innerText = `Saved Locally (${timeStr})`;
    if (isManual) {
      showToast(`Saved locally (${timeStr})`, 'success');
    }
  }

  // Record rolling quick-save snapshot in version storage
  recordVersionSnapshot(`Quick Save (${timeStr})`, (currentUser && currentUser.name) || (appData.projectInfo && appData.projectInfo.author) || 'Wild Fields', false);
}

async function syncProjectToDiskServer() {
  const badgeText = document.getElementById('save-status-text');
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    if (currentUser && currentUser.name && appData.projectInfo) {
      appData.projectInfo.author = currentUser.name;
    }

    const res = await fetch('/api/save', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(appData)
    });
    if (res.ok) {
      const resp = await res.json();
      if (badgeText) badgeText.innerText = `Auto-Saved (${resp.timestamp || 'UE5'})`;
    }
  } catch (e) {
    if (badgeText) badgeText.innerText = 'Saved Locally';
  }
}

// Stores a version snapshot on server disk (/api/saves) and browser localStorage
async function recordVersionSnapshot(name, author = 'Wild Fields', notify = false) {
  const time = new Date();
  const timestamp = time.toISOString();
  const displayTime = time.toLocaleDateString() + ' ' + time.toLocaleTimeString();

  const versionMeta = {
    id: `save_${Date.now()}`,
    name: name,
    author: author,
    timestamp: timestamp,
    displayTime: displayTime,
    nodeCount: (appData.nodes || []).length,
    dialogueCount: (appData.dialogues || []).length,
    data: appData
  };

  // 1. Try saving to server disk /api/saves
  try {
    await fetch('/api/saves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        author: author,
        data: appData
      })
    });
  } catch (e) {
    console.warn("Could not reach /api/saves on server, persisting in localStorage", e);
  }

  // 2. Always persist in localStorage as well (offline fallback)
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
    if (list.length > 25) list = list.slice(0, 25);
    localStorage.setItem('rc_local_saved_versions', JSON.stringify(list));
  } catch (e) {
    console.warn("localStorage version store quota reached", e);
  }

  if (notify) {
    showToast(`Version '${name}' stored successfully!`, 'success');
  }
}

async function saveSafetyBackup(reason) {
  try {
    localStorage.setItem('rc_safety_backup_v26', JSON.stringify({
      reason,
      timestamp: new Date().toISOString(),
      data: appData
    }));
    await fetch('/api/saves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch('/api/saves');
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
  serverSaves.forEach(s => map.set(s.id, { ...s, source: 'disk' }));
  localSaves.forEach(s => {
    if (!map.has(s.id)) {
      map.set(s.id, { ...s, source: 'local' });
    }
  });

  const combined = Array.from(map.values());
  combined.sort((a, b) => new Date(b.timestamp || b.displayTime) - new Date(a.timestamp || a.displayTime));
  return combined;
}

function openSaveManagerModal() {
  const managerSavedText = document.getElementById('save-manager-last-saved');
  if (managerSavedText) {
    managerSavedText.innerText = lastSavedTimestamp ? `(Last saved: ${lastSavedTimestamp})` : '(Auto-saved)';
  }
  openModal('modal-save-manager');
  renderSavedVersionsList();
}

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
            ${s.source === 'disk' ? '💾 Disk File' : '🌐 Local Mirror'}
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
    const res = await fetch(`/api/saves/${fn}`);
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
    const res = await fetch(`/api/saves/${fn}`);
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
    await fetch(`/api/saves/${fn}`, { method: 'DELETE' });
  } catch (e) {}

  try {
    const raw = localStorage.getItem('rc_local_saved_versions');
    if (raw) {
      let list = JSON.parse(raw);
      list = list.filter(s => s.id !== saveId);
      localStorage.setItem('rc_local_saved_versions', JSON.stringify(list));
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

// Universal Panning (Do not hijack text editing or ports)
function setupCanvasEvents() {
  if (!canvasContainer) return;

  canvasContainer.addEventListener('mousedown', (e) => {
    if (document.activeElement && typeof document.activeElement.blur === 'function' && !e.target.closest('input, textarea, select')) {
      document.activeElement.blur();
    }

    // Return if clicking on interactive controls
    if (e.target.closest('.editable-spot') || 
        e.target.closest('button') || 
        e.target.closest('input') || 
        e.target.closest('textarea') || 
        e.target.closest('select') || 
        e.target.closest('.connector-port') ||
        e.target.closest('.dialogue-trigger-port') ||
        e.target.closest('.req-pill')) {
      return;
    }

    isDraggingCanvas = true;
    dragStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    canvasContainer.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingCanvas) {
      transform.x = e.clientX - dragStart.x;
      transform.y = e.clientY - dragStart.y;
      updateCanvasTransform();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingCanvas) {
      isDraggingCanvas = false;
      canvasContainer.style.cursor = 'default';
    }
  });

  canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newScale = Math.min(Math.max(transform.scale * zoomFactor, 0.15), 3.0);

    const mouseX = e.clientX - canvasContainer.getBoundingClientRect().left;
    const mouseY = e.clientY - canvasContainer.getBoundingClientRect().top;

    transform.x = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    transform.y = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
    transform.scale = newScale;

    if (maxZoomedBlockId && newScale < maxZoomScale * 0.95) {
      maxZoomedBlockId = null;
    }

    updateBlockZoomButtons();
    updateCanvasTransform();
  }, { passive: false });
}

function updateCanvasTransform() {
  if (!canvasStage) return;
  canvasStage.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;

  // Keep floating buttons comfortably sized at minimal zoom without over-scaling
  const btnScale = Math.min(Math.max(1 / transform.scale, 1.0), 2.4);
  canvasStage.style.setProperty('--btn-scale', btnScale.toFixed(3));

  const resetBtn = document.getElementById('btn-zoom-reset');
  if (resetBtn) resetBtn.innerText = `${Math.round(transform.scale * 100)}%`;
}

function setupToolbarEvents() {
  if (variationSelect) {
    variationSelect.addEventListener('change', (e) => {
      activeVariationId = e.target.value;
      renderApp();
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
  if (btnAddChar) btnAddChar.onclick = () => addNewCharacter();

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
  activeCategoryFilter = filter;
  const btnKeychain = document.getElementById('btn-view-keychain');
  const btnSecret = document.getElementById('btn-view-secret');
  const btnGeneric = document.getElementById('btn-view-generic');
  const btnDeck = document.getElementById('btn-view-deck');

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

  renderApp();
}

function updateProjectSubtitle() {
  const subtitleEl = document.getElementById('project-subtitle');
  if (!subtitleEl) return;
  const activeVar = (appData.variations || []).find(v => v.id === activeVariationId);
  const activeTl = activeVar ? ((appData.timelines || []).find(tl => tl.id === activeVar.timelineId) || { name: 'The Fate of Zephyrus', number: 1 }) : { name: 'The Fate of Zephyrus', number: 1 };
  subtitleEl.innerText = `Timeline ${activeTl.number || 1}: ${activeTl.name}`;
}

function renderApp() {
  updateProjectSubtitle();
  renderVariationSelect();
  if (currentAppViewMode === 'mobile-stage') {
    renderMobileStageView();
  } else {
    renderFloorBands();
    renderNodes();
    setTimeout(() => renderConnectors(), 50);
  }
  updateStats();
}

function renderVariationSelect() {
  if (!variationSelect) return;
  variationSelect.innerHTML = '';
  appData.variations.forEach(v => {
    const t = appData.timelines.find(tl => tl.id === v.timelineId) || { name: 'Timeline 1' };
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.innerText = `${t.name} — V${v.number}: ${v.name}`;
    if (v.id === activeVariationId) opt.selected = true;
    variationSelect.appendChild(opt);
  });
}

function renderFloorBands() {
  if (!floorBandsLayer) return;
  floorBandsLayer.innerHTML = '';

  if (activeCategoryFilter === 'KeyChain' || activeCategoryFilter === 'SecretChain') {
    const isSecret = activeCategoryFilter === 'SecretChain';
    FLOOR_Y.forEach((y, idx) => {
      const band = document.createElement('div');
      band.className = `stage-band floor-band ${isSecret ? 'secret-stage-band' : ''}`;
      band.style.top = `${y - 45}px`;
      band.style.height = `${STAGE_BAND_HEIGHT}px`;
      band.style.left = `-100000px`;
      band.style.width = `200000px`;
      floorBandsLayer.appendChild(band);

      // Stage label badges starting from STAGE 1, placed at visible intervals including negative X space
      const labelXPositions = [-4800, -3200, -1600, 40, 1600, 3200, 4800];
      labelXPositions.forEach(lx => {
        const label = document.createElement('div');
        label.className = `stage-label floor-label ${isSecret ? 'secret-stage-label' : ''}`;
        label.style.top = `${y - 59}px`;
        label.style.left = `${lx}px`;
        label.innerText = isSecret ? `SECRET STAGE ${idx + 1}` : `STAGE ${idx + 1}`;
        floorBandsLayer.appendChild(label);
      });
    });
  } else {
    // Requirement 5: 5 Vertical Difficulty Tier Columns (Tier I to Tier V)
    const tierLabels = [
      'TIER I (Introductory / Low Risk)',
      'TIER II (Standard Operations)',
      'TIER III (Challenging / Hostile)',
      'TIER IV (High Risk / Severe Threat)',
      'TIER V (Apex / Extreme Hazard)'
    ];
    const isDeck = activeCategoryFilter === 'DeckPool';

    TIER_X.forEach((x, idx) => {
      const band = document.createElement('div');
      band.className = `tier-column-band ${isDeck ? 'tier-column-band-deck' : ''}`;
      band.style.left = `${x - 20}px`;
      band.style.width = `920px`;

      const header = document.createElement('div');
      header.className = `tier-column-header ${isDeck ? 'tier-column-header-deck' : ''}`;
      header.innerText = tierLabels[idx];

      band.appendChild(header);
      floorBandsLayer.appendChild(band);
    });
  }
}

// Render All Nodes on Stage (Unified Event Block Layout for Critical, Generic & Deck Pools)
function renderNodes() {
  if (!nodesLayer) return;
  nodesLayer.innerHTML = '';

  const isPoolPage = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool');

  const filteredNodes = appData.nodes.filter(n => {
    const cat = n.category || 'KeyChain';
    if (cat !== activeCategoryFilter) return false;
    // On Generic and Deck Pool pages, the entire pool is present regardless of selected timeline and variation
    if (!isPoolPage && n.variationId && n.variationId !== activeVariationId) return false;
    return true;
  });

  filteredNodes.forEach(node => {
    // Requirement 5: Generic and Deck pools use the EXACT same event block layout as critical events
    const nodeEl = createEventNodeDOM(node);
    nodesLayer.appendChild(nodeEl);
  });

  // Dialogues: Filter by active category (and variation for critical chains, all pool dialogues for pool pages)
  const filteredDialogues = appData.dialogues.filter(d => {
    if (d.targetEventId) {
      const targetNode = appData.nodes.find(n => n.id === d.targetEventId);
      if (!targetNode) return false;
      const targetCat = targetNode.category || 'KeyChain';
      if (targetCat !== activeCategoryFilter) return false;
      if (!isPoolPage && targetNode.variationId && targetNode.variationId !== activeVariationId) return false;
      return true;
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

  makeNodesDraggable();
  if (window.lucide) lucide.createIcons();
}

// Format Reward & Penalty Pills with Resource Icons & Ranges (e.g., 20-30 items)
function formatRewardPillHTML(rw, nodeId, actionIdx, rwIdx, isPenalty = false) {
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
    const leadsToThis = (parent.actions || []).some(a => (a.targetNodeId === nodeId || a.targetEventId === nodeId)) ||
                        Boolean(parent.inactionThreat && (parent.inactionThreat.targetNodeId === nodeId || parent.inactionThreat.targetEventId === nodeId));
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
      const tgt = act.targetNodeId || act.targetEventId;
      if (tgt && !connectedIds.has(tgt)) {
        queue.push(tgt);
      }
    });

    if (currNode.inactionThreat) {
      const inactTgt = currNode.inactionThreat.targetNodeId || currNode.inactionThreat.targetEventId;
      if (inactTgt && !connectedIds.has(inactTgt)) {
        queue.push(inactTgt);
      }
    }
  }
  return Array.from(connectedIds);
}

function togglePoolNodeVariationState(nodeId, e) {
  if (e) e.stopPropagation();
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

  saveProjectToLocalStorage();
  renderApp();

  const activeVar = (appData.variations || []).find(v => v.id === activeVariationId);
  const varLabel = activeVar ? `V${activeVar.number}` : 'Variation';
  const countStr = targetIds.length > 1 ? ` (and ${targetIds.length - 1} connected event${targetIds.length > 2 ? 's' : ''})` : '';
  showToast(`${node.codename}${countStr} switched ${willDisable ? 'OFF' : 'ON'} for ${varLabel}`, willDisable ? 'info' : 'success');
}

window.togglePoolNodeVariationState = togglePoolNodeVariationState;

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

// Key Event Block DOM Creation (Inaction Threat Add/Remove, Infinite Reaction by default, Replaceable Resource Requirements)
function createEventNodeDOM(node) {
  const hasInaction = Boolean(node.hasInactionThreat && node.inactionThreat);
  const actionCols = node.actions || [];
  const actionColsCount = Math.max(actionCols.length, 1);
  const totalColumns = actionColsCount + (hasInaction ? 1 : 0);
  const actionWidthPercent = Math.floor(100 / (totalColumns || 1));

  const isPoolEvent = (node.category === 'GenericPool' || node.category === 'DeckPool' || activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool');
  const isDimmed = isPoolEvent && isPoolNodeDimmed(node.id, activeVariationId);
  const currentVar = (appData.variations || []).find(v => v.id === activeVariationId) || { number: 1, name: 'Variation 1' };

  const wrapper = document.createElement('div');
  wrapper.id = `node-${node.id}`;
  const theme = node.colorScheme || 'amber';
  wrapper.className = `absolute event-card event-card-theme-${theme} cols-${totalColumns} cursor-move ${isDimmed ? 'is-pool-disabled' : ''}`;
  wrapper.style.left = `${node.position.x}px`;
  wrapper.style.top = `${node.position.y}px`;

  const zoomControlsHTML = getFloatingZoomButtonsHTML(node.id, false);

  let actionHeadersHTML = '';
  let actionDescHTML = '';
  let actionShortDescHTML = '';
  let actionReqHTML = '';
  let actionTimerHTML = '';
  let actionResultHTML = '';
  let actionRewardHTML = '';
  let actionButtonsHTML = '';

  actionCols.forEach((act, idx) => {
    const removeBtn = actionCols.length > 1 ? `
      <button type="button" class="text-xs text-red-600 hover:text-red-800 font-bold ml-1 bg-red-100/80 px-1 rounded" 
              onclick="event.stopPropagation(); removeActionColumn('${node.id}', ${idx})" title="Remove Action Option">
        ×
      </button>` : '';

    // Check if this action option has connected route suggestion dialogues (shown during event window review)
    const linkedRouteDialogues = (appData.dialogues || []).filter(d => 
      d.targetEventId === node.id && 
      d.triggerTiming === 'action_option' && 
      d.triggerActionId === act.id
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
            <span class="truncate">Action Option ${idx + 1}</span>
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

    actionDescHTML += `<td class="event-value-cell editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'actions.${idx}.description')">${act.description || 'Add description...'}</td>`;
    actionShortDescHTML += `<td class="event-value-cell font-bold text-center editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'actions.${idx}.shortDescription')">${act.shortDescription || 'Choice'}</td>`;
    
    // Interactive Requirement Clauses with AND / OR Badges & Alternatives
    normalizeActionRequirements(act);
    const reqList = act.requirements || [];
    let clausesHTML = reqList.map((clause, clauseIdx) => {
      const itemsList = clause.items || [];
      let itemsHTML = itemsList.map((r, itemIdx) => {
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
    
    // Action Result with Post-Action Purple Dot
    actionResultHTML += `
      <td class="event-value-cell">
        <div class="flex items-start justify-between gap-1">
          <div class="flex-1 editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'actions.${idx}.resultDescription')">
            ${act.resultDescription || 'Action result description...'}
          </div>
          <div class="dialogue-trigger-port post-action-port shrink-0 cursor-pointer" data-node-id="${node.id}" data-action-id="${act.id}" title="Click to spawn connected Dialogue (or drag to existing)" onclick="event.stopPropagation(); createConnectedDialogueFromPort('${node.id}', 'post_action', '${act.id}')"></div>
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

    // Action Button with Blue Connector Port
    actionButtonsHTML += `
      <td class="event-value-cell text-center py-2 bg-yellow-100/50" id="action-btn-cell-${node.id}-${idx}">
        <div class="action-handle-group">
          <button type="button" class="action-handle" onclick="event.stopPropagation(); linkOrEditChoice('${node.id}', '${act.id}')">
            ${act.codeSuffix || `A${idx+1}`}: ${act.shortDescription || 'Choice'}
          </button>
          <div class="connector-port action-port" data-node-id="${node.id}" data-action-id="${act.id}" title="Drag line to connect or spawn new block"></div>
        </div>
      </td>`;
  });

  const addActionColHeader = actionCols.length < 4 ? `
    <button type="button" class="action-opt-icon-btn add-action-btn" 
            onclick="event.stopPropagation(); addActionColumn('${node.id}')" 
            title="Add Action Option (up to 4)">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>` : '';

  const addInactionBtn = !hasInaction ? `
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
    const inactionResult = inaction.resultDescription || 'Catastrophic failure';

    let inactionPenaltyPills = (inaction.penalties || []).map((p, pIdx) => {
      return formatRewardPillHTML(p, node.id, -1, pIdx, true);
    }).join(' ');

    inactionHeaderHTML = `
      <th class="event-label-cell bg-red-100/90 text-red-950 border-red-300 font-bold" style="width: ${actionWidthPercent}%; padding: 4px 6px;">
        <div class="flex items-center justify-between px-1">
          <span class="truncate">⚠️ Inaction</span>
          <button type="button" class="text-xs text-red-600 hover:text-red-800 font-bold ml-1 bg-red-200/80 hover:bg-red-300 px-1.5 py-0.5 rounded transition" 
                  onclick="event.stopPropagation(); removeInactionThreat('${node.id}')" title="Remove Inaction Threat">
            ×
          </button>
        </div>
      </th>`;

    inactionDescCell = `
      <td class="event-value-cell bg-red-50/70 text-red-950 editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'inactionThreat.description')">
        ${inactionDesc}
      </td>`;

    inactionShortDescCell = `
      <td class="event-value-cell bg-red-50/70 text-center font-bold text-red-900 editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'inactionThreat.shortDescription')">
        ${inactionShort}
      </td>`;

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
        <div class="flex items-start justify-between gap-1">
          <div class="flex-1 editable-spot text-red-950" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'inactionThreat.resultDescription')">
            ${inactionResult}
          </div>
          <div class="dialogue-trigger-port post-action-port shrink-0 cursor-pointer" data-node-id="${node.id}" data-action-id="inaction" title="Click to spawn connected Dialogue (or drag to existing)" onclick="event.stopPropagation(); createConnectedDialogueFromPort('${node.id}', 'post_action', 'inaction')"></div>
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

    inactionBtnCell = `
      <td class="event-value-cell text-center py-2 bg-red-100/60" id="inaction-btn-cell-${node.id}">
        <div class="action-handle-group">
          <button type="button" class="action-handle bg-red-800 hover:bg-red-900 text-white border-red-700 font-bold" onclick="event.stopPropagation(); linkOrEditInaction('${node.id}')">
            ${inaction.targetNodeId ? getCodenameById(inaction.targetNodeId) : 'Penalty Resolution'}
          </button>
          <div class="connector-port action-port" data-node-id="${node.id}" data-action-id="inaction" title="Drag line to connect Inaction consequence event"></div>
        </div>
      </td>`;
  }

  wrapper.innerHTML = `
    ${zoomControlsHTML}
    <div class="event-card-inner">
      ${isPoolEvent ? getPoolSwitchBarHTML(node, isDimmed, currentVar) : ''}
      <div class="event-card-body ${isDimmed ? 'is-pool-dimmed' : ''}">
        <!-- Event Block Header with Pre-Event Trigger Port -->
      <div class="event-header flex justify-between items-center px-3 py-1.5">
        <div class="flex items-center gap-2">
          <span class="codename-badge editable-spot font-mono font-bold" onclick="event.stopPropagation(); makeInlineCodenameEditable(this, '${node.id}')">
            ${node.codename}
          </span>
          <span class="font-bold text-xs editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'name')">
            ${node.name}
          </span>
          <div class="dialogue-trigger-port pre-event-port cursor-pointer" data-node-id="${node.id}" title="Click to spawn connected Dialogue (or drag to existing)" onclick="event.stopPropagation(); createConnectedDialogueFromPort('${node.id}', 'pre_event', null)"></div>
        </div>

        <div class="flex items-center gap-1.5">
          <button type="button" class="comment-trigger-badge" title="Comments & Discussions" onclick="event.stopPropagation(); openCommentsDrawer('${node.id}', 'event', '${escapeHtml(node.name || node.codename)}')">
            💬 <span class="cmt-cnt-${node.id}">${getCommentCount(node.id)}</span>
          </button>
          <select class="event-theme-select" 
                  title="Change Event Block Color Scheme"
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

          <button type="button" class="card-btn card-btn-delete" 
                  onclick="event.stopPropagation(); deleteEventNode('${node.id}')" title="Delete Event Block">
            ✕ Delete
          </button>
        </div>
      </div>

    <!-- Event Appearance Spawn conditions Row -->
    <div class="event-location-row px-3 py-1 flex items-center gap-2 text-xs">
      <span class="font-bold text-[11px] uppercase tracking-wider shrink-0 theme-substrip-label">Spawn conditions:</span>
      <div class="editable-spot italic text-gray-800 flex-1 truncate" 
           title="Click to specify spawn conditions for this event"
           onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'spawnConditions')">
        ${(node.spawnConditions !== undefined && node.spawnConditions !== null && node.spawnConditions !== '') ? node.spawnConditions : (node.location || 'Click to set spawn conditions...')}
      </div>
    </div>

    <!-- Event-Level Metadata Header Strip -->
    <div class="event-meta-row px-3 py-1.5 flex items-start justify-between gap-3 text-xs">
      <div class="flex items-center gap-2 shrink-0 pt-0.5">
        <span class="font-bold text-[11px] uppercase tracking-wider theme-substrip-label">Type:</span>
        <select class="inline-select bg-white border font-bold text-xs py-0.5 px-2 rounded" onchange="updateNodeField('${node.id}', 'type', this.value)">
          <option value="World" ${node.type === 'World' ? 'selected' : ''}>World Event</option>
          <option value="Deck" ${node.type === 'Deck' ? 'selected' : ''}>Deck Event</option>
        </select>
      </div>

      <div class="flex items-start gap-2 flex-1 min-w-0 mx-1">
        <span class="font-bold text-[11px] uppercase tracking-wider shrink-0 mt-0.5 theme-substrip-label">Intro:</span>
        <div class="editable-spot text-xs italic leading-snug text-gray-800 flex-1 break-words" 
             title="Click to edit event intro text"
             onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'eventIntro')">
          ${node.eventIntro || 'Distress signal coming from Keeling island...'}
        </div>
      </div>

      <div class="flex items-center gap-1.5 shrink-0 pt-0.5 whitespace-nowrap">
        <span class="font-bold text-[11px] uppercase tracking-wider theme-substrip-label">Reaction:</span>
        <select class="rx-timer-select"
                title="Reaction time limit (Infinite or hours)"
                onclick="event.stopPropagation();"
                onmousedown="event.stopPropagation();"
                onchange="updateNodeReactionTimer('${node.id}', this.value)">
          ${getReactionTimerOptionsHTML(node.reactionTimerHours)}
        </select>
      </div>
    </div>

    <div class="event-desc-row px-3 py-1.5 text-xs">
      <div class="flex items-start gap-2">
        <span class="font-bold text-[11px] uppercase tracking-wider shrink-0 mt-0.5 theme-substrip-label">Description:</span>
        <div class="editable-spot leading-snug text-gray-800 flex-1" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'eventDescription')">
          ${node.eventDescription || 'Event context description...'}
        </div>
      </div>
    </div>

    <!-- Actions & Inaction Threat Table -->
    <table class="event-table">
      <thead>
        <tr>
          <th class="event-label-cell" style="padding: 4px 6px;">
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
          <td class="event-label-cell">Action Description</td>
          ${actionDescHTML}
          ${inactionDescCell}
        </tr>

        <tr>
          <td class="event-label-cell">Action Short Desc</td>
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
          <td class="event-label-cell">Action Result Desc</td>
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
  if (!confirm("Are you sure you want to delete this event block?")) return;
  pushUndoState();

  appData.nodes = appData.nodes.filter(n => n.id !== nodeId);

  // Clear incoming target references
  appData.nodes.forEach(n => {
    (n.actions || []).forEach(act => {
      if (act.targetNodeId === nodeId) act.targetNodeId = null;
    });
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

  saveProjectToLocalStorage();
  renderApp();
  showToast("Event block deleted", "info");
}

function deleteDialogueNode(dialogueId, skipConfirm = false) {
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
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;
  pushUndoState();
  node.colorScheme = colorScheme;
  saveProjectToLocalStorage();
  renderApp();
  showToast(`Color scheme updated to ${colorScheme}`, "info");
}

function updateDialogueColorScheme(dialogueId, colorScheme) {
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
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;
  if (!node.actions) node.actions = [];
  if (node.actions.length >= 4) {
    alert("Maximum of 4 action options allowed per event block.");
    return;
  }

  pushUndoState();
  const suffixes = ['A1', 'B1', 'C1', 'D1'];
  const newIdx = node.actions.length;
  const nextSuffix = suffixes[newIdx] || `A${newIdx + 1}`;
  const nextLetter = String.fromCharCode(65 + newIdx);

  node.actions.push({
    id: `act_${Date.now()}`,
    codeSuffix: nextSuffix,
    shortDescription: `Choice ${nextLetter}`,
    description: `Description for action choice ${nextLetter}...`,
    requirements: [],
    timerHours: 5,
    resultDescription: "",
    rewards: ["🧠 Knowledge +100"]
  });

  saveProjectToLocalStorage();
  renderApp();
  showToast(`Action Option ${newIdx + 1} added (${nextSuffix})`, "success");
}

function removeActionColumn(nodeId, actionIdx) {
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
  wrapper.style.top = `${node.position.y}px`;

  const zoomControlsHTML = getFloatingZoomButtonsHTML(node.id, false);

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

  wrapper.innerHTML = `
    ${zoomControlsHTML}
    <div class="flex justify-between items-start mb-3">
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

  const zoomControlsHTML = getFloatingZoomButtonsHTML(node.id, false);

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

  wrapper.innerHTML = `
    ${zoomControlsHTML}
    <div class="flex justify-between items-center mb-3">
      <div class="generic-banner flex-1">${node.codename}</div>
      <div class="generic-premise-card ml-4 w-64 bg-amber-100 border border-amber-300 p-2 rounded text-xs text-amber-900 editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'eventDescription')">
        ${node.eventDescription}
      </div>
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

// Dialogue Block DOM Creation (REQUIREMENT 4 FIX: Structured Time Delay & Trigger Badges)
function createDialogueNodeDOM(dialogue) {
  const wrapper = document.createElement('div');
  wrapper.id = `dialogue-${dialogue.id}`;
  wrapper.className = 'absolute dialogue-card cursor-move';
  wrapper.style.left = `${dialogue.position.x}px`;
  wrapper.style.top = `${dialogue.position.y}px`;

  const allChars = appData.characters || getDefaultCharactersList();
  const availableChars = allChars.filter(c => {
    if (!c.variationIds || c.variationIds.length === 0) return true;
    return c.variationIds.includes(activeVariationId);
  });

  const targetNode = appData.nodes.find(n => n.id === dialogue.targetEventId);
  const isDetached = !targetNode || !dialogue.targetEventId;
  const isActionOption = !isDetached && dialogue.triggerTiming === 'action_option';

  const isTargetDimmed = targetNode && isPoolNodeDimmed(targetNode.id, activeVariationId);
  const theme = dialogue.colorScheme || 'purple';
  wrapper.className = `absolute dialogue-card dialogue-theme-${theme} cursor-move ${isDetached ? 'is-detached' : ''} ${isActionOption ? 'is-action-option' : ''} ${isTargetDimmed ? 'is-pool-dimmed' : ''}`;

  let linesHTML = dialogue.lines.map((l, lIdx) => {
    const charMeta = allChars.find(c => c.id === l.speakerId || c.name === l.speakerName) || { color: '#e5e7eb', textColor: '#1f2937', icon: '👤' };
    const isFirst = lIdx === 0;
    const isLast = lIdx === dialogue.lines.length - 1;

    return `
      <div class="dialogue-row" data-line-index="${lIdx}">
        <div class="dialogue-speaker-banner flex items-center justify-between" style="background-color:${charMeta.color}; color:${charMeta.textColor}">
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <span>${charMeta.icon}</span>
            <select class="inline-select text-xs font-bold" onchange="updateDialogueSpeaker('${dialogue.id}', ${lIdx}, this.value)">
              ${availableChars.map(c => `<option value="${c.id}" ${c.id === l.speakerId ? 'selected' : ''}>${c.name} (${c.role || ''})</option>`).join('')}
            </select>
          </div>

          <div class="flex items-center gap-1 shrink-0 ml-1">
            <!-- Move Line Up -->
            <button type="button" 
                    class="line-move-btn px-1.5 py-0.5 rounded text-[11px] font-bold hover:bg-black/15 transition ${isFirst ? 'opacity-25 cursor-not-allowed' : 'hover:scale-110 active:scale-95'}" 
                    title="Move line up" 
                    ${isFirst ? 'disabled' : ''} 
                    onclick="event.stopPropagation(); moveDialogueLine('${dialogue.id}', ${lIdx}, -1)">
              ▲
            </button>

            <!-- Move Line Down -->
            <button type="button" 
                    class="line-move-btn px-1.5 py-0.5 rounded text-[11px] font-bold hover:bg-black/15 transition ${isLast ? 'opacity-25 cursor-not-allowed' : 'hover:scale-110 active:scale-95'}" 
                    title="Move line down" 
                    ${isLast ? 'disabled' : ''} 
                    onclick="event.stopPropagation(); moveDialogueLine('${dialogue.id}', ${lIdx}, 1)">
              ▼
            </button>

            <!-- Add Line Below -->
            <button type="button" 
                    class="line-add-btn text-[11px] bg-black/10 hover:bg-black/20 px-1.5 py-0.5 rounded font-bold transition hover:scale-105 active:scale-95" 
                    title="Insert new dialogue line under this line" 
                    onclick="event.stopPropagation(); insertDialogueLineBelow('${dialogue.id}', ${lIdx})">
              + Line
            </button>

            <!-- Delete Line -->
            <button type="button" 
                    class="line-delete-btn text-xs text-red-600 hover:text-red-800 hover:bg-red-200/50 px-1 rounded font-bold transition ml-0.5" 
                    title="Delete Line" 
                    onclick="event.stopPropagation(); deleteDialogueLine('${dialogue.id}', ${lIdx})">
              ×
            </button>
          </div>
        </div>

        <div class="dialogue-text editable-spot" onclick="event.stopPropagation(); makeInlineDialogueTextEditable(this, '${dialogue.id}', ${lIdx})">
          ${l.text || 'Speech text...'}
        </div>
      </div>
    `;
  }).join('');

  const zoomControlsHTML = getFloatingZoomButtonsHTML(dialogue.id, true);

  wrapper.innerHTML = `
    ${zoomControlsHTML}
    <div class="dialogue-card-inner">
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
            ` : `
              <select class="inline-select text-[10px] font-bold uppercase tracking-wider ${isActionOption ? 'bg-indigo-100 text-indigo-950 border-indigo-400' : 'bg-purple-200 text-purple-950 border-purple-400'} border rounded px-1.5 py-0.5 max-w-[210px] truncate cursor-pointer shadow-xs shrink"
                      title="Change dialogue trigger timing: Pre-Event, Route Suggestion, or Post-Action"
                      onchange="updateDialogueTriggerTiming('${dialogue.id}', this.value)">
                <option value="pre_event" ${dialogue.triggerTiming === 'pre_event' ? 'selected' : ''}>⚡ Pre-Event (Before Window)</option>
                ${(targetNode.actions || []).map((act, aIdx) => `
                  <option value="action_option:${act.id}" ${(dialogue.triggerTiming === 'action_option' && dialogue.triggerActionId === act.id) ? 'selected' : ''}>
                    💬 Suggest Route: Option ${aIdx + 1} (${act.shortDescription || 'Choice'})
                  </option>
                `).join('')}
                ${(targetNode.actions || []).map((act, aIdx) => `
                  <option value="post_action:${act.id}" ${(dialogue.triggerTiming === 'post_action' && dialogue.triggerActionId === act.id) ? 'selected' : ''}>
                    🏁 Post-Action: Option ${aIdx + 1} (${act.shortDescription || 'Choice'})
                  </option>
                `).join('')}
                ${targetNode.hasInactionThreat ? `
                  <option value="post_action:inaction" ${(dialogue.triggerTiming === 'post_action' && dialogue.triggerActionId === 'inaction') ? 'selected' : ''}>
                    💀 Post-Inaction Failure
                  </option>
                ` : ''}
              </select>
              <button type="button" 
                      class="card-btn card-btn-jump shrink-0" 
                      title="Jump to Event ${targetNode.codename}"
                      onclick="event.stopPropagation(); zoomInToBlock('${targetNode.id}', false)">
                ${targetNode.codename} ↗
              </button>
            `}
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" class="comment-trigger-badge" title="Comments & Discussions" onclick="event.stopPropagation(); openCommentsDrawer('${dialogue.id}', 'dialogue', 'Dialogue ${dialogue.id}')">
              💬 <span class="cmt-cnt-${dialogue.id}">${getCommentCount(dialogue.id)}</span>
            </button>
            ${targetNode ? `
              <button type="button" class="card-btn card-btn-unlink" 
                      title="Disconnect from Event" onclick="event.stopPropagation(); disconnectDialogueLink('${dialogue.id}')">
                ⊘ Unlink
              </button>
            ` : ''}
            <button type="button" class="card-btn card-btn-delete" 
                    title="Delete Dialogue Block" onclick="event.stopPropagation(); deleteDialogueNode('${dialogue.id}')">
              ✕ Delete
            </button>
          </div>
        </div>

        <!-- Structured Time Delay Controls (Measured strictly in hours) -->
        <div class="dialogue-delay-strip flex items-center justify-between p-1.5 rounded-lg border text-xs">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-[11px]">⏱ Delay:</span>
            <input type="number" class="inline-input w-16 font-bold text-center px-1.5 py-0.5 rounded" 
                   value="${dialogue.delayHours !== undefined ? dialogue.delayHours : (dialogue.delayMinutes !== undefined ? (dialogue.delayMinutes >= 60 ? dialogue.delayMinutes/60 : dialogue.delayMinutes) : 0)}" 
                   min="0" step="0.5" 
                   onchange="updateDialogueDelayHours('${dialogue.id}', this.value)">
            <span class="font-bold text-xs">hours</span>
          </div>

          <div class="text-[10px] font-semibold italic truncate cursor-pointer hover:underline editable-spot flex-1 text-right ml-2" 
               title="Click to edit trigger condition"
               onclick="event.stopPropagation(); makeInlineDialogueConditionEditable(this, '${dialogue.id}')">
            ${dialogue.triggerCondition || (isDetached ? 'Detached Conversation' : 'Dialog spawn trigger')}
          </div>
        </div>
      </div>
      <div class="divide-y divide-gray-200">
        ${linesHTML}
      </div>
      <div class="dialogue-footer relative p-2 border-t flex items-center justify-center">
        <button type="button" 
                class="dialogue-add-btn text-xs font-bold border rounded-lg px-3.5 py-1.5 flex items-center gap-1.5 transition shadow-sm active:scale-95"
                onclick="event.stopPropagation(); addDialogueLineTurn('${dialogue.id}')" 
                title="Add new dialogue line under existing lines">
          <span class="text-sm font-bold leading-none">+</span> <span>Add Line of Dialogue</span>
        </button>

        <div class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
          <select class="event-theme-select" 
                  title="Change Dialogue Block Color Scheme"
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

function makeInlineDialogueConditionEditable(element, dialogueId) {
  if (element.querySelector('input')) return;
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (!diag) return;

  const currentText = diag.triggerCondition || '';
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
    diag.triggerCondition = input.value.trim();
    saveProjectToLocalStorage();
    renderApp();
  };
}

function makeInlineDialogueTriggerBadgeEditable(badgeEl, dialogueId) {
  if (badgeEl.querySelector('input')) return;
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (!diag) return;

  const currentText = diag.triggerCondition || '';
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
    diag.triggerCondition = input.value.trim();
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

// Requirement 2: Create Standalone Unconnected Dialogue Card
function createStandaloneDialogue() {
  pushUndoState();
  const isTier = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool');
  const posX = isTier ? 1040 : 1450;
  const posY = isTier ? 140 : FLOOR_Y[0];

  const newDiag = {
    id: `diag_${Date.now()}`,
    targetEventId: null,
    triggerTiming: null,
    triggerActionId: null,
    delayHours: 0,
    delayUnit: 'hours',
    triggerCondition: 'Standalone Conversation',
    position: { x: posX, y: posY },
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
  pushUndoState();
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (diag) {
    diag.delayHours = parseFloat(val) || 0;
    saveProjectToLocalStorage();
    renderApp();
  }
}

function updateDialogueTriggerTiming(dialogueId, combinedVal) {
  pushUndoState();
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (!diag) return;
  const targetNode = appData.nodes.find(n => n.id === diag.targetEventId);

  if (combinedVal === 'pre_event') {
    diag.triggerTiming = 'pre_event';
    diag.triggerActionId = null;
    diag.triggerCondition = formatDialogueTriggerCondition('pre_event', targetNode, null);
  } else if (combinedVal.startsWith('action_option:')) {
    const actId = combinedVal.split(':')[1];
    diag.triggerTiming = 'action_option';
    diag.triggerActionId = actId;
    diag.triggerCondition = formatDialogueTriggerCondition('action_option', targetNode, actId);
  } else if (combinedVal.startsWith('post_action:')) {
    const actId = combinedVal.split(':')[1];
    diag.triggerTiming = 'post_action';
    diag.triggerActionId = actId;
    diag.triggerCondition = formatDialogueTriggerCondition('post_action', targetNode, actId);
  }

  saveProjectToLocalStorage();
  renderApp();
  showToast("Dialogue trigger timing updated", "success");
}

function disconnectDialogueLink(dialogueId) {
  pushUndoState();
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (diag) {
    diag.targetEventId = null;
    diag.triggerTiming = null;
    diag.triggerActionId = null;
    saveProjectToLocalStorage();
    renderApp();
  }
}

// Interactive Port Drag Engine (Action Ports & Purple Dialogue Ports on Events)
function setupPortDragEvents() {
  document.addEventListener('mousedown', (e) => {
    const actionPort = e.target.closest('.action-port');
    const preEventPort = e.target.closest('.pre-event-port');
    const postActionPort = e.target.closest('.post-action-port');
    const actionOptionPort = e.target.closest('.action-option-port');

    if (!actionPort && !preEventPort && !postActionPort && !actionOptionPort) return;

    e.stopPropagation();

    if (actionPort) {
      const nodeId = actionPort.getAttribute('data-node-id');
      const actionId = actionPort.getAttribute('data-action-id');
      const sourceNode = appData.nodes.find(n => n.id === nodeId);
      if (!sourceNode) return;

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
    } else if (preEventPort) {
      const nodeId = preEventPort.getAttribute('data-node-id');
      const sourceNode = appData.nodes.find(n => n.id === nodeId);
      if (!sourceNode) return;

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
    } else if (actionOptionPort) {
      const nodeId = actionOptionPort.getAttribute('data-node-id');
      const actionId = actionOptionPort.getAttribute('data-action-id');
      const sourceNode = appData.nodes.find(n => n.id === nodeId);
      if (!sourceNode) return;

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
    } else if (postActionPort) {
      const nodeId = postActionPort.getAttribute('data-node-id');
      const actionId = postActionPort.getAttribute('data-action-id');
      const sourceNode = appData.nodes.find(n => n.id === nodeId);
      if (!sourceNode) return;

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
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!portDragState.isDragging || !canvasStage) return;

    const stageRect = canvasStage.getBoundingClientRect();
    const mouseX = (e.clientX - stageRect.left) / transform.scale;
    const mouseY = (e.clientY - stageRect.top) / transform.scale;

    renderConnectors();
    renderTempConnectorPath(portDragState.startPos.x, portDragState.startPos.y, mouseX, mouseY);
  });

  document.addEventListener('mouseup', (e) => {
    if (!portDragState.isDragging) return;
    pushUndoState();

    const stageRect = canvasStage.getBoundingClientRect();
    const mouseX = (e.clientX - stageRect.left) / transform.scale;
    const mouseY = (e.clientY - stageRect.top) / transform.scale;

    const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
    const targetCard = elementUnderMouse ? elementUnderMouse.closest('.event-card') : null;
    const targetDialogue = elementUnderMouse ? elementUnderMouse.closest('.dialogue-card') : null;

    if (portDragState.sourceType === 'action') {
      const sourceNode = appData.nodes.find(n => n.id === portDragState.sourceNodeId);
      if (sourceNode) {
        if (portDragState.sourceActionId === 'inaction') {
          if (!sourceNode.inactionThreat) sourceNode.inactionThreat = {};
          if (targetCard) {
            sourceNode.inactionThreat.targetNodeId = targetCard.id.replace('node-', '');
          } else {
            let closestFloorIdx = 0;
            let minDistance = Infinity;
            FLOOR_Y.forEach((fy, idx) => {
              const dist = Math.abs(mouseY - fy);
              if (dist < minDistance) { minDistance = dist; closestFloorIdx = idx; }
            });
            const newNode = {
              id: `node_${Date.now()}`,
              codename: `T1-V1-E${closestFloorIdx}-FAIL`,
              name: `Consequence of ${sourceNode.codename}`,
              type: sourceNode.type,
              category: sourceNode.category,
              variationId: sourceNode.variationId,
              floorIndex: closestFloorIdx,
              spawnConditions: `Inaction Failure on ${sourceNode.codename}`,
              eventDescription: "Catastrophic outcome occurred due to inaction...",
              reactionTimerHours: "Infinite",
              hasInactionThreat: false,
              inactionThreat: null,
              position: { x: Math.round(mouseX - 200), y: FLOOR_Y[closestFloorIdx] },
              actions: [
                { id: `c_${Date.now()}`, codeSuffix: "A1", shortDescription: "Recover", description: "Attempt salvage", requirements: [], timerHours: 5, resultDescription: "", rewards: ["💀 Entropy +5"] }
              ]
            };
            appData.nodes.push(newNode);
            if (!sourceNode.inactionThreat) sourceNode.inactionThreat = {};
            sourceNode.inactionThreat.targetNodeId = newNode.id;
            preventNodeOverlap(newNode.id);
          }
        } else {
          const action = (sourceNode.actions || []).find(a => a.id === portDragState.sourceActionId);
          if (action) {
            if (targetCard) {
              const targetId = targetCard.id.replace('node-', '');
              action.targetNodeId = targetId;
            } else {
              let closestFloorIdx = 0;
              let minDistance = Infinity;
              FLOOR_Y.forEach((fy, idx) => {
                const dist = Math.abs(mouseY - fy);
                if (dist < minDistance) { minDistance = dist; closestFloorIdx = idx; }
              });

              const actionSuffix = action.codeSuffix || 'A1';
              const newCodename = `T1-V1-E${closestFloorIdx}-${actionSuffix}`;
              const newNode = {
                id: `node_${Date.now()}`,
                codename: newCodename,
                name: `Outcome from ${sourceNode.codename}`,
                type: sourceNode.type,
                category: sourceNode.category,
                variationId: sourceNode.variationId,
                floorIndex: closestFloorIdx,
                spawnConditions: `Triggered by ${sourceNode.codename}`,
                eventDescription: "Enter new outcome narrative body text...",
                reactionTimerHours: "Infinite",
                hasInactionThreat: false,
                inactionThreat: null,
                position: { x: Math.round(mouseX - 200), y: FLOOR_Y[closestFloorIdx] },
                actions: [
                  { id: `c_${Date.now()}`, codeSuffix: "A1", shortDescription: "Continue", description: "Next step narrative", requirements: [], timerHours: 5, resultDescription: "", rewards: ["🧠 Knowledge +100"] }
                ]
              };

              appData.nodes.push(newNode);
              action.targetNodeId = newNode.id;
              preventNodeOverlap(newNode.id);
            }
          }
        }
      }
    } else if (portDragState.sourceType === 'pre_event_dialogue' || portDragState.sourceType === 'post_action_dialogue' || portDragState.sourceType === 'action_option_dialogue') {
      if (targetDialogue) {
        const diagId = targetDialogue.id.replace('dialogue-', '');
        const diag = appData.dialogues.find(d => d.id === diagId);
        const sourceNode = appData.nodes.find(n => n.id === portDragState.sourceNodeId);

        if (diag && sourceNode) {
          diag.targetEventId = sourceNode.id;

          if (portDragState.sourceType === 'pre_event_dialogue') {
            diag.triggerTiming = 'pre_event';
            diag.triggerActionId = null;
            diag.triggerCondition = formatDialogueTriggerCondition('pre_event', sourceNode, null);
          } else if (portDragState.sourceType === 'action_option_dialogue') {
            diag.triggerTiming = 'action_option';
            diag.triggerActionId = portDragState.sourceActionId;
            diag.triggerCondition = formatDialogueTriggerCondition('action_option', sourceNode, portDragState.sourceActionId);
          } else {
            diag.triggerTiming = 'post_action';
            diag.triggerActionId = portDragState.sourceActionId;
            diag.triggerCondition = formatDialogueTriggerCondition('post_action', sourceNode, portDragState.sourceActionId);
          }
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

    portDragState.isDragging = false;
    saveProjectToLocalStorage();
    renderApp();
  });
}

function renderTempConnectorPath(x1, y1, x2, y2) {
  let tempPath = document.getElementById('svg-temp-path');
  if (!tempPath) {
    tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('id', 'svg-temp-path');
    tempPath.setAttribute('class', 'connector-path-temp');
    svgConnectors.appendChild(tempPath);
  }
  const isDialogue = portDragState && (portDragState.sourceType === 'pre_event_dialogue' || portDragState.sourceType === 'post_action_dialogue' || portDragState.sourceType === 'action_option_dialogue');
  const d = drawOrthogonalLine(x1, y1, x2, y2);
  tempPath.setAttribute('d', d);
  if (isDialogue) {
    tempPath.style.stroke = (portDragState && portDragState.sourceType === 'action_option_dialogue') ? '#8b5cf6' : '#a855f7';
  } else {
    tempPath.style.stroke = '#22c55e';
  }
}

// Stage-Embedded Pure Stage Coordinate Connector Renderer (Zero Drift on Zoom/Pan)
function renderConnectors() {
  if (!svgConnectors) return;
  
  const defs = svgConnectors.querySelector('defs');
  svgConnectors.innerHTML = '';
  if (defs) svgConnectors.appendChild(defs);

  const overlaysLayer = document.getElementById('connector-overlays-layer');
  if (overlaysLayer) overlaysLayer.innerHTML = '';

  const NODE_WIDTH = 880;
  const LABEL_WIDTH = 190;

  const isPoolPage = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool');

  // 1. Draw Action -> Event Connections (Filtered by Category & Variation for critical chains, all pool connectors on pool pages)
  appData.nodes.forEach(sourceNode => {
    if (!isPoolPage && sourceNode.variationId && sourceNode.variationId !== activeVariationId) return;
    if ((sourceNode.category || 'KeyChain') !== activeCategoryFilter) return;

    const sourceEl = document.getElementById(`node-${sourceNode.id}`);
    const sourceHeight = sourceEl ? sourceEl.offsetHeight : 520;
    const sourceWidth = (sourceEl && sourceEl.offsetWidth > 100) ? sourceEl.offsetWidth : 880;
    const hasInaction = Boolean(sourceNode.hasInactionThreat && sourceNode.inactionThreat);
    const actionCount = Math.max((sourceNode.actions || []).length, 1);
    const totalCols = actionCount + (hasInaction ? 1 : 0);
    const colWidth = (sourceWidth - LABEL_WIDTH) / Math.max(totalCols, 1);

    (sourceNode.actions || []).forEach((action, actIdx) => {
      if (!action.targetNodeId) return;

      const targetNode = appData.nodes.find(n => n.id === action.targetNodeId);
      if (!targetNode) return;
      if (!isPoolPage && targetNode.variationId && targetNode.variationId !== activeVariationId) return;
      if ((targetNode.category || 'KeyChain') !== activeCategoryFilter) return;

      const targetEl = document.getElementById(`node-${targetNode.id}`);
      const targetWidth = (targetEl && targetEl.offsetWidth > 100) ? targetEl.offsetWidth : 880;

      const startX = sourceNode.position.x + LABEL_WIDTH + (actIdx + 0.5) * colWidth;
      const startY = sourceNode.position.y + sourceHeight;

      const endX = targetNode.position.x + (targetWidth / 2);
      const endY = targetNode.position.y;

      const orthoPath = drawOrthogonalLine(startX, startY, endX, endY);
      const isDimmedLink = isPoolPage && (isPoolNodeDimmed(sourceNode.id) || isPoolNodeDimmed(targetNode.id));
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', orthoPath);
      path.setAttribute('class', 'connector-path-ortho' + (isDimmedLink ? ' is-pool-dimmed' : ''));
      path.setAttribute('marker-end', 'url(#arrow)');
      
      path.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Remove connection link from ${sourceNode.codename} (${action.shortDescription || 'Choice'}) to ${targetNode.codename}?`)) {
          pushUndoState();
          action.targetNodeId = null;
          saveProjectToLocalStorage();
          renderApp();
        }
      };

      svgConnectors.appendChild(path);
    });

    // Inaction Threat -> Consequence Node Connection
    if (hasInaction && sourceNode.inactionThreat && sourceNode.inactionThreat.targetNodeId) {
      const targetNode = appData.nodes.find(n => n.id === sourceNode.inactionThreat.targetNodeId);
      if (targetNode) {
        if (!isPoolPage && targetNode.variationId && targetNode.variationId !== activeVariationId) return;
        if ((targetNode.category || 'KeyChain') !== activeCategoryFilter) return;

        const targetEl = document.getElementById(`node-${targetNode.id}`);
        const targetWidth = (targetEl && targetEl.offsetWidth > 100) ? targetEl.offsetWidth : 880;

        const startX = sourceNode.position.x + LABEL_WIDTH + (actionCount + 0.5) * colWidth;
        const startY = sourceNode.position.y + sourceHeight;
        const endX = targetNode.position.x + (targetWidth / 2);
        const endY = targetNode.position.y;
        const orthoPath = drawOrthogonalLine(startX, startY, endX, endY);
        const isDimmedInaction = isPoolPage && (isPoolNodeDimmed(sourceNode.id) || isPoolNodeDimmed(targetNode.id));

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', orthoPath);
        path.setAttribute('class', 'connector-path-ortho' + (isDimmedInaction ? ' is-pool-dimmed' : ''));
        path.setAttribute('marker-end', 'url(#arrow)');
        path.style.stroke = '#ef4444';
        path.onclick = (e) => {
          e.stopPropagation();
          if (confirm(`Remove inaction failure link from ${sourceNode.codename} to ${targetNode.codename}?`)) {
            pushUndoState();
            sourceNode.inactionThreat.targetNodeId = null;
            saveProjectToLocalStorage();
            renderApp();
          }
        };
        svgConnectors.appendChild(path);
      }
    }
  });

  // 2. Draw Event -> Dialogue Connections (Closest Direct Line with Arrow Jump Button & Middle Trigger Description Badge)
  appData.dialogues.forEach(dialogue => {
    if (!dialogue.targetEventId) return;
    if (!isPoolPage && dialogue.variationId && dialogue.variationId !== activeVariationId) return;
    if (dialogue.category && dialogue.category !== activeCategoryFilter) return;

    const sourceNode = appData.nodes.find(n => n.id === dialogue.targetEventId);
    if (!sourceNode) return;
    if (!isPoolPage && sourceNode.variationId && sourceNode.variationId !== activeVariationId) return;
    if ((sourceNode.category || 'KeyChain') !== activeCategoryFilter) return;

    const sourceEl = document.getElementById(`node-${sourceNode.id}`);
    const diagEl = document.getElementById(`dialogue-${dialogue.id}`);
    const w1 = (sourceEl && sourceEl.offsetWidth > 100) ? sourceEl.offsetWidth : 880;
    const h1 = (sourceEl && sourceEl.offsetHeight > 100) ? sourceEl.offsetHeight : 540;
    const w2 = (diagEl && diagEl.offsetWidth > 100) ? diagEl.offsetWidth : 420;
    const h2 = (diagEl && diagEl.offsetHeight > 100) ? diagEl.offsetHeight : 260;

    let sourceRect = { x: sourceNode.position.x, y: sourceNode.position.y, w: w1, h: h1 };
    if (dialogue.triggerTiming === 'action_option' && dialogue.triggerActionId) {
      const actIdx = (sourceNode.actions || []).findIndex(a => a.id === dialogue.triggerActionId);
      if (actIdx !== -1) {
        const hasInaction = Boolean(sourceNode.hasInactionThreat && sourceNode.inactionThreat);
        const actionCount = Math.max((sourceNode.actions || []).length, 1);
        const totalCols = actionCount + (hasInaction ? 1 : 0);
        const colWidth = (w1 - LABEL_WIDTH) / Math.max(totalCols, 1);
        const colCenterX = sourceNode.position.x + LABEL_WIDTH + (actIdx + 0.5) * colWidth;

        // If dialogue is above or below the event card, anchor to this specific column bounds
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
      { x: dialogue.position.x, y: dialogue.position.y, w: w2, h: h2 }
    );

    const isDimmedDiag = isPoolPage && isPoolNodeDimmed(sourceNode.id);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('id', `connector-path-diag-${dialogue.id}`);
    path.setAttribute('d', orthoPath);
    path.setAttribute('class', 'connector-path-dialogue' + (dialogue.triggerTiming === 'action_option' ? ' is-action-option' : '') + (isDimmedDiag ? ' is-pool-dimmed' : ''));
    path.title = "Click to remove or disconnect dialogue block";
    
    path.onclick = (e) => {
      e.stopPropagation();
      const shouldDelete = confirm("Remove this dialogue block from the schematic? (Click Cancel if you only want to unlink it)");
      if (shouldDelete) {
        deleteDialogueNode(dialogue.id, true);
      } else {
        if (confirm("Disconnect dialogue block from event block?")) {
          pushUndoState();
          dialogue.targetEventId = null;
          saveProjectToLocalStorage();
          renderApp();
        }
      }
    };

    svgConnectors.appendChild(path);

    if (overlaysLayer) {
      // Dynamic margin along the connector line: keeps purple jump arrows clearly separated from card edges and zoom controls
      const lineDist = Math.hypot(endX - startX, endY - startY);
      const arrowMargin = Math.max(16, Math.min(26, Math.floor(lineDist * 0.22)));

      // 1. Arrow Button at Event edge pointing toward dialogue
      const arrow1X = Math.round(startX + startVec.x * arrowMargin);
      const arrow1Y = Math.round(startY + startVec.y * arrowMargin);

      const arrowBtn1 = document.createElement('button');
      arrowBtn1.type = 'button';
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
      const triggerText = (dialogue.triggerCondition && dialogue.triggerCondition.trim() !== '') 
        ? dialogue.triggerCondition.trim() 
        : 'Dialog spawn trigger';
      const isDefault = !dialogue.triggerCondition || dialogue.triggerCondition.trim() === '';

      const badge = document.createElement('div');
      badge.className = `dialogue-trigger-badge ${isDefault ? 'is-default' : ''}${isDimmedDiag ? ' is-pool-dimmed' : ''}`;
      badge.style.left = `${midX}px`;
      badge.style.top = `${midY}px`;
      badge.title = "Click to edit dialogue spawn trigger description";
      badge.innerHTML = `<span class="truncate">${triggerText}</span>`;
      badge.onclick = (e) => {
        e.stopPropagation();
        makeInlineDialogueTriggerBadgeEditable(badge, dialogue.id);
      };
      overlaysLayer.appendChild(badge);
    }
  });
}

function drawOrthogonalLine(x1, y1, x2, y2) {
  const midY = y1 + (y2 - y1) / 2;
  return `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`;
}

// Orthogonal Connector Engine for Dialogue Cards:
// 1. Tries to be a single straight horizontal or vertical line if overlapping on that axis.
// 2. Only if it cannot be a single line (diagonal), breaks orthogonally with right angles (90 degrees).
function calculateOrthogonalDialogueConnector(sourceRect, diagRect) {
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
    let yStar = Math.round((minY + maxY) / 2);

    // Margin safety: keep horizontal connector lines and purple arrows from overlapping header-level zoom buttons (top 50px)
    if (yStar < minY + 52 && (maxY - minY > 70)) {
      yStar = Math.min(maxY - 25, minY + 62);
    }

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
    const xStar = Math.round((minX + maxX) / 2);

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
        startY = Math.round(Math.min(Math.max(c2y, y1 + 55), y1 + h1 - 35));
        endX = x2;
        endY = Math.round(Math.min(Math.max(c1y, y2 + 55), y2 + h2 - 25));
        startAngle = 0;
        endAngle = 180;
        startVec = { x: 1, y: 0 };
        endVec = { x: -1, y: 0 };
      } else {
        // Dialogue to the left
        startX = x1;
        startY = Math.round(Math.min(Math.max(c2y, y1 + 55), y1 + h1 - 35));
        endX = x2 + w2;
        endY = Math.round(Math.min(Math.max(c1y, y2 + 55), y2 + h2 - 25));
        startAngle = 180;
        endAngle = 0;
        startVec = { x: -1, y: 0 };
        endVec = { x: 1, y: 0 };
      }
      midX = Math.round((startX + endX) / 2);
      midY = Math.round((startY + endY) / 2);
      path = `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
    } else {
      // Vertical dominant: step vertically then horizontally
      if (dy >= 0) {
        // Dialogue below
        startY = y1 + h1;
        startX = Math.round(Math.min(Math.max(c2x, x1 + 40), x1 + w1 - 40));
        endY = y2;
        endX = Math.round(Math.min(Math.max(c1x, x2 + 30), x2 + w2 - 30));
        startAngle = 90;
        endAngle = -90;
        startVec = { x: 0, y: 1 };
        endVec = { x: 0, y: -1 };
      } else {
        // Dialogue above
        startY = y1;
        startX = Math.round(Math.min(Math.max(c2x, x1 + 40), x1 + w1 - 40));
        endY = y2 + h2;
        endX = Math.round(Math.min(Math.max(c1x, x2 + 30), x2 + w2 - 30));
        startAngle = -90;
        endAngle = 90;
        startVec = { x: 0, y: -1 };
        endVec = { x: 0, y: 1 };
      }
      midX = Math.round((startX + endX) / 2);
      midY = Math.round((startY + endY) / 2);
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
  const isPoolPage = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool');

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

  filterPickerResources('');
  openModal('modal-resource-picker');
}

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
    
    card.className = `bg-gray-950 border ${isBuilding ? 'border-amber-900/60 hover:border-amber-400 bg-amber-950/10' : 'border-gray-800 hover:border-cyan-400'} p-3 rounded-lg cursor-pointer flex flex-col items-center text-center transition shadow-sm hover:shadow-lg group relative`;
    
    const iconMarkup = item.iconImg ? `
      <div class="w-14 h-14 flex items-center justify-center mb-1.5 p-1 bg-slate-900/90 rounded-lg border border-slate-700/80 group-hover:border-amber-400 group-hover:scale-105 transition shadow-md">
        <img src="${item.iconImg}" alt="${item.name}" class="w-12 h-12 object-contain drop-shadow" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline';">
        <span style="display:none;" class="text-2xl">${item.icon || (isBuilding ? '🏛️' : '📦')}</span>
      </div>` : `
      <div class="w-14 h-14 flex items-center justify-center mb-1.5 bg-slate-900/50 rounded-lg border border-slate-800/80">
        <span class="text-2xl">${item.icon || (isBuilding ? '🏛️' : '📦')}</span>
      </div>`;
    
    card.innerHTML = `
      ${iconMarkup}
      <div class="font-bold text-gray-200 text-xs truncate w-full group-hover:text-amber-300 transition" title="${item.name}">${item.name}</div>
      <div class="text-[10px] text-gray-400 uppercase font-mono mt-0.5">${item.category || (isBuilding ? 'Building' : 'Item')}${item.tier !== undefined ? ` • T${item.tier}` : ''}</div>
    `;

    card.onclick = () => selectResourceFromPicker(item);
    grid.appendChild(card);
  });
}

function filterPickerResources(query) {
  let items = resourceCatalog.resources || [];
  
  if (activePickerCategory === 'specialization') {
    items = items.filter(i => i.category === 'Specialization' || i.kind === 'specialization');
  } else if (activePickerCategory === 'building') {
    items = items.filter(i => i.kind === 'building' || i.category === 'Building');
  } else if (activePickerCategory === 'item') {
    items = items.filter(i => i.kind !== 'building' && i.category !== 'Building' && i.category !== 'Stat' && i.category !== 'People' && i.category !== 'Tech' && i.category !== 'Specialization' && i.kind !== 'specialization');
  } else if (activePickerCategory === 'stat') {
    items = items.filter(i => i.category === 'Stat' || i.category === 'People' || i.category === 'Tech' || i.category === 'Key Item');
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

// Dialogue Characters Cast Meta Manager (Requirement 3: strictly scoped to active variation)
function renderCharactersManager() {
  const grid = document.getElementById('characters-list-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const allChars = appData.characters || getDefaultCharactersList();
  const currentVar = appData.variations.find(v => v.id === activeVariationId) || { name: 'Variation 1', number: 1 };

  // Update modal header subtitle
  const titleEl = document.querySelector('#modal-characters h3');
  if (titleEl) {
    titleEl.innerHTML = `<span class="text-purple-400">Characters Cast</span> — <span class="text-amber-300 font-normal">V${currentVar.number}: ${currentVar.name}</span>`;
  }

  // Filter ONLY characters selected/assigned for this active variation
  const assignedChars = allChars.filter(c => {
    if (!c.variationIds || c.variationIds.length === 0) return true; // Available across all by default
    return c.variationIds.includes(activeVariationId);
  });

  const unassignedChars = allChars.filter(c => {
    return c.variationIds && c.variationIds.length > 0 && !c.variationIds.includes(activeVariationId);
  });

  assignedChars.forEach((c) => {
    const originalIdx = allChars.findIndex(ch => ch.id === c.id);
    const card = document.createElement('div');
    card.className = 'bg-gray-950 border border-purple-900/60 p-3 rounded-lg flex items-center justify-between gap-3 shadow-md';
    
    card.innerHTML = `
      <div class="flex items-center gap-2.5 flex-1">
        <span class="text-2xl px-2.5 py-1.5 rounded-lg border border-white/20" style="background-color:${c.color}">${c.icon || '👤'}</span>
        <div class="flex-1 grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Name</label>
            <input type="text" class="char-input font-bold text-white text-xs bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 w-full focus:outline-none focus:border-purple-400" value="${c.name}" onchange="updateCharacterField(${originalIdx}, 'name', this.value)" placeholder="Character Name">
          </div>
          <div>
            <label class="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Role / Title</label>
            <input type="text" class="char-input text-purple-200 text-xs bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 w-full focus:outline-none focus:border-purple-400" value="${c.role || ''}" onchange="updateCharacterField(${originalIdx}, 'role', this.value)" placeholder="Officer / Role">
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <input type="color" class="w-8 h-8 rounded-lg cursor-pointer border border-gray-700 bg-gray-900 p-0.5" value="${c.color || '#e5e7eb'}" onchange="updateCharacterField(${originalIdx}, 'color', this.value)" title="Banner Color">
          <input type="text" class="char-input w-10 text-center text-base font-bold text-white bg-gray-900 border border-gray-700 rounded py-1 focus:outline-none focus:border-purple-400" value="${c.icon || '👤'}" onchange="updateCharacterField(${originalIdx}, 'icon', this.value)" title="Icon Emoji">
        </div>
      </div>
      <button type="button" onclick="removeCharacterFromActiveVariation('${c.id}')" class="text-xs text-red-400 hover:text-red-300 font-bold px-2.5 py-1 rounded bg-red-950/50 border border-red-800/80 hover:bg-red-900/60 transition" title="Remove character from this variation">
        ✕ Remove from V${currentVar.number}
      </button>
    `;
    grid.appendChild(card);
  });

  if (assignedChars.length === 0) {
    const emptyNotice = document.createElement('div');
    emptyNotice.className = 'p-6 text-center text-gray-400 italic bg-gray-950 rounded-xl border border-gray-800 col-span-full';
    emptyNotice.innerHTML = `No characters assigned to Variation ${currentVar.number} yet. Add from pool below or create a new character.`;
    grid.appendChild(emptyNotice);
  }

  // Quick Action Bar: Add existing character or create new character
  let addSection = document.getElementById('char-assign-section');
  if (!addSection) {
    addSection = document.createElement('div');
    addSection.id = 'char-assign-section';
    addSection.className = 'mt-4 pt-3 border-t border-gray-800 flex items-center justify-between gap-3';
    grid.parentElement.appendChild(addSection);
  }

  let unassignedOptions = unassignedChars.map(u => `<option value="${u.id}">${u.name} (${u.role || 'Crew'})</option>`).join('');

  addSection.innerHTML = `
    <div class="flex items-center gap-2">
      ${unassignedChars.length > 0 ? `
        <select id="select-unassigned-char" class="bg-gray-900 text-purple-300 border border-purple-700 text-xs rounded px-2.5 py-1 font-semibold">
          ${unassignedOptions}
        </select>
        <button type="button" onclick="assignSelectedCharacterToActiveVariation()" class="bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs px-3 py-1 rounded shadow">
          + Add to V${currentVar.number}
        </button>
      ` : '<span class="text-xs text-gray-500 font-semibold italic">All roster characters active in this variation</span>'}
    </div>
    <button type="button" onclick="addNewCharacterForActiveVariation()" class="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow flex items-center gap-1.5">
      + Create Character for V${currentVar.number}
    </button>
  `;

  openModal('modal-characters');
}

function removeCharacterFromActiveVariation(charId) {
  pushUndoState();
  const c = appData.characters.find(ch => ch.id === charId);
  if (!c) return;
  if (!c.variationIds || c.variationIds.length === 0) {
    // previously in all variations, now exclude active variation
    c.variationIds = appData.variations.map(v => v.id).filter(id => id !== activeVariationId);
  } else {
    c.variationIds = c.variationIds.filter(id => id !== activeVariationId);
  }
  saveProjectToLocalStorage();
  renderCharactersManager();
  renderApp();
  showToast("Character removed from variation", "info");
}

function assignSelectedCharacterToActiveVariation() {
  const sel = document.getElementById('select-unassigned-char');
  if (!sel || !sel.value) return;
  pushUndoState();
  const c = appData.characters.find(ch => ch.id === sel.value);
  if (c) {
    if (!c.variationIds) c.variationIds = [];
    if (!c.variationIds.includes(activeVariationId)) c.variationIds.push(activeVariationId);
    saveProjectToLocalStorage();
    renderCharactersManager();
    renderApp();
    showToast("Character added to variation", "success");
  }
}

function addNewCharacterForActiveVariation() {
  pushUndoState();
  const name = prompt("Enter Character Name:", "New Officer");
  if (!name) return;
  const role = prompt("Enter Role / Title:", "Tactical Specialist") || "Officer";

  const newChar = {
    id: `char_${Date.now()}`,
    name: name,
    role: role,
    color: "#f3e8ff",
    textColor: "#6b21a8",
    icon: "👤",
    variationIds: [activeVariationId]
  };
  if (!appData.characters) appData.characters = [];
  appData.characters.push(newChar);
  saveProjectToLocalStorage();
  renderCharactersManager();
  renderApp();
  showToast("New character created for variation", "success");
}

function updateCharacterField(idx, field, value) {
  if (appData.characters && appData.characters[idx]) {
    pushUndoState();
    appData.characters[idx][field] = value;
    saveProjectToLocalStorage();
    renderApp();
  }
}

function addNewCharacter() {
  addNewCharacterForActiveVariation();
}

function deleteCharacter(idx) {
  if (appData.characters && appData.characters.length > 1) {
    pushUndoState();
    appData.characters.splice(idx, 1);
    saveProjectToLocalStorage();
    renderCharactersManager();
    renderApp();
    showToast("Character deleted", "info");
  }
}

// REQUIREMENT 2 FIX: Instant Working Inline Text Editing (Click or Double Click)
function makeInlineDialogueTextEditable(element, dialogueId, lineIdx) {
  if (!requireAuthToEdit("edit dialogue lines")) return;
  if (element.querySelector('textarea')) return;
  const currentText = element.innerText;
  const input = document.createElement('textarea');
  input.className = 'inline-input font-normal text-xs';
  input.value = currentText;
  input.rows = 3;
  element.innerHTML = '';
  element.appendChild(input);
  input.focus();
  input.select();

  const stopProp = (e) => e.stopPropagation();
  input.addEventListener('mousedown', stopProp);
  input.addEventListener('click', stopProp);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      input.blur();
    }
  });
  input.addEventListener('keyup', stopProp);

  let saved = false;
  const saveLine = () => {
    if (saved) return;
    saved = true;
    const diag = appData.dialogues.find(d => d.id === dialogueId);
    if (diag && diag.lines[lineIdx] && diag.lines[lineIdx].text !== input.value) {
      pushUndoState();
      diag.lines[lineIdx].text = input.value;
      saveProjectToLocalStorage();
      renderApp();
    }
  };

  input.onblur = saveLine;
}

function updateDialogueSpeaker(dialogueId, lineIdx, speakerId) {
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
  pushUndoState();
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (diag && diag.lines) {
    diag.lines.splice(lineIdx, 1);
    saveProjectToLocalStorage();
    renderApp();
  }
}

function moveDialogueLine(dialogueId, lineIdx, direction) {
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
  pushUndoState();
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (!diag || !diag.lines) return;

  const currentLine = diag.lines[lineIdx];
  const currentSpeakerId = currentLine ? currentLine.speakerId : 'voss';
  const allChars = appData.characters || getDefaultCharactersList();
  const currentChar = allChars.find(c => c.id === currentSpeakerId) || { id: currentSpeakerId, name: (currentLine ? currentLine.speakerName : 'Voss') };

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
  pushUndoState();
  const diag = appData.dialogues.find(d => d.id === dialogueId);
  if (diag) {
    const allChars = appData.characters || getDefaultCharactersList();
    const lastLine = diag.lines && diag.lines.length > 0 ? diag.lines[diag.lines.length - 1] : null;
    const lastSpeaker = lastLine ? lastLine.speakerId : null;
    const altChar = allChars.find(c => c.id !== lastSpeaker) || allChars[0];

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

function makeInlineTextEditable(element, nodeId, fieldPath) {
  if (!requireAuthToEdit("edit text content")) return;
  if (element.querySelector('textarea')) return;
  const currentText = element.innerText;
  const input = document.createElement('textarea');
  input.className = 'inline-input';
  input.value = currentText;
  input.rows = 2;
  element.innerHTML = '';
  element.appendChild(input);
  input.focus();
  input.select();

  const stopProp = (e) => e.stopPropagation();
  input.addEventListener('mousedown', stopProp);
  input.addEventListener('click', stopProp);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      input.blur();
    }
  });
  input.addEventListener('keyup', stopProp);

  let saved = false;
  const saveInline = () => {
    if (saved) return;
    saved = true;
    const newVal = input.value;
    pushUndoState();
    updateNodeFieldByPath(nodeId, fieldPath, newVal);
    saveProjectToLocalStorage();
    renderApp();
  };

  input.onblur = saveInline;
}

function makeInlineNumberEditable(element, nodeId, fieldPath) {
  if (!requireAuthToEdit("edit numerical values")) return;
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
  const saveInline = () => {
    if (saved) return;
    saved = true;
    const newVal = parseInt(input.value) || 0;
    pushUndoState();
    updateNodeFieldByPath(nodeId, fieldPath, newVal);
    saveProjectToLocalStorage();
    renderApp();
  };

  input.onblur = saveInline;
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
  if (!requireAuthToEdit("edit reaction timer")) return;
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

function makeInlineCodenameEditable(element, nodeId) {
  if (!requireAuthToEdit("edit event codename")) return;
  if (element.querySelector('input')) return;
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const currentCode = node.codename;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-input font-mono font-bold w-36 text-center text-amber-900 bg-amber-100 border-2 border-amber-500';
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
    const formattedCode = enforceCodenamePattern(rawVal, node);
    if (formattedCode !== node.codename) {
      pushUndoState();
      const oldCode = node.codename;
      node.codename = formattedCode;

      cascadeCodenameChanges(nodeId, oldCode, formattedCode);

      saveProjectToLocalStorage();
      renderApp();
    }
  };

  input.onblur = saveCodename;
}

function enforceCodenamePattern(str, node) {
  const pattern = /^T(\d+)-V(\d+)-E(\d+)-([A-Z0-9]+)$/i;
  if (pattern.test(str)) {
    return str.toUpperCase();
  }
  const floor = node.floorIndex || 0;
  return `T1-V1-E${floor}-A0`;
}

function cascadeCodenameChanges(nodeId, oldCode, newCode) {
  appData.nodes.forEach(n => {
    if (n.spawnConditions && n.spawnConditions.includes(oldCode)) {
      n.spawnConditions = n.spawnConditions.replace(oldCode, newCode);
    }
  });

  appData.dialogues.forEach(d => {
    if (d.triggerCondition && d.triggerCondition.includes(oldCode)) {
      d.triggerCondition = d.triggerCondition.replace(oldCode, newCode);
    }
  });
}

function updateNodeFieldByPath(nodeId, fieldPath, value) {
  const node = appData.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const parts = fieldPath.split('.');
  let curr = node;
  for (let i = 0; i < parts.length - 1; i++) {
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
  const node = appData.nodes.find(n => n.id === nodeId);
  if (node) {
    node[field] = value;
    saveProjectToLocalStorage();
    renderApp();
  }
}

function linkOrEditChoice(nodeId, actionId) {
  const targetName = prompt("Enter Target Event Codename to link (or leave empty to create new branch node):");
  if (targetName === null) return;

  const node = appData.nodes.find(n => n.id === nodeId);
  const act = (node.actions || []).find(a => a.id === actionId);

  if (targetName.trim() === '') {
    spawnChildBranchNode(nodeId, actionId);
  } else {
    const existing = appData.nodes.find(n => n.codename.toLowerCase() === targetName.trim().toLowerCase());
    if (existing) {
      act.targetNodeId = existing.id;
      saveProjectToLocalStorage();
      renderApp();
    } else {
      alert(`Node with codename ${targetName} not found.`);
    }
  }
}

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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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

  const el = document.getElementById(isDialogue ? `dialogue-${blockId}` : `node-${blockId}`);
  const blockW = isDialogue ? 490 : 880;
  const blockH = (el && el.offsetHeight > 50) ? el.offsetHeight : (isDialogue ? 240 : 540);

  const containerW = (canvasContainer && canvasContainer.clientWidth) ? canvasContainer.clientWidth : (window.innerWidth || 1200);
  const containerH = (canvasContainer && canvasContainer.clientHeight) ? canvasContainer.clientHeight : (window.innerHeight || 800);

  // Generous margins on both sides for floating controls and aesthetic breathing room
  const marginH = 130;
  const marginV = 60;

  const availableW = Math.max(containerW - (marginH * 2), 320);
  const availableH = Math.max(containerH - (marginV * 2), 240);

  const scaleX = availableW / blockW;
  const scaleY = availableH / blockH;
  let targetScale = Math.min(scaleX, scaleY);

  // Clamped to comfortable maximum zoom
  targetScale = Math.min(Math.max(targetScale, 0.35), 2.0);

  maxZoomedBlockId = blockId;
  window.maxZoomedBlockId = blockId;
  maxZoomScale = targetScale;
  transform.scale = targetScale;
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
  const isPoolPage = (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool');
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
  saveProjectToLocalStorage();
  renderApp();
}

// Drag & Snap Node to Nearest Floor Row (DO NOT HIJACK EDITABLE SPOTS)
function makeNodesDraggable() {
  const nodes = document.querySelectorAll('.event-card, .deck-event-card, .generic-event-card, .dialogue-card');
  nodes.forEach(el => {
    let isDraggingNode = false;
    let nodeStartPos = { x: 0, y: 0 };
    let mouseStartPos = { x: 0, y: 0 };

    el.addEventListener('mousedown', (e) => {
      if (!canUserEdit()) {
        requireAuthToEdit("move blocks on the board");
        return;
      }

      // REQUIREMENT 2 FIX: Do not drag card if clicking inside an editable spot or button
      if (e.target.closest('.editable-spot') || 
          e.target.closest('button') || 
          e.target.closest('input') || 
          e.target.closest('textarea') || 
          e.target.closest('select') || 
          e.target.closest('.rx-timer-select') ||
          e.target.closest('.inline-select') ||
          e.target.closest('.connector-port') ||
          e.target.closest('.dialogue-trigger-port') ||
          e.target.closest('.pool-event-switch-bar') ||
          e.target.closest('.req-pill')) {
        return;
      }

      if (document.activeElement && typeof document.activeElement.blur === 'function' && !e.target.closest('input, textarea, select')) {
        document.activeElement.blur();
      }

      isDraggingNode = true;
      e.stopPropagation();

      const isEvent = el.classList.contains('event-card') || el.classList.contains('deck-event-card') || el.classList.contains('generic-event-card');
      const nodeId = el.id.replace(isEvent ? 'node-' : 'dialogue-', '');

      const obj = isEvent ? appData.nodes.find(n => n.id === nodeId) : appData.dialogues.find(d => d.id === nodeId);
      if (!obj) return;

      const preDragSnapshot = JSON.stringify(appData);
      nodeStartPos = { ...obj.position };
      mouseStartPos = { x: e.clientX, y: e.clientY };

      const onMouseMove = (ev) => {
        if (!isDraggingNode) return;
        const dx = (ev.clientX - mouseStartPos.x) / transform.scale;
        const dy = (ev.clientY - mouseStartPos.y) / transform.scale;

        obj.position.x = Math.round(nodeStartPos.x + dx);
        obj.position.y = Math.round(nodeStartPos.y + dy);

        el.style.left = `${obj.position.x}px`;
        el.style.top = `${obj.position.y}px`;

        renderConnectors();
      };

      const onMouseUp = () => {
        if (!isDraggingNode) return;
        isDraggingNode = false;

        const hasMoved = (obj.position.x !== nodeStartPos.x || obj.position.y !== nodeStartPos.y);
        if (hasMoved) {
          undoStack.push(preDragSnapshot);
          if (undoStack.length > MAX_UNDO_DEPTH) undoStack.shift();
          redoStack.length = 0;
        }

        if (activeCategoryFilter === 'GenericPool' || activeCategoryFilter === 'DeckPool') {
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
            // Floor index can be 0 or calculated based on vertical position
            obj.floorIndex = Math.max(0, Math.floor((obj.position.y - 100) / 700));
          }
        } else {
          // KeyChain: Snap vertically to FLOOR_Y, freely placed horizontally (supports moving left to negative X)
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
            // Dialogues: allow placing anywhere on canvas (including outside / above Stage grid)
            obj.floorIndex = closestFloorIdx;
          }
        }

        el.style.left = `${obj.position.x}px`;
        el.style.top = `${obj.position.y}px`;

        preventNodeOverlap(nodeId);

        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        saveProjectToLocalStorage();
        renderApp();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  });
}

function renderTimelinesManager() {
  const container = document.getElementById('timelines-list-container');
  if (!container) return;
  container.innerHTML = '';

  const timelines = appData.timelines || [];
  const variations = appData.variations || [];

  timelines.forEach(tl => {
    const tlSection = document.createElement('div');
    tlSection.className = 'bg-cyan-950/30 border border-cyan-800/60 p-4 rounded-xl space-y-3';
    
    const tlVars = variations.filter(v => v.timelineId === tl.id);

    let varListHTML = tlVars.map(v => `
      <div class="bg-gray-950 border border-gray-800 p-3 rounded-lg flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="font-mono font-bold text-cyan-300 bg-cyan-950 px-2 py-1 rounded border border-cyan-800">V${v.number}</span>
          <div>
            <h5 class="font-bold text-white text-xs">${v.name}</h5>
            <p class="text-gray-400 text-[11px]">${v.description}</p>
          </div>
        </div>
        <button type="button" onclick="selectVariationFromManager('${v.id}')" class="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded text-xs">
          Open Variation
        </button>
      </div>
    `).join('');

    tlSection.innerHTML = `
      <div class="flex justify-between items-center border-b border-cyan-900/60 pb-2">
        <div>
          <h4 class="text-sm font-bold text-cyan-300 flex items-center gap-2">
            <span class="font-mono bg-cyan-900/80 px-2 py-0.5 rounded text-xs">T${tl.number}</span>
            ${tl.name}
          </h4>
          <p class="text-gray-400 text-xs mt-0.5">${tl.description}</p>
        </div>
        <button type="button" onclick="addNewVariation('${tl.id}')" class="bg-cyan-700 hover:bg-cyan-600 text-white font-bold px-3 py-1 rounded text-xs flex items-center gap-1 shadow">
          + Add Variation to T${tl.number}
        </button>
      </div>

      <div class="space-y-2">
        ${varListHTML || '<div class="text-gray-500 italic p-2">No variations in this timeline yet.</div>'}
      </div>
    `;

    container.appendChild(tlSection);
  });

  openModal('modal-timelines');
}

function addNewTimeline() {
  const num = (appData.timelines || []).length + 1;
  const name = prompt("Enter New Timeline Name:", `Timeline ${num}: Multiverse Branch`);
  if (!name) return;

  const newTl = {
    id: `timeline_${num}`,
    number: num,
    name: name,
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
      name: `${name} - Variation ${v}`,
      description: `Variation ${v} for ${name}`
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
  const tlId = targetTimelineId || activeTimelineId;
  const tl = (appData.timelines || []).find(t => t.id === tlId);
  const existingInTl = (appData.variations || []).filter(v => v.timelineId === tlId);
  const nextNum = existingInTl.length + 1;
  const tlName = tl ? tl.name : `Timeline`;
  const name = prompt("Enter Variation Name:", `Variation ${nextNum}`);
  if (!name) return;

  const newVar = {
    id: `var_${tlId}_v${nextNum}_${Date.now()}`,
    timelineId: tlId,
    number: nextNum,
    name: name,
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

function updateStats() {
  const evStat = document.getElementById('stat-event-count');
  if (evStat) evStat.innerText = `Events: ${appData.nodes.length}`;
  const diagStat = document.getElementById('stat-dialogue-count');
  if (diagStat) diagStat.innerText = `Dialogues: ${appData.dialogues.length}`;
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

  const characters = (appData.characters && appData.characters.length > 0) 
    ? appData.characters 
    : getDefaultCharactersList();

  // 1. Exact match by ID or full name
  let found = characters.find(c => c.id.toLowerCase() === q || c.name.toLowerCase() === q);
  if (found) return found;

  // 2. Starts-with or includes match (e.g. "Khalil" -> "Khalil Arida", "Voss" -> "Voss")
  found = characters.find(c => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()) || c.id.toLowerCase().includes(q));
  if (found) return found;

  // 3. Match individual words (e.g. "Arida", "Demchuck", "Abbadie")
  const qWords = q.split(/\s+/).filter(w => w.length > 2);
  for (const w of qWords) {
    found = characters.find(c => c.name.toLowerCase().includes(w) || c.id.toLowerCase().includes(w));
    if (found) return found;
  }

  // 4. Character not registered yet - create a new character definition
  const fallbackId = q.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20) || 'speaker';
  const cleanName = speakerQuery.replace(/[:—\-\*\#_]/g, '').trim();
  const titleName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  const newChar = {
    id: fallbackId,
    name: titleName,
    role: "Cast Member",
    color: "#f3f4f6",
    textColor: "#1f2937",
    icon: "👤",
    variationIds: [activeVariationId]
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
  const floor = 1;
  const currentVar = appData.variations.find(v => v.id === activeVariationId) || { number: 1 };

  const posX = isTier ? TIER_X[0] : 300;
  const posY = isTier ? 120 : FLOOR_Y[floor];

  const isSecret = (activeCategoryFilter === 'SecretChain');
  const codePrefix = isSecret ? `SEC${appData.nodes.filter(n => n.category === 'SecretChain').length + 1}` : `E${appData.nodes.length}`;

  const newNode = {
    id: `node_${Date.now()}`,
    codename: `T1-V${currentVar.number}-${codePrefix}-A0`,
    name: 'New Event Block',
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
    position: { x: posX, y: posY },
    actions: [
      { 
        id: `c_${Date.now()}`, 
        codeSuffix: "A1", 
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
  saveProjectToLocalStorage();
  renderApp();
  showToast("New Event Block created", "success");
}

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

/* ==========================================================================
   MOBILE STAGE-CENTRIC ENGINE, DESKTOP SLOT ALLOCATOR & DIAGNOSTIC TOOLS
   ========================================================================== */

function switchAppViewMode(mode, silent = false) {
  currentAppViewMode = mode;
  const canvasContainer = document.getElementById('canvas-container');
  const mobileStageView = document.getElementById('mobile-stage-view');
  const btnCanvas = document.getElementById('btn-mode-canvas');
  const btnMobile = document.getElementById('btn-mode-mobile');

  if (mode === 'mobile-stage') {
    if (canvasContainer) canvasContainer.classList.add('hidden');
    if (mobileStageView) mobileStageView.classList.remove('hidden');
    if (btnCanvas) {
      btnCanvas.className = "px-2.5 py-1 rounded text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 flex items-center gap-1 transition";
    }
    if (btnMobile) {
      btnMobile.className = "px-2.5 py-1 rounded text-xs font-bold bg-cyan-600 text-white shadow flex items-center gap-1 transition";
    }
    renderApp();
    if (!silent) showToast("Switched to Mobile Stage-Centric View", "info");
  } else {
    if (mobileStageView) mobileStageView.classList.add('hidden');
    if (canvasContainer) canvasContainer.classList.remove('hidden');
    if (btnCanvas) {
      btnCanvas.className = "px-2.5 py-1 rounded text-xs font-bold bg-amber-500 text-gray-950 shadow flex items-center gap-1 transition";
    }
    if (btnMobile) {
      btnMobile.className = "px-2.5 py-1 rounded text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 flex items-center gap-1 transition";
    }
    renderApp();
    setTimeout(() => updateCanvasTransform(), 60);
    if (!silent) showToast("Switched to Desktop 2D Canvas View", "info");
  }
}

// Virtual Desktop Slot Allocator for Events
function allocateDesktopSlotForEvent(floorIndex, category) {
  const cat = category || activeCategoryFilter || 'KeyChain';
  const targetY = (FLOOR_Y && FLOOR_Y[floorIndex] !== undefined) ? FLOOR_Y[floorIndex] : (90 + floorIndex * 990);
  
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

  const currentStageMeta = stageLabels[activeMobileStageIndex] || stageLabels[0];
  const currentVar = (appData.variations || []).find(v => v.id === activeVariationId) || { number: 1, name: 'Variation 1' };

  // Filter events belonging to this stage
  const stageNodes = (appData.nodes || []).filter(n => {
    const cat = n.category || 'KeyChain';
    if (cat !== activeCategoryFilter) return false;
    if (!isPool && n.variationId && n.variationId !== activeVariationId) return false;
    const floor = (n.floorIndex !== undefined && n.floorIndex !== null) ? n.floorIndex : (isPool && n.tier ? n.tier - 1 : 0);
    return floor === activeMobileStageIndex;
  });

  // Stage Tabs HTML
  const tabsHTML = stageLabels.map((st, idx) => {
    const isActive = idx === activeMobileStageIndex;
    return `
      <button type="button" 
              onclick="setMobileStage(${idx})"
              class="mobile-stage-tab-btn ${isActive ? 'is-active' : ''}">
        <span>${st.label}</span>
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

      // Pre-event Dialogues attached to this event
      const preEventDiags = (appData.dialogues || []).filter(d => d.targetEventId === node.id && d.triggerTiming === 'pre_event');
      let preDiagsHTML = preEventDiags.map(d => renderMobileDialogueCardHTML(d)).join('');

      // Actions & nested dialogues
      let actionsHTML = (node.actions || []).map((act, actIdx) => {
        const optionDiags = (appData.dialogues || []).filter(d => d.targetEventId === node.id && d.triggerTiming === 'action_option' && d.triggerActionId === act.id);
        const optDiagsHTML = optionDiags.map(d => renderMobileDialogueCardHTML(d, true)).join('');

        // Req pills
        let reqHTML = (act.requirements || []).map((c, cIdx) => {
          return (c.items || []).map((item, iIdx) => `
            <span class="req-pill text-[10px]" onclick="event.stopPropagation(); openEditRequirementItem('${node.id}', ${actIdx}, ${cIdx}, ${iIdx})">
              ${item.iconImg ? `<img src="${item.iconImg}" class="w-3.5 h-3.5 inline">` : (item.icon || '📦')}
              <span>${item.name}</span>
              <span class="font-mono font-bold">x${item.amount || 1}</span>
            </span>
          `).join('');
        }).join('');

        // Reward pills
        let rwHTML = (act.rewards || []).map((rw, rwIdx) => formatRewardPillHTML(rw, node.id, actIdx, rwIdx, false)).join('');

        return `
          <div class="mobile-action-box space-y-2">
            <div class="flex items-center justify-between border-b border-gray-700/60 pb-1.5">
              <span class="font-bold text-xs text-amber-300 font-mono">${act.codeSuffix}: ${act.shortDescription || 'Choice Option'}</span>
              <span class="text-[10px] text-gray-400 font-mono">⏱️ ${act.timerHours || 1}h</span>
            </div>
            <p class="text-xs text-gray-300 leading-relaxed editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'actions.${actIdx}.description')">
              ${act.description || 'Action description...'}
            </p>
            
            <div class="flex flex-wrap items-center gap-1.5 pt-1">
              <span class="text-[10px] font-bold text-gray-400 uppercase">Requirements:</span>
              ${reqHTML || '<span class="text-[10px] text-gray-500 italic">None</span>'}
              <button type="button" class="req-add-btn text-[10px]" onclick="event.stopPropagation(); openResourcePickerModal('${node.id}', ${actIdx}, 'requirement', null)">+ Req</button>
            </div>

            <div class="flex flex-wrap items-center gap-1.5 pt-1">
              <span class="text-[10px] font-bold text-amber-400 uppercase">Rewards:</span>
              ${rwHTML || '<span class="text-[10px] text-gray-500 italic">None</span>'}
              <button type="button" class="req-add-btn text-[10px]" onclick="event.stopPropagation(); openResourcePickerModal('${node.id}', ${actIdx}, 'reward', null)">+ Reward</button>
            </div>

            <!-- Route Suggestion Dialogues -->
            <div class="pt-2 border-t border-gray-800/80">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                  💬 Route Advice Dialogues
                </span>
                <button type="button" onclick="createMobileAttachedDialogue('${node.id}', 'action_option', '${act.id}')" class="text-[10px] text-indigo-400 hover:text-indigo-200 font-semibold">
                  + Attach Dialogue
                </button>
              </div>
              ${optDiagsHTML || '<p class="text-[11px] text-gray-500 italic">No dialogue attached to this choice option.</p>'}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="mobile-event-card ${isDimmed ? 'is-pool-dimmed' : ''}" id="mob-node-${node.id}">
          ${poolSwitchBar}
          <div class="p-4 space-y-4 mobile-card-body">
            <!-- Event Header -->
            <div class="flex items-start justify-between gap-2 border-b border-gray-800 pb-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="mobile-stage-badge bg-amber-950 text-amber-300 border border-amber-600/40">${node.codename}</span>
                  <span class="text-[10px] text-gray-400 uppercase font-semibold">${node.location || 'Location'}</span>
                </div>
                <h3 class="text-sm font-bold text-gray-100 mt-1 editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'name')">
                  ${node.name}
                </h3>
              </div>
              <div class="flex items-center gap-1.5">
                <button type="button" class="comment-trigger-badge" title="Comments" onclick="event.stopPropagation(); openCommentsDrawer('${node.id}', 'event', '${escapeHtml(node.name || node.codename)}')">
                  💬 <span class="cmt-cnt-${node.id}">${getCommentCount(node.id)}</span>
                </button>
                <button type="button" onclick="deleteMobileEvent('${node.id}')" class="text-xs text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/40" title="Delete Event">
                  ✕
                </button>
              </div>
            </div>

            <!-- Pre-Event Dialogue Stream -->
            <div class="space-y-1.5 bg-gray-950/40 p-2.5 rounded-xl border border-gray-800/60">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                  💬 Pre-Event Dialogues (Spawn Window)
                </span>
                <button type="button" onclick="createMobileAttachedDialogue('${node.id}', 'pre_event', null)" class="text-[10px] text-purple-400 hover:text-purple-200 font-semibold">
                  + Attach Dialogue
                </button>
              </div>
              ${preDiagsHTML || '<p class="text-[11px] text-gray-500 italic">No pre-event dialogue attached.</p>'}
            </div>

            <!-- Intro & Body -->
            <div class="space-y-2">
              <div class="text-xs text-amber-200/90 italic bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/30 editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'eventIntro')">
                <span class="font-bold text-amber-400 not-italic mr-1">Intro:</span>${node.eventIntro || 'Enter event intro...'}
              </div>
              <p class="text-xs text-gray-300 leading-relaxed editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${node.id}', 'eventDescription')">
                ${node.eventDescription || 'Enter event description context...'}
              </p>
            </div>

            <!-- Action Choices -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-gray-300 uppercase tracking-wider">Action Options</span>
                <button type="button" onclick="addActionColumn('${node.id}')" class="text-xs text-cyan-400 hover:text-cyan-300 font-bold">
                  + Add Choice
                </button>
              </div>
              ${actionsHTML}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Unlinked Dialogues for this stage
  const unlinkedDiags = (appData.dialogues || []).filter(d => (!d.targetEventId) && ((d.floorIndex || 0) === activeMobileStageIndex) && ((d.category || 'KeyChain') === activeCategoryFilter));
  let unlinkedHTML = '';
  if (unlinkedDiags.length > 0) {
    unlinkedHTML = `
      <div class="mt-8 pt-6 border-t border-gray-800 space-y-3">
        <h4 class="text-xs font-bold text-purple-400 uppercase tracking-wider">Unlinked Dialogues in this Stage (${unlinkedDiags.length})</h4>
        ${unlinkedDiags.map(d => renderMobileDialogueCardHTML(d)).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <!-- Sticky Mobile Stage Nav -->
    <div class="mobile-stage-nav-bar px-4 py-2.5 flex items-center justify-between gap-2 overflow-x-auto">
      <div class="flex items-center gap-1.5 overflow-x-auto py-1">
        ${tabsHTML}
      </div>
      <button type="button" onclick="createMobileEvent(${activeMobileStageIndex})" class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-950 shadow flex items-center gap-1 transition">
        <i data-lucide="plus" class="w-3.5 h-3.5"></i> Event
      </button>
    </div>

    <!-- Main Content Container -->
    <div class="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-gray-100 flex items-center gap-2">
            <span>${currentStageMeta.title}</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">${stageNodes.length} Events</span>
          </h2>
          <p class="text-[11px] text-gray-400 mt-0.5">Mobile stage-centric narrative flow • Automatic zero-collision desktop placement</p>
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

function renderMobileDialogueCardHTML(dialogue, isRoute = false) {
  const allChars = appData.characters || getDefaultCharactersList();
  const linesHTML = (dialogue.lines || []).map((l, lIdx) => {
    const charMeta = allChars.find(c => c.name === l.speakerName) || { color: '#e5e7eb', textColor: '#1f2937', icon: '👤' };
    return `
      <div class="bg-gray-900/80 p-2 rounded-lg border border-gray-800 space-y-1">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-bold flex items-center gap-1" style="color: ${charMeta.color || '#38bdf8'}">
            <span>${charMeta.icon}</span> ${l.speakerName || 'Speaker'}
          </span>
          <button type="button" onclick="removeMobileDialogueLine('${dialogue.id}', ${lIdx})" class="text-gray-500 hover:text-red-400 text-xs">×</button>
        </div>
        <p class="text-xs text-gray-200 leading-relaxed editable-spot" onclick="event.stopPropagation(); makeInlineTextEditable(this, '${dialogue.id}', 'lines.${lIdx}.text')">
          ${l.text || 'Dialogue text...'}
        </p>
      </div>
    `;
  }).join('');

  return `
    <div class="mobile-nested-dialogue ${isRoute ? 'is-route-suggestion' : ''} space-y-2" id="mob-diag-${dialogue.id}">
      <div class="flex items-center justify-between border-b border-purple-800/40 pb-1">
        <span class="text-[10px] font-bold text-purple-300 font-mono flex items-center gap-1">
          <span>💬</span> ${dialogue.triggerCondition || 'Dialogue Block'}
        </span>
        <div class="flex items-center gap-2">
          <button type="button" class="comment-trigger-badge" title="Comments" onclick="event.stopPropagation(); openCommentsDrawer('${dialogue.id}', 'dialogue', '${escapeHtml(dialogue.triggerCondition || dialogue.id)}')">
            💬 <span class="cmt-cnt-${dialogue.id}">${getCommentCount(dialogue.id)}</span>
          </button>
          <button type="button" onclick="addMobileDialogueLine('${dialogue.id}')" class="text-[10px] text-cyan-400 hover:text-cyan-200 font-semibold">+ Line</button>
          <button type="button" onclick="unlinkMobileDialogue('${dialogue.id}')" class="text-[10px] text-red-400 hover:text-red-300" title="Unlink dialogue">Unlink</button>
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

  const existingCount = (appData.nodes || []).filter(n => (n.category || 'KeyChain') === activeCategoryFilter).length;
  const prefix = activeCategoryFilter === 'GenericPool' ? 'GEN' : (activeCategoryFilter === 'DeckPool' ? 'DECK' : (activeCategoryFilter === 'SecretChain' ? 'SEC' : 'KEY'));
  const codename = `${prefix}-S${floor + 1}-E${existingCount + 1}`;

  const newNode = {
    id: `node_mob_${Date.now()}`,
    codename: codename,
    name: `New Event (${isTier ? 'Tier ' + (floor + 1) : 'Stage ' + (floor + 1)})`,
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
        codeSuffix: "A1",
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
  appData.nodes = (appData.nodes || []).filter(n => n.id !== eventId);
  (appData.dialogues || []).forEach(d => {
    if (d.targetEventId === eventId) d.targetEventId = null;
  });
  saveProjectToLocalStorage();
  renderApp();
  showToast("Event block deleted", "info");
}

function unlinkMobileDialogue(diagId) {
  if (!requireAuthToEdit("unlink dialogues")) return;
  pushUndoState();
  const diag = (appData.dialogues || []).find(d => d.id === diagId);
  if (diag) {
    diag.targetEventId = null;
    diag.triggerTiming = null;
    diag.triggerActionId = null;
  }
  saveProjectToLocalStorage();
  renderApp();
  showToast("Dialogue unlinked from event", "info");
}

// Layout Health Check Diagnostic Engine
function runDesktopLayoutHealthCheck() {
  const cat = activeCategoryFilter;
  const nodes = (appData.nodes || []).filter(n => (n.category || 'KeyChain') === cat);
  const dialogues = (appData.dialogues || []).filter(d => {
    if (d.targetEventId) {
      const tgt = (appData.nodes || []).find(n => n.id === d.targetEventId);
      return tgt && (tgt.category || 'KeyChain') === cat;
    }
    return (d.category || 'KeyChain') === cat;
  });

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

/* ==========================================================================
   AUTHENTICATION & DOMAIN ACCESS CONTROL (@n-ix.com)
   ========================================================================== */
let currentUser = null;
let authToken = localStorage.getItem('rogue_carrier_auth_token') || '';
let allNixUsers = [];

function isLocalEnvironment() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '';
}

async function initAuthSystem() {
  if (isLocalEnvironment()) {
    currentUser = {
      email: 'dpoludonnyi@n-ix.com',
      name: 'Daniel (Local PC)',
      role: 'admin',
      status: 'approved',
      canEdit: true,
      isAdmin: true
    };
    updateAuthHeaderUI();
    preloadTeamUsers();
    return;
  }

  if (authToken) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.user) {
          currentUser = data.user;
        } else {
          authToken = '';
          localStorage.removeItem('rogue_carrier_auth_token');
        }
      }
    } catch (e) {
      console.warn("Could not verify auth token:", e);
    }
  }
  updateAuthHeaderUI();
  preloadTeamUsers();
}

function canUserEdit() {
  if (isLocalEnvironment()) return true;
  return Boolean(currentUser && currentUser.status === 'approved' && currentUser.canEdit !== false);
}

function requireAuthToEdit(actionDesc = "edit this element") {
  if (isLocalEnvironment()) return true;
  if (canUserEdit()) return true;
  showToast(`🔒 Read-Only: Please sign in with your @n-ix.com email to ${actionDesc}.`, "warning");
  openAuthModal();
  return false;
}

function updateAuthHeaderUI() {
  const btnLogin = document.getElementById('btn-header-login');
  const userBadge = document.getElementById('auth-user-badge');
  const badgeRole = document.getElementById('auth-badge-role');
  const badgeName = document.getElementById('auth-badge-name');
  const btnTeam = document.getElementById('btn-admin-team');
  const readonlyBanner = document.getElementById('readonly-mode-banner');
  const regTab = document.getElementById('auth-tab-register');

  // Disable registration on public web page
  if (regTab) regTab.classList.add('hidden');

  if (isLocalEnvironment() || canUserEdit()) {
    if (readonlyBanner) readonlyBanner.classList.add('hidden');
    if (btnLogin) btnLogin.classList.add('hidden');
    if (userBadge) userBadge.classList.remove('hidden');
    if (badgeName) {
      badgeName.innerText = isLocalEnvironment() ? 'Local (No Auth)' : (currentUser.name || currentUser.email);
      badgeName.title = isLocalEnvironment() ? 'Running on local machine without authorization' : `${currentUser.name} (${currentUser.email})`;
    }
    if (badgeRole) {
      if (isLocalEnvironment() || (currentUser && currentUser.role === 'admin')) {
        badgeRole.innerText = isLocalEnvironment() ? 'Unlocked' : 'Admin';
        badgeRole.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
      } else {
        badgeRole.innerText = 'Editor';
        badgeRole.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40';
      }
    }
    if (btnTeam) {
      if (isLocalEnvironment() || (currentUser && currentUser.role === 'admin')) btnTeam.classList.remove('hidden');
      else btnTeam.classList.add('hidden');
    }
  } else {
    if (readonlyBanner) readonlyBanner.classList.remove('hidden');
    if (btnLogin) btnLogin.classList.remove('hidden');
    if (userBadge) userBadge.classList.add('hidden');
    if (btnTeam) btnTeam.classList.add('hidden');
  }
}

let isRegistrationDisabled = true;

function switchAuthTab(tab) {
  const formLogin = document.getElementById('form-auth-login');
  const formRegister = document.getElementById('form-auth-register');
  const tabLogin = document.getElementById('auth-tab-login');
  const tabRegister = document.getElementById('auth-tab-register');
  const errLogin = document.getElementById('auth-login-error');
  const errRegister = document.getElementById('auth-register-error');

  if (errLogin) errLogin.classList.add('hidden');
  if (errRegister) errRegister.classList.add('hidden');

  if (tabRegister && isRegistrationDisabled) {
    tabRegister.style.display = 'none';
    tabRegister.classList.add('hidden');
  }

  if (tab === 'register' && !isRegistrationDisabled) {
    if (formLogin) formLogin.classList.add('hidden');
    if (formRegister) formRegister.classList.remove('hidden');
    if (tabRegister) {
      tabRegister.className = 'flex-1 py-2 text-center font-bold text-sm text-emerald-400 border-b-2 border-emerald-500 transition';
    }
    if (tabLogin) {
      tabLogin.className = 'flex-1 py-2 text-center font-bold text-sm text-gray-400 hover:text-gray-200 border-b-2 border-transparent transition';
    }
    const regName = document.getElementById('register-input-name');
    if (regName) setTimeout(() => regName.focus(), 100);
  } else {
    if (formLogin) formLogin.classList.remove('hidden');
    if (formRegister) formRegister.classList.add('hidden');
    if (tabLogin) {
      tabLogin.className = 'flex-1 py-2 text-center font-bold text-sm text-blue-400 border-b-2 border-blue-500 transition';
    }
    if (tabRegister) {
      tabRegister.className = (isRegistrationDisabled ? 'hidden ' : '') + 'flex-1 py-2 text-center font-bold text-sm text-gray-400 hover:text-gray-200 border-b-2 border-transparent transition';
      if (isRegistrationDisabled) tabRegister.style.display = 'none';
    }
    const logEmail = document.getElementById('login-input-email');
    if (logEmail) setTimeout(() => logEmail.focus(), 100);
  }
}

function openAuthModal() {
  const errGoogle = document.getElementById('auth-google-error');
  if (errGoogle) errGoogle.classList.add('hidden');
  openModal('modal-auth');
  setupGoogleSignIn();
}

let googleClientId = '436412031999-5hjf625k2417tn0ua2lb395731111dvb.apps.googleusercontent.com';

async function setupGoogleSignIn() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.googleClientId) {
        googleClientId = data.googleClientId;
      }
    }
  } catch (e) {}

  if (window.google && window.google.accounts && window.google.accounts.id && googleClientId) {
    try {
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleSignInResponse,
        auto_select: false
      });
      const gBtn = document.getElementById('g_id_signin');
      if (gBtn) {
        google.accounts.id.renderButton(gBtn, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 320
        });
        const customBtn = document.getElementById('btn-custom-google-signin');
        if (customBtn) customBtn.classList.add('hidden');
      }
    } catch (err) {
      console.warn("Google Sign-In initialization:", err);
    }
  }
}

async function handleGoogleSignInResponse(response) {
  const errEl = document.getElementById('auth-google-error');
  if (errEl) errEl.classList.add('hidden');

  if (!response || !response.credential) {
    if (errEl) {
      errEl.innerText = "No credential received from Google.";
      errEl.classList.remove('hidden');
    }
    return;
  }

  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('rogue_carrier_auth_token', authToken);
      updateAuthHeaderUI();
      closeModal('modal-auth');
      showToast(data.message || `Signed in with Google as ${currentUser.name}!`, 'success');
      preloadTeamUsers();
    } else {
      if (errEl) {
        errEl.innerText = data.message || "Google authentication failed.";
        errEl.classList.remove('hidden');
      }
    }
  } catch (e) {
    if (errEl) {
      errEl.innerText = "Network error connecting to auth server.";
      errEl.classList.remove('hidden');
    }
  }
}

async function triggerGoogleSignIn() {
  const errEl = document.getElementById('auth-google-error');
  if (errEl) errEl.classList.add('hidden');

  if (window.google && window.google.accounts && window.google.accounts.id && googleClientId) {
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        console.log("OneTap dismissed or not displayed:", notification.getNotDisplayedReason());
      }
    });
    return;
  }

  const inputCid = prompt(
    "To enable 'Sign in with Google' on this web domain, please enter your Google OAuth 2.0 Client ID (from Google Cloud Console):\n\n(Example: 123456789-abc.apps.googleusercontent.com)",
    googleClientId || ""
  );
  if (inputCid && inputCid.trim()) {
    googleClientId = inputCid.trim();
    showToast("Configured Google Client ID! Initializing...", "info");
    setupGoogleSignIn();
  }
}

async function submitUserLogin() {
  const inputEmail = document.getElementById('login-input-email');
  const inputPass = document.getElementById('login-input-password');
  const errEl = document.getElementById('auth-login-error');
  const btnSubmit = document.getElementById('btn-submit-login');

  const email = (inputEmail ? inputEmail.value.trim().toLowerCase() : '');
  const password = (inputPass ? inputPass.value : '');

  if (!email || !email.endsWith('@n-ix.com')) {
    if (errEl) {
      errEl.innerText = 'Access restricted: Only emails ending in @n-ix.com are permitted.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  if (errEl) errEl.classList.add('hidden');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = 'Signing In...';
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('rogue_carrier_auth_token', authToken);
      updateAuthHeaderUI();
      closeModal('modal-auth');

      if (currentUser.status === 'pending') {
        showToast(`Signed in! Account is in review queue by Admin Daniel Poludonnyi (Read-Only until approved).`, 'info');
      } else {
        showToast(`Welcome back, ${currentUser.name}! (${currentUser.role.toUpperCase()})`, 'success');
      }
      preloadTeamUsers();
    } else {
      if (errEl) {
        errEl.innerText = data.message || 'Login failed. Please check credentials.';
        errEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.innerText = 'Server error during sign in.';
      errEl.classList.remove('hidden');
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i> Sign In';
      if (window.lucide) lucide.createIcons();
    }
  }
}

async function submitUserRegister() {
  const inputName = document.getElementById('register-input-name');
  const inputEmail = document.getElementById('register-input-email');
  const inputPass = document.getElementById('register-input-password');
  const errEl = document.getElementById('auth-register-error');
  const btnSubmit = document.getElementById('btn-submit-register');

  const name = (inputName ? inputName.value.trim() : '');
  const email = (inputEmail ? inputEmail.value.trim().toLowerCase() : '');
  const password = (inputPass ? inputPass.value : '');

  if (!email || !email.endsWith('@n-ix.com')) {
    if (errEl) {
      errEl.innerText = 'Access restricted: Only emails ending in @n-ix.com can register.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  if (password.length < 6) {
    if (errEl) {
      errEl.innerText = 'Password must be at least 6 characters long.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  if (errEl) errEl.classList.add('hidden');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = 'Registering...';
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('rogue_carrier_auth_token', authToken);
      updateAuthHeaderUI();
      closeModal('modal-auth');

      if (currentUser.role === 'admin') {
        showToast(`Administrator account activated! Full editor permissions unlocked.`, 'success');
      } else {
        showToast(data.message || `Account created! Pending approval by Admin Daniel Poludonnyi.`, 'info');
      }
      preloadTeamUsers();
    } else {
      if (errEl) {
        errEl.innerText = data.message || 'Registration failed.';
        errEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.innerText = 'Server error during registration.';
      errEl.classList.remove('hidden');
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i data-lucide="user-plus" class="w-4 h-4"></i> Create Account';
      if (window.lucide) lucide.createIcons();
    }
  }
}

function logoutUser() {
  authToken = '';
  currentUser = null;
  localStorage.removeItem('rogue_carrier_auth_token');
  updateAuthHeaderUI();
  showToast('Signed out of Rogue Carrier Editor.', 'info');
}

async function preloadTeamUsers() {
  try {
    const res = await fetch('/api/auth/users');
    if (res.ok) {
      const data = await res.json();
      allNixUsers = data.users || [];
    }
  } catch (e) {
    console.warn("Failed preloading team users:", e);
  }
}

async function openTeamManagementModal() {
  await preloadTeamUsers();
  const listContainer = document.getElementById('team-manager-list');
  if (!listContainer) return;

  if (allNixUsers.length === 0) {
    listContainer.innerHTML = '<div class="text-center py-6 text-gray-500">No users registered yet.</div>';
  } else {
    const isAdmin = currentUser && currentUser.role === 'admin';
    listContainer.innerHTML = `
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-gray-800 text-gray-400 text-[11px] uppercase">
            <th class="py-2 px-3">Team Member</th>
            <th class="py-2 px-3">Email (@n-ix.com)</th>
            <th class="py-2 px-3">Role</th>
            <th class="py-2 px-3">Status</th>
            ${isAdmin ? '<th class="py-2 px-3 text-right">Admin Actions</th>' : ''}
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-800">
          ${allNixUsers.map(u => {
            const isPrimaryAdmin = (u.email.toLowerCase() === 'dpoludonnyi@n-ix.com');
            return `
            <tr class="hover:bg-gray-800/40">
              <td class="py-2.5 px-3 font-semibold text-gray-200">${u.name || 'User'}</td>
              <td class="py-2.5 px-3 font-mono text-cyan-300 text-xs">${u.email}</td>
              <td class="py-2.5 px-3">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'}">
                  ${u.role.toUpperCase()}
                </span>
              </td>
              <td class="py-2.5 px-3">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : (u.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40')}">
                  ${u.status.toUpperCase()}
                </span>
              </td>
              ${isAdmin ? `
                <td class="py-2.5 px-3 text-right">
                  ${isPrimaryAdmin ? `
                    <span class="text-[10px] text-gray-500 italic">Primary Admin</span>
                  ` : `
                    <div class="flex items-center justify-end gap-1.5">
                      ${u.status === 'pending' ? `
                        <button type="button" onclick="updateUserStatus('${u.email}', 'approved', '${u.role}')" class="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow transition active:scale-95 flex items-center gap-1">
                          ✔ Approve
                        </button>
                        <button type="button" onclick="updateUserStatus('${u.email}', 'rejected', '${u.role}')" class="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white font-bold text-[11px] shadow transition active:scale-95 flex items-center gap-1">
                          ✕ Reject
                        </button>
                      ` : `
                        <button type="button" onclick="updateUserStatus('${u.email}', 'pending', '${u.role}')" class="px-2 py-1 rounded bg-gray-800 hover:bg-amber-600 text-amber-300 hover:text-white font-semibold text-[10px] border border-amber-500/40 transition">
                          Set Pending
                        </button>
                      `}
                    </div>
                  `}
                </td>
              ` : ''}
            </tr>
          `}).join('')}
        </tbody>
      </table>
    `;
  }

  openModal('modal-team-manager');
}

async function updateUserStatus(email, status, role) {
  try {
    const res = await fetch('/api/auth/users/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ email, status, role })
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      showToast(data.message || `User ${email} updated to ${status}.`, 'success');
      await openTeamManagementModal();
      await preloadTeamUsers();
    } else {
      showToast(data.message || 'Failed to update user status.', 'error');
    }
  } catch (err) {
    showToast('Network error updating user status.', 'error');
  }
}

/* ==========================================================================
   BACKUPS & SNAPSHOT MANAGEMENT
   ========================================================================== */
function switchSaveManagerTab(tab) {
  const tabSaves = document.getElementById('save-manager-tab-saves');
  const tabBackups = document.getElementById('save-manager-tab-backups');
  const btnSaves = document.getElementById('tab-btn-saves');
  const btnBackups = document.getElementById('tab-btn-backups');

  if (tab === 'saves') {
    if (tabSaves) tabSaves.classList.remove('hidden');
    if (tabBackups) tabBackups.classList.add('hidden');
    if (btnSaves) {
      btnSaves.className = 'px-3 py-1 rounded-md bg-cyan-600 text-white shadow transition';
    }
    if (btnBackups) {
      btnBackups.className = 'px-3 py-1 rounded-md text-gray-400 hover:text-white transition';
    }
  } else {
    if (tabSaves) tabSaves.classList.add('hidden');
    if (tabBackups) tabBackups.classList.remove('hidden');
    if (btnBackups) {
      btnBackups.className = 'px-3 py-1 rounded-md bg-emerald-600 text-white shadow transition';
    }
    if (btnSaves) {
      btnSaves.className = 'px-3 py-1 rounded-md text-gray-400 hover:text-white transition';
    }
    loadBackupsList();
  }
}

async function loadBackupsList() {
  const container = document.getElementById('backups-snapshots-list');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-6 text-gray-500">Loading snapshots...</div>';

  try {
    const res = await fetch('/api/backups');
    if (res.ok) {
      const data = await res.json();
      const snapshots = data.backups || [];
      if (snapshots.length === 0) {
        container.innerHTML = '<div class="text-center py-6 text-gray-500">No backup snapshots stored yet. Every save creates an automated snapshot here.</div>';
        return;
      }

      container.innerHTML = snapshots.map(s => `
        <div class="snapshot-card">
          <div class="space-y-1 min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-gray-200 text-xs">${s.reason || 'Snapshot'}</span>
              <span class="text-[10px] text-gray-400 font-mono">📅 ${s.displayTime || s.timestamp}</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-800 text-cyan-300">👤 ${s.author}</span>
            </div>
            <div class="text-[11px] text-gray-400 flex items-center gap-3">
              <span>Nodes: <strong class="text-amber-400 font-mono">${s.nodeCount}</strong></span>
              <span>Dialogues: <strong class="text-purple-400 font-mono">${s.dialogueCount}</strong></span>
              <span>Size: <strong class="text-gray-300 font-mono">${Math.round(s.sizeBytes / 1024)} KB</strong></span>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="restoreSnapshot('${s.id}')" 
                    class="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-2.5 py-1.5 rounded flex items-center gap-1 text-xs shadow transition active:scale-95" 
                    title="Rollback the editor state to this exact snapshot">
              ↺ Restore
            </button>
            <a href="/api/backups/${s.filename}" download="${s.filename}" 
               class="bg-gray-800 hover:bg-gray-700 text-cyan-300 border border-gray-700 font-semibold px-2 py-1.5 rounded flex items-center gap-1 text-xs shadow transition"
               title="Download raw snapshot JSON">
              📥 JSON
            </a>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    container.innerHTML = '<div class="text-center py-6 text-red-400">Failed to load snapshots from server.</div>';
  }
}

async function createManualSnapshot() {
  const reason = prompt("Enter a label/reason for this manual backup snapshot:", "Manual Checkpoint");
  if (reason === null) return;
  const author = (currentUser && currentUser.name) || 'Editor User';

  try {
    const res = await fetch('/api/backups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() || 'Manual Snapshot', author })
    });
    if (res.ok) {
      showToast("Manual snapshot captured successfully!", "success");
      loadBackupsList();
    }
  } catch (e) {
    showToast("Failed creating snapshot", "error");
  }
}

async function restoreSnapshot(snapshotId) {
  if (!confirm(`Are you sure you want to rollback to snapshot '${snapshotId}'?\n\nA safety pre-rollback snapshot of your current state will be taken automatically before replacing data.`)) {
    return;
  }

  try {
    const res = await fetch('/api/backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: snapshotId })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        pushUndoState();
        appData = data.data;
        saveProjectToLocalStorage();
        renderApp();
        fitWholeSchematic();
        closeModal('modal-save-manager');
        showToast(`Rollback complete: Restored to '${snapshotId}'`, 'success');
      }
    }
  } catch (err) {
    showToast("Error restoring snapshot: " + err, "error");
  }
}

/* ==========================================================================
   BLOCK COMMENTING SYSTEM & @MENTIONS EMAIL DISPATCH
   ========================================================================== */
let commentCounts = {};
let activeCommentTarget = null; // { id, type, title }

async function loadAllCommentCounts() {
  try {
    const res = await fetch('/api/comments');
    if (res.ok) {
      const data = await res.json();
      commentCounts = data.counts || {};
      updateCommentBadgesInDOM();
    }
  } catch (e) {
    console.warn("Failed fetching comments:", e);
  }
}

function getCommentCount(targetId) {
  return commentCounts[targetId] || 0;
}

function updateCommentBadgesInDOM() {
  Object.keys(commentCounts).forEach(id => {
    const badges = document.querySelectorAll(`.cmt-cnt-${id}`);
    badges.forEach(b => {
      b.innerText = commentCounts[id];
      const btn = b.closest('.comment-trigger-badge');
      if (btn && commentCounts[id] > 0) btn.classList.add('has-comments');
    });
  });
}

async function openCommentsDrawer(targetId, targetType, targetTitle) {
  activeCommentTarget = { id: targetId, type: targetType, title: targetTitle };

  const drawer = document.getElementById('drawer-comments');
  const backdrop = document.getElementById('comments-drawer-backdrop');
  const typeBadge = document.getElementById('comments-target-type-badge');
  const titleEl = document.getElementById('comments-target-title');
  const inputEl = document.getElementById('comment-input-text');

  if (typeBadge) typeBadge.innerText = (targetType || 'block').toUpperCase();
  if (titleEl) titleEl.innerText = targetTitle || targetId;
  if (inputEl) inputEl.value = '';

  if (backdrop) backdrop.classList.add('is-open');
  if (drawer) drawer.classList.add('is-open');

  await loadCommentsStream(targetId);
  if (allNixUsers.length === 0) preloadTeamUsers();

  if (inputEl) setTimeout(() => inputEl.focus(), 250);
}

function closeCommentsDrawer() {
  const drawer = document.getElementById('drawer-comments');
  const backdrop = document.getElementById('comments-drawer-backdrop');
  const dropdown = document.getElementById('mention-autocomplete-dropdown');
  if (drawer) drawer.classList.remove('is-open');
  if (backdrop) backdrop.classList.remove('is-open');
  if (dropdown) dropdown.classList.add('hidden');
  activeCommentTarget = null;
}

async function loadCommentsStream(targetId) {
  const container = document.getElementById('comments-stream');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-8 text-gray-500">Loading comments...</div>';

  try {
    const res = await fetch(`/api/comments?targetId=${encodeURIComponent(targetId)}`);
    if (res.ok) {
      const data = await res.json();
      const comments = data.comments || [];
      if (comments.length === 0) {
        container.innerHTML = `
          <div class="text-center py-10 text-gray-500">
            <div class="text-3xl mb-2">💬</div>
            <p class="font-bold text-gray-400">No comments yet</p>
            <p class="text-[11px] text-gray-500 mt-1">Start a discussion and tag teammates with @</p>
          </div>
        `;
        return;
      }

      container.innerHTML = comments.map(c => {
        const authorInitials = (c.author || 'User').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        // Format mentions highlight
        const formattedText = escapeHtml(c.text).replace(/@([a-zA-Z0-9._-]+(?:@n-ix\.com)?)/g, '<span class="mention-pill">@$1</span>');

        const canDelete = currentUser && (currentUser.role === 'admin' || currentUser.email === c.authorEmail);

        return `
          <div class="comment-card space-y-1.5" id="comment-card-${c.id}">
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  ${authorInitials}
                </div>
                <div class="truncate">
                  <span class="font-bold text-gray-200">${c.author}</span>
                  <span class="text-[10px] text-gray-400 font-mono ml-1">${c.authorEmail || ''}</span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-[10px] text-gray-400 font-mono">${c.displayTime || ''}</span>
                ${canDelete ? `
                  <button type="button" onclick="deleteComment('${c.id}')" class="text-gray-500 hover:text-red-400 text-xs px-1" title="Delete Comment">
                    ✕
                  </button>
                ` : ''}
              </div>
            </div>
            <div class="text-xs text-gray-200 leading-relaxed pl-8">
              ${formattedText}
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (e) {
    container.innerHTML = '<div class="text-center py-8 text-red-400">Failed to load comments</div>';
  }
}

async function postComment() {
  if (!activeCommentTarget) return;
  const inputEl = document.getElementById('comment-input-text');
  const text = (inputEl ? inputEl.value.trim() : '');
  if (!text) return;

  const authorName = (currentUser && currentUser.name) || 'N-iX Member';
  const authorEmail = (currentUser && currentUser.email) || 'member@n-ix.com';

  const btnPost = document.getElementById('btn-post-comment');
  if (btnPost) {
    btnPost.disabled = true;
    btnPost.innerText = 'Posting...';
  }

  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetId: activeCommentTarget.id,
        targetType: activeCommentTarget.type,
        targetTitle: activeCommentTarget.title,
        text: text,
        author: authorName,
        authorEmail: authorEmail
      })
    });
    if (res.ok) {
      const data = await res.json();
      inputEl.value = '';
      await loadCommentsStream(activeCommentTarget.id);
      commentCounts[activeCommentTarget.id] = (commentCounts[activeCommentTarget.id] || 0) + 1;
      updateCommentBadgesInDOM();

      if (data.notifiedCount > 0) {
        showToast(`Comment posted! Email notification sent to ${data.notifiedUsers.join(', ')}`, 'success');
      } else {
        showToast('Comment posted', 'info');
      }
    }
  } catch (err) {
    showToast('Failed to post comment', 'error');
  } finally {
    if (btnPost) {
      btnPost.disabled = false;
      btnPost.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i> Post Comment';
      if (window.lucide) lucide.createIcons();
    }
  }
}

async function deleteComment(commentId) {
  if (!confirm("Delete this comment?")) return;
  try {
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) {
      if (activeCommentTarget) {
        await loadCommentsStream(activeCommentTarget.id);
        if (commentCounts[activeCommentTarget.id] > 0) {
          commentCounts[activeCommentTarget.id]--;
          updateCommentBadgesInDOM();
        }
      }
      showToast('Comment deleted', 'info');
    }
  } catch (e) {
    showToast('Error deleting comment', 'error');
  }
}

// Mention Autocomplete Listener
function setupMentionAutocomplete() {
  const inputEl = document.getElementById('comment-input-text');
  const dropdown = document.getElementById('mention-autocomplete-dropdown');
  if (!inputEl || !dropdown) return;

  inputEl.addEventListener('input', (e) => {
    const text = inputEl.value;
    const cursorPos = inputEl.selectionStart;
    const textBefore = text.slice(0, cursorPos);
    const mentionMatch = textBefore.match(/@([a-zA-Z0-9._-]*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const matches = allNixUsers.filter(u => 
        u.email.toLowerCase().includes(query) || 
        (u.name && u.name.toLowerCase().includes(query))
      );

      if (matches.length > 0) {
        dropdown.innerHTML = matches.map(u => `
          <div class="mention-item" onclick="insertMention('${u.email.split('@')[0]}')">
            <span class="font-bold text-gray-200 text-xs">${u.name || u.email.split('@')[0]}</span>
            <span class="text-[10px] font-mono text-cyan-400">@${u.email}</span>
          </div>
        `).join('');
        dropdown.classList.remove('hidden');
        return;
      }
    }
    dropdown.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== inputEl) {
      dropdown.classList.add('hidden');
    }
  });
}

function insertMention(handle) {
  const inputEl = document.getElementById('comment-input-text');
  const dropdown = document.getElementById('mention-autocomplete-dropdown');
  if (!inputEl) return;

  const text = inputEl.value;
  const cursorPos = inputEl.selectionStart;
  const textBefore = text.slice(0, cursorPos);
  const textAfter = text.slice(cursorPos);
  const newBefore = textBefore.replace(/@([a-zA-Z0-9._-]*)$/, `@${handle} `);

  inputEl.value = newBefore + textAfter;
  if (dropdown) dropdown.classList.add('hidden');
  inputEl.focus();
  inputEl.setSelectionRange(newBefore.length, newBefore.length);
}

function setupAuthAndCollaborationEvents() {
  const btnHeaderLogin = document.getElementById('btn-header-login');
  if (btnHeaderLogin) btnHeaderLogin.onclick = () => openAuthModal();

  const btnHeaderLogout = document.getElementById('btn-header-logout');
  if (btnHeaderLogout) btnHeaderLogout.onclick = () => logoutUser();

  const btnAdminTeam = document.getElementById('btn-admin-team');
  if (btnAdminTeam) btnAdminTeam.onclick = () => openTeamManagementModal();

  const formLogin = document.getElementById('form-auth-login');
  if (formLogin) {
    formLogin.onsubmit = (e) => {
      e.preventDefault();
      submitUserLogin();
    };
  }

  const formRegister = document.getElementById('form-auth-register');
  if (formRegister) {
    formRegister.onsubmit = (e) => {
      e.preventDefault();
      submitUserRegister();
    };
  }

  const btnCreateManualSnap = document.getElementById('btn-create-manual-snapshot');
  if (btnCreateManualSnap) btnCreateManualSnap.onclick = () => createManualSnapshot();

  const btnRefreshBackups = document.getElementById('btn-refresh-backups-list');
  if (btnRefreshBackups) btnRefreshBackups.onclick = () => loadBackupsList();

  const btnPostComment = document.getElementById('btn-post-comment');
  if (btnPostComment) btnPostComment.onclick = () => postComment();

  setupMentionAutocomplete();

  // Close notifications dropdown on outside click
  document.addEventListener('click', (e) => {
    const container = document.getElementById('container-notifications');
    const dropdown = document.getElementById('dropdown-notifications');
    if (container && dropdown && !container.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  // Start notification polling
  setTimeout(() => fetchUserNotifications(false), 800);
  setInterval(() => fetchUserNotifications(true), 12000);
}

/* ==========================================================================
   IN-APP NOTIFICATIONS & @MENTIONS SYSTEM
   ========================================================================== */
let userNotifications = [];
let lastUnreadCount = 0;
let hasShownInitialNotifToast = false;

async function fetchUserNotifications(silent = false) {
  try {
    const email = (currentUser && currentUser.email) ? encodeURIComponent(currentUser.email) : '';
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(`/api/notifications?email=${email}`, { headers });
    if (res.ok) {
      const data = await res.json();
      userNotifications = data.notifications || [];
      const unreadCount = data.unreadCount || 0;

      const badge = document.getElementById('notif-badge-count');
      if (badge) {
        if (unreadCount > 0) {
          badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      // If user has unread notifications and hasn't been alerted this session or count increased
      if (unreadCount > 0 && (!hasShownInitialNotifToast || unreadCount > lastUnreadCount)) {
        if (!silent) {
          showToast(`🔔 You have ${unreadCount} unread mention(s)! Click the bell to view.`, 'info');
        }
        hasShownInitialNotifToast = true;
      }
      lastUnreadCount = unreadCount;
    }
  } catch (err) {
    console.warn("Could not fetch notifications:", err);
  }
}

function toggleNotificationsDropdown() {
  const dropdown = document.getElementById('dropdown-notifications');
  if (!dropdown) return;

  if (dropdown.classList.contains('hidden')) {
    renderNotificationsList();
    dropdown.classList.remove('hidden');
  } else {
    dropdown.classList.add('hidden');
  }
}

function renderNotificationsList() {
  const listContainer = document.getElementById('notifications-stream-list');
  if (!listContainer) return;

  if (userNotifications.length === 0) {
    const userHandle = (currentUser && currentUser.email) ? currentUser.email.split('@')[0] : 'yourname';
    listContainer.innerHTML = `
      <div class="text-center py-8 text-gray-500 px-4">
        <div class="text-2xl mb-1.5">🔕</div>
        <p class="font-bold text-gray-300 text-xs">No notifications yet</p>
        <p class="text-[11px] text-gray-400 mt-1">When teammates tag you with <span class="text-cyan-400 font-mono">@${userHandle}</span> in comments, your alerts will appear here.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = userNotifications.map(n => {
    const authorInitials = (n.senderName || 'User').split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);
    const isUnread = !n.read;
    return `
      <div class="p-3 hover:bg-gray-800/60 cursor-pointer transition flex items-start gap-2.5 ${isUnread ? 'bg-blue-950/30 border-l-2 border-cyan-400' : ''}" 
           onclick="openNotificationTarget('${n.id}', '${n.targetId}', '${n.targetType}', '${escapeHtml(n.targetTitle)}')">
        <div class="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 shadow">
          ${authorInitials}
        </div>
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-center justify-between gap-1 text-[11px]">
            <span class="font-bold text-gray-200 truncate">${n.senderName}</span>
            <span class="text-[10px] text-gray-400 font-mono shrink-0">${n.displayTime}</span>
          </div>
          <div class="text-[11px] text-gray-300">
            Mentioned you on <strong class="text-cyan-300 font-semibold">${n.targetTitle}</strong>:
          </div>
          <div class="text-[11px] text-gray-400 bg-gray-950/60 p-2 rounded border border-gray-800 line-clamp-2 italic">
            "${escapeHtml(n.commentText)}"
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0 pt-0.5">
          ${isUnread ? `<span class="w-2 h-2 rounded-full bg-cyan-400" title="Unread"></span>` : ''}
          <button type="button" onclick="event.stopPropagation(); deleteNotificationItem('${n.id}')" class="text-gray-500 hover:text-red-400 p-1 text-xs" title="Dismiss notification">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

async function markNotificationRead(notifId) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: notifId })
    });
    const found = userNotifications.find(n => n.id === notifId);
    if (found) found.read = true;
    fetchUserNotifications(true);
  } catch (e) {}
}

async function markAllNotificationsAsRead() {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const email = (currentUser && currentUser.email) || '';
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers,
      body: JSON.stringify({ all: true, email })
    });
    userNotifications.forEach(n => n.read = true);
    fetchUserNotifications(true);
    renderNotificationsList();
    showToast("All notifications marked as read.", "info");
  } catch (e) {}
}

async function clearAllNotifications() {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const email = (currentUser && currentUser.email) || '';
    await fetch('/api/notifications/clear', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email })
    });
    userNotifications = [];
    fetchUserNotifications(true);
    renderNotificationsList();
    showToast("Notifications cleared.", "info");
  } catch (e) {}
}

async function deleteNotificationItem(notifId) {
  try {
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    await fetch(`/api/notifications/${notifId}`, { method: 'DELETE', headers });
    userNotifications = userNotifications.filter(n => n.id !== notifId);
    fetchUserNotifications(true);
    renderNotificationsList();
  } catch (e) {}
}

async function openNotificationTarget(notifId, targetId, targetType, targetTitle) {
  await markNotificationRead(notifId);
  const dropdown = document.getElementById('dropdown-notifications');
  if (dropdown) dropdown.classList.add('hidden');

  // Open the comments drawer directly on that target
  openCommentsDrawer(targetId, targetType, targetTitle);

  // Focus and highlight target element on canvas
  const nodeEl = document.getElementById(`node-${targetId}`) || document.getElementById(`diag-${targetId}`);
  if (nodeEl) {
    nodeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nodeEl.classList.add('ring-4', 'ring-cyan-400');
    setTimeout(() => nodeEl.classList.remove('ring-4', 'ring-cyan-400'), 2500);
  }
}

window.openAuthModal = openAuthModal;
window.switchAuthTab = switchAuthTab;
window.submitUserLogin = submitUserLogin;
window.submitUserRegister = submitUserRegister;
window.updateUserStatus = updateUserStatus;
window.logoutUser = logoutUser;
window.openTeamManagementModal = openTeamManagementModal;
window.switchSaveManagerTab = switchSaveManagerTab;
window.loadBackupsList = loadBackupsList;
window.createManualSnapshot = createManualSnapshot;
window.restoreSnapshot = restoreSnapshot;
window.openCommentsDrawer = openCommentsDrawer;
window.closeCommentsDrawer = closeCommentsDrawer;
window.postComment = postComment;
window.deleteComment = deleteComment;
window.insertMention = insertMention;
window.setupAuthAndCollaborationEvents = setupAuthAndCollaborationEvents;
window.setupGoogleSignIn = setupGoogleSignIn;
window.triggerGoogleSignIn = triggerGoogleSignIn;
window.handleGoogleSignInResponse = handleGoogleSignInResponse;
window.fetchUserNotifications = fetchUserNotifications;
window.toggleNotificationsDropdown = toggleNotificationsDropdown;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.clearAllNotifications = clearAllNotifications;
window.deleteNotificationItem = deleteNotificationItem;
window.openNotificationTarget = openNotificationTarget;


