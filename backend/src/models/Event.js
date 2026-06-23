const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, index: true },
    event_type: { type: String, required: true, enum: ['page_view', 'click'] },
    page_url: { type: String, required: true },
    timestamp: { type: Date, required: true },
    // click-specific
    x: { type: Number },
    y: { type: Number },
    // viewport dimensions for normalizing heatmap
    viewport_width: { type: Number },
    viewport_height: { type: Number },
    // optional enrichment
    user_agent: { type: String },
  },
  { timestamps: true }
);

// compound index for efficient per-session queries
eventSchema.index({ session_id: 1, timestamp: 1 });
// index for heatmap queries
eventSchema.index({ event_type: 1, page_url: 1 });

module.exports = mongoose.model('Event', eventSchema);
