import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const ph = require(path.resolve(__dirname, '..', 'game', 'pass-handler'));

(global as any).cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
(global as any).gameState = { currentPlayer: 1 };
(global as any).TurnPipeline = { applyTurnSafe: (cs: any, gs: any, playerKey: any, action: any) => ({ ok: true, gameState: gs, cardState: cs, events: [] }) };

(async () => {
  try {
    console.log('Calling handleBlackPassWhenNoMoves');
    try {
      const a = await ph.handleBlackPassWhenNoMoves();
      console.log('handleBlackPassWhenNoMoves ->', a);
    } catch (e: any) {
      console.error('handleBlackPassWhenNoMoves threw', e && e.stack ? e.stack : e);
    }

    console.log('Calling processPassTurn');
    try {
      const b = await ph.processPassTurn('black', false);
      console.log('processPassTurn ->', b);
    } catch (e: any) {
      console.error('processPassTurn threw', e && e.stack ? e.stack : e);
    }
  } catch (e: any) {
    console.error('ERROR:', e && e.stack ? e.stack : e);
    process.exit(2);
  }
})();
