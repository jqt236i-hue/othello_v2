import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import Runner = require('./run-ui-level-match');
import { installCpuDecisionAudit } from './cpu-decision-audit-browser';

async function main() {
    const argv = process.argv.slice(2);
    const get = (flag: string, fallback: string) => argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : fallback;
    const outputArg = get('--out', '');
    const out = path.resolve(outputArg);
    const seed = Number(get('--seed', '19071001'));
    const games = Number(get('--games', '4'));
    if (!outputArg || !Number.isSafeInteger(seed) || !Number.isSafeInteger(games) || games < 1 || games > 4) throw new Error('Invalid audit limits');
    fs.mkdirSync(out, { recursive: true });
    const manifest = JSON.parse(fs.readFileSync('data/runs/shared_decision_20260906_continue/baseline-manifest.json', 'utf8'));
    const unchanged = () => manifest.files.every((file: any) =>
        createHash('sha256').update(fs.readFileSync(file.source)).digest('hex') === file.sha256);
    if (!unchanged()) throw new Error('Frozen baseline changed');
    for (let i = 0; i < games; i++) {
        const output = path.join(out, `capture-${seed + i}.json`);
        if (fs.existsSync(output)) throw new Error('Refusing to overwrite audit');
        console.log(`[audit] game ${i + 1}/${games} seed=${seed + i}`);
        const result = await Runner.runMatch({ black: 6, white: 6, seed: seed + i, timeoutMs: 300000,
            headless: true, onnxWaitMs: 30000, candidateProbe: { bundle: { schema: 'candidate_probe.v1', heads: {} }, color: 'white', heads: [], classic: true },
            setupPage: (page: any) => page.evaluate(installCpuDecisionAudit, { maxRecords: 200 }),
            collectPage: (page: any) => page.evaluate(() => (window as any).__cpuDecisionAudit),
            onProgress: (progress: any) => fs.writeFileSync(path.join(out, 'progress.json'), JSON.stringify({ seed: seed + i, progress })) });
        const replayValid = result.audit?.records?.length > 0 && result.audit?.decisions?.length > 0 &&
            result.audit.records.every((item: any) => item.replayMatched && item.liveStateUnchanged) &&
            result.audit.decisions.every((item: any) => item.replayMatched && item.stateUnchanged);
        const valid = replayValid && unchanged() && result.runtimeStatus.othello?.loaded === true && result.pageErrors.length === 0 &&
            !result.consoleMessages.some((item: any) => /WATCHDOG fired|runtime failed/.test(item.text));
        fs.writeFileSync(output, JSON.stringify({ schema: 'cpu_decision_audit.v1', promotionAllowed: false,
            baselineFiles: manifest.files, baselineUnchanged: unchanged(), valid, ...result }), { flag: 'wx' });
        console.log(`[audit] completed valid=${valid} actions=${result.audit.records.length} decisions=${result.audit.decisions.length}`);
        if (!valid) throw new Error('Invalid game; aborting capture');
    }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
