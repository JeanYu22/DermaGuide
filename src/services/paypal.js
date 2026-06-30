'use strict';

const config = require('../config');

/**
 * Minimal PayPal Orders v2 client. PayPal Smart Buttons handle BOTH PayPal and
 * credit/debit card checkout with this single server integration.
 *
 * Set PAYPAL_CLIENT_ID + PAYPAL_SECRET (+ PAYPAL_ENV=sandbox|live) in .env.
 * Without credentials the storefront falls back to the demo (mock) checkout.
 */

function apiBase() {
  return config.paypal.env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function configured() {
  return Boolean(config.paypal.clientId && config.paypal.secret);
}

async function accessToken() {
  const auth = Buffer.from(`${config.paypal.clientId}:${config.paypal.secret}`).toString('base64');
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  const data = await res.json();
  return data.access_token;
}

/** Create a PayPal order for the given amount. Returns { id }. */
async function createOrder({ amount, currency, reference }) {
  const token = await accessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: reference || undefined,
          amount: { currency_code: currency || config.paypal.currency, value: Number(amount).toFixed(2) },
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal create order failed: ${data?.message || res.status}`);
  return data;
}

/** Capture an approved PayPal order. Returns the capture payload. */
async function captureOrder(orderId) {
  const token = await accessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal capture failed: ${data?.message || res.status}`);
  return data;
}

module.exports = { configured, createOrder, captureOrder, currency: () => config.paypal.currency, clientId: () => config.paypal.clientId, env: () => config.paypal.env };
