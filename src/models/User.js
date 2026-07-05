'use strict';

const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: '' },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },

    // Lightweight skincare profile, populated from analyses / chat.
    skinProfile: {
      skinType: { type: String, default: '' },
      concerns: { type: [String], default: [] },
    },

    // Explicit preferences the user edits in their profile — one input to the
    // recommender for users who haven't run a skin analysis.
    preferences: {
      skinType: { type: String, default: '' },
      concerns: { type: [String], default: [] },
      categories: { type: [String], default: [] }, // product types they like
    },

    // Implicit signal: recently viewed product ids (newest first, capped).
    recentViews: { type: [String], default: [] },
  },
  { timestamps: true }
);

UserSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

UserSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

UserSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    email: this.email,
    name: this.name,
    role: this.role,
    skinProfile: this.skinProfile,
    preferences: this.preferences,
  };
};

module.exports = model('User', UserSchema);
