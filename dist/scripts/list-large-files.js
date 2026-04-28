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
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
    const i = argv.indexOf(name);
    if (i === -1)
        return fallback;
    return argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const LIMIT = Number(arg('--limit', 20));
const MIN_MB = Number(arg('--minMB', 0));
const excludeArg = arg('--exclude', null);
const cwd = process.cwd();
const defaultExcludes = new Set(['.git', 'node_modules', '.venv', 'dist', 'build', 'out', 'data']);
if (excludeArg)
    excludeArg.split(',').forEach((s) => defaultExcludes.add(s.trim()));
function walk(dir, list) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch (e) {
        return;
    }
    for (const ent of entries) {
        if (defaultExcludes.has(ent.name))
            continue;
        const full = path.join(dir, ent.name);
        try {
            if (ent.isDirectory()) {
                walk(full, list);
            }
            else if (ent.isFile()) {
                let st;
                try {
                    st = fs.statSync(full);
                }
                catch (e) {
                    continue;
                }
                list.push({ path: path.relative(cwd, full).replace(/\\/g, '/'), size: st.size });
            }
        }
        catch (e) { /* ignore permission errors etc */ }
    }
}
const list = [];
walk(cwd, list);
list.sort((a, b) => b.size - a.size);
const rows = list.filter(r => r.size >= MIN_MB * 1024 * 1024).slice(0, LIMIT);
console.log(`Top ${rows.length} files (excluding ${Array.from(defaultExcludes).join(', ')})`);
for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const mb = (r.size / (1024 * 1024)).toFixed(2);
    console.log(`${String(i + 1).padStart(2)}. ${mb} MB — ${r.path}`);
}
if (rows.length === 0)
    console.log('(no files matched the criteria)');
//# sourceMappingURL=list-large-files.js.map