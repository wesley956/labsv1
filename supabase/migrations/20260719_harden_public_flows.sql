-- Harden public appointment flows and reduce unnecessary storage exposure.

create or replace function public.reschedule_public_appointment(p_token uuid, p_date date, p_start time without time zone)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_a public.appointments%rowtype;
  v_old_date date;
  v_old_start time;
  v_end time;
begin
  if p_token is null or p_date is null or p_start is null then
    raise exception 'Dados de reagendamento inválidos.';
  end if;

  select * into v_a
  from public.appointments
  where management_token = p_token
  for update;

  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_a.status = 'cancelled' then raise exception 'Agendamento cancelado não pode ser reagendado.'; end if;
  if v_a.status = 'completed' then raise exception 'Atendimento concluído não pode ser reagendado.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_a.professional_id::text || ':' || p_date::text, 0));

  if not exists (
    select 1
    from public.get_public_reschedule_slots(p_token, p_date) s
    where s.slot = to_char(p_start, 'HH24:MI')
  ) then
    raise exception 'Este horário não está mais disponível.';
  end if;

  v_old_date := v_a.appointment_date;
  v_old_start := v_a.start_time;
  v_end := (p_start + make_interval(mins => v_a.service_duration_minutes))::time;

  update public.appointments
  set appointment_date = p_date,
      start_time = p_start,
      end_time = v_end,
      reschedule_count = coalesce(reschedule_count, 0) + 1,
      last_rescheduled_at = now(),
      reminder_24h_sent_at = null,
      reminder_2h_sent_at = null,
      updated_at = now()
  where id = v_a.id;

  insert into public.appointment_events(
    business_id, appointment_id, event_type, actor_type, description, metadata
  ) values (
    v_a.business_id, v_a.id, 'rescheduled', 'client', 'Agendamento reagendado pelo cliente',
    jsonb_build_object('old_date', v_old_date, 'old_start', v_old_start, 'new_date', p_date, 'new_start', p_start)
  );

  return jsonb_build_object(
    'success', true,
    'date', p_date,
    'start_time', to_char(p_start, 'HH24:MI'),
    'end_time', to_char(v_end, 'HH24:MI')
  );
end;
$function$;

create or replace function public.submit_public_review(p_token uuid, p_rating integer, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_a public.appointments%rowtype;
  v_existing boolean;
begin
  if p_token is null then raise exception 'Link de avaliação inválido.'; end if;

  select * into v_a
  from public.appointments
  where review_token = p_token
  limit 1;

  if not found then raise exception 'Link de avaliação inválido.'; end if;
  if v_a.status <> 'completed' then raise exception 'A avaliação fica disponível após a conclusão do atendimento.'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'Escolha uma nota de 1 a 5.'; end if;

  select exists(select 1 from public.reviews where appointment_id = v_a.id) into v_existing;

  insert into public.reviews(
    business_id, appointment_id, professional_id, service_id, customer_name, rating, comment
  ) values (
    v_a.business_id, v_a.id, v_a.professional_id, v_a.service_id, v_a.customer_name,
    p_rating, left(coalesce(trim(p_comment), ''), 1000)
  )
  on conflict (appointment_id) do update
  set rating = excluded.rating,
      comment = excluded.comment,
      updated_at = now();

  insert into public.appointment_events(
    business_id, appointment_id, event_type, actor_type, description
  ) values (
    v_a.business_id, v_a.id,
    case when v_existing then 'review_updated' else 'review_submitted' end,
    'client',
    case when v_existing then 'Avaliação atualizada pelo cliente' else 'Avaliação enviada pelo cliente' end
  );

  return jsonb_build_object('success', true, 'updated', v_existing);
end;
$function$;

drop policy if exists logos_public_read on storage.objects;
