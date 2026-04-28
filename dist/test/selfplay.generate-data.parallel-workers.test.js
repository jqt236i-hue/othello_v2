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
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const EventEmitter = __importStar(require("events"));
const cpuLv6SharedProfile = __importStar(require("../constants/cpu-lv6-shared-profile.js"));
function createArgs(tempDir, overrides) {
    return Object.assign({
        games: 4,
        seed: 100,
        maxPlies: 220,
        out: path.join(tempDir, 'selfplay.ndjson'),
        hardcaseOut: null,
        allowCardUsage: false,
        cardUsageRate: 0.2,
        policyMixRate: 1,
        cardUsageRateJitter: 0,
        tacticalWeightMin: 1,
        tacticalWeightMax: 1,
        tacticalDepthOpening: 2,
        tacticalDepthMid: 3,
        tacticalDepthEnd: 4,
        tacticalBeamWidth: 0,
        teacherCommitteeWeightMin: 28,
        teacherCommitteeWeightMax: 28,
        teacherCommitteeConsensusBonusMin: 320,
        teacherCommitteeConsensusBonusMax: 320,
        policyScoreWeightMin: 1,
        policyScoreWeightMax: 1,
        heuristicWeightMin: 1,
        heuristicWeightMax: 1,
        jobs: 2,
        workerRetries: 1,
        resumeChunkSize: 0,
        reuseCompletedChunks: false,
        policyModelPath: null,
        policyModelPoolPaths: [],
        policyPoolSampling: 'uniform',
        policyPoolRecencyDecay: 1,
        policyCurrentAnchorRate: 0,
        seedFamily: 'train',
        dataLane: 'train-main',
        verbose: false
    }, overrides || {});
}
function loadModuleWithForkMock(forkMock) {
    jest.resetModules();
    jest.doMock('child_process', () => ({ fork: forkMock }));
    let loaded = null;
    jest.isolateModules(() => {
        loaded = require('../scripts/generate-selfplay-data');
    });
    return loaded;
}
describe('selfplay generate data worker retries', () => {
    afterEach(() => {
        jest.resetModules();
        jest.restoreAllMocks();
        jest.unmock('child_process');
    });
    test('parseArgs defaults align parallel standalone selfplay with shared Lv6 teacher profile', () => {
        jest.resetModules();
        import { parseArgs } from '../scripts/generate-selfplay-data-parallel.js';
        const teacher = cpuLv6SharedProfile.teacher;
        const args = (0, generate_selfplay_data_parallel_js_1.parseArgs)([]);
        expect(args.policyMixRate).toBeCloseTo(teacher.policyMixRate, 6);
        expect(args.policyCurrentAnchorRate).toBeCloseTo(teacher.policyCurrentAnchorRate, 6);
        expect(args.tacticalWeightMin).toBeCloseTo(teacher.tacticalWeightMin, 6);
        expect(args.tacticalWeightMax).toBeCloseTo(teacher.tacticalWeightMax, 6);
        expect(args.tacticalDepthOpening).toBe(teacher.tacticalDepthOpening);
        expect(args.tacticalDepthMid).toBe(teacher.tacticalDepthMid);
        expect(args.tacticalDepthEnd).toBe(teacher.tacticalDepthEnd);
        expect(args.tacticalBeamWidth).toBe(teacher.tacticalBeamWidth);
        expect(args.teacherCommitteeWeightMin).toBeCloseTo(teacher.teacherCommitteeWeightMin, 6);
        expect(args.teacherCommitteeWeightMax).toBeCloseTo(teacher.teacherCommitteeWeightMax, 6);
        expect(args.teacherCommitteeConsensusBonusMin).toBeCloseTo(teacher.teacherCommitteeConsensusBonusMin, 6);
        expect(args.teacherCommitteeConsensusBonusMax).toBeCloseTo(teacher.teacherCommitteeConsensusBonusMax, 6);
        expect(args.policyScoreWeightMin).toBeCloseTo(teacher.policyScoreWeightMin, 6);
        expect(args.policyScoreWeightMax).toBeCloseTo(teacher.policyScoreWeightMax, 6);
        expect(args.heuristicWeightMin).toBeCloseTo(teacher.heuristicWeightMin, 6);
        expect(args.heuristicWeightMax).toBeCloseTo(teacher.heuristicWeightMax, 6);
    });
    test('retries a shard worker that exits unexpectedly', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-selfplay-worker-retry-'));
        const attempts = new Map();
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        jest.spyOn(console, 'log').mockImplementation(() => { });
        const forkMock = jest.fn((filePath, argv, options) => {
            const child = new EventEmitter();
            const task = JSON.parse(options.env.SELFPLAY_GENERATE_WORKER_TASK);
            const attempt = (attempts.get(task.shardIndex) || 0) + 1;
            attempts.set(task.shardIndex, attempt);
            setImmediate(() => {
                if (task.shardIndex === 0 && attempt === 1) {
                    child.emit('message', {
                        type: 'progress',
                        shardIndex: task.shardIndex,
                        completed: 1,
                        total: task.games,
                        winner: 'black'
                    });
                    child.emit('exit', 3221225786, null);
                    return;
                }
                fs.writeFileSync(task.outPath, JSON.stringify({ shard: task.shardIndex, attempt }) + '\n', 'utf8');
                child.emit('message', {
                    type: 'result',
                    payload: {
                        shardIndex: task.shardIndex,
                        outPath: task.outPath,
                        hardcaseOutPath: null,
                        summary: {
                            totalGames: task.games,
                            totalPlies: task.games * 2,
                            hardcaseRecords: 0,
                            wins: {
                                black: task.shardIndex === 0 ? task.games : 0,
                                white: task.shardIndex === 1 ? task.games : 0,
                                draw: 0
                            }
                        }
                    }
                });
                child.emit('exit', 0, null);
            });
            return child;
        });
        try {
            const { runSelfPlayParallel } = loadModuleWithForkMock(forkMock);
            const result = await runSelfPlayParallel(createArgs(tempDir));
            expect(result.summary.totalGames).toBe(4);
            expect(result.summary.totalPlies).toBe(8);
            expect(forkMock).toHaveBeenCalledTimes(3);
            expect(fs.readFileSync(path.join(tempDir, 'selfplay.ndjson'), 'utf8')).toBe('{"shard":0,"attempt":2}\n{"shard":1,"attempt":1}\n');
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('shard retry 1/1 shard=0 seed=100 games=2: worker failed code=3221225786 signal=none shard=0'));
        }
        finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    test('does not retry worker-reported execution errors', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-selfplay-worker-error-'));
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        jest.spyOn(console, 'log').mockImplementation(() => { });
        const forkMock = jest.fn(() => {
            const child = new EventEmitter();
            setImmediate(() => {
                child.emit('message', { type: 'error', message: 'deterministic shard failure' });
                child.emit('exit', 1, null);
            });
            return child;
        });
        try {
            const { runSelfPlayParallel } = loadModuleWithForkMock(forkMock);
            await expect(runSelfPlayParallel(createArgs(tempDir, {
                games: 2,
                jobs: 1,
                workerRetries: 3
            }))).rejects.toThrow('deterministic shard failure');
            expect(forkMock).toHaveBeenCalledTimes(1);
            expect(warnSpy).not.toHaveBeenCalled();
        }
        finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    test('reuses completed chunks without rerunning shard workers', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-selfplay-chunk-reuse-'));
        jest.spyOn(console, 'log').mockImplementation(() => { });
        const forkMock = jest.fn(() => {
            throw new Error('chunk reuse should not spawn workers');
        });
        try {
            const { createChunkPlan, buildChunkArtifactDir, buildChunkArtifactPaths, runSelfPlayWithResumeChunks } = loadModuleWithForkMock(forkMock);
            const args = createArgs(tempDir, {
                games: 4,
                jobs: 2,
                resumeChunkSize: 2,
                reuseCompletedChunks: true,
                hardcaseOut: path.join(tempDir, 'selfplay.hardcase.ndjson')
            });
            const chunkPlan = createChunkPlan(args.games, args.seed, args.resumeChunkSize, 0);
            const chunkDir = buildChunkArtifactDir(args.out);
            fs.mkdirSync(chunkDir, { recursive: true });
            chunkPlan.forEach((chunk) => {
                const chunkPaths = buildChunkArtifactPaths(chunkDir, chunk.chunkIndex, true);
                fs.writeFileSync(chunkPaths.outPath, JSON.stringify({ chunk: chunk.chunkIndex, kind: 'all' }) + '\n', 'utf8');
                fs.writeFileSync(chunkPaths.hardcaseOutPath, JSON.stringify({ chunk: chunk.chunkIndex, kind: 'hardcase' }) + '\n', 'utf8');
                fs.writeFileSync(chunkPaths.summaryPath, JSON.stringify({
                    schemaVersion: 'selfplay.v2',
                    chunk: {
                        chunkIndex: chunk.chunkIndex,
                        chunkCount: chunkPlan.length,
                        games: chunk.games,
                        seed: chunk.seed,
                        gameIndexOffset: chunk.gameIndexOffset
                    },
                    summary: {
                        totalGames: chunk.games,
                        totalPlies: chunk.games * 3,
                        hardcaseRecords: 1,
                        wins: { black: chunk.games, white: 0, draw: 0 }
                    }
                }, null, 2), 'utf8');
            });
            const result = await runSelfPlayWithResumeChunks(args);
            expect(result.summary.totalGames).toBe(4);
            expect(result.summary.totalPlies).toBe(12);
            expect(result.summary.hardcaseRecords).toBe(2);
            expect(result.summary.wins).toEqual({ black: 4, white: 0, draw: 0 });
            expect(fs.readFileSync(args.out, 'utf8')).toBe('{"chunk":0,"kind":"all"}\n{"chunk":1,"kind":"all"}\n');
            expect(fs.readFileSync(args.hardcaseOut, 'utf8')).toBe('{"chunk":0,"kind":"hardcase"}\n{"chunk":1,"kind":"hardcase"}\n');
            expect(fs.existsSync(chunkDir)).toBe(false);
            expect(forkMock).not.toHaveBeenCalled();
        }
        finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=selfplay.generate-data.parallel-workers.test.js.map