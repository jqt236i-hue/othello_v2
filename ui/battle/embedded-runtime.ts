import { prepareBattle, createBattleSave, validateBattleSave, BattleMatch } from '../../game/battle/index';
import type { BattleConfig } from '../../shared/battle/config';
import type { BattleSave } from '../../shared/battle/save';

/** One document owns one battle. The host removes this document on dispose. */
export function installEmbeddedBattle(root: any, disposeWorkers: () => void): void {
    const style = root.document.createElement('style');
    style.textContent = '#leftActionButtons,#side-panel,#resetBtn,#autoToggleBtn,#cpu-character-panel select,#cpu-character-panel button{display:none!important}';
    root.document.head.appendChild(style);
    const load = (id: string) => root.require(id);
    const turn = load('game/turn-manager');
    const cards = load('card-system');
    const playback = load('ui/playback-state-manager');
    const resultUI = load('ui/result-overlay');
    const cpu = load('game/cpu-turn-handler');
    const renderer = load('ui/board-renderer');
    let status = 'unmounted';
    let config: any;
    let resultRequested = false;
    let complete: (value: any) => void;
    const finished = new Promise(resolve => { complete = resolve; });
    const waiters = new Set<() => void>();
    const assertActive = () => { if (status === 'disposed' || status === 'error') throw new Error(`Battle is ${status}`); };
    const waitForBoundary = () => new Promise<void>((resolve, reject) => {
        const started = Date.now();
        let timer: any;
        let frame: number | null = null;
        const stop = () => { clearTimeout(timer); if (frame !== null) root.cancelAnimationFrame(frame); waiters.delete(cancel); };
        const cancel = () => { stop(); reject(new Error('Battle disposed')); };
        waiters.add(cancel);
        const poll = () => {
            frame = null;
            try {
                assertActive();
                if (playback.getVisualPlaybackSettlementError()) throw new Error('Battle presentation failed');
                const visual = renderer.getBoardVisualController().getSnapshot();
                if (visual.mode === 'recovering' || visual.mode === 'destroyed') throw new Error('Battle renderer is unavailable');
                if (visual.ready && visual.mode === 'idle' && !visual.pendingFrameToken
                    && !playback.getProcessing() && !playback.getCardAnimating() && !playback.getPlaybackActive()
                    && !playback.hasClaimedVisualPlayback() && !playback.hasSelectionSettlementLock()
                    && !playback.hasPendingVisualPlayback(root.cardState)) { stop(); resolve(); return; }
                if (Date.now() - started > 120000) throw new Error('Battle boundary timed out');
                timer = setTimeout(poll, 16);
            } catch (error) { stop(); reject(error); }
        };
        // Let queued UI invalidations enter their owner before inspecting its settlement.
        frame = root.requestAnimationFrame(poll);
    });
    const position = () => ({ gameState: root.gameState, cardState: root.cardState, prngState: cards.getGamePrng().getState() });
    const fail = (error: unknown) => {
        if (status === 'disposed') return;
        status = 'error';
        complete({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    };
    const finish = () => {
        if (resultRequested || status === 'disposed') return;
        resultRequested = true;
        void waitForBoundary().then(() => {
            assertActive();
            const match = new BattleMatch(position());
            const result = match.result();
            status = 'finished';
            complete({ kind: 'finished', battleId: config.battleId, resultId: `${config.battleId}:result`, result });
        }).catch(fail);
    };
    root.CardReversiBattle = Object.freeze({
        apiVersion: 1,
        get status() { return status; },
        finished,
        async start(input: BattleConfig | BattleSave) {
            if (status !== 'unmounted') throw new Error('This battle document has already been used');
            if (root.NetworkMatchClient?.isActive?.()) throw new Error('Embedded battles cannot replace an active network match');
            // Clone across the iframe realm before applying plain-JSON validation.
            const value = JSON.parse(JSON.stringify(input));
            const saved = value.formatVersion !== undefined ? validateBattleSave(value) : null;
            if (saved) cpu.validateBattleCpuMemory(saved.cpuMemory);
            const prepared = saved || prepareBattle(value);
            if (prepared.config.players.black.controller !== 'human') throw new Error('Browser adapter requires a human black seat');
            config = prepared.config;
            status = 'mounting';
            try {
                await waitForBoundary();
                root.DEBUG_HUMAN_VS_HUMAN = config.players.white.controller === 'human';
                root.getCurrentMatchMode = () => 'cpu';
                for (const player of ['black', 'white']) {
                    const select = root.document.getElementById(player === 'black' ? 'smartBlack' : 'smartWhite');
                    if (select) select.value = config.players[player].profile;
                }
                turn.setUIImpl({ installBattleCardState: cards.installPreparedCardState,
                    readCpuSmartness: () => ({ black: config.players.black.profile, white: config.players.white.profile }) });
                cpu.setCpuUIImpl({ readCpuSmartness: () => ({ black: config.players.black.profile, white: config.players.white.profile }) });
                resultUI.setBattleResultConsumer(finish);
                const initialized = await turn.resetGame({ skipNetworkPublish: true, preparedBattle: prepared.position,
                    restoreBattle: !!saved, resumeTurnStart: saved?.phase === 'needs-turn-start' });
                if (initialized === false) throw new Error('Battle initialization failed');
                assertActive();
                if (saved) cpu.restoreBattleCpuMemory(saved.cpuMemory);
                if (saved?.phase === 'terminal') finish();
                else if (saved && saved.phase === 'action' && root.gameState.currentPlayer === -1 && config.players.white.controller === 'cpu') cpu.processCpuTurn();
                if (status === 'mounting') status = 'active';
                await waitForBoundary();
                // Battle settings and rewards belong to the host while embedded.
                root.document.documentElement.dataset.battleEmbedded = 'true';
                return { battleId: config.battleId };
            } catch (error) { fail(error); throw error; }
        },
        async save(): Promise<BattleSave> {
            if (!['active', 'finished'].includes(status)) throw new Error('Battle is not ready to save');
            await waitForBoundary();
            assertActive();
            const state = position();
            const phase = new BattleMatch(state).terminal ? 'terminal'
                : state.cardState.lastTurnStartedFor === (state.gameState.currentPlayer === 1 ? 'black' : 'white') ? 'action' : 'needs-turn-start';
            return createBattleSave(config, state, phase, cpu.exportBattleCpuMemory());
        },
        dispose() {
            if (status === 'disposed') return;
            status = 'disposed';
            turn.cancelPendingResetGame();
            cpu.resetCpuTurnHandlerState();
            for (const cancel of [...waiters]) cancel();
            resultUI.setBattleResultConsumer(() => {});
            disposeWorkers();
            playback.abortPlayback();
            renderer.destroyBoardVisualPageRuntime();
            complete({ kind: 'cancelled' });
        }
    });
}
