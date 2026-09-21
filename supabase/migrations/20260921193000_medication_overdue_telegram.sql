-- Mantiene el recordatorio inmediato y agrega un aviso unico cuando pasan
-- 30 minutos sin registrar la toma. Cada horario vive en su propia fila.

create or replace function private.dispatch_due_medication_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending_count integer := 0;
  overdue_count integer := 0;
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
    returning
      due.device_id,
      due.medication_id,
      due.name,
      due.dose,
      due.scheduled_at
  ), inserted as (
    insert into public.device_events (
      device_id,
      type,
      severity,
      message,
      event_time,
      source_event_id
    )
    select
      marked.device_id,
      'medication_pending',
      'warning',
      'Es hora de tomar ' || marked.name ||
        case when nullif(trim(marked.dose), '') is null then '.' else ' (' || marked.dose || ').' end,
      clock_timestamp(),
      'medication-pending:' || marked.medication_id || ':' ||
        extract(epoch from marked.scheduled_at)::bigint
    from marked
    on conflict (device_id, source_event_id) do nothing
    returning id
  )
  select count(*)::integer into pending_count from inserted;

  with local_clock as (
    select
      clock_timestamp() as now_utc,
      clock_timestamp() at time zone 'America/Argentina/Buenos_Aires' as local_now
  ), overdue_candidates as (
    select
      m.id as medication_id,
      m.name,
      m.dose,
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
  ), overdue as (
    select candidate.*
    from overdue_candidates candidate
    left join lateral (
      select ml.status
      from public.medication_logs ml
      where ml.medication_id = candidate.medication_id
        and abs(extract(epoch from (ml.scheduled_for - candidate.scheduled_at))) <= 60
      order by ml.created_at desc
      limit 1
    ) latest on true
    where coalesce(latest.status, 'pending') <> 'taken'
      and candidate.now_utc >= candidate.scheduled_at + interval '30 minutes'
      and candidate.now_utc < candidate.scheduled_at + interval '6 hours'
  ), inserted as (
    insert into public.device_events (
      device_id,
      type,
      severity,
      message,
      event_time,
      source_event_id
    )
    select
      overdue.device_id,
      'medication_missed',
      'warning',
      'Todavia no se registro ' || overdue.name ||
        case when nullif(trim(overdue.dose), '') is null then '' else ' (' || overdue.dose || ')' end ||
        ', programada para las ' ||
        to_char(overdue.scheduled_at at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || '.',
      clock_timestamp(),
      'medication-missed:' || overdue.medication_id || ':' ||
        extract(epoch from overdue.scheduled_at)::bigint
    from overdue
    on conflict (device_id, source_event_id) do nothing
    returning id
  )
  select count(*)::integer into overdue_count from inserted;

  return pending_count + overdue_count;
end;
$$;

revoke all on function private.dispatch_due_medication_reminders()
  from public, anon, authenticated, service_role;

create or replace function public.record_mobile_medication_taken_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  medication_name text;
  medication_dose text;
begin
  if new.source <> 'mobile_app' or new.status <> 'taken' then
    return new;
  end if;

  select medication.name, medication.dose
  into medication_name, medication_dose
  from public.medications medication
  where medication.id = new.medication_id;

  insert into public.device_events (
    device_id,
    type,
    severity,
    message,
    event_time,
    source_event_id
  )
  values (
    new.device_id,
    'medication_taken',
    'info',
    coalesce(medication_name, 'La medicacion') ||
      case
        when nullif(trim(medication_dose), '') is null then ''
        else ' (' || medication_dose || ')'
      end ||
      ' fue marcada como tomada desde la aplicacion.',
    coalesce(new.taken_at, clock_timestamp()),
    'medication-taken:' || new.medication_id || ':' ||
      extract(epoch from new.scheduled_for)::bigint
  )
  on conflict (device_id, source_event_id) do nothing;

  return new;
end;
$$;

revoke all on function public.record_mobile_medication_taken_event()
  from public, anon, authenticated;
