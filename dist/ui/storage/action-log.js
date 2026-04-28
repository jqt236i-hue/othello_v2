"use strict";
/**
 * @file action-log.ts
 * @description UI-side storage adapter for ActionManager.
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function canUseStorage() {
    try {
        return typeof localStorage !== 'undefined';
    }
    catch (e) {
        return false;
    }
}
function save(key, payload) {
    if (!canUseStorage())
        return false;
    localStorage.setItem(key, JSON.stringify(payload, null, 2));
    return true;
}
function load(key) {
    if (!canUseStorage())
        return null;
    return localStorage.getItem(key);
}
function clear(key) {
    if (!canUseStorage())
        return false;
    localStorage.removeItem(key);
    return true;
}
module.exports = {
    save,
    load,
    clear
};
//# sourceMappingURL=action-log.js.map