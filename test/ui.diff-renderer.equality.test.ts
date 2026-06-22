const DiffRendererEquality = require('../ui/diff-renderer/equality');

function createCellState(overrides: any = {}) {
  return Object.assign({
    value: 1,
    isLegal: false,
    isLegalFree: false,
    isTabooLegal: false,
    isRandomSpawnPreview: false,
    isSelectedTargetHighlighted: false,
    isSuperAttractionPathPreview: false,
    isSuperAttractionPreviewDestination: false,
    isSelectableFriendly: false,
    isExtendLifeTarget: false,
    breedingSprout: false,
    boardBonus: null,
    theoryNumberCell: false,
    livingWillAura: false,
    manifestAura: null,
    special: null,
    inherited: null,
    guard: null,
    bomb: null,
    blockade: null,
    frozen: null,
    seed: null
  }, overrides);
}

describe('DiffRenderer cell state equality', () => {
  test('keeps equal states stable and treats missing previous state as changed', () => {
    const current = createCellState();

    expect(DiffRendererEquality.cellStatesEqual(null, current)).toBe(false);
    expect(DiffRendererEquality.cellStatesEqual(createCellState(), current)).toBe(true);
  });

  test('compares nested special and blocker presentation fields', () => {
    const withSpecial = createCellState({
      special: {
        type: 'GOLD',
        owner: 1,
        remainingOwnerTurns: 2,
        regenRemaining: 0,
        flipEvadeRemaining: 1,
        destroyEvadeRemaining: 1
      }
    });

    expect(DiffRendererEquality.cellStatesEqual(
      withSpecial,
      createCellState({
        special: Object.assign({}, withSpecial.special, { destroyEvadeRemaining: 0 })
      })
    )).toBe(false);

    const withBlockade = createCellState({
      blockade: {
        type: 'SHRINK',
        owner: -1,
        remainingOwnerTurns: 3,
        visualVariant: 'inner',
        innerBoundaryMask: '1010'
      }
    });

    expect(DiffRendererEquality.cellStatesEqual(
      withBlockade,
      createCellState({
        blockade: Object.assign({}, withBlockade.blockade, { innerBoundaryMask: '0101' })
      })
    )).toBe(false);
  });

  test('compares manifest aura owner without requiring full object equality', () => {
    expect(DiffRendererEquality.cellStatesEqual(
      createCellState({ manifestAura: { owner: 1, ignored: 'before' } }),
      createCellState({ manifestAura: { owner: 1, ignored: 'after' } })
    )).toBe(true);

    expect(DiffRendererEquality.cellStatesEqual(
      createCellState({ manifestAura: { owner: 1 } }),
      createCellState({ manifestAura: { owner: -1 } })
    )).toBe(false);
  });
});
