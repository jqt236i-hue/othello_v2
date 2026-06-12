#!/usr/bin/env node
"use strict";

const mod = require("../dist/scripts/build-training-cli");

if (require.main === module) {
  mod.main();
}

module.exports = mod;
