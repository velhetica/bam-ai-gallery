import { defineConfig } from 'vite';

export default defineConfig({
  base: '/bam-ai-gallery/',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
