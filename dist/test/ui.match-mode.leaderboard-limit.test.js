"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
describe('match-mode shared leaderboard panel', () => {
    let dom;
    let fetchLeaderboard;
    function buildUiRefs() {
        return {
            modeCpuBtn: document.getElementById('modeCpuBtn'),
            modeNetworkBtn: document.getElementById('modeNetworkBtn'),
            controlPanel: document.getElementById('control-panel'),
            networkPanel: document.getElementById('networkPanel'),
            networkOverlay: document.getElementById('networkOverlay'),
            networkCloseBtn: document.getElementById('networkCloseBtn'),
            networkStatus: document.getElementById('networkStatusText'),
            networkTimerStatus: document.getElementById('networkTimerStatus'),
            leaderboardOpenBtn: document.getElementById('leaderboardOpenBtn'),
            leaderboardOverlay: document.getElementById('leaderboardOverlay'),
            leaderboardPanel: document.getElementById('leaderboardModal'),
            leaderboardCloseBtn: document.getElementById('leaderboardCloseBtn'),
            leaderboardNameInput: document.getElementById('leaderboardNameInput'),
            leaderboardReloadBtn: document.getElementById('leaderboardReloadBtn'),
            leaderboardStatus: document.getElementById('leaderboardStatusText'),
            leaderboardList: document.getElementById('leaderboardList'),
            autoToggleBtn: document.getElementById('autoToggleBtn')
        };
    }
    beforeEach(() => {
        jest.resetModules();
        dom = new jsdom_1.JSDOM('<!doctype html><html><body>' +
            '<button id="modeCpuBtn">CPU</button>' +
            '<button id="modeNetworkBtn">ネット対戦</button>' +
            '<button id="leaderboardOpenBtn">ランキング</button>' +
            '<button id="autoToggleBtn">AUTO: OFF</button>' +
            '<div id="control-panel"></div>' +
            '<div id="networkPanel"></div>' +
            '<div id="networkOverlay"></div>' +
            '<button id="networkCloseBtn">閉じる</button>' +
            '<div id="networkStatusText"></div>' +
            '<div id="networkTimerStatus"></div>' +
            '<div id="leaderboardOverlay">' +
            '  <div id="leaderboardModal">' +
            '    <button id="leaderboardCloseBtn">閉じる</button>' +
            '    <input id="leaderboardNameInput" />' +
            '    <button id="leaderboardReloadBtn">更新</button>' +
            '    <div id="leaderboardStatusText"></div>' +
            '    <div id="leaderboardList"></div>' +
            '  </div>' +
            '</div>' +
            '</body></html>', { url: 'http://localhost/' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.location = dom.window.location;
        global.addLog = jest.fn();
        global.updateCpuCharacter = jest.fn();
        window.NetworkMatchClient = {
            leaveRoom: jest.fn(async () => ({ ok: true })),
            setStatusWriter: jest.fn(),
            setRoomStateListener: jest.fn(),
            setTurnTimerListener: jest.fn(),
            setChatListener: jest.fn(),
            hasTwoPlayers: jest.fn(() => false),
            getSeatNames: jest.fn(() => ({ black: '', white: '' })),
            getSeatKey: jest.fn(() => 'black')
        };
        fetchLeaderboard = jest.fn(async (options) => ({
            ok: true,
            updatedAt: Date.now(),
            entries: [{
                    rank: 1,
                    playerId: 'player_alpha_0001',
                    playerName: 'アルファ',
                    bestScore: 7200,
                    mode: 'cpu',
                    cpuLevel: 3
                }],
            requestedLimit: options && options.limit
        }));
        window.LeaderboardClient = {
            getPlayerName: jest.fn(() => 'ななし'),
            setPlayerName: jest.fn((value) => value),
            getPlayerId: jest.fn(() => 'player_alpha_0001'),
            fetchLeaderboard
        };
        require('../ui/handlers/match-mode.js');
        window.setupMatchModeControls(buildUiRefs());
    });
    afterEach(() => {
        try {
            if (dom && dom.window && typeof dom.window.close === 'function') {
                dom.window.close();
            }
        }
        catch (e) {
            // ignore
        }
        delete global.window;
        delete global.document;
        delete global.location;
        delete global.addLog;
        delete global.updateCpuCharacter;
    });
    test('ランキングパネルを開くと上位100件を取得する', async () => {
        document.getElementById('leaderboardOpenBtn').click();
        await Promise.resolve();
        await Promise.resolve();
        expect(fetchLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
        expect(document.getElementById('leaderboardOverlay').classList.contains('is-open')).toBe(true);
        expect(document.getElementById('leaderboardList').textContent).toContain('アルファ');
    });
});
//# sourceMappingURL=ui.match-mode.leaderboard-limit.test.js.map