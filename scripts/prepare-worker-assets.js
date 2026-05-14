"use strict";
/** @type {any} */
const dist = require('../dist/scripts/prepare-worker-assets');
if (require.main === module) {
    dist.prepareWorkerAssets();
}
module.exports = dist;
