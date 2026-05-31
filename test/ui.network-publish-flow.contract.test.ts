describe('NetworkPublishFlowController contract', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('missing state does not leak a new rejected reason', async () => {
    const publishFlowModule = require('../ui/network/publish-flow');
    const emitStatus = jest.fn();
    const controller = publishFlowModule.createNetworkPublishFlowController({
      getState: () => null,
      emitStatus
    });

    const result = await controller.publishSnapshot({});

    expect(result).toEqual({ ok: false, reason: 'PUBLISH_ERROR' });
    expect(emitStatus).toHaveBeenCalledWith('ネット対戦: 通信失敗 (STATE_UNAVAILABLE)', true);
  });
});
