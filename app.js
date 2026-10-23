// ============================================================================
// app.js - Rogue Carrier Narrative Editor Bootstrap Entrypoint
// ============================================================================

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  canvasContainer = document.getElementById('canvas-container');
  canvasStage = document.getElementById('canvas-stage');
  svgConnectors = document.getElementById('svg-connectors');
  nodesLayer = document.getElementById('nodes-layer');
  floorBandsLayer = document.getElementById('floor-bands-layer');
  variationSelect = document.getElementById('variation-select');

  // Lock window scroll to (0,0) permanently for iOS WebKit/iPad browsers
  window.scrollTo(0, 0);
  window.addEventListener('scroll', () => {
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
  }, { passive: true });

  await loadResourceCatalog();
  await initAuthSystem();

  setupToolbarEvents();
  setupAuthAndCollaborationEvents();

  if (isLocalEnvironment() || hasAppAccess()) {
    try {
      await loadProjectData();
    } catch (err) {
      console.error("[Startup] Error loading project data (continuing initialization):", err);
    }

    if (typeof syncActiveBoardLock === 'function') {
      try {
        syncActiveBoardLock();
      } catch (e) {
        console.warn("[Startup] syncActiveBoardLock error:", e);
      }
    }

    try {
      await loadAllCommentCounts();
    } catch (e) {
      console.warn("[Startup] loadAllCommentCounts error:", e);
    }

    setupCanvasEvents();
    setupPdfImportEvents();
    setupPickerEvents();
    setupPortDragEvents();

    // Auto-detect narrow phone devices (< 768px, iPhone, Android phones, etc.) - keep iPad / tablets in PC canvas mode
    const isPhoneDevice = window.innerWidth < 768 && /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isPhoneDevice) {
      switchAppViewMode('mobile-stage', true);
    } else {
      renderApp();
      setTimeout(() => {
        const restored = (typeof restoreBoardViewTransform === 'function') && restoreBoardViewTransform();
        if (!restored) {
          updateCanvasTransform();
          fitWholeSchematic();
        }
      }, 150);
    }
  } else {
    // Unauthenticated public visitor: hide board, show lock gate
    updateAuthHeaderUI();
    setupGoogleSignIn();
  }
});

