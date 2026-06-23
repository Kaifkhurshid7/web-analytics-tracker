import { useState, useCallback } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks/useFetch';

const ICONS = { page_view: '📄', click: '🖱️' };

function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function duration(first, last) {
  const s = Math.floor((new Date(last) - new Date(first)) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function Sessions({ onHeatmap }) {
  const { data: sessions, loading, error } = useFetch(() => api.getSessions());
  const [selected, setSelected] = useState(null);
  const [journey, setJourney] = useState(null);
  const [journeyLoading, setJourneyLoading] = useState(false);

  const loadJourney = useCallback(async (id) => {
    if (selected === id) { setSelected(null); setJourney(null); return; }
    setSelected(id);
    setJourney(null);
    setJourneyLoading(true);
    try {
      const events = await api.getSession(id);
      setJourney(events);
    } finally {
      setJourneyLoading(false);
    }
  }, [selected]);

  if (loading) return <div className="loading">Loading sessions…</div>;
  if (error)   return <div className="error">Error: {error}</div>;
  if (!sessions?.length) return (
    <div className="empty">
      <div className="empty-icon">📭</div>
      <p>No sessions yet. Open the <a href="../demo/index.html" target="_blank">demo page</a> to generate events.</p>
    </div>
  );

  return (
    <div className="sessions-layout">
      <div className="sessions-list">
        <div className="list-header">
          <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
        </div>
        {sessions.map((s) => (
          <div
            key={s.session_id}
            className={`session-card ${selected === s.session_id ? 'active' : ''}`}
            onClick={() => loadJourney(s.session_id)}
          >
            <div className="session-id">{s.session_id.slice(0, 20)}…</div>
            <div className="session-meta">
              <span className="badge badge-blue">{s.total_events} events</span>
              <span className="badge badge-gray">{s.page_views} views</span>
              <span className="badge badge-gray">{s.clicks} clicks</span>
            </div>
            <div className="session-time">
              Last seen {relativeTime(s.last_seen)} ·{' '}
              Duration {duration(s.first_seen, s.last_seen)}
            </div>
          </div>
        ))}
      </div>

      <div className="journey-panel">
        {!selected && (
          <div className="journey-empty">
            <div style={{ fontSize: '2.5rem' }}>👆</div>
            <p>Select a session to see the user journey</p>
          </div>
        )}
        {selected && journeyLoading && <div className="loading">Loading journey…</div>}
        {selected && journey && (
          <>
            <div className="journey-header">
              <span className="mono">{selected}</span>
              <span>{journey.length} events</span>
            </div>
            <div className="journey-timeline">
              {journey.map((evt, i) => (
                <div key={i} className={`timeline-item type-${evt.event_type}`}>
                  <div className="timeline-dot">{ICONS[evt.event_type] || '•'}</div>
                  <div className="timeline-content">
                    <div className="timeline-type">{evt.event_type}</div>
                    <div className="timeline-url">{evt.page_url}</div>
                    {evt.event_type === 'click' && (
                      <div className="timeline-coords">
                        x: {evt.x}, y: {evt.y} · viewport {evt.viewport_width}×{evt.viewport_height}
                        <button
                          className="heatmap-link"
                          onClick={(e) => { e.stopPropagation(); onHeatmap(evt.page_url); }}
                        >
                          View heatmap →
                        </button>
                      </div>
                    )}
                    <div className="timeline-ts">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
