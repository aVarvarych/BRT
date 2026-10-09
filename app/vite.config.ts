import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { readFileSync } from 'node:fs';

/** Підставляє список зібраних файлів у service worker, щоб застосунок запускався без зв'язку. */
function precacheServiceWorker(): Plugin {
  return {
    name: 'precache-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = ['./', ...Object.keys(bundle).map((f) => `./${f}`), './manifest.webmanifest', './icon.svg'];
      const version = Date.now().toString(36);
      const source = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8')
        .replace('__PRECACHE__', JSON.stringify(files))
        .replace('__VERSION__', version);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: './',
  plugins: [react(), precacheServiceWorker(), ...(command === 'serve' ? [basicSsl()] : [])],
  server: {
    host: true,
    // Як Caddy у продакшні: API на тому самому origin, тому CORS не потрібен.
    proxy: { '/v1': 'http://localhost:3000', '/health': 'http://localhost:3000' },
  },
}));
