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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vm = __importStar(require("vm"));
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function walk(dir) {
    const res = [];
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const p = path.join(dir, f);
        const st = fs.statSync(p);
        if (st.isDirectory()) {
            res.push(...walk(p));
        }
        else if (st.isFile() && p.endsWith('.js')) {
            res.push(p);
        }
    }
    return res;
}
const root = process.cwd();
const jsFiles = walk(root);
const smallFiles = jsFiles.filter(f => fs.statSync(f).size === 0);
if (smallFiles.length) {
    console.log('EMPTY FILES:');
    smallFiles.forEach(f => console.log('  ' + path.relative(root, f)));
}
let errors = [];
for (const f of jsFiles) {
    try {
        const code = fs.readFileSync(f, 'utf8');
        // Try to parse using vm.Script
        new vm.Script(code, { filename: f });
    }
    catch (e) {
        errors.push({ file: path.relative(root, f), message: e.message });
    }
}
if (errors.length) {
    console.log('\nSYNTAX ERRORS:');
    errors.forEach(e => console.log('  ' + e.file + ' -> ' + e.message));
    process.exit(2);
}
else {
    console.log('\nAll JS files parsed OK (no syntax errors detected)');
}
//# sourceMappingURL=check-js-syntax.js.map