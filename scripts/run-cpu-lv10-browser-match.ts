#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import zlib = require('node:zlib');
import crypto = require('node:crypto');
import Runner = require('./run-ui-level-match');
import { installFrozenLv9Verification } from './cpu-lv10-frozen-verification';
import { createDesktopChromiumLaunchOptions } from './browser-performance-environment';
import { createFrozenLv9Oracle, type FrozenOracleAnswer } from './cpu-lv10-frozen-oracle';
import { installLv10StaticTransport, type Lv10StaticTransportAudit } from './cpu-lv10-static-transport';

/** Development match through the actual Vite CPU orchestrator. This is also
 * the trace format used to reproduce mistakes; it is not a teacher selfplay. */
export async function runLv10BrowserMatch(options: { seed: number; color: 'black' | 'white'; out: string; timeoutMs?: number; frozenOpponent?: boolean }) {
    const out = path.resolve(options.out);
    fs.mkdirSync(out, { recursive: true });
    const prefix = path.join(out, `game-${options.seed}-${options.color}`);
    if (fs.existsSync(`${prefix}.json.gz`)) throw new Error(`Refusing to overwrite a match: ${prefix}`);
    const write = (suffix: string, value: unknown) => fs.writeFileSync(`${prefix}.${suffix}.json`, JSON.stringify(value));
    const oracle = options.frozenOpponent === false ? null : await createFrozenLv9Oracle();
    const oracleAnswers: FrozenOracleAnswer[] = [];
    let firstOracleFailure: unknown = null;
    let assetTransport:Lv10StaticTransportAudit|undefined;
    try {
        const result = await Runner.runMatch({ black: options.color === 'black' ? 10 : 9,
            white: options.color === 'white' ? 10 : 9, seed: options.seed, timeoutMs: options.timeoutMs || 1200000,
            headless: true, chromiumLaunchOptions: createDesktopChromiumLaunchOptions(), onnxWaitMs: 30000,
            candidateProbe: { bundle: { schema: 'candidate_probe.v1', heads: {} }, color: 'black', heads: [], classic: false },
            beforeNavigate: async (page: any) => {
                await page.exposeFunction('__lv10MatchStalled', async (snapshot:any) => {
                    fs.writeFileSync(`${prefix}.stalled.json.gz`,zlib.gzipSync(JSON.stringify(snapshot)));
                    await page.close();
                });
                if (oracle) await page.exposeFunction('__queryFrozenLv9', async (snapshot: any) => {
                    try {
                        const answer = await oracle.advise(snapshot);
                        answer.oracleAnswerIndex = oracleAnswers.length;
                        oracleAnswers.push(answer);
                        return answer;
                    } catch (error) {
                        if (!firstOracleFailure) {
                            firstOracleFailure = error;
                            const audit = await page.evaluate(() => (window as any).__lv10MatchAudit).catch(() => null);
                            fs.writeFileSync(`${prefix}.oracle-failure.json.gz`, zlib.gzipSync(JSON.stringify({
                                snapshot, error:String(error), frozenFailure:(error as any).frozenFailure,
                                frozenBrowserEvents:(error as any).frozenBrowserEvents,
                                frozenRecoveryError:(error as any).frozenRecoveryError, audit, oracleAnswers })));
                            await page.close();
                        }
                        throw error;
                    }
                });
                const goto = page.goto.bind(page);
                page.goto = async (url: string, opts: any) => {
                    assetTransport ||= await installLv10StaticTransport(page,Runner.resolveServeRoot(),new URL(url).origin);
                    return goto(url + (url.includes('?') ? '&' : '?') + 'perf=1&boardRenderer=pixi', opts);
                };
            },
            setupPage: async (page: any) => {
              await page.evaluate(() => {
                const root = window as any, req = root.require;
                const clone = (x: any) => JSON.parse(JSON.stringify(x));
                const records: any[] = [];
                let lastAcceptedAt=performance.now();
                const abortComparison = (reason:string,details:any) => {
                    root.__lv10MatchAudit.oracleVerificationErrors.push({reason,...details});
                    void root.__lv10MatchStalled(clone({reason,details,gameState:root.gameState,cardState:root.cardState,
                        audit:root.__lv10MatchAudit,lv10:root.__lv10CaptureDiagnostics?.()})).catch(()=>undefined);
                };
                const pipeline = req('game/turn/turn_pipeline'), original = pipeline.applyTurnSafe;
                pipeline.applyTurnSafe = function(cs: any, gs: any, player: any, action: any, rng: any, opts: any) {
                    if (cs !== root.cardState || gs !== root.gameState) return original(cs, gs, player, action, rng, opts);
                    if (records.length >= 2000) {
                        abortComparison('trace_action_limit',{limit:2000,nextAction:clone(action)});
                        throw new Error('Lv10 trace action limit reached');
                    }
                    const realRng = rng || req('card-system').getGamePrng();
                    const before = clone({ gameState: gs, cardState: cs, prngState: realRng.getState() });
                    const result = original(cs, gs, player, action, rng, opts);
                    if (result.ok) lastAcceptedAt=performance.now();
                    records.push({ player, action: clone(action), options: clone(opts || {}), prngProvided: !!rng, before,
                        after: clone({ gameState: result.gameState, cardState: result.cardState, prngState: realRng.getState() }),
                        ok: result.ok, rejectedReason: result.rejectedReason, errorMessage: result.errorMessage });
                    return result;
                };
                root.__lv10MatchAudit = { records, oracleVerificationErrors: [], oracleStaleAnswers: 0 };
                root.__cpuTurnPerformance?.beginScenario('lv6-worker-backed-place-8x8', { capture: true });
                const decisionHistory: any[] = [];
                let decisionCount=0, historyComplete=true;
                root.__lv10CaptureDiagnostics = () => {
                    const diagnostics=req('game/cpu-turn-handler').getLv10DecisionDiagnostics();
                    const added=diagnostics.totals.decisions-decisionCount;
                    if(added<0 || added>diagnostics.recent.length)historyComplete=false;
                    if(added>0)decisionHistory.push(...diagnostics.recent.slice(-added));
                    decisionCount=diagnostics.totals.decisions;
                    if(decisionHistory.length>2000) {historyComplete=false;decisionHistory.splice(2000);}
                    return {...diagnostics,history:decisionHistory,historyComplete};
                };
                const watchdog=setInterval(() => {
                    root.__lv10CaptureDiagnostics();
                    if(req('game/logic/core').isGameOver(root.gameState)) {clearInterval(watchdog);return;}
                    if(performance.now()-lastAcceptedAt<=60000)return;
                    clearInterval(watchdog);
                    void root.__lv10MatchStalled(clone({reason:'No accepted action for 60000ms',gameState:root.gameState,
                        cardState:root.cardState,audit:root.__lv10MatchAudit,lv10:root.__lv10CaptureDiagnostics(),
                        auto:root.AUTO_MODE_ACTIVE,processing:root.isProcessing})).catch(()=>undefined);
                },1000);
              });
              await page.evaluate(installFrozenLv9Verification, { frozenPlayer: options.color === 'black' ? 'white' : 'black' });
            },
            collectPage: (page: any) => page.evaluate(async () => {
                const root = window as any, req = root.require;
                await root.__lv10FlushComparison?.();
                return { ...root.__lv10MatchAudit, perf: root.__cpuTurnPerformance?.endScenario({}),
                    lv10: root.__lv10CaptureDiagnostics(),
                    counts: req('game/logic/core').countDiscs(root.gameState, root.cardState),
                    gameOver: req('game/logic/core').isGameOver(root.gameState),
                    model: req('game/ai/othello-onnx-runtime').getStatus(), capabilities: root.__CARD_REVERSI_BROWSER_CAPABILITIES__,
                    final: JSON.parse(JSON.stringify({ gameState: root.gameState, cardState: root.cardState,
                        prngState: req('card-system').getGamePrng().getState() })) };
            }),
            onProgress: (progress: any) => write('progress', { ...options, time: new Date().toISOString(), progress }),
            onFailure: async (page: any, failure: any) => {
                const state = await page.evaluate(() => {
                    const root = window as any;
                    return JSON.parse(JSON.stringify({ gameState: root.gameState, cardState: root.cardState,
                        audit: root.__lv10MatchAudit, lv10: root.require('game/cpu-turn-handler').getLv10DecisionDiagnostics() }));
                });
                fs.writeFileSync(`${prefix}.failure.json.gz`, zlib.gzipSync(JSON.stringify({ failure, state })));
            }
        });
        result.audit.frozenOpponent = oracle ? { baselineSha256:oracle.baselineSha256, answers:oracleAnswers } : null;
        (result as any).assetTransport=assetTransport;
        const bytes = zlib.gzipSync(JSON.stringify(result));
        fs.writeFileSync(`${prefix}.json.gz`, bytes);
        if (result.audit.oracleVerificationErrors?.length) throw new Error('Frozen opponent parity failed; full trace saved');
        if (!result.audit?.gameOver) throw new Error('Match did not reach canonical termination');
        if (result.pageErrors?.length) throw new Error('Page exceptions occurred; full trace saved');
        if(!assetTransport||assetTransport.failures.length)throw new Error('Static asset transport failed; full trace saved');
        const counts = result.audit.counts;
        const other = options.color === 'black' ? 'white' : 'black';
        const score = counts[options.color] === counts[other] ? .5 : counts[options.color] > counts[other] ? 1 : 0;
        const summary = { ...options, counts, score, durationMs: result.matchDurationMs,
            turnNumber: result.result.turnNumber, attempts: result.audit.records.length,
            rejections: result.audit.records.filter((r: any) => !r.ok).map((r: any) => ({ player: r.player, turn: r.before.gameState.turnNumber, action: r.action, reason: r.rejectedReason })),
            lv10: result.audit.lv10.totals, pageErrors: result.pageErrors,
            frozenOpponent: oracle?.baselineSha256 || null,
            traceSha256: crypto.createHash('sha256').update(bytes).digest('hex') };
        write('summary', summary);
        return summary;
    } catch (error) {
        const cause=firstOracleFailure || error;
        write('error', { ...options, error: String(cause), stack: cause instanceof Error ? cause.stack : null,assetTransport,
            ...(firstOracleFailure ? { subsequentError:String(error) } : {}) });
        throw cause;
    } finally {
        await oracle?.close();
    }
}

if (require.main === module) {
    const [seed = '91311001', color = 'black', out = 'data/cpu-lv10/dev-browser-v1'] = process.argv.slice(2);
    if (!/^\d+$/.test(seed) || !['black', 'white'].includes(color)) throw new Error('Expected integer seed, black/white, output directory');
    runLv10BrowserMatch({ seed: Number(seed), color: color as 'black' | 'white', out }).then(result => console.log(JSON.stringify(result)),
        error => { console.error(error); process.exitCode = 1; });
}
