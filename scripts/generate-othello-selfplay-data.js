#!/usr/bin/env node
"use strict";

const mod = require("../dist/scripts/generate-othello-selfplay-data");

if (require.main === module) {
  Promise.resolve(mod.main()).catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = mod;
