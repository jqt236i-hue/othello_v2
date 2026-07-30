import { JSDOM } from 'jsdom';
import {
  MOBILE_COMMANDS,
  MOBILE_PANEL_COMMANDS,
  getMobileCommand,
  getMobilePanelCommand,
} from '../ui/mobile-command-surface/config';
import {
  createMobileHistoryController,
} from '../ui/mobile-command-surface/history';
import {
  IDLE_MOBILE_SURFACE_STATE,
  reduceMobileSurfaceState,
} from '../ui/mobile-command-surface/state';

describe('mobile command surface internal contracts', () => {
  test('uses one registry for menu lookup and native panel lookup', () => {
    expect(new Set(MOBILE_COMMANDS.map((command) => command.id)).size).toBe(MOBILE_COMMANDS.length);
    MOBILE_COMMANDS.forEach((command) => {
      expect(getMobileCommand(command.id)).toBe(command);
    });
    MOBILE_PANEL_COMMANDS.forEach((command) => {
      expect(getMobilePanelCommand(command.id)).toBe(command);
      expect(getMobileCommand(command.id)).toBe(command);
    });
  });

  test('keeps layer, pending panel, and open panel states mutually exclusive', () => {
    const drawer = reduceMobileSurfaceState(IDLE_MOBILE_SURFACE_STATE, {
      type: 'OPEN_LAYER',
      layer: 'drawer',
    });
    expect(drawer).toEqual({ kind: 'layer', layer: 'drawer' });

    const status = reduceMobileSurfaceState(drawer, {
      type: 'OPEN_LAYER',
      layer: 'status',
    });
    expect(status).toEqual({ kind: 'layer', layer: 'status' });

    const pending = reduceMobileSurfaceState(status, {
      type: 'BEGIN_PANEL',
      panelId: 'network',
    });
    expect(pending).toEqual({ kind: 'panel-pending', panelId: 'network' });

    const mobilePanel = reduceMobileSurfaceState(pending, {
      type: 'SYNC_PANEL',
      panelId: 'network',
    });
    expect(mobilePanel).toEqual({
      kind: 'panel-open',
      panelId: 'network',
      origin: 'mobile',
    });
    expect(reduceMobileSurfaceState(mobilePanel, {
      type: 'SYNC_PANEL',
      panelId: null,
    })).toEqual({ kind: 'idle' });

    expect(reduceMobileSurfaceState(IDLE_MOBILE_SURFACE_STATE, {
      type: 'SYNC_PANEL',
      panelId: 'profile',
    })).toEqual({
      kind: 'panel-open',
      panelId: 'profile',
      origin: 'external',
    });
  });

  test('owns only its current history marker and releases it on popstate', () => {
    const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
    const windowRef = dom.window as unknown as Window;
    const pushSpy = jest.spyOn(windowRef.history, 'pushState');
    const replaceSpy = jest.spyOn(windowRef.history, 'replaceState');
    const backSpy = jest.spyOn(windowRef.history, 'back').mockImplementation(() => {});
    const historyController = createMobileHistoryController(windowRef);

    historyController.promote('drawer');
    expect(historyController.owns('drawer')).toBe(true);
    expect(pushSpy).toHaveBeenCalledTimes(1);

    historyController.promote('panel:network');
    expect(historyController.owns('panel:network')).toBe(true);
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(historyController.releaseOnPop()).toBe(true);
    expect(historyController.owns()).toBe(false);
    expect(historyController.releaseOnPop()).toBe(false);

    historyController.promote('status');
    expect(historyController.owns('status')).toBe(true);
    historyController.consume();
    expect(backSpy).toHaveBeenCalledTimes(1);

    historyController.promote('quick');
    historyController.consume();
    expect(backSpy).toHaveBeenCalledTimes(2);
    expect(historyController.owns()).toBe(false);
    dom.window.close();
  });
});
