import CardPositionSwapEffects = require('../../logic/card-resolution/position-swap');

const root = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);

if (root && !root.CardPositionSwapEffects) {
    root.CardPositionSwapEffects = CardPositionSwapEffects;
}

export = CardPositionSwapEffects;
