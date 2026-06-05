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

    const selectedCell = dom.window.document.querySelector('.cell[data-row="0"][data-col="1"]');
    const otherCell = dom.window.document.querySelector('.cell[data-row="0"][data-col="0"]');
    await Promise.resolve();

    expect(timers.length).toBe(1);
    expect(otherCell.classList.contains('theory-spawn-roulette-active')).toBe(true);
    expect(selectedCell.classList.contains('theory-spawn-roulette-active')).toBe(false);
    expect(selectedCell.classList.contains('theory-spawn-roulette-selected')).toBe(false);

    const firstDelay = timers[0].ms;
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
});
