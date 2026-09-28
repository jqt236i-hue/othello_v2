// Per-card demo scenarios. Each scenario starts from a balanced mid game (black to move,
// the card in black's hand) and records the kept segments that explain the effect.
import { Recorder, boardInfo, legalMoves, LegalMove, MarkerSnapshot } from './recorder';
import type { Crop } from './encoder';

type Board = number[][];
type Cell = [number, number];
type Target = { row: number; col: number; [key: string]: any };
type PickFn = (targets: Target[], index: number) => Promise<Target | null | undefined>;
type Scenario = (rec: Recorder, page: any) => Promise<void>;

export const CROP_BOARD: Crop = { x: 420, y: 150, w: 440, h: 555 };
export const CROP_WIDE: Crop = { x: 355, y: 90, w: 570, h: 610 };
export const SPECIAL_CARD_IDS = new Set(['theory_incarnation_01', 'board_executor_01', 'observer_will_01']);
// Cards whose effect shows in the opponent hand or a centered overlay need the wider crop.
const WIDE_CROP_CARDS = new Set(['condemn_01', 'execution_01', 'reveal_hand_01', 'heaven_01', 'trap_01', 'rebuild_01', 'gluttonous_will_01', 'loss_will_01', 'equality_will_01']);
// Cards whose effect happens during the card use animation, so that animation stays in the clip.
export const SHOW_USE_CARD_IDS = new Set([
    'chest_01', 'ribo_01', 'equality_will_01', 'rebuild_01', 'reveal_hand_01', 'execution_01', 'gluttonous_will_01',
    'reinforcement_01', 'support_troops_01', 'chaos_summon_01', 'salvation_01', 'loss_will_01', 'mass_freeze_will_01',
    'time_stop_god_01', 'time_stop_deity_01'
]);
export function cropForCard(cardId: string): Crop { return WIDE_CROP_CARDS.has(cardId) ? CROP_WIDE : CROP_BOARD; }

const DIRS: Cell[] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const inb = (b: Board, r: number, c: number) => r >= 0 && c >= 0 && r < b.length && c < b[0].length;
const cd = (r: number, c: number) => Math.abs(r - 3.5) + Math.abs(c - 3.5);
function cellsOf(b: Board, v: number): Cell[] { const out: Cell[] = []; b.forEach((row, r) => row.forEach((x, c) => { if (x === v) out.push([r, c]); })); return out; }
function nearCount(b: Board, r: number, c: number, v: number, rad = 1) {
    let n = 0;
    for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        if (!dr && !dc) continue;
        if (inb(b, r + dr, c + dc) && b[r + dr][c + dc] === v) n++;
    }
    return n;
}
function flipsFor(b: Board, r: number, c: number, p: number): Cell[] {
    if (b[r][c] !== 0) return [];
    const all: Cell[] = [];
    for (const [dr, dc] of DIRS) {
        const line: Cell[] = []; let rr = r + dr, cc = c + dc;
        while (inb(b, rr, cc) && b[rr][cc] === -p) { line.push([rr, cc]); rr += dr; cc += dc; }
        if (line.length && inb(b, rr, cc) && b[rr][cc] === p) all.push(...line);
    }
    return all;
}
function place(b: Board, r: number, c: number, p: number): Board {
    const nb = b.map((x) => x.slice());
    for (const [fr, fc] of flipsFor(b, r, c, p)) nb[fr][fc] = p;
    nb[r][c] = p;
    return nb;
}
// Opponent moves e with e - X - (opponent stone) on one line and another flip elsewhere (so e is legal).
function flankMoves(b: Board, X: Cell, pX = 1): Array<{ e: Cell; score: number }> {
    const res: Array<{ e: Cell; score: number }> = [];
    for (let r = 0; r < b.length; r++) for (let c = 0; c < b[0].length; c++) {
        if (b[r][c] !== 0) continue;
        for (const [dr, dc] of DIRS) {
            if (r + dr === X[0] && c + dc === X[1] && inb(b, r + 2 * dr, c + 2 * dc) && b[r + 2 * dr][c + 2 * dc] === -pX) {
                const other = flipsFor(b, r, c, -pX).filter(([fr, fc]) => !(fr === X[0] && fc === X[1]));
                if (other.length) res.push({ e: [r, c], score: 10 - other.length });
            }
        }
    }
    return res.sort((a, b2) => b2.score - a.score);
}
function sandwichedRuns(b: Board, p: number) {
    let n = 0;
    for (let r = 0; r < b.length; r++) for (let c = 0; c < b[0].length; c++) {
        if (b[r][c] !== p) continue;
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
            let rr = r + dr, cc = c + dc, k = 0;
            while (inb(b, rr, cc) && b[rr][cc] === -p) { k++; rr += dr; cc += dc; }
            if (k && inb(b, rr, cc) && b[rr][cc] === p) n += k;
        }
    }
    return n;
}
const flipCell = (f: any): Cell => [f.row ?? f[0], f.col ?? f[1]];

// ---------- page helpers ----------
async function targets(page: any, key = 'black'): Promise<Target[]> {
    return page.evaluate((k: string) => {
        const w = window as any;
        return w.CardLogic.getSelectableTargets(w.cardState, w.gameState, k) || [];
    }, key);
}
async function markers(page: any): Promise<MarkerSnapshot[]> { return (await boardInfo(page)).markers; }
async function charge(page: any, key = 'black'): Promise<number> { return page.evaluate((k: string) => (window as any).cardState.charge[k], key); }
async function cur(page: any): Promise<number> { return page.evaluate(() => (window as any).gameState.currentPlayer); }
async function pendingOf(page: any, key = 'black'): Promise<any> { return page.evaluate((k: string) => (window as any).cardState.pendingEffectByPlayer[k], key); }
async function clickBoard(page: any, r: number, c: number, directionKey?: string) {
    await page.evaluate((a: any[]) => (window as any).handleCellClick(a[0], a[1], a[2]), [r, c, directionKey]);
}
interface HandSetup { black?: string[]; white?: string[]; deckBlack?: string[]; chargeBlack?: number; chargeWhite?: number; }
async function setHands(page: any, o: HandSetup) {
    await page.evaluate((opt: HandSetup) => {
        const w = window as any;
        const cs = w.cardState;
        let seq = Math.max(9000, cs._nextCardCopySeq || 0);
        for (const k of ['black', 'white'] as const) {
            const ids = opt[k];
            if (Array.isArray(ids)) { cs.hands[k] = ids.slice(); cs._handCopyIdsByPlayer[k] = ids.map(() => seq++); }
        }
        if (Array.isArray(opt.deckBlack)) { cs.decks.black = opt.deckBlack.slice(); cs._deckCopyIdsByPlayer.black = opt.deckBlack.map(() => seq++); }
        cs._nextCardCopySeq = seq;
        if (typeof opt.chargeBlack === 'number') cs.charge.black = opt.chargeBlack;
        if (typeof opt.chargeWhite === 'number') cs.charge.white = opt.chargeWhite;
        if (w.requestCardUiRender) w.requestCardUiRender();
    }, o);
    await page.waitForTimeout(500);
}
async function useCardQuiet(rec: Recorder, cardId: string) {
    const el = await rec.page.$(`.card-item.clickable[data-card-id="${cardId}"]`);
    if (!el) throw new Error('card not clickable: ' + cardId);
    await el.click();
    await rec.page.waitForTimeout(250);
    await rec.page.evaluate(() => { const b = document.getElementById('use-card-btn'); if (b) b.click(); });
    await rec.idle(null);
}
interface AutoMoveOptions { avoid?: Cell[]; prefer?: ((m: LegalMove) => number) | null; player?: number | null; }
async function autoMove(rec: Recorder, opts: AutoMoveOptions = {}): Promise<LegalMove | null> {
    const p = opts.player ?? await cur(rec.page);
    const moves = await legalMoves(rec.page, p);
    if (!moves.length) return null;
    const avoid = opts.avoid || [];
    const av = new Set(avoid.map(([r, c]) => r + ',' + c));
    const bad = (m: LegalMove) => m.flipList.some((f) => av.has(flipCell(f).join(','))) || avoid.some(([r, c]) => Math.max(Math.abs(r - m.row), Math.abs(c - m.col)) <= 1);
    const prefer = opts.prefer;
    const scored = moves.map((m) => ({ m, s: (bad(m) ? 1000 : 0) + (prefer ? -prefer(m) : m.flips) + Math.random() * 0.5 }));
    scored.sort((a, b) => a.s - b.s);
    return scored[0].m;
}
async function playMove(rec: Recorder, m: { row: number; col: number }, visible = false) {
    if (visible) await rec.clickCell(m.row, m.col);
    else await clickBoard(rec.page, m.row, m.col);
    await rec.idle(null, 40000);
}
async function markerAt(page: any, r: number, c: number) { return (await markers(page)).find((m) => m.row === r && m.col === c) || null; }
async function specialStones(page: any, owner?: string) {
    return (await markers(page)).filter((m) => m.kind === 'specialStone' && (!owner || m.owner === owner) && m.type !== 'METEOR_HOLE');
}
const turnsLeft = (d: any) => (d ? (d.remainingOwnerTurns ?? d.remainingTurns) : null);

// ---------- building blocks ----------
async function intro(rec: Recorder) { await rec.begin(); await rec.hold(350); }
async function outro(rec: Recorder, ms = 1100) { await rec.park(); await rec.end(ms); }
async function captionSeg(rec: Recorder, caption: string, ms = 1500) { await rec.begin({ seamless: true, caption }); await rec.end(ms); }

async function useOn(rec: Recorder, cardId: string, pick: PickFn, extraPicks = 0, player = 'black') {
    await rec.useCard(cardId);
    for (let i = 0; i <= extraPicks; i++) {
        const t = await targets(rec.page, player);
        if (!t.length) break;
        const p = await pick(t, i);
        if (!p) break;
        await rec.clickCell(p.row, p.col);
        await rec.hold(350);
        if (i < extraPicks) await rec.quiet(() => rec.idle(null));
    }
    await rec.idle(null, 40000);
}
async function pickStone(page: any, pred: (v: number, t: Target, b: Board) => boolean, score?: (t: Target, b: Board) => number): Promise<PickFn> {
    const { board } = await boardInfo(page);
    return async (list) => {
        const cands = list.filter((t) => pred(board[t.row] ? board[t.row][t.col] : 0, t, board));
        const arr = (cands.length ? cands : list).map((t) => ({ t, s: score ? score(t, board) : -cd(t.row, t.col) }));
        arr.sort((a, b) => b.s - a.s);
        return arr[0] && arr[0].t;
    };
}
type MoveScore = (m: LegalMove, b: Board) => number;
async function placeBest(rec: Recorder, score: MoveScore | null = null): Promise<LegalMove> {
    const { board } = await boardInfo(rec.page);
    const moves = await legalMoves(rec.page, 1);
    if (!moves.length) throw new Error('no move to place');
    const arr = moves.map((m) => ({ m, s: score ? score(m, board) : (nearCount(board, m.row, m.col, -1) * 2 - cd(m.row, m.col) + Math.min(m.flips, 3)) }));
    arr.sort((a, b) => b.s - a.s);
    const m = arr[0].m;
    await rec.clickCell(m.row, m.col);
    await rec.idle(null, 40000);
    return m;
}
interface NextStoneOptions { score?: MoveScore | null; follow?: number; followCaption?: string; hold?: number; }
async function nextStone(rec: Recorder, cardId: string, o: NextStoneOptions = {}): Promise<LegalMove> {
    const follow = o.follow ?? 0;
    await intro(rec);
    await rec.useCard(cardId);
    const m = await placeBest(rec, o.score ?? null);
    await rec.park();
    await rec.hold(o.hold ?? 900);
    await rec.end(200);
    for (let i = 0; i < follow; i++) {
        const avoid = (await specialStones(rec.page, 'black')).map((s): Cell => [s.row, s.col]);
        await rec.begin(o.followCaption ?? '次の自分のターン');
        await rec.hold(300);
        const wm = await autoMove(rec, { avoid });
        if (wm) await playMove(rec, wm);
        await rec.idle(1, 40000);
        await rec.hold(700);
        await rec.end(500);
        if (i + 1 < follow) {
            const bm = await autoMove(rec, { avoid });
            if (bm) await rec.quiet(() => playMove(rec, bm));
        }
    }
    return m;
}
async function flankOnCamera(rec: Recorder, X: Cell, caption: string, endHold = 1300) {
    const { board } = await boardInfo(rec.page);
    const f = flankMoves(board, X, 1);
    await rec.begin(caption);
    await rec.hold(400);
    if (f.length) await playMove(rec, { row: f[0].e[0], col: f[0].e[1] });
    else { const m = await autoMove(rec); if (m) await playMove(rec, m); }
    await rec.idle(null, 40000);
    await rec.end(endHold);
    return f.length > 0;
}
const flankableScore = (board: Board): MoveScore => (m) => {
    const nb = place(board, m.row, m.col, 1);
    return (flankMoves(nb, [m.row, m.col], 1).length ? 50 : 0) - cd(m.row, m.col);
};
async function protectNextStone(rec: Recorder, cardId: string, caption: string) {
    await intro(rec);
    await rec.useCard(cardId);
    const { board } = await boardInfo(rec.page);
    const m = await placeBest(rec, flankableScore(board));
    await rec.park(); await rec.hold(500); await rec.end(200);
    await flankOnCamera(rec, [m.row, m.col], '相手のターン：' + caption);
}
async function whitePrelude(rec: Recorder, fn: () => Promise<void>, avoid: Cell[] = []) {
    if (await cur(rec.page) === 1) { const m = await autoMove(rec, { avoid }); if (m) await rec.quiet(() => playMove(rec, m)); }
    await fn();
    if (await cur(rec.page) === -1) { const m = await autoMove(rec, { avoid }); if (m) await rec.quiet(() => playMove(rec, m)); }
    await rec.idle(1, 40000);
}
async function whiteUsesOnCamera(rec: Recorder, cardId: string, pick: ((t: Target[]) => Promise<Target | null | undefined>) | null, caption: string) {
    await setHands(rec.page, { white: [cardId], chargeWhite: 99 });
    await rec.begin(caption);
    await rec.hold(300);
    await rec.useCard(cardId);
    if (pick) { const t = await targets(rec.page, 'white'); const p = await pick(t); if (p) await rec.clickCell(p.row, p.col); }
    await rec.idle(null, 40000);
    await rec.park();
    await rec.end(1100);
}
// Off-camera setup: black owns a special stone.
async function blackSpecialQuiet(rec: Recorder, cardId = 'destroy_dragon_01') {
    await setHands(rec.page, { black: [cardId] });
    await rec.quiet(async () => {
        await useCardQuiet(rec, cardId);
        const m = await autoMove(rec, { player: 1, prefer: (mm) => -cd(mm.row, mm.col) });
        if (m) await playMove(rec, m);
    });
    const m = await autoMove(rec, {});
    if (m && await cur(rec.page) === -1) await rec.quiet(() => playMove(rec, m));
    await rec.idle(1, 40000);
}
// Off-camera setup: white owns a special stone.
async function whiteSpecialQuiet(rec: Recorder, cardId = 'destroy_dragon_01') {
    await whitePrelude(rec, async () => {
        await setHands(rec.page, { white: [cardId], chargeWhite: 99 });
        await rec.quiet(async () => {
            await useCardQuiet(rec, cardId);
            const m = await autoMove(rec, { player: -1, prefer: (mm) => -cd(mm.row, mm.col) });
            if (m) await playMove(rec, m);
        });
    });
}
async function simpleUse(rec: Recorder, cardId: string, endHold = 1100) {
    await intro(rec);
    await rec.useCard(cardId);
    await rec.idle(null, 40000);
    await rec.park();
    await rec.hold(endHold);
    await rec.end(200);
}
interface ChargeDemoOptions { place?: boolean; score?: MoveScore | null; chargeBlack?: number; }
async function chargeDemo(rec: Recorder, cardId: string, o: ChargeDemoOptions = {}) {
    await setHands(rec.page, { chargeBlack: o.chargeBlack ?? 30 });
    const before = await charge(rec.page);
    await intro(rec);
    await rec.useCard(cardId);
    if (o.place) await placeBest(rec, o.score ?? null);
    await rec.idle(null, 40000);
    const after = await charge(rec.page);
    await rec.park(); await rec.hold(500); await rec.end(200);
    const d = after - before;
    await captionSeg(rec, `布石 ${before} → ${after}（${d >= 0 ? '+' : ''}${d}）`, 1600);
}
// Advance turns off camera until beginWhen(), then record until stillThere() turns false.
async function recordUntilGone(rec: Recorder, stillThere: () => Promise<boolean>, beginWhen: () => Promise<boolean>, caption: string, avoid: Cell[], maxHalf = 16) {
    for (let i = 0; i < maxHalf; i++) {
        if (!rec.cur && await beginWhen()) await rec.begin(caption);
        const m = await autoMove(rec, { avoid });
        if (!m) break;
        if (rec.cur) await playMove(rec, m); else await rec.quiet(() => playMove(rec, m));
        if (rec.cur) {
            await rec.hold(300);
            if (!(await stillThere())) { await rec.hold(600); await rec.end(900); return true; }
        }
    }
    if (rec.cur) await rec.end(600);
    return false;
}

const isW = (v: number) => v === -1;
const isB = (v: number) => v === 1;
const S: Record<string, Scenario> = {};

// ----- target / instant cards -----
S.destroy_01 = async (rec, page) => { await intro(rec); await useOn(rec, 'destroy_01', await pickStone(page, isW)); await outro(rec); };
S.swap_01 = async (rec, page) => { await intro(rec); await useOn(rec, 'swap_01', await pickStone(page, isW)); await outro(rec); };
S.position_swap_01 = async (rec, page) => {
    const { board } = await boardInfo(page);
    let best: { a: Cell; w: Cell; d: number } | null = null;
    for (const a of cellsOf(board, 1)) for (const w of cellsOf(board, -1)) {
        const d = Math.abs(a[0] - w[0]) + Math.abs(a[1] - w[1]);
        if (d <= 5 && (!best || d > best.d)) best = { a, w, d };
    }
    const pair = best;
    await intro(rec);
    await useOn(rec, 'position_swap_01', async (t, i) => {
        if (!pair) return t[0];
        const [r, c] = i === 0 ? pair.a : pair.w;
        return t.find((x) => x.row === r && x.col === c) || t[0];
    }, 1);
    await outro(rec);
};
S.strong_wind_01 = async (rec, page) => {
    await intro(rec);
    await useOn(rec, 'strong_wind_01', await pickStone(page, () => true, (t, b) => {
        const row = b[t.row];
        let L = 0; while (t.col - L - 1 >= 0 && row[t.col - L - 1] === 0) L++;
        let R = 0; while (t.col + R + 1 < row.length && row[t.col + R + 1] === 0) R++;
        return Math.min(L, R) * 20 + (L + R) * 3;
    }));
    await outro(rec);
};
const vertScore = (dir: number, crush: boolean) => (t: Target, b: Board) => {
    let e = 0, s = 0;
    for (let r = t.row + dir; r >= 0 && r < b.length; r += dir) { if (b[r][t.col] === 0) e++; else s++; }
    if (crush) return s * 10 + e;
    return (b[t.row + dir] && b[t.row + dir][t.col] === 0 ? e * 10 : -99) - cd(t.row, t.col) * 0.1;
};
S.buoyancy_01 = async (rec, page) => { await intro(rec); await useOn(rec, 'buoyancy_01', await pickStone(page, () => true, vertScore(-1, false))); await outro(rec); };
S.gravity_01 = async (rec, page) => { await intro(rec); await useOn(rec, 'gravity_01', await pickStone(page, () => true, vertScore(1, false))); await outro(rec); };
S.super_buoyancy_01 = async (rec, page) => { await intro(rec); await useOn(rec, 'super_buoyancy_01', await pickStone(page, isB, vertScore(-1, true))); await outro(rec, 1300); };
S.super_gravity_01 = async (rec, page) => { await intro(rec); await useOn(rec, 'super_gravity_01', await pickStone(page, isB, vertScore(1, true))); await outro(rec, 1300); };
S.super_attraction_01 = async (rec, page) => {
    const { board } = await boardInfo(page);
    await intro(rec);
    await useOn(rec, 'super_attraction_01', async (t, i) => {
        if (i === 0) { const arr = t.filter((x) => board[x.row][x.col] === 1).sort((a, b) => (a.row + a.col) - (b.row + b.col)); return arr[0] || t[0]; }
        return t.map((x) => ({ x, s: x.row + x.col })).sort((a, b) => b.s - a.s)[0].x;
    }, 1);
    await outro(rec, 1300);
};
S.teleport_01 = async (rec, page) => { await intro(rec); await useOn(rec, 'teleport_01', await pickStone(page, isW)); await outro(rec, 1300); };
S.cell_teleport_01 = async (rec, page) => { await intro(rec); await useOn(rec, 'cell_teleport_01', await pickStone(page, isW)); await outro(rec, 1300); };
S.reverse_will_01 = async (rec, page) => {
    await intro(rec);
    await useOn(rec, 'reverse_will_01', async (t) => {
        const { board } = await boardInfo(page);
        const arr = t.map((x) => { const v = board[x.row][x.col]; const b2 = board.map((r) => r.slice()); b2[x.row][x.col] = 0; return { x, s: flipsFor(b2, x.row, x.col, v).length }; });
        arr.sort((a, b) => b.s - a.s);
        return arr[0].x;
    });
    await outro(rec, 1300);
};
S.clone_01 = async (rec, page) => { await intro(rec); await useOn(rec, 'clone_01', await pickStone(page, isB, (t, b) => nearCount(b, t.row, t.col, 0) - cd(t.row, t.col) * 0.2)); await outro(rec, 1300); };
S.blockade_01 = async (rec, page) => { await intro(rec); await useOn(rec, 'blockade_01', await pickStone(page, () => true, (t, b) => -cd(t.row, t.col) + nearCount(b, t.row, t.col, 1))); await outro(rec, 1300); };
S.meteor_01 = async (rec, page) => { await intro(rec); await useOn(rec, 'meteor_01', await pickStone(page, isW)); await outro(rec, 1300); };
S.freeze_01 = async (rec, page) => { await intro(rec); await useOn(rec, 'freeze_01', await pickStone(page, isB)); await outro(rec, 1300); };
async function guardDemo(rec: Recorder, page: any, cardId: string) {
    const { board } = await boardInfo(page);
    let X: Target | null = null;
    await intro(rec);
    await useOn(rec, cardId, async (t) => {
        const arr = t.map((x) => ({ x, s: flankMoves(board, [x.row, x.col], 1).length ? 10 - cd(x.row, x.col) : -cd(x.row, x.col) - 20 }));
        arr.sort((a, b) => b.s - a.s);
        X = arr[0].x;
        return X;
    });
    await rec.park(); await rec.hold(400); await rec.end(200);
    const x = X as Target | null;
    if (!x) return;
    if (await cur(page) === 1) { const m = await autoMove(rec, { avoid: [[x.row, x.col]] }); if (m) await rec.quiet(() => playMove(rec, m)); }
    await flankOnCamera(rec, [x.row, x.col], '相手のターン：挟まれても反転しない');
}
S.guard_01 = (rec, page) => guardDemo(rec, page, 'guard_01');
S.guardian_god_01 = (rec, page) => guardDemo(rec, page, 'guardian_god_01');
S.living_will_01 = async (rec, page) => {
    let X: Target | null = null;
    await intro(rec);
    await useOn(rec, 'living_will_01', async (t) => { X = t.slice().sort((a, b) => cd(a.row, a.col) - cd(b.row, b.col))[0]; return X; });
    await rec.park(); await rec.hold(400); await rec.end(200);
    const x = X as Target | null;
    if (!x) return;
    if (await cur(page) === 1) { const m = await autoMove(rec, { avoid: [[x.row, x.col]] }); if (m) await rec.quiet(() => playMove(rec, m)); }
    await whiteUsesOnCamera(rec, 'destroy_01', async (t) => t.find((y) => y.row === x.row && y.col === x.col) || t[0], '相手が破壊しても復活する');
};
S.bomb_01 = async (rec, page) => {
    const { board } = await boardInfo(page);
    let X: Target | null = null;
    await intro(rec);
    await useOn(rec, 'bomb_01', async (t) => {
        const arr = t.map((x) => ({ x, s: nearCount(board, x.row, x.col, -1) + ((x.row === 0 || x.col === 0 || x.row === 7 || x.col === 7) ? 3 : 0) }));
        arr.sort((a, b) => b.s - a.s);
        X = arr[0].x;
        return X;
    });
    await rec.park(); await rec.hold(500); await rec.end(300);
    const x = X as Target | null;
    if (!x) return;
    const bomb = async () => (await markers(page)).find((m) => m.type === 'TIME_BOMB') || null;
    await recordUntilGone(rec, async () => !!(await bomb()), async () => { const b = await bomb(); return !!b && b.data && b.data.remainingTurns <= 1; }, '3ターン後', [[x.row, x.col]]);
};
S.poison_will_01 = async (rec, page) => {
    const { board } = await boardInfo(page);
    let X: Target | null = null;
    await intro(rec);
    await useOn(rec, 'poison_will_01', async (t) => {
        const arr = t.filter((x) => board[x.row][x.col] === -1).sort((a, b) => cd(a.row, a.col) - cd(b.row, b.col));
        X = arr[0] || t[0];
        return X;
    });
    await rec.park(); await rec.hold(700); await rec.end(300);
    const x = X as Target | null;
    if (!x) return;
    let halves = 0;
    await recordUntilGone(rec, async () => (await boardInfo(page)).board[x.row][x.col] !== 0, async () => { halves++; return halves >= 8; }, '5ターン後', [[x.row, x.col]]);
};
S.seed_01 = async (rec, page) => {
    let X: Target | null = null;
    await intro(rec);
    await useOn(rec, 'seed_01', async (t) => { X = t.slice().sort((a, b) => cd(a.row, a.col) - cd(b.row, b.col))[0]; return X; });
    await rec.park(); await rec.hold(700); await rec.end(300);
    const x = X as Target | null;
    if (!x) return;
    let halves = 0;
    await recordUntilGone(rec, async () => (await boardInfo(page)).board[x.row][x.col] === 0, async () => { halves++; return halves >= 8; }, '5ターン後', [[x.row, x.col]], 14);
};
S.trap_01 = async (rec, page) => {
    await setHands(page, { white: ['udg_01', 'lightning_01'], chargeWhite: 40, chargeBlack: 30 });
    const { board } = await boardInfo(page);
    let X: Target | null = null;
    await intro(rec);
    await useOn(rec, 'trap_01', async (t) => {
        const arr = t.map((x) => ({ x, s: flankMoves(board, [x.row, x.col], 1).length ? 10 - cd(x.row, x.col) : -50 }));
        arr.sort((a, b) => b.s - a.s);
        X = arr[0].x;
        return X;
    });
    await rec.park(); await rec.hold(500); await rec.end(200);
    const x = X as Target | null;
    if (!x) return;
    const before = await charge(page);
    await flankOnCamera(rec, [x.row, x.col], '相手が罠石を反転すると…', 900);
    const after = await charge(page);
    await captionSeg(rec, `布石を奪い（${before} → ${after}）相手の手札を全破壊`, 1700);
};
S.tempt_01 = async (rec) => { await whiteSpecialQuiet(rec); await intro(rec); await useOn(rec, 'tempt_01', async (t) => t[0]); await outro(rec, 1300); };
S.capture_01 = async (rec) => { await whiteSpecialQuiet(rec); await intro(rec); await useOn(rec, 'capture_01', async (t) => t[0]); await outro(rec, 1300); };
S.corrosion_01 = async (rec, page) => {
    await whiteSpecialQuiet(rec);
    const before = (await specialStones(page, 'white'))[0];
    await intro(rec);
    await useOn(rec, 'corrosion_01', async (t) => t.find((x) => before && x.row === before.row && x.col === before.col) || t[0]);
    await outro(rec, 900);
    if (!before) return;
    const after = await markerAt(page, before.row, before.col);
    if (after && turnsLeft(before.data) != null) await captionSeg(rec, `持続ターン ${turnsLeft(before.data)} → ${turnsLeft(after.data)}`);
};
async function extendDemo(rec: Recorder, page: any, cardId: string) {
    await blackSpecialQuiet(rec);
    await setHands(page, { black: [cardId] });
    const before = (await specialStones(page, 'black'))[0];
    await intro(rec);
    await useOn(rec, cardId, async (t) => t[0]);
    await outro(rec, 900);
    if (!before) return;
    const after = await markerAt(page, before.row, before.col);
    if (after) await captionSeg(rec, `持続ターン ${turnsLeft(before.data)} → ${turnsLeft(after.data)}`);
}
S.extend_life_01 = (rec, page) => extendDemo(rec, page, 'extend_life_01');
S.extend_life_god_01 = (rec, page) => extendDemo(rec, page, 'extend_life_god_01');
S.reincarnation_will_01 = async (rec, page) => { await blackSpecialQuiet(rec); await setHands(page, { black: ['reincarnation_will_01'] }); await intro(rec); await useOn(rec, 'reincarnation_will_01', async (t) => t[0]); await outro(rec, 1500); };
S.loss_will_01 = async (rec, page) => { await whiteSpecialQuiet(rec, 'lightning_01'); await setHands(page, { black: ['loss_will_01', 'guard_01', 'teleport_01'] }); await simpleUse(rec, 'loss_will_01', 1400); };
S.mass_freeze_will_01 = async (rec) => { await whiteSpecialQuiet(rec, 'destroy_dragon_01'); await simpleUse(rec, 'mass_freeze_will_01', 1400); };
S.causal_replay_01 = async (rec, page) => {
    const { board } = await boardInfo(page);
    const w = cellsOf(board, -1).sort((a, b) => cd(...a) - cd(...b))[0];
    await setHands(page, { black: ['meteor_01'] });
    await rec.quiet(async () => {
        await useCardQuiet(rec, 'meteor_01');
        await clickBoard(page, w[0], w[1]);
        await rec.idle(null);
        const m = await autoMove(rec, { player: 1 });
        if (m) await playMove(rec, m);
    });
    const m2 = await autoMove(rec, {});
    if (m2) await rec.quiet(() => playMove(rec, m2));
    await rec.idle(1);
    await setHands(page, { black: ['causal_replay_01'] });
    await intro(rec);
    await useOn(rec, 'causal_replay_01', async (t) => t[0]);
    await outro(rec, 1300);
};
S.board_expand_01 = async (rec, page) => {
    await intro(rec);
    await rec.useCard('board_expand_01');
    const t = await targets(page);
    const pick = t.find((x) => x.directionKey === 'right' && x.row >= 3) || t[0];
    const [x, y] = await rec.cellCenter(pick.row, pick.col);
    await rec.clickAt(x + (pick.directionKey === 'right' ? 14 : -14), y);
    await rec.idle(null, 40000);
    if (await pendingOf(page)) { await clickBoard(page, pick.row, pick.col, pick.directionKey); await rec.idle(null, 40000); }
    await outro(rec, 1400);
};
S.board_expand_god_01 = async (rec, page) => {
    await intro(rec);
    await rec.useCard('board_expand_god_01');
    for (let i = 0; i < 2; i++) {
        const t = await targets(page);
        if (!t.length) break;
        const pick = t.find((x) => x.row > 0 && x.col > 0) || t[t.length - 1];
        const [x, y] = await rec.cellCenter(pick.row, pick.col);
        const dir = pick.direction || { row: 0, col: 0 };
        await rec.clickAt(x + 12 * Math.sign(dir.col || 0), y + 12 * Math.sign(dir.row || 0));
        await rec.idle(null, 40000);
        const p = await pendingOf(page);
        if (p && (p.selectedCount || 0) === i) { await clickBoard(page, pick.row, pick.col, pick.directionKey); await rec.idle(null, 40000); }
        if (!(await pendingOf(page))) break;
    }
    if (await pendingOf(page)) {
        const b = await page.$('button:has-text("確定")');
        if (b) { await b.click(); await rec.idle(null, 40000); }
    }
    await outro(rec, 1500);
};
S.board_shrink_01 = async (rec, page) => {
    const { board } = await boardInfo(page);
    await intro(rec);
    await useOn(rec, 'board_shrink_01', async (t) => {
        const arr = t.map((x) => ({ x, s: (board[x.row][x.col] === -1 ? 3 : 0) + (x.col === 7 ? 2 : 0) - Math.abs(x.row - 4) * 0.3 }));
        arr.sort((a, b) => b.s - a.s);
        return arr[0].x;
    }, 2);
    await outro(rec, 1400);
};
S.board_shrink_god_01 = async (rec, page) => {
    await intro(rec);
    await rec.useCard('board_shrink_god_01');
    const t = await targets(page);
    const corner = t.find((x) => x.row === 7 && x.col === 7) || t[t.length - 1];
    await rec.clickCell(corner.row, corner.col);
    await rec.quiet(() => rec.idle(null));
    const t2 = await targets(page);
    if (t2.length) { const d = t2.find((x) => x.col === 7) || t2[0]; await rec.clickCell(d.row, d.col); }
    await rec.idle(null, 40000);
    await outro(rec, 1500);
};

// ----- hand / charge / information cards -----
const flipScore: MoveScore = (m) => m.flips * 2 - cd(m.row, m.col) * 0.2;
S.chest_01 = (rec) => chargeDemo(rec, 'chest_01', { chargeBlack: 24 });
S.ribo_01 = (rec) => chargeDemo(rec, 'ribo_01', { chargeBlack: 10 });
S.equality_will_01 = async (rec, page) => { await setHands(page, { chargeWhite: 40 }); await chargeDemo(rec, 'equality_will_01', { chargeBlack: 0 }); };
S.gold_stone = (rec) => chargeDemo(rec, 'gold_stone', { place: true, chargeBlack: 20, score: flipScore });
S.silver_stone = (rec) => chargeDemo(rec, 'silver_stone', { place: true, chargeBlack: 20, score: flipScore });
S.rainbow_stone = (rec) => chargeDemo(rec, 'rainbow_stone', { place: true, chargeBlack: 20, score: flipScore });
S.crystal_stone = async (rec, page) => {
    const bonus = await page.evaluate(() => (window as any).cardState.boardBonusByCell || {});
    const valueAt = (r: number, c: number) => { const v = bonus[r + ',' + c]; return Number((v && (v.value ?? v)) || 0); };
    await chargeDemo(rec, 'crystal_stone', { place: true, chargeBlack: 20, score: (m) => valueAt(m.row, m.col) * 3 - cd(m.row, m.col) * 0.1 });
};
S.rebuild_01 = async (rec, page) => {
    await setHands(page, { black: ['rebuild_01', 'guard_01', 'seed_01'], deckBlack: ['udg_01', 'lightning_01', 'swap_01', 'teleport_01', 'gravity_01'] });
    await simpleUse(rec, 'rebuild_01', 1500);
};
S.heaven_01 = async (rec, page) => {
    await intro(rec);
    await rec.useCard('heaven_01');
    await rec.hold(400);
    const ids: string[] = await page.evaluate(() => Array.from(document.querySelectorAll('#heaven-blessing-overlay .card-item')).map((e) => (e as HTMLElement).dataset.cardId || ''));
    if (ids.length) {
        await rec.clickSel(`#heaven-blessing-overlay .card-item[data-card-id="${ids[Math.min(2, ids.length - 1)]}"]`);
        await rec.hold(450);
        await rec.clickSel('#heaven-blessing-select-btn');
    }
    await rec.idle(null, 40000);
    await outro(rec, 1400);
};
S.condemn_01 = async (rec, page) => {
    await setHands(page, { white: ['udg_01', 'lightning_01', 'guard_01'] });
    await intro(rec);
    await rec.useCard('condemn_01');
    await rec.hold(400);
    await rec.clickSel('#heaven-blessing-overlay .card-item[data-card-id="udg_01"]');
    await rec.hold(450);
    await rec.clickSel('#heaven-blessing-select-btn');
    await rec.idle(null, 40000);
    await outro(rec, 1400);
};
S.reveal_hand_01 = async (rec, page) => {
    // Normal (non human-vs-human) viewing so the opponent hand starts face down.
    await page.evaluate(() => { (window as any).DEBUG_HUMAN_VS_HUMAN = false; });
    await setHands(page, { white: ['udg_01', 'lightning_01', 'guard_01'] });
    await simpleUse(rec, 'reveal_hand_01', 1600);
};
S.execution_01 = async (rec, page) => {
    await setHands(page, { white: [] });
    const m = await autoMove(rec, {});
    if (m) await rec.quiet(() => playMove(rec, m));
    await whiteUsesOnCamera(rec, 'destroy_01', async (t) => {
        const { board } = await boardInfo(page);
        return t.filter((x) => board[x.row][x.col] === 1).sort((a, b) => cd(a.row, a.col) - cd(b.row, b.col))[0];
    }, '相手のターン：自分の石が破壊された');
    await setHands(page, { white: ['udg_01', 'lightning_01', 'guard_01', 'teleport_01'] });
    const wm = await autoMove(rec, {});
    if (wm) await rec.quiet(() => playMove(rec, wm));
    await rec.idle(1);
    await setHands(page, { black: ['execution_01'] });
    await simpleUse(rec, 'execution_01', 1500);
};
S.salvation_01 = async (rec, page) => {
    const m = await autoMove(rec, {});
    if (m) await rec.quiet(() => playMove(rec, m));
    await whiteUsesOnCamera(rec, 'cross_bomb_01', null, '相手のターン：自分の石が破壊された');
    await rec.begin('相手のターン：自分の石が破壊された');
    const wm = await autoMove(rec, {});
    if (wm) await playMove(rec, wm);
    await rec.idle(1, 40000);
    await rec.end(600);
    await setHands(page, { black: ['salvation_01'] });
    await simpleUse(rec, 'salvation_01', 1500);
};
S.reinforcement_01 = (rec) => simpleUse(rec, 'reinforcement_01', 1400);
S.support_troops_01 = (rec) => simpleUse(rec, 'support_troops_01', 1400);
S.chaos_summon_01 = (rec) => simpleUse(rec, 'chaos_summon_01', 1600);
S.last_resort_01 = async (rec, page) => {
    // Make a position where black is behind and has no legal move (removes white stones that give black a line).
    const ok = await page.evaluate(() => {
        const w = window as any;
        const gs = w.gameState;
        const b: number[][] = gs.board.map((r: number[]) => r.slice());
        const rows = b.length, cols = b[0].length;
        const D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        const inside = (r: number, c: number) => r >= 0 && c >= 0 && r < rows && c < cols;
        const blacks: number[][] = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (b[r][c] === 1) blacks.push([r, c]);
        blacks.sort((p, q) => (Math.abs(p[0] - 3.5) + Math.abs(p[1] - 3.5)) - (Math.abs(q[0] - 3.5) + Math.abs(q[1] - 3.5)));
        const keep = blacks.slice(0, 3);
        for (const [r, c] of blacks) if (!keep.some((k) => k[0] === r && k[1] === c)) b[r][c] = -1;
        for (let guard = 0; guard < 200; guard++) {
            let found: number[] | null = null;
            for (let r = 0; r < rows && !found; r++) for (let c = 0; c < cols && !found; c++) {
                if (b[r][c] !== 0) continue;
                for (const [dr, dc] of D) {
                    let rr = r + dr, cc = c + dc, k = 0;
                    while (inside(rr, cc) && b[rr][cc] === -1) { rr += dr; cc += dc; k++; }
                    if (k && inside(rr, cc) && b[rr][cc] === 1) { found = [r + dr, c + dc]; break; }
                }
            }
            if (!found) break;
            b[found[0]][found[1]] = 0;
        }
        const updates: any[] = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (b[r][c] !== gs.board[r][c]) updates.push({ row: r, col: c, value: b[r][c] });
        w.setStateCellValues(gs, updates, w.cardState);
        const boardEl = document.getElementById('board');
        if (w.renderBoardFull) w.renderBoardFull(boardEl); else if (w.requestBoardRender) w.requestBoardRender();
        return keep.length > 0;
    });
    if (!ok) throw new Error('last_resort setup failed');
    await page.waitForTimeout(800);
    await rec.begin('石数負け・置ける場所なし');
    await rec.hold(900);
    await rec.useCard('last_resort_01');
    for (let i = 0; i < 3; i++) {
        const mv = await legalMoves(page, 1);
        const t = await targets(page);
        const list: Target[] = t.length ? t : mv;
        if (!list.length) break;
        const p = list.slice().sort((a, b) => cd(a.row, a.col) - cd(b.row, b.col))[0];
        await rec.clickCell(p.row, p.col);
        await rec.idle(null, 40000);
    }
    await outro(rec, 1400);
};

// ----- next-stone cards -----
const nearEnemy: MoveScore = (m, b) => nearCount(b, m.row, m.col, -1) * 3 - cd(m.row, m.col) * 0.5;
const freeNear: MoveScore = (m, b) => (m.flips === 0 ? 5 : 0) + nearCount(b, m.row, m.col, -1) * 3 - cd(m.row, m.col) * 0.5;
const roomy: MoveScore = (m, b) => nearCount(b, m.row, m.col, 0) - cd(m.row, m.col);
const central: MoveScore = (m) => -cd(m.row, m.col);
S.free_01 = async (rec) => { await nextStone(rec, 'free_01', { score: (m) => (m.flips === 0 ? 20 : 0) - cd(m.row, m.col) }); };
S.sniper_01 = async (rec) => { await nextStone(rec, 'sniper_01', { score: freeNear, follow: 1 }); };
S.hard_01 = (rec) => protectNextStone(rec, 'hard_01', '次の相手ターンは反転されない');
S.ghost_01 = (rec) => protectNextStone(rec, 'ghost_01', '挟まれても反転しない');
S.regen_01 = (rec) => protectNextStone(rec, 'regen_01', '反転されても復活する');
S.perma_01 = (rec) => protectNextStone(rec, 'perma_01', '挟まれても反転しない');
S.afterimage_will_01 = (rec) => protectNextStone(rec, 'afterimage_will_01', '挟まれても回避する');
S.sacrifice_will_01 = async (rec, page) => {
    await nextStone(rec, 'sacrifice_will_01', { score: central });
    await whiteUsesOnCamera(rec, 'destroy_01', async (t) => { const { board } = await boardInfo(page); return t.filter((x) => board[x.row][x.col] === 1)[0] || t[0]; }, '相手がカードを使うと身代わりに無効化');
};
S.proliferation_01 = async (rec) => {
    const m = await nextStone(rec, 'proliferation_01', { score: roomy });
    await whiteUsesOnCamera(rec, 'destroy_01', async (t) => t.find((x) => x.row === m.row && x.col === m.col) || t[0], '相手が破壊しようとすると…');
};
S.stone_salvation_god_01 = async (rec, page) => {
    const m = await nextStone(rec, 'stone_salvation_god_01', { score: central });
    await whiteUsesOnCamera(rec, 'destroy_01', async (t) => {
        const { board } = await boardInfo(page);
        return t.filter((x) => board[x.row][x.col] === 1 && !(x.row === m.row && x.col === m.col)).sort((a, b) => cd(a.row, a.col) - cd(b.row, b.col))[0] || t[0];
    }, '破壊された石が復活する');
};
S.zombie_will_01 = async (rec) => { await nextStone(rec, 'zombie_will_01', { follow: 1, followCaption: '自ターン開始時に移動' }); };
S.udr_01 = async (rec) => { await nextStone(rec, 'udr_01', { score: freeNear, follow: 1 }); };
S.udg_01 = async (rec) => { await nextStone(rec, 'udg_01', { score: freeNear, follow: 1 }); };
S.breeding_01 = async (rec) => { await nextStone(rec, 'breeding_01', { score: roomy, follow: 1 }); };
const bombScore = (dirs: number[][]): MoveScore => (m, b) => {
    const nb = place(b, m.row, m.col, 1);
    let n = 0;
    for (const [dr, dc] of dirs) for (let k = 1; k <= 2; k++) {
        const r = m.row + dr * k, c = m.col + dc * k;
        if (inb(nb, r, c) && nb[r][c] === -1) n += 2; else if (inb(nb, r, c) && nb[r][c] === 1) n += 1;
    }
    return n - cd(m.row, m.col) * 0.3;
};
S.cross_bomb_01 = async (rec) => { await nextStone(rec, 'cross_bomb_01', { score: bombScore([[0, 1], [0, -1], [1, 0], [-1, 0]]), hold: 1300 }); };
S.x_bomb_01 = async (rec) => { await nextStone(rec, 'x_bomb_01', { score: bombScore([[1, 1], [1, -1], [-1, 1], [-1, -1]]), hold: 1300 }); };
S.hyperactive_01 = async (rec) => { await nextStone(rec, 'hyperactive_01', { score: roomy, follow: 1, followCaption: '両者のターン開始時に移動' }); };
S.extreme_hyperactive_01 = async (rec) => { await nextStone(rec, 'extreme_hyperactive_01', { score: (m, b) => nearCount(b, m.row, m.col, 0) + nearCount(b, m.row, m.col, -1) - cd(m.row, m.col), follow: 1, followCaption: '両者のターン開始時に移動' }); };
S.ultimate_hyperactive_01 = async (rec) => { await nextStone(rec, 'ultimate_hyperactive_01', { score: roomy, follow: 1, followCaption: '両者のターン開始時に移動' }); };
S.instant_hyperactive_01 = async (rec) => { await nextStone(rec, 'instant_hyperactive_01', { score: roomy, hold: 1600 }); };
S.escape_01 = async (rec) => { await nextStone(rec, 'escape_01', { score: roomy, follow: 1, followCaption: '毎ターン逃げるように移動' }); };
S.robot_vacuum_01 = async (rec) => { await nextStone(rec, 'robot_vacuum_01', { score: nearEnemy, follow: 1 }); };
S.gluttonous_will_01 = async (rec, page) => { await setHands(page, { black: ['gluttonous_will_01', 'guard_01', 'seed_01'] }); await nextStone(rec, 'gluttonous_will_01', { score: nearEnemy, follow: 1 }); };
S.will_hunter_king_01 = async (rec) => { await nextStone(rec, 'will_hunter_king_01', { score: nearEnemy, follow: 1 }); };
S.destroy_dragon_01 = async (rec) => { await nextStone(rec, 'destroy_dragon_01', { score: nearEnemy, follow: 1, hold: 1300 }); };
S.lightning_01 = async (rec) => { await nextStone(rec, 'lightning_01', { follow: 1, hold: 1400 }); };
S.meteor_god_01 = async (rec) => { await nextStone(rec, 'meteor_god_01', { follow: 1, hold: 1400 }); };
S.fire_will_01 = async (rec) => { await nextStone(rec, 'fire_will_01', { follow: 1, hold: 1400 }); };
S.water_will_01 = async (rec) => { await nextStone(rec, 'water_will_01', { follow: 1, hold: 1400 }); };
S.grass_will_01 = async (rec) => { await nextStone(rec, 'grass_will_01', { follow: 1, hold: 1400 }); };
S.taboo_reverse_01 = async (rec) => { await nextStone(rec, 'taboo_reverse_01', { score: (m) => m.flips * 2 - cd(m.row, m.col) * 0.3, hold: 1300 }); };
const chainScore: MoveScore = (m, b) => { const nb = place(b, m.row, m.col, 1); return (sandwichedRuns(nb, 1) - sandwichedRuns(b, 1)) * 3 + m.flips - cd(m.row, m.col) * 0.2; };
S.double_chain_01 = async (rec) => { await nextStone(rec, 'double_chain_01', { score: chainScore, hold: 1600 }); };
S.triple_chain_01 = async (rec) => { await nextStone(rec, 'triple_chain_01', { score: chainScore, hold: 1600 }); };
S.quad_chain_01 = async (rec) => { await nextStone(rec, 'quad_chain_01', { score: chainScore, hold: 1600 }); };
S.infinite_chain_01 = async (rec) => { await nextStone(rec, 'infinite_chain_01', { score: chainScore, hold: 1800 }); };
async function multiPlace(rec: Recorder, cardId: string, n: number) {
    await intro(rec);
    await rec.useCard(cardId);
    for (let i = 0; i < n; i++) {
        if (await cur(rec.page) !== 1) break;
        if (!(await legalMoves(rec.page, 1)).length) break;
        await placeBest(rec, (m) => m.flips - cd(m.row, m.col) * 0.3);
        await rec.hold(200);
    }
    await outro(rec, 1300);
}
S.double_01 = (rec) => multiPlace(rec, 'double_01', 2);
S.triple_01 = (rec) => multiPlace(rec, 'triple_01', 3);
S.quad_01 = (rec) => multiPlace(rec, 'quad_01', 4);
S.infinite_01 = (rec) => multiPlace(rec, 'infinite_01', 6);
S.work_01 = async (rec, page) => {
    await setHands(page, { chargeBlack: 20 });
    await nextStone(rec, 'work_01', { score: central });
    for (let i = 0; i < 2; i++) {
        const avoid = (await specialStones(page, 'black')).map((s): Cell => [s.row, s.col]);
        const before = await charge(page);
        const wm = await autoMove(rec, { avoid });
        if (wm) await rec.quiet(() => playMove(rec, wm));
        await rec.quiet(() => rec.idle(1, 40000));
        const after = await charge(page);
        await rec.begin({ caption: `自ターン開始時に布石 +${after - before}` });
        await rec.end(1400);
        if (i === 0) { const bm = await autoMove(rec, { avoid, prefer: (m) => -m.flips }); if (bm) await rec.quiet(() => playMove(rec, bm)); }
    }
};
S.ultimate_work_god_01 = async (rec, page) => {
    await setHands(page, { chargeBlack: 40 });
    await nextStone(rec, 'ultimate_work_god_01', { score: central });
    const avoid = (await specialStones(page, 'black')).map((s): Cell => [s.row, s.col]);
    const before = await charge(page);
    const wm = await autoMove(rec, { avoid });
    if (wm) await rec.quiet(() => playMove(rec, wm));
    await rec.quiet(() => rec.idle(1, 40000));
    const after = await charge(page);
    await rec.begin({ caption: `自ターン開始時に布石 ${before} → ${after}` });
    await rec.end(1500);
};
S.fate_will_01 = async (rec, page) => {
    await nextStone(rec, 'fate_will_01', { score: central, hold: 500 });
    if (await cur(page) === 1) await placeBest(rec);
    await rec.begin('相手のターンを自分が操作できる');
    await rec.hold(400);
    const wm = await autoMove(rec, { prefer: (m) => m.flips });
    if (wm) await playMove(rec, wm, true);
    await rec.idle(null, 40000);
    await rec.park();
    await rec.end(1200);
};
async function timeStop(rec: Recorder, page: any, cardId: string) {
    await intro(rec);
    await rec.useCard(cardId);
    await rec.idle(null, 40000);
    await placeBest(rec, central);
    await rec.park(); await rec.hold(700); await rec.end(300);
    const st = async (): Promise<{ rem: number; cur: number }> => page.evaluate(() => {
        const w = window as any;
        return { rem: (w.cardState.timeStopConsecutiveTurnsRemainingByPlayer || {}).black || 0, cur: w.gameState.currentPlayer };
    });
    for (let i = 0; i < 14; i++) {
        const s = await st();
        if (s.rem > 0 && s.cur === 1) break;
        const avoid = (await specialStones(page, 'black')).map((x): Cell => [x.row, x.col]);
        const m = await autoMove(rec, { avoid });
        if (!m) break;
        await rec.quiet(() => playMove(rec, m));
    }
    await rec.begin('5ターン後：時間停止で連続行動');
    await rec.hold(600);
    for (let i = 0; i < 5; i++) {
        if ((await st()).cur !== 1) break;
        if (!(await legalMoves(page, 1)).length) break;
        await placeBest(rec, (m) => m.flips - cd(m.row, m.col) * 0.3);
        await rec.hold(250);
        if ((await st()).rem <= 0 && i > 0) break;
    }
    await rec.park();
    await rec.end(1200);
}
S.time_stop_god_01 = (rec, page) => timeStop(rec, page, 'time_stop_god_01');
S.time_stop_deity_01 = (rec, page) => timeStop(rec, page, 'time_stop_deity_01');

export const SCENARIOS: Readonly<Record<string, Scenario>> = S;

export async function runScenario(rec: Recorder, cardId: string) {
    const fn = S[cardId];
    if (!fn) throw new Error('no demo scenario for ' + cardId);
    rec.showUseFor = SHOW_USE_CARD_IDS;
    await setHands(rec.page, { black: [cardId], white: [], chargeBlack: 99, chargeWhite: 99 });
    await fn(rec, rec.page);
}
