import CardHandEffects = require('../../logic/card-resolution/hand-effects');

const root = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);

if (root && !root.CardHandEffects) {
    root.CardHandEffects = CardHandEffects;
}

export = CardHandEffects;
