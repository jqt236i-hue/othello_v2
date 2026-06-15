declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const CardSystem = _require('../../card-system');

function resolveStateFromGetter(source: any, getterName: string): any | null {
    if (!source || typeof source !== 'object') return null;
    const getter = source[getterName];
    if (typeof getter !== 'function') return null;
    const value = getter();
    return value && typeof value === 'object' ? value : null;
}

function resolveActiveCardState(source: any, fallbackCardState?: any): any | null {
    const injectedCardState = resolveStateFromGetter(source, 'getCardState');
    if (injectedCardState) return injectedCardState;
    if (fallbackCardState && typeof fallbackCardState === 'object') return fallbackCardState;
    return CardSystem && CardSystem.cardState && typeof CardSystem.cardState === 'object'
        ? CardSystem.cardState
        : null;
}

function resolveActiveGameState(source: any, fallbackGameState?: any): any | null {
    const injectedGameState = resolveStateFromGetter(source, 'getGameState');
    if (injectedGameState) return injectedGameState;
    return fallbackGameState && typeof fallbackGameState === 'object'
        ? fallbackGameState
        : null;
}

const CardEffectStateRefs = {
    resolveActiveCardState,
    resolveActiveGameState
};

export = CardEffectStateRefs;
