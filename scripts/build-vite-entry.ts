import * as fs from 'fs';
import * as path from 'path';

const CLASSIC_SCRIPT_ORDER = Object.freeze([
  'public/runtime.js',
  'public/module-registry.js',
  'ui/layout-stage.js',
  'entry-browser.js'
]);

interface GenerateViteEntryOptions {
  rootDir?: string;
  write?: boolean;
}

interface GenerateViteEntryResult {
  sourcePath: string;
  outputPath: string;
  content: string;
  scriptSources: string[];
  styleSources: string[];
  wroteFile: boolean;
}

function normalizeNewlines(value: string): string {
  return String(value || '').replace(/\r\n?/g, '\n');
}

function scriptBasePath(value: string): string {
  return String(value || '').split('?')[0];
}

function renderStyleBootstrap(): string {
  return `    <script data-card-reversi-classic-style-bootstrap>
        (() => {
            const metas = Array.from(document.querySelectorAll('meta[name="card-reversi-classic-style"]'));
            const loads = metas.map((meta) => new Promise((resolve, reject) => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.setAttribute('data-card-reversi-classic-style', meta.content);
                link.onload = () => resolve(meta.content);
                link.onerror = () => reject(new Error('failed to load classic stylesheet: ' + meta.content));
                link.href = new URL(meta.content, document.baseURI).href;
                document.head.appendChild(link);
            }));
            const ready = Promise.all(loads);
            ready.catch(() => {});
            window.__CARD_REVERSI_CLASSIC_STYLES_READY__ = ready;
        })();
    </script>`;
}

function renderViteEntry(classicHtml: string): { content: string; scriptSources: string[]; styleSources: string[] } {
  const normalized = normalizeNewlines(classicHtml);
  const markerIndex = normalized.lastIndexOf('<!-- Scripts -->');
  const bodyCloseIndex = normalized.lastIndexOf('</body>');
  if (markerIndex < 0 || bodyCloseIndex <= markerIndex) {
    throw new Error('index.html is missing its final Scripts block');
  }

  const scriptsBlock = normalized.slice(markerIndex, bodyCloseIndex);
  const scriptSources = Array.from(scriptsBlock.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g))
    .map((match) => match[1]);
  const actualOrder = scriptSources.map(scriptBasePath);
  if (JSON.stringify(actualOrder) !== JSON.stringify(CLASSIC_SCRIPT_ORDER)) {
    throw new Error(`unexpected classic script order: ${actualOrder.join(', ')}`);
  }

  const styleSources = Array.from(normalized.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*>/g))
    .map((match) => match[1]);
  if (!styleSources.length) {
    throw new Error('index.html does not declare any classic stylesheets');
  }

  const metaTags = scriptSources.map((source, index) => (
    `    <meta name="card-reversi-classic-${['runtime', 'registry', 'layout', 'entry'][index]}" content="${source}">`
  )).join('\n');
  const styleMetaTags = styleSources.map((source) => (
    `    <meta name="card-reversi-classic-style" content="${source}">`
  )).join('\n');
  let content = normalized.replace(/^[ \t]*<link\s+rel="stylesheet"\s+href="[^"]+"\s*>[ \t]*(?:\n|$)/gm, '');
  content = content.replace(/<link\s+rel="stylesheet"\s+href="[^"]+"\s*>/g, '');
  content = content.replace(
    '</head>',
    `    <base href="./">\n${styleMetaTags}\n${renderStyleBootstrap()}\n${metaTags}\n    <meta name="card-reversi-browser-lane" content="vite">\n</head>`
  );
  content = content.replace('<html lang="ja">', '<html lang="ja" data-browser-lane="vite">');
  const refreshedMarkerIndex = content.lastIndexOf('<!-- Scripts -->');
  const refreshedBodyCloseIndex = content.lastIndexOf('</body>');
  content = `${content.slice(0, refreshedMarkerIndex)}<!-- Vite comparison lane entry; generated from index.html -->\n    <script type="module" src="/browser-vite/main.ts"></script>\n${content.slice(refreshedBodyCloseIndex)}`;
  return { content, scriptSources, styleSources };
}

function generateViteEntry(options: GenerateViteEntryOptions = {}): GenerateViteEntryResult {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const sourcePath = path.join(rootDir, 'index.html');
  const outputPath = path.join(rootDir, 'index.vite.html');
  const rendered = renderViteEntry(fs.readFileSync(sourcePath, 'utf8'));
  let wroteFile = false;
  if (options.write !== false) {
    const current = fs.existsSync(outputPath) ? normalizeNewlines(fs.readFileSync(outputPath, 'utf8')) : '';
    if (current !== rendered.content) {
      fs.writeFileSync(outputPath, rendered.content, 'utf8');
      wroteFile = true;
    }
  }
  return {
    sourcePath,
    outputPath,
    content: rendered.content,
    scriptSources: rendered.scriptSources,
    styleSources: rendered.styleSources,
    wroteFile
  };
}

if (require.main === module) {
  try {
    const checkOnly = process.argv.includes('--check');
    const result = generateViteEntry({ write: !checkOnly });
    if (checkOnly) {
      const current = fs.existsSync(result.outputPath)
        ? normalizeNewlines(fs.readFileSync(result.outputPath, 'utf8'))
        : '';
      if (current !== result.content) {
        throw new Error('index.vite.html is stale; run npm run generate:vite-entry');
      }
    }
    console.log(`[vite-entry] ${checkOnly ? 'verified' : (result.wroteFile ? 'wrote' : 'unchanged')} ${result.outputPath}`);
  } catch (error) {
    console.error(`[vite-entry] failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

export = {
  CLASSIC_SCRIPT_ORDER,
  generateViteEntry,
  renderViteEntry
};
