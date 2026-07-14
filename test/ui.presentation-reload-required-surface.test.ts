import { JSDOM } from 'jsdom';

describe('network presentation reload-required surface', () => {
  test('offers explicit retry and reload actions without touching the board host', async () => {
    const dom = new JSDOM('<!doctype html><html><body><main id="game-container"><div id="board"></div></main></body></html>');
    const reload = jest.fn();
    const root = { document: dom.window.document, location: { reload } };
    const retry = jest.fn(async () => 1);
    const Surface = require('../ui/presentation/reload-required-surface');

    const node = Surface.showReloadRequiredSurface({ root, onRetry: retry });
    expect(node).not.toBeNull();
    expect(node.getAttribute('role')).toBe('alert');
    expect(node.getAttribute('data-reload-required')).toBe('true');
    expect(dom.window.document.querySelector('#board')?.children).toHaveLength(0);

    (node.querySelector('[data-presentation-retry]') as HTMLButtonElement).click();
    await Promise.resolve();
    expect(retry).toHaveBeenCalledTimes(1);

    (node.querySelector('[data-presentation-reload]') as HTMLButtonElement).click();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(Surface.clearReloadRequiredSurface(root)).toBe(true);
    expect(dom.window.document.getElementById(Surface.SURFACE_ID)).toBeNull();
    dom.window.close();
  });
});
