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
    // `.vercel/` holds CLI metadata and, when the Vercel CLI is used locally,
    // detached worktrees of this same repo. Their stale copies of our e2e specs
    // would otherwise be collected here and fail (Playwright's `test()` cannot
    // run under vitest).
    exclude: [...configDefaults.exclude, 'e2e/**', '.vercel/**'],
    // The service-layer suites drive long mocked Supabase call chains; under
    // v8 coverage instrumentation on CI runners a few of them creep past the
    // 5s default and time out (14 flaky failures in `npm run test:coverage`,
    // green without `--coverage`). Give every test/hook real headroom.
    testTimeout: 20_000,
    hookTimeout: 20_000,
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
      // Raised from a 15% floor in three passes: (1) server/auth/* (guards,
      // faculty, council, sardor, tarbiyachi), lib/server-auth.ts +
      // server-supabase.ts + server-admin.ts, and the payments/attendance/
      // permit-cancel/room-assignment routes; (2) the remaining 0%-coverage
      // critical routes (attendance close/flags/history/roster/session,
      // student applications + foreign-docs, staff arizalar, admin dorms +
      // sections, room-floors freeze/gender/capacity, every AI route); (3)
      // admin/dorms/room-grants, dekan dorm/settings/geocode, attendance
      // summary, room-floors generate, ariza-signature verify, student
      // profile(+update)/geocode, staff telegram-chat, and a much deeper
      // admin/users pass (401/403/400/404/409/500 across GET/PATCH/DELETE).
      // Actual coverage after that pass was ~51-59%; these sit a few points
      // under it so a routine refactor doesn't immediately redden CI.
      thresholds: {
        statements: 54,
        branches: 50,
        functions: 49,
        lines: 57,
      },
    },
  },
})
