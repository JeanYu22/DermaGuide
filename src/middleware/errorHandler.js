'use strict';

/** Wraps async route handlers so thrown errors reach the error middleware. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error('💥', err);
  res.status(status).json({ error: err.publicMessage || err.message || 'Internal server error' });
}

module.exports = { asyncHandler, errorHandler };
