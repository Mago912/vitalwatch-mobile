create table public.push_tokens (
  id bigint generated always as identity primary key,
  device_id bigint not null references public.devices(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_device_id_idx
  on public.push_tokens (device_id);

comment on table public.push_tokens is
  'Expo push tokens registered for each VitalWatch device.';

alter table public.push_tokens enable row level security;

-- Mobile clients never read this table directly. The Edge Function performs
-- the narrow registration and delivery operations with its server credentials.
revoke all on table public.push_tokens from anon, authenticated;
grant all on table public.push_tokens to service_role;

;
