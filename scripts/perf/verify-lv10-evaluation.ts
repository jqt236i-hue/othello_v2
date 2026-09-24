#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import { loadCpuSearchFixtures } from './measure-cpu-search';

/** Lv10 evaluator differential regression, the Lv10 counterpart of
 * verify-production-optimization. Both roots evaluate independent copies of
 * the same sampled positions and their one- and two-action successors; values
 * must be Object.is equal and inputs must stay unchanged. Positions come from
 * the committed CPU search fixtures, never from live private data. */
export function verifyLv10Evaluation(baseline: string, candidate: string, output?: string) {
    const roots = [baseline, candidate].map((root) => path.resolve(root));
    const fingerprint = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const evaluators = roots.map((root) => require(path.join(root, 'dist/game/ai/cpu-lv10-search')).evaluateLv10Position);
    const Position = require(path.join(roots[1], 'dist/game/ai/cpu-lv10-position'));
    const Search = require(path.join(roots[1], 'dist/game/ai/cpu-lv10-search'));
    const fixtures = loadCpuSearchFixtures(process.cwd(), path.join(roots[1], 'dist'));
    const failures: any[] = [];
    let states = 0, comparisons = 0;
    function check(state: any, source: string) {
        states++;
        for (const player of ['black', 'white']) {
            const copies = [JSON.parse(JSON.stringify(state)), JSON.parse(JSON.stringify(state))];
            const before = copies.map((copy) => JSON.stringify(copy));
            const values = copies.map((copy, index) => evaluators[index](copy, player));
            comparisons++;
            const mutated = copies.map((copy, index) => JSON.stringify(copy) !== before[index]);
            if (!Object.is(values[0], values[1]) || mutated.some(Boolean)) failures.push({ source, player, values, mutated });
        }
    }
    for (const fixture of fixtures) {
        for (const seed of Search.LV10_SEARCH_CONFIG.scenarioSeeds) {
            const root = Position.sampleLv10Position(fixture.observation, seed, fixture.publicRecipes);
            check(root, `${fixture.id}/${seed}`);
            const first = Position.enumerateLv10Actions(root).slice(0, 12);
            first.forEach((action: any, index: number) => {
                const next = Position.applyLv10Action(root, action);
                if (!next.ok) return;
                check(next.state, `${fixture.id}/${seed}/${index}`);
                Position.enumerateLv10Actions(next.state).slice(0, 4).forEach((reply: any, replyIndex: number) => {
                    const after = Position.applyLv10Action(next.state, reply);
                    if (after.ok) check(after.state, `${fixture.id}/${seed}/${index}/${replyIndex}`);
                });
            });
        }
    }
    const result = {
        schema: 'lv10-evaluation-regression.v1', roots,
        evaluatorHashes: roots.map((root) => fingerprint(path.join(root, 'dist/game/ai/cpu-lv10-search.js'))),
        fixtureIds: fixtures.map((fixture) => fixture.id), states, comparisons, failures, valid: failures.length === 0
    };
    if (output) fs.writeFileSync(output, JSON.stringify(result, null, 2), { flag: 'wx' });
    return { states, comparisons, failures: failures.length, valid: result.valid };
}

if (require.main === module) {
    try {
        const result = verifyLv10Evaluation(process.argv[2], process.argv[3], process.argv[4]);
        console.log(JSON.stringify(result));
        if (!result.valid) process.exitCode = 1;
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
}
