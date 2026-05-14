"use strict";
/** @type {any} */
const mod = require('../../dist/ui/handlers/match-mode');

try {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  if (root && typeof mod.setupMatchModeControls === 'function') {
    root.setupMatchModeControls = mod.setupMatchModeControls;
    root.MatchMode = mod;
  }
} catch (e) {
  // ignore in non-browser contexts
}

module.exports = mod;
