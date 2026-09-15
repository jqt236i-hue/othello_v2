#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import { productionStateKey } from '../src/engine/production-match';

const hash = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');

/** Audits every journal entry and the original deal across resume attempts.
 * A result JSON or a terminal-looking board cannot replace this evidence. */
export function verifyProductionSelfplay(directory: string, seen = new Set<string>(), runtimeOverride?: string, recoverySummary?: any): any {
    const absolute = path.resolve(directory);
    if (seen.has(absolute)) throw new Error('Cyclic selfplay resume chain'); seen.add(absolute);
    const manifest = JSON.parse(fs.readFileSync(path.join(absolute, 'manifest.json'), 'utf8'));
    const runtimeRoot = path.resolve(runtimeOverride || manifest.commonRuntime.root);
    const runtime = require(path.join(runtimeRoot, 'dist/src/engine/production-match'));
    const { ProductionMatch, createProductionPosition } = runtime;
    // Recovery may validate a proposed summary before writing it. Every action,
    // count, state and winner is still established by the canonical replay.
    const result = recoverySummary || JSON.parse(fs.readFileSync(path.join(absolute, 'result.json'), 'utf8'));
    if (hash(JSON.stringify(manifest.identity)) !== manifest.identityHash) throw new Error('Game identity metadata changed');
    const journalBytes = fs.readFileSync(path.join(absolute, 'steps.ndjson'));
    const text = journalBytes.toString();
    if (!text.endsWith('\n')) throw new Error('Truncated selfplay journal');
    const rows = text.trimEnd().split('\n').map(line => JSON.parse(line));
    if (rows[0]?.kind !== 'initial') throw new Error('Missing initial journal entry');
    let previous: any = null;
    if (manifest.sourceCheckpoint) {
        previous = verifyProductionSelfplay(path.dirname(manifest.sourceCheckpoint), seen, runtimeOverride);
        if (previous.identityHash !== manifest.identityHash || previous.finalStateKey !== productionStateKey(rows[0].state)) {
            throw new Error('Resume changed state or runtime identity');
        }
    } else {
        const initial = createProductionPosition(manifest.identity.seed, manifest.identity.profiles);
        if (productionStateKey(initial) !== productionStateKey(rows[0].state)) throw new Error('Recorded initial deal differs from its declared seed/profiles');
    }
    if (hash(productionStateKey(manifest.initial)) !== manifest.initialSha256
        || productionStateKey(manifest.initial) !== productionStateKey(rows[0].state)) throw new Error('Initial state hash mismatch');
    const match = new ProductionMatch(rows[0].state);
    const decisionRecords = [...(previous?.decisionRecords || [])];
    let count = previous?.decisions || 0, rejections = previous?.rejections || 0, transitionCount = previous?.transitionCount || 0;
    if (rows[0].index !== count) throw new Error('Initial resume decision count differs');
    for (const row of rows.slice(1)) {
        if (!['decision', 'settlement'].includes(row.kind)) throw new Error('Unknown journal record');
        for (const expected of row.transitions) {
            if (productionStateKey(match.snapshot()) !== productionStateKey(expected.before)) throw new Error(`State gap before decision ${row.index}`);
            const actual = expected.kind === 'turn_start' ? match.startTurn() : match.apply(expected.action);
            if (actual.ok !== expected.ok || productionStateKey(actual.after) !== productionStateKey(expected.after)) throw new Error(`Transition mismatch at decision ${row.index}`);
            if (!actual.ok) rejections++;
            transitionCount++;
        }
        if (row.kind === 'decision') {
            count++;
            const applied = row.transitions.filter((transition: any) => transition.kind === 'action');
            if (row.index !== count || applied.length !== 1 || JSON.stringify(applied[0].action) !== JSON.stringify(row.decision.action)
                || (row.decision.outcome === 'applied') !== applied[0].ok) throw new Error(`Decision/action/count mismatch: ${row.index}`);
            const policy = manifest.identity.policies[row.player];
            if (!policy || row.decision.player !== row.player) throw new Error('Decision owner/profile mismatch');
            const search = row.decision.search;
            if (search && (search.version !== policy.config.version || search.transitions > policy.config.maxTransitions)) throw new Error('Decision exceeded declared production configuration');
            decisionRecords.push(row.decision);
        } else if (row.index !== count) throw new Error('Settlement duplicated or skipped decisions');
        if (productionStateKey(match.snapshot()) !== productionStateKey(row.state)) throw new Error(`Post-decision snapshot differs: ${row.index}`);
    }
    const finalStateKey = productionStateKey(match.snapshot());
    if (result.identityHash !== manifest.identityHash || count !== result.decisions || hash(finalStateKey) !== result.finalStateHash) throw new Error('Result summary does not match the journal');
    if ((result.status === 'complete') !== match.terminal) throw new Error('Completion is not established by canonical rules');
    if (match.terminal && JSON.stringify(match.result()) !== JSON.stringify(result.result)) throw new Error('Winner/counts differ from replay');
    return { valid: true, directory: absolute, identityHash: manifest.identityHash, status: result.status,
        decisions: count, transitionCount, rejections, decisionRecords, journalSha256: hash(journalBytes),
        initialSha256: previous?.initialSha256 || manifest.initialSha256,
        result: result.result, finalStateKey, finalStateHash: hash(finalStateKey) };
}

if (require.main === module) {
    try {
        const result = verifyProductionSelfplay(process.argv[2]);
        const { finalStateKey: _state, decisionRecords: _decisions, ...report } = result;
        if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2), { flag: 'wx' });
        console.log(JSON.stringify(report));
    } catch (error) { console.error(error); process.exitCode = 1; }
}
