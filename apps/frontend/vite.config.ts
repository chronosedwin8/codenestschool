import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  // El juego y el portal viven en /app; la raiz es el sitio publico.
  base: '/app/',
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Los trabajadores web se compilan como modulos ES, igual que el resto.
  worker: { format: 'es' },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: {
    // Las librerias grandes van en su propio fragmento y se cargan solo cuando
    // hacen falta: un nino de cuatro anos no debe descargar Blockly ni Monaco.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          if (id.includes('node_modules/blockly')) return 'blockly';
          if (id.includes('node_modules/monaco-editor')) return 'monaco';
          if (id.includes('node_modules/howler')) return 'audio';
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
  optimizeDeps: { exclude: ['monaco-editor'] },
});
