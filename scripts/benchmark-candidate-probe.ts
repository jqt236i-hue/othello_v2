import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import Runner = require('./run-ui-level-match');

export function summarizePairs(records: any[]) {
    return [...new Set(records.map(record => record.head))].map(head => {
        const pair = records.filter(record => record.head === head);
        const initialStateMatched = pair.length === 2 && !!pair[0].initialStateHash &&
            pair[0].initialStateHash === pair[1].initialStateHash;
        const eligible = initialStateMatched && new Set(pair.map(record => record.color)).size === 2 &&
            pair.every(record => record.status === 'completed' && record.validSimulation && record.exercised);
        return { head, initialStateMatched, eligible, score: eligible ? pair.reduce((sum, record) => sum + record.score, 0) : null };
    });
}

async function main() {
    const argv = process.argv.slice(2);
    const get = (flag: string, fallback: string) => argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : fallback;
    const bundlePath = path.resolve(get('--bundle', ''));
    const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    const baseline = JSON.parse(fs.readFileSync(path.join(path.dirname(bundlePath), 'baseline-manifest.json'), 'utf8'));
    const verifyBaseline = () => baseline.files.every((file: any) =>
        createHash('sha256').update(fs.readFileSync(file.source)).digest('hex') === file.sha256);
    if (!verifyBaseline()) throw new Error('Current baseline differs from the frozen baseline');
    const out = path.resolve(get('--out', ''));
    if (fs.existsSync(out)) throw new Error('Refusing to overwrite an experiment');
    const variants = get('--heads', 'place,card,target,value').split(',');
    const seed = Number(get('--seed', '19062026'));
    if (!Number.isSafeInteger(seed) || seed < 1 || variants.some(head => !['baseline', 'place', 'card', 'target', 'value'].includes(head))) {
        throw new Error('Invalid seed or candidate head');
    }
    const classic = !argv.includes('--vite');
    const records: any[] = [];
    const write = () => fs.writeFileSync(out, JSON.stringify({ schema: 'candidate_probe_results.v1',
        purpose: 'wiring-and-ablation-screen-only', promotionAllowed: false, lane: classic ? 'classic' : 'vite', seed, baselineFiles: baseline.files,
        modelHashes: Object.fromEntries(Object.entries(bundle.heads).map(([k, v]: [string, any]) => [k, v.sha256])),
        pairs: summarizePairs(records), records }, null, 2));
    write();
    for (const head of variants) {
        for (const color of ['black', 'white']) {
            const record: any = { head, color, status: 'running' }; records.push(record); write();
            console.log(`[candidate-probe] ${head} ${color} start`);
            try {
                const result = await Runner.runMatch({ black: 6, white: 6, seed, timeoutMs: 300000,
                    headless: true, requireOnnxLoaded: false, onnxWaitMs: 30000,
                    onProgress: (progress: any) => { record.progress = progress; write(); },
                    candidateProbe: { bundle, color, heads: head === 'baseline' ? [] : [head], classic } });
                const { initialState, ...publicResult } = result;
                Object.assign(record, { status: 'completed', ...publicResult,
                    exercised: Number(result.runtimeStatus.candidate?.used?.[head] || 0) > 0,
                    baselineUnchanged: verifyBaseline(),
                    validSimulation: verifyBaseline() && result.runtimeStatus.othello?.loaded === true &&
                        result.runtimeStatus.othello.chooseMoveCalls > 0 && result.pageErrors.length === 0 &&
                        !result.consoleMessages.some((m: any) => /WATCHDOG fired|runtime failed/.test(m.text)),
                    initialStateHash: createHash('sha256').update(initialState).digest('hex'),
                    score: result.result.winner === 'draw' ? 0.5 : result.result.winner === color ? 1 : 0 });
            } catch (error) { Object.assign(record, { status: 'failed', error: String(error) }); }
            write();
            console.log(`[candidate-probe] ${head} ${color} ${record.status} score=${record.score ?? 'n/a'}`);
        }
    }
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
