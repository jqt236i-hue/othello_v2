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
    delete (global as any).window;
    delete (global as any).NetworkMatchClient;
  });

  test('pending network helper is the only card interaction root client resolver', () => {
    const pendingNetwork = require('../cards/card-interaction-pending-network');

    expect(pendingNetwork.getActiveNetworkMatchClient()).toBe((global as any).NetworkMatchClient);
  });
});
