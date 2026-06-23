import { useState } from 'react';
import { Sessions } from './components/Sessions';
import { Heatmap } from './components/Heatmap';
import './App.css';

export default function App() {
  const [tab, setTab] = useState('sessions');
  const [heatmapUrl, setHeatmapUrl] = useState(null);

  const goHeatmap = (url) => {
    setHeatmapUrl(url);
    setTab('heatmap');
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">CF</div>
          <div>
            <div className="logo-name">CausalFunnel</div>
            <div className="logo-sub">Analytics</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${tab === 'sessions' ? 'active' : ''}`}
            onClick={() => setTab('sessions')}
          >
            <span className="nav-icon">👥</span>
            Sessions
          </button>
          <button
            className={`nav-item ${tab === 'heatmap' ? 'active' : ''}`}
            onClick={() => { setTab('heatmap'); setHeatmapUrl(null); }}
          >
            <span className="nav-icon">🔥</span>
            Heatmap
          </button>
        </nav>

        <div className="sidebar-footer">
          <a
            href="/demo/index.html"
            target="_blank"
            rel="noreferrer"
            className="demo-link"
          >
            Open demo page ↗
          </a>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            {tab === 'sessions' ? 'Sessions' : 'Click Heatmap'}
          </div>
          <div className="topbar-right">
            <div className="live-dot" />
            <span style={{ fontSize: '0.8rem', color: '#8e8e93' }}>Live</span>
          </div>
        </header>

        <div className="content">
          {tab === 'sessions' && <Sessions onHeatmap={goHeatmap} />}
          {tab === 'heatmap' && <Heatmap initialUrl={heatmapUrl} />}
        </div>
      </main>
    </div>
  );
}
