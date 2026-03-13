const { JSDOM } = require('jsdom');
const TutorialActionWaitModule = require('../ui/tutorial/tutorial-action-wait');

describe('tutorial action wait locks', () => {
  test('allowed button keeps its parent panel clickable', async () => {
    const dom = new JSDOM(`
      <div id="tutorialOverlay"></div>
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
    const useButton = document.getElementById('use-card-btn');
    const destroyButton = document.getElementById('destroy-card-btn');

    const actionWait = TutorialActionWaitModule.createTutorialActionWait({
      root: document,
      overlay,
      resolveDescriptorTargets: (descriptor) => {
        if (descriptor === 'useButton') return [useButton];
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
    expect(useButton.classList.contains('tutorial-highlight-target')).toBe(true);
    expect(useButton.classList.contains('tutorial-disabled-target')).toBe(false);
    expect(destroyButton.classList.contains('tutorial-disabled-target')).toBe(true);

    actionWait.cleanup();
    await Promise.race([pending, Promise.resolve()]);
  });

  test('targeted lock mode disables only explicit lock targets', async () => {
    const dom = new JSDOM(`
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
        if (descriptor === 'tutorialTargetCard') return [card];
        if (descriptor === 'passButton') return [passButton];
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
