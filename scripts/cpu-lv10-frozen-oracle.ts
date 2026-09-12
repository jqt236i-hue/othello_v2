import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import type { Page } from 'playwright';
import Runner = require('./run-ui-level-match');
import { createDesktopChromiumLaunchOptions } from './browser-performance-environment';

const BASELINE_SHA256 = '17e477b998a8afc8e6e821327c9d6aa7e250b1b61a7fa6c4a4eb5c52ca2070d5';
let verifiedBaseline: string | null = null;
export type FrozenOracleAnswer = { action: any; attempts: any[]; after: any; thinkingMs: number; performanceEntries: any[]; model: any };
export type FrozenLv9Oracle = {
    advise: (snapshot: any) => Promise<FrozenOracleAnswer>;
    close: () => Promise<void>;
    baselineSha256: string;
};

function verifyBaseline(directory: string): void {
    if (verifiedBaseline === directory) return;
    const bytes = fs.readFileSync(path.join(directory, 'manifest.json'));
    const hash = (input: Buffer) => crypto.createHash('sha256').update(input).digest('hex');
    if (hash(bytes) !== BASELINE_SHA256) throw new Error('Frozen Lv9 manifest changed');
    for (const file of JSON.parse(bytes.toString()).files) {
        if (hash(fs.readFileSync(path.join(directory, 'repo', file.path))) !== file.sha256) {
            throw new Error(`Frozen Lv9 file changed: ${file.path}`);
        }
    }
    verifiedBaseline = directory;
}

export function readFrozenLv9GameConditions(directory=path.resolve('data/cpu-lv10/baseline-v1')) {
    verifyBaseline(directory);
    const startup=require(path.join(directory,'repo/dist/shared/cpu-opponent-startup-options.js'));
    const black=startup.getCpuOpponentStartupOptions('9-ending-ash','black');
    const white=startup.getCpuOpponentStartupOptions('9-ending-ash','white');
    if(JSON.stringify(black)!==JSON.stringify(white))throw new Error('Frozen Lv9 game conditions differ by color');
    return {initialCharge:black.initialCharge,chargeGainMultiplier:black.chargeGainMultiplier,
        cardUseUnlockTurnNumber:black.cardUseUnlockTurnNumber,deckCardIds:black.deckCardIds};
}

/** An action oracle running the untouched, captured Vite deployment. Every
 * query starts at an actual decision boundary and uses the old browser's CPU
 * orchestration, policies, Worker and model. It is not a selfplay teacher. */
export async function createFrozenLv9Oracle(directory = path.resolve('data/cpu-lv10/baseline-v1')): Promise<FrozenLv9Oracle> {
    verifyBaseline(directory);
    let release!: () => void;
    const lifetime = new Promise<void>(resolve => { release = resolve; });
    let readyResolve!: (oracle: FrozenLv9Oracle) => void, readyReject!: (error: unknown) => void;
    const ready = new Promise<FrozenLv9Oracle>((resolve,reject) => { readyResolve=resolve; readyReject=reject; });
    const closedSignal = new Error('Frozen oracle deliberately closed');
    let queryQueue: Promise<unknown> = Promise.resolve();
    let running: Promise<any>;
    running = Runner.runMatch({ black: 9, white: 9, seed: 91310000, timeoutMs: 480000,
        headless: true, chromiumLaunchOptions: createDesktopChromiumLaunchOptions(), onnxWaitMs: 30000,
        candidateProbe: { bundle: { schema: 'candidate_probe.v1', heads: {} }, color: 'black', heads: [], classic: false },
        beforeNavigate: async (page: Page) => {
            await page.route('**/*', async route => {
                const url = new URL(route.request().url());
                if (url.hostname !== '127.0.0.1') return route.continue();
                const relative = decodeURIComponent(url.pathname).replace(/^\//,'') || 'index.html';
                const frozenFile = path.resolve(directory, 'repo', relative);
                const frozenRoot = path.resolve(directory, 'repo') + path.sep;
                if (!frozenFile.startsWith(frozenRoot)) return route.abort();
                let source = frozenFile;
                if (!fs.existsSync(source)) {
                    // Artwork and installed libraries were intentionally not
                    // duplicated. Decision code/models must exist in the copy.
                    if (!/^(assets|node_modules)\//.test(relative)) return route.abort();
                    source = path.resolve(relative);
                }
                if (!fs.existsSync(source) || !fs.statSync(source).isFile()) return route.abort();
                const mime: Record<string,string> = { '.js':'application/javascript', '.mjs':'application/javascript',
                    '.json':'application/json', '.html':'text/html', '.css':'text/css', '.wasm':'application/wasm',
                    '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml' };
                return route.fulfill({ path:source, contentType:mime[path.extname(source)] || 'application/octet-stream' });
            });
        },
        setupPage: async (page: Page) => {
            await page.evaluate(() => {
                const root = window as any, req = root.require;
                const handler = req('game/cpu-turn-handler');
                const pipeline = req('game/turn/turn_pipeline'), apply = pipeline.applyTurnSafe;
                const clone = (value: any) => JSON.parse(JSON.stringify(value));
                const oracle: any = { blocked: true, active: null, settled: Promise.resolve(), sequence:0, performanceEntries:[] };
                handler.setCpuUIImpl({ readHumanVsHumanMode: () => oracle.blocked,
                    recordCpuTurnStage: (entry:any) => oracle.performanceEntries.push(entry),
                    createCpuTurnPerformanceCorrelationId: () => `frozen-${oracle.sequence}`,
                    readCpuTurnPerformanceNowMs: () => performance.now() });
                pipeline.applyTurnSafe = function(cs: any, gs: any, player: any, action: any, rng: any, opts: any) {
                    if (!oracle.active || cs !== root.cardState || gs !== root.gameState) return apply(cs,gs,player,action,rng,opts);
                    const realRng = rng || req('card-system').getGamePrng();
                    const rngBefore = realRng.getState();
                    const result = apply(cs,gs,player,action,rng,opts);
                    const attempt = { player, action: clone(action), options: clone(opts || {}), ok: result.ok,
                        rejectedReason: result.rejectedReason, rngBefore, rngAfter: realRng.getState() };
                    oracle.active.attempts.push(attempt);
                    if (result.ok) {
                        oracle.blocked = true;
                        const active = oracle.active;
                        oracle.active = null;
                        active.resolve({ action: clone(action), attempts: active.attempts,
                            after: clone({ gameState:result.gameState,cardState:result.cardState,prngState:realRng.getState() }),
                            thinkingMs: performance.now()-active.started,
                            model: req('game/ai/othello-onnx-runtime').getStatus() });
                    }
                    return result;
                };
                oracle.advise = async (snapshot: any) => {
                    await oracle.settled;
                    if (oracle.active) throw new Error('Concurrent frozen oracle query');
                    // Finish any old presentation before replacing the shadow
                    // position. Its continuation is blocked after one action.
                    const deadline = performance.now()+5000;
                    while (root.isCardAnimating || req('ui/playback-state-manager').isPlaybackRunning()) {
                        if (performance.now()>deadline) throw new Error('Frozen oracle presentation did not settle');
                        await new Promise(resolve => setTimeout(resolve,10));
                    }
                    handler.resetCpuTurnHandlerState();
                    root.gameState = clone(snapshot.gameState);
                    root.cardState = clone(snapshot.cardState);
                    const rng = req('card-system').getGamePrng();
                    rng.restoreState(snapshot.prngState);
                    root.cardState._defaultRandomSource = rng;
                    req('ui/playback-state-manager').setBusyState({ processing:false });
                    root.isProcessing = false;
                    oracle.blocked = false;
                    oracle.sequence++;
                    oracle.performanceEntries=[];
                    const player = root.gameState.currentPlayer === 1 || root.gameState.currentPlayer === 'black' ? 'black' : 'white';
                    const answer:any = await new Promise((resolve,reject) => {
                        const timer = setTimeout(() => { oracle.blocked=true; oracle.active=null; reject(new Error('Frozen oracle decision timed out')); },15000);
                        oracle.active = { started:performance.now(), attempts:[], resolve:(value:any) => { clearTimeout(timer); resolve(value); } };
                        oracle.settled = Promise.resolve(handler.runCpuTurn(player,{ autoMode:player==='black' })).catch(error => {
                            clearTimeout(timer); oracle.active=null; oracle.blocked=true; reject(error);
                        });
                    });
                    await oracle.settled;
                    answer.performanceEntries = oracle.performanceEntries;
                    return answer;
                };
                root.__frozenLv9Oracle = oracle;
            });
            readyResolve({ baselineSha256:BASELINE_SHA256,
                advise: snapshot => {
                    const query = queryQueue.then(() => page.evaluate(snapshot => (window as any).__frozenLv9Oracle.advise(snapshot),snapshot));
                    queryQueue = query.then(() => undefined, () => undefined);
                    return query;
                },
                close: async () => { release(); await running; }
            });
            await lifetime;
            throw closedSignal;
        }
    }).catch(error => {
        if (String(error).includes(closedSignal.message)) return;
        readyReject(error);
        throw error;
    });
    // The startup promise owns failures before ready; close owns later cleanup.
    void running.catch(() => undefined);
    return ready;
}
