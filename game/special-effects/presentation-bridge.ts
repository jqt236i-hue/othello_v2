declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const ControllerEvents = _require('../controller-events');
const SharedBoardUtils = _require('../../shared/shared-board-utils');
const SharedConstants = _require('../../shared-constants');

if (!SharedBoardUtils ||
    typeof SharedBoardUtils.createBoardContext !== 'function' ||
    typeof SharedBoardUtils.getCellValue !== 'function') {
    throw new Error('SharedBoardUtils BoardContext reader is required by SpecialEffectsPresentationBridge');
}
if (!SharedConstants ||
    SharedConstants.BLACK === undefined ||
    SharedConstants.WHITE === undefined) {
    throw new Error('SharedConstants owner values are required by SpecialEffectsPresentationBridge');
}

let timers: any = null;
try { timers = _require('../timers'); } catch (e) { timers = null; }

const moduleImpls: Record<string, Record<string, any>> = {};

function getModuleImpl(moduleName: string): Record<string, any> {
    const impl = moduleImpls[moduleName];
    return impl && typeof impl === 'object' ? impl : {};
}

function setUIImpl(moduleName: string, nextImpl: any): Record<string, any> {
    moduleImpls[moduleName] = (nextImpl && typeof nextImpl === 'object')
        ? Object.assign({}, nextImpl)
        : {};
    return getModuleImpl(moduleName);
}

function readFunction(moduleName: string, name: string): Function | null {
    const candidate = getModuleImpl(moduleName)[name];
    return typeof candidate === 'function' ? candidate : null;
}

function readBoardOwner(gameStateRef: any, cardStateRef: any, row: number, col: number): number | null {
    const context = SharedBoardUtils.createBoardContext(gameStateRef, cardStateRef);
    const owner = SharedBoardUtils.getCellValue(context, row, col);
    return owner === SharedConstants.BLACK || owner === SharedConstants.WHITE
        ? owner
        : null;
}

function emitLogAdded(moduleName: string, message: any, kind?: any): boolean {
    const injected = readFunction(moduleName, 'emitLogAdded');
    if (injected) {
        try {
            if (typeof kind === 'undefined') injected(message);
            else injected(message, kind);
            return true;
        } catch (e) { /* ignore */ }
    }
    if (ControllerEvents && typeof ControllerEvents.emitLogAdded === 'function') {
        try {
            if (typeof kind === 'undefined') ControllerEvents.emitLogAdded(message);
            else ControllerEvents.emitLogAdded(message, kind);
            return true;
        } catch (e) { /* ignore */ }
    }
    return false;
}

function emitBoardUpdate(moduleName: string): boolean {
    const injected = readFunction(moduleName, 'emitBoardUpdate');
    if (injected) {
        try { return injected() === true; } catch (e) { /* ignore */ }
    }
    if (ControllerEvents && typeof ControllerEvents.emitBoardUpdate === 'function') {
        try { return ControllerEvents.emitBoardUpdate() === true; } catch (e) { /* ignore */ }
    }
    return false;
}

function emitGameStateChange(moduleName: string): boolean {
    const injected = readFunction(moduleName, 'emitGameStateChange');
    if (injected) {
        try { return injected() === true; } catch (e) { /* ignore */ }
    }
    if (ControllerEvents && typeof ControllerEvents.emitGameStateChange === 'function') {
        try { return ControllerEvents.emitGameStateChange() === true; } catch (e) { /* ignore */ }
    }
    return false;
}

function emitCardStateChange(moduleName: string): boolean {
    const injected = readFunction(moduleName, 'emitCardStateChange');
    if (injected) {
        try { return injected() === true; } catch (e) { /* ignore */ }
    }
    if (ControllerEvents && typeof ControllerEvents.emitCardStateChange === 'function') {
        try { return ControllerEvents.emitCardStateChange() === true; } catch (e) { /* ignore */ }
    }
    return false;
}

function getPlayerName(moduleName: string, player: any, fallback: ((player: any) => string) | null): string {
    const injected = readFunction(moduleName, 'getPlayerName');
    if (injected) {
        try { return String(injected(player)); } catch (e) { /* ignore */ }
    }
    if (typeof fallback === 'function') return fallback(player);
    return String(player);
}

function hasPlaybackEngine(moduleName: string): boolean {
    const hasPlaybackEngineFn = readFunction(moduleName, 'hasPlaybackEngine');
    if (hasPlaybackEngineFn) {
        try { return hasPlaybackEngineFn() === true; } catch (e) { /* ignore */ }
    }
    return !!readFunction(moduleName, 'playPresentationEvents');
}

function getAnimationTiming(moduleName: string, key: string): any {
    const injected = readFunction(moduleName, 'getAnimationTiming');
    if (!injected) return undefined;
    try { return injected(key); } catch (e) { /* ignore */ }
    return undefined;
}

function animateFadeOutAt(moduleName: string, row: number, col: number, options?: any): Promise<any> {
    const injected = readFunction(moduleName, 'animateFadeOutAt');
    if (!injected) return Promise.resolve();
    try {
        if (typeof options === 'undefined') return Promise.resolve(injected(row, col));
        return Promise.resolve(injected(row, col, options));
    } catch (e) { /* ignore */ }
    return Promise.resolve();
}

function animateDestroyAt(moduleName: string, row: number, col: number, options?: any): Promise<any> {
    const injected = readFunction(moduleName, 'animateDestroyAt');
    if (!injected) return Promise.resolve();
    try {
        if (typeof options === 'undefined') return Promise.resolve(injected(row, col));
        return Promise.resolve(injected(row, col, options));
    } catch (e) { /* ignore */ }
    return Promise.resolve();
}

function animateHyperactiveMove(moduleName: string, from: any, to: any): Promise<any> {
    const injected = readFunction(moduleName, 'animateHyperactiveMove');
    if (!injected) return Promise.resolve();
    try { return Promise.resolve(injected(from, to)); } catch (e) { /* ignore */ }
    return Promise.resolve();
}

function animateHyperactiveMoveChain(moduleName: string, moves: any[]): Promise<any> {
    const injected = readFunction(moduleName, 'animateHyperactiveMoveChain');
    if (!injected) return Promise.resolve();
    try { return Promise.resolve(injected(moves)); } catch (e) { /* ignore */ }
    return Promise.resolve();
}

function setDiscColorAt(moduleName: string, row: number, col: number, color: number): any {
    const injected = readFunction(moduleName, 'setDiscColorAt');
    if (!injected) return undefined;
    try { return injected(row, col, color); } catch (e) { /* ignore */ }
    return undefined;
}

function removeBombOverlayAt(moduleName: string, row: number, col: number): any {
    const injected = readFunction(moduleName, 'removeBombOverlayAt');
    if (!injected) return undefined;
    try { return injected(row, col); } catch (e) { /* ignore */ }
    return undefined;
}

function removeRegenOverlayAt(moduleName: string, row: number, col: number): Promise<any> {
    const injected = readFunction(moduleName, 'removeRegenOverlayAt');
    if (!injected) return Promise.resolve();
    try { return Promise.resolve(injected(row, col)); } catch (e) { /* ignore */ }
    return Promise.resolve();
}

function playAnimationEvents(moduleName: string, events: any[]): Promise<any> {
    const injected = readFunction(moduleName, 'playAnimationEvents');
    if (!injected) return Promise.resolve();
    try { return Promise.resolve(injected(events)); } catch (e) { /* ignore */ }
    return Promise.resolve();
}

function waitMs(moduleName: string, ms: number): Promise<any> {
    const injected = readFunction(moduleName, 'waitMs');
    if (injected) {
        try { return Promise.resolve(injected(ms)); } catch (e) { /* ignore */ }
    }
    if (timers && typeof timers.waitMs === 'function') return timers.waitMs(ms);
    return Promise.resolve();
}

function requestFrame(moduleName: string): Promise<any> {
    const injected = readFunction(moduleName, 'requestFrame');
    if (injected) {
        try { return Promise.resolve(injected()); } catch (e) { /* ignore */ }
    }
    if (timers && typeof timers.requestFrame === 'function') return timers.requestFrame();
    return Promise.resolve();
}

function emitPresentationEvent(moduleName: string, cardStateRef: any, event: any): boolean {
    const injected = readFunction(moduleName, 'emitPresentationEvent');
    if (injected) {
        try { return injected(event) === true; } catch (e) { /* ignore */ }
    }
    try {
        const presentation = _require('../logic/presentation');
        if (presentation && typeof presentation.emitPresentationEvent === 'function') {
            return presentation.emitPresentationEvent(cardStateRef, event) === true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

module.exports = {
    setUIImpl,
    readFunction,
    readBoardOwner,
    emitLogAdded,
    emitBoardUpdate,
    emitGameStateChange,
    emitCardStateChange,
    getPlayerName,
    hasPlaybackEngine,
    getAnimationTiming,
    animateFadeOutAt,
    animateDestroyAt,
    animateHyperactiveMove,
    animateHyperactiveMoveChain,
    setDiscColorAt,
    removeBombOverlayAt,
    removeRegenOverlayAt,
    playAnimationEvents,
    waitMs,
    requestFrame,
    emitPresentationEvent
};

export {};
