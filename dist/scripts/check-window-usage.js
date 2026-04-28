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
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const root = path.resolve(__dirname, '..');
function shouldCheck(filePath) {
    // Only check server-side / logic code where window usage is forbidden.
    // Allow UI and scripts to use window intentionally.
    const allowedTargets = [
        'game/', 'cpu/', 'logic/', 'src/', 'card-system.js', 'sound-engine.js', 'is-env-capable.js'
    ];
    for (const t of allowedTargets) {
        if (filePath.indexOf(t) === 0)
            return true;
    }
    return false;
}
function walk(dir) {
    const results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results.push(...walk(filePath));
        }
        else {
            results.push(filePath);
        }
    });
    return results;
}
const files = walk(root).filter(f => f.endsWith('.js'));
const violations = [];
for (const f of files) {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    if (!shouldCheck(rel))
        continue;
    let content = '';
    try {
        content = fs.readFileSync(f, 'utf8');
    }
    catch (e) {
        continue;
    }
    const res = [
        { re: /\bwindow\./g, label: 'window.' },
        { re: /\bdocument\./g, label: 'document.' },
        { re: /require\(\s*['"]\.\.\/ui\/bootstrap['"]\s*\)/g, label: "require('../ui/bootstrap')" }
    ];
    for (const { re, label } of res) {
        let m;
        while ((m = re.exec(content)) !== null) {
            // report each occurrence with line number
            const pos = m.index;
            const before = content.slice(0, pos);
            const line = before.split('\n').length;
            violations.push({ file: rel, line, label });
        }
    }
}
if (violations.length > 0) {
    console.error('\n[STATIC-CHECK] Forbidden usage found in non-UI files:');
    violations.forEach(v => console.error(` - ${v.file}:${v.line} (${v.label})`));
    console.error('\nPlease register UI globals via `ui/bootstrap.registerUIGlobals` or migrate to UIBootstrap.');
    process.exit(2);
}
console.log('[STATIC-CHECK] No forbidden window usage found.');
process.exit(0);
//# sourceMappingURL=check-window-usage.js.map