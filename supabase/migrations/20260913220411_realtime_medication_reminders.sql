alter table public.medications
  add column if not exists last_reminder_sent_at timestamptz;

comment on column public.medications.last_reminder_sent_at is
  'Ultimo recordatorio automatico enviado para el horario actual.';

create or replace function public.reset_medication_reminder_after_schedule_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.scheduled_date is distinct from old.scheduled_date
    or new.scheduled_time is distinct from old.scheduled_time
    or new.active is distinct from old.active then
    new.last_reminder_sent_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists reset_medication_reminder on public.medications;
create trigger reset_medication_reminder
before update of scheduled_date, scheduled_time, active on public.medications
for each row execute function public.reset_medication_reminder_after_schedule_change();

create or replace function public.dispatch_due_medication_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  with latest_logs as (
    select distinct on (ml.medication_id)
      ml.medication_id,
      ml.status
    from public.medication_logs ml
    join public.medications medication on medication.id = ml.medication_id
    where abs(
      extract(
        epoch from (
          ml.scheduled_for -
          ((medication.scheduled_date + medication.scheduled_time)
            at time zone 'America/Argentina/Buenos_Aires')
        )
      )
    ) <= 60
    order by ml.medication_id, ml.created_at desc
  ), due as (
    select
      m.id as medication_id,
      m.name,
      m.dose,
      d.id as device_id,
      ((m.scheduled_date + m.scheduled_time) at time zone 'America/Argentina/Buenos_Aires')
        as scheduled_at
    from public.medications m
    join lateral (
      select device.id
      from public.devices device
      where device.user_id = m.user_id
      order by device.id
      limit 1
    ) d on true
    left join latest_logs latest on latest.medication_id = m.id
    where m.active = true
      and coalesce(latest.status, 'pending') <> 'taken'
      and clock_timestamp() >=
        ((m.scheduled_date + m.scheduled_time) at time zone 'America/Argentina/Buenos_Aires')
      and clock_timestamp() <
        ((m.scheduled_date + m.scheduled_time) at time zone 'America/Argentina/Buenos_Aires')
          + interval '6 hours'
      and (
        m.last_reminder_sent_at is null
        or m.last_reminder_sent_at <
          ((m.scheduled_date + m.scheduled_time) at time zone 'America/Argentina/Buenos_Aires')
      )
  ), marked as (
    update public.medications medication
    set last_reminder_sent_at = clock_timestamp()
    from due
    where medication.id = due.medication_id
    returning due.device_id, due.name, due.dose
  ), inserted as (
    insert into public.device_events (device_id, type, severity, message, event_time)
    select
      marked.device_id,
      'medication_pending',
      'warning',
      'Es hora de tomar ' || marked.name ||
        case when nullif(trim(marked.dose), '') is null then '.' else ' (' || marked.dose || ').' end,
      clock_timestamp()
    from marked
    returning id
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$$;

revoke all on function public.dispatch_due_medication_reminders() from public, anon, authenticated;
grant execute on function public.dispatch_due_medication_reminders() to service_role;

create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid)
from cron.job
where jobname = 'vitalwatch-medication-reminders';

select cron.schedule(
  'vitalwatch-medication-reminders',
  '* * * * *',
  'select public.dispatch_due_medication_reminders();'
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'devices'
  ) then
    alter publication supabase_realtime add table public.devices;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sensor_readings'
  ) then
    alter publication supabase_realtime add table public.sensor_readings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'device_events'
  ) then
    alter publication supabase_realtime add table public.device_events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'medications'
  ) then
    alter publication supabase_realtime add table public.medications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'medication_logs'
  ) then
    alter publication supabase_realtime add table public.medication_logs;
  end if;
end;
$$;
