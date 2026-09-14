#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import zlib = require('node:zlib');
import crypto = require('node:crypto');
import assert = require('node:assert/strict');
import { chromium } from 'playwright';
import { createDesktopChromiumLaunchOptions } from './browser-performance-environment';
import { verifyProductionReplay, diffProductionStates } from './verify-production-replay';
import { createProductionPosition, ProductionMatch, comparableProductionState } from '../src/engine/production-match';
import { searchLv10 } from '../game/ai/cpu-lv10-search';

async function main() {
    const output = path.resolve(process.argv[2] || 'data/cpu-lv11/browser-parity-v1');
    if (fs.existsSync(output)) throw new Error('Refusing to overwrite a browser parity run');
    const label = path.basename(output), old = JSON.parse(fs.readFileSync('data/cpu-lv10/issued-conditions.json', 'utf8'));
    const ledgerPath = 'data/cpu-lv11/issued-conditions.json';
    const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : [];
    const excluded = new Set<number>();
    const collect = (value: any): void => {
        if (!value || typeof value !== 'object') return;
        if (Number.isInteger(value.seed)) excluded.add(value.seed);
        if (Array.isArray(value.seeds)) for (const seed of value.seeds) excluded.add(seed);
        for (const child of Object.values(value)) if (child && typeof child === 'object') collect(child);
    };
    collect(old); collect(ledger);
    const seed = crypto.createHash('sha256').update(`lv11-parity/${label}`).digest().readUInt32LE(0);
    if (excluded.has(seed)) throw new Error('Parity condition has already been issued');
    fs.mkdirSync(output, { recursive: true });
    ledger.push({ label, mode: 'development', seeds: [seed], directory: output, createdAt: new Date().toISOString() });
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
    fs.writeFileSync(path.join(output, 'declaration.json'), JSON.stringify({ seed, label, excludedSeedCount: excluded.size,
        mode: 'browser parity only; never strength evaluation', levels: { black: 10, white: 10 },
        decisionCheck: { maxTransitions: 64, clock: 'omitted for computation parity only; live CPU retains production clock' } }, null, 2));
    const browser = await chromium.launch(createDesktopChromiumLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    try {
        await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => (window as any).__uiInitialized === true, null, { timeout: 45000 });
        await page.locator('#cpu-level-label').click();
        await page.locator('[data-cpu-level="10-observed-dark-dragon"]').click();
        await page.locator('#sidePanelToggleBtn').click();
        await page.locator('#smartBlack').selectOption('10-observed-dark-dragon');
        await page.keyboard.press('Escape');
        // Only initialization receives a fixed seed. No live search clock or
        // presentation timer is overridden, and all rendering remains active.
        await page.evaluate(seed => {
            const now = Date.now; Date.now = () => seed;
            try { (window as any).resetGame(); } finally { Date.now = now; }
        }, seed);
        await page.waitForFunction(() => {
            const root = window as any;
            return root.cardState?.lastTurnStartedFor === 'black' && !root.isProcessing && !root.isCardAnimating
                && !root.require('ui/playback-state-manager').isPlaybackRunning();
        }, null, { timeout: 45000 });
        const initial = await page.evaluate(() => {
            const root = window as any;
            const clone = (x: any) => JSON.parse(JSON.stringify(x));
            const pipeline = root.require('game/turn/turn_pipeline'), apply = pipeline.applyTurnSafe;
            const records: any[] = []; root.__productionParity = { records };
            pipeline.applyTurnSafe = function(cs: any, gs: any, player: any, action: any, rng: any, options: any) {
                if (cs !== root.cardState || gs !== root.gameState) return apply(cs, gs, player, action, rng, options);
                const actualRng = rng || root.require('card-system').getGamePrng();
                const before = clone({ gameState: gs, cardState: cs, prngState: actualRng.getState() });
                const result = apply(cs, gs, player, action, rng, options);
                records.push({ player, action: clone(action), options: clone(options || {}), prngProvided: !!rng,
                    ok: result.ok, before, after: clone({ gameState: result.gameState, cardState: result.cardState, prngState: actualRng.getState() }) });
                if (records.length > 2000) throw new Error('Parity action limit exceeded');
                return result;
            };
            return clone({ gameState: root.gameState, cardState: root.cardState, prngState: root.require('card-system').getGamePrng().getState() });
        });
        const headless = new ProductionMatch(createProductionPosition(seed, { black: 10, white: 10 })); headless.startTurn();
        const initialDiff = diffProductionStates(comparableProductionState(headless.snapshot()), comparableProductionState(initial));
        fs.writeFileSync(path.join(output, 'initial.json'), JSON.stringify({ initial, initialDiff }, null, 2));
        assert.equal(initialDiff.length, 0, 'Browser/headless initialization differs');
        await page.locator('#autoToggleBtn').click();
        const started = Date.now();
        for (;;) {
            const status = await page.evaluate(() => {
                const root = window as any, req = root.require;
                return { turn: root.gameState.turnNumber, records: root.__productionParity.records.length,
                    terminal: req('game/logic/core').isGameOver(root.gameState),
                    cpu: req('game/cpu-turn-handler').getLv10DecisionDiagnostics().totals };
            });
            fs.writeFileSync(path.join(output, 'progress.json'), JSON.stringify({ ...status, elapsedMs: Date.now() - started }));
            if (status.terminal) break;
            if (Date.now() - started > 1200000) throw new Error('Browser parity match timed out');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        const audit = await page.evaluate(() => {
            const root = window as any, req = root.require;
            const records = root.__productionParity.records;
            const recipe = req('shared/cpu-opponent-startup-options').getCpuOpponentDeckCardIds(10);
            const publicRecipes = { black: recipe, white: recipe };
            const checks = records.filter((_: any, i: number) => i % 19 === 0).map((record: any) => {
                const player = req('game/ai/cpu-lv10-position').lv10DecisionPlayer(record.before);
                const observation = req('game/ai/cpu-lv10-observation').observeLv10Position(record.before, player);
                const result = req('game/ai/cpu-lv10-search').searchLv10(observation, { maxTransitions: 64, publicRecipes });
                return { observation, publicRecipes, result };
            });
            return { records, checks, result: { counts: req('game/logic/core').countDiscs(root.gameState, root.cardState),
                terminal: req('game/logic/core').isGameOver(root.gameState) },
                lane: root.__CARD_REVERSI_BROWSER_LANE__, renderer: req('ui/bootstrap').getBoardVisualController().getBackendKind(),
                capabilities: root.__CARD_REVERSI_BROWSER_CAPABILITIES__ };
        });
        const tracePath = path.join(output, 'trace.json.gz');
        fs.writeFileSync(tracePath, zlib.gzipSync(JSON.stringify({ seed, initial, audit, pageErrors, url: page.url() })));
        await page.screenshot({ path: path.join(output, 'result.png') });
        const transitions = verifyProductionReplay(tracePath);
        const decisions = audit.checks.map((check: any, index: number) => ({ index,
            differences: diffProductionStates(searchLv10(check.observation, { maxTransitions: 64, publicRecipes: check.publicRecipes }), check.result) }));
        const report = { transitions, decisions, initialDiff, pageErrors, lane: audit.lane, renderer: audit.renderer,
            result: audit.result, url: page.url() };
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        assert.ok(transitions.valid); assert.ok(decisions.every((d: any) => !d.differences.length)); assert.equal(pageErrors.length, 0);
        console.log(JSON.stringify({ output, actions: transitions.actions, boundaries: transitions.boundaries, decisionChecks: decisions.length, result: audit.result }));
    } catch (error) {
        const snapshot = await page.evaluate(() => {
            const root = window as any;
            return { gameState: root.gameState, cardState: root.cardState, audit: root.__productionParity };
        }).catch(() => null);
        fs.writeFileSync(path.join(output, 'failure.json.gz'), zlib.gzipSync(JSON.stringify({ error: String(error), snapshot, pageErrors })));
        await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => undefined);
        throw error;
    } finally { await browser.close(); }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
