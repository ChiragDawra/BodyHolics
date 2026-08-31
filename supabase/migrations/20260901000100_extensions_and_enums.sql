-- Extensions and shared enum types.
-- Everything downstream depends on this running first.

create extension if not exists pgcrypto with schema extensions;

-- How busy the gym is right now. Ordered least to most crowded.
create type public.crowd_level as enum (
  'not_crowded',
  'moderate',
  'crowded',
  'very_crowded'
);

-- How an attendance row was recorded. 'qr' is unused in this build; it exists
-- so adding QR check-in later is not a schema migration on a live table.
create type public.attendance_method as enum (
  'manual',
  'qr'
);

create type public.membership_status as enum (
  'active',
  'expired',
  'cancelled'
);

create type public.staff_role as enum (
  'owner',
  'staff'
);
