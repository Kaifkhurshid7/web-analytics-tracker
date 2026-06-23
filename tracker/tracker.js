/**
 * CausalFunnel Analytics Tracker
 * Drop this script on any page to start tracking page_view and click events.
 *
 * Usage:
 *   <script>
 *     window.CF_CONFIG = { 
 *       apiUrl: 'http://localhost:4000',
 *       flushInterval: 3000,
 *       batchSize: 10,
 *       sessionTTL: 30 * 60 * 1000
 *     };
 *   </script>
 *   <script src="tracker.js"></script>
 */
(function (window, document) {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  const config = window.CF_CONFIG || {};
  const API_URL = (config.apiUrl || 'http://localhost:4000').replace(/\/$/, '');
  const FLUSH_INTERVAL_MS = config.flushInterval || 3000; // batch-send every 3s
  const BATCH_SIZE = config.batchSize || 10;
  const SESSION_KEY = 'cf_session_id';
  const SESSION_TTL_MS = config.sessionTTL || 30 * 60 * 1000; // 30-min inactivity = new session

  // ── Session ID ────────────────────────────────────────────────────────────
  /**
   * Generate a UUID v4 style session ID
   */
  function generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Get or create session ID with TTL
   */
  function getSessionId() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const { id, ts } = JSON.parse(raw);
        if (Date.now() - ts < SESSION_TTL_MS) {
          // Refresh TTL on activity
          localStorage.setItem(SESSION_KEY, JSON.stringify({ id, ts: Date.now() }));
          return id;
        }
      }
    } catch (_) {}

    const id = generateSessionId();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, ts: Date.now() }));
    return id;
  }

  const SESSION_ID = getSessionId();

  // ── Event queue + flush ───────────────────────────────────────────────────
  let queue = [];
  let flushTimer = null;

  /**
   * Add event to queue and schedule flush if needed
   */
  function enqueue(event) {
    queue.push(event);

    // Flush if batch size reached
    if (queue.length >= BATCH_SIZE) {
      flush();
    } else if (!flushTimer) {
      // Schedule flush
      flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Send batched events to backend
   */
  function flush() {
    if (queue.length === 0) {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      return;
    }

    const batch = queue.splice(0);
    const body = JSON.stringify(batch);

    // Prefer sendBeacon for reliability on page unload
    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(API_URL + '/api/events', blob);
      } catch (e) {
        console.error('[Analytics] sendBeacon failed:', e);
      }
    } else {
      // Fallback to fetch
      fetch(API_URL + '/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(function (err) {
        console.error('[Analytics] fetch failed:', err);
      });
    }

    // Reschedule if queue still has items
    if (queue.length > 0) {
      flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
    } else if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  /**
   * Create base event object with common fields
   */
  function baseEvent(type) {
    return {
      session_id: SESSION_ID,
      event_type: type,
      page_url: window.location.href,
      timestamp: new Date().toISOString(),
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      user_agent: navigator.userAgent,
    };
  }

  // ── page_view ─────────────────────────────────────────────────────────────
  /**
   * Track page view event
   */
  function trackPageView() {
    enqueue(baseEvent('page_view'));
  }

  // Track the initial page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageView);
  } else {
    trackPageView();
  }

  // For SPAs that use the History API (React Router, Vue Router, Next.js, etc.)
  (function patchHistory() {
    const original = {
      pushState: history.pushState,
      replaceState: history.replaceState,
    };

    ['pushState', 'replaceState'].forEach(function (method) {
      history[method] = function () {
        original[method].apply(history, arguments);
        // Delay to ensure DOM is updated
        setTimeout(trackPageView, 0);
      };
    });

    window.addEventListener('popstate', function () {
      setTimeout(trackPageView, 0);
    });
  })();

  // ── click ─────────────────────────────────────────────────────────────────
  /**
   * Track click events with coordinates
   */
  document.addEventListener(
    'click',
    function (e) {
      // Only track left mouse clicks
      if (e.button !== 0) return;

      const evt = baseEvent('click');
      evt.x = Math.round(e.clientX);
      evt.y = Math.round(e.clientY);

      enqueue(evt);
    },
    { passive: true, capture: true }
  );

  // ── Page visibility & unload ──────────────────────────────────────────────
  /**
   * Flush events when page becomes hidden
   */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      flush();
    }
  });

  /**
   * Flush remaining events on page unload
   */
  window.addEventListener('beforeunload', function () {
    flush();
  });

  // Periodic flush
  setInterval(flush, FLUSH_INTERVAL_MS);

  // ── Public API ────────────────────────────────────────────────────────────
  /**
   * Public API for manual tracking and control
   */
  window.CausalFunnel = {
    sessionId: SESSION_ID,
    flush: flush,
    trackEvent: function (eventType, data) {
      if (!['page_view', 'click'].includes(eventType)) {
        console.error('[Analytics] Invalid event type:', eventType);
        return;
      }
      const evt = {
        ...baseEvent(eventType),
        ...data,
      };
      enqueue(evt);
    },
    getQueueSize: function () {
      return queue.length;
    },
  };

  // Log initialization
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log('[Analytics] Tracker initialized - Session:', SESSION_ID);
  }
})(window, document);
