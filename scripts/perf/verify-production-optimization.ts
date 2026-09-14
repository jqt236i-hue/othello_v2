#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import zlib = require('node:zlib');
import crypto = require('node:crypto');

/** Differential regression, separate from timed campaigns. Both evaluators
 * receive independent copies of the same complete state, including pending,
 * costs, controller, markers and PRNG. Neither receives live private data. */
export function verifyProductionOptimization(baseline: string, candidate: string, cardDirectory: string, cohortDirectory: string, output: string) {
    if (fs.existsSync(output)) throw new Error('Regression output already exists');
    const cwd = process.cwd(), fingerprint = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const roots = [baseline, candidate].map(root => path.resolve(root));
    const evaluations = roots.map(root => {
        try { process.chdir(root); return require(path.join(root, 'dist/game/ai/cpu-lv11-evaluation')).evaluateLv11Position; }
        finally { process.chdir(cwd); }
    });
    const failures: any[] = [], inputs: any[] = [];
    let states = 0, comparisons = 0;
    function check(state: any, source: string) {
        states++;
        for (const player of ['black', 'white']) {
            const copies = [JSON.parse(JSON.stringify(state)), JSON.parse(JSON.stringify(state))];
            const before = copies.map(copy => JSON.stringify(copy));
            const values = copies.map((copy, index) => evaluations[index](copy, player)); comparisons++;
            if (!Object.is(values[0], values[1]) || copies.some((copy, index) => JSON.stringify(copy) !== before[index])) {
                failures.push({ source, player, values, mutated: copies.map((copy, index) => JSON.stringify(copy) !== before[index]), state });
            }
        }
    }
    for (const file of fs.readdirSync(cardDirectory).filter(file => file.endsWith('.json.gz')).sort()) {
        const absolute = path.resolve(cardDirectory, file), data = JSON.parse(zlib.gunzipSync(fs.readFileSync(absolute)).toString());
        inputs.push({ file: absolute, sha256: fingerprint(absolute) });
        check(data.fixture.initial, file + '/initial');
        data.fixture.transitions.forEach((step: any, index: number) => check(step.after, `${file}/${index}`));
    }
    const privateFile = path.resolve(cohortDirectory, 'private-regression.json');
    inputs.push({ file: privateFile, sha256: fingerprint(privateFile) });
    for (const item of JSON.parse(fs.readFileSync(privateFile, 'utf8')).positions) check(item.state, item.id);
    const result = { schema: 'production-optimization-regression.v1', roots, evaluatorHashes: roots.map(root => fingerprint(path.join(root, 'dist/game/ai/cpu-lv11-evaluation.js'))),
        states, comparisons, inputs, failures, valid: failures.length === 0 };
    fs.writeFileSync(output, JSON.stringify(result, null, 2), { flag: 'wx' });
    return { output, states, comparisons, failures: failures.length, valid: result.valid };
}
if (require.main === module) {
    try { const result = verifyProductionOptimization(process.argv[2], process.argv[3], process.argv[4], process.argv[5], process.argv[6]);
        console.log(JSON.stringify(result)); if (!result.valid) process.exitCode = 1; }
    catch (error) { console.error(error); process.exitCode = 1; }
}
