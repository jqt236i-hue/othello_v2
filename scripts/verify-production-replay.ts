#!/usr/bin/env node
import fs = require('node:fs');
import zlib = require('node:zlib');
import crypto = require('node:crypto');
import { ProductionMatch, comparableProductionState, productionStateKey } from '../src/engine/production-match';

export function diffProductionStates(actual: any, expected: any, path = ''): any[] {
    if (JSON.stringify(actual) === JSON.stringify(expected)) return [];
    if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') return [{ path, actual, expected }];
    return [...new Set([...Object.keys(actual), ...Object.keys(expected)])]
        .flatMap(key => diffProductionStates(actual[key], expected[key], `${path}/${key}`)).slice(0, 40);
}

/** Replay saved real-browser input/output snapshots, then independently check
 * the gap between commands using only the shared turn-start phase. A state
 * reset per command can validate transitions but cannot hide boundary drift. */
export function verifyProductionReplay(file: string) {
    const bytes = fs.readFileSync(file);
    const trace = JSON.parse((file.endsWith('.gz') ? zlib.gunzipSync(bytes) : bytes).toString());
    const records = trace.audit?.records;
    if (!Array.isArray(records) || !records.length) throw new Error('Expected a saved browser action trace');
    const differences: any[] = [];
    let actions = 0, boundaries = 0, rejections = 0;
    for (let index = 0; index < records.length; index++) {
        const record = records[index], match = new ProductionMatch(record.before);
        const options = record.options || { skipTurnStart: true, currentStateVersion: record.before.cardState.turnIndex };
        const result = match.apply(record.action, options, record.player);
        actions++;
        if (!result.ok) rejections++;
        if (result.ok !== record.ok || productionStateKey(result.after) !== productionStateKey(record.after)) {
            differences.push({ index, kind: 'action', action: record.action, ok: result.ok, expectedOk: record.ok,
                diff: diffProductionStates(comparableProductionState(result.after), comparableProductionState(record.after)) });
        }
        const next = records[index + 1];
        if (!next || !record.ok || match.terminal) continue;
        // A boundary may include an extra turn for the same color. Turn number
        // and the canonical start marker together identify that case.
        const after = match.snapshot();
        if (after.cardState.lastTurnStartedFor !== match.owner) match.startTurn();
        boundaries++;
        if (productionStateKey(match.snapshot()) !== productionStateKey(next.before)) {
            differences.push({ index, kind: 'boundary', action: record.action,
                diff: diffProductionStates(comparableProductionState(match.snapshot()), comparableProductionState(next.before)) });
        }
    }
    return { file, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), actions, boundaries, rejections,
        valid: differences.length === 0, differences };
}

if (require.main === module) {
    const [output, ...files] = process.argv.slice(2);
    if (!output || !files.length) throw new Error('Usage: verify-production-replay <report.json> <browser-trace.json.gz> [...]');
    const report = { schema: 'production-selfplay-replay.v1', createdAt: new Date().toISOString(),
        traces: files.map(verifyProductionReplay) };
    fs.writeFileSync(output, JSON.stringify(report, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(report.traces.map(({ differences, ...result }) => ({ ...result, mismatches: differences.length, first: differences.slice(0, 3) }))));
    if (report.traces.some(result => !result.valid)) process.exitCode = 1;
}
