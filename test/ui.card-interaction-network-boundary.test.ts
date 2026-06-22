describe('card interaction network boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    (global as any).window = global;
    (global as any).NetworkMatchClient = {
      isActive: jest.fn(() => true),
      isSpectator: jest.fn(() => true),
      getSeatKey: jest.fn(() => 'white'),
      publishSnapshot: jest.fn()
    };
  });

  afterEach(() => {
    jest.dontMock('../cards/card-interaction-network-client');
    jest.dontMock('../cards/card-interaction-pending-settlement');
    jest.dontMock('../cards/card-interaction-pending-publish');
    delete (global as any).window;
    delete (global as any).NetworkMatchClient;
  });

  test('pending network helper is the only card interaction root client resolver', () => {
    const pendingNetwork = require('../cards/card-interaction-pending-network');

    expect(pendingNetwork.getActiveNetworkMatchClient()).toBe((global as any).NetworkMatchClient);
  });

  test('debug fill hand publish stays behind pending network helper', async () => {
    const pendingNetwork = require('../cards/card-interaction-pending-network');
    (global as any).NetworkMatchClient.publishSnapshot.mockResolvedValue({ ok: true });

    await expect(pendingNetwork.publishNetworkDebugFillHand()).resolves.toEqual({ ok: true });
    expect((global as any).NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith({
      actionType: 'debug_fill_hand',
      playbackEvents: [],
      action: { type: 'debug_fill_hand' }
    });
  });

  test('prefers window NetworkMatchClient root over globalThis fallback', () => {
    const pendingNetwork = require('../cards/card-interaction-pending-network');
    const windowRoot: any = {
      NetworkMatchClient: {
        publishSnapshot: jest.fn(),
        isActive: () => true
      }
    };

    (global as any).window = windowRoot;
    (global as any).NetworkMatchClient = {
      publishSnapshot: jest.fn(),
      isActive: () => true
    };

    expect(pendingNetwork.getNetworkMatchClientRoot()).toBe(windowRoot);
  });

  test('active client resolver rejects missing publishSnapshot and inactive clients', () => {
    const pendingNetwork = require('../cards/card-interaction-pending-network');

    (global as any).NetworkMatchClient = { isActive: () => true };
    expect(pendingNetwork.getActiveNetworkMatchClient()).toBeNull();

    (global as any).NetworkMatchClient = {
      publishSnapshot: jest.fn(),
      isActive: () => false
    };
    expect(pendingNetwork.getActiveNetworkMatchClient()).toBeNull();
  });

  test('spectator check tolerates client exceptions', () => {
    const pendingNetwork = require('../cards/card-interaction-pending-network');
    (global as any).NetworkMatchClient = {
      publishSnapshot: jest.fn(),
      isActive: () => true,
      isSpectator: () => {
        throw new Error('boom');
      }
    };

    expect(pendingNetwork.isNetworkSpectatorActive()).toBe(false);
  });

  test.each([
    ['network client adapter', '../cards/card-interaction-network-client'],
    ['pending settlement adapter', '../cards/card-interaction-pending-settlement'],
    ['pending publish adapter', '../cards/card-interaction-pending-publish']
  ])('fails fast when %s cannot load', (_label, modulePath) => {
    jest.resetModules();
    jest.doMock(modulePath, () => {
      throw new Error('adapter load failed');
    });

    expect(() => require('../cards/card-interaction-pending-network')).toThrow('adapter load failed');
  });
});
