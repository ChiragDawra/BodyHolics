-- CLAUDE.md rule 5: RLS is enabled on every table in public. A new table without
-- a policy is a bug, not a TODO. This test fails the moment someone adds a table
-- and forgets, which is the only reliable way to keep that rule true.

begin;
select plan(3);

select is_empty(
  $$ select c.relname::text
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every table in public has row level security enabled'
);

-- Two tables are deliberately policy-free: RLS is on and nothing is granted, so
-- only the service key reaches them. A readable member_qr_tokens would let a
-- scanner replay someone else's counter payment; a readable rate_limits would
-- show which member has been attempting what, and how often.
--
-- Every *other* table must have a policy, or it is silently unreachable rather
-- than deliberately locked — which looks identical until a feature does not work.
select is_empty(
  $$ select c.relname::text
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname not in ('member_qr_tokens', 'rate_limits')
       and not exists (select 1 from pg_policy p where p.polrelid = c.oid) $$,
  'every table in public except the service-role-only ones has a policy'
);

-- A security definer view bypasses RLS entirely. Every view reachable through the
-- Data API must opt back in.
select is_empty(
  $$ select c.relname::text
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v'
       and coalesce((
         select option_value from pg_options_to_table(c.reloptions)
         where option_name = 'security_invoker'
       ), 'false') <> 'true' $$,
  'every view in public sets security_invoker = true'
);

select * from finish();
rollback;
