const BASE = process.env.REACT_APP_API_URL || '';

async function apiFetch(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  getSessions: () => apiFetch('/api/events/sessions'),
  getSession: (id) => apiFetch(`/api/events/session/${encodeURIComponent(id)}`),
  getHeatmap: (url) => apiFetch(`/api/events/heatmap?url=${encodeURIComponent(url)}`),
  getPages: () => apiFetch('/api/events/pages'),
};
