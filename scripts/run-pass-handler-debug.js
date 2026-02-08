// scripts/run-pass-handler-debug.js
const path = require('path');
const ph = require(path.resolve(__dirname, '..', 'game', 'pass-handler'));

global.cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
global.gameState = { currentPlayer: 1 };
global.TurnPipeline = { applyTurnSafe: (cs, gs, playerKey, action) => ({ ok: true, gameState: gs, cardState: cs, events: [] }) };

(async () => {
  try {
    console.log('Calling handleBlackPassWhenNoMoves');
    try {
      const a = await ph.handleBlackPassWhenNoMoves();
      console.log('handleBlackPassWhenNoMoves ->', a);
    } catch (e) {
      console.error('handleBlackPassWhenNoMoves threw', e && e.stack ? e.stack : e);
    }

    console.log('Calling processPassTurn');
    try {
      const b = await ph.processPassTurn('black', false);
      console.log('processPassTurn ->', b);
    } catch (e) {
      console.error('processPassTurn threw', e && e.stack ? e.stack : e);
    }
  } catch (e) {
    console.error('ERROR:', e && e.stack ? e.stack : e);
    process.exit(2);
  }
})();
