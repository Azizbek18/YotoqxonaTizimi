import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Mirrors tsconfig's "@/*" path alias, plus a stub for the "server-only"
// import guard (a real npm package doesn't exist for it — Next.js aliases it
// internally during its own build, which vitest doesn't do on its own).
export default defineConfig({
  resolve: {
    alias: {
      '@': __dirname,
      'server-only': path.resolve(__dirname, 'test/stubs/server-only.ts'),
    },
  },
})
