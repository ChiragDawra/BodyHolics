-- docs/05 §9 — scheduled jobs. Skipped entirely when pg_cron is not installed
-- (see 20260826090000_init_extensions.sql), so a plain Postgres still resets.
--
-- cron.schedule replaces a job of the same name, which keeps this migration
-- re-runnable against a database that already has the jobs.

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise warning 'pg_cron not installed: skipping scheduled jobs';
    return;
  end if;

  -- An ACTIVE membership past its end_at is EXPIRED. Hourly is enough: expiry is
  -- read through v_current_memberships, which already filters on end_at > now(),
  -- so the status column is a reporting convenience, not the source of truth.
  perform cron.schedule('expire-memberships', '5 * * * *', $job$
    update public.memberships set status = 'EXPIRED'
    where status = 'ACTIVE' and end_at < now();
  $job$);

  perform cron.schedule('publish-scheduled-broadcasts', '* * * * *', $job$
    select public.publish_due_broadcasts();
  $job$);

  perform cron.schedule('cleanup-stale-pending', '0 * * * *', $job$
    update public.payments set status = 'CANCELLED'
    where status = 'PENDING' and created_at < now() - interval '24 hours';
    update public.memberships set status = 'CANCELLED', cancelled_at = now()
    where status = 'PENDING_PAYMENT' and created_at < now() - interval '24 hours';
  $job$);

  perform cron.schedule('purge-used-qr-tokens', '0 3 * * *', $job$
    delete from public.member_qr_tokens where expires_at < now() - interval '7 days';
  $job$);

  perform cron.schedule('auto-close-resolved-issues', '0 4 * * *', $job$
    update public.issues set status = 'CLOSED'
    where status = 'RESOLVED' and resolved_at < now() - interval '7 days';
  $job$);

  perform cron.schedule('crowd-snapshot', '*/10 * * * *', $job$
    insert into public.crowd_snapshots (gym_id, level, confidence, source_type, metadata)
    select g.id, c.level, c.confidence, 'QR', jsonb_build_object('sample_size', c.sample_size)
    from public.gyms g, lateral public.crowd_level(g.id) c
    where g.is_active;
  $job$);
end $$;
