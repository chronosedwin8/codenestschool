import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // En Node, Phaser resuelve a su código fuente, que arrastra una
      // dependencia de depuración que no está instalada. El navegador carga el
      // paquete ya compilado, así que las pruebas cargan ese mismo: se prueba
      // lo que se envía, no otra copia.
      phaser: 'phaser/dist/phaser.js',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
