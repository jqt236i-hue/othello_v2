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
const { parseArgs, makeDefaultManifestPath, buildDirectoryList } = require('../scripts/init-deepcfr-foundation');
describe('deepcfr foundation init script', () => {
    test('parseArgs accepts explicit locations and flags', () => {
        const args = parseArgs([
            '--runs-dir', 'data/runs-x',
            '--deepcfr-dir', 'data/deepcfr-x',
            '--config-template', 'ai/train/deepcfr_config.base.yaml',
            '--config-out', 'data/deepcfr-x/deepcfr_config.active.yaml',
            '--manifest-out', 'data/runs-x/deepcfr.foundation.custom.json',
            '--no-copy-config',
            '--force-config'
        ]);
        expect(args.runsDir.endsWith(path.join('data', 'runs-x'))).toBe(true);
        expect(args.deepcfrDir.endsWith(path.join('data', 'deepcfr-x'))).toBe(true);
        expect(args.copyConfig).toBe(false);
        expect(args.forceConfig).toBe(true);
        expect(args.configOutPath.endsWith(path.join('data', 'deepcfr-x', 'deepcfr_config.active.yaml'))).toBe(true);
        expect(args.manifestOut.endsWith(path.join('data', 'runs-x', 'deepcfr.foundation.custom.json'))).toBe(true);
    });
    test('buildDirectoryList contains expected deepcfr folders', () => {
        const dirs = buildDirectoryList(path.resolve(process.cwd(), 'data', 'deepcfr'));
        expect(Array.isArray(dirs)).toBe(true);
        expect(dirs.some((p) => p.endsWith(path.join('data', 'deepcfr', 'buffers')))).toBe(true);
        expect(dirs.some((p) => p.endsWith(path.join('data', 'deepcfr', 'checkpoints')))).toBe(true);
        expect(dirs.some((p) => p.endsWith(path.join('data', 'deepcfr', 'datasets')))).toBe(true);
        expect(dirs.some((p) => p.endsWith(path.join('data', 'deepcfr', 'reports')))).toBe(true);
    });
    test('makeDefaultManifestPath points under runs dir', () => {
        const runsDir = path.resolve(process.cwd(), 'data', 'runs');
        const out = makeDefaultManifestPath(runsDir);
        expect(out.startsWith(runsDir)).toBe(true);
        expect(out.includes('deepcfr.foundation.')).toBe(true);
        expect(out.endsWith('.json')).toBe(true);
    });
});
//# sourceMappingURL=selfplay.deepcfr-foundation-init.test.js.map