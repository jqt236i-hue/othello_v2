const HandFadeStateModule = require('../ui/hand-animation/fade-state');

function createRoot() {
  return {};
}

describe('Hand fade state module', () => {
  test('normalizes and mirrors queued fade state', () => {
    const root: any = createRoot();

    expect(HandFadeStateModule.setQueuedHandFadeInState({
      playerKey: -1,
      count: 2.8,
      token: ' fade-token '
    }, root)).toEqual({
      playerKey: 'white',
      count: 2,
      token: ' fade-token '
    });
    expect(root.__handFadeInState).toEqual(root.__handFadeInHint);
    expect(HandFadeStateModule.getQueuedHandFadeInState(root)).toEqual(root.__handFadeInState);
  });

  test('clears matching token or owner without touching unrelated hints', () => {
    const root: any = createRoot();
    HandFadeStateModule.setQueuedHandFadeInState({ playerKey: 'black', count: 1, token: 'a' }, root);

    HandFadeStateModule.clearQueuedHandFadeInState({ token: 'missing' }, root);
    expect(root.__handFadeInState).toMatchObject({ token: 'a' });

    HandFadeStateModule.clearQueuedHandFadeInState({ ownerKey: 'black' }, root);
    expect(root.__handFadeInState).toBeNull();
    expect(root.__handFadeInHint).toBeNull();
  });
});
