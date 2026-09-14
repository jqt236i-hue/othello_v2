#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');

/** Export any saved decision as a reusable position. Optional rejudgment uses
 * the frozen policy and its real clock; --fixed-compute explicitly requests a
 * calculation-only comparison and is never a strength-evaluation mode. */
export function inspectProductionDecision(directoryInput: string, index: number, rejudge = false, fixedCompute = false): any {
    if (!Number.isInteger(index) || index < 1) throw new Error('Decision index must be a positive integer');
    const directory = path.resolve(directoryInput);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    const rows = fs.readFileSync(path.join(directory, 'steps.ndjson'), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    const row = rows.find(row => row.kind === 'decision' && row.index === index);
    if (!row && manifest.sourceCheckpoint) return inspectProductionDecision(path.dirname(manifest.sourceCheckpoint), index, rejudge, fixedCompute);
    if (!row) throw new Error('Decision index is not present in this saved attempt chain');
    const command = row.transitions.find((transition: any) => transition.kind === 'action');
    const policy = manifest.identity.policies[row.player], spec = policy.spec;
    const observe = require(path.join(spec.root, 'dist/game/ai/cpu-lv10-observation')).observeLv10Position;
    const startup = require(path.join(manifest.commonRuntime.root, 'dist/shared/cpu-opponent-startup-options'));
    const observation = observe(command.before, row.player);
    const publicRecipes = Object.fromEntries(['black', 'white'].map(side => [side, startup.getCpuOpponentDeckCardIds(manifest.identity.profiles[side])]));
    const record: any = { schema: 'production-decision-position.v1', source: directory, index,
        identityHash: manifest.identityHash, policy, actual: row.decision,
        observation, publicRecipes, authoritativeBefore: command.before, authoritativeAfter: command.after,
        excludedActions: row.decision.excludedActions || [] };
    if (rejudge) {
        const search = require(path.join(spec.root, 'dist', spec.module))[spec.search];
        record.rejudgment = search(observation, { publicRecipes, excludedActions: record.excludedActions,
            maxTransitions: policy.config.maxTransitions, maxMs: policy.config.maxMs,
            ...(fixedCompute ? {} : { now: () => performance.now() }) });
        record.rejudgmentMode = fixedCompute ? 'fixed calculation only; no time limit; never strength evidence' : 'production clock and budget; timing can change the action';
    }
    return record;
}

if (require.main === module) {
    try {
        const args = process.argv.slice(2);
        const result = inspectProductionDecision(args[0], Number(args[1]), args.includes('--rejudge'), args.includes('--fixed-compute'));
        fs.writeFileSync(args[2], JSON.stringify(result, null, 2), { flag: 'wx' });
        console.log(JSON.stringify({ output: path.resolve(args[2]), index: result.index, actual: result.actual.action,
            rejudgment: result.rejudgment?.action, mode: result.rejudgmentMode || 'recorded position only' }));
    } catch (error) { console.error(error); process.exitCode = 1; }
}
