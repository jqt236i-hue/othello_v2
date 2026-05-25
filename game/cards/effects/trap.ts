import CardTrapEffects = require('../../logic/card-resolution/trap');

const root = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);

if (root && !root.CardTrapEffects) {
    root.CardTrapEffects = CardTrapEffects;
}

export = CardTrapEffects;
