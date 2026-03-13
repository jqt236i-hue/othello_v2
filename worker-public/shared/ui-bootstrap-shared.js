// Minimal shared UI bootstrap shim for game<->ui boundary
(function(){
'use strict';
let _registry = {};
function registerUIGlobals(obj){
    _registry = Object.assign(_registry, obj || {});
    // Compatibility: forward registrations to ui/bootstrap when available (safe, optional)
    try {
        if (typeof require === 'function') {
            try {
                const uiBoot = require('../ui/bootstrap');
                if (uiBoot && typeof uiBoot.registerUIGlobals === 'function') {
                    try { uiBoot.registerUIGlobals(obj || {}); } catch (e) { /* ignore */ }
                }
            } catch (e) { /* missing ui/bootstrap in headless mode - ignore */ }
        }
    } catch (e) { /* ignore */ }
    return _registry;
}
function getRegisteredUIGlobals(){ return Object.assign({}, _registry); }
if (typeof module !== 'undefined' && module.exports){ module.exports = { registerUIGlobals, getRegisteredUIGlobals }; }
// Expose to global for legacy consumers only if safe (no DOM ops)
try{ if (typeof globalThis !== 'undefined') globalThis.SharedUIBootstrap = { registerUIGlobals, getRegisteredUIGlobals}; }catch(e){}
})();
