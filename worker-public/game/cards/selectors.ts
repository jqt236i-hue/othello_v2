/**
 * @file selectors.ts
 * @description Selector orchestrator wrapper (delegates to game/logic/cards/selectors.js)
 */

declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}

const SelectorsModule = _require('../../logic/cards/selectors');
export = SelectorsModule;
