import { JSDOM } from 'jsdom';

describe('transient overlay batch', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('appends one shared phase root to body and clears it on cleanup', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;

    const { createTransientOverlayBatch } = require('../ui/transient-overlay-batch.js');
    const batch = createTransientOverlayBatch({ documentRef: document });
    const first = batch.getRoot({ className: 'phase-fx-root', zIndex: 1250 });
    const second = batch.getRoot({ className: 'phase-fx-root', zIndex: 1250 });

    expect(first).toBe(second);
    expect(document.body.children).toHaveLength(1);

    const child = document.createElement('div');
    batch.append(child);
    expect(first.children).toHaveLength(1);

    batch.cleanup();
    expect(document.body.children).toHaveLength(0);

    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });
});
