import type { BattleConfig } from '../../shared/battle/config';
import type { BattleSave } from '../../shared/battle/save';
import type { BattleResult } from '../../shared/battle/types';

export type BattleOutcome = { kind: 'finished'; battleId: string; resultId: string; result: BattleResult }
    | { kind: 'cancelled' } | { kind: 'error'; message: string };
export interface MountedBattle {
    ready: Promise<void>;
    finished: Promise<BattleOutcome>;
    save(): Promise<BattleSave>;
    dispose(): void;
}
const owners = new WeakSet<HTMLElement>();

/** Same-origin packaged game URL. Every mount owns a fresh document and its resources. */
export function mountBattle(container: HTMLElement, gameUrl: string, input: BattleConfig | BattleSave): MountedBattle {
    if (owners.has(container)) throw new Error('A battle is already mounted here');
    const url = new URL(gameUrl, container.ownerDocument.baseURI);
    if (url.origin !== new URL(container.ownerDocument.baseURI).origin) throw new Error('Battle URL must be same-origin');
    url.searchParams.set('battleEmbed', '1');
    owners.add(container);
    const frame = container.ownerDocument.createElement('iframe');
    frame.title = 'カードリバーシの戦闘';
    frame.style.cssText = 'width:100%;height:100%;border:0;display:block';
    let disposed = false, api: any, timer: any, rejectReady: (error: Error) => void;
    let resolveFinished: (outcome: BattleOutcome) => void;
    const finished = new Promise<BattleOutcome>(resolve => { resolveFinished = resolve; });
    const ready = new Promise<void>((resolve, reject) => {
        rejectReady = reject;
        const start = Date.now();
        const poll = async () => {
            if (disposed) return;
            try {
                const root = frame.contentWindow as any;
                api = root?.CardReversiBattle;
                if (api) {
                    await api.start(input);
                    if (disposed) return;
                    void api.finished.then((outcome: BattleOutcome) => { if (!disposed) resolveFinished(JSON.parse(JSON.stringify(outcome))); });
                    resolve(); return;
                }
                if (root?.document?.documentElement?.dataset.browserBootState === 'error') throw new Error('Battle page failed to boot');
                if (Date.now() - start > 120000) throw new Error('Battle page timed out');
                timer = setTimeout(poll, 25);
            } catch (error) {
                reject(error);
                resolveFinished({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
            }
        };
        frame.src = url.href;
        container.appendChild(frame);
        void poll();
    });
    // ready stays rejecting for callers; internally prevent an unhandled rejection on early exit.
    void ready.catch(() => {});
    return {
        ready, finished,
        async save() { await ready; if (disposed) throw new Error('Battle disposed'); return JSON.parse(JSON.stringify(await api.save())); },
        dispose() {
            if (disposed) return;
            disposed = true;
            clearTimeout(timer);
            try { api?.dispose(); } finally {
                frame.remove(); owners.delete(container);
                rejectReady(new Error('Battle disposed')); resolveFinished({ kind: 'cancelled' });
            }
        }
    };
}
