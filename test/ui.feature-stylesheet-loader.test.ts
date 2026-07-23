import { JSDOM } from 'jsdom';
import {
  discardFeatureStylesheet,
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

  test('discards an in-flight link and lets the next request start fresh', async () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.test/'
    });
    const { document } = dom.window;

    const first = ensureFeatureStylesheet('network', document);
    const firstLink = document.querySelector(
      'link[data-card-reversi-feature-style="network"]'
    ) as HTMLLinkElement;
    expect(discardFeatureStylesheet('network', document)).toBe(true);
    await expect(first).resolves.toEqual(expect.objectContaining({
      ok: false,
      warning: 'discarded stylesheet for network'
    }));
    expect(firstLink.isConnected).toBe(false);

    const retry = ensureFeatureStylesheet('network', document);
    const retryLink = document.querySelector(
      'link[data-card-reversi-feature-style="network"]'
    ) as HTMLLinkElement;
    expect(retryLink).not.toBe(firstLink);
    retryLink.dispatchEvent(new dom.window.Event('load'));
    await expect(retry).resolves.toEqual(expect.objectContaining({ ok: true }));
    dom.window.close();
  });

  test('loads board compatibility CSS at its fixed cascade slot and records readiness', async () => {
    const dom = new JSDOM(`<!doctype html><html><head>
      <link rel="stylesheet" href="styles-stone-shadows.css?v=1">
      <meta data-card-reversi-feature-style-slot="board-dom-compat"
        data-card-reversi-feature-style-href="styles-board-dom-compat.css?v=2468">
      <link rel="stylesheet" href="styles-profile.css?v=2">
    </head><body></body></html>`, { url: 'https://example.test/game/' });
    const { document } = dom.window;

    expect(getFeatureStylesheetHref('board-dom-compat', document)).toBe(
      'https://example.test/game/styles-board-dom-compat.css?v=2468'
    );
    const pending = ensureFeatureStylesheet('board-dom-compat', document);
    const slot = document.querySelector(
      '[data-card-reversi-feature-style-slot="board-dom-compat"]'
    )!;
    const link = document.querySelector(
      'link[data-card-reversi-feature-style="board-dom-compat"]'
    ) as HTMLLinkElement;
    expect(link).toBeTruthy();
    expect(link.nextElementSibling).toBe(slot);
    expect(link.previousElementSibling?.getAttribute('href')).toContain(
      'styles-stone-shadows.css'
    );
    link.dispatchEvent(new dom.window.Event('load'));

    await expect(pending).resolves.toEqual(expect.objectContaining({
      ok: true,
      group: 'board-dom-compat'
    }));
    expect(link.dataset.cardReversiFeatureStyleLoaded).toBe('true');
    expect(Number(link.dataset.cardReversiFeatureStyleReadyAt)).toBeGreaterThanOrEqual(0);
    dom.window.close();
  });

  test('keeps result CSS before characters CSS when Vite creates eager links after the slot', async () => {
    const dom = new JSDOM(`<!doctype html><html><head>
      <meta data-card-reversi-feature-style-slot="result"
        data-card-reversi-feature-style-href="styles-layout-result.css?v=2468"
        data-card-reversi-feature-style-before="styles-layout-characters.css">
      <link rel="stylesheet" href="styles-layout-info.css?v=1">
      <link rel="stylesheet" href="styles-layout-characters.css?v=2">
    </head><body></body></html>`, { url: 'https://example.test/game/' });
    const { document } = dom.window;

    const pending = ensureFeatureStylesheet('result', document);
    const resultLink = document.querySelector(
      'link[data-card-reversi-feature-style="result"]'
    ) as HTMLLinkElement;
    const charactersLink = document.querySelector(
      'link[href*="styles-layout-characters.css"]'
    ) as HTMLLinkElement;

    expect(resultLink).toBeTruthy();
    expect(resultLink.nextElementSibling).toBe(charactersLink);
    expect(resultLink.previousElementSibling?.getAttribute('href')).toContain(
      'styles-layout-info.css'
    );
    resultLink.dispatchEvent(new dom.window.Event('load'));
    await expect(pending).resolves.toEqual(expect.objectContaining({
      ok: true,
      group: 'result'
    }));
    dom.window.close();
  });

  test('keeps profile CSS after stone shadows in classic and Vite head shapes', async () => {
    for (const viteShape of [false, true]) {
      const head = viteShape
        ? `<meta data-card-reversi-feature-style-slot="profile"
            data-card-reversi-feature-style-href="styles-profile.css?v=2468"
            data-card-reversi-feature-style-after="styles-stone-shadows.css">
          <link rel="stylesheet" href="styles-responsive.css?v=1">
          <link rel="stylesheet" href="styles-stone-shadows.css?v=2">`
        : `<link rel="stylesheet" href="styles-stone-shadows.css?v=2">
          <meta data-card-reversi-feature-style-slot="board-dom-compat">
          <meta data-card-reversi-feature-style-slot="profile"
            data-card-reversi-feature-style-href="styles-profile.css?v=2468"
            data-card-reversi-feature-style-after="styles-stone-shadows.css">`;
      const dom = new JSDOM(
        `<!doctype html><html><head>${head}</head><body></body></html>`,
        { url: 'https://example.test/game/' }
      );
      const { document } = dom.window;

      const pending = ensureFeatureStylesheet('profile', document);
      const link = document.querySelector(
        'link[data-card-reversi-feature-style="profile"]'
      ) as HTMLLinkElement;
      const stoneLink = document.querySelector(
        'link[href*="styles-stone-shadows.css"]'
      ) as HTMLLinkElement;
      expect(link).toBeTruthy();
      expect(stoneLink.compareDocumentPosition(link) & 4).toBeTruthy();
      if (!viteShape) {
        const profileSlot = document.querySelector(
          '[data-card-reversi-feature-style-slot="profile"]'
        );
        expect(link.nextElementSibling).toBe(profileSlot);
      }
      link.dispatchEvent(new dom.window.Event('load'));
      await expect(pending).resolves.toEqual(expect.objectContaining({
        ok: true,
        group: 'profile'
      }));
      dom.window.close();
    }
  });
});
