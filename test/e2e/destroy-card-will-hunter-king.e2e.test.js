const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

function startServer(port = 0) {
  const root = path.resolve(__dirname, '..', '..');
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(root, decodeURIComponent(reqPath));
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === '.html'
        ? 'text/html'
        : ext === '.js'
          ? 'application/javascript'
          : ext === '.css'
            ? 'text/css'
            : 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      res.end(data);
    });
  });
  server.listen(port);
  return server;
}

describe('DESTROY_ONE_STONE destroy evade E2E', () => {
  let serverProc;
  let browser;
  let serverPort = null;
  let page = null;

  beforeAll(async () => {
    serverProc = startServer(0);
    await new Promise((resolve) => setTimeout(resolve, 500));
    serverPort = serverProc.address().port;
    browser = await chromium.launch();
  }, 30000);

  afterAll(async () => {
    if (page) {
      await page.close().catch(() => {});
      page = null;
    }
    if (browser) {
      await browser.close();
      browser = null;
    }
    if (serverProc && typeof serverProc.close === 'function') {
      await new Promise((resolve) => serverProc.close(resolve));
      serverProc = null;
    }
  }, 30000);

  test('破壊神で意志狩りの王を選んだ時は破壊回避して表示も移動先へ残る', async () => {
    page = await browser.newPage();

    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1`);
    await page.waitForFunction(
      () => !!(window.gameState && window.cardState && window.executeDestroy && window.SharedConstants),
      { timeout: 10000 }
    );
    await page.waitForFunction(() => {
      const bareAnimating = typeof isCardAnimating !== 'undefined' ? isCardAnimating : false;
      return window.VisualPlaybackActive !== true && bareAnimating !== true;
    }, { timeout: 10000 });

    await page.evaluate(() => {
      const Shared = window.SharedConstants;
      const BLACK = Shared.BLACK;
      const WHITE = Shared.WHITE;
      const EMPTY = Shared.EMPTY;
      const gs = window.gameState;
      const cs = window.cardState;

      window.DEBUG_HUMAN_VS_HUMAN = true;
      isProcessing = false;
      isCardAnimating = false;
      window.isProcessing = false;
      window.isCardAnimating = false;

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          gs.board[row][col] = BLACK;
        }
      }
      gs.board[4][4] = WHITE;
      gs.board[7][7] = EMPTY;
      gs.currentPlayer = BLACK;
      gs.turnNumber = 1;
      gs.consecutivePasses = 0;

      cs.markers = [{
        id: 8451,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'white',
        data: {
          type: 'WILL_HUNTER_KING',
          remainingOwnerTurns: 8,
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 1
        }
      }];
      cs.pendingEffectByPlayer = {
        black: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget', cardId: 'destroy_01' },
        white: null
      };
      cs.presentationEvents = [];
      cs._presentationEventsPersist = [];
      cs.turnIndex = 0;

      if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
      else if (typeof renderBoard === 'function') renderBoard();
    });

    await page.evaluate(async () => {
      await window.executeDestroy(4, 4, 'black');
    });

    await page.waitForFunction(() => {
      const gs = window.gameState;
      const cs = window.cardState;
      const marker = Array.isArray(cs && cs.markers)
        ? cs.markers.find((m) => m && m.id === 8451)
        : null;
      const cell44 = document.querySelector('.cell[data-row="4"][data-col="4"]');
      const cell77 = document.querySelector('.cell[data-row="7"][data-col="7"]');
      const bareAnimating = typeof isCardAnimating !== 'undefined' ? isCardAnimating : false;
      return (
        window.VisualPlaybackActive !== true &&
        bareAnimating !== true &&
        gs &&
        Array.isArray(gs.board) &&
        gs.board[4][4] === 0 &&
        gs.board[7][7] === -1 &&
        marker &&
        marker.row === 7 &&
        marker.col === 7 &&
        marker.data &&
        marker.data.destroyEvadeRemaining === 0 &&
        cell44 && !cell44.querySelector('.disc') &&
        cell77 && !!cell77.querySelector('.disc')
      );
    }, { timeout: 5000 });

    const finalState = await page.evaluate(() => {
      const marker = window.cardState.markers.find((m) => m && m.id === 8451);
      return {
        board44: window.gameState.board[4][4],
        board77: window.gameState.board[7][7],
        markerRow: marker.row,
        markerCol: marker.col,
        destroyEvadeRemaining: marker.data.destroyEvadeRemaining,
        sourceHasDisc: !!document.querySelector('.cell[data-row="4"][data-col="4"] .disc'),
        destHasDisc: !!document.querySelector('.cell[data-row="7"][data-col="7"] .disc')
      };
    });

    expect(finalState).toEqual({
      board44: 0,
      board77: -1,
      markerRow: 7,
      markerCol: 7,
      destroyEvadeRemaining: 0,
      sourceHasDisc: false,
      destHasDisc: true
    });

    await page.close();
    page = null;
  }, 60000);
});