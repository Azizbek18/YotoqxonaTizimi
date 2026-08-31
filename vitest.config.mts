import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

// Mirrors tsconfig's "@/*" path alias, plus a stub for the "server-only"
// import guard (a real npm package doesn't exist for it — Next.js aliases it
// internally during its own build, which vitest doesn't do on its own).
export default defineConfig({
  resolve: {
    alias: {
      '@': import.meta.dirname,
      'server-only': path.resolve(
        import.meta.dirname,
        'test/stubs/server-only.ts',
      ),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      include: [
        'app/api/**/*.ts',
        'features/**/*.ts',
        'lib/**/*.ts',
        'server/**/*.ts',
        'proxy.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.mjs',
        'lib/fonts/tinos-data.ts',
        'types/**',
      ],
      thresholds: {
        statements: 15,
        branches: 15,
        functions: 15,
        lines: 15,
      },
    },
  },
})
