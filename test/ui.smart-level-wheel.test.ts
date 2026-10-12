import * as path from 'path';
import { JSDOM } from 'jsdom';

describe('smart cpu level label wheel', () => {
  let dom: JSDOM;
  let shortcut: HTMLButtonElement;
  let smartBlack: HTMLSelectElement;
  let smartWhite: HTMLSelectElement;
  let profiles: typeof import('../shared/cpu-opponent-profiles');
  let selection: typeof import('../ui/cpu-profile-selection');
  let updateCpuCharacter: jest.Mock;
  let change: jest.Mock;
  let bubbledChange: jest.Mock;
  let storageSet: jest.SpyInstance;
  let savedGlobals: Map<string, PropertyDescriptor | undefined>;

  function wheel(deltaY: number, options: WheelEventInit = {}): WheelEvent {
    const event = new dom.window.WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ...options,
      deltaY
    });
    shortcut.dispatchEvent(event);
    return event;
  }

  function clearChangeEffects(): void {
    change.mockClear();
    bubbledChange.mockClear();
    updateCpuCharacter.mockClear();
    storageSet.mockClear();
  }

  function selectLevel(value: string): void {
    smartWhite.value = value;
    smartWhite.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    clearChangeEffects();
  }

  function expectUnchanged(value: string): void {
    expect(smartWhite.value).toBe(value);
    expect((global as any).cpuSmartness.white).toBe(profiles.getCpuOpponentLevel(value));
    expect(selection.readStoredCpuProfiles()).toEqual({ black: '4', white: value });
    expect(change).not.toHaveBeenCalled();
    expect(bubbledChange).not.toHaveBeenCalled();
    expect(updateCpuCharacter).not.toHaveBeenCalled();
    expect(storageSet).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM(
      '<!doctype html><html><body>' +
      '<button id="cpu-level-label" type="button" aria-expanded="false">CPU名</button>' +
      '<select id="smartBlack"></select>' +
      '<select id="smartWhite"></select>' +
      '</body></html>',
      { url: 'http://localhost/' }
    );
    updateCpuCharacter = jest.fn();
    // No policy loader: the existing change handler stays synchronous, without
    // unrelated policy promises continuing after JSDOM cleanup.
    const bindings: Record<string, unknown> = {
      window: dom.window,
      document: dom.window.document,
      Event: dom.window.Event,
      MouseEvent: dom.window.MouseEvent,
      KeyboardEvent: dom.window.KeyboardEvent,
      WheelEvent: dom.window.WheelEvent,
      updateCpuCharacter,
      CpuPolicy: {},
      addLog: jest.fn(),
      mccfrPolicy: null,
      cpuSmartness: { black: 1, white: 1 }
    };
    savedGlobals = new Map();
    for (const [key, value] of Object.entries(bindings)) {
      savedGlobals.set(key, Object.getOwnPropertyDescriptor(global, key));
      Object.defineProperty(global, key, { configurable: true, writable: true, value });
    }

    profiles = require(path.join(__dirname, '..', 'shared', 'cpu-opponent-profiles.ts'));
    selection = require(path.join(__dirname, '..', 'ui', 'cpu-profile-selection.ts'));
    dom.window.localStorage.setItem(
      selection.CPU_PROFILE_STORAGE_KEY,
      JSON.stringify({ black: '4', white: '1' })
    );
    shortcut = document.getElementById('cpu-level-label') as HTMLButtonElement;
    smartBlack = document.getElementById('smartBlack') as HTMLSelectElement;
    smartWhite = document.getElementById('smartWhite') as HTMLSelectElement;

    // Exercise root source before a build, rather than relying on a dist wrapper.
    const smartModule = require(path.join(__dirname, '..', 'ui', 'handlers', 'smart.ts'));
    smartModule.setupSmartSelects(smartBlack, smartWhite);

    change = jest.fn();
    bubbledChange = jest.fn();
    smartWhite.addEventListener('change', change);
    document.body.addEventListener('change', bubbledChange);
    storageSet = jest.spyOn(dom.window.Storage.prototype, 'setItem');
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    dom.window.close();
    for (const [key, descriptor] of savedGlobals) {
      if (descriptor) Object.defineProperty(global, key, descriptor);
      else delete (global as any)[key];
    }
  });

  test('steps through Lv1..Lv13 in shared menu order both ways without opening the menu', () => {
    const values = profiles.getCpuOpponentMenuOptions().map(option => String(option.value));
    expect(values.map(value => profiles.getCpuOpponentLevel(value))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
    ]);
    expect(values[5]).toBe('6');
    expect(values[6]).toBe('7-board-executor');
    expect(smartWhite.value).toBe(values[0]);
    expect(document.getElementById('cpu-level-menu')).toBeNull();

    let changes = 0;
    for (const [direction, targets] of [
      [-0.25, values.slice(1)],
      [2000, values.slice(0, -1).reverse()]
    ] as Array<[number, string[]]>) {
      for (const value of targets) {
        // Even a larger, opposite horizontal delta must not reverse deltaY.
        expect(wheel(direction, { deltaX: direction < 0 ? 5000 : -5000 }).defaultPrevented).toBe(true);
        changes += 1;
        expect(smartWhite.value).toBe(value);
        expect((global as any).cpuSmartness.white).toBe(profiles.getCpuOpponentLevel(value));
        expect(change).toHaveBeenCalledTimes(changes);
        expect(bubbledChange).toHaveBeenCalledTimes(changes);
        expect(updateCpuCharacter).toHaveBeenCalledTimes(changes);
        expect(storageSet).toHaveBeenCalledTimes(changes);
        expect(selection.readStoredCpuProfiles()).toEqual({ black: '4', white: value });
        expect(smartBlack.value).toBe('4');
        expect((global as any).cpuSmartness.black).toBe(4);
        expect(document.getElementById('cpu-level-menu')).toBeNull();
        expect(shortcut.getAttribute('aria-expanded')).toBe('false');
      }
    }
  });

  test('uses the select change path to save profiles and refresh an open menu and summary', () => {
    selectLevel('6');
    shortcut.click();
    const menu = document.getElementById('cpu-level-menu') as HTMLDivElement;
    expect(menu.hidden).toBe(false);
    expect(menu.querySelector('.cpu-config-summary-value')?.textContent).toBe('Lv6 / 通常 8×8');

    for (const [deltaY, value, level] of [
      [-100, '7-board-executor', 7],
      [-100, '8-theory-incarnation', 8],
      [100, '7-board-executor', 7],
      [100, '6', 6]
    ] as Array<[number, string, number]>) {
      clearChangeEffects();
      expect(wheel(deltaY).defaultPrevented).toBe(true);
      expect(smartWhite.value).toBe(value);
      expect((global as any).cpuSmartness.white).toBe(level);
      expect(change).toHaveBeenCalledTimes(1);
      expect(bubbledChange).toHaveBeenCalledTimes(1);
      expect(change.mock.calls[0][0].target).toBe(smartWhite);
      expect(change.mock.calls[0][0].bubbles).toBe(true);
      expect(updateCpuCharacter).toHaveBeenCalledTimes(1);
      expect(storageSet).toHaveBeenCalledTimes(1);
      expect(storageSet).toHaveBeenCalledWith(
        selection.CPU_PROFILE_STORAGE_KEY,
        JSON.stringify({ black: '4', white: value })
      );
      expect(selection.readStoredCpuProfiles()).toEqual({ black: '4', white: value });
      const selected = menu.querySelectorAll('.cpu-level-menu-item.is-selected');
      expect(selected).toHaveLength(1);
      expect(selected[0].getAttribute('data-cpu-level')).toBe(value);
      expect(selected[0].getAttribute('aria-checked')).toBe('true');
      expect(menu.querySelectorAll('.cpu-level-menu-item[aria-checked="true"]')).toHaveLength(1);
      expect(menu.querySelector('.cpu-config-summary-value')?.textContent).toBe(`Lv${level} / 通常 8×8`);
      expect(menu.hidden).toBe(false);
      expect(shortcut.getAttribute('aria-expanded')).toBe('true');
    }
  });

  test.each([
    ['1', 100, '2'],
    ['13-truth-chaos-emperor-beast', -100, '12-strategy-cpu']
  ] as Array<[string, number, string]>)('clamps at %s without wrapping or emitting redundant changes', (value, deltaY, adjacent) => {
    selectLevel(value);
    expect(wheel(deltaY).defaultPrevented).toBe(true);
    expect(wheel(deltaY).defaultPrevented).toBe(true);
    expectUnchanged(value);

    expect(wheel(-deltaY).defaultPrevented).toBe(true);
    expect(smartWhite.value).toBe(adjacent);
    expect(change).toHaveBeenCalledTimes(1);
    expect(updateCpuCharacter).toHaveBeenCalledTimes(1);
    expect(storageSet).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['button disabled', -100],
    ['button disabled', 100],
    ['button aria-disabled', -100],
    ['button aria-disabled', 100],
    ['select disabled', -100],
    ['select disabled', 100]
  ] as Array<[string, number]>)('ignores %s wheel deltaY=%s without suppressing scrolling', (disabledState, deltaY) => {
    selectLevel('6');
    if (disabledState === 'button disabled') shortcut.disabled = true;
    if (disabledState === 'button aria-disabled') shortcut.setAttribute('aria-disabled', 'true');
    if (disabledState === 'select disabled') smartWhite.disabled = true;

    expect(wheel(deltaY).defaultPrevented).toBe(false);
    expectUnchanged('6');
    expect(document.getElementById('cpu-level-menu')).toBeNull();
  });

  test.each([-100, 100])('ignores ctrlKey pinch zoom deltaY=%s without preventing default', deltaY => {
    selectLevel('6');
    expect(wheel(deltaY, { ctrlKey: true }).defaultPrevented).toBe(false);
    expectUnchanged('6');
  });

  test.each([-100, 0, 100])('ignores deltaY=0 even with deltaX=%s without preventing default', deltaX => {
    selectLevel('6');
    expect(wheel(0, { deltaX }).defaultPrevented).toBe(false);
    expectUnchanged('6');
  });
});
