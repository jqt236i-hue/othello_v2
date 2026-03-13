/**
 * @file action-log.js
 * @description UI-side storage adapter for ActionManager.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ActionLogStorage = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function canUseStorage() {
        try { return typeof localStorage !== 'undefined'; } catch (e) { return false; }
    }

    function save(key, payload) {
        if (!canUseStorage()) return false;
        localStorage.setItem(key, JSON.stringify(payload, null, 2));
        return true;
    }

    function load(key) {
        if (!canUseStorage()) return null;
        return localStorage.getItem(key);
    }

    function clear(key) {
        if (!canUseStorage()) return false;
        localStorage.removeItem(key);
        return true;
    }

    return { save, load, clear };
}));
