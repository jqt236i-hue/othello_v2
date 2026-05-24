"use strict";
const dist = require('../dist/scripts/run-othello-onnx-training-loop');

if (require.main === module && dist && typeof dist.main === 'function') {
    dist.main(process.argv.slice(2));
}

module.exports = dist;
