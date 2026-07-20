-- Enforce subscription state in the panel and public booking entry points.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.businesses'::regclass
      and conname = 'businesses_subscription_status_check'
  ) then
    alter table public.businesses
      add constraint businesses_subscription_status_check
      check (subscription_status in ('trialing', 'active', 'past_due', 'cancelled', 'suspended'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.businesses'::regclass
      and conname = 'businesses_monthly_price_check'
  ) then
    alter table public.businesses
      add constraint businesses_monthly_price_check
      check (monthly_price >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.businesses'::regclass
      and conname = 'businesses_trial_period_check'
  ) then
    alter table public.businesses
      add constraint businesses_trial_period_check
      check (trial_ends_at > trial_started_at);
  end if;
end
$$;

create or replace function public.business_subscription_is_accessible(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((
    select case
      when b.subscription_status = 'active' then true
      when b.subscription_status = 'trialing' then b.trial_ends_at > now()
      when b.subscription_status = 'past_due' then b.subscription_grace_ends_at is not null and b.subscription_grace_ends_at > now()
      else false
    end
    from public.businesses b
    where b.id = p_business_id
  ), false);
$function$;

revoke all on function public.business_subscription_is_accessible(uuid) from public, anon, authenticated;

create or replace function public.get_public_booking_data(p_slug text)
returns jsonb
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'business', jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'slug', b.slug,
      'segment', b.segment,
      'phone', b.phone,
      'city', b.city,
      'address', b.address,
      'public_description', b.public_description,
      'minimum_notice_hours', b.minimum_notice_hours,
      'booking_window_days', b.booking_window_days,
      'slot_step_minutes', b.slot_step_minutes,
      'theme', b.theme,
      'show_prices_publicly', b.show_prices_publicly,
      'show_professional_specialty', b.show_professional_specialty,
      'require_professional_confirmation', b.require_professional_confirmation,
      'logo_url', b.logo_url,
      'cover_url', b.cover_url,
      'instagram_url', b.instagram_url,
      'primary_color', b.primary_color,
      'opening_hours_text', b.opening_hours_text
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'price', s.price,
        'duration_minutes', s.duration_minutes,
        'professional_ids', coalesce((
          select jsonb_agg(sp.professional_id)
          from public.service_professionals sp
          join public.professionals p on p.id = sp.professional_id
          where sp.service_id = s.id and sp.business_id = b.id and p.active = true
        ), '[]'::jsonb)
      ) order by s.name)
      from public.services s
      where s.business_id = b.id and s.active = true
    ), '[]'::jsonb),
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'specialty', p.specialty,
        'photo_url', p.photo_url
      ) order by p.name)
      from public.professionals p
      where p.business_id = b.id and p.active = true
    ), '[]'::jsonb)
  )
  from public.businesses b
  where b.slug = lower(trim(p_slug))
    and public.business_subscription_is_accessible(b.id)
  limit 1;
$function$;

create or replace function public.get_public_available_slots(p_slug text, p_service_id uuid, p_professional_id uuid, p_date date)
returns table(slot text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
  if not public.business_subscription_is_accessible(v_business.id) then return; end if;

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
$function$;

create or replace function public.create_public_appointment(p_slug text, p_service_id uuid, p_professional_id uuid, p_date date, p_start time without time zone, p_customer_name text, p_customer_phone text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
  if not public.business_subscription_is_accessible(v_business.id) then raise exception 'Agenda temporariamente indisponível'; end if;

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
$function$;
