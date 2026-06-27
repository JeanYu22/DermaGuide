'use strict';

const mongoose = require('mongoose');
const config = require('../config');

let connected = false;

/**
 * Connect to MongoDB. Idempotent — safe to call from server start and seed.
 */
async function connect() {
  if (connected) return mongoose.connection;

  mongoose.set('strictQuery', true);

  await mongoose.connect(config.mongo.uri, {
    dbName: config.mongo.db,
    serverSelectionTimeoutMS: 8000,
  });

  connected = true;
  console.log(`🗄️  MongoDB connected: ${config.mongo.uri}/${config.mongo.db}`);
  return mongoose.connection;
}

async function disconnect() {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

module.exports = { connect, disconnect, mongoose };
