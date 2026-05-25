import CardStatusCellsEffects = require('../../logic/card-resolution/status-cells');

const root = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);

if (root && !root.CardStatusCellsEffects) {
    root.CardStatusCellsEffects = CardStatusCellsEffects;
}

export = CardStatusCellsEffects;
