"use strict";
const dist = require('../dist/scripts/evaluate-othello-onnx');

if (require.main === module && dist && typeof dist.main === 'function') {
    dist.main(process.argv.slice(2));
}

module.exports = dist;
