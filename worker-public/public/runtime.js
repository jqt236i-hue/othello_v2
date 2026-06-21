/**
 * Browser CommonJS Runtime
 * Provides module, exports, require for classic <script> tags.
 * Module registry is populated by public/module-registry.js (generated).
 */
(function () {
    'use strict';

    var registry = {};
    var aliases = {};
    var cache = {};
    var currentDir = '';

    window.module = { exports: {} };
    window.exports = window.module.exports;

    var builtins = {
        'path': {
            join: function () {
                var parts = [];
                for (var i = 0; i < arguments.length; i++) {
                    if (arguments[i] == null) continue;
                    parts.push(String(arguments[i]).replace(/\\/g, '/'));
                }
                return parts.join('/').replace(/\/+/g, '/');
            },
            resolve: function () { return Array.prototype.join.call(arguments, '/'); },
            dirname: function (p) {
                p = String(p || '').replace(/\\/g, '/');
                var idx = p.lastIndexOf('/');
                return idx >= 0 ? p.substring(0, idx) : '.';
            },
            sep: '/'
        }
    };

    window.__cjsResolvePath = function(id, base) {
        return resolveDistPath(id, base || currentDir);
    };

    window.require = function (id, dir) {
        if (builtins.hasOwnProperty(id)) return builtins[id];

        var base = typeof dir === 'string' ? dir : currentDir;
        var resolved = resolveModuleAlias(resolveDistPath(id, base));

        if (cache.hasOwnProperty(resolved)) return cache[resolved];

        var factory = registry[resolved];
        if (!factory) {
            throw new Error('[cjs-runtime] Module not found: ' + resolved);
        }

        var prevM = window.module, prevE = window.exports, prevD = currentDir;
        var mod = { exports: {} };
        var modDir = dirName(resolved);
        window.module = mod;
        window.exports = mod.exports;
        currentDir = modDir;

        // NOTE: require() is NOT passed as argument; it resolves through window.require (global scope)
        try { factory.call(null, mod, mod.exports, modDir, modDir + '.js'); }
        finally { window.module = prevM; window.exports = prevE; currentDir = prevD; }

        cache[resolved] = mod.exports;
        return mod.exports;
    };

    window.__cjsRegister = function (key, sourceCode) {
        // sourceCode is a JS string literal that was JSON.stringify'd in the build script,
        // then decoded by the JS engine when parsing the registry file.
        // It is already the raw module source (no JSON.parse needed).
        // NOTE: 'require' is NOT a parameter to avoid conflicts with
        // `const require = (this && this.require || ...)` in TS-compiled modules.
        // Module code resolves require() and __non_webpack_require__ through globals.
        registry[key] = new Function('module', 'exports', '__dirname', '__filename', sourceCode);
    };
    window.__cjsAlias = function (aliasKey, targetKey) {
        if (!aliasKey || !targetKey) return;
        aliases[String(aliasKey)] = String(targetKey);
    };
    window.__non_webpack_require__ = window.require;

    // __dirname resolved from current script src
    Object.defineProperty(window, '__dirname', {
        get: function () {
            try {
                var cs = document.currentScript;
                if (cs && cs.src) {
                    var u = new URL(cs.src, location.href);
                    var p = u.pathname;
                    var idx = p.lastIndexOf('/');
                    return idx >= 0 ? p.substring(0, idx) : '';
                }
            } catch (e) {}
            return currentDir || '.';
        },
        configurable: true
    });

    function resolveDistPath(id, base) {
        id = String(id).replace(/\\/g, '/');
        base = String(base || '').replace(/\\/g, '/');

        var distIdx = id.indexOf('dist/');
        if (distIdx >= 0) return id.substring(distIdx + 5);
        if (id.indexOf('dist/.') === 0) return id.substring(6);

        if (id.charAt(0) === '.') {
            var baseParts = base ? base.split('/').filter(Boolean) : [];
            var idParts = id.split('/');
            for (var i = 0; i < idParts.length; i++) {
                if (idParts[i] === '..') baseParts.pop();
                else if (idParts[i] !== '.' && idParts[i] !== '') baseParts.push(idParts[i]);
            }
            return baseParts.join('/');
        }
        return id;
    }

    function resolveModuleAlias(key) {
        var current = String(key || '');
        var seen = {};
        while (aliases.hasOwnProperty(current) && !seen[current]) {
            seen[current] = true;
            current = aliases[current];
        }
        return current;
    }

    function dirName(p) { var i = p.lastIndexOf('/'); return i >= 0 ? p.substring(0, i) : ''; }
})();
