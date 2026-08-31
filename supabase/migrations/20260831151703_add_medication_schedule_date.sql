alter table public.medications
add column if not exists scheduled_date date;

update public.medications
set scheduled_date = (now() at time zone 'America/Argentina/Buenos_Aires')::date
where scheduled_date is null;

alter table public.medications
alter column scheduled_date set default
  ((now() at time zone 'America/Argentina/Buenos_Aires')::date),
alter column scheduled_date set not null;

create index if not exists medications_user_schedule_idx
on public.medications(user_id, scheduled_date, scheduled_time)
where active = true;
