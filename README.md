# CausalFunnel Analytics

A full-stack user analytics application that tracks **page views** and **click events** on any webpage and displays them in a real-time dashboard with session replay and a click heatmap.

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Tracker    | Vanilla JS (zero dependencies)      |
| Backend    | Node.js · Express · Mongoose        |
| Database   | MongoDB 7                           |
| Frontend   | React 18 · Canvas API               |
| Container  | Docker · Docker Compose             |

---

## Project Structure

```
analytics-app/
├── backend/              # Express API
│   ├── src/
│   │   ├── index.js      # Entry point
│   │   ├── models/       # Mongoose schemas
│   │   └── routes/       # API route handlers
│   ├── Dockerfile
│   └── package.json
│
├── frontend/             # React dashboard
│   ├── src/
│   │   ├── App.js        # Root + tab routing
│   │   ├── App.css       # All styles
│   │   ├── api.js        # API client
│   │   ├── hooks/
│   │   │   └── useFetch.js
│   │   └── components/
│   │       ├── Sessions.js   # Sessions view + journey
│   │       └── Heatmap.js    # Click heatmap canvas
│   ├── public/
│   │   └── index.html
│   ├── Dockerfile
│   └── package.json
│
├── tracker/
│   └── tracker.js        # Drop-in JS tracking script
│
├── demo/
│   └── index.html        # Demo e-commerce test page
│
├── docker-compose.yml
└── README.md
```

---

## Setup

### Option A — Docker (recommended)

```bash
git clone <your-repo-url>
cd analytics-app

docker compose up --build
```

| Service   | URL                        |
|-----------|----------------------------|
| Dashboard | http://localhost:3000      |
| Backend   | http://localhost:4000      |
| MongoDB   | mongodb://localhost:27017  |

### Option B — Local Development

**Prerequisites:** Node.js 18+, MongoDB running locally

**1. Backend**
```bash
cd backend
cp .env.example .env
npm install
npm run dev       # nodemon, auto-restarts
```

**2. Frontend**
```bash
cd frontend
npm install
npm start         # CRA dev server on :3000
```

**3. Demo page**

Open `demo/index.html` directly in your browser (or serve it with any static server):
```bash
npx serve .       # from repo root
# then visit http://localhost:3000/demo/index.html
```

---

## Using the Tracker on Your Own Page

```html
<!-- 1. Configure -->
<script>
  window.CF_CONFIG = {
    apiUrl: 'http://localhost:4000',   // your backend URL
    flushInterval: 3000                // ms between batch sends (optional)
  };
</script>

<!-- 2. Load -->
<script src="/path/to/tracker.js"></script>
```

That's it. The tracker automatically:
- Generates a `session_id` stored in `localStorage` (30-min inactivity = new session)
- Sends a `page_view` on load and on every History API navigation (SPA support)
- Captures every `click` with `x`, `y`, and viewport dimensions
- Batches events and flushes every `flushInterval` ms, on `visibilitychange`, and on `beforeunload` (uses `sendBeacon` when available)

---

## API Reference

| Method | Path                              | Description                              |
|--------|-----------------------------------|------------------------------------------|
| POST   | `/api/events`                     | Ingest one or an array of events         |
| GET    | `/api/events/sessions`            | List all sessions with aggregate counts  |
| GET    | `/api/events/session/:sessionId`  | Ordered event journey for a session      |
| GET    | `/api/events/heatmap?url=<url>`   | Click coordinates for a given page URL   |
| GET    | `/api/events/pages`               | Distinct page URLs seen                  |
| GET    | `/health`                         | Health check                             |

### Event payload schema

```json
{
  "session_id":      "cf-abc123",
  "event_type":      "click",
  "page_url":        "http://example.com/shop",
  "timestamp":       "2025-01-15T10:30:00.000Z",
  "x":               412,
  "y":               230,
  "viewport_width":  1440,
  "viewport_height": 900
}
```

---

## Dashboard Features

### Sessions View
- Lists every session sorted by most-recently-seen
- Shows total events, page views, clicks, and session duration per row
- Click any row to expand the **user journey** — a chronological timeline of every event
- Click a "View heatmap →" link on any click event to jump straight to the heatmap for that page

### Heatmap View
- Dropdown to select any page URL that has received click events
- Canvas-based density grid (blue → green → yellow → red) overlaid with individual click dots
- Coordinates are normalised to a standard viewport so clicks from different screen sizes are comparable

---

## Assumptions & Trade-offs

| Decision | Rationale |
|----------|-----------|
| **Batch + flush approach** | Avoids one HTTP request per event; `sendBeacon` ensures events aren't lost on tab close |
| **`localStorage` for session ID** | Cookies require `SameSite`/`Secure` config and server-side handling; `localStorage` is simpler for a demo. Caveat: cleared on explicit logout / incognito. |
| **30-min inactivity = new session** | Industry-standard GA definition; configurable via `CF_CONFIG.flushInterval` |
| **Heatmap uses relative coordinates** | `x / viewport_width` and `y / viewport_height` makes dots from 1080p and 4K screens directly comparable on the canvas |
| **No auth on the API** | Out of scope for this assignment; a production system would add JWT or API-key middleware |
| **React CRA** | Fast to scaffold; Next.js would be preferable for SSR/SEO in production |
| **Single MongoDB collection** | Simple to query for this scale; at higher volume, separating sessions from events would make sense |
