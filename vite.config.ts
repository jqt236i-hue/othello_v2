import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from 'vite';

function writeTextIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === content) return;
  fs.writeFileSync(filePath, content, 'utf8');
}

export default defineConfig(({ command }) => ({
  root: __dirname,
  base: './',
  publicDir: false,
  // The full-rule graph includes legacy dual ESM/CommonJS modules. Use the
  // canonical CJS output emitted by build:ts, as the main Vite bridge does,
  // instead of resolving adjacent compatibility shims in a native Worker.
  worker: { plugins: () => [{
    name: 'card-reversi-lv10-canonical-runtime',
    enforce: 'pre' as const,
    resolveId(source: string, importer: string | undefined) {
      if (source === '../../game/ai/cpu-lv10-search'
        && importer?.replace(/\\/g, '/').endsWith('/cpu-worker/lv10-worker-entry.ts')) {
        return path.resolve(__dirname, 'dist/game/ai/cpu-lv10-search.js');
      }
      return null;
    }
  }] },
  plugins: [{
    name: 'card-reversi-vite-document-base',
    configureServer(server) {
      if (command !== 'serve') return;
      server.middlewares.use((request, _response, next) => {
        const rawUrl = String(request.url || '/');
        const queryIndex = rawUrl.indexOf('?');
        const pathname = queryIndex >= 0 ? rawUrl.slice(0, queryIndex) : rawUrl;
        const search = queryIndex >= 0 ? rawUrl.slice(queryIndex) : '';
        if (pathname === '/' || pathname === '/index.html') {
          request.url = `/index.vite.html${search}`;
        }
        next();
      });
    },
    closeBundle() {
      if (command !== 'build') return;

      const documentPath = path.resolve(__dirname, 'vite-dist', 'index.vite.html');
      if (!fs.existsSync(documentPath)) {
        throw new Error('Vite output is missing index.vite.html');
      }

      const source = fs.readFileSync(documentPath, 'utf8')
        .replace('<base href="./">', '<base href="../">')
        .replace(/(["'])\.\/assets\//g, '$1./vite-dist/assets/');
      writeTextIfChanged(documentPath, source);
      writeTextIfChanged(path.resolve(__dirname, 'index.html'), source);

      // The staged CommonJS inputs are only needed while Rolldown resolves the
      // generated startup entry. Removing them keeps later classic builds
      // deterministic and avoids shipping build-only source copies.
      fs.rmSync(path.resolve(__dirname, 'dist', 'browser-vite-bridge-src'), {
        recursive: true,
        force: true
      });
    }
  }],
  define: {
    __CARD_REVERSI_CLASSIC_ROOT__: JSON.stringify('./')
  },
  server: {
    host: '127.0.0.1'
  },
  build: {
    target: 'es2020',
    outDir: path.resolve(__dirname, 'vite-dist'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    manifest: true,
    rollupOptions: {
      input: {
        'index.vite': path.resolve(__dirname, 'index.vite.html'),
        'cpu-worker-diagnostics': path.resolve(
          __dirname,
          'browser-vite/cpu-worker/diagnostics.ts'
        )
      },
      preserveEntrySignatures: 'strict',
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
}));
