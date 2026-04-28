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
const { parseArgs, safeParseJson, makeDefaultOutputPath, isIgnorableArtifactForDeepcfr } = require('../scripts/preflight-deepcfr-training');
describe('deepcfr preflight script', () => {
    test('parseArgs supports strict and allow-artifacts', () => {
        const args = parseArgs([
            '--python', '.venv/Scripts/python.exe',
            '--check-script', 'ai/train/check_deepcfr_env.py',
            '--allow-artifacts',
            '--skip-check-window',
            '--strict',
            '--deepcfr-dir', 'data/deepcfr-x',
            '--config', 'data/deepcfr-x/deepcfr_config.active.yaml',
            '--out', 'data/runs/deepcfr.preflight.custom.json'
        ]);
        expect(args.pythonPath.endsWith(path.join('.venv', 'Scripts', 'python.exe'))).toBe(true);
        expect(args.checkScriptPath.endsWith(path.join('ai', 'train', 'check_deepcfr_env.py'))).toBe(true);
        expect(args.requireCleanData).toBe(false);
        expect(args.checkWindow).toBe(false);
        expect(args.strict).toBe(true);
        expect(args.deepcfrDir.endsWith(path.join('data', 'deepcfr-x'))).toBe(true);
        expect(args.configPath.endsWith(path.join('data', 'deepcfr-x', 'deepcfr_config.active.yaml'))).toBe(true);
        expect(args.out.endsWith(path.join('data', 'runs', 'deepcfr.preflight.custom.json'))).toBe(true);
    });
    test('safeParseJson returns null on invalid json', () => {
        expect(safeParseJson('{"x":1}')).toEqual({ x: 1 });
        expect(safeParseJson('{oops')).toBeNull();
    });
    test('makeDefaultOutputPath points under runs dir', () => {
        const runsDir = path.resolve(process.cwd(), 'data', 'runs');
        const out = makeDefaultOutputPath(runsDir);
        expect(out.startsWith(runsDir)).toBe(true);
        expect(out.includes('deepcfr.preflight.')).toBe(true);
        expect(out.endsWith('.json')).toBe(true);
    });
    test('isIgnorableArtifactForDeepcfr ignores foundation reports only', () => {
        expect(isIgnorableArtifactForDeepcfr('data/runs/deepcfr.foundation.20260212.json')).toBe(true);
        expect(isIgnorableArtifactForDeepcfr('data/runs/deepcfr.preflight.20260212.json')).toBe(true);
        expect(isIgnorableArtifactForDeepcfr('data/runs/selfplay.train.sample.ndjson')).toBe(false);
    });
});
//# sourceMappingURL=selfplay.deepcfr-preflight.test.js.map