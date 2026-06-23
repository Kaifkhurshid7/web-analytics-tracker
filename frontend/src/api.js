/**
 * Analytics API Client
 * All communication with the backend API
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000';

/**
 * Generic API request handler with error handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `API Error: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`[API] Error on ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * Fetch all sessions with pagination
 */
export async function fetchSessions(limit = 50, skip = 0, sortBy = 'last_event') {
  const response = await apiRequest(
    `/api/events/sessions?limit=${limit}&skip=${skip}&sortBy=${sortBy}`
  );
  return response.data || [];
}

/**
 * Fetch complete session details with all events
 */
export async function fetchSessionDetails(sessionId) {
  const response = await apiRequest(`/api/events/session/${sessionId}`);
  return response.data || {};
}

/**
 * Fetch click coordinates for heatmap visualization
 */
export async function fetchHeatmapData(pageUrl, limit = 5000) {
  const encodedUrl = encodeURIComponent(pageUrl);
  const response = await apiRequest(`/api/events/heatmap?url=${encodedUrl}&limit=${limit}`);
  return response.data || {};
}

/**
 * Fetch all distinct pages with stats
 */
export async function fetchPages() {
  const response = await apiRequest('/api/events/pages');
  return response.data || [];
}

/**
 * Health check for backend connectivity
 */
export async function healthCheck() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch (error) {
    console.error('[API] Health check failed:', error);
    return false;
  }
}

export const api = {
  fetchSessions,
  fetchSessionDetails,
  fetchHeatmapData,
  fetchPages,
  healthCheck,
};
