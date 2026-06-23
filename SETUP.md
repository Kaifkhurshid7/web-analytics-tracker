# 🚀 Setup & Installation Guide

Complete step-by-step setup instructions for the CausalFunnel Analytics Platform.

## 📋 Prerequisites

Ensure you have the following installed:

- **Node.js 16+** - [Download](https://nodejs.org/)
- **npm 7+** - Comes with Node.js
- **MongoDB 4.4+** - [Download](https://www.mongodb.com/try/download/community) or use Docker
- **Git** - [Download](https://git-scm.com/)
- **Docker & Docker Compose** (optional) - [Download](https://www.docker.com/products/docker-desktop)

## 🔍 Verify Installations

```bash
# Check Node.js
node --version
# Expected: v16.0.0 or higher

# Check npm
npm --version
# Expected: 7.0.0 or higher

# Check MongoDB (if installed locally)
mongod --version
# Expected: db version v4.4.0 or higher

# Check Docker (optional)
docker --version
docker-compose --version
```

## 💻 Option 1: Local Setup (Recommended for Development)

### Step 1: Install MongoDB Locally

**macOS (Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Windows:**
```bash
# Download installer from https://www.mongodb.com/try/download/community
# Run installer and follow wizard
# MongoDB will run as a service
```

**Linux (Ubuntu):**
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

**Verify MongoDB:**
```bash
mongosh
# In shell:
> db.runCommand("ping")
# Should return: { ok: 1 }
> exit
```

### Step 2: Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env (optional, defaults work for local development)
# nano .env
# or
# code .env

# Start backend
npm start

# Expected output:
# ✅ MongoDB connected: mongodb://localhost:27017/analytics
# 🚀 Backend running on http://localhost:4000
```

**Verify Backend:**
```bash
curl http://localhost:4000/health
# Should return: {"status":"ok","timestamp":"2024-01-15T10:30:00.000Z"}
```

### Step 3: Setup Frontend

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start

# This will automatically open http://localhost:3000
# Expected: React dashboard loads with "Loading sessions..."
```

### Step 4: Test with Demo Page

Open a new terminal:

```bash
cd demo

# Option A: Use Python's built-in server (Python 3.x)
python -m http.server 8000

# Option B: Use Node.js
npx http-server -p 8000

# Option C: Use Ruby
ruby -run -ehttpd . -p8000

# Open browser to http://localhost:8000/index.html
```

### Step 5: Generate Test Data

1. Open demo page: http://localhost:8000/index.html
2. Click various buttons (Learn More, Explore, Get Started, etc.)
3. Check backend logs for events being saved
4. Wait 3-5 seconds
5. Open dashboard: http://localhost:3000
6. You should see your session and events!

---

## 🐳 Option 2: Docker Setup (Recommended for Production)

### Quick Start

```bash
# From project root
docker-compose up

# Wait for services to start (2-3 minutes)
# Services available at:
# - Backend: http://localhost:4000
# - Frontend: http://localhost:3000
# - Demo: http://localhost:8000
# - MongoDB: localhost:27017
```

### Verify Services

```bash
# Check all containers running
docker-compose ps

# Expected output:
# NAME                    STATUS
# analytics-mongodb       Up (healthy)
# analytics-backend       Up (healthy)
# analytics-frontend      Up (running)
# analytics-demo          Up (running)

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb

# Stop services
docker-compose down

# Stop and remove volumes (WARNING: Deletes data)
docker-compose down -v
```

### Troubleshooting Docker

**Port already in use:**
```bash
# On macOS/Linux, find process using port 4000
lsof -i :4000
# Kill process
kill -9 <PID>

# On Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F
```

**MongoDB connection failed:**
```bash
# Restart MongoDB container
docker-compose restart mongodb

# Check MongoDB logs
docker-compose logs mongodb

# Reset MongoDB (removes data)
docker-compose down -v
docker-compose up
```

---

## 📊 Testing the Application

### Manual Testing Checklist

- [ ] Backend health check: `curl http://localhost:4000/health`
- [ ] Backend events endpoint: `curl http://localhost:4000/api/events/pages`
- [ ] Frontend loads without errors: http://localhost:3000
- [ ] Demo page loads: http://localhost:8000
- [ ] Click demo buttons and see events in backend logs
- [ ] Events appear in dashboard within 5 seconds
- [ ] Sessions list populates
- [ ] Can select session and view journey
- [ ] Can navigate to heatmap
- [ ] Heatmap shows clicks for selected page

### Test API Endpoints

```bash
# Get all sessions
curl http://localhost:4000/api/events/sessions

# Get all pages
curl http://localhost:4000/api/events/pages

# Send a test event
curl -X POST http://localhost:4000/api/events \
  -H "Content-Type: application/json" \
  -d '[{
    "session_id": "test-session-123",
    "event_type": "page_view",
    "page_url": "http://example.com",
    "timestamp": "'$(date -u +'%Y-%m-%dT%H:%M:%SZ')'"
  }]'

# Get session details
curl http://localhost:4000/api/events/session/test-session-123
```

---

## 🔧 Configuration

### Backend Configuration

Edit `backend/.env`:

```env
# Server
PORT=4000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/analytics
# For Docker: mongodb://admin:admin@mongodb:27017/analytics?authSource=admin
# For Atlas: mongodb+srv://user:pass@cluster.mongodb.net/analytics

# Frontend CORS
FRONTEND_URL=http://localhost:3000
```

### Frontend Configuration

Create `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:4000
```

### Tracker Configuration

Edit in your HTML files:

```html
<script>
  window.CF_CONFIG = {
    apiUrl: 'http://localhost:4000',        // Backend API URL
    flushInterval: 3000,                     // Batch send interval (ms)
    batchSize: 10,                           // Events per batch
    sessionTTL: 30 * 60 * 1000              // Session TTL (30 minutes)
  };
</script>
<script src="/path/to/tracker.js"></script>
```

---

## 🐛 Troubleshooting

### Issue: "MongoDB connection failed"

**Solution:**
```bash
# Ensure MongoDB is running
# macOS:
brew services start mongodb-community

# Docker:
docker-compose restart mongodb

# Windows: Check Services app for MongoDB
```

### Issue: "CORS errors in browser"

**Solution:**
1. Update `FRONTEND_URL` in `backend/.env`
2. Restart backend: `npm start` in backend directory
3. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### Issue: "No events appearing in dashboard"

**Checklist:**
- [ ] Backend is running: `curl http://localhost:4000/health`
- [ ] MongoDB is running: `mongosh` and `db.runCommand("ping")`
- [ ] Events are being sent: Check backend logs
- [ ] Dashboard is connected: Check browser Network tab
- [ ] Wait 3-5 seconds after generating events

**Debug:**
```bash
# Check MongoDB data
mongosh
> use analytics
> db.events.countDocuments()
> db.sessions.countDocuments()
> db.events.find().limit(1)
```

### Issue: "Frontend won't start"

**Solution:**
```bash
cd frontend

# Clear cache
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Start with verbose output
npm start -- --verbose
```

### Issue: "Port conflicts"

**Solution:**
```bash
# Change port in backend/.env
PORT=5000

# Change port in frontend/.env (if custom)
# For React dev server, use:
PORT=3001 npm start

# Change demo port
python -m http.server 9000
```

---

## 📈 Next Steps

1. **Explore the dashboard** - Click through sessions and events
2. **Customize the tracker** - Modify `tracker/tracker.js` for custom events
3. **Deploy** - Follow deployment guide in README.md
4. **Scale** - Add WebSockets, authentication, and advanced analytics

---

## 📚 Resources

- [MongoDB Documentation](https://docs.mongodb.com/)
- [Express Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [Docker Documentation](https://docs.docker.com/)
- [GitHub Repository](https://github.com/your-username/analytics-app)

---

## ✅ Verification Checklist

After setup, verify:

- [ ] `http://localhost:4000/health` returns `{status: "ok"}`
- [ ] `http://localhost:3000` loads dashboard
- [ ] `http://localhost:8000/index.html` loads demo page
- [ ] Clicking demo buttons generates events
- [ ] Events appear in dashboard within 5 seconds
- [ ] MongoDB has data: `db.events.countDocuments()`
- [ ] Can view sessions and their journeys
- [ ] Can view heatmap for pages

---

**All Set!** You're ready to use CausalFunnel Analytics. 🎉
