describe('NetworkPublishFlowController contract', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('missing state collapses to PUBLISH_ERROR and emits a failure status', async () => {
    const publishFlowModule = require('../ui/network/publish-flow');
    const emitStatus = jest.fn();
    const controller = publishFlowModule.createNetworkPublishFlowController({
      getState: () => null,
      emitStatus
    });

    const result = await controller.publishSnapshot({});

    expect(result).toEqual({ ok: false, reason: 'PUBLISH_ERROR' });
    expect(emitStatus).toHaveBeenCalledWith(expect.stringContaining('ネット対戦: 通信失敗'), true);
  });
});
