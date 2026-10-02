import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    // One bundled .d.ts for the package; core/ is JSDoc-typed JS (allowJs)
    dts({ tsconfigPath: './tsconfig.app.json', include: ['src', 'core'], exclude: ['src/demo.tsx', 'core/__checks__'], rollupTypes: true }),
  ],
  build: {
    // public/ holds the standalone page's tracks and images; keep them out of the package
    copyPublicDir: false,
    lib: {
      entry: 'src/index.ts',
      name: 'DreamDeskPlayer',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      // Peers come from the host app, so it ends up with one copy of each
      external: ['react', 'react-dom', 'react/jsx-runtime', 'dreamdesk-ui', /^dreamdesk-ui\//],
    },
  },
});
