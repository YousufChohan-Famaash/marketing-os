import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
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
