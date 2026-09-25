#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import { verifyProductionSelfplay } from './verify-production-selfplay';
import { auditExperimentProcesses, experimentProtocol, summarizeExperiment, type ExperimentScore, type ExperimentSlot } from './cpu-experiment-protocol';
import { verifyProductionParityGate } from './production-parity-gate';
import { summarizeProductionDecisions } from './run-production-selfplay';
import type { Lv10TurnRecord } from '../game/cpu-lv10-turn';
import { loadAuditedDevelopmentSet } from './cpu-development-set';

const hash = (bytes: Buffer | string) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Independent audit: a tally is accepted only after every scheduled game's
 * journal, seed/deal, seat assignment and fixed runtime have been checked. */
export function auditCpuExperiment(directoryInput: string, runtimeOverride?: string) {
    const directory = path.resolve(directoryInput), manifestPath = path.join(directory, 'manifest.json');
    const manifest = read(manifestPath), spec = manifest.executionSpec || manifest.spec;
    const protocol = experimentProtocol(spec);
    const fixedDevelopment = manifest.spec.developmentSet
        ? loadAuditedDevelopmentSet(manifest.spec.developmentSet, read('data/cpu-lv12/issued-conditions.json')) : null;
    if (fixedDevelopment && (manifest.spec.mode !== 'development'
        || JSON.stringify(fixedDevelopment.schedule) !== JSON.stringify(manifest.schedule)
        || manifest.runtimes.find((runtime: any) => runtime.root === manifest.commonRoot)?.sha256 !== (manifest.spec.acceptance === 'lv13'
            ? '3b3ffbcfc68cff774b6b01c69573dfcbc0283d3559b137599a28dcbbd8ae8ba6' : fixedDevelopment.rulesRuntime.sha256))) {
        throw new Error('Common development conditions or rules changed');
    }
    if (hash(fs.readFileSync(manifestPath)) !== read(path.join(directory, 'manifest-sha256.json')).sha256) throw new Error('Experiment declaration hash mismatch');
    if (manifest.executable && hash(fs.readFileSync(manifest.executable)) !== manifest.executableSha256) throw new Error('Frozen Node executable changed');
    for (const file of manifest.coordinator?.files || []) if (hash(fs.readFileSync(file.path)) !== file.sha256) throw new Error('Frozen coordinator changed');
    if (manifest.spec.mode === 'acceptance') {
        if (JSON.stringify(manifest.protocol) !== JSON.stringify(protocol)) throw new Error('Acceptance declaration uses a withdrawn or different protocol');
        const evidence = manifest.parityEvidence;
        if (!evidence || hash(fs.readFileSync(evidence.path)) !== evidence.sha256) throw new Error('Declared parity evidence is absent or changed');
        verifyProductionParityGate(evidence.path, manifest.commonRoot, spec.candidate.root);
    }
    for (const runtime of manifest.runtimes) for (const file of runtime.files) {
        const root = runtimeOverride && runtime.root === manifest.runtimes[0].root ? runtimeOverride : runtime.root;
        if (hash(fs.readFileSync(path.join(root, file.path))) !== file.sha256) throw new Error(`Frozen runtime file changed: ${root}/${file.path}`);
    }
    const scores: ExperimentScore[] = [], games: any[] = [];
    const candidateDecisions: Lv10TurnRecord[] = [], opponentDecisions: Lv10TurnRecord[] = [];
    let auditedPublicInputs = 0;
    const earlyStopFile = path.join(directory, 'early-stop.json');
    const earlyStopped = fs.existsSync(earlyStopFile);
    if (earlyStopped && manifest.spec.mode !== 'acceptance') throw new Error('Unexpected early-stop record outside acceptance');
    const auditSchedule: ExperimentSlot[] = earlyStopped
        ? manifest.schedule.slice(0, protocol.earlyStopGames) : manifest.schedule;
    if (earlyStopped) {
        for (const slot of manifest.schedule.slice(protocol.earlyStopGames)) {
            if (fs.existsSync(path.join(directory, 'games', slot.id))) throw new Error('A game was launched beyond the failed first-ten gate');
        }
    }
    for (const slot of auditSchedule) {
        const gameRoot = path.join(directory, 'games', slot.id);
        const attempts = fs.readdirSync(gameRoot).filter(name => /^attempt-\d+$/.test(name)).sort((a,b) => Number(a.slice(8))-Number(b.slice(8)));
        if (!attempts.length) throw new Error(`Scheduled game missing: ${slot.id}`);
        const completed = attempts.filter(name => {
            const resultPath = path.join(gameRoot, name, 'result.json');
            return fs.existsSync(resultPath) && read(resultPath).status === 'complete';
        });
        if (completed.length !== 1 || completed[0] !== attempts[attempts.length-1]) throw new Error(`Missing/duplicate/overwritten completed game: ${slot.id}`);
        const attemptPath = path.join(gameRoot, completed[0]), game = read(path.join(attemptPath, 'manifest.json'));
        if (game.identity.seed !== slot.seed) throw new Error('Game seed differs from the declared schedule');
        for (const side of ['black','white'] as const) {
            const candidate = slot.candidateColor === side, expected = candidate ? spec.candidate : spec.opponent;
            const policy = game.identity.policies[side];
            if (JSON.stringify(policy.spec) !== JSON.stringify(expected)) throw new Error(`Policy assignment changed: ${slot.id}/${side}`);
            const expectedRuntime = manifest.runtimes.find((runtime: any) => runtime.root === expected.root);
            if (policy.sha256 !== expectedRuntime?.sha256) throw new Error('Policy runtime hash differs from declaration');
            const profile = candidate ? spec.candidateProfile ?? 10 : spec.opponentProfile ?? 10;
            if (game.identity.profiles[side] !== profile) throw new Error('Game privileges/profile changed');
        }
        const common = manifest.runtimes.find((runtime: any) => runtime.root === (manifest.commonRoot || manifest.runtimes[0].root));
        if (game.identity.runtimeSha256 !== common.sha256) throw new Error('Game rules runtime changed');
        const result = verifyProductionSelfplay(attemptPath, new Set(), runtimeOverride);
        if (fixedDevelopment && result.initialSha256 !== fixedDevelopment.evidence.provenance.find(entry => entry.id === slot.id)?.initialSha256) {
            throw new Error('Common development initial state differs from its audited source');
        }
        const { finalStateKey: _state, decisionRecords, ...compact } = result;
        if (spec.acceptance === 'lv12' || spec.acceptance === 'lv13') {
            for (const attempt of attempts) {
                const rows = fs.readFileSync(path.join(gameRoot, attempt, 'steps.ndjson'), 'utf8').trimEnd().split('\n').map(line=>JSON.parse(line));
                for (const row of rows.filter(row=>row.kind==='decision')) {
                    const policy = game.identity.policies[row.player].spec;
                    const input = require(path.join(policy.root,'dist/game/ai/cpu-lv10-observation')).observeLv10Position(
                        row.transitions.find((step:any)=>step.kind==='action').before,row.player);
                    if (row.memories?.[row.player]?.identity !== JSON.stringify(input)) throw new Error('Recorded CPU input differs from its permitted player projection');
                    require(path.join(policy.root,'dist/game/ai/cpu-lv10-advisor-contract')).parseLv10AdvisorRequest({observation:input});
                    auditedPublicInputs++;
                }
            }
        }
        for (const record of decisionRecords) (record.player === slot.candidateColor ? candidateDecisions : opponentDecisions).push(record);
        scores.push({ id: slot.id, winner: result.result.winner, initialSha256: result.initialSha256 });
        games.push({ slot, ...compact, attempts });
    }
    const tally = summarizeExperiment(manifest.spec, manifest.conditions, manifest.schedule, scores);
    if (earlyStopped) {
        const recorded = read(earlyStopFile);
        if (!tally.earlyStop.stop || recorded.losses !== tally.earlyStop.losses
            || recorded.completed !== protocol.earlyStopGames
            || JSON.stringify(recorded.slots) !== JSON.stringify(tally.earlyStop.slots)) {
            throw new Error('Early-stop record does not match the audited declared first ten games');
        }
    } else if (manifest.spec.mode === 'acceptance' && tally.earlyStop.stop) {
        throw new Error('Experiment continued despite failing its first-ten gate');
    }
    const processHistory=['lv12','lv13'].includes(spec.acceptance)?read(path.join(directory,'processes.json')):[];
    for(const entry of processHistory.filter((item:any)=>item.interruption)){
        const recovery=read(entry.interruption.recoveryFile);
        const recovered=recovery.summaries?.find((item:any)=>item.pid===entry.pid&&item.slot===entry.slot&&path.resolve(item.attempt)===path.resolve(entry.output));
        if(recovery.schema!=='cpu-process-loss-recovery.v1'||recovery.recoveredAt!==entry.finishedAt||!recovered?.replay?.valid
            ||recovered.journalSha256!==hash(fs.readFileSync(path.join(entry.output,'steps.ndjson')))
            ||recovered.checkpointSha256!==hash(fs.readFileSync(path.join(entry.output,'checkpoint.json')))
            ||recovered.journalSha256!==entry.interruption.journalSha256||recovered.checkpointSha256!==entry.interruption.checkpointSha256)
            throw new Error('Unverified process-loss recovery');
    }
    const processAudit = ['lv12','lv13'].includes(spec.acceptance) ? auditExperimentProcesses(spec,manifest.schedule,processHistory) : null;
    return { schema: 'cpu-experiment-audit.v1', manifestSha256: hash(fs.readFileSync(manifestPath)),
        processAudit, auditedPublicInputs,
        ...tally, valid: true, games, earlyStopped,
        auditScope: earlyStopped ? 'All ten started games audited; remaining twenty deliberately unstarted' : 'All scheduled games audited',
        strengthGatePassed: !earlyStopped && tally.meetsWinGate && !fs.existsSync(path.join(directory, 'retirement.json')),
        performance: { candidate: summarizeProductionDecisions(candidateDecisions), opponent: summarizeProductionDecisions(opponentDecisions),
            scope: 'All recorded decisions across every resume attempt; real production clock; excludes display and animation' },
        adoptionComplete: false, note: 'Journal/runtime audit does not substitute for browser adoption and responsiveness checks' };
}

if (require.main === module) {
    try {
        const report = auditCpuExperiment(process.argv[2], process.argv[4]);
        if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2), { flag: 'wx' });
        const { games, ...summary } = report;
        console.log(JSON.stringify({ ...summary, auditedGames: games.length }));
    } catch (error) { console.error(error); process.exitCode = 1; }
}
