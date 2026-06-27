'use strict';

const { Schema, model } = require('mongoose');

/** Records detected prompt-injection / probing attempts against the chat agent. */
const SecurityLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    ip: { type: String, default: '' },
    type: { type: String, enum: ['system_info', 'privacy', 'hacking'], required: true },
    keyword: { type: String, default: '' },
    message: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = model('SecurityLog', SecurityLogSchema);
