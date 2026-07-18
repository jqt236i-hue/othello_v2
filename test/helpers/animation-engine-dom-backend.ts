const DOM_BACKEND_SLEEP_CONTROL = '__animationEngineDomBackendSleepControl';

type SleepControl = (durationMs: number) => unknown;

function readSleepControl(): SleepControl | null {
  const control = (globalThis as any)[DOM_BACKEND_SLEEP_CONTROL];
  return typeof control === 'function' ? control : null;
}

export function setAnimationEngineDomBackendSleepControl(
  implementation: SleepControl = () => undefined
): jest.Mock {
  const control = jest.fn(implementation);
  (globalThis as any)[DOM_BACKEND_SLEEP_CONTROL] = control;
  return control;
}

export function clearAnimationEngineDomBackendSleepControl(): void {
  delete (globalThis as any)[DOM_BACKEND_SLEEP_CONTROL];
}

export function installAnimationEngineDomBackendMock(): void {
  jest.doMock('../../ui/board-renderer', () => {
    let nextTokenId = 1;
    let executor: any = null;

    const getExecutor = () => {
      if (executor) return executor;
      const { createDomBoardPlaybackHandlers } = jest.requireActual('../../ui/board-dom-compat/runtime');
      const { createDomBoardPlaybackExecutor } = jest.requireActual('../../ui/board-dom-compat/playback');
      const handlers = createDomBoardPlaybackHandlers({
        getBoardElement: () => (
          typeof document !== 'undefined' ? document.getElementById('board') : null
        ),
        documentRef: typeof document !== 'undefined' ? document : null,
        getTimer: () => ({
          setTimeout: (callback: () => void, durationMs: number) => {
            const control = readSleepControl();
            if (!control) return setTimeout(callback, durationMs);
            const handle = { cancelled: false };
            Promise.resolve(control(durationMs)).then(() => {
              if (!handle.cancelled) callback();
            });
            return handle;
          },
          clearTimeout: (handle: any) => {
            if (handle && typeof handle === 'object' && 'cancelled' in handle) {
              handle.cancelled = true;
              return;
            }
            clearTimeout(handle);
          }
        })
      });
      executor = createDomBoardPlaybackExecutor(handlers);
      return executor;
    };

    return {
      getBoardVisualControllerReady: () => Promise.resolve(),
      getBoardCellClientRect: (row: number, col: number) => {
        if (typeof document === 'undefined') return null;
        const cell = document.querySelector(
          `.cell[data-row="${row}"][data-col="${col}"]`
        );
        return cell && typeof cell.getBoundingClientRect === 'function'
          ? cell.getBoundingClientRect()
          : null;
      },
      claimBoardVisualWriter: (frameToken: string, mode: 'local' | 'network') => ({
        id: nextTokenId++,
        frameToken,
        mode
      }),
      playBoardVisualPhase: (token: any, events: readonly unknown[], phaseScope?: any) => (
        getExecutor().playPhase(events, {
          token,
          strictNetworkPlayback: token && token.mode === 'network',
          phaseScope
        })
      ),
      settleBoardVisualWriter: () => Promise.resolve(),
      releaseBoardVisualWriter: () => undefined
    };
  });
}
