#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import zlib = require('node:zlib');
import crypto = require('node:crypto');
import { chromium } from 'playwright';
import { createDesktopChromiumLaunchOptions } from './browser-performance-environment';
import { productionFixtureCardIds, traceProductionCardFixture } from './production-card-fixtures';
import { comparableProductionState, PRODUCTION_STATE_EXCLUSIONS } from '../src/engine/production-match';
import { diffProductionStates } from './verify-production-replay';

async function main() {
    const directory = path.resolve(process.argv[2]);
    if (fs.existsSync(directory)) throw new Error('Fixture report directory already exists');
    fs.mkdirSync(directory, { recursive: true });
    const report: any = { schema: 'production-card-browser-parity.v1', url: 'http://127.0.0.1:8000/',
        exclusions: PRODUCTION_STATE_EXCLUSIONS, cards: [], pageErrors: [], valid: false };
    const browser = await chromium.launch(createDesktopChromiumLaunchOptions());
    const page = await browser.newPage();
    page.on('pageerror', error => report.pageErrors.push(String(error)));
    try {
        await page.goto(report.url, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => (window as any).__uiInitialized === true, null, { timeout: 45000 });
        Object.assign(report, await page.evaluate(() => {
            const root = window as any;
            return { lane: root.__CARD_REVERSI_BROWSER_LANE__, renderer: root.require('ui/bootstrap').getBoardVisualController().getBackendKind() };
        }));
        const cases = productionFixtureCardIds().map(id => ({ id, cardId: id, fusion: false }));
        cases.push({ id: 'shinra-fusion', cardId: 'fire_will_01', fusion: true });
        for (const { id, cardId, fusion } of cases) for (const player of ['black', 'white'] as const) {
            try {
                const fixture = traceProductionCardFixture(cardId, player, fusion);
                const actual = await page.evaluate(fixture => {
                    const req = (window as any).require, clone = (value: any) => JSON.parse(JSON.stringify(value));
                    const pipeline = req('game/turn/turn_pipeline'), turn = req('game/turn/turn-start-runtime');
                    const cards = req('game/logic/cards'), core = req('game/logic/core'), boardOps = req('game/logic/board_ops');
                    const prng = req('game/schema/prng'), presentation = req('shared/presentation-queue');
                    let state = clone(fixture.initial);
                    const results: any[] = [];
                    for (const expected of fixture.transitions) {
                        const rng = prng.fromState(state.prngState), events: any[] = [];
                        state.cardState._defaultRandomSource = rng;
                        let ok = true, stopAction = false;
                        if (expected.kind === 'turn_start') {
                            const result = turn.applyTurnStartAndCheckpoint(cards, core, state.cardState, state.gameState, expected.player, events, rng, boardOps);
                            stopAction = result?.stopAction === true;
                        } else {
                            const result = pipeline.applyTurnSafe(state.cardState, state.gameState, expected.player, clone(expected.action), rng, { skipTurnStart: true });
                            ok = result.ok === true;
                            if (ok) { state.gameState = result.gameState; state.cardState = result.cardState; }
                        }
                        state.prngState = rng.getState();
                        for (const field of ['_defaultRandomSource', '_boardOpsRandomSource', '_currentActionMeta']) delete state.cardState[field];
                        presentation.clearPresentationQueues(state.cardState); state.cardState.chargeDeltaEvents = [];
                        results.push({ ok, stopAction, state: clone(state) });
                    }
                    return results;
                }, fixture);
                const differences: any[] = [];
                fixture.transitions.forEach((transition, index) => {
                    const diff = diffProductionStates(comparableProductionState(transition.after), comparableProductionState(actual[index].state));
                    if (transition.ok !== actual[index].ok || !!transition.stopAction !== actual[index].stopAction || diff.length) differences.push({ index, differences: diff });
                });
                const bytes = zlib.gzipSync(JSON.stringify({ fixture, actual }));
                const file = `${id}-${player}.json.gz`; fs.writeFileSync(path.join(directory, file), bytes, { flag: 'wx' });
                report.cards.push({ id, name: fixture.name, player, valid: !differences.length, used: fixture.used,
                    completedCardTurn: fixture.completedCardTurn, transitions: fixture.transitions.length,
                    boundaries: fixture.transitions.filter(transition => transition.kind === 'turn_start').length,
                    markers: fixture.markers, pendingTypes: fixture.pendingTypes, differences, file,
                    sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
            } catch (error) { report.cards.push({ id, player, valid: false, error: String(error) }); }
            fs.writeFileSync(path.join(directory, 'progress.json'), JSON.stringify({ done: report.cards.length, failed: report.cards.filter((card: any) => !card.valid) }));
        }
        report.valid = report.pageErrors.length === 0 && report.cards.every((card: any) => card.valid);
        fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify({ directory, valid: report.valid, cases: report.cards.length, failures: report.cards.filter((card: any) => !card.valid) }));
        if (!report.valid) process.exitCode = 1;
    } finally { await browser.close(); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
