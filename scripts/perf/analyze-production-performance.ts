#!/usr/bin/env node
import fs = require('node:fs');
import crypto = require('node:crypto');

const quantiles = (values: number[]) => { const sorted = values.slice().sort((a, b) => a - b); return {
    median: sorted[Math.floor((sorted.length - 1) / 2)], p95: sorted[Math.ceil(sorted.length * .95) - 1], max: sorted[sorted.length - 1] }; };

/** Compare declared ABA groups without discarding slow positions or passes.
 * A speed target is not verified when baseline drift exceeds the plan's 10%.
 * This is a technical report, never a strength/adoption gate. */
export function analyzeProductionSpeed(report: any) {
    const groups = new Map<string, any>();
    for (const phase of report.phases) {
        const match = /^group-(\d+)-(baseline-before|candidate|baseline-after)-(\d+)$/.exec(phase.label);
        if (!match) continue;
        const key = `${match[1]}/${match[3]}`, group = groups.get(key) || { group: Number(match[1]), budget: Number(match[3]) };
        if (group[match[2]]) throw new Error('Duplicate ABA phase'); group[match[2]] = phase;
        groups.set(key, group);
    }
    const results: any[] = [];
    for (const group of groups.values()) {
        const passes = ['baseline-before', 'candidate', 'baseline-after'].map(key => group[key]);
        if (passes.some(pass => !pass)) { results.push({ group: group.group, budget: group.budget, complete: false }); continue; }
        if (passes.some(pass => pass.workers.length !== 1 || pass.workers[0].spec.profile || pass.workers[0].spec.clock !== 'fixed')) throw new Error('ABA speed analysis requires single-process, unprofiled fixed work');
        const [before, candidate, after] = passes.map(pass => pass.workers[0]);
        const ids = candidate.rows.map((row: any) => row.id);
        const expectedCount = group.budget === 64 || group.budget === 512 ? 24 : group.budget === candidate.config.maxTransitions ? 8 : 0;
        if (!expectedCount || ids.length !== expectedCount) throw new Error('ABA phase does not contain the declared 24 inputs or eight maximum-budget representatives');
        const mismatches: any[] = [];
        if (new Set(ids).size !== ids.length) throw new Error('Duplicate public position');
        for (const reference of [before, after]) {
            if (JSON.stringify(reference.rows.map((row: any) => row.id)) !== JSON.stringify(ids)) throw new Error('ABA public cohort/order differs');
            candidate.rows.forEach((row: any, index: number) => { if (row.judgmentSha256 !== reference.rows[index].judgmentSha256) mismatches.push({ id: row.id, reference: reference.spec.label }); });
        }
        const times = (worker: any) => quantiles(worker.rows.map((row: any) => row.elapsedMs));
        const baseline = quantiles([...before.rows, ...after.rows].map((row: any) => row.elapsedMs)), changed = times(candidate);
        const beforeMedian = times(before).median, afterMedian = times(after).median;
        const drift = Math.abs(beforeMedian - afterMedian) / ((beforeMedian + afterMedian) / 2);
        const speedup = baseline.median / changed.median, p95Ratio = changed.p95 / baseline.p95;
        const memoryRatio = candidate.maxRss / Math.max(before.maxRss, after.maxRss);
        results.push({ group: group.group, budget: group.budget, count: ids.length, complete: true, mismatches,
            baselineMs: baseline, candidateMs: changed, speedup, p95Ratio, memoryRatio, baselineMedianDrift: drift,
            baselineBeforeMedian: beforeMedian, baselineAfterMedian: afterMedian,
            pairedPositionSpeedup: quantiles(candidate.rows.map((row: any, index: number) => (before.rows[index].elapsedMs + after.rows[index].elapsedMs) / (2 * row.elapsedMs))),
            targetVerified: !mismatches.length && drift <= .1 && speedup >= 1.5 && p95Ratio <= 1.05 && memoryRatio <= 1.1 });
    }
    const budgets = [...new Set(results.map(row => row.budget))].map(budget => {
        const rows = results.filter(row => row.budget === budget), completed = rows.filter(row => row.complete);
        const baselines = completed.flatMap(row => [row.baselineBeforeMedian, row.baselineAfterMedian]);
        const crossGroupSpread = baselines.length ? Math.max(...baselines) / Math.min(...baselines) - 1 : null;
        return { budget, groups: rows.length, completedGroups: completed.length, crossGroupBaselineSpread: crossGroupSpread,
            targetVerified: completed.length === 3 && crossGroupSpread !== null && crossGroupSpread <= .1 && completed.every(row => row.targetVerified) };
    });
    return { schema: 'production-speed-analysis.v1', results, budgets, campaignMismatches: report.mismatches || [],
        targetVerified: !(report.mismatches || []).length && budgets.length === 3 && budgets.every(row => row.targetVerified),
        limits: { minimumSpeedup: 1.5, maximumP95Ratio: 1.05, maximumMemoryRatio: 1.1, maximumBaselineVariation: .1 },
        note: 'Baseline drift or failure does not invalidate judgment parity; it prevents declaring the speed target verified. Investigate load before attribution.' };
}

export function analyzeProductionConcurrency(report: any) {
    const policies = ['lv10', 'lv11'].map(policy => {
        const passes = ['before', 'two', 'after'].map(part => {
            const phase = report.phases.find((phase: any) => phase.label === `concurrency-${part}-${policy}`);
            if (!phase || phase.workers.length !== (part === 'two' ? 2 : 1)
                || phase.workers.some((worker: any) => worker.spec.clock !== 'production' || worker.spec.profile || worker.rows.length !== 24)) throw new Error('Concurrency comparison requires complete unprofiled 1–2–1 passes over all 24 inputs');
            const rows = phase.workers.flatMap((worker: any) => worker.rows);
            const transitions = rows.reduce((sum: number, row: any) => sum + row.result.transitions, 0);
            return { label: phase.label, concurrency: phase.workers.length, count: rows.length,
                transitionsPerMs: transitions / rows.reduce((sum: number, row: any) => sum + row.elapsedMs, 0),
                batchTransitionsPerMs: transitions / phase.elapsedMs,
                timeCutRate: rows.filter((row: any) => row.result.stopped === 'time_budget').length / rows.length,
                maxRss: Math.max(...phase.workers.map((worker: any) => worker.maxRss)) };
        });
        const [before, two, after] = passes, baseline = (before.transitionsPerMs + after.transitionsPerMs) / 2;
        return { policy, passes, throughputDrop: 1 - two.transitionsPerMs / baseline,
            timeCutIncrease: two.timeCutRate - (before.timeCutRate + after.timeCutRate) / 2,
            bracketVariation: Math.abs(before.transitionsPerMs - after.transitionsPerMs) / baseline,
            batchSpeedup: two.batchTransitionsPerMs / ((before.batchTransitionsPerMs + after.batchTransitionsPerMs) / 2) };
    });
    const asymmetry = Math.abs(policies[0].throughputDrop - policies[1].throughputDrop);
    const acceptable = policies.every(policy => policy.throughputDrop <= .15 && policy.timeCutIncrease <= .05
        && policy.bracketVariation <= .1 && policy.batchSpeedup > 1) && asymmetry <= .05;
    return { schema: 'production-concurrency-analysis.v1', policies, throughputDropAsymmetry: asymmetry,
        selectedConcurrency: acceptable ? 2 : 1, twoAccepted: acceptable,
        criteria: { maximumThroughputDrop: .15, maximumDropAsymmetry: .05, maximumTimeCutIncrease: .05, maximumBracketVariation: .1 },
        note: acceptable ? 'Two processes satisfy the measured limits.' : 'Use one process; two-process fairness, stability or speed was not established. No four-process campaign is justified by these results.' };
}

if (require.main === module) {
    try {
        const bytes = fs.readFileSync(process.argv[2]), input = JSON.parse(bytes.toString());
        const report = process.argv[4] === 'concurrency' ? analyzeProductionConcurrency(input) : analyzeProductionSpeed(input);
        fs.writeFileSync(process.argv[3], JSON.stringify({ inputSha256: crypto.createHash('sha256').update(bytes).digest('hex'), ...report }, null, 2), { flag: 'wx' });
        console.log(JSON.stringify(report));
    } catch (error) { console.error(error); process.exitCode = 1; }
}
