-- Platform administration foundation.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'support' check (role in ('super_admin', 'support')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

drop policy if exists platform_admins_self_read on public.platform_admins;
create policy platform_admins_self_read
on public.platform_admins
for select
to authenticated
using (user_id = (select auth.uid()) and active = true);

create table if not exists public.platform_admin_events (
  id bigint generated always as identity primary key,
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_business_id uuid references public.businesses(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.platform_admin_events enable row level security;
create index if not exists platform_admin_events_created_at_idx on public.platform_admin_events(created_at desc);
create index if not exists platform_admin_events_business_idx on public.platform_admin_events(target_business_id, created_at desc);

create or replace function public.is_platform_admin(p_require_write boolean default false)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
      and pa.active = true
      and (not p_require_write or pa.role = 'super_admin')
  );
$function$;

revoke all on function public.is_platform_admin(boolean) from public, anon;
grant execute on function public.is_platform_admin(boolean) to authenticated;

create or replace function public.get_admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_today date := timezone('America/Sao_Paulo', now())::date;
begin
  if not public.is_platform_admin(false) then
    raise exception 'Acesso administrativo não autorizado.';
  end if;

  return jsonb_build_object(
    'total_businesses', (select count(*) from public.businesses),
    'active_businesses', (select count(*) from public.businesses where subscription_status = 'active'),
    'trialing_businesses', (select count(*) from public.businesses where subscription_status = 'trialing'),
    'past_due_businesses', (select count(*) from public.businesses where subscription_status = 'past_due'),
    'suspended_businesses', (select count(*) from public.businesses where subscription_status = 'suspended'),
    'cancelled_businesses', (select count(*) from public.businesses where subscription_status = 'cancelled'),
    'trials_expiring_7d', (
      select count(*) from public.businesses
      where subscription_status = 'trialing'
        and trial_ends_at > now()
        and trial_ends_at <= now() + interval '7 days'
    ),
    'total_clients', (select count(*) from public.clients),
    'appointments_30d', (
      select count(*) from public.appointments
      where appointment_date between v_today - 29 and v_today
    ),
    'completed_30d', (
      select count(*) from public.appointments
      where appointment_date between v_today - 29 and v_today
        and status = 'completed'
    ),
    'revenue_30d', (
      select coalesce(sum(service_price), 0) from public.appointments
      where appointment_date between v_today - 29 and v_today
        and status = 'completed'
    ),
    'monthly_recurring_revenue', (
      select coalesce(sum(monthly_price), 0) from public.businesses
      where subscription_status = 'active'
    ),
    'generated_at', now()
  );
end;
$function$;

revoke all on function public.get_admin_dashboard() from public, anon;
grant execute on function public.get_admin_dashboard() to authenticated;

create or replace function public.get_admin_businesses(p_search text default null, p_status text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_platform_admin(false) then
    raise exception 'Acesso administrativo não autorizado.';
  end if;

  if p_status is not null and p_status not in ('trialing', 'active', 'past_due', 'cancelled', 'suspended') then
    raise exception 'Filtro de assinatura inválido.';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'slug', b.slug,
        'owner_email', coalesce(u.email, ''),
        'plan_name', b.plan_name,
        'monthly_price', b.monthly_price,
        'subscription_status', b.subscription_status,
        'trial_started_at', b.trial_started_at,
        'trial_ends_at', b.trial_ends_at,
        'subscription_grace_ends_at', b.subscription_grace_ends_at,
        'created_at', b.created_at,
        'professionals_count', (select count(*) from public.professionals p where p.business_id = b.id),
        'services_count', (select count(*) from public.services s where s.business_id = b.id),
        'clients_count', (select count(*) from public.clients c where c.business_id = b.id),
        'appointments_count', (select count(*) from public.appointments a where a.business_id = b.id),
        'future_appointments_count', (
          select count(*) from public.appointments a
          where a.business_id = b.id
            and a.status <> 'cancelled'
            and a.appointment_date >= timezone('America/Sao_Paulo', now())::date
        ),
        'last_appointment_at', (
          select max(a.appointment_date + a.start_time) from public.appointments a where a.business_id = b.id
        )
      ) order by b.created_at desc
    )
    from public.businesses b
    left join auth.users u on u.id = b.owner_id
    where (p_status is null or b.subscription_status = p_status)
      and (
        nullif(trim(coalesce(p_search, '')), '') is null
        or b.name ilike '%' || trim(p_search) || '%'
        or b.slug ilike '%' || trim(p_search) || '%'
        or coalesce(u.email, '') ilike '%' || trim(p_search) || '%'
      )
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.get_admin_businesses(text, text) from public, anon;
grant execute on function public.get_admin_businesses(text, text) to authenticated;

create or replace function public.update_admin_business_subscription(
  p_business_id uuid,
  p_status text,
  p_trial_extension_days integer default null,
  p_grace_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old public.businesses%rowtype;
  v_new public.businesses%rowtype;
begin
  if not public.is_platform_admin(true) then
    raise exception 'Acesso de superadministrador necessário.';
  end if;

  if p_business_id is null then raise exception 'Estabelecimento inválido.'; end if;
  if p_status not in ('trialing', 'active', 'past_due', 'cancelled', 'suspended') then
    raise exception 'Status de assinatura inválido.';
  end if;
  if p_trial_extension_days is not null and (p_trial_extension_days < 1 or p_trial_extension_days > 365) then
    raise exception 'A extensão do teste deve ficar entre 1 e 365 dias.';
  end if;
  if p_grace_days is not null and (p_grace_days < 1 or p_grace_days > 60) then
    raise exception 'A tolerância deve ficar entre 1 e 60 dias.';
  end if;

  select * into v_old from public.businesses where id = p_business_id for update;
  if not found then raise exception 'Estabelecimento não encontrado.'; end if;

  update public.businesses
  set subscription_status = p_status,
      trial_started_at = case
        when p_status = 'trialing' and trial_started_at is null then now()
        else trial_started_at
      end,
      trial_ends_at = case
        when p_status = 'trialing' and p_trial_extension_days is not null
          then greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => p_trial_extension_days)
        when p_status = 'trialing' and trial_ends_at is null
          then now() + interval '15 days'
        else trial_ends_at
      end,
      subscription_grace_ends_at = case
        when p_status = 'past_due' and p_grace_days is not null
          then now() + make_interval(days => p_grace_days)
        when p_status = 'past_due' and subscription_grace_ends_at is null
          then now() + interval '7 days'
        when p_status in ('active', 'trialing', 'cancelled', 'suspended') then null
        else subscription_grace_ends_at
      end,
      updated_at = now()
  where id = p_business_id
  returning * into v_new;

  insert into public.platform_admin_events(admin_user_id, action, target_business_id, metadata)
  values (
    (select auth.uid()),
    'subscription_updated',
    p_business_id,
    jsonb_build_object(
      'old_status', v_old.subscription_status,
      'new_status', v_new.subscription_status,
      'old_trial_ends_at', v_old.trial_ends_at,
      'new_trial_ends_at', v_new.trial_ends_at,
      'old_grace_ends_at', v_old.subscription_grace_ends_at,
      'new_grace_ends_at', v_new.subscription_grace_ends_at,
      'trial_extension_days', p_trial_extension_days,
      'grace_days', p_grace_days
    )
  );

  return jsonb_build_object(
    'id', v_new.id,
    'subscription_status', v_new.subscription_status,
    'trial_ends_at', v_new.trial_ends_at,
    'subscription_grace_ends_at', v_new.subscription_grace_ends_at,
    'updated_at', v_new.updated_at
  );
end;
$function$;

revoke all on function public.update_admin_business_subscription(uuid, text, integer, integer) from public, anon;
grant execute on function public.update_admin_business_subscription(uuid, text, integer, integer) to authenticated;

create or replace function public.get_admin_recent_events(p_limit integer default 12)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_platform_admin(false) then
    raise exception 'Acesso administrativo não autorizado.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'action', e.action,
      'admin_email', coalesce(u.email, ''),
      'business_id', e.target_business_id,
      'business_name', coalesce(b.name, 'Estabelecimento removido'),
      'metadata', e.metadata,
      'created_at', e.created_at
    ) order by e.created_at desc)
    from (
      select * from public.platform_admin_events
      order by created_at desc
      limit greatest(1, least(coalesce(p_limit, 12), 50))
    ) e
    left join auth.users u on u.id = e.admin_user_id
    left join public.businesses b on b.id = e.target_business_id
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.get_admin_recent_events(integer) from public, anon;
grant execute on function public.get_admin_recent_events(integer) to authenticated;
