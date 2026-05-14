"use strict";
/** @type {any} */
const api = process.env.JEST_WORKER_ID
  ? require('./network-client.ts')
  : require('../dist/ui/network-client');
try {
  if (typeof globalThis !== 'undefined') globalThis.NetworkMatchClient = api;
} catch (e) { /* ignore */ }
try {
  if (typeof window !== 'undefined') window.NetworkMatchClient = api;
} catch (e) { /* ignore */ }
module.exports = api;
