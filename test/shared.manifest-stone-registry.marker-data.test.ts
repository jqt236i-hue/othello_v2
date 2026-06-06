const ManifestStoneRegistry = require('../shared/manifest-stone-registry');

describe('manifest stone marker data builder', () => {
  test('builds observer marker data from registry metadata', () => {
    const data = ManifestStoneRegistry.createManifestStoneMarkerData('OBSERVER_WILL', {
      repaymentId: 'repay_1',
      stolenCardId: 'meteor_01'
    });

    expect(data).toEqual(expect.objectContaining({
      type: 'OBSERVER_WILL',
      sourceType: 'OBSERVER_WILL',
      remainingOwnerTurns: 5,
      absoluteProtected: true,
      visualEffectKey: 'observerWillStone',
      repaymentId: 'repay_1',
      stolenCardId: 'meteor_01'
    }));
  });

  test('rejects unknown marker types by returning null', () => {
    expect(ManifestStoneRegistry.createManifestStoneMarkerData('GHOST')).toBeNull();
  });
});
