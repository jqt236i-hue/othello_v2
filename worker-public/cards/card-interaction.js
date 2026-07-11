"use strict";
/** @type {any} */
const cardInteraction = require('../dist/cards/card-interaction');

// Jest imports this legacy wrapper directly. The browser installs the same
// compatibility globals through entry-browser.js after loading the controller.
if (process.env.JEST_WORKER_ID && cardInteraction && typeof cardInteraction.initializeCardInteractionRuntime === 'function') {
    cardInteraction.initializeCardInteractionRuntime(global.window || null);
}

module.exports = cardInteraction;
