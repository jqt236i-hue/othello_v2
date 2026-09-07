import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import Runner = require('./run-ui-level-match');
import { patchPendingPlanRegistry, installPendingPlanExperiment } from './cpu-pending-plan-experiment';
import { installMovementExperiment } from './cpu-movement-experiment';
import { installMovementBoardExperiment } from './cpu-movement-board-experiment';
import { installMovementFeasibleExperiment } from './cpu-movement-feasible-experiment';
import { installTargetPlacementExperiment } from './cpu-target-placement-experiment';
import { installJointTurnExperiment, patchJointTurnRegistry } from './cpu-joint-turn-experiment';

// Disposable browser experiment only. No served file or production policy is changed.
export function patchCardDecisionRegistry(source: string): string {
    const needle = 'return { choice: choice || null, prepared };';
    if (source.split(needle).length !== 2) throw new Error('Card decision hook must match exactly once');
    return source.replace(needle, 'return window.__cardHoldExperiment(playerKey, choice, prepared);');
}

export function installCardHoldExperiment(options: { color: string; margin: number }) {
    const root = window as any;
    const events: any[] = [];
    root.__cardHoldEvents = events;
    root.__cardHoldExperiment = (player: string, choice: any, prepared: any) => {
        const started = performance.now();
        const ctx = prepared?.decisionContext;
        const eligible = player === options.color && choice && prepared?.legalMovesCount > 0 && !ctx?.forceUseCard;
        let held = false;
        let margin: number | null = null;
        if (eligible) {
            const core = root.require('game/ai/cpu-policy-core');
            const cards = root.require('game/logic/cards');
            const score = core.scoreCardUseDecision(choice.cardId, cards.getCardCost, cards.getCardDef, ctx);
            margin = Number(score.score) - Number(score.minUseScore);
            // One predeclared hypothesis: retain marginal cards when normal placement is possible.
            held = Number.isFinite(margin) && margin < options.margin;
        }
        events.push({ player, cardId: choice?.cardId || null, held, margin,
            legalMovesCount: prepared?.legalMovesCount, extraMs: performance.now() - started });
        return { choice: held ? null : (choice || null), prepared };
    };
}

export function summarizeGames(games: any[]) {
    const wins = games.filter(g => g.result.winner === g.color).length;
    const draws = games.filter(g => g.result.winner === 'draw').length;
    const losses = games.length - wins - draws;
    return { games: games.length, wins, losses, draws,
        interventions: games.reduce((n, g) => n + g.audit.filter((e: any) => e.held || e.changed).length, 0),
        valid: games.length > 0 && games.every(g => g.valid), promotionAllowed: false };
}

export function isCpuExperimentGameValid(result: any, intercepted: number, baselineUnchanged: boolean, allowNoEvents: boolean): boolean {
    return intercepted === 1 && Array.isArray(result.audit) && (allowNoEvents || result.audit.length > 0) && baselineUnchanged &&
        result.audit.every((event: any) => !event.error && event.liveUnchanged !== false && (!(event.held || event.changed) || event.player === result.color) &&
            (event.kind !== 'joint-plan' || !event.planned || (event.completed === true && event.executed === event.actions?.length))) &&
        result.runtimeStatus.othello?.loaded === true && result.pageErrors.length === 0 &&
        !result.consoleMessages.some((m: any) => /WATCHDOG fired|runtime failed|Error in runCpuTurn|Movement simulation|Movement value model/.test(m.text));
}

async function main() {
    const argv = process.argv.slice(2);
    const get = (key: string, fallback: string) => argv.includes(key) ? argv[argv.indexOf(key) + 1] : fallback;
    const output = get('--out', '');
    const seed = Number(get('--seed', '19072000'));
    const pairs = Number(get('--pairs', '4'));
    const margin = Number(get('--margin', '100'));
    const candidate = get('--candidate', 'card-hold');
    const level = Number(get('--level', '6'));
    if (!['card-hold', 'pending-plan', 'movement-value', 'movement-board', 'movement-feasible', 'target-placement', 'joint-turn'].includes(candidate) || ![6, 7, 8, 9].includes(level)) throw new Error('Invalid candidate or CPU level');
    const movement = candidate.startsWith('movement-') || candidate === 'target-placement' || candidate === 'joint-turn';
    if (!output || !Number.isSafeInteger(seed) || !Number.isSafeInteger(pairs) || pairs < 1 || pairs > 12 || !Number.isFinite(margin) || margin < 0 || margin > 200) throw new Error('Invalid bounded match options');
    const out = path.resolve(output);
    fs.mkdirSync(out, { recursive: true });
    const reportPath = path.join(out, 'report.json');
    if (fs.existsSync(reportPath) || fs.existsSync(path.join(out, 'configuration.json'))) throw new Error('Refusing to overwrite experiment');
    const manifest = JSON.parse(fs.readFileSync('data/runs/shared_decision_20260906_continue/baseline-manifest.json', 'utf8'));
    const hash = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const unchanged = () => manifest.files.every((f: any) => hash(f.source) === f.sha256);
    if (!unchanged()) throw new Error('Baseline model changed');
    const registry = fs.readFileSync('public/module-registry.js', 'utf8');
    const patched = candidate === 'joint-turn' ? patchJointTurnRegistry(registry) : movement ? registry : candidate === 'pending-plan' ? patchPendingPlanRegistry(registry) : patchCardDecisionRegistry(registry);
    fs.writeFileSync(path.join(out, 'configuration.json'), JSON.stringify({ seed, pairs, margin, candidate, level,
        hypothesis: candidate === 'joint-turn' ? 'Compare use of the current selected card versus holding it; choose and execute a complete target-placement chain with state checks; 53 canonical probes maximum, deterministic only. No opponent card search.' : candidate === 'target-placement' ? 'Canonical target plus following placement, 32 target probes then four targets by four placements, existing board evaluation; deterministic effects only. Following placement is advisory, opponent cards are not searched.' : candidate === 'movement-feasible' ? 'Only when baseline movement deterministically fails to complete, rerun the existing selector over deterministically completed alternatives; canonical full target pipeline, at most 64 targets.' : candidate === 'movement-board' ? 'Canonical movement effects plus up to four following placements per target, using the existing shape-aware board evaluation with card-aware legal moves; at most 16 targets.' : candidate === 'movement-value' ? 'Simulate super buoyancy/gravity with canonical card effects and evaluate resulting own-turn boards using the frozen value model, capped at 16 targets.' : candidate === 'pending-plan' ? 'Apply existing tactical placement correction only while a card placement effect is pending; preserve original ONNX choice otherwise.' : 'Retain cards with existing score less than minUseScore + margin; preserve placement and search.',
        candidateSourceHash: hash(candidate === 'joint-turn' ? 'scripts/cpu-joint-turn-experiment.ts' : candidate === 'target-placement' ? 'scripts/cpu-target-placement-experiment.ts' : candidate === 'movement-feasible' ? 'scripts/cpu-movement-feasible-experiment.ts' : candidate === 'movement-board' ? 'scripts/cpu-movement-board-experiment.ts' : candidate === 'movement-value' ? 'scripts/cpu-movement-experiment.ts' : 'scripts/cpu-pending-plan-experiment.ts'),
        matchRunnerHash: hash('scripts/run-ui-level-match.ts'),
        registryHash: hash('public/module-registry.js'), sourceHash: hash('scripts/run-cpu-card-hold-match.ts'),
        baselineFiles: manifest.files, promotionAllowed: false }, null, 2), { flag: 'wx' });
    const games: any[] = [];
    try {
        for (let pair = 0; pair < pairs; pair++) {
            for (const color of ['black', 'white']) {
                let intercepted = 0;
                console.log(`[match] pair=${pair + 1}/${pairs} candidate=${color} seed=${seed + pair}`);
                const result = await Runner.runMatch({ black: level, white: level, seed: seed + pair, timeoutMs: 300000,
                    headless: true, onnxWaitMs: 30000,
                    candidateProbe: { bundle: { schema: 'candidate_probe.v1', heads: {} }, color, heads: [], classic: true },
                    beforeNavigate: async (page: any) => {
                        if (candidate === 'joint-turn') await page.addInitScript(() => { (window as any).__jointTakeMove = () => null; (window as any).__jointCardDecision = (_p: any, choice: any, prepared: any) => ({choice,prepared}); });
                        if (!movement) await page.addInitScript(candidate === 'pending-plan' ? installPendingPlanExperiment : installCardHoldExperiment, { color, margin });
                        await page.route('**/public/module-registry.js*', async (route: any) => {
                            intercepted++;
                            await route.fulfill({ status: 200, contentType: 'application/javascript', body: patched });
                        });
                    },
                    setupPage: movement ? (page: any) => page.evaluate(candidate === 'joint-turn' ? installJointTurnExperiment : candidate === 'target-placement' ? installTargetPlacementExperiment : candidate === 'movement-feasible' ? installMovementFeasibleExperiment : candidate === 'movement-board' ? installMovementBoardExperiment : installMovementExperiment, { color }) : undefined,
                    collectPage: (page: any) => page.evaluate(() => (window as any).__cardHoldEvents),
                    onProgress: (progress: any) => fs.writeFileSync(path.join(out, 'progress.json'), JSON.stringify({ pair, color, completed: games.length, progress })) });
                const valid = isCpuExperimentGameValid({ ...result, color }, intercepted, unchanged(), movement);
                const game = { color, valid, intercepted, ...result };
                fs.writeFileSync(path.join(out, `game-${seed + pair}-${color}.json`), JSON.stringify(game), { flag: 'wx' });
                games.push(game);
                fs.writeFileSync(reportPath, JSON.stringify({ complete: false, ...summarizeGames(games) }, null, 2));
                console.log(JSON.stringify(summarizeGames(games)));
                if (!valid) throw new Error('Invalid game; comparison aborted');
            }
        }
        fs.writeFileSync(reportPath, JSON.stringify({ complete: true, baselineUnchanged: unchanged(), ...summarizeGames(games) }, null, 2));
    } catch (error) {
        fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ error: String(error), ...summarizeGames(games), complete: false, valid: false }, null, 2));
        throw error;
    }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
