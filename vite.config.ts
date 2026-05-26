import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * In dev, rewrite requests for /loader.js to the TS source so demo-host.html
 * can reference a single URL (/loader.js) that works in both modes:
 *   - dev:  Vite serves /src/loader/loader.ts (transformed on the fly)
 *   - prod: Vite builds /loader.js (the loader entry, no hash)
 *
 * Without this, the deployed dist/demo-host.html would reference a dev-only
 * source path that 404s on Vercel and the launcher never renders.
 */
function loaderDevAlias(): Plugin {
  return {
    name: 'famaash-loader-dev-alias',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/loader.js' || req.url?.startsWith('/loader.js?')) {
          req.url = '/src/loader/loader.ts';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), loaderDevAlias()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/widget'),
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        loader: resolve(__dirname, 'src/loader/loader.ts'),
        widget: resolve(__dirname, 'embed.html'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'loader' ? 'loader.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  server: {
    port: 5173,
    open: '/demo-host.html',
  },
});
