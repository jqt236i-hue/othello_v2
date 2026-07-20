import { JSDOM } from 'jsdom';
import {
  ensureFeatureStylesheet,
  getFeatureStylesheetHref
} from '../ui/assets/feature-stylesheet-loader';

describe('feature stylesheet loader', () => {
  test('creates no links before ensure and deduplicates concurrent and successful requests', async () => {
    const dom = new JSDOM(`<!doctype html><html><head>
      <script src="public/module-registry.js?v=12345"></script>
    </head><body></body></html>`, { url: 'https://example.test/game/' });
    const { document } = dom.window;

    expect(document.querySelectorAll('link[data-card-reversi-feature-style]')).toHaveLength(0);
    const first = ensureFeatureStylesheet('deck-builder', document);
    const second = ensureFeatureStylesheet('deck-builder', document);
    const links = document.querySelectorAll('link[data-card-reversi-feature-style="deck-builder"]');
    expect(first).toBe(second);
    expect(links).toHaveLength(1);
    expect((links[0] as HTMLLinkElement).href).toBe(
      'https://example.test/game/styles-feature-deck-builder.css?v=12345'
    );

    links[0].dispatchEvent(new dom.window.Event('load'));
    await expect(first).resolves.toEqual(expect.objectContaining({ ok: true, group: 'deck-builder' }));
    await expect(ensureFeatureStylesheet('deck-builder', document)).resolves.toEqual(
      expect.objectContaining({ ok: true })
    );
    expect(document.querySelectorAll('link[data-card-reversi-feature-style="deck-builder"]')).toHaveLength(1);
    dom.window.close();
  });

  test('removes failed links and creates a fresh link when retried', async () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.test/'
    });
    const { document } = dom.window;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const failed = ensureFeatureStylesheet('gacha', document);
    const firstLink = document.querySelector('link[data-card-reversi-feature-style="gacha"]')!;
    firstLink.dispatchEvent(new dom.window.Event('error'));
    await expect(failed).resolves.toEqual(expect.objectContaining({ ok: false, warning: expect.any(String) }));
    expect(firstLink.isConnected).toBe(false);

    const retry = ensureFeatureStylesheet('gacha', document);
    const secondLink = document.querySelector('link[data-card-reversi-feature-style="gacha"]')!;
    expect(secondLink).not.toBe(firstLink);
    expect(document.querySelectorAll('link[data-card-reversi-feature-style="gacha"]')).toHaveLength(1);
    secondLink.dispatchEvent(new dom.window.Event('load'));
    await expect(retry).resolves.toEqual(expect.objectContaining({ ok: true }));

    warn.mockRestore();
    dom.window.close();
  });

  test('uses the Vite startup-version metadata when the classic registry script is absent', () => {
    const dom = new JSDOM(`<!doctype html><html><head>
      <base href="../">
      <meta name="card-reversi-startup-version" content="98765">
    </head><body></body></html>`, { url: 'https://example.test/vite-dist/index.vite.html' });

    expect(getFeatureStylesheetHref('network', dom.window.document)).toBe(
      'https://example.test/styles-feature-network.css?v=98765'
    );
    dom.window.close();
  });
});
