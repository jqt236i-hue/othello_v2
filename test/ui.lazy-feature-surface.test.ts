import { JSDOM } from 'jsdom';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('lazy feature surface', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('joins concurrent preparation and retains the ready DOM for reopen', async () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.test/?debug=1&uxMonitor=1'
    });
    const stylesheetReady = deferred<Record<string, unknown>>();
    const ensureFeatureStylesheet = jest.fn(() => stylesheetReady.promise);
    jest.doMock('../ui/assets/feature-stylesheet-loader', () => ({
      ensureFeatureStylesheet,
      discardFeatureStylesheet: jest.fn()
    }));
    const surface = require('../ui/assets/lazy-feature-surface.ts');
    const node = dom.window.document.createElement('section');
    const ensureDom = jest.fn((context: any) => {
      dom.window.document.body.appendChild(node);
      context.recordDomCreated();
      context.recordListenerBinding(2);
      context.addCleanup(() => node.remove());
      return node;
    });
    surface.registerLazyFeatureSurface({
      id: 'profile',
      stylesheetGroup: 'network',
      ensureDom
    });

    const first = surface.ensureLazyFeatureSurface('profile', dom.window.document);
    const concurrent = surface.ensureLazyFeatureSurface('profile', dom.window.document);
    expect(first).toBe(concurrent);
    expect(ensureFeatureStylesheet).toHaveBeenCalledTimes(1);
    expect(ensureDom).toHaveBeenCalledTimes(1);
    stylesheetReady.resolve({ ok: true, group: 'network', href: 'network.css' });

    const ready = await first;
    const reopened = await surface.ensureLazyFeatureSurface(
      'profile',
      dom.window.document
    );
    expect(reopened).toBe(ready);
    expect(reopened.dom).toBe(node);
    expect(ensureDom).toHaveBeenCalledTimes(1);
    expect(surface.getLazyFeatureSurfaceDiagnostics(
      'profile',
      dom.window.document
    )).toMatchObject({
      status: 'ready',
      ensureCount: 3,
      attemptCount: 1,
      concurrentJoinCount: 1,
      retryCount: 0,
      stylesheetEnsureCount: 1,
      domEnsureCount: 1,
      domCreatedCount: 1,
      listenerBindingCount: 2,
      readyCount: 1,
      failureCount: 0
    });
    dom.window.close();
  });

  test('treats ok false as failure, cleans partial work, and retries', async () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.test/?debug=1&uxMonitor=1'
    });
    const ensureFeatureStylesheet = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        group: 'network',
        href: 'network.css',
        warning: 'injected style failure'
      })
      .mockResolvedValueOnce({
        ok: true,
        group: 'network',
        href: 'network.css'
      });
    const discardFeatureStylesheet = jest.fn();
    jest.doMock('../ui/assets/feature-stylesheet-loader', () => ({
      ensureFeatureStylesheet,
      discardFeatureStylesheet
    }));
    const surface = require('../ui/assets/lazy-feature-surface.ts');
    const failures: string[] = [];
    const nodes: HTMLElement[] = [];
    const blockedDom = deferred<HTMLElement>();
    let ensureDomCount = 0;
    surface.registerLazyFeatureSurface({
      id: 'network',
      stylesheetGroup: 'network',
      ensureDom(context: any) {
        ensureDomCount += 1;
        const node = dom.window.document.createElement('section');
        nodes.push(node);
        dom.window.document.body.appendChild(node);
        context.recordDomCreated();
        context.addCleanup(() => node.remove());
        return ensureDomCount === 1 ? blockedDom.promise : node;
      },
      onFailure(error: Error) {
        failures.push(error.message);
      }
    });

    await expect(surface.ensureLazyFeatureSurface(
      'network',
      dom.window.document
    )).rejects.toThrow('injected style failure');
    expect(nodes[0].isConnected).toBe(false);
    expect(discardFeatureStylesheet).toHaveBeenCalledWith(
      'network',
      dom.window.document
    );
    expect(blockedDom.promise).toBeInstanceOf(Promise);

    await expect(surface.ensureLazyFeatureSurface(
      'network',
      dom.window.document
    )).resolves.toMatchObject({ attempt: 2 });
    expect(nodes[1].isConnected).toBe(true);
    expect(failures).toEqual(['injected style failure']);
    expect(surface.getLazyFeatureSurfaceDiagnostics(
      'network',
      dom.window.document
    )).toMatchObject({
      status: 'ready',
      ensureCount: 2,
      attemptCount: 2,
      retryCount: 1,
      cleanupCount: 1,
      readyCount: 1,
      failureCount: 1
    });
    dom.window.close();
  });

  test('aborts and cleans the stylesheet when DOM preparation fails', async () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.test/?debug=1&uxMonitor=1'
    });
    const discardFeatureStylesheet = jest.fn();
    jest.doMock('../ui/assets/feature-stylesheet-loader', () => ({
      ensureFeatureStylesheet: jest.fn(async () => ({
        ok: true,
        group: 'deck-builder',
        href: 'deck.css'
      })),
      discardFeatureStylesheet
    }));
    const surface = require('../ui/assets/lazy-feature-surface.ts');
    let observedSignal: AbortSignal | null = null;
    surface.registerLazyFeatureSurface({
      id: 'deck-builder',
      stylesheetGroup: 'deck-builder',
      ensureDom(context: any) {
        observedSignal = context.signal;
        context.addCleanup(() => undefined);
        throw new Error('dom factory failed');
      }
    });

    await expect(surface.ensureLazyFeatureSurface(
      'deck-builder',
      dom.window.document
    )).rejects.toThrow('dom factory failed');
    expect(observedSignal?.aborted).toBe(true);
    expect(discardFeatureStylesheet).toHaveBeenCalledTimes(1);
    dom.window.close();
  });

  test('does not allocate or expose diagnostics in normal play', async () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.test/'
    });
    jest.doMock('../ui/assets/feature-stylesheet-loader', () => ({
      ensureFeatureStylesheet: jest.fn(),
      discardFeatureStylesheet: jest.fn()
    }));
    const surface = require('../ui/assets/lazy-feature-surface.ts');
    surface.registerLazyFeatureSurface({
      id: 'result',
      ensureDom: () => ({ critical: true })
    });

    await surface.ensureLazyFeatureSurface('result', dom.window.document);
    expect(surface.getLazyFeatureSurfaceDiagnostics(
      'result',
      dom.window.document
    )).toBeNull();
    dom.window.close();
  });
});
