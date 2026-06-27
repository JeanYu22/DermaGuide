'use strict';

const { Schema, model } = require('mongoose');

const CartItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false }
);

/** One open cart per user. */
const CartSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: { type: [CartItemSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = model('Cart', CartSchema);
