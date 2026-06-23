require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const eventsRouter = require('./routes/events');

const app = express();
const PORT = process.env.PORT || 4000;

// --- Middleware ---
app.use(
  cors({
    origin: '*', // tighten in production
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);
app.use(express.json({ limit: '1mb' }));

// --- Routes ---
app.use('/api/events', eventsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// --- DB + Server ---
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/analytics';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(`✅ MongoDB connected: ${MONGO_URI}`);
    app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
