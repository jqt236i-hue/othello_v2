#!/usr/bin/env node
"use strict";

const mod = require("../dist/scripts/capture-refactor-baseline");

if (require.main === module) {
  mod.main();
}

module.exports = mod;
