"use strict";

module.exports = process.env.JEST_WORKER_ID
    ? require("../../../src/engine/selfplay-runner.ts")
    : require("../../../src/engine/selfplay-runner.js");
