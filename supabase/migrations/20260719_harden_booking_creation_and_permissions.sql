-- Harden public booking creation/cancellation and align member access.

alter table public.weekly_availability
  add constraint weekly_availability_valid_range check (start_time < end_time) not valid;
alter table public.weekly_availability validate constraint weekly_availability_valid_range;

alter table public.availability_blocks
  add constraint availability_blocks_valid_range check (
    all_day = true or (start_time is not null and end_time is not null and start_time < end_time)
  ) not valid;
alter table public.availability_blocks validate constraint availability_blocks_valid_range;

alter table public.appointments
  add constraint appointments_valid_time_range check (start_time < end_time) not valid;
alter table public.appointments validate constraint appointments_valid_time_range;

create or replace function public.get_public_available_slots(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_date date
)
returns table(slot text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_service public.services%rowtype;
  v_start integer;
  v_end integer;
  v_candidate integer;
  v_step integer;
  v_today date := timezone('America/Sao_Paulo', now())::date;
begin
  if p_date is null then return; end if;

  select * into v_business
  from public.businesses
  where slug = lower(trim(p_slug))
  limit 1;
  if not found then return; end if;

  if p_date < v_today or p_date > v_today + v_business.booking_window_days then return; end if;

  select * into v_service
  from public.services
  where id = p_service_id and business_id = v_business.id and active = true;
  if not found then return; end if;

  if not exists (
    select 1
    from public.professionals p
    join public.service_professionals sp
      on sp.professional_id = p.id
     and sp.service_id = v_service.id
     and sp.business_id = v_business.id
    where p.id = p_professional_id
      and p.business_id = v_business.id
      and p.active = true
  ) then return; end if;

  v_step := greatest(5, least(120, v_business.slot_step_minutes));

  for v_start, v_end in
    select
      extract(hour from wa.start_time)::int * 60 + extract(minute from wa.start_time)::int,
      extract(hour from wa.end_time)::int * 60 + extract(minute from wa.end_time)::int
    from public.weekly_availability wa
    where wa.business_id = v_business.id
      and wa.professional_id = p_professional_id
      and wa.weekday = extract(dow from p_date)::int
      and wa.enabled = true
    order by wa.start_time
  loop
    v_candidate := v_start;
    while v_candidate + v_service.duration_minutes <= v_end loop
      if (p_date + make_time(v_candidate / 60, v_candidate % 60, 0)) >=
         (timezone('America/Sao_Paulo', now()) + make_interval(hours => v_business.minimum_notice_hours))
         and not exists (
           select 1 from public.availability_blocks ab
           where ab.business_id = v_business.id
             and ab.professional_id = p_professional_id
             and ab.block_date = p_date
             and (ab.all_day or (
               make_time(v_candidate / 60, v_candidate % 60, 0) < ab.end_time
               and make_time((v_candidate + v_service.duration_minutes) / 60, (v_candidate + v_service.duration_minutes) % 60, 0) > ab.start_time
             ))
         )
         and not exists (
           select 1 from public.appointments a
           where a.business_id = v_business.id
             and a.professional_id = p_professional_id
             and a.appointment_date = p_date
             and a.status <> 'cancelled'
             and make_time(v_candidate / 60, v_candidate % 60, 0) < a.end_time
             and make_time((v_candidate + v_service.duration_minutes) / 60, (v_candidate + v_service.duration_minutes) % 60, 0) > a.start_time
         )
      then
        slot := lpad((v_candidate / 60)::text, 2, '0') || ':' || lpad((v_candidate % 60)::text, 2, '0');
        return next;
      end if;
      v_candidate := v_candidate + v_step;
    end loop;
  end loop;
end;
$$;

create or replace function public.create_public_appointment(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_date date,
  p_start time without time zone,
  p_customer_name text,
  p_customer_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_service public.services%rowtype;
  v_professional public.professionals%rowtype;
  v_phone text;
  v_client_id uuid;
  v_end time;
  v_appointment_id uuid;
  v_management_token uuid;
  v_allowed boolean;
  v_confirmation_state text;
begin
  if p_date is null or p_start is null then raise exception 'Data ou horário inválido'; end if;
  if extract(second from p_start) <> 0 then raise exception 'Horário inválido'; end if;
  if length(trim(coalesce(p_customer_name, ''))) < 2 or length(trim(p_customer_name)) > 120 then raise exception 'Nome inválido'; end if;

  v_phone := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  if length(v_phone) < 10 or length(v_phone) > 13 then raise exception 'WhatsApp inválido'; end if;

  select * into v_business
  from public.businesses
  where slug = lower(trim(p_slug))
  limit 1;
  if not found then raise exception 'Agenda não encontrada'; end if;

  select * into v_service
  from public.services
  where id = p_service_id and business_id = v_business.id and active = true;
  if not found then raise exception 'Serviço indisponível'; end if;

  select p.* into v_professional
  from public.professionals p
  join public.service_professionals sp
    on sp.professional_id = p.id
   and sp.service_id = v_service.id
   and sp.business_id = v_business.id
  where p.id = p_professional_id
    and p.business_id = v_business.id
    and p.active = true;
  if not found then raise exception 'Profissional indisponível'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_professional_id::text || ':' || p_date::text, 0));

  select exists(
    select 1
    from public.get_public_available_slots(p_slug, p_service_id, p_professional_id, p_date) s
    where s.slot = to_char(p_start, 'HH24:MI')
  ) into v_allowed;
  if not v_allowed then raise exception 'Esse horário não está mais disponível'; end if;

  v_end := (p_start + make_interval(mins => v_service.duration_minutes))::time;
  v_confirmation_state := case when v_business.require_professional_confirmation then 'pending' else 'confirmed' end;

  insert into public.clients(business_id, name, phone, phone_normalized)
  values(v_business.id, trim(p_customer_name), trim(p_customer_phone), v_phone)
  on conflict(business_id, phone_normalized)
  do update set name = excluded.name, phone = excluded.phone, updated_at = now()
  returning id into v_client_id;

  insert into public.appointments(
    business_id, client_id, professional_id, service_id,
    customer_name, customer_phone, professional_name, service_name,
    service_duration_minutes, service_price, appointment_date,
    start_time, end_time, status, origin, notes,
    confirmation_state, confirmed_at
  ) values(
    v_business.id, v_client_id, v_professional.id, v_service.id,
    trim(p_customer_name), trim(p_customer_phone), v_professional.name, v_service.name,
    v_service.duration_minutes, v_service.price, p_date,
    p_start, v_end, 'confirmed', 'public', '',
    v_confirmation_state, case when v_confirmation_state = 'confirmed' then now() else null end
  ) returning id, management_token into v_appointment_id, v_management_token;

  insert into public.appointment_events(
    business_id, appointment_id, event_type, actor_type, description, metadata
  ) values (
    v_business.id, v_appointment_id, 'created', 'client',
    'Agendamento criado pelo cliente',
    jsonb_build_object('origin', 'public', 'confirmation_state', v_confirmation_state)
  );

  return jsonb_build_object(
    'appointment_id', v_appointment_id,
    'management_token', v_management_token,
    'service_name', v_service.name,
    'professional_name', v_professional.name,
    'date', p_date,
    'start_time', to_char(p_start, 'HH24:MI'),
    'end_time', to_char(v_end, 'HH24:MI'),
    'confirmation_state', v_confirmation_state
  );
end;
$$;

create or replace function public.cancel_public_appointment(
  p_token uuid,
  p_reason text default ''::text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appointment public.appointments%rowtype;
  v_business public.businesses%rowtype;
  v_reason text;
begin
  if p_token is null then raise exception 'Agendamento não encontrado'; end if;

  select * into v_appointment
  from public.appointments
  where management_token = p_token
  for update;
  if not found then raise exception 'Agendamento não encontrado'; end if;

  select * into v_business from public.businesses where id = v_appointment.business_id;
  if not v_business.allow_client_cancellation then raise exception 'Cancelamento pelo cliente não permitido'; end if;
  if v_appointment.status = 'cancelled' then return jsonb_build_object('cancelled', true); end if;
  if v_appointment.status in ('completed', 'no_show') then raise exception 'Este atendimento não pode mais ser cancelado'; end if;

  if (v_appointment.appointment_date + v_appointment.start_time) <=
     (timezone('America/Sao_Paulo', now()) + make_interval(hours => v_business.cancellation_notice_hours))
  then
    raise exception 'O prazo para cancelamento online terminou';
  end if;

  v_reason := left(trim(coalesce(p_reason, '')), 500);

  update public.appointments
  set status = 'cancelled',
      cancelled_by = 'client',
      cancellation_reason = v_reason,
      updated_at = now()
  where id = v_appointment.id;

  insert into public.appointment_events(
    business_id, appointment_id, event_type, actor_type, description, metadata
  ) values (
    v_appointment.business_id, v_appointment.id, 'cancelled', 'client',
    'Agendamento cancelado pelo cliente',
    jsonb_build_object('reason', v_reason)
  );

  return jsonb_build_object('cancelled', true);
end;
$$;

drop policy if exists appointment_events_owner_all on public.appointment_events;
create policy appointment_events_members_all
on public.appointment_events
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists reviews_owner_all on public.reviews;
create policy reviews_members_all
on public.reviews
for all
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));
