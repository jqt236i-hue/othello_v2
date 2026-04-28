"use strict";
/**
 * @file state-hash.ts
 * @description State hash computation utility
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    }
    else {
        root.StateHash = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    function stableStringify(value) {
        if (value === null)
            return 'null';
        if (typeof value === 'number') {
            return Number.isFinite(value) ? String(value) : 'null';
        }
        if (typeof value === 'boolean')
            return value ? 'true' : 'false';
        if (typeof value === 'string')
            return JSON.stringify(value);
        if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
            return 'null';
        }
        if (Array.isArray(value)) {
            return '[' + value.map(function (entry) {
                return stableStringify(entry);
            }).join(',') + ']';
        }
        if (typeof value === 'object') {
            var keys = Object.keys(value).sort();
            var segments = [];
            for (var index = 0; index < keys.length; index += 1) {
                var key = keys[index];
                var val = value[key];
                if (typeof val === 'undefined' || typeof val === 'function' || typeof val === 'symbol') {
                    continue;
                }
                segments.push(JSON.stringify(key) + ':' + stableStringify(val));
            }
            return '{' + segments.join(',') + '}';
        }
        return JSON.stringify(String(value));
    }
    function computeStableHash(value) {
        var text = stableStringify(value);
        var hash = 2166136261;
        for (var index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return 'fnv1a32:' + (hash >>> 0).toString(16).padStart(8, '0');
    }
    return {
        stableStringify: stableStringify,
        computeStableHash: computeStableHash
    };
}));
//# sourceMappingURL=state-hash.js.map