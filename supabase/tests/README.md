# Session revocation regression test

Apply `20260906032206_require_live_auth_sessions.sql`, then execute
`live-auth-sessions.sql` as the database's `postgres` role. For example, with
an already configured PostgreSQL connection:

```sh
psql -v ON_ERROR_STOP=1 -f supabase/tests/live-auth-sessions.sql
```

The test creates random fixture identities and sessions inside a transaction.
It checks live, expired, missing, malformed, mismatched, and revoked sessions;
switches to `authenticated` to verify actual staff-row RLS; and verifies the
restrictive policies on all four client-readable tables and private storage.
It ends with `ROLLBACK`, so no fixtures remain. It sends no messages.

The corresponding application tests exercise Bearer and cookie requests,
device revocation, exact email matching, push-provider URL validation, and
delivery filtering for unsafe subscriptions saved before the fix:

```sh
npx vitest run lib/server-auth.test.ts app/api/account/sessions/route.test.ts lib/push-endpoint.test.ts lib/push-notifications.test.ts app/api/push/subscribe/route.test.ts
```

API authentication depends on the existing service-only `list_user_sessions`
RPC. The session lookup is deliberately uncached so revocation applies on
the next request. A database error prevents authorization.

The SQL migration protects direct Data API and private Storage access.
Deploy the updated Next.js application as well to activate the API and
push-subscription fixes. Public avatar URLs remain public by design.
