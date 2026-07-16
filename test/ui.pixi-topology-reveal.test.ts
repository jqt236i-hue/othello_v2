import {
  createPixiBoardPlayback,
  type PixiBoardPlaybackApplicationPort
} from '../ui/pixi/board-playback';
import type { PixiTimelineTickListener } from '../ui/pixi/timeline';

function createApplication() {
  const listeners = new Set<PixiTimelineTickListener>();
  const application: PixiBoardPlaybackApplicationPort & {
    tick(deltaMs: number): void;
    render: jest.Mock<void, []>;
    startTicker: jest.Mock<void, []>;
    stopTicker: jest.Mock<void, []>;
  } = {
    render: jest.fn(),
    subscribeTicker(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    startTicker: jest.fn(),
    stopTicker: jest.fn(),
    tick(deltaMs: number) {
      for (const listener of Array.from(listeners)) listener(deltaMs);
    }
  };
  return application;
}

function createScene() {
  let nextId = 1;
  return {
    beginTopologyReveal: jest.fn((_keys: readonly string[], _initialProgress?: number) => ({ id: nextId++ })),
    updateTopologyReveal: jest.fn(),
    endTopologyReveal: jest.fn(),
    getDiagnostics: jest.fn(() => ({ playbackScopeKey: null }))
  };
}

describe('Pixi topology reveal playback', () => {
  test('uses the shared timeline for one 260ms ease-out reveal and releases its handle', async () => {
    const application = createApplication();
    const scene = createScene();
    const playback = createPixiBoardPlayback({
      application,
      scene: scene as any,
      getFrame: () => null,
      noAnimation: false
    });

    const settlement = playback.revealTopologyCells(['0,8', '0,8']);
    const handle = scene.beginTopologyReveal.mock.results[0].value;
    expect(scene.beginTopologyReveal).toHaveBeenCalledWith(['0,8'], 0);
    expect(scene.updateTopologyReveal).toHaveBeenLastCalledWith(handle, 0);
    await Promise.resolve();
    expect(application.startTicker).toHaveBeenCalledTimes(1);
    expect(application.render).toHaveBeenCalledTimes(1);

    application.tick(130);
    expect(scene.updateTopologyReveal.mock.calls.at(-1)?.[0]).toBe(handle);
    expect(scene.updateTopologyReveal.mock.calls.at(-1)?.[1]).toBeCloseTo(0.6848, 3);
    application.tick(130);
    await settlement;

    expect(scene.updateTopologyReveal).toHaveBeenLastCalledWith(handle, 1);
    expect(scene.endTopologyReveal).toHaveBeenCalledTimes(1);
    expect(application.render).toHaveBeenCalledTimes(3);
    expect(application.stopTicker).toHaveBeenCalledTimes(1);
    expect(playback.getDiagnostics()).toMatchObject({
      inFlightTopologyRevealCount: 0,
      inFlightEffectCount: 0,
      timeline: {
        state: 'idle',
        startedRunCount: 1,
        completedRunCount: 1,
        tickerStartCount: 1,
        tickerStopCount: 1
      }
    });
  });

  test('NOANIM is immediate and abort/destroy synchronously release active scene handles', async () => {
    const immediateApplication = createApplication();
    const immediateScene = createScene();
    const immediatePlayback = createPixiBoardPlayback({
      application: immediateApplication,
      scene: immediateScene as any,
      getFrame: () => null,
      noAnimation: true
    });
    await immediatePlayback.revealTopologyCells(['-1,0']);
    expect(immediateScene.beginTopologyReveal).toHaveBeenCalledWith(['-1,0'], 1);
    expect(immediateScene.updateTopologyReveal).not.toHaveBeenCalled();
    expect(immediateScene.endTopologyReveal).toHaveBeenCalledTimes(1);
    expect(immediateApplication.startTicker).not.toHaveBeenCalled();

    const application = createApplication();
    const scene = createScene();
    const playback = createPixiBoardPlayback({
      application,
      scene: scene as any,
      getFrame: () => null,
      noAnimation: false
    });
    const aborted = playback.revealTopologyCells(['0,8']);
    await Promise.resolve();
    const abortReason = new Error('topology-reveal-aborted');
    expect(playback.abort(abortReason)).toBe(1);
    expect(scene.endTopologyReveal).toHaveBeenCalledTimes(1);
    await expect(aborted).rejects.toBe(abortReason);
    expect(playback.getDiagnostics()).toMatchObject({
      inFlightTopologyRevealCount: 0,
      timeline: { state: 'idle', abortedRunCount: 1 }
    });

    const destroyed = playback.revealTopologyCells(['0,9']);
    await Promise.resolve();
    playback.destroy();
    expect(scene.endTopologyReveal).toHaveBeenCalledTimes(2);
    await expect(destroyed).rejects.toThrow('Pixi board playback was destroyed');
    expect(playback.getDiagnostics()).toMatchObject({
      destroyed: true,
      inFlightTopologyRevealCount: 0,
      inFlightEffectCount: 0,
      timeline: { state: 'destroyed', activeRunCount: 0 }
    });
  });
});
