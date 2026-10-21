import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      TZ: 'Asia/Hong_Kong',
      LOG_LEVEL: 'silent',
    },
  },
});
