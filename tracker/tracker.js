/**
 * CausalFunnel Analytics Tracker
 * Drop this script on any page to start tracking page_view and click events.
 *
 * Usage:
 *   <script>
 *     window.CF_CONFIG = { apiUrl: 'http://localhost:4000' };
 *   </script>
 *   <script src="tracker.js"></script>
 */
(function (window, document) {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  const config = window.CF_CONFIG || {};
  const API_URL = (config.apiUrl || 'http://localhost:4000').replace(/\/$/, '');
  const FLUSH_INTERVAL_MS = config.flushInterval || 3000; // batch-send every 3 s
  const SESSION_KEY = 'cf_session_id';
  const SESSION_TTL_MS = 30 * 60 * 1000; // 30-min inactivity = new session

  // ── Session ID ────────────────────────────────────────────────────────────
  function generateId() {
    return 'cf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function getSessionId() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const { id, ts } = JSON.parse(raw);
        if (Date.now() - ts < SESSION_TTL_MS) {
          // refresh TTL on activity
          localStorage.setItem(SESSION_KEY, JSON.stringify({ id, ts: Date.now() }));
          return id;
        }
      }
    } catch (_) {}
    const id = generateId();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, ts: Date.now() }));
    return id;
  }

  const SESSION_ID = getSessionId();

  // ── Event queue + flush ───────────────────────────────────────────────────
  let queue = [];

  function enqueue(event) {
    queue.push(event);
  }

  function flush() {
    if (queue.length === 0) return;
    const batch = queue.splice(0);
    const body = JSON.stringify(batch);

    // Prefer sendBeacon for reliability on page unload
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(API_URL + '/api/events', blob);
    } else {
      fetch(API_URL + '/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(function () {});
    }
  }

  setInterval(flush, FLUSH_INTERVAL_MS);
  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('beforeunload', flush);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function baseEvent(type) {
    return {
      session_id: SESSION_ID,
      event_type: type,
      page_url: window.location.href,
      timestamp: new Date().toISOString(),
    };
  }

  // ── page_view ─────────────────────────────────────────────────────────────
  function trackPageView() {
    enqueue(baseEvent('page_view'));
  }

  // Track the initial load
  trackPageView();

  // For SPAs that use the History API
  (function patchHistory() {
    const original = {
      pushState: history.pushState,
      replaceState: history.replaceState,
    };
    ['pushState', 'replaceState'].forEach(function (method) {
      history[method] = function () {
        original[method].apply(history, arguments);
        trackPageView();
      };
    });
    window.addEventListener('popstate', trackPageView);
  })();

  // ── click ─────────────────────────────────────────────────────────────────
  document.addEventListener(
    'click',
    function (e) {
      const evt = baseEvent('click');
      evt.x = Math.round(e.clientX);
      evt.y = Math.round(e.clientY);
      evt.viewport_width = window.innerWidth;
      evt.viewport_height = window.innerHeight;
      enqueue(evt);
    },
    { passive: true, capture: true }
  );

  // ── Public API ────────────────────────────────────────────────────────────
  window.CausalFunnel = {
    sessionId: SESSION_ID,
    flush: flush,
  };
})(window, document);
