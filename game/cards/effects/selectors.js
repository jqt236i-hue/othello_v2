/**
 * @file selectors.js
 * @description Selector orchestrator wrapper (delegates to game/logic/cards/selectors.js)
 */

'use strict';

const SelectorsModule = require('../../logic/cards/selectors');

module.exports = {
    ...SelectorsModule
};
