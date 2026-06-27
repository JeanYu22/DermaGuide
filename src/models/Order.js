'use strict';

const { Schema, model } = require('mongoose');

const OrderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    sku: String,
    price: Number,
    quantity: Number,
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [OrderItemSchema], default: [] },
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, required: true },

    status: {
      type: String,
      enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
      index: true,
    },

    shippingAddress: {
      name: String,
      line1: String,
      line2: String,
      city: String,
      region: String,
      postalCode: String,
      country: String,
    },

    // Mock payment reference — swap for a real PSP (Stripe, etc.) in production.
    payment: {
      method: { type: String, default: 'mock' },
      reference: String,
      paidAt: Date,
    },
  },
  { timestamps: true }
);

module.exports = model('Order', OrderSchema);
