/**
 * Request validation middleware
 */

const validateEvent = (req, res, next) => {
  const { session_id, event_type, page_url, timestamp } = req.body;

  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'session_id is required and must be a string' },
    });
  }

  if (!event_type || !['page_view', 'click'].includes(event_type)) {
    return res.status(400).json({
      success: false,
      error: { message: 'event_type must be "page_view" or "click"' },
    });
  }

  if (!page_url || typeof page_url !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'page_url is required and must be a string' },
    });
  }

  if (!timestamp) {
    return res.status(400).json({
      success: false,
      error: { message: 'timestamp is required' },
    });
  }

  // For click events, validate coordinates
  if (event_type === 'click') {
    if (typeof req.body.x !== 'number' || typeof req.body.y !== 'number') {
      return res.status(400).json({
        success: false,
        error: { message: 'click events must include x and y coordinates' },
      });
    }
  }

  next();
};

module.exports = {
  validateEvent,
};
