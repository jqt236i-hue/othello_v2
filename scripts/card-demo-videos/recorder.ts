// Records card demo clips from the running local game (http://127.0.0.1:8000/).
// Frames come from the CDP screencast; only "kept" segments are written to disk.
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';

export interface RecordedFrame { file: string; t: number; seg: number; }
export interface RecordedSegment { id: number; caption: string | null; seamless: boolean; }
export interface LegalMove { row: number; col: number; flips: number; flipList: any[]; }
export interface BoardSnapshot { board: number[][]; markers: MarkerSnapshot[]; cur: number; }
export interface MarkerSnapshot { kind: string; row: number; col: number; owner: string; type: string | null; data: any; }

const SEED_SCRIPT = (seed: number) => `(() => { let s = ${seed >>> 0} >>> 0; Math.random = function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;
// Visible cursor (headless screencasts do not draw the OS pointer).
const CURSOR_SCRIPT = `(() => { const mk = () => { if (document.getElementById('__fakeCursor')) return; const c = document.createElement('div'); c.id='__fakeCursor'; c.style.cssText='position:fixed;left:-60px;top:-60px;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.35);border:3px solid rgba(255,214,102,.95);box-shadow:0 0 10px rgba(255,214,102,.9);pointer-events:none;z-index:2147483647;transition:transform .12s'; document.body.appendChild(c);
 addEventListener('mousemove', e => { c.style.left=e.clientX+'px'; c.style.top=e.clientY+'px'; }, true);
 addEventListener('mousedown', () => { c.style.transform='scale(.6)'; }, true);
 addEventListener('mouseup', () => { c.style.transform='scale(1)'; }, true); };
 if (document.body) mk(); else addEventListener('DOMContentLoaded', mk); })();`;
const HIDE_CSS = '#cpu-speech-bubble, .cpu-speech-bubble { display:none !important; }';
const PARK: [number, number] = [1240, 780];

export class Recorder {
    outDir: string;
    frameDir: string;
    frames: RecordedFrame[] = [];
    segs: RecordedSegment[] = [];
    cur: RecordedSegment | null = null;
    paused = false;
    browser: any = null;
    context: any = null;
    page: any = null;
    cdp: any = null;
    mouse: [number, number] = PARK;
    baseUrl: string;

    constructor(outDir: string, baseUrl = 'http://127.0.0.1:8000/') {
        this.outDir = outDir;
        this.frameDir = path.join(outDir, 'f');
        this.baseUrl = baseUrl;
    }

    async open(seed = 11): Promise<any> {
        fs.rmSync(this.outDir, { recursive: true, force: true });
        fs.mkdirSync(this.frameDir, { recursive: true });
        this.browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
        this.context = await this.browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
        await this.context.addInitScript(SEED_SCRIPT(seed));
        await this.context.addInitScript(CURSOR_SCRIPT);
        const page = this.page = await this.context.newPage();
        page.on('pageerror', (e: any) => console.log('PAGEERR', e && e.message));
        await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => (window as any).__uiInitialized === true, null, { timeout: 30000 });
        await page.addStyleTag({ content: HIDE_CSS });
        await page.waitForTimeout(1200);
        await page.evaluate(() => { const w = window as any; try { if (w.SoundEngine) w.SoundEngine.playEffectByKey = () => true; } catch (e) { /* ignore */ } });
        this.cdp = await this.context.newCDPSession(page);
        this.cdp.on('Page.screencastFrame', async (ev: any) => {
            if (this.cur && !this.paused) {
                const file = path.join(this.frameDir, String(this.frames.length).padStart(6, '0') + '.jpg');
                fs.writeFileSync(file, Buffer.from(ev.data, 'base64'));
                this.frames.push({ file, t: ev.metadata.timestamp, seg: this.cur.id });
            }
            try { await this.cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }); } catch (e) { /* ignore */ }
        });
        await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
        return page;
    }

    // Starts a kept segment. A caption is burned in for the whole segment; seamless joins without a fade.
    async begin(opt: string | null | { caption?: string | null; seamless?: boolean } = null) {
        const o = (typeof opt === 'string' || opt === null) ? { caption: opt } : opt;
        this.cur = { id: this.segs.length, caption: o.caption || null, seamless: !!(o as any).seamless };
        this.segs.push(this.cur);
        await this.hold(150);
    }

    async end(holdMs = 0) {
        if (holdMs) await this.hold(holdMs);
        await this.hold(100);
        this.cur = null;
    }

    // Screencast only emits on change; toggle an invisible style so still periods keep producing frames.
    async nudge() {
        await this.page.evaluate(() => { const c = document.getElementById('__fakeCursor'); if (c) c.style.opacity = c.style.opacity === '0.999' ? '1' : '0.999'; });
    }

    async hold(ms: number) {
        const step = 80;
        for (let t = 0; t < ms; t += step) { await this.nudge(); await this.page.waitForTimeout(step); }
    }

    async quiet<T>(fn: () => Promise<T>): Promise<T> {
        this.paused = true;
        try { return await fn(); } finally { this.paused = false; await this.nudge(); }
    }

    async idle(player: number | null = null, timeout = 30000) {
        const start = Date.now();
        for (;;) {
            const ok = await this.page.evaluate((pl: number | null) => {
                const w = window as any;
                const q = typeof w.getPresentationQueueState === 'function' ? w.getPresentationQueueState() : null;
                const busy = w.isCardAnimating === true
                    || (typeof w.getCardAnimating === 'function' && w.getCardAnimating() === true)
                    || w.isProcessing === true
                    || (q && (q.hasPending || q.hasVisualPlayback));
                return !busy && (pl === null || w.gameState.currentPlayer === pl);
            }, player);
            if (ok) break;
            if (Date.now() - start > timeout) throw new Error('idle timeout');
            if (this.cur) await this.nudge();
            await this.page.waitForTimeout(80);
        }
        await this.hold(200);
    }

    async moveTo(x: number, y: number, steps = 16) {
        const from = this.mouse;
        for (let i = 1; i <= steps; i++) {
            const k = i / steps;
            const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            await this.page.mouse.move(from[0] + (x - from[0]) * e, from[1] + (y - from[1]) * e);
            await this.page.waitForTimeout(16);
        }
        this.mouse = [x, y];
    }

    async clickAt(x: number, y: number) {
        await this.moveTo(x, y);
        await this.hold(220);
        await this.page.mouse.down();
        await this.page.waitForTimeout(90);
        await this.page.mouse.up();
    }

    async cellCenter(r: number, c: number): Promise<[number, number]> {
        const rc = await this.page.evaluate(([row, col]: number[]) => (window as any).getBoardCellClientRect(row, col), [r, c]);
        return [rc.left + rc.width / 2, rc.top + rc.height / 2];
    }

    async clickCell(r: number, c: number) {
        const [x, y] = await this.cellCenter(r, c);
        await this.clickAt(x, y);
    }

    async clickSel(sel: string) {
        const b = await this.page.locator(sel).first().boundingBox();
        if (!b) throw new Error('no element ' + sel);
        await this.clickAt(b.x + b.width / 2, b.y + b.height / 2);
    }

    // Cards whose use animation itself shows the effect; every other card is used off camera.
    showUseFor: Set<string> = new Set();

    async useCard(cardId: string) {
        if (this.showUseFor.has(cardId)) {
            // Select the hand card with the cursor, then press 使用 in place (the button is outside the crop).
            await this.clickSel(`.card-item.clickable[data-card-id="${cardId}"]`);
            await this.hold(350);
            await this.page.evaluate(() => { const b = document.getElementById('use-card-btn'); if (b) b.click(); });
            await this.hold(800);
            await this.quiet(() => this.idle(null));
            await this.hold(200);
            return;
        }
        // Use the card off camera; the kept segment restarts from the state after the use animation.
        const segId = this.cur ? this.cur.id : null;
        await this.quiet(async () => {
            await this.page.evaluate((id: string) => {
                const el = document.querySelector(`.card-item.clickable[data-card-id="${id}"]`) as HTMLElement | null;
                if (!el) throw new Error('card not clickable: ' + id);
                el.click();
            }, cardId);
            await this.page.waitForTimeout(250);
            await this.page.evaluate(() => { const b = document.getElementById('use-card-btn'); if (b) b.click(); });
            await this.page.waitForTimeout(300);
            await this.idle(null);
            await this.page.mouse.move(PARK[0], PARK[1]);
            this.mouse = PARK;
        });
        if (segId !== null) this.frames = this.frames.filter((f) => f.seg !== segId);
        await this.hold(450);
    }

    async park() { await this.moveTo(PARK[0], PARK[1], 10); }

    async close() {
        try { await this.cdp.send('Page.stopScreencast'); } catch (e) { /* ignore */ }
        await this.browser.close();
    }
}

// Plays both sides (no cards) to a balanced mid game with black to move.
export async function setupMidgame(rec: Recorder, target = 30) {
    const page = rec.page;
    await page.evaluate(() => { const w = window as any; w.DEBUG_HUMAN_VS_HUMAN = true; w.DISABLE_ANIMATIONS = true; });
    for (let i = 0; i < 80; i++) {
        await rec.idle(null);
        const r = await page.evaluate((tgt: number) => {
            const w = window as any;
            const gs = w.gameState, cs = w.cardState;
            cs.hands = { black: [], white: [] }; cs.decks = { black: [], white: [] };
            cs._handCopyIdsByPlayer = { black: [], white: [] }; cs._deckCopyIdsByPlayer = { black: [], white: [] };
            let b = 0, wh = 0;
            for (const row of gs.board) for (const v of row) { if (v === 1) b++; if (v === -1) wh++; }
            if (b + wh >= tgt && gs.currentPlayer === 1) return { done: true, b, w: wh };
            const p = gs.currentPlayer;
            const moves = w.generateMovesForPlayerInState(gs, cs, p, null, [], []);
            if (!moves.length) return { done: true, b, w: wh, nomove: true };
            const score = (m: any) => { const f = (m.flips || []).length; const nb = b + (p === 1 ? f + 1 : -f), nw = wh + (p === -1 ? f + 1 : -f); return Math.abs(nb - nw) + Math.random() * 1.5; };
            moves.sort((x: any, y: any) => score(x) - score(y));
            w.handleCellClick(moves[0].row, moves[0].col);
            return { done: false };
        }, target);
        if (r.done) {
            await page.evaluate(() => { (window as any).DISABLE_ANIMATIONS = false; });
            await page.waitForTimeout(600);
            return r;
        }
    }
    throw new Error('midgame not reached');
}

export async function boardInfo(page: any): Promise<BoardSnapshot> {
    return page.evaluate(() => {
        const w = window as any;
        const gs = w.gameState, cs = w.cardState;
        return {
            board: gs.board.map((r: number[]) => r.slice()),
            markers: (cs.markers || []).map((m: any) => ({ kind: m.kind, row: m.row, col: m.col, owner: m.owner, type: m.data ? m.data.type : null, data: m.data || null })),
            cur: gs.currentPlayer
        };
    });
}

export async function legalMoves(page: any, player: number | null = null): Promise<LegalMove[]> {
    return page.evaluate((pl: number | null) => {
        const w = window as any;
        const gs = w.gameState, cs = w.cardState;
        const p = pl === null ? gs.currentPlayer : pl;
        const key = p === 1 ? 'black' : 'white';
        const pending = cs.pendingEffectByPlayer && cs.pendingEffectByPlayer[key];
        return w.generateMovesForPlayerInState(gs, cs, p, pending || null, [], [])
            .map((m: any) => ({ row: m.row, col: m.col, flips: (m.flips || []).length, flipList: m.flips || [] }));
    }, player);
}
