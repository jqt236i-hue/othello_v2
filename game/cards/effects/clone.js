/**
 * @file clone.js
 * @description Clone/Split effects wrapper (delegates to game/logic/cards/clone.js)
 */

'use strict';

const CloneModule = require('../../logic/cards/clone');

module.exports = {
    applyCloneWill: CloneModule.applyCloneWill,
    applySplitWill: CloneModule.applySplitWill
};
