#!/usr/bin/env node
'use strict';

const mod = require('../../dist/scripts/perf/measure-network-special-stone-late-game');

if (require.main === module) {
  mod.main().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
}

module.exports = mod;
