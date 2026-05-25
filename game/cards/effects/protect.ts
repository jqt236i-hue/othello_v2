import CardProtectEffects = require('../../logic/card-resolution/protect');

const root = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);

if (root && !root.CardProtectEffects) {
    root.CardProtectEffects = CardProtectEffects;
}

export = CardProtectEffects;
