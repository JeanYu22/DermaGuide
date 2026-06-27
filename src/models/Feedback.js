'use strict';

const { Schema, model } = require('mongoose');

/** User feedback on an analysis (drives the re-evaluation loop). */
const FeedbackSchema = new Schema(
  {
    analysis: { type: Schema.Types.ObjectId, ref: 'Analysis', index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    rating: {
      type: String,
      enum: ['totally-agree', 'partially-agree', 'no-idea', 'partially-disagree', 'totally-disagree'],
      required: true,
    },
    comment: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = model('Feedback', FeedbackSchema);
