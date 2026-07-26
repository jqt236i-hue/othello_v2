import { resolveCurrentRuntimeObject } from '../ui/runtime-state-access';

describe('current UI runtime state access', () => {
  const root = globalThis as any;
  let previousCardState: any;
  let hadCardState = false;

  beforeEach(() => {
    hadCardState = Object.prototype.hasOwnProperty.call(root, 'cardState');
    previousCardState = root.cardState;
  });

  afterEach(() => {
    if (hadCardState) root.cardState = previousCardState;
    else delete root.cardState;
  });

  test('prefers the current root object over a stale legacy binding', () => {
    const current = {
      presentationEvents: [{ type: 'PLAYBACK_EVENTS' }]
    };
    const staleLegacy = {
      presentationEvents: []
    };
    root.cardState = current;

    expect(resolveCurrentRuntimeObject('cardState', () => staleLegacy)).toBe(current);
  });

  test('uses the legacy binding only when no current root object exists', () => {
    const legacy = { presentationEvents: [] };
    delete root.cardState;

    expect(resolveCurrentRuntimeObject('cardState', () => legacy)).toBe(legacy);
  });
});
