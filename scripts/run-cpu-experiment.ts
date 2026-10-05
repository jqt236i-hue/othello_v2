#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import os = require('node:os');
import { spawn } from 'node:child_process';
import { productionRuntimeManifest, type ProductionGameSpec } from './run-production-selfplay';
import { experimentProtocol, makeExperimentSchedule, summarizeExperiment, runExperimentSchedule, type ExperimentSpec, type ExperimentSlot, type ExperimentScore } from './cpu-experiment-protocol';
import { freezeProductionRuntime } from './freeze-production-runtime';
import { verifyProductionParityGate } from './production-parity-gate';
import { loadAuditedDevelopmentSet } from './cpu-development-set';

const hash = (bytes: Buffer | string) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeNew = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value, null, 2), { flag: 'wx' });

/** Include Lv12's sampling/model helpers as well as search and evaluation.
 * The separately frozen runtime still binds every shared rule dependency. */
export function lv12PolicyFingerprint(root:string, level: 'lv12' | 'lv13' = 'lv12'){
    const directory=path.join(root,'dist/game/ai');
    const names=fs.readdirSync(directory).filter(name=>new RegExp(`^cpu-${level}-[a-z0-9-]+\\.js$`).test(name)).sort();
    if(!names.includes(`cpu-${level}-search.js`)||!names.includes(`cpu-${level}-evaluation.js`))throw new Error(`${level} policy is incomplete`);
    const files=names.map(name=>({name,sha256:hash(fs.readFileSync(path.join(directory,name)))}));
    return {files,sha256:hash(JSON.stringify(files))};
}

export function collectIssuedSeeds(value: any, target = new Set<number>()): Set<number> {
    if (!value || typeof value !== 'object') return target;
    if (Number.isInteger(value.seed)) target.add(value.seed);
    if (Array.isArray(value.seeds)) for (const seed of value.seeds) if (Number.isInteger(seed)) target.add(seed);
    for (const child of Object.values(value)) if (child && typeof child === 'object') collectIssuedSeeds(child, target);
    return target;
}

export function declareExperiment(specInput: ExperimentSpec) {
    const ledgerPath = `data/cpu-${specInput.acceptance || 'lv11'}/issued-conditions.json`;
    const spec = { ...specInput, out: path.resolve(specInput.out),
        candidate: { ...specInput.candidate, root: path.resolve(specInput.candidate.root) },
        opponent: { ...specInput.opponent, root: path.resolve(specInput.opponent.root) } };
    if (fs.existsSync(spec.out)) throw new Error('Experiment output already exists');
    const oldLedgerFile = 'data/cpu-lv10/issued-conditions.json';
    const oldLedger = read(oldLedgerFile), ledger = fs.existsSync(ledgerPath) ? read(ledgerPath) : [];
    const used = collectIssuedSeeds([oldLedger, ledger, ...['lv11','lv12','lv13'].map(level=>`data/cpu-${level}/issued-conditions.json`).filter(file=>fs.existsSync(file)).map(read)]);
    let replaySchedule: ExperimentSlot[] | undefined;
    let developmentReplayEvidence: unknown;
    let developmentRulesRoot: string | undefined;
    if (spec.developmentSet) {
        if (spec.mode !== 'development' || !['lv12','lv13'].includes(spec.acceptance || '') || spec.developmentReplayOf) throw new Error('Common development conditions cannot be used for acceptance or combined with another replay');
        const fixed = loadAuditedDevelopmentSet(spec.developmentSet, spec.acceptance === 'lv13' ? read('data/cpu-lv12/issued-conditions.json') : ledger);
        replaySchedule = fixed.schedule;
        developmentReplayEvidence = fixed.evidence;
        developmentRulesRoot = path.resolve(spec.acceptance === 'lv13' ? 'data/cpu-lv13/baseline-start/repo' : fixed.rulesRuntime.root);
        if (productionRuntimeManifest(fixed.rulesRuntime.root).sha256 !== fixed.rulesRuntime.sha256) throw new Error('Common development rules runtime changed');
    }
    if (spec.developmentReplayOf) {
        if (spec.mode !== 'development' || spec.acceptance !== 'lv12') throw new Error('Formal conditions cannot be replayed for acceptance');
        const sourceFile = path.resolve(spec.developmentReplayOf.manifest), auditFile = path.resolve(spec.developmentReplayOf.audit);
        const source = read(sourceFile), audit = read(auditFile), sourceSha256 = hash(fs.readFileSync(sourceFile));
        if (source.spec?.mode !== 'acceptance' || source.spec?.acceptance !== 'lv12'
            || audit.valid !== true || audit.manifestSha256 !== sourceSha256 || (!audit.earlyStopped && !audit.complete)
            || !ledger.some((entry: any) => entry.mode === 'acceptance' && path.resolve(entry.directory) === path.dirname(sourceFile))) {
            throw new Error('Development replay requires an issued, finished and audited Lv12 formal trial');
        }
        replaySchedule = source.schedule.slice(0, 10);
        developmentReplayEvidence = { source: { path: sourceFile, sha256: sourceSha256 },
            audit: { path: auditFile, sha256: hash(fs.readFileSync(auditFile)) },
            scope: 'Development-only replay of every declared first-ten pair, in the same order. These conditions remain ineligible for all formal evaluations.' };
    }
    const schedule = makeExperimentSchedule(spec, used, replaySchedule);
    const roots = [...new Set([process.cwd(), spec.candidate.root, spec.opponent.root, ...(developmentRulesRoot ? [developmentRulesRoot] : [])])];
    let parityEvidence: ReturnType<typeof verifyProductionParityGate> | undefined;
    if (spec.acceptance === 'lv13') {
        const baseline = path.resolve('data/cpu-lv13/baseline-start/repo');
        const baselineManifest = read('data/cpu-lv13/baseline-start/manifest.json');
        if (baselineManifest.sha256 !== '3b3ffbcfc68cff774b6b01c69573dfcbc0283d3559b137599a28dcbbd8ae8ba6'
            || productionRuntimeManifest(baseline).sha256 !== baselineManifest.sha256) throw new Error('Starting Lv12 baseline changed');
        if (spec.opponent.root !== baseline || spec.opponent.module !== 'game/ai/cpu-lv12-search'
            || spec.opponent.search !== 'searchLv12' || spec.opponent.config !== 'LV12_SEARCH_CONFIG'
            || spec.opponent.maxMs !== undefined || spec.opponent.maxTransitions !== undefined
            || spec.opponent.turnModule) throw new Error('Lv13 requires unchanged starting Lv12');
        if ((spec.candidateProfile ?? 12) !== 12 || (spec.opponentProfile ?? 12) !== 12) throw new Error('Lv13 comparison requires identical level 12 game conditions');
        if (spec.candidate.module !== 'game/ai/cpu-lv13-search' || spec.candidate.search !== 'searchLv13'
            || spec.candidate.config !== 'LV13_SEARCH_CONFIG' || spec.candidate.maxMs !== undefined
            || spec.candidate.maxTransitions !== undefined || spec.candidate.turnModule) throw new Error('Lv13 requires the unchanged declared production policy');
        const config = require(path.join(spec.candidate.root,'dist',spec.candidate.module))[spec.candidate.config];
        if (config.maxTransitions !== 4096 || config.maxMs !== 5500) throw new Error('Lv13 requires 4096 transitions and 5500 ms');
        if (spec.mode === 'acceptance') {
            const fingerprint = lv12PolicyFingerprint(spec.candidate.root,'lv13').sha256;
            if (ledger.some((entry:any)=>entry.mode==='acceptance' && entry.candidatePolicySha256===fingerprint)) throw new Error('Unchanged candidate cannot be redrawn');
            parityEvidence = verifyProductionParityGate(spec.parityGateFile!,process.cwd(),spec.candidate.root);
        }
    } else if ((spec.mode === 'acceptance' && spec.acceptance === 'lv12') || spec.developmentSet) {
        const baseline = path.resolve('data/cpu-lv12/baseline-start/repo');
        const baselineManifestFile = path.resolve('data/cpu-lv12/baseline-start/manifest.json');
        if (hash(fs.readFileSync(baselineManifestFile)) !== '8dc3d1d776b1e1dff2d4de09ca6783ccf1cf4e06d258381406acc35dcb3924fd'
            || productionRuntimeManifest(baseline).sha256 !== read(baselineManifestFile).sha256) throw new Error('Starting Lv11 baseline changed');
        if (spec.opponent.root !== baseline || spec.opponent.module !== 'game/ai/cpu-lv11-search'
            || spec.opponent.search !== 'searchLv11' || spec.opponent.config !== 'LV11_SEARCH_CONFIG'
            || spec.opponent.maxMs !== undefined || spec.opponent.maxTransitions !== undefined
            || (spec.opponent.turnModule && spec.opponent.turnModule !== 'game/cpu-lv10-turn')) throw new Error('Lv12 requires the frozen starting Lv11 opponent');
        if (spec.candidate.module !== 'game/ai/cpu-lv12-search' || spec.candidate.search !== 'searchLv12'
            || spec.candidate.config !== 'LV12_SEARCH_CONFIG' || spec.candidate.maxMs !== undefined || spec.candidate.maxTransitions !== undefined
            || (spec.candidate.turnModule && spec.candidate.turnModule !== 'game/cpu-lv10-turn')) throw new Error('Lv12 requires its normal production policy');
        for (const policy of [spec.candidate, spec.opponent]) {
            const config = require(path.join(policy.root, 'dist', policy.module))[policy.config];
            if (config.maxTransitions !== 4096 || config.maxMs !== 4800) throw new Error('Both CPUs must use 4096 transitions / 4800 ms');
        }
        if (spec.candidateProfile !== 11 || spec.opponentProfile !== 11) throw new Error('Lv12 evaluation uses identical Lv11 conditions on both seats');
        if (spec.mode === 'acceptance') {
            const previousCandidates = ledger.filter((entry: any) => entry.mode === 'acceptance').map((entry: any) => entry.candidatePolicySha256);
            const candidatePolicySha256 = lv12PolicyFingerprint(spec.candidate.root).sha256;
            if (previousCandidates.includes(candidatePolicySha256)) throw new Error('An unchanged candidate cannot be redrawn on new formal conditions');
            parityEvidence = verifyProductionParityGate(spec.parityGateFile!, process.cwd(), spec.candidate.root);
        }
    } else if (spec.mode === 'acceptance') {
        const baseline = path.resolve('data/cpu-lv11/baseline-start/repo');
        if (spec.opponent.root !== baseline || spec.opponent.module !== 'game/ai/cpu-lv10-search'
            || spec.opponent.search !== 'searchLv10' || spec.opponent.config !== 'LV10_SEARCH_CONFIG'
            || spec.opponent.maxMs !== undefined || spec.opponent.maxTransitions !== undefined
            || (spec.opponent.turnModule && spec.opponent.turnModule !== 'game/cpu-lv10-turn')) {
            throw new Error('Acceptance opponent must be the unchanged start-of-task Lv10 with production budgets');
        }
        if (spec.candidate.module !== 'game/ai/cpu-lv11-search' || spec.candidate.search !== 'searchLv11' || spec.candidate.config !== 'LV11_SEARCH_CONFIG'
            || spec.candidate.maxMs !== undefined || spec.candidate.maxTransitions !== undefined) {
            throw new Error('Acceptance requires the production Lv11 policy and its unmodified budget');
        }
        if ((spec.candidateProfile ?? 10) !== 10 || (spec.opponentProfile ?? 10) !== 10) throw new Error('Acceptance uses the identical frozen Lv10 privileges on both seats');
        const baselineManifestFile = path.resolve('data/cpu-lv11/baseline-start/manifest.json');
        if (hash(fs.readFileSync(baselineManifestFile)) !== 'b8e777e246be1fbee09273447027065adaffa18b7f5f78ee25144f87ba2198b3') throw new Error('Start-of-task baseline manifest changed');
        const baselineFiles = new Map(read(baselineManifestFile).files.map((file: any) => [file.path, file.sha256]));
        for (const file of productionRuntimeManifest(baseline).files) if (baselineFiles.get(file.path) !== file.sha256) throw new Error('Start-of-task baseline runtime changed');
        // The reports must cover these exact runtimes, not just contain a
        // passing boolean from an earlier candidate or game build.
        const gateFile = spec.parityGateFile || 'data/cpu-lv11/production-parity-gate.json';
        parityEvidence = verifyProductionParityGate(gateFile, process.cwd(), spec.candidate.root);
    }
    fs.mkdirSync(spec.out, { recursive: true });
    const disk = fs.statfsSync(spec.out);
    if (disk.bavail * disk.bsize < 2 * 1024 ** 3) throw new Error('Less than 2 GiB of disk space available for the experiment');
    const frozen = roots.map((root, index) => ({ originalRoot: root,
        manifest: freezeProductionRuntime(root, path.join(spec.out, 'runtimes', String(index))) }));
    const frozenRoot = (root: string) => frozen.find(entry => entry.originalRoot === root)!.manifest.root;
    const executionSpec = { ...spec, candidate: { ...spec.candidate, root: frozenRoot(spec.candidate.root) },
        opponent: { ...spec.opponent, root: frozenRoot(spec.opponent.root) } };
    const commonRoot = frozenRoot(developmentRulesRoot || process.cwd()), runtimes = frozen.map(entry => entry.manifest);
    const executable = path.join(spec.out, 'runtimes', path.basename(process.execPath));
    fs.copyFileSync(process.execPath, executable, fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(__filename, path.join(spec.out, 'driver-at-declaration.js'), fs.constants.COPYFILE_EXCL);
    const coordinatorFiles = [__filename, ...['cpu-experiment-protocol.js', 'cpu-development-set.js', 'freeze-production-runtime.js', 'production-parity-gate.js', 'verify-production-replay.js'].map(name => path.join(__dirname, name))]
        .map(source => {
            const destination = path.join(commonRoot, 'dist/scripts', path.basename(source));
            const bytes = fs.readFileSync(source);
            if (fs.existsSync(destination)) {
                if (hash(fs.readFileSync(destination)) !== hash(bytes)) throw new Error('Coordinator snapshot collision');
            } else fs.writeFileSync(destination, bytes, { flag: 'wx' });
            return { path: destination, sha256: hash(bytes) };
        });
    const coordinator = { entry: coordinatorFiles[0].path, files: coordinatorFiles };
    const manifest = { schema: 'cpu-experiment.v3', spec, executionSpec, commonRoot, executable, coordinator,
        executableSha256: hash(fs.readFileSync(executable)), ...schedule, runtimes, frozenRoots: frozen.map(entry => ({ original: entry.originalRoot, frozen: entry.manifest.root })),
        driverSha256: hash(fs.readFileSync(__filename)), createdAt: new Date().toISOString(), parityEvidence,
        environment: { platform: process.platform, arch: process.arch, node: process.version, osRelease: os.release(),
            cpuModel: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemory: os.totalmem(),
            freeMemoryAtDeclaration: os.freemem(), concurrency: spec.concurrency,
            timing: 'Both seats use the same production monotonic clock; check limits at transition boundaries',
            loadPolicy: 'No additional selfplay process, training, build or heavy verification while matches run' },
        protocol: experimentProtocol(spec), developmentReplayEvidence,
        ...(['lv12','lv13'].includes(spec.acceptance || '')?{candidatePolicyFingerprint:lv12PolicyFingerprint(spec.candidate.root,spec.acceptance as 'lv12'|'lv13')}:{}),
        seedAudit: { excluded: used.size, oldLedgerSha256: hash(fs.readFileSync(oldLedgerFile)),
            currentLedgerSha256: fs.existsSync(ledgerPath) ? hash(fs.readFileSync(ledgerPath)) : null } };
    writeNew(path.join(spec.out, 'manifest.json'), manifest);
    writeNew(path.join(spec.out, 'manifest-sha256.json'), { sha256: hash(fs.readFileSync(path.join(spec.out, 'manifest.json'))) });
    ledger.push({ label: spec.label, mode: spec.mode,
        ...(['lv12','lv13'].includes(spec.acceptance || '') ? { candidatePolicySha256: lv12PolicyFingerprint(spec.candidate.root,spec.acceptance as 'lv12'|'lv13').sha256 } : {}),
        seeds: schedule.conditions.map(condition => condition.seed),
        directory: spec.out, createdAt: manifest.createdAt });
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
    return { out: spec.out, games: schedule.schedule.length, conditions: schedule.conditions.length,
        sha256: hash(fs.readFileSync(path.join(spec.out, 'manifest.json'))) };
}

function loadManifest(directory: string) {
    const manifestFile = path.join(directory, 'manifest.json');
    if (hash(fs.readFileSync(manifestFile)) !== read(path.join(directory, 'manifest-sha256.json')).sha256) throw new Error('Experiment declaration changed');
    return read(manifestFile);
}

function verifyRuntimes(manifest: any) {
    if (hash(fs.readFileSync(__filename)) !== manifest.driverSha256) throw new Error('Experiment driver changed after declaration');
    for (const expected of manifest.runtimes) {
        if (productionRuntimeManifest(expected.root).sha256 !== expected.sha256) throw new Error(`Runtime changed: ${expected.root}`);
    }
    if (manifest.executable && hash(fs.readFileSync(manifest.executable)) !== manifest.executableSha256) throw new Error('Frozen Node executable changed');
    for (const file of manifest.coordinator?.files || []) {
        if (hash(fs.readFileSync(file.path)) !== file.sha256) throw new Error('Frozen experiment coordinator changed');
    }
}

function latestAttempt(directory: string, slot: ExperimentSlot) {
    const root = path.join(directory, 'games', slot.id);
    if (!fs.existsSync(root)) return { root, number: 0, path: null as string | null, result: null as any };
    const names = fs.readdirSync(root).filter(name => /^attempt-\d+$/.test(name)).sort((a, b) => Number(a.slice(8)) - Number(b.slice(8)));
    if (!names.length) return { root, number: 0, path: null, result: null };
    const lastName = names[names.length - 1];
    const last = path.join(root, lastName);
    return { root, number: Number(lastName.slice(8)), path: last,
        result: fs.existsSync(path.join(last, 'result.json')) ? read(path.join(last, 'result.json')) : null };
}

export function summarizeCpuExperiment(directory: string) {
    const manifest = loadManifest(directory), scores: ExperimentScore[] = [], pending: string[] = [], failures: any[] = [];
    for (const slot of manifest.schedule as ExperimentSlot[]) {
        const attempt = latestAttempt(directory, slot);
        if (!attempt.path || attempt.result?.status !== 'complete') {
            pending.push(slot.id);
            if (attempt.path && fs.existsSync(path.join(attempt.path, 'failure.json'))) failures.push({ slot: slot.id, attempt: attempt.path });
            continue;
        }
        const game = read(path.join(attempt.path, 'manifest.json'));
        // Follow the explicit resume chain to the original initial deal hash.
        let initial = game;
        const seen = new Set<string>();
        while (initial.sourceCheckpoint) {
            const predecessor = path.dirname(initial.sourceCheckpoint);
            if (seen.has(predecessor)) throw new Error('Cyclic resume chain'); seen.add(predecessor);
            initial = read(path.join(predecessor, 'manifest.json'));
        }
        if (game.identity.seed !== slot.seed || game.identityHash !== attempt.result.identityHash) throw new Error('Game identity/result mismatch');
        scores.push({ id: slot.id, winner: attempt.result.result.winner, initialSha256: initial.initialSha256 });
    }
    const result = summarizeExperiment(manifest.spec, manifest.conditions, manifest.schedule, scores);
    return { schema: 'cpu-experiment-report.v1', label: manifest.spec.label, ...result, pending, failures,
        // The replay audit is an additional required evidence artifact; a tally
        // alone never promotes a CPU or validates the entire experiment.
        accepted: false, validation: 'Full journal replay and parity/runtime adoption audit still required' };
}

export async function runCpuExperiment(directoryInput: string, resume = false) {
    const directory = path.resolve(directoryInput), manifest = loadManifest(directory), spec: ExperimentSpec = manifest.executionSpec || manifest.spec;
    if (fs.existsSync(path.join(directory, 'retirement.json'))) throw new Error('Experiment retired; keep its records and declare fresh conditions');
    if (fs.existsSync(path.join(directory, 'early-stop.json'))) throw new Error('Candidate failed its first-ten gate; declare a new candidate with fresh conditions');
    verifyRuntimes(manifest);
    const lockFile = path.join(directory, 'run-lock.json');
    if (fs.existsSync(lockFile)) {
        const lock = read(lockFile);
        let live = true; try { process.kill(lock.pid, 0); } catch { live = false; }
        if (live) throw new Error(`Experiment owner still exists: ${lock.pid}`);
        fs.renameSync(lockFile, path.join(directory, `retired-lock-${crypto.randomUUID()}.json`));
    }
    const stopFile = path.join(directory, 'stop-request.json');
    if (fs.existsSync(stopFile)) {
        if (!resume) throw new Error('Experiment has a saved stop request; use resume explicitly');
        fs.renameSync(stopFile, path.join(directory, `previous-stop-${crypto.randomUUID()}.json`));
    }
    writeNew(lockFile, { pid: process.pid, startedAt: new Date().toISOString(), cwd: process.cwd(), directory });
    const processHistoryFile = path.join(directory, 'processes.json');
    const processes: any[] = fs.existsSync(processHistoryFile) ? read(processHistoryFile) : [];
    const stop = () => { if (!fs.existsSync(stopFile)) writeNew(stopFile, { requestedAt: new Date().toISOString(), reason: 'owner signal' }); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    const work = async (slot: ExperimentSlot) => {
            const previous = latestAttempt(directory, slot);
            if (previous.result?.status === 'complete') return;
            if (previous.path && !resume) throw new Error(`Prior incomplete attempt requires explicit resume: ${slot.id}`);
            if (previous.path && previous.result?.status !== 'stopped') throw new Error(`Inspect/repair the saved failed attempt before resuming: ${slot.id}`);
            if (os.freemem() < 2 * 1024 ** 3) throw new Error('Free memory below experiment launch threshold');
            const disk = fs.statfsSync(directory);
            if (disk.bavail * disk.bsize < 1024 ** 3) throw new Error('Free disk space below 1 GiB');
            verifyRuntimes(manifest);
            fs.mkdirSync(previous.root, { recursive: true });
            const output = path.join(previous.root, `attempt-${previous.number + 1}`);
            const candidateBlack = slot.candidateColor === 'black';
            const game: ProductionGameSpec = { seed: slot.seed, out: output,
                profiles: { black: candidateBlack ? spec.candidateProfile ?? 10 : spec.opponentProfile ?? 10,
                    white: candidateBlack ? spec.opponentProfile ?? 10 : spec.candidateProfile ?? 10 },
                policies: { black: candidateBlack ? spec.candidate : spec.opponent, white: candidateBlack ? spec.opponent : spec.candidate },
                maxDecisions: spec.maxDecisions, timeoutMs: spec.timeoutMs, stopFile,
                ...(spec.stoneSupplyEnabled === true ? { stoneSupplyEnabled: true } : {}),
                ...(previous.path ? { resumeFrom: path.join(previous.path, 'checkpoint.json') } : {}) };
            const specFile = path.join(previous.root, `attempt-${previous.number + 1}-spec.json`); writeNew(specFile, game);
            const stdout = fs.openSync(path.join(previous.root, `attempt-${previous.number + 1}.stdout.log`), 'wx');
            const stderr = fs.openSync(path.join(previous.root, `attempt-${previous.number + 1}.stderr.log`), 'wx');
            try {
                await new Promise<void>((resolve, reject) => {
                    const childRoot = manifest.commonRoot || process.cwd();
                    const child = spawn(manifest.executable || process.execPath,
                        ['--max-old-space-size=1536', path.join(childRoot, 'dist/scripts/run-production-selfplay.js'), specFile],
                        { cwd: childRoot, windowsHide: true, stdio: ['ignore', stdout, stderr] });
                    processes.push({ slot: slot.id, pid: child.pid, output, startedAt: new Date().toISOString() });
                    fs.writeFileSync(path.join(directory, 'processes.json'), JSON.stringify(processes, null, 2));
                    const timer = setTimeout(() => { child.kill(); reject(new Error(`Experiment child exceeded its time limit: ${slot.id}`)); }, (spec.timeoutMs || 1200000) + 60000);
                    child.once('error', error => { clearTimeout(timer); reject(error); });
                    child.once('exit', code => {
                        clearTimeout(timer);
                        const record = processes.find(record => record.pid === child.pid); if (record) { record.finishedAt = new Date().toISOString(); record.code = code; }
                        fs.writeFileSync(path.join(directory, 'processes.json'), JSON.stringify(processes, null, 2));
                        if (code === 0) resolve(); else reject(new Error(`Experiment game failed: ${slot.id}, exit=${code}`));
                    });
                });
            } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
            fs.writeFileSync(path.join(directory, 'progress.json'), JSON.stringify(summarizeCpuExperiment(directory), null, 2));
    };
    const globalLock = path.resolve('data/cpu-lv12/active-experiment.json');
    fs.mkdirSync(path.dirname(globalLock), { recursive: true });
    if (fs.existsSync(globalLock)) {
        const owner = read(globalLock);
        let live = true; try { process.kill(owner.pid, 0); } catch { live = false; }
        if (live) throw new Error(`Another selfplay coordinator owns the global game limit: ${owner.pid}`);
        fs.renameSync(globalLock, path.join(path.dirname(globalLock), `stale-owner-${crypto.randomUUID()}.json`));
    }
    writeNew(globalLock, { pid: process.pid, directory, concurrency: spec.concurrency, at: new Date().toISOString() });
    try {
        const results = await Promise.allSettled([runExperimentSchedule(spec, manifest.schedule,
            slot => work(slot).catch(error => { stop(); throw error; }), () => fs.existsSync(stopFile), () => {
                const gate = summarizeCpuExperiment(directory).earlyStop;
                if (!gate.ready) throw new Error('First-ten gate has unresolved games');
                if (gate.stop) writeNew(path.join(directory, 'early-stop.json'), {
                    at: new Date().toISOString(), reason: `At least ${experimentProtocol(spec).earlyStopLosses} losses in the declared first ten games`, ...gate });
                return !gate.stop;
            })]);
        const errors = results.filter(result => result.status === 'rejected').map(result => String((result as PromiseRejectedResult).reason));
        if (errors.length) writeNew(path.join(directory, `run-failure-${crypto.randomUUID()}.json`), { at: new Date().toISOString(), errors });
        const report = summarizeCpuExperiment(directory); fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
        if (errors.length) throw new Error(errors.join('\n'));
        return report;
    } finally {
        fs.renameSync(globalLock, path.join(directory, `released-global-owner-${crypto.randomUUID()}.json`));
        process.off('SIGINT', stop); process.off('SIGTERM', stop);
        fs.renameSync(lockFile, path.join(directory, `finished-run-${crypto.randomUUID()}.json`));
    }
}

if (require.main === module) {
    const [command, target] = process.argv.slice(2);
    Promise.resolve().then(() => {
        if (command === 'declare') return declareExperiment(read(target));
        if (command === 'run' || command === 'resume') {
            if (fs.existsSync(path.join(path.resolve(target), 'retirement.json'))) throw new Error('Experiment retired; keep its records and declare fresh conditions');
            const manifest = loadManifest(path.resolve(target));
            if (manifest.coordinator && path.resolve(manifest.coordinator.entry) !== path.resolve(__filename)) {
                for (const file of manifest.coordinator.files) if (hash(fs.readFileSync(file.path)) !== file.sha256) throw new Error('Frozen coordinator changed');
                // Keep the long-lived coordinator itself independent from a
                // subsequent build or code edit in the normal checkout.
                return new Promise((resolve, reject) => {
                    const child = spawn(manifest.executable, [manifest.coordinator.entry, command, path.resolve(target)],
                        { cwd: process.cwd(), windowsHide: true, stdio: 'inherit' });
                    child.once('error', reject);
                    child.once('exit', code => code === 0 ? resolve({ isolatedCoordinatorComplete: true }) : reject(new Error(`Isolated coordinator failed: ${code}`)));
                });
            }
            return runCpuExperiment(target, command === 'resume');
        }
        if (command === 'summarize') return summarizeCpuExperiment(target);
        if (command === 'stop') { loadManifest(target); writeNew(path.join(target, 'stop-request.json'), { requestedAt: new Date().toISOString(), reason: 'explicit stop command' }); return { stopRequested: true }; }
        throw new Error('Usage: run-cpu-experiment declare <spec.json> | run|resume|summarize|stop <experiment-directory>');
    }).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
}
