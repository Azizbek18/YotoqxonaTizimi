-- Defense in depth for the PostgREST roles.
--  * anon has no permissive policy on any public table (RLS already denies it),
--    so it keeps no table privileges at all.
--  * authenticated keeps SELECT/INSERT/UPDATE/DELETE (RLS governs them) but loses
--    TRUNCATE / TRIGGER / REFERENCES: those bypass RLS and PostgREST never uses them.
-- service_role (the server) is untouched.
revoke all on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;
