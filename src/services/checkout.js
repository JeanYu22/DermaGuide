'use strict';

const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');

const TAX_RATE = 0.08;
const FREE_SHIPPING_THRESHOLD = 50;
const SHIPPING_FEE = 5.99;

/** Price the current cart (authoritative DB prices) without mutating anything. */
async function quoteCart(userId) {
  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  const items = (cart?.items || []).filter((i) => i.product);
  if (!items.length) return null;

  const orderItems = items.map((i) => ({
    product: i.product._id,
    name: i.product.name,
    sku: i.product.sku,
    price: i.product.price,
    quantity: i.quantity,
  }));
  const subtotal = +orderItems.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2);
  const tax = +(subtotal * TAX_RATE).toFixed(2);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = +(subtotal + tax + shipping).toFixed(2);

  return { cart, items, orderItems, subtotal, tax, shipping, total };
}

/**
 * Turn the cart into a paid order: verify stock, create the order, decrement
 * stock, and clear the cart. `payment` describes how it was paid.
 */
async function finalizeOrder(userId, payment, shippingAddress) {
  const q = await quoteCart(userId);
  if (!q) throw Object.assign(new Error('Your cart is empty'), { status: 400 });

  for (const i of q.items) {
    if (i.product.stock < i.quantity) {
      throw Object.assign(new Error(`Not enough stock for ${i.product.name}`), { status: 409 });
    }
  }

  const order = await Order.create({
    user: userId,
    items: q.orderItems,
    subtotal: q.subtotal,
    tax: q.tax,
    shipping: q.shipping,
    total: q.total,
    status: 'paid',
    shippingAddress: shippingAddress || {},
    payment: { paidAt: new Date(), ...payment },
  });

  await Promise.all(q.items.map((i) => Product.updateOne({ _id: i.product._id }, { $inc: { stock: -i.quantity } })));
  q.cart.items = [];
  await q.cart.save();
  return order;
}

module.exports = { quoteCart, finalizeOrder, TAX_RATE, FREE_SHIPPING_THRESHOLD, SHIPPING_FEE };
