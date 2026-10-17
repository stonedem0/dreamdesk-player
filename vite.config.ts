/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    // One bundled .d.ts for the package; core/ is JSDoc-typed JS (allowJs)
    dts({ tsconfigPath: './tsconfig.app.json', include: ['src', 'core'], exclude: ['src/demo.tsx', 'core/__checks__', '**/__tests__/**'], bundleTypes: true }),
  ],
  test: {
    environment: 'happy-dom',
    setupFiles: ['src/__tests__/setup.ts'],
    include: ['core/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['core/**', 'src/**'],
      exclude: ['**/__tests__/**', 'core/__checks__/**', 'src/demo.tsx', 'src/vite-env.d.ts', 'src/img/**'],
      reporter: ['text', 'html'],
    },
  },
  build: {
    // public/ holds the standalone page's tracks and images; keep them out of the package
    copyPublicDir: false,
    lib: {
      entry: 'src/index.ts',
      name: 'DreamDeskPlayer',
      formats: ['es'],
      fileName: 'index',
      // The ./css export: Vite 6+ would name it index.css
      cssFileName: 'style',
    },
    rollupOptions: {
      // Peers come from the host app, so it ends up with one copy of each
      external: ['react', 'react-dom', 'react/jsx-runtime', '@dreamdesk/ui', /^@dreamdesk\/ui\//],
    },
  },
});
