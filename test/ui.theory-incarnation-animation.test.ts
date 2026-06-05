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
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
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

    await handler.handleTheoryIncarnationSpawnRouletteEvent({
      type: 'theory_incarnation_spawn_roulette',
      durationMs: 2000,
      materializeMs: 700,
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
          fn();
          return timers.length;
        }
      }),
      playbackScope: null
    });

    const selectedCell = dom.window.document.querySelector('.cell[data-row="0"][data-col="1"]');
    const otherCell = dom.window.document.querySelector('.cell[data-row="0"][data-col="0"]');
    const disc = selectedCell.querySelector('.disc');

    expect(timers.some((entry) => entry.ms === 2000)).toBe(true);
    expect(disc).toBeTruthy();
    expect(disc.dataset.special).toBe('GHOST');
    expect(selectedCell.classList.contains('theory-spawn-materialize')).toBe(false);
    expect(otherCell.classList.contains('theory-spawn-roulette-active')).toBe(false);
    expect(waitForOpacityTransition).toHaveBeenCalledWith(
      disc,
      700,
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
