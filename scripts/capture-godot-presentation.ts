import fs = require('node:fs');
import path = require('node:path');
import assert = require('node:assert/strict');
import { createBattle, createBattleSave } from '../game/battle';
import CardLogic = require('../game/logic/cards');
import { PHASE7_EFFECT_BRANCH_INVENTORY } from '../ui/board-visual/effect-branch-inventory';
const { chromium } = require('playwright');

/** Deliberately uses the production browser adapter and ordinary card/cell input.
 * Debug reads and transparent wrappers only observe; no animation is shortened. */
export async function captureGodotPresentation(baseUrl = 'http://127.0.0.1:8000/', outDir = 'output/godot-port-preparation/presentation', lifecycleOnly = false) {
    const output = path.resolve(outDir); fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'effect-branches.json'), JSON.stringify(PHASE7_EFFECT_BRANCH_INVENTORY, null, 2));
    // Native ANGLE on the Windows target avoids making the screen+canvas
    // recording itself starve software-rendered animation frames.
    const graphicsArgs = process.platform === 'win32'
        ? ['--use-gl=angle', '--use-angle=d3d11']
        : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'];
    const browser = await chromium.launch({ headless: true, args: [...graphicsArgs, '--autoplay-policy=no-user-gesture-required'] });
    const report: any = lifecycleOnly ? JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8')) : { schemaVersion: 1, status: 'running', capturedAt: new Date().toISOString(), graphicsArgs, scenarios: [], animationDisabled: false,
        audio: 'board-and-audio.webm captures the live Pixi canvas and actual Web Audio output in one stream; audio.webm captures that audio alone. screen.webm includes the whole interface and is silent. Recording starts are timestamped in timeline.json.' };
    if (lifecycleOnly) assert.deepEqual(report.scenarios.map((entry: any) => entry.scenario), ['reincarnation', 'destroy'], 'lifecycle-only requires successful recorded presentation scenarios');
    report.status = 'running'; delete report.error;
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    try {
        for (const scenario of lifecycleOnly ? [] : ['reincarnation', 'destroy']) {
            const dir = path.join(output, scenario); fs.mkdirSync(dir, { recursive: true });
            const cardId = scenario === 'reincarnation' ? 'reincarnation_will_01' : 'destroy_01';
            const battle = createBattle({ version: 1, battleId: `godot-evidence-${scenario}`, seed: 319,
                players: { black: { controller: 'human', deckCardIds: [cardId], initialCharge: 30 }, white: { controller: 'human', deckCardIds: [] } } });
            battle.startTurn();
            const source = battle.exportSave();
            // Fixture editing is outside the runtime under test, then validated by the public save boundary.
            source.position.gameState.turnNumber = 6;
            if (scenario === 'reincarnation') (CardLogic as any).addMarker(source.position.cardState, 'specialStone', 3, 4, 'black', { type: 'GHOST', remainingOwnerTurns: 3 }, { emitStatusApplied: false });
            const fixture = createBattleSave(source.config, source.position, source.phase);
            fs.writeFileSync(path.join(dir, 'initial-save.json'), JSON.stringify(fixture, null, 2));
            const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference', recordVideo: { dir, size: { width: 1440, height: 1000 } } });
            const page = await context.newPage(); const errors: string[] = [];
            page.on('pageerror', (error: any) => errors.push(error.message));
            const url = `${baseUrl}?battleEmbed=1&debug=1&boardRenderer=pixi`;
            await page.goto(url);
            await page.waitForFunction(() => !!(window as any).CardReversiBattle, null, { timeout: 30000 });
            await page.evaluate((save: any) => (window as any).CardReversiBattle.start(save), fixture);
            const row = 3, col = scenario === 'reincarnation' ? 4 : 3;
            await page.evaluate(async ({ row, col }: any) => {
                const root = window as any, engine = root.AnimationEngine;
                const probe = root.__godotPresentation = { origin: performance.now(), events: [] as any[], samples: [] as any[], saves: [] as any[] };
                const stamp = () => performance.now() - probe.origin;
                // getRenderedCell deliberately describes the retained settled stone;
                // animated candidate stones are event-owned projections (ghosts).
                // Observe that existing writer too, without creating another writer.
                const roulette = root.require('ui/pixi/effects/reincarnation');
                const playRoulette = roulette.playPixiReincarnation;
                roulette.playPixiReincarnation = (event: any, target: any, projection: any) => playRoulette(event, target, {
                    ...projection,
                    setProjectedStone(r: number, c: number, visual: any) {
                        probe.events.push({ type: 'projected-stone', t: stamp(), row: r, col: c, special: visual?.stone?.specialType ?? null, visual });
                        return projection.setProjectedStone(r, c, visual);
                    },
                    timeline: { ...projection.timeline, run(options: any) {
                        probe.events.push({ type: 'timeline-start', t: stamp(), family: options.effectFamily, durationMs: options.durationMs });
                        return projection.timeline.run({ ...options,
                            onUpdate(progress: number, frame: any) {
                                if (progress === 0 || progress >= 1) probe.events.push({ type: 'timeline-frame', t: stamp(), family: options.effectFamily, ...frame });
                                return options.onUpdate(progress, frame);
                            }
                        }).then((result: any) => { probe.events.push({ type: 'timeline-end', t: stamp(), family: options.effectFamily, result }); return result; });
                    } }
                });
                const phase = engine.executePhase.bind(engine);
                engine.executePhase = async (events: any) => {
                    probe.events.push({ type: 'phase-start', t: stamp(), events: JSON.parse(JSON.stringify(events)) });
                    try { return await phase(events); } finally { probe.events.push({ type: 'phase-end', t: stamp() }); }
                };
                const sound = root.SoundEngine;
                sound._ensureAudioContext(true); await sound.ctx.resume();
                // Preload only the observed cues so the recorder captures Web
                // Audio rather than a cold HTMLAudio fallback outside its graph.
                await Promise.all(['reincarnation_will', 'stone_destroy', 'card_use_button', 'hand_card_select'].map(key => sound.primeEffectBuffer(key)));
                const audioContext = sound.ctx;
                const capture = audioContext.createMediaStreamDestination();
                const nativeConnect = AudioNode.prototype.connect;
                (AudioNode.prototype as any).connect = function (...args: any[]) {
                    const result = (nativeConnect as any).apply(this, args);
                    if (args[0] === audioContext.destination) nativeConnect.call(this, capture);
                    return result;
                };
                const nativeStart = AudioBufferSourceNode.prototype.start;
                AudioBufferSourceNode.prototype.start = function (...args: any[]) {
                    probe.events.push({ type: 'audio-buffer-start', t: stamp(), contextTime: audioContext.currentTime, duration: this.buffer?.duration, contextState: audioContext.state });
                    return (nativeStart as any).apply(this, args);
                };
                const playSound = sound.playEffectByKey.bind(sound);
                sound.playEffectByKey = (key: string, options: any) => {
                    const event: any = { type: 'sound', key, t: stamp(), file: sound.getEffectFilePath(key, options), contextTime: audioContext.currentTime };
                    probe.events.push(event); event.accepted = playSound(key, options); return event.accepted;
                };
                const recorder = new MediaRecorder(capture.stream, { mimeType: 'audio/webm' });
                const chunks: Blob[] = [];
                recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
                const canvas = root.document.querySelector('canvas') as HTMLCanvasElement;
                if (!canvas) throw new Error('Pixi canvas unavailable for synchronized recording');
                const canvasStream = canvas.captureStream(30);
                const combined = new MediaRecorder(new MediaStream([...canvasStream.getVideoTracks(), ...capture.stream.getAudioTracks()]), { mimeType: 'video/webm' });
                const combinedChunks: Blob[] = [];
                combined.ondataavailable = event => { if (event.data.size) combinedChunks.push(event.data); };
                const finishRecording = (recording: MediaRecorder, parts: Blob[]) => new Promise<string>(resolve => {
                    recording.onstop = async () => {
                        const data = new Uint8Array(await new Blob(parts).arrayBuffer());
                        let binary = ''; for (const byte of data) binary += String.fromCharCode(byte);
                        resolve(btoa(binary));
                    };
                    recording.stop();
                });
                root.__godotStopAudio = async () => {
                    probe.events.push({ type: 'audio-record-stop', t: stamp() });
                    const [audio, video] = await Promise.all([finishRecording(recorder, chunks), finishRecording(combined, combinedChunks)]);
                    for (const track of canvasStream.getTracks()) track.stop();
                    return { audio, video };
                };
                probe.events.push({ type: 'audio-record-start', t: stamp() }); recorder.start(100);
                probe.events.push({ type: 'combined-record-start', t: stamp(), width: canvas.width, height: canvas.height }); combined.start(100);
                root.__godotSampleTimer = setInterval(() => {
                    const cell = root.__boardVisualDebug.getRenderedCell(row, col);
                    const manager = root.require('ui/playback-state-manager');
                    probe.samples.push({ t: stamp(), special: cell?.stone?.specialType ?? null, owner: cell?.stone?.owner,
                        markers: cell?.stone?.renderedMarkerKinds, labels: cell?.stone?.statusLabels, timer: cell?.stone?.timerLabel,
                        cellMarkers: cell?.cell?.renderedMarkerKinds, writer: root.__boardVisualDebug.getWriterMode(),
                        processing: manager.getProcessing(), animating: manager.getCardAnimating(), playback: manager.getPlaybackActive(),
                        pending: root.cardState.pendingEffectByPlayer.black?.type ?? null,
                        canonicalTypes: root.cardState.markers.filter((m: any) => m.row === row && m.col === col).map((m: any) => m.data.type) });
                }, 20);
            }, { row, col });
            await page.locator(`[data-card-id="${cardId}"]:not(.hand-availability-glow)`).first().click();
            await page.locator('#use-card-btn').click();
            await page.waitForFunction(() => !!(window as any).cardState.pendingEffectByPlayer.black);
            const pendingSave = await page.evaluate(() => (window as any).CardReversiBattle.save());
            assert.ok(pendingSave.position.cardState.pendingEffectByPlayer.black, 'selection boundary must save');
            assert.equal(pendingSave.position.cardState.lastUsedCardByPlayer.black, cardId, 'ordinary browser card input must preserve the canonical card ID');
            fs.writeFileSync(path.join(dir, 'pending-save.json'), JSON.stringify(pendingSave, null, 2));
            await page.screenshot({ path: path.join(dir, 'selection.png') });
            const rect = await page.evaluate(({ row, col }: any) => (window as any).__boardVisualDebug.getCellClientRect(row, col), { row, col });
            await page.mouse.click(rect.left + rect.width / 2, rect.top + rect.height / 2);
            await page.waitForFunction(() => (window as any).__godotPresentation.events.some((e: any) => e.type === 'phase-start' && e.events.some((v: any) => v.type === 'destroy' || v.targets?.some((t: any) => t.reincarnation))), null, { timeout: 15000 });
            await page.evaluate(() => {
                const root = window as any, probe = root.__godotPresentation;
                probe.saves.push({ type: 'requested-during-animation', t: performance.now() - probe.origin });
                root.__godotPendingSave = root.CardReversiBattle.save().then((save: any) => {
                    probe.saves.push({ type: 'resolved', t: performance.now() - probe.origin }); return save;
                });
            });
            if (scenario === 'reincarnation') await page.waitForTimeout(900);
            await page.screenshot({ path: path.join(dir, 'during.png') });
            const finalSave = await page.evaluate(() => (window as any).__godotPendingSave);
            await page.evaluate(() => (window as any).__boardVisualDebug.waitForIdle());
            await page.screenshot({ path: path.join(dir, 'settled.png') });
            const evidence = await page.evaluate(() => {
                const root = window as any; clearInterval(root.__godotSampleTimer);
                return { ...root.__godotPresentation, lane: root.__CARD_REVERSI_BROWSER_LANE__, renderer: root.__boardVisualDebug.getBackendKind(), diagnostics: root.__boardVisualDebug.getBackendDiagnostics() };
            });
            const recorded = await page.evaluate(() => (window as any).__godotStopAudio());
            fs.writeFileSync(path.join(dir, 'audio.webm'), Buffer.from(recorded.audio, 'base64'));
            fs.writeFileSync(path.join(dir, 'board-and-audio.webm'), Buffer.from(recorded.video, 'base64'));
            fs.writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify(evidence, null, 2));
            fs.writeFileSync(path.join(dir, 'settled-save.json'), JSON.stringify(finalSave, null, 2));
            assert.equal(evidence.lane, 'vite'); assert.equal(evidence.renderer, 'pixi'); assert.equal(errors.length, 0, errors.join('\n'));
            const requested = evidence.saves[0].t, resolved = evidence.saves[1].t;
            assert.ok(resolved > requested, 'save must wait for animation');
            if (scenario === 'reincarnation') {
                const sounds = evidence.events.filter((event: any) => event.type === 'sound' && event.key === 'reincarnation_will');
                assert.equal(sounds.length, 1); assert.equal(sounds[0].accepted, true);
                const buffer = evidence.events.find((event: any) => event.type === 'audio-buffer-start' && Math.abs(event.t - sounds[0].t) < 20);
                assert.ok(buffer && buffer.duration > 2.5 && buffer.contextState === 'running', 'dedicated audio buffer must really start');
                const candidates = new Set(evidence.events.filter((s: any) => s.type === 'projected-stone' && s.t > sounds[0].t && s.t < sounds[0].t + 2400).map((s: any) => s.special));
                assert.ok(candidates.size >= 5, 'animated roulette candidates must be visible');
                assert.ok(resolved - sounds[0].t >= 4250, 'save must wait for roulette, afterglow and immediate effects');
                const confirm = evidence.events.find((s: any) => s.type === 'timeline-start' && s.family === 'reincarnation-confirm');
                assert.ok(confirm && Math.abs(confirm.t - sounds[0].t - 2500) < 200, 'final stone and last chord must align within browser frame tolerance');
                for (const end of evidence.events.filter((s: any) => s.type === 'timeline-end')) assert.equal(end.result.noAnimation, false);
                report.scenarios.push({ scenario, url, lane: evidence.lane, renderer: evidence.renderer, errors, candidateTypesObserved: [...candidates], soundStartMs: sounds[0].t, confirmAfterAudioStartMs: confirm.t - sounds[0].t, audioBufferDurationSeconds: buffer.duration, saveWaitMs: resolved - requested, animationDisabled: false });
            } else {
                const sounds = evidence.events.filter((event: any) => event.type === 'sound' && event.key === 'stone_destroy');
                assert.equal(sounds.length, 1); assert.equal(sounds[0].accepted, true);
                assert.ok(evidence.events.some((event: any) => event.type === 'audio-buffer-start' && Math.abs(event.t - sounds[0].t) < 20 && event.duration > 0.1));
                report.scenarios.push({ scenario, url, lane: evidence.lane, renderer: evidence.renderer, errors, saveWaitMs: resolved - requested, destructionSoundPlayed: true });
            }
            await page.evaluate(() => { const root = window as any; root.CardReversiBattle.dispose(); root.CardReversiBattle.dispose(); });
            const video = page.video(); await context.close(); await video.saveAs(path.join(dir, 'screen.webm')); await video.delete();
        }
        // Exercise real CPU scheduling in addition to the controlled boundary unit tests.
        report.lifecycleCapturedAt = new Date().toISOString();
        report.lifecycle = [];
        for (const exitDuringCpu of [false, true]) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
            const url = `${baseUrl}?battleEmbed=1&debug=1&boardRenderer=pixi&eagerCpuPolicy=1`;
            await page.goto(url); await page.waitForFunction(() => !!(window as any).CardReversiBattle, null, { timeout: 120000 });
            await page.evaluate((id: string) => (window as any).CardReversiBattle.start({ version: 1, battleId: id, seed: 319,
                players: { black: { controller: 'human', deckCardIds: [] }, white: { controller: 'cpu', profile: '6', deckCardIds: [] } } }), exitDuringCpu ? 'cpu-exit' : 'cpu-save');
            const rect = await page.evaluate(() => (window as any).__boardVisualDebug.getCellClientRect(2, 3));
            await page.mouse.click(rect.left + rect.width / 2, rect.top + rect.height / 2);
            await page.waitForFunction(() => {
                const root = window as any;
                const playback = root.require('ui/playback-state-manager');
                return root.gameState.currentPlayer === -1 && root.cardState.lastTurnStartedFor === 'white'
                    && playback.getProcessing() && !playback.getCardAnimating() && !playback.getPlaybackActive()
                    && root.__boardVisualDebug.getWriterMode() === 'idle';
            }, null, { timeout: 120000 });
            const result = await page.evaluate(async (exit: boolean) => {
                const root = window as any;
                const manager = root.require('ui/playback-state-manager');
                const before = { turn: root.gameState.turnNumber, player: root.gameState.currentPlayer, processing: manager.getProcessing(), lastTurnStartedFor: root.cardState.lastTurnStartedFor,
                    cardAnimating: manager.getCardAnimating(), playbackActive: manager.getPlaybackActive(), writer: root.__boardVisualDebug.getWriterMode() };
                const pending = root.CardReversiBattle.save().then((save: any) => ({ kind: 'saved', turn: save.position.gameState.turnNumber, player: save.position.gameState.currentPlayer }), (error: Error) => ({ kind: 'rejected', message: error.message }));
                if (exit) { root.CardReversiBattle.dispose(); root.CardReversiBattle.dispose(); }
                return { before, save: await pending, outcome: exit ? await root.CardReversiBattle.finished : null,
                    onnx: root.require('game/ai/othello-onnx-runtime').getStatus() };
            }, exitDuringCpu);
            assert.equal(result.before.processing, true); assert.equal(result.before.player, -1);
            if (exitDuringCpu) { assert.equal(result.save.kind, 'rejected'); assert.equal(result.outcome.kind, 'cancelled'); }
            else { assert.equal(result.save.kind, 'saved'); assert.ok(result.save.turn >= 2); assert.ok(result.onnx.loaded && result.onnx.inferenceCalls > 0); }
            report.lifecycle.push({ scenario: exitDuringCpu ? 'exit-during-real-cpu' : 'save-during-real-cpu', url, ...result });
            await page.close();
        }
        const pendingFixture = JSON.parse(fs.readFileSync(path.join(output, 'reincarnation', 'pending-save.json'), 'utf8'));
        const resumed = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        await resumed.goto(`${baseUrl}?battleEmbed=1&debug=1&boardRenderer=pixi`);
        await resumed.waitForFunction(() => !!(window as any).CardReversiBattle);
        await resumed.evaluate((save: any) => (window as any).CardReversiBattle.start(save), pendingFixture);
        const restored = await resumed.evaluate(() => (window as any).CardReversiBattle.save());
        assert.deepEqual(restored.position, pendingFixture.position, 'new document must restore pending state exactly');
        const rect = await resumed.evaluate(() => (window as any).__boardVisualDebug.getCellClientRect(3, 4));
        await resumed.mouse.click(rect.left + rect.width / 2, rect.top + rect.height / 2);
        await resumed.waitForFunction(() => {
            const root = window as any; return root.cardState.pendingEffectByPlayer.black === null && root.require('ui/playback-state-manager').getProcessing();
        });
        const exitResult = await resumed.evaluate(async () => {
            const api = (window as any).CardReversiBattle;
            const save = api.save().then(() => 'unexpected-success', (error: Error) => error.message);
            api.dispose(); return { save: await save, outcome: await api.finished };
        });
        assert.equal(exitResult.save, 'Battle disposed'); assert.equal(exitResult.outcome.kind, 'cancelled');
        await resumed.close();
        report.lifecycle.push({ scenario: 'pending-new-document-restore-and-animation-exit', exactRestore: true, ...exitResult });
        // Re-open the saved result against the currently served build. This also
        // lets lifecycle-only retain the original audio/video timestamps while
        // recording any subsequently corrected surrounding UI copy honestly.
        report.finalUiVerification = [];
        for (const [scenario, cardName] of [['reincarnation', '転生の意志'], ['destroy', '破壊の意志']]) {
            const dir = path.join(output, scenario);
            const save = JSON.parse(fs.readFileSync(path.join(dir, 'settled-save.json'), 'utf8'));
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
            const url = `${baseUrl}?battleEmbed=1&debug=1&boardRenderer=pixi`;
            await page.goto(url); await page.waitForFunction(() => !!(window as any).CardReversiBattle);
            await page.evaluate((saved: any) => (window as any).CardReversiBattle.start(saved), save);
            await page.evaluate(() => (window as any).__boardVisualDebug.waitForIdle());
            const panel = page.locator('#manifest-effect-panel');
            await panel.waitFor({ state: 'visible' });
            const panelText = await panel.innerText();
            assert.ok(panelText.includes(`カード: ${cardName}`), `restored ${scenario} must display the last-used card name`);
            assert.ok(!panelText.includes('最後に使ったカードがここに表示されます'), 'used card must replace the empty panel');
            await page.screenshot({ path: path.join(dir, 'final-ui.png') });
            const runtime = await page.evaluate(() => ({ lane: (window as any).__CARD_REVERSI_BROWSER_LANE__, renderer: (window as any).__boardVisualDebug.getBackendKind() }));
            assert.equal(runtime.lane, 'vite'); assert.equal(runtime.renderer, 'pixi');
            report.finalUiVerification.push({ scenario, capturedAt: new Date().toISOString(), url, ...runtime, cardName, panelText, screenshot: `${scenario}/final-ui.png` });
            await page.close();
        }
        report.status = 'passed';
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
        return report;
    } catch (error) {
        report.status = 'failed'; report.error = error instanceof Error ? error.message : String(error);
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        throw error;
    } finally { await browser.close(); }
}
if (require.main === module) captureGodotPresentation(process.argv[2], process.argv[3], process.argv[4] === '--lifecycle-only').catch(error => { console.error(error); process.exitCode = 1; });
