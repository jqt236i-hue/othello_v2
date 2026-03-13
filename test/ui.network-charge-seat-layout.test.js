const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function createBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

function createRendererContext(seatKey) {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div id="deck-black"><div class="deck-count"></div></div>
      <div id="deck-white"><div class="deck-count"></div></div>
      <div id="hand-black"></div>
      <div id="hand-white"></div>
      <div id="charge-black"></div>
      <div id="charge-white"></div>
      <div id="charge-delta-black"></div>
      <div id="charge-delta-white"></div>
      <div id="discard-count"></div>
      <div id="active-black"><div class="effect-slot-content"></div></div>
      <div id="active-white"><div class="effect-slot-content"></div></div>
    </body></html>`,
    { runScripts: 'outside-only' }
  );

  const { window } = dom;
  window.BLACK = 1;
  window.WHITE = -1;
  window.gameState = {
    currentPlayer: 1,
    board: createBoard()
  };
  window.cardState = {
    turnIndex: 1,
    charge: { black: 0, white: 0 },
    chargeDeltaEvents: [],
    hands: { black: [], white: [] },
    decks: { black: [], white: [] },
    discard: [],
    pendingEffectByPlayer: { black: null, white: null },
    hasUsedCardThisTurnByPlayer: { black: false, white: false },
    activeEffectsByPlayer: { black: [], white: [] }
  };
  window.CARD_DEFS = [];
  window.onCardClick = jest.fn();
  window.updateCardDetailPanel = jest.fn();
  window.StoneVisuals = {
    showChargeDelta: jest.fn()
  };
  window.MATCH_MODE = 'network';
  window.NetworkMatchClient = {
    getSeatKey: () => seatKey
  };

  const rendererCode = fs.readFileSync(path.resolve(__dirname, '../cards/card-renderer.js'), 'utf8');
  window.eval(rendererCode);

  return dom;
}

describe('network charge seat layout', () => {
  test('shows local player charge in bottom slot for white seat', () => {
    const dom = createRendererContext('white');
    const { window } = dom;

    window.cardState.charge.black = 4;
    window.cardState.charge.white = 11;
    window.renderCardUI();

    expect(window.document.getElementById('charge-black').textContent).toBe('布石: 11 / 99');
    expect(window.document.getElementById('charge-white').textContent).toBe('布石: 4 / 99');

    dom.window.close();
  });

  test('tags deck slots with seat-mapped owner keys in network mode', () => {
    const dom = createRendererContext('white');
    const { window } = dom;

    window.renderCardUI();

    expect(window.document.getElementById('deck-black').dataset.ownerKey).toBe('white');
    expect(window.document.getElementById('deck-white').dataset.ownerKey).toBe('black');

    dom.window.close();
  });

  test('maps charge delta popup to bottom slot for local seat owner', () => {
    const dom = createRendererContext('white');
    const { window } = dom;

    window.cardState.charge.black = 3;
    window.cardState.charge.white = 5;
    window.cardState.turnIndex = 1;
    window.renderCardUI();

    window.cardState.charge.white = 7;
    window.cardState.turnIndex = 2;
    window.renderCardUI();

    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledTimes(1);
    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledWith('black', 2);

    dom.window.close();
  });

  test('aggregates multiple charge delta events in one render for local slot', () => {
    const dom = createRendererContext('white');
    const { window } = dom;

    window.cardState.chargeDeltaEvents = [
      { seq: 1, player: 'white', delta: 3 },
      { seq: 2, player: 'white', delta: 1 }
    ];
    window.renderCardUI();

    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledTimes(1);
    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledWith('black', 4);

    dom.window.close();
  });
});
