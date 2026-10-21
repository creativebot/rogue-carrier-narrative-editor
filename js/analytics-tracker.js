// ============================================================================
// js/analytics-tracker.js - Writer Performance Telemetry Tracker
// Precision tracking of active editing time (60s inactivity threshold, edit-lock gated)
// ============================================================================

(function () {
  const INACTIVITY_TIMEOUT_MS = 60000; // 60 seconds of inactivity pauses tracking
  const FLUSH_INTERVAL_MS = 30000;     // Flushes accumulated seconds every 30s
  
  let lastUserActivityTime = Date.now();
  let accumulatedSeconds = 0;
  let trackerInterval = null;
  let flushInterval = null;
  let isFlushing = false;

  function recordUserActivity() {
    lastUserActivityTime = Date.now();
  }

  // Throttle mousemove activity recording
  let lastMoveRecord = 0;
  function handleThrottledPointerMove() {
    const now = Date.now();
    if (now - lastMoveRecord > 2000) {
      lastMoveRecord = now;
      recordUserActivity();
    }
  }

  // Attach activity listeners across window
  window.addEventListener('keydown', recordUserActivity, { passive: true });
  window.addEventListener('pointerdown', recordUserActivity, { passive: true });
  window.addEventListener('input', recordUserActivity, { passive: true });
  window.addEventListener('wheel', handleThrottledPointerMove, { passive: true });
  window.addEventListener('mousemove', handleThrottledPointerMove, { passive: true });

  function isCurrentlyActivelyEditing() {
    // 1. Tab must be active and visible
    if (document.hidden) return false;

    // 2. User must not be idle (> 60s since last interaction)
    if (Date.now() - lastUserActivityTime > INACTIVITY_TIMEOUT_MS) return false;

    // 3. User must have an authenticated identity
    const user = (typeof window.getCurrentUser === 'function') ? window.getCurrentUser() : null;
    if (!user || !user.email) {
      // Check local environment fallback
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocal) return false;
    }

    // 4. Current board must NOT be in read-only mode
    const isReadOnly = (typeof window.isCurrentBoardReadOnly === 'function') 
      ? window.isCurrentBoardReadOnly() 
      : false;
    if (isReadOnly) return false;

    // 5. User must hold an active edit lock on the current board
    const lock = (typeof window.getCurrentBoardLock === 'function') 
      ? window.getCurrentBoardLock() 
      : null;
    if (!lock) return false;

    return true;
  }

  function tickSecond() {
    if (isCurrentlyActivelyEditing()) {
      accumulatedSeconds += 1;
    }
  }

  async function flushAnalytics(isUnloading = false) {
    if (accumulatedSeconds <= 0 || isFlushing) return;
    
    const secondsToSend = accumulatedSeconds;
    const boardId = (typeof window.getCurrentBoardIdentifier === 'function')
      ? window.getCurrentBoardIdentifier()
      : 'General';

    const payload = {
      seconds: secondsToSend,
      boardId: boardId,
      timestamp: new Date().toISOString()
    };

    if (isUnloading && navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('/api/analytics/track', blob);
        accumulatedSeconds = 0;
        return;
      } catch (e) {
        // Fallback to fetch
      }
    }

    isFlushing = true;
    try {
      const headers = (typeof getAuthHeaders === 'function') 
        ? getAuthHeaders(true) 
        : { 'Content-Type': 'application/json' };

      const res = await fetch('/api/analytics/track', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        keepalive: isUnloading
      });

      if (res.ok) {
        accumulatedSeconds = Math.max(0, accumulatedSeconds - secondsToSend);
      }
    } catch (err) {
      // Leave accumulatedSeconds to retry on next flush
      console.warn('[AnalyticsTracker] Telemetry flush error:', err);
    } finally {
      isFlushing = false;
    }
  }

  // Initialize tracking timers
  trackerInterval = setInterval(tickSecond, 1000);
  flushInterval = setInterval(() => flushAnalytics(false), FLUSH_INTERVAL_MS);

  // Flush on tab hide / close / unload
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      flushAnalytics(true);
    } else {
      recordUserActivity();
    }
  });

  window.addEventListener('beforeunload', () => {
    flushAnalytics(true);
  });
  window.addEventListener('pagehide', () => {
    flushAnalytics(true);
  });

  // Global hooks
  window.flushEditingAnalytics = flushAnalytics;
  window.recordAnalyticsUserActivity = recordUserActivity;
  window.getAccumulatedEditingSeconds = () => accumulatedSeconds;
})();
