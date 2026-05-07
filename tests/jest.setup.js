// Jest setup (minimal)
process.env.TEST_ENV = '1';

// Bootstrap CARD_DEFS for tests that require game modules
// game-controller-slim.ts and other modules expect globalThis.CARD_DEFS
try {
  const { CARD_DEFS } = require('../shared-constants');
  if (CARD_DEFS && !globalThis.CARD_DEFS) {
    globalThis.CARD_DEFS = CARD_DEFS;
  }
} catch (e) {
  // If shared-constants is not available, set a minimal fallback
  if (!globalThis.CARD_DEFS) {
    globalThis.CARD_DEFS = [];
  }
}

// Bootstrap CoreLogic for tests that require game logic
// game/move-generator.ts and other modules expect globalThis.CoreLogic
try {
  const coreLogic = require('../game/logic/core');
  if (coreLogic && !globalThis.CoreLogic) {
    globalThis.CoreLogic = coreLogic;
  }
} catch (e) {
  // CoreLogic not available, tests that need it will set it up themselves
}

// Bootstrap TurnPipeline for tests that require turn pipeline
// game/pass-handler.ts and cpu-turn-handler.ts expect globalThis.TurnPipeline
try {
  const turnPipeline = require('../game/turn/turn_pipeline');
  if (turnPipeline && !globalThis.TurnPipeline) {
    globalThis.TurnPipeline = turnPipeline;
  }
} catch (e) {
  // TurnPipeline not available, tests that need it will set it up themselves
}

