import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Las pruebas de integracion comparten la base de datos de desarrollo:
    // se ejecutan en serie para que no se pisen entre si.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: { NODE_ENV: 'test' },
  },
});
