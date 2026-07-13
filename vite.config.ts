import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  root: __dirname,
  base: './',
  publicDir: false,
  plugins: [{
    name: 'card-reversi-vite-document-base',
    closeBundle() {
      if (command !== 'build') return;

      const documentPath = path.resolve(__dirname, 'vite-dist', 'index.vite.html');
      if (!fs.existsSync(documentPath)) {
        throw new Error('Vite output is missing index.vite.html');
      }

      const source = fs.readFileSync(documentPath, 'utf8')
        .replace('<base href="./">', '<base href="../">')
        .replace(/(["'])\.\/assets\//g, '$1./vite-dist/assets/');
      fs.writeFileSync(documentPath, source, 'utf8');
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
