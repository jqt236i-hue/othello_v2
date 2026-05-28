import * as path from 'path';

describe('ui/bootstrap OwnerHelpers global registration', () => {
  const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
  const ownerHelpersPath = path.resolve(__dirname, '..', 'utils', 'owner-helpers.js');

  afterEach(() => {
    jest.resetModules();
    try { delete global.window; } catch (e) { /* ignore */ }
    try { delete global.document; } catch (e) { /* ignore */ }
    try { delete global.OwnerHelpers; } catch (e) { /* ignore */ }
  });

  test('bootstrap mirrors OwnerHelpers to window while utils module stays pure', () => {
    const windowLike: Record<string, unknown> = {};

    global.window = windowLike;

    const ownerHelpers = require(ownerHelpersPath);
    expect(windowLike.OwnerHelpers).toBeUndefined();

    require(bootstrapPath);

    expect(Object.keys(windowLike.OwnerHelpers as Record<string, unknown>).sort()).toEqual(
      Object.keys(ownerHelpers).sort()
    );
    expect((windowLike.OwnerHelpers as any).resolveLocalPlayerKey({ LOCAL_PLAYER_KEY: 'white' })).toBe('white');
  });
});
