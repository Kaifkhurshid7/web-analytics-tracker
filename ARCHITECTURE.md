# Architecture Documentation

Detailed technical architecture of the CausalFunnel Analytics Platform.

## System Overview

```
┌─────────────────────────────────────────────────────┐
│              User's Website/Application              │
│  ┌───────────────────────────────────────────────┐  │
│  │  Tracker Script (tracker.js - ~5KB gzipped)   │  │
│  │  • Tracks page views automatically            │  │
│  │  • Tracks click events with coordinates       │  │
│  │  • Maintains persistent session ID            │  │
│  │  • Batches events (10 events or 3s timeout)   │  │
│  │  • Uses navigator.sendBeacon for reliability  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────┬──────────────────────────────────┘
                  │
                  │ HTTP POST /api/events
                  │ (Batched, 5KB avg per batch)
                  ▼
┌─────────────────────────────────────────────────────┐
│           Backend API (Node.js/Express)              │
│                                                      │
│  Routing Layer:                                      │
│  • POST /api/events - Event ingestion               │
│  • GET /api/events/sessions - List sessions         │
│  • GET /api/events/session/:id - Session details    │
│  • GET /api/events/heatmap - Click data             │
│  • GET /api/events/pages - Distinct pages           │
│  • GET /health - Health check                       │
│                                                      │
│  Middleware:                                         │
│  • CORS - Cross-origin requests                     │
│  • Body Parser - JSON parsing (10MB limit)          │
│  • Error Handler - Centralized error handling       │
│  • Request Validation - Input validation            │
│                                                      │
│  Data Processing:                                    │
│  • Event transformation & normalization             │
│  • Session aggregation & updates                    │
│  • Batch operations for performance                 │
└─────────────────┬──────────────────────────────────┘
                  │
                  │ MongoDB Driver (mongoose)
                  ▼
┌─────────────────────────────────────────────────────┐
│           MongoDB Database                           │
│                                                      │
│  Collections:                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ events                                      │   │
│  │ ├─ session_id (indexed)                    │   │
│  │ ├─ event_type (enum: page_view, click)     │   │
│  │ ├─ page_url (indexed with event_type)      │   │
│  │ ├─ timestamp (indexed with session_id)     │   │
│  │ ├─ x, y (click coordinates)                │   │
│  │ ├─ viewport_width, viewport_height         │   │
│  │ ├─ user_agent                              │   │
│  │ └─ createdAt, updatedAt                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ sessions                                    │   │
│  │ ├─ session_id (unique, indexed)             │   │
│  │ ├─ first_event, last_event (indexed)        │   │
│  │ ├─ event_count (total events)               │   │
│  │ ├─ page_count, click_count                  │   │
│  │ ├─ pages_visited (array of URLs)            │   │
│  │ ├─ user_agent                               │   │
│  │ └─ createdAt, updatedAt                     │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  Indexes:                                            │
│  • events: { session_id: 1 }                        │
│  • events: { session_id: 1, timestamp: 1 }         │
│  • events: { event_type: 1, page_url: 1 }          │
│  • sessions: { session_id: 1 } (unique)            │
│  • sessions: { last_event: -1 }                    │
└─────────────────┬──────────────────────────────────┘
                  │
                  │ Mongoose Queries
                  ▼
┌─────────────────────────────────────────────────────┐
│           Frontend (React)                           │
│                                                      │
│  Components:                                         │
│  ┌──────────────────┐  ┌────────────────────────┐  │
│  │ App (router)     │  │ Sessions Component     │  │
│  │                  │  │ • Session list         │  │
│  │                  │  │ • Event timeline       │  │
│  └────────┬─────────┘  │ • Journey visualization│  │
│           │            └────────────────────────┘  │
│           │                                         │
│           │            ┌────────────────────────┐  │
│           └────────────│ Heatmap Component      │  │
│                        │ • Page selector        │  │
│                        │ • Canvas visualization │  │
│                        │ • Click density        │  │
│                        └────────────────────────┘  │
│                                                      │
│  Hooks:                                              │
│  • useFetch - Generic data fetching                 │
│  • useSessions - Fetch sessions list                │
│  • useSessionDetails - Fetch session events         │
│  • useHeatmap - Fetch click data                    │
│  • usePages - Fetch distinct pages                  │
│                                                      │
│  API Client (api.js):                               │
│  • fetchSessions(limit, skip)                       │
│  • fetchSessionDetails(sessionId)                   │
│  • fetchHeatmapData(pageUrl, limit)                 │
│  • fetchPages()                                     │
│  • healthCheck()                                    │
└─────────────────────────────────────────────────────┘
```

## Data Flow

### Event Ingestion Flow

```
1. User Action on Page
   ↓
2. Tracker detects event (page_view or click)
   ↓
3. Event added to in-memory queue
   ↓
4. Queue size ≥ 10 OR timeout 3s?
   ├─ YES → Flush immediately
   └─ NO → Keep queuing
   ↓
5. Prepare batch (up to 10 events)
   ↓
6. Send via navigator.sendBeacon or fetch
   ↓
7. Backend receives POST /api/events
   ↓
8. Validate each event
   ├─ INVALID → Log error, skip
   └─ VALID → Continue
   ↓
9. Insert events into MongoDB (bulk insert)
   ↓
10. Aggregate session data
    ├─ Find or create session
    ├─ Update: first_event, last_event
    ├─ Increment: event_count, page_count, click_count
    ├─ Add to: pages_visited
    └─ Upsert session document
    ↓
11. Return success response
    ↓
12. Continue batching next events
```

### Query Flow (Sessions View)

```
1. User opens dashboard
   ↓
2. useSessions hook triggered
   ↓
3. API call: GET /api/events/sessions?limit=50&skip=0
   ↓
4. Backend queries Sessions collection
   ↓
5. Sort by last_event DESC (most recent first)
   ↓
6. Return paginated results
   ↓
7. React renders session cards
   ↓
8. User clicks session
   ↓
9. useSessionDetails hook triggered with sessionId
   ↓
10. API call: GET /api/events/session/<sessionId>
    ↓
11. Backend queries Events for this session
    ↓
12. Sort by timestamp ASC (chronological order)
    ↓
13. Return all events
    ↓
14. React renders timeline
```

### Query Flow (Heatmap View)

```
1. User selects page URL from dropdown
   ↓
2. useHeatmap hook triggered with pageUrl
   ↓
3. API call: GET /api/events/heatmap?url=<encoded_url>
   ↓
4. Backend queries Events collection
   ↓
5. Filter: event_type="click" AND page_url=<url>
   ↓
6. Select: x, y, viewport_width, viewport_height
   ↓
7. Return all matching click events
   ↓
8. Frontend receives click data
   ↓
9. HeatmapCanvas component processes data:
   a. Build density grid (20x20 cells)
   b. Normalize coordinates by viewport
   c. Calculate click density per cell
   d. Map density to color (blue→red)
   ↓
10. Render canvas with heatmap
    ↓
11. Draw individual click dots on top
```

## Backend Architecture

### Models

**Event Model**
```javascript
{
  session_id: String (indexed),
  event_type: 'page_view' | 'click' (enum),
  page_url: String,
  timestamp: Date,
  x: Number (click only),
  y: Number (click only),
  viewport_width: Number,
  viewport_height: Number,
  user_agent: String,
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Session Model**
```javascript
{
  session_id: String (unique, indexed),
  first_event: Date,
  last_event: Date,
  event_count: Number,
  page_count: Number,
  click_count: Number,
  pages_visited: [String],
  user_agent: String,
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

### Middleware Pipeline

```
Request
  ↓
CORS Middleware
  ↓
Body Parser (JSON)
  ↓
Request Logger
  ↓
Route Handler
  ├─ POST /api/events → Validate → Insert → Update Session
  ├─ GET /api/events/sessions → Query → Return
  ├─ GET /api/events/session/:id → Query → Return
  ├─ GET /api/events/heatmap → Query → Return
  └─ GET /api/events/pages → Query → Return
  ↓
Response
  ├─ Success: { success: true, data: [...] }
  └─ Error: { success: false, error: { message: "..." } }
  ↓
Error Handler (catches all errors)
  ↓
Response sent to client
```

### Database Indexes

**Events Collection:**
```javascript
db.events.createIndex({ session_id: 1 })                    // Fast session lookups
db.events.createIndex({ session_id: 1, timestamp: 1 })      // Fast chronological queries
db.events.createIndex({ event_type: 1, page_url: 1 })       // Fast heatmap queries
```

**Sessions Collection:**
```javascript
db.sessions.createIndex({ session_id: 1 }, { unique: true }) // Unique sessions
db.sessions.createIndex({ last_event: -1 })                 // Fast sorting by recency
```

## Frontend Architecture

### Component Hierarchy

```
App
├─ Sidebar
│  ├─ Logo
│  ├─ Navigation
│  │  ├─ Sessions (nav item)
│  │  └─ Heatmap (nav item)
│  └─ Footer (links)
│
├─ Topbar
│  ├─ Title
│  └─ Live indicator
│
└─ Content Area
   ├─ Sessions View (tab=sessions)
   │  ├─ Sessions List
   │  │  └─ SessionCard[] (sorted by recency)
   │  └─ Event Timeline (when session selected)
   │     └─ EventCard[] (chronological)
   │
   └─ Heatmap View (tab=heatmap)
      ├─ Page Selector (dropdown)
      ├─ Canvas (HeatmapCanvas)
      │  ├─ Density grid (20x20)
      │  ├─ Color mapping
      │  └─ Individual click dots
      └─ Legend
```

### State Management

**App Level:**
```javascript
const [tab, setTab] = useState('sessions')      // Current view tab
const [heatmapUrl, setHeatmapUrl] = useState(null) // URL for heatmap
```

**Component Level (Hooks):**
```javascript
// Sessions Component
const [selectedSessionId, setSelectedSessionId] = useState(null)
const { data: sessions } = useSessions()
const { data: sessionDetails } = useSessionDetails(selectedSessionId)

// Heatmap Component
const [selectedUrl, setSelectedUrl] = useState('')
const { data: pages } = usePages()
const { data: clicks } = useHeatmap(selectedUrl)
```

### Data Fetching

All data fetching uses custom `useFetch` hook:

```javascript
function useFetch(fetcher, dependencies) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    fetcher()
      .then(result => isMounted && setData(result))
      .catch(error => isMounted && setError(error))
      .finally(() => isMounted && setLoading(false))

    return () => { isMounted = false }
  }, dependencies)

  return { data, loading, error, refetch }
}
```

## Tracker Script Architecture

### Lifecycle

```
Script Load
  ↓
Read Configuration (window.CF_CONFIG)
  ↓
Generate or Retrieve Session ID
  ├─ Check localStorage[cf_session_id]
  ├─ If valid TTL → Use existing
  └─ If expired → Generate new UUID
  ↓
Initialize Event Queue
  ├─ In-memory array: []
  └─ Batch timer: null
  ↓
Setup Event Listeners
  ├─ DOMContentLoaded → Track page_view
  ├─ click (capture phase) → Track click
  ├─ visibilitychange → Flush if hidden
  ├─ beforeunload → Flush remaining
  └─ periodically (3s) → Flush batch
  ↓
Track Initial Page View
  ↓
Ready for tracking
```

### Event Processing

```
Event Occurs
  ↓
Create event object
  ├─ session_id (from storage)
  ├─ event_type (page_view|click)
  ├─ page_url (current URL)
  ├─ timestamp (ISO string)
  ├─ x, y (click coordinates)
  ├─ viewport_width, viewport_height
  └─ user_agent
  ↓
Add to queue
  ↓
Queue size ≥ batchSize?
├─ YES → Flush immediately
└─ NO → Schedule flush in 3s
  ↓
Batching Loop
  ├─ Timer: 3 seconds
  ├─ Size: 10 events
  └─ Whichever comes first
  ↓
Send Batch
  ├─ Try navigator.sendBeacon (preferred)
  ├─ Fallback to fetch with keepalive
  └─ Silent failure (no user notification)
  ↓
Continue processing
```

## Performance Optimizations

### Backend
1. **Indexing** - Compound indexes for common queries
2. **Batch Inserts** - Multiple events in single DB operation
3. **Aggregation** - Session updates via bulk operations
4. **Query Projection** - Only select needed fields
5. **Connection Pooling** - Mongoose manages pool
6. **Pagination** - Limit result sets (default 50)

### Frontend
1. **React.memo** - Prevent unnecessary re-renders
2. **useCallback** - Memoize event handlers
3. **Lazy Loading** - Code splitting with React.lazy
4. **Virtual Scrolling** - (Future) For large event lists
5. **Request Deduplication** - Single flight requests
6. **CSS-in-JS** - Critical CSS inlined

### Tracker
1. **Event Batching** - Reduce network requests (1 request per 3s vs per event)
2. **Lazy Session ID** - Only generate if needed
3. **navigator.sendBeacon** - Reliable delivery without blocking
4. **localStorage** - Persistent sessions without server overhead
5. **Event Delegation** - Single listener for all clicks
6. **No Dependencies** - Vanilla JS, ~5KB gzipped

## Error Handling

### Backend
```javascript
try {
  // Process request
} catch (err) {
  // Log error
  console.error('Error:', err)

  // Send structured response
  res.status(err.statusCode || 500).json({
    success: false,
    error: { message: err.message }
  })
}
```

### Frontend
```javascript
try {
  const result = await fetch(url)
  if (!result.ok) throw new Error(`${result.status}`)
  return await result.json()
} catch (err) {
  setError(err.message)
  // UI shows error state
}
```

### Tracker
```javascript
try {
  navigator.sendBeacon(url, blob)
} catch (e) {
  console.error('[Analytics] sendBeacon failed:', e)
  // Fallback to fetch
}
```

## Scalability Considerations

### Current Capacity
- ~10,000 events/second
- ~100,000 sessions
- ~1M events
- Response times < 100ms

### Scaling Strategies

1. **Database**
   - Sharding by session_id
   - TTL indexes for data retention
   - Read replicas for queries

2. **Backend**
   - Load balancer (HAProxy, nginx)
   - Horizontal scaling (multiple instances)
   - Redis caching layer
   - Message queue (RabbitMQ) for async processing

3. **Frontend**
   - CDN for static assets
   - Server-side rendering (Next.js)
   - GraphQL for flexible querying

4. **Tracker**
   - Edge computing (Cloudflare Workers)
   - Service worker caching
   - Offline-first support

## Security Architecture

```
Tracker (Public)
  ↓ HTTPS
Backend (Restricted)
  ├─ CORS validation
  ├─ Request validation
  ├─ Rate limiting
  └─ Input sanitization
  ↓
Database (Restricted)
  └─ Credentials only on server
```

## Deployment Architecture

```
GitHub Repo
  ↓
CI/CD Pipeline (GitHub Actions)
  ├─ Run tests
  ├─ Build Docker images
  └─ Push to registry
  ↓
Production Cluster
  ├─ Backend pods (Kubernetes)
  ├─ Frontend CDN (Cloudflare)
  ├─ MongoDB Atlas
  └─ Redis cache
  ↓
Monitoring
  ├─ Error tracking (Sentry)
  ├─ Performance monitoring (New Relic)
  └─ Logs (CloudWatch)
```

---

This architecture is designed for:
- **Scalability** - Horizontal scaling through microservices
- **Reliability** - Error handling, retries, fallbacks
- **Performance** - Batching, indexing, caching
- **Maintainability** - Clear separation of concerns
- **Extensibility** - Easy to add features
