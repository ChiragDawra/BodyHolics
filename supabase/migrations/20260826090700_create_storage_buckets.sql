-- docs/05 §11 — three buckets, each with a size cap and a MIME allowlist set on
-- the bucket itself, so a client that skips the app's own checks still cannot
-- store a 40 MB file or an executable.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',           'avatars',           false, 2097152, array['image/jpeg','image/png','image/webp']),
  ('issue-attachments', 'issue-attachments', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('gym-assets',        'gym-assets',        true,  1048576, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies mirror the table policies: the first path segment is the
-- tenancy key, and it is checked on every verb rather than only on insert.

-- avatars/{user_id}/{uuid}.webp
create policy avatars_read_own on storage.objects
for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_write_own on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_update_own on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_delete_own on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- issue-attachments/{gym_id}/{issue_id}/{uuid}.webp
-- A member may only attach to an issue they raised; staff see everything at
-- their own gym. The issue id in the path is checked against the issues table,
-- not trusted, so a member cannot write into another member's thread.
create policy issue_attachments_read on storage.objects
for select to authenticated
using (
  bucket_id = 'issue-attachments'
  and exists (
    select 1 from public.issues i
    where i.id::text     = (storage.foldername(name))[2]
      and i.gym_id::text = (storage.foldername(name))[1]
      and (i.user_id = (select auth.uid()) or public.is_gym_staff(i.gym_id))
  )
);

create policy issue_attachments_write on storage.objects
for insert to authenticated
with check (
  bucket_id = 'issue-attachments'
  and exists (
    select 1 from public.issues i
    where i.id::text     = (storage.foldername(name))[2]
      and i.gym_id::text = (storage.foldername(name))[1]
      and (i.user_id = (select auth.uid()) or public.is_gym_staff(i.gym_id))
  )
);

-- gym-assets/{gym_id}/logo.webp — public bucket, so reads need no policy.
-- The gym id is matched as text against the gyms table rather than cast to uuid:
-- a cast of a non-uuid path segment raises inside the policy instead of simply
-- denying, which turns a malformed upload path into an error rather than a 403.
create policy gym_assets_write_staff on storage.objects
for insert to authenticated
with check (
  bucket_id = 'gym-assets'
  and exists (
    select 1 from public.gyms g
    where g.id::text = (storage.foldername(name))[1] and public.is_gym_staff(g.id)
  )
);

create policy gym_assets_update_staff on storage.objects
for update to authenticated
using (
  bucket_id = 'gym-assets'
  and exists (
    select 1 from public.gyms g
    where g.id::text = (storage.foldername(name))[1] and public.is_gym_staff(g.id)
  )
)
with check (
  bucket_id = 'gym-assets'
  and exists (
    select 1 from public.gyms g
    where g.id::text = (storage.foldername(name))[1] and public.is_gym_staff(g.id)
  )
);

create policy gym_assets_delete_staff on storage.objects
for delete to authenticated
using (
  bucket_id = 'gym-assets'
  and exists (
    select 1 from public.gyms g
    where g.id::text = (storage.foldername(name))[1] and public.is_gym_staff(g.id)
  )
);
