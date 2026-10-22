-- Safety net: any table created in public (or private) gets row level security
-- switched on at CREATE time. A forgotten `enable row level security` would
-- otherwise leave the new table readable/writable by anon/authenticated through
-- PostgREST. Tables that really need no policy simply stay locked (RLS on, no
-- policy = no access for API roles); service_role bypasses RLS as before.
create or replace function private.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name in ('public', 'private') and cmd.schema_name is not null then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
      exception when others then
        raise log 'rls_auto_enable: failed for %: %', cmd.object_identity, sqlerrm;
      end;
    end if;
  end loop;
end;
$$;

revoke all on function private.rls_auto_enable() from public, anon, authenticated;

drop event trigger if exists rls_auto_enable;
create event trigger rls_auto_enable
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function private.rls_auto_enable();
