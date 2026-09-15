#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import zlib = require('node:zlib');
import crypto = require('node:crypto');
import { chromium } from 'playwright';
import { createDesktopChromiumLaunchOptions } from './browser-performance-environment';
import { observeLv10Position } from '../game/ai/cpu-lv10-observation';
import { lv10DecisionPlayer, currentLv10Player } from '../game/ai/cpu-lv10-position';
import { diffProductionStates } from './verify-production-replay';

const hash = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Keep the full fixture inventory, overriding only the calculation budget of
 * named cases. A typo must not silently omit the intended deep-search check. */
export function resolveCandidateBrowserChecks(labels: readonly string[], config: { maxTransitions: number }, specification?: any) {
    if (new Set(labels).size !== labels.length) throw new Error('Duplicate browser fixture labels');
    if (specification !== undefined && (specification?.schema !== 'production-candidate-browser-checks.v1'
        || !Array.isArray(specification.overrides))) throw new Error('Invalid browser check specification');
    const overrides = new Map<string, { maxTransitions: number; requireAllScenarios: boolean }>();
    for (const entry of specification?.overrides || []) {
        if (!entry || !labels.includes(entry.label) || overrides.has(entry.label)) throw new Error('Unknown or duplicate browser check override');
        if (!Number.isInteger(entry.maxTransitions) || entry.maxTransitions < 1 || entry.maxTransitions > config.maxTransitions) {
            throw new Error('Browser check exceeds the production calculation budget');
        }
        if (entry.requireAllScenarios !== undefined && typeof entry.requireAllScenarios !== 'boolean') throw new Error('Invalid scenario coverage requirement');
        overrides.set(entry.label, { maxTransitions: entry.maxTransitions, requireAllScenarios: entry.requireAllScenarios === true });
    }
    return labels.map(label => ({ label, maxTransitions: 64, requireAllScenarios: false, ...overrides.get(label) }));
}

/** Browser/Node judgment parity is a fixed-compute check, separate from games
 * and performance runs which always use the actual production time limit. */
export async function verifyProductionCandidateBrowser(candidateRoot: string, traceFile: string, cardDirectory: string, output: string, cohortFile?: string, checkSpecFile?: string, level: 11 | 12 = 11) {
    if (fs.existsSync(output)) throw new Error('Candidate browser report already exists');
    const root = path.resolve(candidateRoot);
    const policy = require(path.join(root, `dist/game/ai/cpu-lv${level}-search`));
    const search = policy[`searchLv${level}`], config = policy[`LV${level}_SEARCH_CONFIG`];
    for (const file of [`game/ai/cpu-lv${level}-search.js`, `game/ai/cpu-lv${level}-evaluation.js`]) {
        if (hash(path.join('dist', file)) !== hash(path.join(root, 'dist', file))) throw new Error('Current candidate differs from the frozen policy');
    }
    const trace = JSON.parse(zlib.gunzipSync(fs.readFileSync(traceFile)).toString());
    const checks = trace.audit.checks.map((check: any, index: number) => ({ ...check, label: `live-${index}` }));
    const inputs = [{ path: path.resolve(traceFile), sha256: hash(traceFile) }];
    for (const id of ['destroy_01', 'super_attraction_01', 'board_shrink_01', 'heaven_01', 'time_stop_deity_01', 'fate_will_01', 'infinite_01']) {
        const file = path.join(cardDirectory, `${id}-black.json.gz`);
        const { fixture } = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
        const transition = fixture.transitions.find((step: any) => step.kind === 'action' && step.action.type !== 'use_card'
            && (id === 'fate_will_01' ? lv10DecisionPlayer(step.before) !== currentLv10Player(step.before) : step.before.cardState.pendingEffectByPlayer.black));
        if (!transition) throw new Error(`Pending fixture absent: ${id}`);
        checks.push({ label: id, observation: observeLv10Position(transition.before, lv10DecisionPlayer(transition.before)), publicRecipes: checks[0].publicRecipes });
        inputs.push({ path: path.resolve(file), sha256: hash(file) });
    }
    if (cohortFile) {
        const cohort = JSON.parse(fs.readFileSync(cohortFile, 'utf8'));
        if (!Array.isArray(cohort.positions)) throw new Error('Public input cohort must contain positions');
        for (const input of cohort.positions) checks.push({ label: `performance-${input.id}`, observation: input.observation,
            publicRecipes: input.publicRecipes, excludedActions: input.excludedActions });
        inputs.push({ path: path.resolve(cohortFile), sha256: hash(cohortFile) });
    }
    const checkBudgets = resolveCandidateBrowserChecks(checks.map((check: any) => check.label), config,
        checkSpecFile ? JSON.parse(fs.readFileSync(checkSpecFile, 'utf8')) : undefined);
    if (checkSpecFile) inputs.push({ path: path.resolve(checkSpecFile), sha256: hash(checkSpecFile) });
    const browser = await chromium.launch(createDesktopChromiumLaunchOptions()), page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(String(error)));
    try {
        await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => (window as any).__uiInitialized === true, null, { timeout: 45000 });
        await page.evaluate(async () => { if ((window as any).loadLazyRuntimeGroup) await (window as any).loadLazyRuntimeGroup('cpu'); });
        const results: any[] = [];
        for (let index = 0; index < checks.length; index++) {
            const check = checks[index], budget = checkBudgets[index], maxTransitions = budget.maxTransitions;
            const expected = search(check.observation, { publicRecipes: check.publicRecipes, excludedActions: check.excludedActions, maxTransitions });
            const actual = await page.evaluate(({ check, maxTransitions, level }) => (window as any).require(`game/ai/cpu-lv${level}-search`)[`searchLv${level}`](check.observation,
                { publicRecipes: check.publicRecipes, excludedActions: check.excludedActions, maxTransitions }), { check, maxTransitions, level });
            const missingScenarioSeeds = budget.requireAllScenarios ? config.scenarioSeeds.filter((seed: number) =>
                !expected.comparisonScenarioSeeds?.includes(seed) || !actual.comparisonScenarioSeeds?.includes(seed)) : [];
            results.push({ ...budget, missingScenarioSeeds, differences: diffProductionStates(expected, actual), expected, actual });
        }
        const environment = await page.evaluate(() => ({ lane: (window as any).__CARD_REVERSI_BROWSER_LANE__,
            renderer: (window as any).require('ui/bootstrap').getBoardVisualController().getBackendKind() }));
        const failures = results.filter(result => result.differences.length || result.missingScenarioSeeds.length);
        const report = { valid: errors.length === 0 && failures.length === 0,
            mode: checkSpecFile ? 'fixed per-case calculation budgets; clock omitted for parity only' : 'fixed 64 transitions; clock omitted for parity only',
            level, config, checkBudgets, url: page.url(), ...environment, errors, results, inputs,
            searchSha256: hash(`dist/game/ai/cpu-lv${level}-search.js`), evaluationSha256: hash(`dist/game/ai/cpu-lv${level}-evaluation.js`) };
        fs.writeFileSync(output, JSON.stringify(report, null, 2), { flag: 'wx' });
        return { output, valid: report.valid, checks: results.length, errors, failures };
    } finally { await browser.close(); }
}

if (require.main === module) {
    const [candidate, trace, cards, output, cohort, checkSpec, level] = process.argv.slice(2);
    verifyProductionCandidateBrowser(candidate, trace, cards, output, cohort || undefined, checkSpec || undefined, level === '12' ? 12 : 11).then(report => {
        console.log(JSON.stringify(report)); if (!report.valid) process.exitCode = 1;
    }).catch(error => { console.error(error); process.exitCode = 1; });
}
