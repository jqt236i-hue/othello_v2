import CardSpawnAndFlip = require('./spawn-and-flip-core');

const compatibilityRoot = typeof self !== 'undefined'
    ? (self as unknown as Record<string, unknown>)
    : (typeof global !== 'undefined' ? (global as unknown as Record<string, unknown>) : null);

if (compatibilityRoot) {
    compatibilityRoot.CardSpawnAndFlip = CardSpawnAndFlip;
}

export = CardSpawnAndFlip;
