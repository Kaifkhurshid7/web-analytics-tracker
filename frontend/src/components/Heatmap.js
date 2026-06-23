import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks/useFetch';

// Build a density grid for the canvas heatmap
function buildDensityGrid(clicks, canvasW, canvasH, cellSize = 20) {
  const cols = Math.ceil(canvasW / cellSize);
  const rows = Math.ceil(canvasH / cellSize);
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(0));
  let max = 0;

  clicks.forEach(({ x, y, viewport_width: vw, viewport_height: vh }) => {
    // normalise coordinates to canvas dimensions
    const nx = vw ? (x / vw) * canvasW : x;
    const ny = vh ? (y / vh) * canvasH : y;
    const col = Math.min(Math.floor(nx / cellSize), cols - 1);
    const row = Math.min(Math.floor(ny / cellSize), rows - 1);
    if (col >= 0 && row >= 0) {
      grid[row][col]++;
      max = Math.max(max, grid[row][col]);
    }
  });
  return { grid, cols, rows, max };
}

// Map density to a heatmap colour (blue → green → yellow → red)
function densityColor(ratio) {
  if (ratio < 0.001) return null;
  const stops = [
    [0,   [0,   0,   255]],
    [0.25,[0,   255, 0  ]],
    [0.5, [255, 255, 0  ]],
    [1,   [255, 0,   0  ]],
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const t = (ratio - lo[0]) / (hi[0] - lo[0]);
  const r = Math.round(lo[1][0] + t * (hi[1][0] - lo[1][0]));
  const g = Math.round(lo[1][1] + t * (hi[1][1] - lo[1][1]));
  const b = Math.round(lo[1][2] + t * (hi[1][2] - lo[1][2]));
  const a = Math.round(80 + ratio * 160); // 80-240 alpha
  return `rgba(${r},${g},${b},${a / 255})`;
}

const CANVAS_W = 800;
const CANVAS_H = 500;
const CELL = 20;

function HeatmapCanvas({ clicks }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (!clicks || clicks.length === 0) {
      ctx.fillStyle = '#1c1c1e';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#555';
      ctx.font = '16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No clicks recorded for this page yet.', CANVAS_W / 2, CANVAS_H / 2);
      return;
    }

    // Dark background
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Build + draw density grid
    const { grid, cols, rows, max } = buildDensityGrid(clicks, CANVAS_W, CANVAS_H, CELL);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ratio = max ? grid[r][c] / max : 0;
        const colour = densityColor(ratio);
        if (!colour) continue;
        ctx.fillStyle = colour;
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }

    // Draw individual click dots on top
    clicks.forEach(({ x, y, viewport_width: vw, viewport_height: vh }) => {
      const nx = vw ? (x / vw) * CANVAS_W : x;
      const ny = vh ? (y / vh) * CANVAS_H : y;
      ctx.beginPath();
      ctx.arc(nx, ny, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    });
  }, [clicks]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ width: '100%', borderRadius: '12px', display: 'block' }}
    />
  );
}

export function Heatmap({ initialUrl }) {
  const { data: pages, loading: pagesLoading } = useFetch(() => api.fetchPages());
  const [selectedUrl, setSelectedUrl] = useState(initialUrl || '');
  const [clicks, setClicks] = useState(null);
  const [clicksLoading, setClicksLoading] = useState(false);
  const [clicksError, setClicksError] = useState(null);

  const loadClicks = useCallback(async (url) => {
    if (!url) return;
    setClicksLoading(true);
    setClicksError(null);
    try {
      const data = await api.fetchHeatmapData(url);
      setClicks(data.clicks || []);
    } catch (e) {
      setClicksError(e.message);
    } finally {
      setClicksLoading(false);
    }
  }, []);

  // Auto-load if initialUrl provided
  useEffect(() => {
    if (initialUrl) { setSelectedUrl(initialUrl); loadClicks(initialUrl); }
  }, [initialUrl, loadClicks]);

  const handleSelect = (e) => {
    const url = e.target.value;
    setSelectedUrl(url);
    if (url) loadClicks(url);
    else setClicks(null);
  };

  return (
    <div className="heatmap-page">
      <div className="heatmap-controls">
        <label htmlFor="page-select">Select page URL</label>
        {pagesLoading ? (
          <div className="loading" style={{ fontSize: '0.85rem' }}>Loading pages…</div>
        ) : (
          <select id="page-select" value={selectedUrl} onChange={handleSelect} className="url-select">
            <option value="">— choose a page —</option>
            {(pages || []).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        {selectedUrl && clicks && (
          <span className="badge badge-blue" style={{ marginLeft: 12 }}>
            {clicks.length} click{clicks.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!selectedUrl && (
        <div className="heatmap-placeholder">
          <div style={{ fontSize: '3rem' }}>🗺️</div>
          <p>Choose a page to visualise click positions</p>
        </div>
      )}

      {selectedUrl && clicksLoading && <div className="loading">Loading click data…</div>}
      {clicksError && <div className="error">Error: {clicksError}</div>}

      {selectedUrl && !clicksLoading && clicks && (
        <div className="canvas-wrapper">
          <div className="canvas-legend">
            <span style={{ color: '#0000ff' }}>■</span> Low &nbsp;
            <span style={{ color: '#00ff00' }}>■</span> Medium &nbsp;
            <span style={{ color: '#ffff00' }}>■</span> High &nbsp;
            <span style={{ color: '#ff0000' }}>■</span> Very high &nbsp;
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>•</span> Individual clicks
          </div>
          <HeatmapCanvas clicks={clicks} />
        </div>
      )}
    </div>
  );
}
