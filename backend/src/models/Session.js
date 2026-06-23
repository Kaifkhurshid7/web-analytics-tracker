const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, unique: true, index: true },
    first_event: { type: Date, required: true },
    last_event: { type: Date, required: true },
    event_count: { type: Number, default: 0 },
    page_count: { type: Number, default: 0 },
    click_count: { type: Number, default: 0 },
    pages_visited: [{ type: String }],
    user_agent: { type: String },
  },
  { timestamps: true }
);

// index for listing sessions by recency
sessionSchema.index({ last_event: -1 });

module.exports = mongoose.model('Session', sessionSchema);
