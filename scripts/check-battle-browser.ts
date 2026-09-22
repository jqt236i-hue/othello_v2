import fs = require('fs');
import path = require('path');
import assert = require('node:assert/strict');
const { chromium } = require('playwright');

export async function checkBattleBrowser(baseUrl = 'http://127.0.0.1:8000/') {
    const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const report: any[] = [];
    const evidence = path.resolve('output/battle-verification'); fs.mkdirSync(evidence, { recursive: true });
    const config = { version: 1, battleId: 'browser-roundtrip', seed: 319,
        players: { black: { controller: 'human' }, white: { controller: 'human' } } };
    try {
        for (const suffix of ['?battleEmbed=1&debug=1&boardRenderer=pixi', '?battleEmbed=1&debug=1&boardRenderer=dom']) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
            const errors: string[] = []; page.on('pageerror', (error: any) => errors.push(error.message));
            await page.goto(baseUrl + suffix);
            await page.waitForFunction(() => !!(window as any).CardReversiBattle, null, { timeout: 30000 });
            await page.evaluate((cfg: any) => (window as any).CardReversiBattle.start(cfg), config);
            const target = await page.evaluate(() => (window as any).__boardVisualDebug.getCellClientRect(2, 3));
            await page.mouse.click(target.left + target.width / 2, target.top + target.height / 2);
            await page.waitForFunction(() => (window as any).gameState.turnNumber >= 1);
            const saved = await page.evaluate(() => (window as any).CardReversiBattle.save());
            // A placement may commit before the next turn-start handoff. Compare
            // both runtimes after that still-pending boundary has executed once.
            if (saved.phase === 'needs-turn-start') await page.waitForFunction(() => {
                const root = window as any;
                return root.cardState.lastTurnStartedFor === (root.gameState.currentPlayer === 1 ? 'black' : 'white');
            });
            const continued = await page.evaluate(() => (window as any).CardReversiBattle.save());
            if (saved.position.gameState.board[2][3] !== 1 || saved.position.gameState.currentPlayer !== -1) throw new Error('Normal board input did not commit');
            const lane = suffix.includes('dom') ? 'dom' : 'pixi';
            assert.equal(await page.evaluate(() => (window as any).__boardVisualDebug.getBackendKind()), lane);
            await page.screenshot({ path: path.join(evidence, `${lane}-move.png`) });
            await page.evaluate(() => { (window as any).CardReversiBattle.dispose(); (window as any).CardReversiBattle.dispose(); });
            await page.close();
            const resumed = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
            await resumed.goto(baseUrl + suffix); await resumed.waitForFunction(() => !!(window as any).CardReversiBattle);
            await resumed.evaluate((save: any) => (window as any).CardReversiBattle.start(save), saved);
            const restored = await resumed.evaluate(() => (window as any).CardReversiBattle.save());
            fs.writeFileSync(path.join(evidence, `${lane}-save.json`), JSON.stringify(saved, null, 2));
            fs.writeFileSync(path.join(evidence, `${lane}-restore.json`), JSON.stringify(restored, null, 2));
            assert.deepEqual(restored.position, continued.position, 'Browser restoration changed canonical state');
            await resumed.screenshot({ path: path.join(evidence, `${lane}-restored.png`) });
            report.push({ url: baseUrl + suffix, renderer: lane, normalClick: true, newDocumentRestore: true, errors });
            if (errors.length) throw new Error(errors.join('\n'));
            await resumed.close();
        }
        for (const winner of ['black', 'white', 'draw']) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
            await page.goto(baseUrl + '?battleEmbed=1'); await page.waitForFunction(() => !!(window as any).CardReversiBattle);
            const terminal = { ...config, battleId: `result-${winner}`, players: { black: {controller:'human',deckCardIds:[]},white:{controller:'human',deckCardIds:[]} },
                initialLayout: { stones: Array.from({ length: 64 }, (_, i) => ({row:Math.floor(i/8),col:i%8,owner:winner==='black'||(winner==='draw'&&i<32)?1:-1})) } };
            await page.evaluate((cfg: any) => (window as any).CardReversiBattle.start(cfg), terminal);
            const result = await page.evaluate(() => (window as any).CardReversiBattle.finished);
            if (result.kind !== 'finished' || result.result.winner !== winner) throw new Error('Wrong settled battle result');
            if (await page.locator('.result-overlay').count()) throw new Error('Original result rewards leaked into host');
            report.push({ scenario: winner, outcome: result }); await page.close();
        }
        const cpuPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const cpuUrl = baseUrl + '?battleEmbed=1&debug=1&boardRenderer=pixi&eagerCpuPolicy=1';
        await cpuPage.goto(cpuUrl);
        await cpuPage.waitForFunction(() => !!(window as any).CardReversiBattle, null, { timeout: 120000 });
        await cpuPage.evaluate((cfg: any) => (window as any).CardReversiBattle.start(cfg), { ...config,
            battleId: 'packaged-onnx-cpu', players: { black: { controller: 'human' }, white: { controller: 'cpu', profile: '6' } } });
        const cell = await cpuPage.evaluate(() => (window as any).__boardVisualDebug.getCellClientRect(2, 3));
        await cpuPage.mouse.click(cell.left + cell.width / 2, cell.top + cell.height / 2);
        await cpuPage.waitForFunction(() => (window as any).gameState.turnNumber >= 2, null, { timeout: 120000 });
        const onnx = await cpuPage.evaluate(() => (window as any).require('game/ai/othello-onnx-runtime').getStatus());
        assert.equal(onnx.loaded, true, 'CPU model did not load');
        assert.ok(onnx.chooseMoveCalls > 0 && onnx.inferenceCalls > 0, 'CPU did not use ONNX inference');
        assert.equal(onnx.lastError, null);
        report.push({ scenario: 'cpu-lv6', url: cpuUrl, normalClick: true, cpuReply: true, onnx });
        await cpuPage.screenshot({ path: path.join(evidence, 'cpu-lv6.png') }); await cpuPage.close();
        for (let level = 1; level <= 9; level++) {
            const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
            const failures: string[] = [];
            page.on('response', (response: any) => {
                if (response.url().includes('/assets/images/cpu/face/') && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
            });
            const url = baseUrl + '?battleEmbed=1&debug=1&boardRenderer=pixi';
            await page.goto(url); await page.waitForFunction(() => !!(window as any).CardReversiBattle);
            await page.evaluate((cfg: any) => (window as any).CardReversiBattle.start(cfg), { ...config,
                battleId: `mobile-face-lv${level}`, players: { black: { controller: 'human' }, white: { controller: 'cpu', profile: String(level) } } });
            await page.waitForFunction((expected: string) => {
                const image = document.getElementById('mobile-command-opponent-avatar-image') as HTMLImageElement | null;
                return !!image && image.complete && image.naturalWidth > 0 && image.currentSrc.endsWith(expected);
            }, `assets/images/cpu/face/level${level}.png`);
            const image = page.locator('#mobile-command-opponent-avatar-image');
            const layout = await page.evaluate(() => document.documentElement.getAttribute('data-layout-profile'));
            assert.equal(layout, 'layout-profile-phone-portrait', 'Touch viewport did not select phone portrait layout');
            assert.equal(await image.isVisible(), true, 'Mobile CPU face is not visible');
            const rendered = await image.evaluate((element: HTMLImageElement) => ({ src: element.getAttribute('src'), currentSrc: element.currentSrc, naturalWidth: element.naturalWidth }));
            assert.deepEqual(failures, [], 'Mobile CPU face request failed');
            report.push({ scenario: 'mobile-cpu-face', level, url, lane: 'vite', renderer: 'pixi', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, layout, rendered, failures });
            await page.screenshot({ path: path.join(evidence, `mobile-lv${level}.png`) }); await page.close();
        }
        fs.writeFileSync(path.join(evidence, 'browser-report.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
    } finally { await browser.close(); }
}
if (require.main === module) checkBattleBrowser(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
