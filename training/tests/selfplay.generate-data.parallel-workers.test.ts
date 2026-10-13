import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EventEmitter } from 'events';
import * as cpuLv6SharedProfile from '../constants/cpu-lv6-shared-profile.js';

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
        const { parseArgs } = require('../scripts/generate-selfplay-data-parallel.js');
        const teacher = cpuLv6SharedProfile.teacher;
        const args = parseArgs([]);

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
        expect(args.blackDeckCode).toBeNull();
        expect(args.whiteDeckCode).toContain('D1C1:');
        expect(args.whiteDeckCode).toContain('reinforcement_01');
    });

    test('retries a shard worker that exits unexpectedly', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-selfplay-worker-retry-'));
        const attempts = new Map();
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
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
            expect(fs.readFileSync(path.join(tempDir, 'selfplay.ndjson'), 'utf8')).toBe(
                '{"shard":0,"attempt":2}\n{"shard":1,"attempt":1}\n'
            );
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('shard retry 1/1 shard=0 seed=100 games=2: worker failed code=3221225786 signal=none shard=0')
            );
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('does not retry worker-reported execution errors', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-selfplay-worker-error-'));
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
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
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('a legacy completion record without a manifest is diagnosed, kept, and regenerated instead of reused', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-selfplay-chunk-legacy-'));
        jest.spyOn(console, 'log').mockImplementation(() => {});
        const warnings = [];
        const forkMock = createChunkForkMock({});

        try {
            const {
                createChunkPlan,
                buildChunkArtifactDir,
                buildChunkArtifactPaths,
                runSelfPlayWithResumeChunks
            } = loadModuleWithForkMock(forkMock);
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
                fs.writeFileSync(chunkPaths.outPath, JSON.stringify({ chunk: chunk.chunkIndex, kind: 'legacy' }) + '\n', 'utf8');
                fs.writeFileSync(chunkPaths.hardcaseOutPath, JSON.stringify({ chunk: chunk.chunkIndex, kind: 'legacy-hardcase' }) + '\n', 'utf8');
                fs.writeFileSync(chunkPaths.summaryPath, JSON.stringify({
                    schemaVersion: 'selfplay.v2',
                    chunk: { chunkIndex: chunk.chunkIndex, chunkCount: chunkPlan.length, games: chunk.games, seed: chunk.seed, gameIndexOffset: chunk.gameIndexOffset },
                    summary: { totalGames: chunk.games, totalPlies: chunk.games * 3, hardcaseRecords: 1, wins: { black: chunk.games, white: 0, draw: 0 } }
                }, null, 2), 'utf8');
            });

            const result = await runSelfPlayWithResumeChunks(args, { attemptId: 'b1', warn: (message) => warnings.push(message) });
            expect(result.summary.totalGames).toBe(4);
            expect(forkMock).toHaveBeenCalledTimes(4);
            expect(readLines(args.out)).toEqual([{ seed: 100 }, { seed: 101 }, { seed: 102 }, { seed: 103 }]);
            expect(warnings.filter((message) => message.includes('legacy completion record'))).toHaveLength(2);
            // The legacy artifacts are preserved untouched.
            chunkPlan.forEach((chunk) => {
                const chunkPaths = buildChunkArtifactPaths(chunkDir, chunk.chunkIndex, true);
                expect(readLines(chunkPaths.outPath)).toEqual([{ chunk: chunk.chunkIndex, kind: 'legacy' }]);
                expect(fs.existsSync(chunkPaths.summaryPath)).toBe(true);
            });
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});

// After a successful merge, no manifest or chunk output of a merged chunk remains; only the
// unmanifested residue of a failed earlier attempt may stay.
function expectMergedChunksCleaned(chunkDir) {
    if (!fs.existsSync(chunkDir)) return;
    const remaining = fs.readdirSync(chunkDir);
    expect(remaining.filter((name) => name.endsWith('.manifest.json'))).toEqual([]);
    expect(remaining.filter((name) => /^selfplay\.chunk\.000[01]\./.test(name) || name.includes('.a2.'))).toEqual([]);
}

function readLines(filePath) {
    return fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

// Fork mock for resumable chunks: one record per game (its seed), an optional illegal-move
// diagnostic for chosen seeds, and an optional deterministic failure for chosen seeds.
function createChunkForkMock({ illegalSeeds = [], failSeeds = [] }: { illegalSeeds?: number[]; failSeeds?: number[] }) {
    return jest.fn((_filePath, _argv, options) => {
        const child = new EventEmitter();
        const task = JSON.parse(options.env.SELFPLAY_GENERATE_WORKER_TASK);
        setImmediate(() => {
            const seeds = Array.from({ length: task.games }, (_unused, index) => task.seed + index);
            if (seeds.some((seed) => failSeeds.includes(seed))) {
                child.emit('message', { type: 'error', message: `deterministic failure seed=${task.seed}` });
                child.emit('exit', 1, null);
                return;
            }
            fs.writeFileSync(task.outPath, seeds.map((seed) => JSON.stringify({ seed })).join('\n') + '\n', 'utf8');
            if (task.hardcaseOutPath) {
                fs.writeFileSync(task.hardcaseOutPath, seeds.map((seed) => JSON.stringify({ hardcase: seed })).join('\n') + '\n', 'utf8');
            }
            const illegal = seeds.filter((seed) => illegalSeeds.includes(seed));
            const illegalPath = illegal.length > 0 ? `${task.outPath}.illegal-move.ndjson` : null;
            if (illegalPath) fs.writeFileSync(illegalPath, illegal.map((seed) => JSON.stringify({ illegal: seed })).join('\n') + '\n', 'utf8');
            child.emit('message', {
                type: 'result',
                payload: {
                    shardIndex: task.shardIndex,
                    outPath: task.outPath,
                    hardcaseOutPath: task.hardcaseOutPath || null,
                    illegalMoveHardcaseOutPath: illegalPath,
                    summary: {
                        totalGames: task.games,
                        totalPlies: task.games * 2,
                        hardcaseRecords: task.hardcaseOutPath ? task.games : 0,
                        illegalMoveHardcaseRecords: illegal.length,
                        wins: { black: task.games, white: 0, draw: 0 }
                    }
                }
            });
            child.emit('exit', 0, null);
        });
        return child;
    });
}

describe('resumable selfplay chunks (R09 identity, R10 diagnostics)', () => {
    let tempDir;
    let warnings;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-selfplay-chunks-'));
        warnings = [];
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        jest.resetModules();
        jest.restoreAllMocks();
        jest.unmock('child_process');
    });

    const chunkArgs = (overrides = {}) => createArgs(tempDir, Object.assign({
        games: 6, jobs: 2, resumeChunkSize: 2, reuseCompletedChunks: true
    }, overrides));
    const forkedSeeds = (forkMock) => forkMock.mock.calls.map((call) => JSON.parse(call[2].env.SELFPLAY_GENERATE_WORKER_TASK).seed).sort((a, b) => a - b);

    // First attempt completes chunks 0 and 1, then fails in chunk 2 (seed 104).
    async function interruptedAttempt(args, illegalSeeds = []) {
        const first = loadModuleWithForkMock(createChunkForkMock({ illegalSeeds, failSeeds: [104] }));
        await expect(first.runSelfPlayWithResumeChunks(args, { attemptId: 'a1', warn: (message) => warnings.push(message) }))
            .rejects.toThrow('deterministic failure');
        return first;
    }

    test('identical settings reuse the completed chunks and run only the rest', async () => {
        const args = chunkArgs();
        await interruptedAttempt(args);
        const forkMock = createChunkForkMock({});
        const second = loadModuleWithForkMock(forkMock);
        const result = await second.runSelfPlayWithResumeChunks(args, { attemptId: 'a2', warn: (message) => warnings.push(message) });
        expect(forkedSeeds(forkMock)).toEqual([104, 105]);
        expect(result.summary.totalGames).toBe(6);
        expect(readLines(args.out).map((row) => row.seed)).toEqual([100, 101, 102, 103, 104, 105]);
        expectMergedChunksCleaned(second.buildChunkArtifactDir(args.out));
    });

    test.each([
        ['a changed generation setting', (args) => Object.assign({}, args, { maxPlies: 120 })],
        ['a changed deck', (args) => Object.assign({}, args, { whiteDeckCode: 'D1C1:other' })],
        ['an added hardcase output', (args) => Object.assign({}, args, { hardcaseOut: path.join(tempDir, 'hardcase.ndjson') })]
    ])('%s is not reused and the earlier attempt is kept', async (_label, change) => {
        const args = chunkArgs();
        await interruptedAttempt(args);
        const forkMock = createChunkForkMock({});
        const second = loadModuleWithForkMock(forkMock);
        await second.runSelfPlayWithResumeChunks(change(args), { attemptId: 'a2', warn: (message) => warnings.push(message) });
        expect(forkedSeeds(forkMock)).toEqual([100, 101, 102, 103, 104, 105]);
        expect(warnings.some((message) => message.includes('generation identity differs'))).toBe(true);
        const kept = fs.readdirSync(second.buildChunkArtifactDir(args.out));
        expect(kept).toEqual(expect.arrayContaining(['selfplay.chunk.0000.a1.manifest.json', 'selfplay.chunk.0000.a1.ndjson']));
    });

    test('a same-named input model whose content changed is not reused', async () => {
        const modelPath = path.join(tempDir, 'policy.json');
        fs.writeFileSync(modelPath, JSON.stringify({ schemaVersion: 'policy_table.v2', weights: [1] }), 'utf8');
        const args = chunkArgs({ policyModelPath: modelPath });
        await interruptedAttempt(args);
        fs.writeFileSync(modelPath, JSON.stringify({ schemaVersion: 'policy_table.v2', weights: [2] }), 'utf8');
        const forkMock = createChunkForkMock({});
        const second = loadModuleWithForkMock(forkMock);
        await second.runSelfPlayWithResumeChunks(args, { attemptId: 'a2', warn: (message) => warnings.push(message) });
        expect(forkedSeeds(forkMock)).toEqual([100, 101, 102, 103, 104, 105]);
    });

    test.each([
        ['another record schema', (manifestPath) => {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            manifest.schemaVersion = 'selfplay.v0';
            fs.writeFileSync(manifestPath, JSON.stringify(manifest));
        }, 'record schema'],
        ['a truncated output', (manifestPath) => {
            const outPath = manifestPath.replace('.manifest.json', '.ndjson');
            fs.writeFileSync(outPath, fs.readFileSync(outPath, 'utf8').split('\n')[0] + '\n');
        }, 'changed or truncated'],
        ['a missing output file', (manifestPath) => {
            fs.rmSync(manifestPath.replace('.manifest.json', '.ndjson'));
        }, 'missing selfplay file']
    ])('%s is not reused', async (_label, damage, reason) => {
        const args = chunkArgs();
        const first = await interruptedAttempt(args);
        damage(path.join(first.buildChunkArtifactDir(args.out), 'selfplay.chunk.0000.a1.manifest.json'));
        const forkMock = createChunkForkMock({});
        const second = loadModuleWithForkMock(forkMock);
        await second.runSelfPlayWithResumeChunks(args, { attemptId: 'a2', warn: (message) => warnings.push(message) });
        expect(forkedSeeds(forkMock)).toEqual([100, 101, 104, 105]);
        expect(warnings.some((message) => message.includes(reason))).toBe(true);
    });

    test('a chunk without a completion manifest (interrupted mid-chunk) is regenerated', async () => {
        const args = chunkArgs();
        const first = await interruptedAttempt(args);
        const chunkDir = first.buildChunkArtifactDir(args.out);
        // Chunk 2 failed before its manifest; its partial files must not be adopted.
        expect(fs.readdirSync(chunkDir).filter((name) => name.startsWith('selfplay.chunk.0002') && name.endsWith('.manifest.json'))).toEqual([]);
        const forkMock = createChunkForkMock({});
        const second = loadModuleWithForkMock(forkMock);
        await second.runSelfPlayWithResumeChunks(args, { attemptId: 'a2', warn: (message) => warnings.push(message) });
        expect(forkedSeeds(forkMock)).toEqual([104, 105]);
    });

    test('illegal-move diagnostics survive a mix of reused and new chunks, in order, after cleanup', async () => {
        const args = chunkArgs();
        await interruptedAttempt(args, [101, 105]);
        const forkMock = createChunkForkMock({ illegalSeeds: [101, 105] });
        const second = loadModuleWithForkMock(forkMock);
        const result = await second.runSelfPlayWithResumeChunks(args, { attemptId: 'a2', warn: (message) => warnings.push(message) });
        expect(forkedSeeds(forkMock)).toEqual([104, 105]);
        expect(result.illegalMoveHardcaseOutPath).toBe(`${path.resolve(args.out)}.illegal-move.ndjson`);
        expect(readLines(result.illegalMoveHardcaseOutPath)).toEqual([{ illegal: 101 }, { illegal: 105 }]);
        expect(result.summary.illegalMoveHardcaseRecords).toBe(2);
        expectMergedChunksCleaned(second.buildChunkArtifactDir(args.out));
        expect(fs.existsSync(result.illegalMoveHardcaseOutPath)).toBe(true);
    });

    test('illegal-move diagnostics survive when every chunk is reused', async () => {
        const args = chunkArgs();
        // The first attempt generates every chunk, then fails while merging (the output path is a directory).
        fs.mkdirSync(args.out);
        const first = loadModuleWithForkMock(createChunkForkMock({ illegalSeeds: [100, 103] }));
        await expect(first.runSelfPlayWithResumeChunks(args, { attemptId: 'a1', warn: (message) => warnings.push(message) })).rejects.toThrow();
        fs.rmdirSync(args.out);
        const forkMock = createChunkForkMock({});
        const second = loadModuleWithForkMock(forkMock);
        const result = await second.runSelfPlayWithResumeChunks(args, { attemptId: 'a2', warn: (message) => warnings.push(message) });
        expect(forkMock).not.toHaveBeenCalled();
        expect(readLines(result.illegalMoveHardcaseOutPath)).toEqual([{ illegal: 100 }, { illegal: 103 }]);
        expect(result.summary.illegalMoveHardcaseRecords).toBe(2);
        expect(readLines(args.out).map((row) => row.seed)).toEqual([100, 101, 102, 103, 104, 105]);
        expect(fs.existsSync(second.buildChunkArtifactDir(args.out))).toBe(false);
    });

    test('no diagnostic sidecar is required or produced when no illegal move occurred', async () => {
        const args = chunkArgs();
        await interruptedAttempt(args);
        const second = loadModuleWithForkMock(createChunkForkMock({}));
        const result = await second.runSelfPlayWithResumeChunks(args, { attemptId: 'a2', warn: (message) => warnings.push(message) });
        expect(result.illegalMoveHardcaseOutPath).toBeNull();
        expect(fs.existsSync(`${path.resolve(args.out)}.illegal-move.ndjson`)).toBe(false);
    });
});
