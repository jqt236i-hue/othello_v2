/**
 * @file targets.js
 * @description Target helpers wrapper (delegates to game/logic/cards/targets.js)
 */

'use strict';

const TargetsModule = require('../../logic/cards/targets');

module.exports = {
    ...TargetsModule
};
