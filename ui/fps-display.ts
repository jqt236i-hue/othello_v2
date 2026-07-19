const FPS_DISPLAY_STORAGE_KEY = 'card_reversi_fps_display_v1';
const DEFAULT_SAMPLE_WINDOW_MS = 500;
const LONG_GAP_MULTIPLIER = 4;

type RequestFrame = (callback: FrameRequestCallback) => number;
type CancelFrame = (handle: number) => void;

interface FpsDisplayRoot {
  requestAnimationFrame?: RequestFrame;
  cancelAnimationFrame?: CancelFrame;
  sessionStorage?: Storage;
}

interface FpsDisplayOptions {
  button: HTMLElement | null;
  display: HTMLElement | null;
  root?: FpsDisplayRoot | null;
  sampleWindowMs?: number;
}

interface FpsDisplayController {
  isEnabled: () => boolean;
  setEnabled: (enabled: boolean) => void;
  destroy: () => void;
}

let activeController: FpsDisplayController | null = null;

function resolveDefaultRoot(): FpsDisplayRoot | null {
  return (typeof window !== 'undefined') ? window : null;
}

function resolveSessionStorage(root: FpsDisplayRoot | null): Storage | null {
  if (!root) return null;
  try {
    return root.sessionStorage || null;
  } catch (error) {
    return null;
  }
}

function readStoredEnabled(storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(FPS_DISPLAY_STORAGE_KEY) === '1';
  } catch (error) {
    return false;
  }
}

function writeStoredEnabled(storage: Storage | null, enabled: boolean): void {
  if (!storage) return;
  try {
    storage.setItem(FPS_DISPLAY_STORAGE_KEY, enabled ? '1' : '0');
  } catch (error) {
    // Session persistence is optional; the active page toggle still works.
  }
}

function normalizeSampleWindowMs(value: number | undefined): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0
    ? numeric
    : DEFAULT_SAMPLE_WINDOW_MS;
}

function setupFpsDisplay(options: FpsDisplayOptions): FpsDisplayController | null {
  const button = options && options.button;
  const display = options && options.display;
  if (!button || !display) return null;

  if (activeController) activeController.destroy();

  const root = (options && Object.prototype.hasOwnProperty.call(options, 'root'))
    ? options.root || null
    : resolveDefaultRoot();
  const requestFrame: RequestFrame | null = root && typeof root.requestAnimationFrame === 'function'
    ? root.requestAnimationFrame.bind(root)
    : null;
  const cancelFrame: CancelFrame | null = root && typeof root.cancelAnimationFrame === 'function'
    ? root.cancelAnimationFrame.bind(root)
    : null;
  const storage = resolveSessionStorage(root);
  const sampleWindowMs = normalizeSampleWindowMs(options.sampleWindowMs);
  const longGapMs = sampleWindowMs * LONG_GAP_MULTIPLIER;

  let enabled = false;
  let destroyed = false;
  let frameHandle: number | null = null;
  let sampleStartedAt: number | null = null;
  let frameCount = 0;

  const syncButton = (): void => {
    button.textContent = enabled ? 'FPS: ON' : 'FPS: OFF';
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.setAttribute('data-active', enabled ? 'true' : 'false');
    button.classList.toggle('btn-active', enabled);
  };

  const stopLoop = (): void => {
    if (frameHandle !== null && cancelFrame) cancelFrame(frameHandle);
    frameHandle = null;
    sampleStartedAt = null;
    frameCount = 0;
  };

  const tick = (timestamp: number): void => {
    frameHandle = null;
    if (!enabled || destroyed || !requestFrame) return;

    if (sampleStartedAt === null) {
      sampleStartedAt = timestamp;
      frameCount = 0;
    } else {
      const elapsedMs = timestamp - sampleStartedAt;
      if (elapsedMs > longGapMs) {
        display.textContent = 'FPS: --';
        sampleStartedAt = timestamp;
        frameCount = 0;
      } else {
        frameCount += 1;
        if (elapsedMs >= sampleWindowMs) {
          const fps = Math.max(0, Math.round((frameCount * 1000) / elapsedMs));
          display.textContent = `FPS: ${fps}`;
          sampleStartedAt = timestamp;
          frameCount = 0;
        }
      }
    }

    frameHandle = requestFrame(tick);
  };

  const startLoop = (): void => {
    if (!requestFrame || frameHandle !== null || destroyed) return;
    display.textContent = 'FPS: --';
    sampleStartedAt = null;
    frameCount = 0;
    frameHandle = requestFrame(tick);
  };

  const setEnabled = (nextEnabled: boolean, persist = true): void => {
    if (destroyed) return;
    enabled = nextEnabled === true && requestFrame !== null;
    syncButton();
    display.hidden = !enabled;
    if (enabled) {
      startLoop();
    } else {
      stopLoop();
      display.textContent = 'FPS: --';
    }
    if (persist) writeStoredEnabled(storage, enabled);
  };

  const handleClick = (): void => setEnabled(!enabled);
  button.addEventListener('click', handleClick);

  if (!requestFrame) {
    (button as HTMLButtonElement).disabled = true;
    button.title = 'この環境ではフレームレートを表示できません';
    setEnabled(false, false);
  } else {
    (button as HTMLButtonElement).disabled = false;
    setEnabled(readStoredEnabled(storage), false);
  }

  const controller: FpsDisplayController = {
    isEnabled: () => enabled,
    setEnabled: (nextEnabled: boolean) => setEnabled(nextEnabled),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      button.removeEventListener('click', handleClick);
      stopLoop();
      display.hidden = true;
      display.textContent = 'FPS: --';
      if (activeController === controller) activeController = null;
    }
  };

  activeController = controller;
  return controller;
}

export = {
  FPS_DISPLAY_STORAGE_KEY,
  setupFpsDisplay
};
