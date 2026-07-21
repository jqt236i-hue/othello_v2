import { JSDOM } from 'jsdom';
import { installOptionalPayloadLoader } from '../browser-vite/optional-payload-loader';

describe('Vite optional payload loader', () => {
  test('retries a failed payload with a distinct URL and deduplicates success', async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'https://example.test/game/index.html'
    });
    const root: any = dom.window;
    const groups: string[] = [];
    root.__CARD_REVERSI_VITE_MODULE_BRIDGE__ = { registeredGroups: () => groups.slice() };
    let attempt = 0;
    const importModule = jest.fn(async (url: string) => {
      attempt += 1;
      if (attempt === 1) throw new Error('chunk network failure');
      expect(url).toContain('cardReversiRetry=2');
      groups.push('gacha');
      return {};
    });
    const loader = installOptionalPayloadLoader({
      root,
      document: root.document,
      importModule,
      payloadUrls: { gacha: 'assets/optional-gacha-hash.mjs' }
    });

    await expect(loader.load('gacha')).rejects.toThrow('chunk network failure');
    await expect(loader.load('gacha')).resolves.toBe(true);
    await expect(loader.load('gacha')).resolves.toBe(true);

    expect(importModule).toHaveBeenCalledTimes(2);
    expect(importModule.mock.calls[0][0]).toBe('https://example.test/game/assets/optional-gacha-hash.mjs');
    expect(loader.getAttemptCount('gacha')).toBe(2);
  });

  test('loads a Vite-only board compatibility payload once', async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'https://example.test/game/index.html'
    });
    const root: any = dom.window;
    const groups = ['startup'];
    root.__CARD_REVERSI_VITE_MODULE_BRIDGE__ = { registeredGroups: () => groups.slice() };
    const importModule = jest.fn(async () => {
      groups.push('compatibility');
      return {};
    });
    const loader = installOptionalPayloadLoader({
      root,
      document: root.document,
      importModule,
      payloadUrls: { compatibility: 'assets/optional-compatibility-hash.mjs' }
    });

    await expect(loader.load('compatibility')).resolves.toBe(true);
    await expect(loader.load('compatibility')).resolves.toBe(true);

    expect(importModule).toHaveBeenCalledTimes(1);
    expect(importModule.mock.calls[0][0]).toBe(
      'https://example.test/game/assets/optional-compatibility-hash.mjs'
    );
    expect(loader.isLoaded('compatibility')).toBe(true);
  });
});
