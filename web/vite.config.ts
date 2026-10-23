import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  base: './',
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { port: 5310 },
});
