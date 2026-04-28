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
const { classifyTrainingArtifactPath } = require('../scripts/training-artifact-status');
describe('training artifact status', () => {
    test('classifies active, archived, experimental, and incompatible artifact paths', () => {
        expect(classifyTrainingArtifactPath(path.resolve('data', 'models', 'promoted', 'champion', 'policy-table.json'))).toMatchObject({
            lifecycle: 'active',
            compatibility: 'unknown'
        });
        expect(classifyTrainingArtifactPath(path.resolve('data', 'models', 'archive', '2026-04-13', 'policy-table.json'))).toMatchObject({
            lifecycle: 'archived',
            compatibility: 'unknown'
        });
        expect(classifyTrainingArtifactPath(path.resolve('data', 'models', 'promoted', 'challenger', 'policy-table.json'))).toMatchObject({
            lifecycle: 'experimental',
            compatibility: 'unknown'
        });
        expect(classifyTrainingArtifactPath(path.resolve('data', 'models', 'policy-net.candidate.demo.checkpoint.pt'), {
            kind: 'model.policy-checkpoint'
        })).toMatchObject({
            lifecycle: 'experimental',
            compatibility: 'compatible',
            detectedCheckpointHead: 'policy'
        });
        expect(classifyTrainingArtifactPath(path.resolve('data', 'models', 'policy-card.candidate.demo.checkpoint.pt'), {
            kind: 'model.policy-checkpoint'
        })).toMatchObject({
            lifecycle: 'incompatible',
            compatibility: 'incompatible',
            detectedCheckpointHead: 'card',
            expectedCheckpointHead: 'policy'
        });
        expect(classifyTrainingArtifactPath(path.resolve('data', 'runs', 'browser_lv6_deploy_v1_seedbank_canary', 'policy-net.candidate.demo.shape10x10.it01.onnx'))).toMatchObject({
            lifecycle: 'incompatible',
            compatibility: 'incompatible',
            reason: 'board-shape-mismatch',
            expectedBoardSize: 8,
            detectedBoardSize: '10x10'
        });
    });
});
//# sourceMappingURL=scripts.training-artifact-status.test.js.map