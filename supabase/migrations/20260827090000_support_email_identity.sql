-- Lets a profile be identified by a verified email as well as a verified phone.
--
-- Why: docs/04 §3 specifies phone OTP only, and that remains the intent for
-- launch. But Indian SMS needs DLT registration against the *gym owner's*
-- business documents, which cannot be obtained before the owner has seen a
-- demo. Google sign-in unblocks the demo without weakening anything, because
-- the property that actually matters is unchanged:
--
--   the identity comes from a verified claim on the JWT, never from a request
--   body. Only the provider differs.
--
-- Recorded as D-021.
--
-- What has NOT changed: a profile still needs at least one verified identity,
-- the phone still has to be E.164 when present, and both stay unique.

alter table public.profiles
  add column email text;

-- Cheap syntactic check only. Deliverability is the identity provider's problem
-- and a regex that tries to be RFC 5322 rejects real addresses.
alter table public.profiles
  add constraint email_shape check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- Case-insensitive uniqueness: Google returns the address as the user typed it,
-- so a plain unique index would let Asha@x.com and asha@x.com become two
-- members with two memberships.
create unique index profiles_email_lower_idx on public.profiles (lower(email));

-- Phone becomes optional, because a Google user has none.
alter table public.profiles
  alter column phone drop not null;

-- ...but a profile with neither identity is an unreachable, unidentifiable
-- member, so at least one is still required. This is the constraint that keeps
-- `phone drop not null` from being a quiet loosening of the model.
alter table public.profiles
  add constraint profile_has_identity check (phone is not null or email is not null);

comment on column public.profiles.email is
  'Verified email from the identity provider, mirrored from auth.users at signup. '
  'Never accepted from a request body. Null when the member signed up by phone.';

comment on column public.profiles.phone is
  'Verified E.164 phone, mirrored from auth.users at signup. Never accepted from '
  'a request body. Null when the member signed up with an email provider.';

-- ---------------------------------------------------------------- grants
-- New column, same rule as the rest of the table: RLS decides the rows, the
-- grant decides the verbs, and neither is inherited (D-016). The existing
-- table-level grant on profiles already covers a new column, so nothing further
-- is needed here — stated rather than assumed, because a missing grant is
-- invisible until a feature silently returns nothing.
