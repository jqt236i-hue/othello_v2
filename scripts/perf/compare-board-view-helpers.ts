#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

/** Old/new identity and timing of the state-backed board heuristics used by
 * CPU commentary: control counts and the prepared commentary metrics. Each
 * root is a directory holding a built `dist/`. */

function seeded(seed: number) {
    let value = seed >>> 0;
    return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 0x100000000; };
}

function fill(rows: number, cols: number, seed: number, density: number) {
    const random = seeded(seed);
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => {
        const roll = random();
        return roll < density / 2 ? 1 : roll < density ? -1 : 0;
    }));
}

export function boardViewFixtures() {
    const fixtures: Array<{ id: string; gameState: any; cardState: any }> = [];
    for (let seed = 1; seed <= 24; seed++) {
        fixtures.push({ id: `8x8-${seed}`, gameState: { board: fill(8, 8, seed, 0.15 + (seed % 8) * 0.1), turnNumber: seed * 2 }, cardState: { markers: [] } });
    }
    fixtures.push({ id: 'holes-expansion', gameState: { board: fill(8, 8, 101, 0.7), turnNumber: 30,
        boardExpansion: { cells: [{ side: 'left', row: 0, col: -1, owner: 1 }, { side: 'left', row: 3, col: -1, owner: -1 }, { side: 'right', row: 5, col: 8, owner: 0 }] } },
        cardState: { markers: [
            { kind: 'specialStone', row: 0, col: 1, owner: 'white', data: { type: 'METEOR_HOLE' } },
            { kind: 'specialStone', row: 7, col: 7, owner: 'black', data: { type: 'METEOR_HOLE' } }] } });
    fixtures.push({ id: 'corner-hole', gameState: { board: fill(8, 8, 103, 0.6), turnNumber: 20 },
        cardState: { markers: [{ kind: 'specialStone', row: 0, col: 0, owner: 'white', data: { type: 'METEOR_HOLE' } }] } });
    fixtures.push({ id: 'circle-10', gameState: { board: fill(10, 10, 105, 0.6), turnNumber: 18, boardConfig: { rows: 10, cols: 10, shape: 'circle' } }, cardState: { markers: [] } });
    fixtures.push({ id: 'rect-6x9', gameState: { board: fill(6, 9, 107, 0.5), turnNumber: 9, boardConfig: { rows: 6, cols: 9, shape: 'rectangle' } }, cardState: { markers: [] } });
    return fixtures;
}

function load(root: string) {
    const dist = path.join(path.resolve(root), 'dist');
    return {
        board: require(path.join(dist, 'shared/shared-board-utils')),
        commentary: require(path.join(dist, 'shared/commentary-context-helpers'))
    };
}

function outcomes(modules: any) {
    return boardViewFixtures().map((fixture) => {
        const board = modules.board.createBoardContext(fixture.gameState, fixture.cardState);
        return {
            id: fixture.id,
            edges: [1, -1].map((player) => modules.board.countEdgeControl(board, player)),
            corners: [1, -1].map((player) => modules.board.countCornerControl(board, player)),
            metrics: ['black', 'white'].map((playerKey) => modules.commentary.buildCpuCommentaryMetrics({
                gameState: fixture.gameState, cardState: fixture.cardState, playerKey }))
        };
    });
}

function time(fn: () => void, count: number) {
    for (let i = 0; i < Math.min(20, count); i++) fn();
    const samples: number[] = [];
    for (let i = 0; i < count; i++) { const start = performance.now(); fn(); samples.push(performance.now() - start); }
    samples.sort((a, b) => a - b);
    return { median: samples[Math.floor(count / 2)], p95: samples[Math.ceil(count * .95) - 1] };
}

function timings(modules: any) {
    const fixture = boardViewFixtures().find((entry) => entry.id === '8x8-5')!;
    const board = modules.board.createBoardContext(fixture.gameState, fixture.cardState);
    return {
        countEdgeControlMs: time(() => modules.board.countEdgeControl(board, 1), 400),
        buildCpuCommentaryMetricsMs: time(() => modules.commentary.buildCpuCommentaryMetrics({
            gameState: fixture.gameState, cardState: fixture.cardState, playerKey: 'white' }), 200)
    };
}

if (require.main === module) {
    const [baselineRoot, candidateRoot, output] = process.argv.slice(2);
    const baseline = load(baselineRoot), candidate = load(candidateRoot);
    const before = outcomes(baseline), after = outcomes(candidate);
    const mismatches = before.filter((row, index) => JSON.stringify(row) !== JSON.stringify(after[index])).map((row) => row.id);
    const report = { schema: 'board-view-helper-comparison.v1', fixtures: before.length, mismatches, identical: mismatches.length === 0,
        baseline: timings(baseline), candidate: timings(candidate), baselineAgain: timings(baseline), candidateAgain: timings(candidate) };
    if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (!report.identical) process.exitCode = 1;
}
