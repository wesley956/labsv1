create or replace function public.replace_weekly_availability(
  p_business_id uuid,
  p_professional_id uuid,
  p_periods jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_business_member(p_business_id) then
    raise exception 'Você não possui permissão para alterar esta disponibilidade.';
  end if;

  if not exists (
    select 1
    from public.professionals p
    where p.id = p_professional_id
      and p.business_id = p_business_id
  ) then
    raise exception 'Profissional não encontrado neste estabelecimento.';
  end if;

  p_periods := coalesce(p_periods, '[]'::jsonb);

  if jsonb_typeof(p_periods) <> 'array' then
    raise exception 'A disponibilidade enviada é inválida.';
  end if;

  if jsonb_array_length(p_periods) > 50 then
    raise exception 'A disponibilidade excede o limite de 50 períodos.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_periods) as x(weekday integer, start_time text, end_time text)
    where x.weekday is null
       or x.weekday not between 0 and 6
       or x.start_time is null
       or x.end_time is null
       or x.start_time !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
       or x.end_time !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
       or x.start_time::time >= x.end_time::time
  ) then
    raise exception 'Existem dias ou horários inválidos na disponibilidade.';
  end if;

  if exists (
    with parsed as (
      select
        row_number() over () as row_id,
        x.weekday,
        x.start_time::time as start_time,
        x.end_time::time as end_time
      from jsonb_to_recordset(p_periods) as x(weekday integer, start_time text, end_time text)
    )
    select 1
    from parsed a
    join parsed b
      on a.row_id < b.row_id
     and a.weekday = b.weekday
     and a.start_time < b.end_time
     and a.end_time > b.start_time
  ) then
    raise exception 'Existem períodos sobrepostos no mesmo dia.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || ':' || p_professional_id::text, 0)
  );

  delete from public.weekly_availability
  where business_id = p_business_id
    and professional_id = p_professional_id;

  insert into public.weekly_availability (
    business_id,
    professional_id,
    weekday,
    enabled,
    start_time,
    end_time
  )
  select
    p_business_id,
    p_professional_id,
    x.weekday::smallint,
    true,
    x.start_time::time,
    x.end_time::time
  from jsonb_to_recordset(p_periods) as x(weekday integer, start_time text, end_time text);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', wa.id,
        'professional_id', wa.professional_id,
        'weekday', wa.weekday,
        'enabled', wa.enabled,
        'start_time', to_char(wa.start_time, 'HH24:MI:SS'),
        'end_time', to_char(wa.end_time, 'HH24:MI:SS')
      ) order by wa.weekday, wa.start_time
    ),
    '[]'::jsonb
  )
  into v_result
  from public.weekly_availability wa
  where wa.business_id = p_business_id
    and wa.professional_id = p_professional_id;

  return v_result;
end;
$$;

revoke all on function public.replace_weekly_availability(uuid, uuid, jsonb) from public;
revoke all on function public.replace_weekly_availability(uuid, uuid, jsonb) from anon;
grant execute on function public.replace_weekly_availability(uuid, uuid, jsonb) to authenticated;

create or replace function public.enforce_appointment_status_transition()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'confirmed' and new.status not in ('completed', 'cancelled', 'no_show') then
    raise exception 'Mudança de status inválida para este agendamento.';
  end if;

  if old.status = 'cancelled' and new.status <> 'confirmed' then
    raise exception 'Um agendamento cancelado só pode ser restaurado como confirmado.';
  end if;

  if old.status in ('completed', 'no_show') then
    raise exception 'Este atendimento já foi finalizado e não pode ter o status alterado.';
  end if;

  case new.status
    when 'cancelled' then
      new.cancelled_by := coalesce(
        nullif(trim(new.cancelled_by), ''),
        case when auth.uid() is null then 'system' else 'business' end
      );
      new.cancellation_reason := coalesce(
        nullif(trim(new.cancellation_reason), ''),
        'Cancelado pelo estabelecimento'
      );
    when 'confirmed' then
      new.cancelled_by := null;
      new.cancellation_reason := '';
      new.confirmation_state := 'confirmed';
      new.confirmed_at := now();
      new.confirmation_sent_at := null;
      new.reminder_24h_sent_at := null;
      new.reminder_2h_sent_at := null;
    when 'completed', 'no_show' then
      new.cancelled_by := null;
      new.cancellation_reason := '';
      new.confirmation_state := 'confirmed';
    else
      null;
  end case;

  return new;
end;
$$;

drop trigger if exists appointments_enforce_status_transition on public.appointments;
create trigger appointments_enforce_status_transition
before update of status on public.appointments
for each row
execute function public.enforce_appointment_status_transition();

revoke all on function public.enforce_appointment_status_transition() from public;
revoke all on function public.enforce_appointment_status_transition() from anon;
revoke all on function public.enforce_appointment_status_transition() from authenticated;

create or replace function public.update_dashboard_appointment_status(
  p_business_id uuid,
  p_appointment_id uuid,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_appointment public.appointments%rowtype;
  v_next_status public.appointment_status;
begin
  if auth.uid() is null or not public.is_business_member(p_business_id) then
    raise exception 'Você não possui permissão para alterar este agendamento.';
  end if;

  if p_status not in ('confirmed', 'completed', 'cancelled', 'no_show') then
    raise exception 'Status de agendamento inválido.';
  end if;

  if length(coalesce(p_reason, '')) > 500 then
    raise exception 'O motivo do cancelamento deve ter no máximo 500 caracteres.';
  end if;

  select *
  into v_appointment
  from public.appointments a
  where a.id = p_appointment_id
    and a.business_id = p_business_id
  for update;

  if not found then
    raise exception 'Agendamento não encontrado.';
  end if;

  v_next_status := p_status::public.appointment_status;

  if v_appointment.status = v_next_status then
    return jsonb_build_object(
      'id', v_appointment.id,
      'status', v_appointment.status,
      'cancelled_by', v_appointment.cancelled_by,
      'cancellation_reason', v_appointment.cancellation_reason
    );
  end if;

  begin
    update public.appointments
    set
      status = v_next_status,
      cancelled_by = case
        when v_next_status = 'cancelled' then 'business'
        else cancelled_by
      end,
      cancellation_reason = case
        when v_next_status = 'cancelled' then coalesce(nullif(trim(p_reason), ''), 'Cancelado pelo estabelecimento')
        else cancellation_reason
      end
    where id = p_appointment_id
      and business_id = p_business_id
    returning * into v_appointment;
  exception
    when exclusion_violation then
      raise exception 'Não foi possível restaurar o agendamento porque o horário já está ocupado.';
  end;

  return jsonb_build_object(
    'id', v_appointment.id,
    'status', v_appointment.status,
    'cancelled_by', v_appointment.cancelled_by,
    'cancellation_reason', v_appointment.cancellation_reason,
    'confirmation_state', v_appointment.confirmation_state,
    'confirmed_at', v_appointment.confirmed_at,
    'confirmation_sent_at', v_appointment.confirmation_sent_at,
    'reminder_24h_sent_at', v_appointment.reminder_24h_sent_at,
    'reminder_2h_sent_at', v_appointment.reminder_2h_sent_at
  );
end;
$$;

revoke all on function public.update_dashboard_appointment_status(uuid, uuid, text, text) from public;
revoke all on function public.update_dashboard_appointment_status(uuid, uuid, text, text) from anon;
grant execute on function public.update_dashboard_appointment_status(uuid, uuid, text, text) to authenticated;
