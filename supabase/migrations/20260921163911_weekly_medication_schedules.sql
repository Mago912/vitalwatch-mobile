-- Convierte la agenda de medicamentos en una repeticion semanal.
-- 1 = lunes ... 7 = domingo. Las filas existentes quedan activas todos los dias.

alter table public.medications
  add column if not exists scheduled_days smallint[] not null
  default array[1, 2, 3, 4, 5, 6, 7]::smallint[];

update public.medications
set scheduled_days = array[1, 2, 3, 4, 5, 6, 7]::smallint[]
where scheduled_days is null or cardinality(scheduled_days) = 0;

alter table public.medications
  drop constraint if exists medications_scheduled_days_check;

alter table public.medications
  add constraint medications_scheduled_days_check
  check (
    cardinality(scheduled_days) between 1 and 7
    and scheduled_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  );

comment on column public.medications.scheduled_days is
  'Dias ISO de repeticion semanal: 1 lunes hasta 7 domingo.';

create index if not exists medications_active_schedule_idx
  on public.medications (user_id, active, scheduled_time);

create or replace function public.reset_medication_reminder_after_schedule_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.scheduled_date is distinct from old.scheduled_date
    or new.scheduled_days is distinct from old.scheduled_days
    or new.scheduled_time is distinct from old.scheduled_time
    or new.active is distinct from old.active then
    new.last_reminder_sent_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists reset_medication_reminder on public.medications;
create trigger reset_medication_reminder
before update of scheduled_date, scheduled_days, scheduled_time, active on public.medications
for each row execute function public.reset_medication_reminder_after_schedule_change();

create or replace function private.dispatch_due_medication_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  with local_clock as (
    select
      clock_timestamp() as now_utc,
      clock_timestamp() at time zone 'America/Argentina/Buenos_Aires' as local_now
  ), due_candidates as (
    select
      m.id as medication_id,
      m.name,
      m.dose,
      m.last_reminder_sent_at,
      d.id as device_id,
      local_clock.now_utc,
      ((local_clock.local_now::date + m.scheduled_time)
        at time zone 'America/Argentina/Buenos_Aires') as scheduled_at
    from public.medications m
    cross join local_clock
    join lateral (
      select device.id
      from public.devices device
      where device.user_id = m.user_id
      order by device.id
      limit 1
    ) d on true
    where m.active = true
      and local_clock.local_now::date >= m.scheduled_date
      and extract(isodow from local_clock.local_now)::smallint = any(m.scheduled_days)
  ), due as (
    select candidate.*
    from due_candidates candidate
    left join lateral (
      select ml.status
      from public.medication_logs ml
      where ml.medication_id = candidate.medication_id
        and abs(extract(epoch from (ml.scheduled_for - candidate.scheduled_at))) <= 60
      order by ml.created_at desc
      limit 1
    ) latest on true
    where coalesce(latest.status, 'pending') <> 'taken'
      and candidate.now_utc >= candidate.scheduled_at
      and candidate.now_utc < candidate.scheduled_at + interval '6 hours'
      and (
        candidate.last_reminder_sent_at is null
        or candidate.last_reminder_sent_at < candidate.scheduled_at
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

revoke all on function private.dispatch_due_medication_reminders()
  from public, anon, authenticated, service_role;

create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid)
from cron.job
where jobname = 'vitalwatch-medication-reminders';

select cron.schedule(
  'vitalwatch-medication-reminders',
  '* * * * *',
  'select private.dispatch_due_medication_reminders();'
);

drop function if exists public.dispatch_due_medication_reminders();
