"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
describe('result overlay seat perspective', () => {
    let dom;
    beforeEach(() => {
        jest.resetModules();
        dom = new jsdom_1.JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.localStorage = dom.window.localStorage;
        global.gameState = { currentPlayer: 1, board: [], turnNumber: 0 };
        global.cardState = {
            chargeGainedTotal: { black: 0, white: 0 },
            cardUseCountByPlayer: { black: 0, white: 0 },
            totalFlipCountByPlayer: { black: 0, white: 0 },
            cornerCaptureCountByPlayer: { black: 0, white: 0 },
            turnCountByPlayer: { black: 0, white: 0 },
            turnIndex: 0
        };
        global.cpuSmartness = { black: 1, white: 1 };
        global.countDiscs = jest.fn(() => ({ black: 0, white: 0 }));
        global.resetGame = jest.fn();
        window.MATCH_MODE = 'cpu';
    });
    afterEach(() => {
        try {
            if (dom && dom.window && typeof dom.window.close === 'function') {
                dom.window.close();
            }
        }
        catch (e) { /* Intentionally empty: test cleanup guard */ }
        delete global.window;
        delete global.document;
        delete global.localStorage;
        delete global.gameState;
        delete global.cardState;
        delete global.cpuSmartness;
        delete global.countDiscs;
        delete global.resetGame;
        delete global.isGameOver;
    });
    test('network白席で白優勢なら勝利表示になる', () => {
        window.NetworkMatchClient = { getSeatKey: () => 'white' };
        global.countDiscs.mockReturnValue({ black: 24, white: 40 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const overlay = document.getElementById('result-overlay');
        const title = document.querySelector('.result-title');
        expect(overlay).toBeTruthy();
        expect(overlay.className).toContain('win');
        expect(title && title.textContent).toBe('勝利！');
    });
    test('network白席で黒優勢なら敗北表示になる', () => {
        window.NetworkMatchClient = { getSeatKey: () => 'white' };
        global.countDiscs.mockReturnValue({ black: 41, white: 23 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const overlay = document.getElementById('result-overlay');
        const title = document.querySelector('.result-title');
        expect(overlay).toBeTruthy();
        expect(overlay.className).toContain('lose');
        expect(title && title.textContent).toBe('敗北...');
    });
    test('network座席の大文字と空白を正規化して白視点の勝敗を表示する', () => {
        window.NetworkMatchClient = { getSeatKey: () => ' WHITE ' };
        global.countDiscs.mockReturnValue({ black: 24, white: 40 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const overlay = document.getElementById('result-overlay');
        const title = document.querySelector('.result-title');
        expect(overlay).toBeTruthy();
        expect(overlay.className).toContain('win');
        expect(title && title.textContent).toBe('勝利！');
    });
    test('座席情報が無い場合は従来通り黒視点で判定する', () => {
        global.countDiscs.mockReturnValue({ black: 39, white: 25 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const overlay = document.getElementById('result-overlay');
        const title = document.querySelector('.result-title');
        expect(overlay).toBeTruthy();
        expect(overlay.className).toContain('win');
        expect(title && title.textContent).toBe('勝利！');
    });
    test('勝敗タイトルと最終スコアの間に黒白の石枚数を表示する', () => {
        global.countDiscs.mockReturnValue({ black: 48, white: 16 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const title = document.querySelector('.result-title');
        const countsLine = document.querySelector('.result-counts');
        const totalScore = document.querySelector('.result-total-score');
        expect(countsLine && countsLine.textContent).toContain('黒 48枚');
        expect(countsLine && countsLine.textContent).toContain('白 16枚');
        expect(title && title.nextElementSibling).toBe(countsLine);
        expect(countsLine && countsLine.nextElementSibling).toBe(totalScore);
    });
    test('CPU勝利時は観測石報酬を表示して保存する', () => {
        global.countDiscs.mockReturnValue({ black: 48, white: 16 });
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
        try {
            import * as mod from '../ui/result-overlay.js';
            import * as storageModule from '../ui/storage/gacha-progress.js';
            mod.showResultOverlay();
            const rewardLine = document.querySelector('.result-observation-stones');
            expect(rewardLine && rewardLine.textContent).toContain('観測石');
            expect(rewardLine && rewardLine.textContent).toContain('基本100');
            expect(rewardLine && rewardLine.textContent).toContain('追加100');
            expect(rewardLine && rewardLine.textContent).toContain('所持 200');
            expect(rewardLine && rewardLine.querySelector('.observation-stone-icon')).not.toBeNull();
            expect(storageModule.getObservationStones(window)).toBe(200);
        }
        finally {
            randomSpy.mockRestore();
        }
    });
    test('CPU勝利時は追加観測石の上限3000を表示できる', () => {
        global.countDiscs.mockReturnValue({ black: 48, white: 16 });
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(1 - Number.EPSILON);
        try {
            import * as mod from '../ui/result-overlay.js';
            import * as storageModule from '../ui/storage/gacha-progress.js';
            mod.showResultOverlay();
            const rewardLine = document.querySelector('.result-observation-stones');
            expect(rewardLine && rewardLine.textContent).toContain('追加3000');
            expect(rewardLine && rewardLine.textContent).toContain('所持 3100');
            expect(storageModule.getObservationStones(window)).toBe(3100);
        }
        finally {
            randomSpy.mockRestore();
        }
    });
    test('CPU敗北時も最低保証の観測石100を獲得し追加は0になる', () => {
        global.countDiscs.mockReturnValue({ black: 16, white: 48 });
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
        try {
            import * as mod from '../ui/result-overlay.js';
            import * as storageModule from '../ui/storage/gacha-progress.js';
            mod.showResultOverlay();
            const rewardLine = document.querySelector('.result-observation-stones');
            expect(rewardLine && rewardLine.textContent).toContain('観測石 +100');
            expect(rewardLine && rewardLine.textContent).toContain('基本100');
            expect(rewardLine && rewardLine.textContent).toContain('追加0');
            expect(rewardLine && rewardLine.querySelector('.observation-stone-icon')).not.toBeNull();
            expect(storageModule.getObservationStones(window)).toBe(100);
        }
        finally {
            randomSpy.mockRestore();
        }
    });
    test('CPU引き分け時も最低保証の観測石100を獲得し追加は0になる', () => {
        global.countDiscs.mockReturnValue({ black: 32, white: 32 });
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.75);
        try {
            import * as mod from '../ui/result-overlay.js';
            import * as storageModule from '../ui/storage/gacha-progress.js';
            mod.showResultOverlay();
            const rewardLine = document.querySelector('.result-observation-stones');
            expect(rewardLine && rewardLine.textContent).toContain('観測石 +100');
            expect(rewardLine && rewardLine.textContent).toContain('基本100');
            expect(rewardLine && rewardLine.textContent).toContain('追加0');
            expect(storageModule.getObservationStones(window)).toBe(100);
        }
        finally {
            randomSpy.mockRestore();
        }
    });
    test('network対戦勝利時も観測石報酬を表示して保存する', () => {
        window.MATCH_MODE = 'network';
        window.NetworkMatchClient = { getSeatKey: () => 'white' };
        global.countDiscs.mockReturnValue({ black: 24, white: 40 });
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
        try {
            import * as mod from '../ui/result-overlay.js';
            import * as storageModule from '../ui/storage/gacha-progress.js';
            mod.showResultOverlay();
            const rewardLine = document.querySelector('.result-observation-stones');
            expect(rewardLine && rewardLine.textContent).toContain('観測石 +200');
            expect(rewardLine && rewardLine.textContent).toContain('基本100');
            expect(rewardLine && rewardLine.textContent).toContain('追加100');
            expect(storageModule.getObservationStones(window)).toBe(200);
        }
        finally {
            randomSpy.mockRestore();
        }
    });
    test('結果表示 state helper は version/unversioned の表示済みフラグを初期化する', () => {
        import * as mod from '../ui/result-overlay.js';
        const state = mod.createEmptyResultPresentationState();
        state.lastResultVersionShown = 12;
        state.resultShownForUnversioned = true;
        expect(mod.resetResultPresentationState(state)).toBe(state);
        expect(state).toEqual({
            lastResultVersionShown: null,
            resultShownForUnversioned: false
        });
    });
    test('総反転枚数と角取得数を詳細統計で保持する', () => {
        global.countDiscs.mockReturnValue({ black: 32, white: 32 });
        global.cardState.totalFlipCountByPlayer = { black: 12, white: 9 };
        global.cardState.cornerCaptureCountByPlayer = { black: 3, white: 1 };
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const labels = Array.from(document.querySelectorAll('.result-stat-label')).map((el) => el.textContent);
        const statsNode = document.querySelector('.result-stats');
        const statsText = statsNode ? statsNode.textContent : '';
        expect(labels).toEqual(expect.arrayContaining(['総反転枚数', '角取得数']));
        expect(statsText).toContain('黒 12');
        expect(statsText).toContain('白 9');
        expect(statsText).toContain('黒 3');
        expect(statsText).toContain('白 1');
    });
    test('盤面が全マス自色なら完全勝利表示になる', () => {
        global.countDiscs.mockReturnValue({ black: 64, white: 0 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const overlay = document.getElementById('result-overlay');
        const title = document.querySelector('.result-title');
        expect(overlay).toBeTruthy();
        expect(overlay.className).toContain('win');
        expect(overlay.className).toContain('perfect-win');
        expect(title && title.textContent).toBe('完全勝利！');
    });
    test('盤面が全マス相手色なら完全敗北表示になる', () => {
        window.NetworkMatchClient = { getSeatKey: () => 'white' };
        global.countDiscs.mockReturnValue({ black: 64, white: 0 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const overlay = document.getElementById('result-overlay');
        const title = document.querySelector('.result-title');
        expect(overlay).toBeTruthy();
        expect(overlay.className).toContain('lose');
        expect(overlay.className).toContain('perfect-lose');
        expect(title && title.textContent).toBe('完全敗北...');
    });
    test('空きマスがあっても盤面石が自色のみなら完全勝利表示になる', () => {
        global.countDiscs.mockReturnValue({ black: 35, white: 0 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const overlay = document.getElementById('result-overlay');
        const title = document.querySelector('.result-title');
        expect(overlay).toBeTruthy();
        expect(overlay.className).toContain('win');
        expect(overlay.className).toContain('perfect-win');
        expect(title && title.textContent).toBe('完全勝利！');
    });
    test('空きマスがあっても盤面石が相手色のみなら完全敗北表示になる', () => {
        window.NetworkMatchClient = { getSeatKey: () => 'white' };
        global.countDiscs.mockReturnValue({ black: 35, white: 0 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const overlay = document.getElementById('result-overlay');
        const title = document.querySelector('.result-title');
        expect(overlay).toBeTruthy();
        expect(overlay.className).toContain('lose');
        expect(overlay.className).toContain('perfect-lose');
        expect(title && title.textContent).toBe('完全敗北...');
    });
    test('理論値条件で最終スコア11000を表示する', () => {
        global.countDiscs.mockReturnValue({ black: 76, white: 0 });
        global.cardState.chargeGainedTotal = { black: 800, white: 0 };
        global.cardState.totalFlipCountByPlayer = { black: 150, white: 0 };
        global.cardState.cornerCaptureCountByPlayer = { black: 4, white: 0 };
        global.cardState.turnCountByPlayer = { black: 0, white: 0 };
        global.cardState.turnIndex = 0;
        global.gameState.turnNumber = -1;
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const totalScore = document.querySelector('.result-total-score-value');
        const breakdownText = (document.querySelector('.result-score-breakdown') || {}).textContent || '';
        const supportDetailText = (document.querySelector('.result-support-breakdown') || {}).textContent || '';
        expect(totalScore && totalScore.textContent).toBe('11000');
        expect(breakdownText).toContain('勝敗ボーナス5000');
        expect(breakdownText).toContain('速攻ボーナス1500');
        expect(breakdownText).toContain('黒一色ボーナス1500');
        expect(breakdownText).toContain('補助ボーナス3000');
        expect(supportDetailText).toContain('反転1500');
        expect(supportDetailText).toContain('自石1500');
        expect(supportDetailText).not.toContain('布石');
        expect(supportDetailText).not.toContain('/ 角');
    });
    test('39手終局では速攻ボーナスが減点される', () => {
        global.countDiscs.mockReturnValue({ black: 35, white: 0 });
        global.cardState.totalFlipCountByPlayer = { black: 44, white: 0 };
        global.cardState.cornerCaptureCountByPlayer = { black: 2, white: 0 };
        global.cardState.turnCountByPlayer = { black: 20, white: 19 };
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const breakdownText = (document.querySelector('.result-score-breakdown') || {}).textContent || '';
        expect(breakdownText).toContain('速攻ボーナス915');
    });
    test('補助ボーナスが上限へ張り付きにくい配点で計算される', () => {
        global.countDiscs.mockReturnValue({ black: 49, white: 16 });
        global.cardState.chargeGainedTotal = { black: 175, white: 238 };
        global.cardState.totalFlipCountByPlayer = { black: 99, white: 86 };
        global.cardState.cornerCaptureCountByPlayer = { black: 1, white: 0 };
        global.cardState.turnCountByPlayer = { black: 40, white: 39 };
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const breakdownText = (document.querySelector('.result-score-breakdown') || {}).textContent || '';
        const supportDetailText = (document.querySelector('.result-support-breakdown') || {}).textContent || '';
        expect(breakdownText).toContain('補助ボーナス1957');
        expect(supportDetailText).toContain('反転990');
        expect(supportDetailText).toContain('自石967');
    });
    test('詳細統計は初期非表示でボタン押下で展開される', () => {
        global.countDiscs.mockReturnValue({ black: 40, white: 24 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const toggleBtn = document.querySelector('.result-detail-toggle');
        const stats = document.querySelector('.result-stats');
        expect(toggleBtn).toBeTruthy();
        expect(stats).toBeTruthy();
        expect(stats.hidden).toBe(true);
        toggleBtn.click();
        expect(stats.hidden).toBe(false);
        expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    });
    test('CPU対戦時のみレベル別に最高点を更新する', () => {
        window.MATCH_MODE = 'cpu';
        global.cpuSmartness.white = 4;
        global.countDiscs.mockReturnValue({ black: 76, white: 0 });
        global.cardState.chargeGainedTotal = { black: 800, white: 0 };
        global.cardState.totalFlipCountByPlayer = { black: 150, white: 0 };
        global.cardState.cornerCaptureCountByPlayer = { black: 4, white: 0 };
        global.cardState.turnCountByPlayer = { black: 0, white: 0 };
        global.cardState.turnIndex = 0;
        global.gameState.turnNumber = -1;
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const key = 'othello_cpu_leaderboard_v5';
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        expect(saved.cpu).toBeTruthy();
        expect(saved.cpu['4']).toBeTruthy();
        expect(saved.cpu['4'].bestScore).toBe(11000);
    });
    test('ネット対戦時はスコア表示してもランキングへ保存しない', () => {
        window.MATCH_MODE = 'network';
        window.NetworkMatchClient = { getSeatKey: () => 'black' };
        global.countDiscs.mockReturnValue({ black: 52, white: 12 });
        global.cardState.turnCountByPlayer = { black: 40, white: 40 };
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const metaText = (document.querySelector('.result-score-meta') || {}).textContent || '';
        const key = 'othello_cpu_leaderboard_v5';
        expect(metaText).toContain('共有ランキング');
        expect(localStorage.getItem(key)).toBeNull();
    });
    test('終局時に共有ランキング送信を呼ぶ', () => {
        const submitScore = jest.fn(() => Promise.resolve({ ok: true, updated: true, rank: 1 }));
        window.LeaderboardClient = {
            submitScore,
            resolveServerBaseUrl: () => 'http://127.0.0.1:8788'
        };
        global.countDiscs.mockReturnValue({ black: 44, white: 20 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        expect(submitScore).toHaveBeenCalled();
    });
    test('通常ローカル対戦では共有ランキングを自動送信しない', () => {
        const submitScore = jest.fn(() => Promise.resolve({ ok: true, updated: true, rank: 1 }));
        window.LeaderboardClient = {
            submitScore,
            resolveServerBaseUrl: () => 'http://localhost'
        };
        global.countDiscs.mockReturnValue({ black: 44, white: 20 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        expect(submitScore).not.toHaveBeenCalled();
    });
    test('ネット対戦の再戦ボタンは requestRematch を優先する', async () => {
        window.MATCH_MODE = 'network';
        const requestRematch = jest.fn(() => Promise.resolve({ ok: true }));
        window.NetworkMatchClient = {
            getSeatKey: () => 'black',
            isActive: () => true,
            requestRematch
        };
        global.countDiscs.mockReturnValue({ black: 36, white: 28 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const restartBtn = document.querySelector('.result-btn-row .premium-btn.primary');
        expect(restartBtn).toBeTruthy();
        restartBtn.click();
        await Promise.resolve();
        expect(requestRematch).toHaveBeenCalledTimes(1);
        expect(global.resetGame).not.toHaveBeenCalled();
    });
    test('ネット対戦でも未接続時は従来どおり resetGame を呼ぶ', () => {
        window.MATCH_MODE = 'network';
        const requestRematch = jest.fn(() => Promise.resolve({ ok: true }));
        window.NetworkMatchClient = {
            getSeatKey: () => 'black',
            isActive: () => false,
            requestRematch
        };
        global.countDiscs.mockReturnValue({ black: 30, white: 34 });
        import * as mod from '../ui/result-overlay.js';
        mod.showResultOverlay();
        const restartBtn = document.querySelector('.result-btn-row .premium-btn.primary');
        expect(restartBtn).toBeTruthy();
        restartBtn.click();
        expect(requestRematch).not.toHaveBeenCalled();
        expect(global.resetGame).toHaveBeenCalledTimes(1);
    });
    test('syncResultPresentationFromSnapshot は stateVersion ごとに 1 回だけ結果表示する', () => {
        import * as mod from '../ui/result-overlay.js';
        const showResult = jest.fn();
        global.isGameOver = jest.fn(() => true);
        const syncState = {
            lastResultVersionShown: null,
            resultShownForUnversioned: false
        };
        const first = mod.syncResultPresentationFromSnapshot({
            resultState: syncState,
            stateVersion: 14,
            gameStateRef: global.gameState,
            isGameOver: global.isGameOver,
            showResult
        });
        const second = mod.syncResultPresentationFromSnapshot({
            resultState: syncState,
            stateVersion: 14,
            gameStateRef: global.gameState,
            isGameOver: global.isGameOver,
            showResult
        });
        expect(first).toBe(true);
        expect(second).toBe(false);
        expect(showResult).toHaveBeenCalledTimes(1);
    });
    test('syncResultPresentationFromSnapshot は非終局 snapshot で既存 overlay を閉じる', () => {
        import * as mod from '../ui/result-overlay.js';
        global.isGameOver = jest.fn(() => false);
        const overlay = document.createElement('div');
        overlay.id = 'result-overlay';
        document.body.appendChild(overlay);
        const shown = mod.syncResultPresentationFromSnapshot({
            resultState: {
                lastResultVersionShown: 20,
                resultShownForUnversioned: true
            },
            stateVersion: 21,
            gameStateRef: global.gameState,
            isGameOver: global.isGameOver,
            showResult: jest.fn()
        });
        expect(shown).toBe(false);
        expect(document.getElementById('result-overlay')).toBeNull();
    });
});
// ---------------------------------------------------------------------------
// __resultToken race: delayed overlay suppressed when snapshot replaces gameState
// ---------------------------------------------------------------------------
describe('showResult __resultToken race condition', () => {
    let dom;
    beforeEach(() => {
        jest.resetModules();
        dom = new jsdom_1.JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.localStorage = dom.window.localStorage;
        global.gameState = { currentPlayer: -1, __resultShown: false };
        global.cardState = {
            chargeGainedTotal: { black: 0, white: 0 },
            cardUseCountByPlayer: { black: 0, white: 0 },
            totalFlipCountByPlayer: { black: 0, white: 0 },
            cornerCaptureCountByPlayer: { black: 0, white: 0 },
            turnCountByPlayer: { black: 20, white: 19 },
            turnIndex: 39
        };
        global.cpuSmartness = { black: 1, white: 1 };
        global.countDiscs = jest.fn(() => ({ black: 35, white: 29 }));
        global.resetGame = jest.fn();
        global.addLog = jest.fn();
        window.MATCH_MODE = 'cpu';
    });
    afterEach(() => {
        jest.useRealTimers();
        try {
            if (dom && dom.window && typeof dom.window.close === 'function')
                dom.window.close();
        }
        catch (e) { /* Intentionally empty: test cleanup guard */ }
        delete global.window;
        delete global.document;
        delete global.localStorage;
        delete global.gameState;
        delete global.cardState;
        delete global.cpuSmartness;
        delete global.countDiscs;
        delete global.resetGame;
        delete global.addLog;
    });
    // After the fix, gameState.__resultToken being cleared by a snapshot no longer
    // suppresses the overlay, because the guard now uses a module-level token.
    // This test verifies that __resultToken is still written to gameState (for external
    // readers), and that the overlay IS shown even when it is subsequently deleted.
    test('__resultToken が消えても遅延オーバーレイ表示はガードで止まらない（修正後の動作）', () => {
        jest.useFakeTimers();
        import * as mod from '../ui/result-overlay.js';
        mod.showResult();
        expect(typeof global.gameState.__resultToken).toBe('number');
        // Simulate what replaceObjectState does in snapshot.js: clears all keys not in next snapshot
        const tokenBeforeReplacement = global.gameState.__resultToken;
        delete global.gameState.__resultToken; // token cleared by follow-up snapshot
        jest.advanceTimersByTime(2500);
        // Fixed behavior: module-level token guard allows overlay to appear
        expect(document.getElementById('result-overlay')).not.toBeNull();
        expect(tokenBeforeReplacement).toBeGreaterThan(0); // confirms token was set
    });
    // Regression coverage for the original race bug:
    // when a follow-up snapshot clears __resultToken during the 2-second delay,
    // the result overlay must still appear while the game remains terminal.
    test('__resultToken が消えても終局なら結果オーバーレイを表示すべき（レースバグ）', () => {
        jest.useFakeTimers();
        import * as mod from '../ui/result-overlay.js';
        mod.showResult();
        // Simulate follow-up snapshot replacing gameState without __resultToken
        delete global.gameState.__resultToken;
        // Game is still terminal (currentPlayer remains -1)
        expect(global.gameState.currentPlayer).toBe(-1);
        jest.advanceTimersByTime(2500);
        // Fixed behavior: overlay still appears because delayed presentation no longer
        // depends on the transient gameState.__resultToken field surviving snapshot replacement.
        expect(document.getElementById('result-overlay')).not.toBeNull();
    });
});
//# sourceMappingURL=ui.result-overlay.network-seat.test.js.map