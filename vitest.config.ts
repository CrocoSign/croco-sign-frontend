import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      setupFiles: ['./vitest.setup.ts'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      coverage: {
        provider: 'v8',
        reportOnFailure: true,
        reportsDirectory: './coverage',
        reporter: ['text', 'json-summary', 'json', 'html'],
        include: ['src/**/*.{ts,vue}'],
        exclude: [
          'src/**/*.spec.ts',
          'src/main.ts',
          'src/**/*.d.ts',
          'src/stores/counter.ts', // unused Vite scaffold default
        ],
        thresholds: {
          statements: 80,
          functions: 80,
          lines: 80,
          branches: 75,
        },
      },
    },
  }),
)
