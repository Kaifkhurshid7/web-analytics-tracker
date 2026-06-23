const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// POST /api/events — ingest one or more events
router.post('/', async (req, res) => {
  try {
    const payload = req.body;
    const events = Array.isArray(payload) ? payload : [payload];

    const docs = events.map((e) => ({
      session_id: e.session_id,
      event_type: e.event_type,
      page_url: e.page_url,
      timestamp: new Date(e.timestamp),
      x: e.x ?? null,
      y: e.y ?? null,
      viewport_width: e.viewport_width ?? null,
      viewport_height: e.viewport_height ?? null,
      user_agent: req.headers['user-agent'] ?? null,
    }));

    await Event.insertMany(docs, { ordered: false });
    return res.status(201).json({ saved: docs.length });
  } catch (err) {
    console.error('POST /events error:', err.message);
    return res.status(500).json({ error: 'Failed to save events' });
  }
});

// GET /api/events/sessions — list all sessions with event counts + last seen
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await Event.aggregate([
      {
        $group: {
          _id: '$session_id',
          total_events: { $sum: 1 },
          page_views: {
            $sum: { $cond: [{ $eq: ['$event_type', 'page_view'] }, 1, 0] },
          },
          clicks: {
            $sum: { $cond: [{ $eq: ['$event_type', 'click'] }, 1, 0] },
          },
          first_seen: { $min: '$timestamp' },
          last_seen: { $max: '$timestamp' },
          pages_visited: { $addToSet: '$page_url' },
        },
      },
      { $sort: { last_seen: -1 } },
      {
        $project: {
          session_id: '$_id',
          _id: 0,
          total_events: 1,
          page_views: 1,
          clicks: 1,
          first_seen: 1,
          last_seen: 1,
          pages_count: { $size: '$pages_visited' },
        },
      },
    ]);

    return res.json(sessions);
  } catch (err) {
    console.error('GET /sessions error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/events/session/:sessionId — full event journey for a session
router.get('/session/:sessionId', async (req, res) => {
  try {
    const events = await Event.find({ session_id: req.params.sessionId })
      .sort({ timestamp: 1 })
      .select('-__v -updatedAt')
      .lean();

    return res.json(events);
  } catch (err) {
    console.error('GET /session/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch session events' });
  }
});

// GET /api/events/heatmap?url=<encoded_url> — click coords for a given page
router.get('/heatmap', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url query param required' });

    const clicks = await Event.find({
      event_type: 'click',
      page_url: url,
      x: { $ne: null },
      y: { $ne: null },
    })
      .select('x y viewport_width viewport_height timestamp -_id')
      .lean();

    return res.json(clicks);
  } catch (err) {
    console.error('GET /heatmap error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

// GET /api/events/pages — distinct pages seen (for heatmap selector)
router.get('/pages', async (req, res) => {
  try {
    const pages = await Event.distinct('page_url');
    return res.json(pages.sort());
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch pages' });
  }
});

module.exports = router;
