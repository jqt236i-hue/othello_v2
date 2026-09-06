// Explicitly enabled only by the isolated benchmark. No default models or deployment.
import Features = require('./policy-feature-vector');
type Head = 'place' | 'card' | 'target' | 'value';
let bundle: any = null;
let color = '';
let enabled: string[] = [];
let stats: any = {};

export function infer(model: any, input: ArrayLike<number>): number[] {
    let x = Array.from(input);
    model.layers.forEach((layer: any, index: number) => {
        x = layer.weights.map((row: number[], j: number) => {
            let sum = layer.bias[j];
            for (let k = 0; k < row.length; k++) sum += row[k] * x[k];
            return index < model.layers.length - 1 ? Math.max(0, sum) : model.tanh ? Math.tanh(sum) : sum;
        });
    });
    if (x.some(v => !Number.isFinite(v))) throw new Error('Non-finite candidate output');
    return x;
}

export function configure(data: any, player: string, heads: string[]) {
    bundle = null; enabled = []; color = '';
    if (data.schema !== 'candidate_probe.v1' || !['black', 'white'].includes(player)) throw new Error('Invalid candidate probe');
    for (const head of heads) {
        const model = data.heads[head];
        if (!model) throw new Error(`Missing candidate head: ${head}`);
        const input = Array.from({ length: model.meta.inputDim }, (_, i) => -1 + 2 * i / (model.meta.inputDim - 1));
        const actual = infer(model, input);
        if (!Array.isArray(model.golden) || actual.length !== model.golden.length || actual.length === 0 ||
            actual.some((v, i) => !Number.isFinite(model.golden[i]) || Math.abs(v - model.golden[i]) > 0.0001)) {
            throw new Error(`Candidate numerical parity failed: ${head}`);
        }
    }
    bundle = data; color = player; enabled = heads;
    stats = { color, heads, calls: {}, used: {}, unsupported: {}, inferenceMs: 0, maxInferenceMs: 0 };
}

export function getStatus() { return JSON.parse(JSON.stringify(stats)); }
export function active(player: string, head: string) { return bundle && color === player && enabled.includes(head); }
export function used(head: string) { stats.used[head] = (stats.used[head] || 0) + 1; }
export function predict(head: Head, context: any): number[] | null {
    if (!active(context.playerKey, head)) return null;
    const board = context.board;
    // Callers provide an explicit dense adapter; reject holes and expansion.
    if (!Array.isArray(board) || board.length !== 8 || board.some((r: any) => !Array.isArray(r) || r.length !== 8 || r.some((v: any) => ![0, 1, -1].includes(v)))) {
        stats.unsupported[head] = (stats.unsupported[head] || 0) + 1; return null;
    }
    const start = performance.now();
    const model = bundle.heads[head];
    const result = infer(model, Features.buildPolicyFeatureVector(context, model.meta));
    const ms = performance.now() - start;
    stats.calls[head] = (stats.calls[head] || 0) + 1;
    stats.inferenceMs += ms; stats.maxInferenceMs = Math.max(stats.maxInferenceMs, ms);
    return result;
}

export function chooseCell(head: 'place' | 'target', context: any, cells: any[]): any {
    if (!cells.length || cells.some(c => !Number.isInteger(c.row) || !Number.isInteger(c.col)) ||
        new Set(cells.map(c => `${c.row},${c.col}`)).size !== cells.length) return null;
    const scores = predict(head, context);
    if (!scores) return null;
    const meta = bundle.heads[head].meta;
    const index = (c: any) => scores.length === 64 ? c.row * 8 + c.col : (c.row - meta.paddedBoardMinCoord) * meta.paddedBoardSize + c.col - meta.paddedBoardMinCoord;
    const best = cells.reduce((a, b) => scores[index(b)] > scores[index(a)] ? b : a);
    if (!Number.isFinite(scores[index(best)])) throw new Error('Invalid candidate coordinate mapping');
    used(head); return best;
}

export function chooseCard(context: any): { cardId: string | null } | null {
    const scores = predict('card', context);
    if (!scores) return null;
    const ids: string[] = bundle.heads.card.meta.cardActionIds;
    const legal = new Set(context.usableCardIds || []);
    let best = -Infinity, cardId: string | null = null;
    ids.forEach((id, i) => {
        if ((id === '__no_card__' || legal.has(id)) && scores[i] > best) { best = scores[i]; cardId = id === '__no_card__' ? null : id; }
    });
    if (best === -Infinity) throw new Error('No legal candidate card output');
    used('card'); return { cardId };
}
