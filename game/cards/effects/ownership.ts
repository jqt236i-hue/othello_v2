import CardOwnershipEffects = require('../../logic/card-resolution/ownership');

const root = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);

if (root && !root.CardOwnershipEffects) {
    root.CardOwnershipEffects = CardOwnershipEffects;
}

export = CardOwnershipEffects;
