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
const jsdom_1 = require("jsdom");
const TutorialActionWaitModule = __importStar(require("../ui/tutorial/tutorial-action-wait.js"));
describe('tutorial action wait locks', () => {
    test('allowed button keeps its parent panel clickable', async () => {
        const dom = new jsdom_1.JSDOM(`
      <div id="tutorialOverlay"></div>
      <button id="gachaOpenBtn">ガチャ</button>
      <div id="card-detail-panel">
        <div id="card-detail-actions">
          <button id="use-card-btn">使用</button>
          <button id="destroy-card-btn">破壊</button>
        </div>
      </div>
      <div id="board">
        <div class="cell" data-row="0" data-col="0"></div>
      </div>
    `);
        const document = dom.window.document;
        const overlay = document.getElementById('tutorialOverlay');
        const panel = document.getElementById('card-detail-panel');
        const gachaButton = document.getElementById('gachaOpenBtn');
        const useButton = document.getElementById('use-card-btn');
        const destroyButton = document.getElementById('destroy-card-btn');
        const actionWait = TutorialActionWaitModule.createTutorialActionWait({
            root: document,
            overlay,
            resolveDescriptorTargets: (descriptor) => {
                if (descriptor === 'useButton')
                    return [useButton];
                return [];
            }
        });
        const pending = actionWait.waitFor({
            highlight: ['useButton'],
            successCondition: { usedCardId: 'observer_01' }
        }, {
            root: {
                cardState: { lastUsedCardByPlayer: { black: null } },
                gameState: { turnNumber: 0 }
            }
        });
        expect(panel.classList.contains('tutorial-disabled-target')).toBe(false);
        expect(gachaButton.classList.contains('tutorial-disabled-target')).toBe(true);
        expect(useButton.classList.contains('tutorial-highlight-target')).toBe(true);
        expect(useButton.classList.contains('tutorial-disabled-target')).toBe(false);
        expect(destroyButton.classList.contains('tutorial-disabled-target')).toBe(true);
        actionWait.cleanup();
        await Promise.race([pending, Promise.resolve()]);
    });
    test('targeted lock mode disables only explicit lock targets', async () => {
        const dom = new jsdom_1.JSDOM(`
      <div id="tutorialOverlay"></div>
      <div id="handWrapper">
        <div class="card-item" data-card-id="observer_01"></div>
      </div>
      <div id="board">
        <div class="cell" data-row="0" data-col="0"></div>
      </div>
      <button id="pass-btn">パス</button>
    `);
        const document = dom.window.document;
        const overlay = document.getElementById('tutorialOverlay');
        const card = document.querySelector('.card-item');
        const boardCell = document.querySelector('.cell');
        const passButton = document.getElementById('pass-btn');
        const actionWait = TutorialActionWaitModule.createTutorialActionWait({
            root: document,
            overlay,
            resolveDescriptorTargets: (descriptor) => {
                if (descriptor === 'tutorialTargetCard')
                    return [card];
                if (descriptor === 'passButton')
                    return [passButton];
                return [];
            }
        });
        const pending = actionWait.waitFor({
            highlight: ['tutorialTargetCard'],
            lock: ['passButton'],
            lockMode: 'targeted',
            successCondition: { selectedCardId: 'observer_01' }
        }, {
            root: {
                cardState: { selectedCardId: null },
                gameState: { turnNumber: 0 }
            }
        });
        expect(card.classList.contains('tutorial-highlight-target')).toBe(true);
        expect(card.classList.contains('tutorial-disabled-target')).toBe(false);
        expect(passButton.classList.contains('tutorial-disabled-target')).toBe(true);
        expect(boardCell.classList.contains('tutorial-disabled-target')).toBe(false);
        actionWait.cleanup();
        await Promise.race([pending, Promise.resolve()]);
    });
});
//# sourceMappingURL=ui.tutorial-action-wait.test.js.map