#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import { isDeepStrictEqual } from 'node:util';
import { verifyProductionSelfplay } from '../verify-production-selfplay';
import { productionRuntimeManifest, summarizeProductionDecisions } from '../run-production-selfplay';

const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const receipt = (file: string) => ({ path: path.resolve(file), sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
const summarize = (records: any[]) => {
    const searchMs = records.reduce((sum, record) => sum + (record.search?.elapsedMs || 0), 0);
    const transitions = records.reduce((sum, record) => sum + (record.search?.transitions || 0), 0);
    return { ...summarizeProductionDecisions(records),
        totalDecisionMs: records.reduce((sum, record) => sum + record.elapsedMs, 0),
        totalSearchMs: searchMs, totalTransitions: transitions, transitionsPerMs: transitions / searchMs,
        totalEvaluatedCandidates: records.reduce((sum, record) => sum + (record.search?.evaluatedCandidates || 0), 0),
        totalSimulatedRejections: records.reduce((sum, record) => sum + (record.search?.rejectedCount || 0), 0) };
};

/** Audit all twenty declared performance replays, including stopped ancestors.
 * Profiled slices cannot be substituted for unprofiled full-game evidence. */
export function auditProductionPerformanceReplay(masterFile: string, inventoryFile: string, output: string) {
    if (fs.existsSync(output)) throw new Error('Performance replay audit already exists');
    const master = read(masterFile), inventory = read(inventoryFile);
    if (![1, 2, 4].includes(master.concurrency)) throw new Error('Declare the selected replay concurrency before running the full games');
    const cohort = read(master.cohort);
    if (receipt(cohort.executable.path).sha256 !== cohort.executable.sha256) throw new Error('Saved performance Node changed');
    if (receipt(master.source.file).sha256 !== master.source.sha256) throw new Error('Development seed source changed');
    const source = read(master.source.file);
    if (source.spec.mode !== 'development' || master.slots.length !== 10
        || master.slots.filter((slot: any) => slot.candidateColor === 'black').length !== 3) throw new Error('Performance replay must use ten development slots, black three/white seven');
    for (const slot of master.slots) if (!isDeepStrictEqual(slot, source.schedule.find((item: any) => item.id === slot.id))) throw new Error('Replay slot differs from its original declaration');
    const selectedConditions = [...new Set(master.slots.map((slot: any) => slot.condition))].map(id => ({
        kind: source.conditions.find((condition: any) => condition.id === id)?.kind,
        slots: master.slots.filter((slot: any) => slot.condition === id)
    }));
    if (new Set(master.slots.map((slot: any) => slot.id)).size !== 10
        || selectedConditions.filter(condition => condition.kind === 'paired' && condition.slots.length === 2
            && new Set(condition.slots.map((slot: any) => slot.candidateColor)).size === 2).length !== 3
        || selectedConditions.filter(condition => condition.kind === 'white' && condition.slots.length === 1).length !== 4) throw new Error('Replay requires three complete pairs and four white-only conditions');
    if (inventory.games.length !== 20) throw new Error('Both ten-game sets must be complete');
    const roots = [...new Set<string>([master.variants.before.root, master.variants.after.root, master.opponent.root])];
    const runtimeHashes = new Map(roots.map(root => [path.resolve(root), productionRuntimeManifest(root).sha256]));
    const seen = new Set<string>(), games: any[] = [], records: Record<string, { candidate: any[]; opponent: any[] }> = {
        before: { candidate: [], opponent: [] }, after: { candidate: [], opponent: [] }
    };
    const actions = new Map<string, any[]>(), campaigns = new Map<string, any>();
    for (const item of inventory.games) {
        if (!['before', 'after'].includes(item.variant)) throw new Error('Unknown replay variant');
        const slot = master.slots.find((slot: any) => slot.id === item.slotId), key = `${item.variant}/${item.slotId}`;
        if (!slot || seen.has(key)) throw new Error('Unknown or duplicate completed replay'); seen.add(key);
        let attempt: string | null = path.resolve(item.directory), elapsedWallMs = 0;
        const attempts: any[] = [], chain = new Set<string>();
        while (attempt) {
            if (chain.has(attempt) || !attempt.endsWith('.game')) throw new Error('Invalid performance resume chain'); chain.add(attempt);
            const measurementFile = attempt.slice(0, -5), measurement = read(measurementFile), declaration = read(path.join(attempt, 'manifest.json'));
            const campaign = path.dirname(measurementFile), campaignFile = path.join(campaign, 'declaration.json');
            const campaignDeclaration = read(campaignFile);
            if (campaignDeclaration.spec.master?.sha256 !== receipt(masterFile).sha256
                || campaignDeclaration.cohort.sha256 !== receipt(master.cohort).sha256
                || receipt(campaignDeclaration.harness.path).sha256 !== campaignDeclaration.harness.sha256) throw new Error('Replay campaign declaration or saved harness changed');
            const reportFile = path.join(campaign, 'report.json'), campaignReport = read(reportFile);
            campaigns.set(campaign, { declaration: receipt(campaignFile), report: receipt(reportFile), elapsedMs: campaignReport.elapsedMs,
                coordinatorProcessElapsedMs: campaignReport.coordinatorProcessElapsedMs ?? null,
                directoryToReportMsFromFileTimes: fs.statSync(reportFile).birthtimeMs - fs.statSync(campaign).birthtimeMs });
            if (measurement.spec.kind !== 'game' || measurement.spec.profile !== false || measurement.spec.stopAfterDecisions
                || measurement.spec.concurrency !== master.concurrency
                || measurement.spec.replay.slotId !== slot.id || path.resolve(measurement.spec.replay.manifest) !== path.resolve(master.source.file)) throw new Error('Profiled or undeclared attempt cannot count as a full performance replay');
            if (declaration.identity.node !== cohort.hardware.node) throw new Error('Replay Node version differs from the saved environment');
            if (declaration.identity.seed !== slot.seed || !isDeepStrictEqual(declaration.identity.profiles, master.profiles)) throw new Error('Replay deal or privileges changed');
            if (!isDeepStrictEqual(declaration.identity.limits, master.limits)) throw new Error('Replay stopping limits changed');
            const commonRoot = path.resolve(master.variants[item.variant].root);
            if (path.resolve(declaration.commonRuntime.root) !== commonRoot || declaration.identity.runtimeSha256 !== runtimeHashes.get(commonRoot)) throw new Error('Replay common runtime changed');
            for (const side of ['black', 'white']) {
                const expected = side === slot.candidateColor ? master.variants[item.variant] : master.opponent;
                const actual = declaration.identity.policies[side];
                if (!isDeepStrictEqual(actual.spec, expected) || actual.sha256 !== runtimeHashes.get(path.resolve(expected.root))) throw new Error('Replay policy or budget changed');
            }
            elapsedWallMs += measurement.elapsedMs + measurement.loadMs;
            attempts.push({ measurement: receipt(measurementFile), status: measurement.game.status, elapsedMs: measurement.elapsedMs, createdAt: declaration.createdAt });
            attempt = declaration.sourceCheckpoint ? path.dirname(declaration.sourceCheckpoint) : null;
        }
        const audited = verifyProductionSelfplay(item.directory);
        if (audited.status !== 'complete') throw new Error('Stopped replay cannot count as complete');
        const result = read(path.join(item.directory, 'result.json'));
        const checkpoint = read(path.join(item.directory, 'checkpoint.json'));
        for (const record of audited.decisionRecords) records[item.variant][record.player === slot.candidateColor ? 'candidate' : 'opponent'].push(record);
        actions.set(key, audited.decisionRecords.map((record: any) => ({ player: record.player, action: record.action })));
        games.push({ variant: item.variant, slotId: slot.id, seed: slot.seed, candidateColor: slot.candidateColor,
            decisions: audited.decisions, initialSha256: audited.initialSha256, turns: checkpoint.state.gameState.turnNumber, elapsedGameMs: result.elapsedMs,
            elapsedWorkerMsIncludingAllAttempts: elapsedWallMs, result: audited.result, journalSha256: audited.journalSha256,
            firstStartedAt: attempts[attempts.length - 1].createdAt,
            maxRss: Math.max(...attempts.map(entry => read(entry.measurement.path).maxRss)), attempts });
    }
    const actualOrder = games.slice().sort((a, b) => Date.parse(a.firstStartedAt) - Date.parse(b.firstStartedAt))
        .map(game => ({ variant: game.variant, slotId: game.slotId }));
    if (!isDeepStrictEqual(actualOrder, master.executionOrder)) throw new Error('Replay order differs from the predeclared order');
    const changes = master.slots.map((slot: any) => {
        const conditionGames = games.filter(game => game.seed === slot.seed);
        if (new Set(conditionGames.map(game => game.initialSha256)).size !== 1) throw new Error('Paired or before/after initial game state differs');
        const before = actions.get(`before/${slot.id}`)!, after = actions.get(`after/${slot.id}`)!;
        let prefix = 0; while (prefix < Math.min(before.length, after.length) && isDeepStrictEqual(before[prefix], after[prefix])) prefix++;
        return { slotId: slot.id, commonActionPrefix: prefix, beforeDecisions: before.length, afterDecisions: after.length,
            differentAlignedActions: before.slice(0, after.length).filter((action, index) => !isDeepStrictEqual(action, after[index])).length };
    });
    const summary = Object.fromEntries(['before', 'after'].map(variant => [variant, {
        games: games.filter(game => game.variant === variant).length,
        elapsedGameMs: games.filter(game => game.variant === variant).reduce((sum, game) => sum + game.elapsedGameMs, 0),
        elapsedWorkerMs: games.filter(game => game.variant === variant).reduce((sum, game) => sum + game.elapsedWorkerMsIncludingAllAttempts, 0),
        candidate: summarize(records[variant].candidate), opponent: summarize(records[variant].opponent)
    }]));
    const result = { schema: 'production-performance-replay-audit.v1', valid: true, master: receipt(masterFile), inventory: receipt(inventoryFile),
        summary, changes, games, campaigns: [...campaigns.values()], totalCampaignWallMs: [...campaigns.values()].reduce((sum, item) => sum + item.elapsedMs, 0),
        totalDirectoryToReportMsFromFileTimes: [...campaigns.values()].reduce((sum, item) => sum + item.directoryToReportMsFromFileTimes, 0),
        note: 'Performance replay only, not new strength evidence. Worker durations include resume attempts. Archived campaign timers include child start/exit but may exclude coordinator preparation. File birth times estimate directory creation through report creation; new reports separately record coordinator process startup through reporting. Neither file times nor process uptime are substituted for decision timings.' };
    fs.writeFileSync(output, JSON.stringify(result, null, 2), { flag: 'wx' }); return { output, valid: true, summary, changes };
}
if (require.main === module) {
    try { console.log(JSON.stringify(auditProductionPerformanceReplay(process.argv[2], process.argv[3], process.argv[4]))); }
    catch (error) { console.error(error); process.exitCode = 1; }
}
