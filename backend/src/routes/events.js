const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Session = require('../models/Session');
const { validateEvent } = require('../middleware/validation');

/**
 * POST /api/events — Ingest one or more events and update session data
 * @body {Object|Array} - Single event object or array of event objects
 */
router.post('/', async (req, res, next) => {
  try {
    const payload = req.body;
    const events = Array.isArray(payload) ? payload : [payload];

    if (events.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No events provided' },
      });
    }

    // Map and validate events
    const docs = events.map((e) => ({
      session_id: e.session_id,
      event_type: e.event_type,
      page_url: e.page_url,
      timestamp: new Date(e.timestamp),
      x: e.x ?? null,
      y: e.y ?? null,
      viewport_width: e.viewport_width ?? null,
      viewport_height: e.viewport_height ?? null,
      user_agent: e.user_agent || req.headers['user-agent'] || null,
    }));

    // Bulk insert events
    const savedEvents = await Event.insertMany(docs, { ordered: false });

    // Update or create session documents
    const sessionUpdates = {};
    docs.forEach((doc) => {
      if (!sessionUpdates[doc.session_id]) {
        sessionUpdates[doc.session_id] = {
          session_id: doc.session_id,
          timestamps: [],
          pages: new Set(),
          page_views: 0,
          clicks: 0,
          user_agent: doc.user_agent,
        };
      }
      sessionUpdates[doc.session_id].timestamps.push(doc.timestamp);
      sessionUpdates[doc.session_id].pages.add(doc.page_url);
      if (doc.event_type === 'page_view') sessionUpdates[doc.session_id].page_views++;
      if (doc.event_type === 'click') sessionUpdates[doc.session_id].clicks++;
    });

    // Bulk update sessions
    for (const [sessionId, data] of Object.entries(sessionUpdates)) {
      await Session.findOneAndUpdate(
        { session_id: sessionId },
        {
          $set: {
            first_event: Math.min(...data.timestamps),
            last_event: Math.max(...data.timestamps),
            user_agent: data.user_agent,
            pages_visited: Array.from(data.pages),
          },
          $inc: {
            event_count: data.page_views + data.clicks,
            page_count: data.page_views,
            click_count: data.clicks,
          },
        },
        { upsert: true, new: true }
      );
    }

    return res.status(201).json({
      success: true,
      data: {
        saved: savedEvents.length,
        sessions_updated: Object.keys(sessionUpdates).length,
      },
    });
  } catch (err) {
    console.error('POST /events error:', err.message);
    next(err);
  }
});

/**
 * GET /api/events/sessions — List all sessions with event counts and metadata
 * @query {limit, skip, sortBy} - Pagination and sorting options
 */
router.get('/sessions', async (req, res, next) => {
  try {
    const { limit = 50, skip = 0, sortBy = 'last_event' } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 500);
    const skipNum = parseInt(skip) || 0;

    const sessions = await Session.find({})
      .sort({ [sortBy]: -1 })
      .limit(limitNum)
      .skip(skipNum)
      .select('-__v')
      .lean();

    const total = await Session.countDocuments();

    return res.json({
      success: true,
      data: sessions,
      pagination: {
        total,
        limit: limitNum,
        skip: skipNum,
      },
    });
  } catch (err) {
    console.error('GET /sessions error:', err.message);
    next(err);
  }
});

/**
 * GET /api/events/session/:sessionId — Fetch complete event journey for a session
 * @param {String} sessionId - Session identifier
 */
router.get('/session/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    // Get session metadata
    const session = await Session.findOne({ session_id: sessionId }).lean();
    if (!session) {
      return res.status(404).json({
        success: false,
        error: { message: 'Session not found' },
      });
    }

    // Get all events in chronological order
    const events = await Event.find({ session_id: sessionId })
      .sort({ timestamp: 1 })
      .select('-__v -updatedAt')
      .lean();

    return res.json({
      success: true,
      data: {
        session,
        events,
      },
    });
  } catch (err) {
    console.error('GET /session/:id error:', err.message);
    next(err);
  }
});

/**
 * GET /api/events/heatmap — Fetch click coordinates for heatmap visualization
 * @query {url} - Page URL to fetch clicks for
 * @query {limit} - Max results (default 5000)
 */
router.get('/heatmap', async (req, res, next) => {
  try {
    const { url } = req.query;
    const { limit = 5000 } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: { message: 'url query parameter is required' },
      });
    }

    const clicks = await Event.find({
      event_type: 'click',
      page_url: url,
      x: { $ne: null },
      y: { $ne: null },
    })
      .select('x y viewport_width viewport_height timestamp -_id')
      .limit(Math.min(parseInt(limit) || 5000, 5000))
      .lean();

    return res.json({
      success: true,
      data: {
        url,
        click_count: clicks.length,
        clicks,
      },
    });
  } catch (err) {
    console.error('GET /heatmap error:', err.message);
    next(err);
  }
});

/**
 * GET /api/events/pages — Fetch distinct pages visited (for heatmap page selector)
 */
router.get('/pages', async (req, res, next) => {
  try {
    const pages = await Event.distinct('page_url');
    const pageStats = await Event.aggregate([
      {
        $group: {
          _id: '$page_url',
          views: { $sum: 1 },
          clicks: {
            $sum: { $cond: [{ $eq: ['$event_type', 'click'] }, 1, 0] },
          },
        },
      },
      { $sort: { views: -1 } },
    ]);

    return res.json({
      success: true,
      data: pageStats,
    });
  } catch (err) {
    console.error('GET /pages error:', err.message);
    next(err);
  }
});

module.exports = router;
