"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const uiBootPath = path.resolve(__dirname, '..', '..', 'ui', 'bootstrap.js');
const sharedPath = path.resolve(__dirname, '..', '..', 'shared', 'ui-bootstrap-shared.ts');
const calls = [];
// Ensure any existing module is cleared
try {
    delete require.cache[require.resolve(uiBootPath)];
}
catch (e) { }
// Insert mock
require.cache[require.resolve(uiBootPath)] = {
    id: uiBootPath,
    filename: uiBootPath,
    loaded: true,
    exports: {
        registerUIGlobals: (obj) => { calls.push(obj); return obj; }
    }
};
// Clear shared module cache and require
try {
    delete require.cache[require.resolve(sharedPath)];
}
catch (e) { }
const s = require(sharedPath);
s.registerUIGlobals({ testKey: 'value' });
console.log('calls.length=', calls.length, 'last=', calls[calls.length - 1]);
process.exit(calls.length >= 1 && calls[calls.length - 1].testKey === 'value' ? 0 : 2);
//# sourceMappingURL=test-shim-forwarding.js.map