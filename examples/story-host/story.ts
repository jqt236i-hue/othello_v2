import { mountBattle, type MountedBattle } from '@card-reversi/battle/host';
import type { BattleConfig, BattleSave } from '@card-reversi/battle';
interface Progress { version: 1; chapter: number; rewards: number; attempt: number; settledIds: string[]; battle: BattleSave | null }
declare global { interface Window { storyStorage: { load(): Promise<Progress | null>; save(progress: Progress): Promise<void> } } }
const el = (id: string) => document.getElementById(id)!;
let progress: Progress = { version: 1, chapter: 0, rewards: 0, attempt: 0, settledIds: [], battle: null };
let current: MountedBattle | null = null;
let loaded = false, busy = false;
const report = (error: unknown) => { el('error').textContent = `保存・開始に失敗しました。${error instanceof Error ? error.message : String(error)}`; };
function render() {
    el('progress').textContent = `進行 ${progress.chapter} ／ 結果受領 ${progress.rewards} 回`;
    el('resume').hidden = !progress.battle;
    (el('start') as HTMLButtonElement).disabled = !loaded || busy || !!current || !!progress.battle;
    (el('resume') as HTMLButtonElement).disabled = !loaded || busy || !!current;
    (el('save') as HTMLButtonElement).disabled = !loaded || busy || !current;
}
let progressWrites = Promise.resolve();
function persist(update: (latest: Progress) => Progress): Promise<void> {
    const operation = progressWrites.then(async () => {
        const next = update(progress);
        await window.storyStorage.save(next); progress = next; render();
    });
    progressWrites = operation.catch(() => {});
    return operation;
}
async function enter(input: BattleConfig | BattleSave) {
    if (current) throw new Error('戦闘はすでに開いています');
    el('error').textContent = ''; el('scene').hidden = true; el('play').hidden = false;
    const mounted = mountBattle(el('battle'), './vendor/browser/index.html', input); current = mounted;
    try {
        await mounted.ready;
        const initial = await mounted.save();
        await persist(latest => ({ ...latest, battle: initial }));
        void mounted.finished.then(async outcome => {
            if (current !== mounted || outcome.kind === 'cancelled') return;
            if (outcome.kind === 'error') {
                leave();
                el('error').textContent = `戦闘を続けられませんでした。最後に保存した状態から再開できます。${outcome.message}`;
                return;
            }
            await persist(latest => {
                const received = latest.settledIds.includes(outcome.resultId);
                return { ...latest, battle: null,
                    chapter: latest.chapter + (received || outcome.result.winner !== 'black' ? 0 : 1),
                    rewards: latest.rewards + (received ? 0 : 1),
                    settledIds: received ? latest.settledIds : [...latest.settledIds, outcome.resultId] };
            });
            el('line').textContent = outcome.result.winner === 'black' ? '「見事だ。次の道へ進むといい。」'
                : outcome.result.winner === 'white' ? '「まだ終わりではない。もう一度、挑んでみるか。」' : '「互いに譲らぬ一局だった。また会おう。」';
            leave();
        }).catch(error => { el('battleNotice').textContent = '結果を保存できませんでした。中断ボタンで保存を再試行できます。'; report(error); });
    } catch (error) { leave(); throw error; }
}
function leave() { current?.dispose(); current = null; el('play').hidden = true; el('scene').hidden = false; render(); }
el('start').onclick = async () => {
    if (!loaded || busy || current || progress.battle) return;
    busy = true; render();
    try {
        await persist(latest => ({ ...latest, attempt: latest.attempt + 1 }));
        await enter({ version: 1, battleId: `gate-${progress.attempt}`, seed: crypto.getRandomValues(new Uint32Array(1))[0],
            players: { black: { controller: 'human' }, white: { controller: 'cpu', profile: '1' } } });
    } catch (error) { report(error); }
    finally { busy = false; render(); }
};
el('resume').onclick = async () => {
    if (!loaded || busy || current || !progress.battle) return;
    busy = true; render();
    try { await enter(progress.battle); } catch (error) { report(error); }
    finally { busy = false; render(); }
};
el('save').onclick = async () => {
    const battle = current; if (!loaded || busy || !battle) return;
    busy = true; render(); el('battleNotice').textContent = '操作の区切りで保存しています…';
    try {
        const checkpoint = await battle.save();
        await persist(latest => latest.settledIds.includes(`${checkpoint.config.battleId}:result`)
            ? latest : { ...latest, battle: checkpoint });
        if (current === battle) leave();
    }
    catch (error) { el('battleNotice').textContent = '保存できませんでした。もう一度お試しください。'; report(error); }
    finally { busy = false; render(); }
};
render();
try { const saved = await window.storyStorage.load(); if (saved) progress = saved; loaded = true; render(); document.documentElement.dataset.storyReady = 'true'; }
catch (error) { render(); report(error); }
