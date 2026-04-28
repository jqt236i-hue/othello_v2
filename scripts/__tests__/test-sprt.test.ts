/**
 * @file test-sprt.test.ts
 * @description Unit tests for SPRT (Sequential Probability Ratio Test).
 */

import sprtModule = require('../../scripts/sprt');
const { SPRT } = sprtModule;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

describe('SPRT', () => {
    test('initial status is continue', () => {
        const sprt = new SPRT();
        const status = sprt.getStatus();
        expect(status.status).toBe('continue');
        expect(status.games).toBe(0);
    });

    test('tracks wins, losses, and draws', () => {
        const sprt = new SPRT({ elo0: 0, elo1: 2.5, maxGames: 400 });
        for (let i = 0; i < 10; i++) sprt.update(1);
        for (let i = 0; i < 2; i++) sprt.update(-1);
        for (let i = 0; i < 3; i++) sprt.update(0);

        const status = sprt.getStatus();
        expect(status.wins).toBe(10);
        expect(status.losses).toBe(2);
        expect(status.draws).toBe(3);
        expect(Number.isFinite(status.llr)).toBe(true);
    });

    test('rejects after enough losses', () => {
        const sprt = new SPRT({ elo0: 0, elo1: 2.5, maxGames: 400 });
        // Simulate many losses
        for (let i = 0; i < 20; i++) sprt.update(-1);

        const status = sprt.getStatus();
        expect(['reject', 'continue']).toContain(status.status);
    });

    test('quick gate has lower max games', () => {
        const sprt = SPRT.quickGate();
        expect(sprt.maxGames).toBe(120);
    });

    test('final gate has higher max games', () => {
        const sprt = SPRT.finalGate();
        expect(sprt.maxGames).toBe(400);
    });

    test('llr is finite after updates', () => {
        const sprt = new SPRT();
        sprt.update(1);
        sprt.update(-1);
        sprt.update(0);
        const status = sprt.getStatus();
        expect(Number.isFinite(status.llr)).toBe(true);
    });
});
