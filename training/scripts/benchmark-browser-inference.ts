/**
 * @file benchmark-browser-inference.ts
 * @description Browser inference latency benchmark for CNN v2 model.
 *
 * Measures average inference time for the 3-input model (board/aux/hand).
 */

import * as ort from 'onnxruntime-node';
import * as fs from 'fs';
import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const { buildBoardTensor, buildAuxVector, buildHandTensor } = require('../game/ai/policy-onnx-runtime-v2');

interface BenchmarkResult {
    modelPath: string;
    numRuns: number;
    avgMs: string;
    minMs: string;
    maxMs: string;
    p50Ms: string;
    p95Ms: string;
    p99Ms: string;
}

async function benchmarkInference(modelPath: string, numRuns: number = 100): Promise<BenchmarkResult | null> {
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
    const times: number[] = [];
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

    const result: BenchmarkResult = {
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

export = {  benchmarkInference  } as any;
