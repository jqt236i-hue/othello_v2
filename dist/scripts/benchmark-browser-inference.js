"use strict";
/**
 * @file benchmark-browser-inference.ts
 * @description Browser inference latency benchmark for CNN v2 model.
 *
 * Measures average inference time for the 3-input model (board/aux/hand).
 */
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
const ort = __importStar(require("onnxruntime-node"));
const fs = __importStar(require("fs"));
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const { buildBoardTensor, buildAuxVector, buildHandTensor } = require('../game/ai/policy-onnx-runtime-v2');
async function benchmarkInference(modelPath, numRuns = 100) {
    if (!fs.existsSync(modelPath)) {
        console.error(`Model not found: ${modelPath}`);
        return null;
    }
    console.log(`[benchmark] Loading model: ${modelPath}`);
    const session = await ort.InferenceSession.create(modelPath);
    console.log(`[benchmark] Input names: ${session.inputNames.join(', ')}`);
    console.log(`[benchmark] Output names: ${session.outputNames.join(', ')}`);
    // Create dummy inputs
    const dummyBoard = new ort.Tensor('float32', new Float32Array(5 * 10 * 10).fill(0), [1, 5, 10, 10]);
    const dummyAux = new ort.Tensor('float32', new Float32Array(16).fill(0), [1, 16]);
    const dummyHand = new ort.Tensor('float32', new Float32Array(5 * 11).fill(0), [1, 5, 11]);
    const feeds = {
        board: dummyBoard,
        aux: dummyAux,
        hand: dummyHand,
    };
    // Warmup
    console.log('[benchmark] Warming up...');
    for (let i = 0; i < 10; i++) {
        await session.run(feeds);
    }
    // Benchmark
    console.log(`[benchmark] Running ${numRuns} inferences...`);
    const times = [];
    for (let i = 0; i < numRuns; i++) {
        const start = process.hrtime.bigint();
        await session.run(feeds);
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1e6); // Convert to milliseconds
    }
    // Statistics
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = times[0];
    const max = times[times.length - 1];
    const p50 = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];
    const result = {
        modelPath,
        numRuns,
        avgMs: avg.toFixed(2),
        minMs: min.toFixed(2),
        maxMs: max.toFixed(2),
        p50Ms: p50.toFixed(2),
        p95Ms: p95.toFixed(2),
        p99Ms: p99.toFixed(2),
    };
    console.log('\n[benchmark] Results:');
    console.log(`  Average: ${result.avgMs}ms`);
    console.log(`  Min:     ${result.minMs}ms`);
    console.log(`  Max:     ${result.maxMs}ms`);
    console.log(`  P50:     ${result.p50Ms}ms`);
    console.log(`  P95:     ${result.p95Ms}ms`);
    console.log(`  P99:     ${result.p99Ms}ms`);
    console.log(`  Status:  ${avg < 1000 ? 'PASS (under 1s budget)' : 'WARN (over 1s budget)'}`);
    return result;
}
async function main() {
    const modelPath = process.argv[2] || 'data/models/browser_lv6_growth_v1/policy-cnn-v2-smoke.onnx';
    const numRuns = parseInt(process.argv[3], 10) || 100;
    const result = await benchmarkInference(modelPath, numRuns);
    if (result) {
        const outPath = modelPath.replace('.onnx', '.benchmark.json');
        fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
        console.log(`\n[benchmark] Saved results to: ${outPath}`);
    }
}
if (require.main === module) {
    main().catch(console.error);
}
module.exports = { benchmarkInference };
//# sourceMappingURL=benchmark-browser-inference.js.map