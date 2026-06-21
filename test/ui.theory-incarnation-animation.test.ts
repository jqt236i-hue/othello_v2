describe('theory incarnation spawn roulette animation', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('highlights candidate cells and materializes the selected special stone', async () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="board">
            <div class="cell" data-row="0" data-col="0"></div>
            <div class="cell has-disc" data-row="0" data-col="1"><div class="disc stale-spawn"></div></div>
          </div>
        </body>
      </html>
    `);

    global.window = dom.window;
    global.document = dom.window.document;
    global.requestAnimationFrame = (cb) => {
      cb();
      return 0;
    };
    global.window.requestAnimationFrame = global.requestAnimationFrame;

    const timers: Array<{ fn: () => void; ms: number }> = [];
    const handler = require('../ui/animation-theory-events.js');
    const createDisc = jest.fn((state) => {
      const disc = dom.window.document.createElement('div');
      disc.className = 'disc';
      disc.dataset.special = state.special || '';
      return disc;
    });
    const waitForOpacityTransition = jest.fn(async (disc, durationMs, bufferMs, starter, cleanup) => {
      expect(disc.style.opacity).toBe('0');
      expect(disc.style.getPropertyValue('--theory-spawn-materialize-ms')).toBe('2000ms');
      starter();
      expect(disc.style.opacity).toBe('1');
      cleanup();
    });

    const animationPromise = handler.handleTheoryIncarnationSpawnRouletteEvent({
      type: 'theory_incarnation_spawn_roulette',
      durationMs: 2000,
      materializeMs: 2000,
      targets: [{
        r: 0,
        row: 0,
        col: 1,
        owner: 'black',
        ownerAfter: 'black',
        spawnedMarkerType: 'GHOST',
        candidateCells: [{ row: 0, col: 0, value: 5 }, { row: 0, col: 1, value: 16 }],
        after: { color: 1, special: 'GHOST', owner: 'black' }
      }]
    }, {
      isNoAnim: () => false,
      getCellEl: (row, col) => dom.window.document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`),
      createDisc,
      waitForOpacityTransition,
      timer: () => ({
        setTimeout: (fn, ms) => {
          timers.push({ fn, ms });
          return timers.length;
        }
      }),
      playbackScope: null
    });

    const selectedCell = dom.window.document.querySelector('.cell[data-row="0"][data-col="1"]');
    const otherCell = dom.window.document.querySelector('.cell[data-row="0"][data-col="0"]');
    await Promise.resolve();

    expect(timers.length).toBe(1);
    expect(otherCell.classList.contains('theory-spawn-roulette-active')).toBe(true);
    expect(selectedCell.classList.contains('theory-spawn-roulette-active')).toBe(false);
    expect(selectedCell.classList.contains('theory-spawn-roulette-selected')).toBe(false);
    expect(selectedCell.querySelector('.stale-spawn')).toBe(null);
    expect(selectedCell.classList.contains('has-disc')).toBe(false);
    expect(otherCell.querySelector('.board-bonus-number').textContent).toBe('5');
    expect(selectedCell.querySelector('.board-bonus-number').textContent).toBe('16');
    expect(selectedCell.classList.contains('has-theory-number-cell')).toBe(true);

    const firstDelay = timers[0].ms;
    const firstTimer = timers.shift();
    firstTimer.fn();
    await Promise.resolve();

    expect(otherCell.classList.contains('theory-spawn-roulette-active')).toBe(false);
    expect(otherCell.classList.contains('theory-spawn-roulette-trail')).toBe(true);
    expect(selectedCell.classList.contains('theory-spawn-roulette-active')).toBe(true);
    expect(selectedCell.classList.contains('theory-spawn-roulette-trail')).toBe(false);

    let lastDelay = firstDelay;
    while (timers.length > 0) {
      const next = timers.shift();
      lastDelay = next.ms;
      next.fn();
      await Promise.resolve();
    }
    await animationPromise;

    const disc = selectedCell.querySelector('.disc');

    expect(lastDelay).toBeGreaterThan(firstDelay);
    expect(disc).toBeTruthy();
    expect(disc.dataset.special).toBe('GHOST');
    expect(selectedCell.querySelector('.board-bonus-number')).toBe(null);
    expect(selectedCell.classList.contains('theory-spawn-materialize')).toBe(false);
    expect(otherCell.classList.contains('theory-spawn-roulette-active')).toBe(false);
    expect(waitForOpacityTransition).toHaveBeenCalledWith(
      disc,
      2000,
      expect.any(Number),
      expect.any(Function),
      expect.any(Function)
    );

    dom.window.close();
    delete global.requestAnimationFrame;
    delete global.window;
    delete global.document;
  });

  test('uses the MIDI-aligned 19-step roulette timeline before materializing', async () => {
    const { JSDOM } = require('jsdom');
    const cells = Array.from({ length: 12 }, (_, index) => (
      `<div class="cell" data-row="0" data-col="${index}"></div>`
    )).join('');
    const dom = new JSDOM(`<!doctype html><html><body><div id="board">${cells}</div></body></html>`);

    global.window = dom.window;
    global.document = dom.window.document;
    global.requestAnimationFrame = (cb) => {
      cb();
      return 0;
    };
    global.window.requestAnimationFrame = global.requestAnimationFrame;

    const timers: Array<{ fn: () => void; ms: number }> = [];
    const activeCols: number[] = [];
    const handler = require('../ui/animation-theory-events.js');
    const createDisc = jest.fn((state) => {
      const disc = dom.window.document.createElement('div');
      disc.className = 'disc';
      disc.dataset.special = state.special || '';
      return disc;
    });
    const waitForOpacityTransition = jest.fn(async (disc, durationMs, bufferMs, starter, cleanup) => {
      starter();
      cleanup();
    });

    const animationPromise = handler.handleTheoryIncarnationSpawnRouletteEvent({
      type: 'theory_incarnation_spawn_roulette',
      durationMs: 2500,
      materializeMs: 2000,
      targets: [{
        row: 0,
        col: 11,
        ownerAfter: 'black',
        spawnedMarkerType: 'GHOST',
        candidateCells: Array.from({ length: 12 }, (_, col) => ({ row: 0, col })),
        after: { color: 1, special: 'GHOST', owner: 'black' }
      }]
    }, {
      isNoAnim: () => false,
      getCellEl: (row, col) => dom.window.document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`),
      createDisc,
      waitForOpacityTransition,
      timer: () => ({
        setTimeout: (fn, ms) => {
          const active = dom.window.document.querySelector('.theory-spawn-roulette-active');
          activeCols.push(active ? Number(active.getAttribute('data-col')) : -1);
          timers.push({ fn, ms });
          return timers.length;
        }
      }),
      playbackScope: null
    });

    await Promise.resolve();

    const delays: number[] = [];
    while (timers.length > 0) {
      const next = timers.shift();
      delays.push(next.ms);
      next.fn();
      await Promise.resolve();
    }
    await animationPromise;

    expect(delays).toEqual([
      62.5, 62.5, 62.5, 62.5, 62.5, 62.5, 62.5, 62.5,
      125, 125, 125, 125, 125, 125, 125,
      250, 250, 375, 250
    ]);
    expect(activeCols).toHaveLength(19);
    expect(activeCols[activeCols.length - 1]).toBe(11);
    expect(waitForOpacityTransition).toHaveBeenCalledWith(
      expect.anything(),
      2000,
      expect.any(Number),
      expect.any(Function),
      expect.any(Function)
    );

    dom.window.close();
    delete global.requestAnimationFrame;
    delete global.window;
    delete global.document;
  });

  test('does not reveal the selected cell as the first roulette highlight when multiple candidates exist', async () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <div id="board">
            <div class="cell" data-row="0" data-col="0"></div>
            <div class="cell" data-row="0" data-col="1"></div>
          </div>
        </body>
      </html>
    `);

    global.window = dom.window;
    global.document = dom.window.document;
    global.requestAnimationFrame = (cb) => {
      cb();
      return 0;
    };
    global.window.requestAnimationFrame = global.requestAnimationFrame;

    const timers: Array<{ fn: () => void; ms: number }> = [];
    const handler = require('../ui/animation-theory-events.js');
    const createDisc = jest.fn((state) => {
      const disc = dom.window.document.createElement('div');
      disc.className = 'disc';
      disc.dataset.special = state.special || '';
      return disc;
    });
    const waitForOpacityTransition = jest.fn(async (disc, durationMs, bufferMs, starter, cleanup) => {
      starter();
      cleanup();
    });

    const animationPromise = handler.handleTheoryIncarnationSpawnRouletteEvent({
      type: 'theory_incarnation_spawn_roulette',
      durationMs: 2500,
      materializeMs: 2000,
      targets: [{
        row: 0,
        col: 1,
        ownerAfter: 'black',
        spawnedMarkerType: 'GHOST',
        candidateCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
        after: { color: 1, special: 'GHOST', owner: 'black' }
      }]
    }, {
      isNoAnim: () => false,
      getCellEl: (row, col) => dom.window.document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`),
      createDisc,
      waitForOpacityTransition,
      timer: () => ({
        setTimeout: (fn, ms) => {
          timers.push({ fn, ms });
          return timers.length;
        }
      }),
      playbackScope: null
    });

    await Promise.resolve();

    const selectedCell = dom.window.document.querySelector('.cell[data-row="0"][data-col="1"]');
    const otherCell = dom.window.document.querySelector('.cell[data-row="0"][data-col="0"]');
    expect(selectedCell.classList.contains('theory-spawn-roulette-active')).toBe(false);
    expect(otherCell.classList.contains('theory-spawn-roulette-active')).toBe(true);

    while (timers.length > 0) {
      const next = timers.shift();
      next.fn();
      await Promise.resolve();
    }
    await animationPromise;

    dom.window.close();
    delete global.requestAnimationFrame;
    delete global.window;
    delete global.document;
  });
});
