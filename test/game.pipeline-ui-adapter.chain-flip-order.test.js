const adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter chain flip ordering', () => {
  test('maps chain flips to a later phase than primary flips, while keeping chain batch together', () => {
    const pres = [
      { type: 'CHANGE', row: 3, col: 3, ownerBefore: 'white', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_flip' },
      { type: 'CHANGE', row: 3, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_flip' },
      { type: 'CHANGE', row: 4, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'CHAIN_WILL', reason: 'chain_flip' },
      { type: 'CHANGE', row: 5, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'CHAIN_WILL', reason: 'chain_flip' }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(4);
    expect(out.every(e => e.type === 'flip')).toBe(true);

    const primary = out.filter(e => e.targets[0].reason === 'standard_flip');
    const chain = out.filter(e => e.targets[0].reason === 'chain_flip');

    expect(primary).toHaveLength(2);
    expect(chain).toHaveLength(2);

    const primaryPhase = primary[0].phase;
    expect(primary[1].phase).toBe(primaryPhase);
    expect(chain[0].phase).toBeGreaterThan(primaryPhase);
    expect(chain[1].phase).toBe(chain[0].phase);
  });

  test('treats CHAIN_WILL cause as chain phase even if reason is missing', () => {
    const pres = [
      { type: 'CHANGE', row: 3, col: 3, ownerBefore: 'white', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_flip' },
      { type: 'CHANGE', row: 4, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'CHAIN_WILL' },
      { type: 'CHANGE', row: 5, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'CHAIN_WILL' }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(3);
    expect(out[1].phase).toBeGreaterThan(out[0].phase);
    expect(out[2].phase).toBe(out[1].phase);
  });
});
