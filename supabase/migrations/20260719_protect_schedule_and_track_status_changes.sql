alter table public.weekly_availability
  drop constraint if exists weekly_availability_no_overlap;

alter table public.weekly_availability
  add constraint weekly_availability_no_overlap
  exclude using gist (
    business_id with =,
    professional_id with =,
    weekday with =,
    int4range(
      (extract(epoch from start_time) / 60)::integer,
      (extract(epoch from end_time) / 60)::integer,
      '[)'
    ) with &&
  ) where (enabled = true);

create or replace function public.log_appointment_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor text;
  v_description text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_actor := case when auth.uid() is null then 'system' else 'staff' end;
  v_description := case new.status
    when 'confirmed' then 'Agendamento marcado como confirmado'
    when 'completed' then 'Atendimento marcado como concluído'
    when 'cancelled' then 'Agendamento marcado como cancelado'
    when 'no_show' then 'Cliente marcado como não compareceu'
    else 'Status do agendamento alterado'
  end;

  insert into public.appointment_events(
    business_id, appointment_id, event_type, actor_type, description, metadata
  ) values (
    new.business_id,
    new.id,
    'status_changed',
    v_actor,
    v_description,
    jsonb_build_object('old_status', old.status, 'new_status', new.status)
  );

  return new;
end;
$function$;

drop trigger if exists appointments_log_status_change on public.appointments;
create trigger appointments_log_status_change
after update of status on public.appointments
for each row execute function public.log_appointment_status_change();