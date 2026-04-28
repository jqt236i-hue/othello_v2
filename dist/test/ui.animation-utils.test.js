"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const jsdom_1 = require("jsdom");
describe('animation-utils animateFadeOutAt', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
        delete global.boardEl;
    });
    test('resolves immediately when NOANIM is active', async () => {
        const mockTimer = { setTimeout: jest.fn(), clearTimeout: jest.fn(), clearAll: jest.fn(), pendingCount: () => 0, newScope: () => null, clearScope: () => { } };
        jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
            isNoAnim: () => true,
            getTimer: () => mockTimer
        }));
        import * as anim from '../ui/animation-utils.js';
        // create minimal cell with disc
        const disc = { classList: { contains: () => false, add() { }, remove() { } }, parentElement: { removeChild() { } }, addEventListener() { }, removeEventListener() { } };
        const cell = { querySelector: () => disc };
        global.boardEl = { querySelector: () => cell };
        await anim.animateFadeOutAt(1, 2);
        // timer.setTimeout should not have been used when NOANIM=true
        expect(mockTimer.setTimeout).not.toHaveBeenCalled();
    });
    test('adds destroy-fade class and resolves after timer when animations enabled', async () => {
        const mockRemoveTimeout = jest.fn();
        const timer = {
            setTimeout: (fn, ms) => setTimeout(fn, ms),
            clearTimeout: mockRemoveTimeout,
            clearAll: () => { },
            pendingCount: () => 0,
            newScope: () => null,
            clearScope: () => { }
        };
        jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
            isNoAnim: () => false,
            getTimer: () => timer
        }));
        import * as anim from '../ui/animation-utils.js';
        let addedClass = null;
        const disc = {
            classList: {
                contains: () => false,
                add: (cls) => { addedClass = cls; },
                remove() { }
            },
            parentElement: { removeChild() { } },
            addEventListener() { },
            removeEventListener() { }
        };
        const cell = { querySelector: () => disc };
        global.boardEl = { querySelector: () => cell };
        const p = anim.animateFadeOutAt(1, 2);
        // class should be added synchronously
        expect(addedClass).toBe('destroy-fade');
        // advance timers beyond default fade (500 + 200 default) to resolve
        jest.advanceTimersByTime(800);
        await p;
    });
});
describe('animation-utils animateHyperactiveMove chained fallback', () => {
    beforeEach(() => {
        jest.resetModules();
        const dom = new jsdom_1.JSDOM(`<!doctype html><html><body>
      <div id="board">
        <div class="cell" data-row="3" data-col="3"></div>
        <div class="cell" data-row="3" data-col="4"></div>
        <div class="cell" data-row="3" data-col="5"></div>
      </div>
      <div id="card-fx-layer"></div>
    </body></html>`);
        global.window = dom.window;
        global.document = dom.window.document;
        global.boardEl = document.getElementById('board');
        const raf = (cb) => {
            cb(Date.now());
            return 1;
        };
        global.requestAnimationFrame = raf;
        global.cancelAnimationFrame = () => { };
        global.window.requestAnimationFrame = raf;
        global.window.cancelAnimationFrame = () => { };
        const proto = global.window.Element && global.window.Element.prototype;
        if (proto && typeof proto.animate !== 'function') {
            proto.animate = function () {
                return {
                    addEventListener(type, cb) {
                        if (type === 'finish')
                            setTimeout(cb, 0);
                    }
                };
            };
        }
    });
    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.boardEl;
        delete global.requestAnimationFrame;
        delete global.cancelAnimationFrame;
    });
    test('animates chained ultimate-hyperactive path from final-state disc via carryDisc', async () => {
        jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
            isNoAnim: () => true,
            getTimer: () => ({
                setTimeout: (fn, ms) => setTimeout(fn, ms),
                clearTimeout: (id) => clearTimeout(id),
                clearAll: () => { },
                pendingCount: () => 0,
                newScope: () => null,
                clearScope: () => { }
            })
        }));
        import * as anim from '../ui/animation-utils.js';
        const cellB = boardEl.querySelector('.cell[data-row="3"][data-col="4"]');
        const cellC = boardEl.querySelector('.cell[data-row="3"][data-col="5"]');
        const disc = document.createElement('div');
        disc.className = 'disc black';
        cellC.appendChild(disc);
        await anim.animateHyperactiveMove({ row: 3, col: 3 }, { row: 3, col: 4 }, { carryDisc: disc });
        expect(cellB.querySelector('.disc')).toBe(disc);
        expect(cellC.querySelector('.disc')).toBeNull();
        await anim.animateHyperactiveMove({ row: 3, col: 4 }, { row: 3, col: 5 }, { carryDisc: disc });
        expect(cellC.querySelector('.disc')).toBe(disc);
    });
    test('animateHyperactiveMove uses fixed duration regardless of travel distance', async () => {
        jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
            isNoAnim: () => false,
            getTimer: () => ({
                setTimeout: (fn, ms) => setTimeout(fn, ms),
                clearTimeout: (id) => clearTimeout(id),
                clearAll: () => { },
                pendingCount: () => 0,
                newScope: () => null,
                clearScope: () => { }
            })
        }));
        import * as anim from '../ui/animation-utils.js';
        const board = document.getElementById('board');
        const fxLayer = document.getElementById('card-fx-layer');
        fxLayer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000 });
        const ensureCell = (row, col) => {
            let cell = board.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
            if (!cell) {
                cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = String(row);
                cell.dataset.col = String(col);
                board.appendChild(cell);
            }
            const left = col * 100;
            const top = row * 100;
            cell.getBoundingClientRect = () => ({
                left,
                top,
                width: 100,
                height: 100,
                right: left + 100,
                bottom: top + 100
            });
            return cell;
        };
        try {
            const shortFrom = ensureCell(3, 3);
            const shortTo = ensureCell(3, 4);
            const shortDisc = document.createElement('div');
            shortDisc.className = 'disc black';
            shortFrom.appendChild(shortDisc);
            const shortMove = anim.animateHyperactiveMove({ row: 3, col: 3 }, { row: 3, col: 4 });
            const shortGhost = fxLayer.querySelector('.hyperactive-move-ghost');
            expect(shortGhost).not.toBeNull();
            const shortTransition = shortGhost.style.transition;
            const shortEvent = new window.Event('transitionend');
            Object.defineProperty(shortEvent, 'propertyName', { value: 'left' });
            shortGhost.dispatchEvent(shortEvent);
            await shortMove;
            const longFrom = ensureCell(4, 0);
            const longTo = ensureCell(4, 6);
            const longDisc = document.createElement('div');
            longDisc.className = 'disc black';
            longFrom.appendChild(longDisc);
            const longMove = anim.animateHyperactiveMove({ row: 4, col: 0 }, { row: 4, col: 6 });
            const longGhost = fxLayer.querySelector('.hyperactive-move-ghost');
            expect(longGhost).not.toBeNull();
            const longTransition = longGhost.style.transition;
            const longEvent = new window.Event('transitionend');
            Object.defineProperty(longEvent, 'propertyName', { value: 'left' });
            longGhost.dispatchEvent(longEvent);
            await longMove;
            expect(shortTransition).toContain('400ms');
            expect(shortTransition).toBe(longTransition);
            expect(shortTo.querySelector('.disc')).not.toBeNull();
            expect(longTo.querySelector('.disc')).not.toBeNull();
        }
        finally { }
    });
    test('animateHyperactiveMove matches the live disc size instead of legacy cell scaling', async () => {
        jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
            isNoAnim: () => false,
            getTimer: () => ({
                setTimeout: (fn, ms) => setTimeout(fn, ms),
                clearTimeout: (id) => clearTimeout(id),
                clearAll: () => { },
                pendingCount: () => 0,
                newScope: () => null,
                clearScope: () => { }
            })
        }));
        import * as anim from '../ui/animation-utils.js';
        const board = document.getElementById('board');
        const fxLayer = document.getElementById('card-fx-layer');
        fxLayer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000 });
        board.style.setProperty('--board-disc-size-px', '65px');
        board.style.setProperty('--board-disc-inset-px', '4px');
        const fromCell = board.querySelector('.cell[data-row="3"][data-col="3"]');
        const toCell = board.querySelector('.cell[data-row="3"][data-col="4"]');
        fromCell.getBoundingClientRect = () => ({
            left: 300.4,
            top: 200.4,
            width: 73.2,
            height: 73.2,
            right: 373.6,
            bottom: 273.6
        });
        toCell.getBoundingClientRect = () => ({
            left: 380.4,
            top: 200.4,
            width: 73.2,
            height: 73.2,
            right: 453.6,
            bottom: 273.6
        });
        const disc = document.createElement('div');
        disc.className = 'disc black';
        disc.getBoundingClientRect = () => ({
            left: 304.4,
            top: 204.4,
            width: 65.1,
            height: 65.1,
            right: 369.5,
            bottom: 269.5
        });
        fromCell.appendChild(disc);
        try {
            const movePromise = anim.animateHyperactiveMove({ row: 3, col: 3 }, { row: 3, col: 4 });
            const ghost = fxLayer.querySelector('.hyperactive-move-ghost');
            expect(ghost).not.toBeNull();
            expect(ghost.style.left).toBe('384px');
            expect(ghost.style.top).toBe('204px');
            expect(ghost.style.width).toBe('65px');
            expect(ghost.style.height).toBe('65px');
            expect(ghost.style.width).not.toBe('60px');
            expect(ghost.style.height).not.toBe('60px');
            expect(ghost.style.transition).toContain('left 400ms');
            const moveEvent = new window.Event('transitionend');
            Object.defineProperty(moveEvent, 'propertyName', { value: 'left' });
            ghost.dispatchEvent(moveEvent);
            await movePromise;
            expect(toCell.querySelector('.disc')).toBe(disc);
        }
        finally { }
    });
});
//# sourceMappingURL=ui.animation-utils.test.js.map