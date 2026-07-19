import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import FpsDisplay = require('../ui/fps-display');

type ScheduledFrame = {
  id: number;
  callback: FrameRequestCallback;
};

function createHarness(storedEnabled = false) {
  const dom = new JSDOM('<button id="toggle" aria-pressed="false">FPS: OFF</button><div id="display" hidden>FPS: --</div>', {
    url: 'https://example.com/'
  });
  const scheduled: ScheduledFrame[] = [];
  const cancelled: number[] = [];
  let nextFrameId = 1;
  const requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
    const id = nextFrameId++;
    scheduled.push({ id, callback });
    return id;
  });
  const cancelAnimationFrame = jest.fn((id: number) => {
    cancelled.push(id);
    const index = scheduled.findIndex((entry) => entry.id === id);
    if (index >= 0) scheduled.splice(index, 1);
  });
  if (storedEnabled) {
    dom.window.sessionStorage.setItem(FpsDisplay.FPS_DISPLAY_STORAGE_KEY, '1');
  }
  const root = {
    requestAnimationFrame,
    cancelAnimationFrame,
    sessionStorage: dom.window.sessionStorage
  };
  const button = dom.window.document.getElementById('toggle') as HTMLButtonElement;
  const display = dom.window.document.getElementById('display') as HTMLElement;
  const runNextFrame = (timestamp: number) => {
    const next = scheduled.shift();
    if (!next) throw new Error('no scheduled frame');
    next.callback(timestamp);
  };
  return {
    dom,
    root,
    button,
    display,
    scheduled,
    cancelled,
    requestAnimationFrame,
    cancelAnimationFrame,
    runNextFrame
  };
}

describe('FPS display', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('toggles measurement, reports the sampled RAF rate, and stops cleanly', () => {
    const harness = createHarness();
    const controller = FpsDisplay.setupFpsDisplay({
      button: harness.button,
      display: harness.display,
      root: harness.root,
      sampleWindowMs: 500
    });

    expect(controller?.isEnabled()).toBe(false);
    expect(harness.display.hidden).toBe(true);
    expect(harness.scheduled).toHaveLength(0);

    harness.button.click();

    expect(controller?.isEnabled()).toBe(true);
    expect(harness.button.textContent).toBe('FPS: ON');
    expect(harness.button.getAttribute('aria-pressed')).toBe('true');
    expect(harness.button.classList.contains('btn-active')).toBe(true);
    expect(harness.display.hidden).toBe(false);
    expect(harness.root.sessionStorage.getItem(FpsDisplay.FPS_DISPLAY_STORAGE_KEY)).toBe('1');
    expect(harness.scheduled).toHaveLength(1);

    [0, 100, 200, 300, 400, 500].forEach(harness.runNextFrame);
    expect(harness.display.textContent).toBe('FPS: 10');

    harness.button.click();

    expect(controller?.isEnabled()).toBe(false);
    expect(harness.button.textContent).toBe('FPS: OFF');
    expect(harness.button.getAttribute('aria-pressed')).toBe('false');
    expect(harness.display.hidden).toBe(true);
    expect(harness.scheduled).toHaveLength(0);
    expect(harness.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(harness.root.sessionStorage.getItem(FpsDisplay.FPS_DISPLAY_STORAGE_KEY)).toBe('0');
    controller?.destroy();
  });

  test('restores the current-tab setting and restarts sampling after a long background gap', () => {
    const harness = createHarness(true);
    const controller = FpsDisplay.setupFpsDisplay({
      button: harness.button,
      display: harness.display,
      root: harness.root,
      sampleWindowMs: 500
    });

    expect(controller?.isEnabled()).toBe(true);
    expect(harness.display.hidden).toBe(false);
    harness.runNextFrame(0);
    harness.runNextFrame(3000);
    expect(harness.display.textContent).toBe('FPS: --');

    [3100, 3200, 3300, 3400, 3500].forEach(harness.runNextFrame);
    expect(harness.display.textContent).toBe('FPS: 10');
    controller?.destroy();
  });

  test('reinitialization removes the old listener and RAF loop', () => {
    const harness = createHarness();
    const first = FpsDisplay.setupFpsDisplay({
      button: harness.button,
      display: harness.display,
      root: harness.root
    });
    first?.setEnabled(true);
    expect(harness.scheduled).toHaveLength(1);

    const second = FpsDisplay.setupFpsDisplay({
      button: harness.button,
      display: harness.display,
      root: harness.root
    });
    expect(second?.isEnabled()).toBe(true);
    expect(harness.scheduled).toHaveLength(1);

    harness.button.click();
    expect(second?.isEnabled()).toBe(false);
    expect(harness.scheduled).toHaveLength(0);
    second?.destroy();
  });

  test('keeps the page toggle usable when session storage is unavailable', () => {
    const harness = createHarness();
    const storage = {
      getItem: jest.fn(() => { throw new Error('blocked'); }),
      setItem: jest.fn(() => { throw new Error('blocked'); })
    } as unknown as Storage;
    const controller = FpsDisplay.setupFpsDisplay({
      button: harness.button,
      display: harness.display,
      root: { ...harness.root, sessionStorage: storage }
    });

    harness.button.click();
    expect(controller?.isEnabled()).toBe(true);
    expect(harness.display.hidden).toBe(false);
    expect(harness.scheduled).toHaveLength(1);
    controller?.destroy();
  });

  test('disables the toggle when requestAnimationFrame is unavailable', () => {
    const harness = createHarness();
    const controller = FpsDisplay.setupFpsDisplay({
      button: harness.button,
      display: harness.display,
      root: { sessionStorage: harness.root.sessionStorage }
    });

    expect(controller?.isEnabled()).toBe(false);
    expect(harness.button.disabled).toBe(true);
    expect(harness.button.textContent).toBe('FPS: OFF');
    expect(harness.display.hidden).toBe(true);
    controller?.destroy();
  });

  test('markup and CSS expose an accessible screen-edge FPS surface', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.classic.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles-layout-controls.css'), 'utf8');

    expect(html).toMatch(/id="fpsToggleBtn"[\s\S]*aria-pressed="false"[\s\S]*aria-controls="fpsDisplay"[\s\S]*>FPS: OFF<\/button>/);
    expect(html).toMatch(/id="fpsDisplay"[\s\S]*aria-hidden="true"[\s\S]*hidden>FPS: --<\/div>/);
    expect(css).toMatch(/#fpsDisplay\s*\{[\s\S]*position:\s*fixed[\s\S]*top:\s*max\([\s\S]*right:\s*max\([\s\S]*pointer-events:\s*none/);
    expect(css).toMatch(/#fpsDisplay\[hidden\]\s*\{[\s\S]*display:\s*none/);
    expect(css).toMatch(/#fpsToggleBtn\.btn-active\s*\{/);
  });
});
