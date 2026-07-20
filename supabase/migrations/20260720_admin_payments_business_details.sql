-- Manual payment history and consolidated business details for the platform ADM.

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null default 'manual',
  provider_payment_id text,
  status text not null default 'pending',
  amount numeric(12,2) not null,
  due_at timestamptz,
  paid_at timestamptz,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by_admin uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_payments_provider_check check (provider in ('manual', 'mercado_pago')),
  constraint subscription_payments_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'overdue')),
  constraint subscription_payments_amount_check check (amount > 0 and amount <= 1000000),
  constraint subscription_payments_description_length check (length(description) <= 500)
);

create unique index if not exists subscription_payments_provider_reference_unique
on public.subscription_payments(provider, provider_payment_id)
where provider_payment_id is not null;

create index if not exists subscription_payments_business_created_idx
on public.subscription_payments(business_id, created_at desc);

create index if not exists subscription_payments_status_due_idx
on public.subscription_payments(status, due_at);

alter table public.subscription_payments enable row level security;

drop policy if exists subscription_payments_deny_direct on public.subscription_payments;
create policy subscription_payments_deny_direct
on public.subscription_payments
for all
to public
using (false)
with check (false);

drop trigger if exists subscription_payments_set_updated_at on public.subscription_payments;
create trigger subscription_payments_set_updated_at
before update on public.subscription_payments
for each row execute function public.set_updated_at();

create or replace function public.get_admin_payments(
  p_business_id uuid default null,
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
begin
  if not public.is_platform_admin(false) then raise exception 'Acesso administrativo não autorizado.'; end if;
  if p_status is not null and p_status not in ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'overdue') then raise exception 'Filtro de pagamento inválido.'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', rows.id,
      'business_id', rows.business_id,
      'business_name', rows.business_name,
      'owner_email', rows.owner_email,
      'provider', rows.provider,
      'provider_payment_id', rows.provider_payment_id,
      'status', rows.status,
      'amount', rows.amount,
      'due_at', rows.due_at,
      'paid_at', rows.paid_at,
      'description', rows.description,
      'created_by_email', rows.created_by_email,
      'created_at', rows.created_at,
      'updated_at', rows.updated_at
    ) order by rows.created_at desc)
    from (
      select p.*, b.name as business_name, coalesce(owner.email, '') as owner_email, coalesce(admin_user.email, '') as created_by_email
      from public.subscription_payments p
      join public.businesses b on b.id = p.business_id
      left join auth.users owner on owner.id = b.owner_id
      left join auth.users admin_user on admin_user.id = p.created_by_admin
      where (p_business_id is null or p.business_id = p_business_id)
        and (p_status is null or p.status = p_status)
      order by p.created_at desc
      limit v_limit
    ) rows
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.create_admin_payment(
  p_business_id uuid,
  p_amount numeric,
  p_due_at timestamptz default null,
  p_description text default '',
  p_status text default 'pending',
  p_provider text default 'manual',
  p_provider_payment_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_business public.businesses%rowtype;
  v_payment public.subscription_payments%rowtype;
  v_description text := left(trim(coalesce(p_description, '')), 500);
begin
  if not public.is_platform_admin(true) then raise exception 'Acesso de superadministrador necessário.'; end if;
  if p_business_id is null then raise exception 'Estabelecimento inválido.'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then raise exception 'Valor do pagamento inválido.'; end if;
  if p_status not in ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'overdue') then raise exception 'Status de pagamento inválido.'; end if;
  if p_provider not in ('manual', 'mercado_pago') then raise exception 'Provedor de pagamento inválido.'; end if;

  select * into v_business from public.businesses where id = p_business_id for update;
  if not found then raise exception 'Estabelecimento não encontrado.'; end if;

  insert into public.subscription_payments(
    business_id, provider, provider_payment_id, status, amount, due_at, paid_at,
    description, created_by_admin
  ) values (
    p_business_id,
    p_provider,
    nullif(trim(coalesce(p_provider_payment_id, '')), ''),
    p_status,
    round(p_amount, 2),
    p_due_at,
    case when p_status = 'approved' then now() else null end,
    v_description,
    (select auth.uid())
  ) returning * into v_payment;

  if p_status = 'approved' then
    update public.businesses
    set subscription_status = 'active', subscription_grace_ends_at = null, updated_at = now()
    where id = p_business_id;
  end if;

  insert into public.platform_admin_events(admin_user_id, action, target_business_id, metadata)
  values ((select auth.uid()), 'payment_created', p_business_id, jsonb_build_object(
    'payment_id', v_payment.id,
    'business_name', v_business.name,
    'amount', v_payment.amount,
    'status', v_payment.status,
    'provider', v_payment.provider,
    'due_at', v_payment.due_at
  ));

  return jsonb_build_object(
    'id', v_payment.id,
    'business_id', v_payment.business_id,
    'business_name', v_business.name,
    'provider', v_payment.provider,
    'provider_payment_id', v_payment.provider_payment_id,
    'status', v_payment.status,
    'amount', v_payment.amount,
    'due_at', v_payment.due_at,
    'paid_at', v_payment.paid_at,
    'description', v_payment.description,
    'created_at', v_payment.created_at,
    'updated_at', v_payment.updated_at
  );
end;
$function$;

create or replace function public.update_admin_payment_status(
  p_payment_id uuid,
  p_status text,
  p_paid_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old public.subscription_payments%rowtype;
  v_new public.subscription_payments%rowtype;
  v_business_name text;
begin
  if not public.is_platform_admin(true) then raise exception 'Acesso de superadministrador necessário.'; end if;
  if p_payment_id is null then raise exception 'Pagamento inválido.'; end if;
  if p_status not in ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'overdue') then raise exception 'Status de pagamento inválido.'; end if;

  select * into v_old from public.subscription_payments where id = p_payment_id for update;
  if not found then raise exception 'Pagamento não encontrado.'; end if;

  update public.subscription_payments
  set status = p_status,
      paid_at = case
        when p_status = 'approved' then coalesce(p_paid_at, paid_at, now())
        when p_status in ('pending', 'rejected', 'cancelled', 'overdue') then null
        else paid_at
      end,
      updated_at = now()
  where id = p_payment_id
  returning * into v_new;

  select name into v_business_name from public.businesses where id = v_new.business_id;

  if p_status = 'approved' then
    update public.businesses
    set subscription_status = 'active', subscription_grace_ends_at = null, updated_at = now()
    where id = v_new.business_id;
  elsif p_status = 'overdue' then
    update public.businesses
    set subscription_status = 'past_due',
        subscription_grace_ends_at = coalesce(subscription_grace_ends_at, now() + interval '7 days'),
        updated_at = now()
    where id = v_new.business_id;
  end if;

  insert into public.platform_admin_events(admin_user_id, action, target_business_id, metadata)
  values ((select auth.uid()), 'payment_status_updated', v_new.business_id, jsonb_build_object(
    'payment_id', v_new.id,
    'business_name', v_business_name,
    'old_status', v_old.status,
    'new_status', v_new.status,
    'amount', v_new.amount,
    'paid_at', v_new.paid_at
  ));

  return jsonb_build_object(
    'id', v_new.id,
    'business_id', v_new.business_id,
    'business_name', v_business_name,
    'provider', v_new.provider,
    'provider_payment_id', v_new.provider_payment_id,
    'status', v_new.status,
    'amount', v_new.amount,
    'due_at', v_new.due_at,
    'paid_at', v_new.paid_at,
    'description', v_new.description,
    'created_at', v_new.created_at,
    'updated_at', v_new.updated_at
  );
end;
$function$;

create or replace function public.get_admin_business_detail(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_business public.businesses%rowtype;
  v_owner_email text;
begin
  if not public.is_platform_admin(false) then raise exception 'Acesso administrativo não autorizado.'; end if;
  if p_business_id is null then raise exception 'Estabelecimento inválido.'; end if;

  select * into v_business from public.businesses where id = p_business_id;
  if not found then raise exception 'Estabelecimento não encontrado.'; end if;
  select coalesce(email, '') into v_owner_email from auth.users where id = v_business.owner_id;

  return jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business.id,
      'owner_id', v_business.owner_id,
      'owner_email', v_owner_email,
      'name', v_business.name,
      'segment', v_business.segment,
      'phone', v_business.phone,
      'city', v_business.city,
      'address', v_business.address,
      'slug', v_business.slug,
      'public_description', v_business.public_description,
      'logo_url', v_business.logo_url,
      'cover_url', v_business.cover_url,
      'instagram_url', v_business.instagram_url,
      'plan_name', v_business.plan_name,
      'monthly_price', v_business.monthly_price,
      'subscription_status', v_business.subscription_status,
      'trial_started_at', v_business.trial_started_at,
      'trial_ends_at', v_business.trial_ends_at,
      'subscription_grace_ends_at', v_business.subscription_grace_ends_at,
      'created_at', v_business.created_at,
      'updated_at', v_business.updated_at
    ),
    'counts', jsonb_build_object(
      'professionals', (select count(*) from public.professionals p where p.business_id = p_business_id),
      'active_professionals', (select count(*) from public.professionals p where p.business_id = p_business_id and p.active),
      'services', (select count(*) from public.services s where s.business_id = p_business_id),
      'active_services', (select count(*) from public.services s where s.business_id = p_business_id and s.active),
      'clients', (select count(*) from public.clients c where c.business_id = p_business_id),
      'appointments', (select count(*) from public.appointments a where a.business_id = p_business_id),
      'future_appointments', (select count(*) from public.appointments a where a.business_id = p_business_id and a.status <> 'cancelled' and a.appointment_date >= timezone('America/Sao_Paulo', now())::date),
      'completed_30d', (select count(*) from public.appointments a where a.business_id = p_business_id and a.status = 'completed' and a.appointment_date >= timezone('America/Sao_Paulo', now())::date - 29),
      'revenue_30d', (select coalesce(sum(a.service_price), 0) from public.appointments a where a.business_id = p_business_id and a.status = 'completed' and a.appointment_date >= timezone('America/Sao_Paulo', now())::date - 29)
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', bm.user_id,
        'email', coalesce(u.email, ''),
        'role', bm.role,
        'created_at', bm.created_at
      ) order by bm.created_at)
      from public.business_members bm
      left join auth.users u on u.id = bm.user_id
      where bm.business_id = p_business_id
    ), '[]'::jsonb),
    'recent_appointments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rows.id,
        'customer_name', rows.customer_name,
        'professional_name', rows.professional_name,
        'service_name', rows.service_name,
        'service_price', rows.service_price,
        'appointment_date', rows.appointment_date,
        'start_time', rows.start_time,
        'status', rows.status,
        'origin', rows.origin,
        'confirmation_state', rows.confirmation_state,
        'created_at', rows.created_at
      ) order by rows.appointment_date desc, rows.start_time desc)
      from (
        select * from public.appointments
        where business_id = p_business_id
        order by appointment_date desc, start_time desc
        limit 20
      ) rows
    ), '[]'::jsonb),
    'payments', public.get_admin_payments(p_business_id, null, 30),
    'activity', public.get_admin_activity(p_business_id, null, 30, 0)
  );
end;
$function$;

revoke all on table public.subscription_payments from public, anon, authenticated;
revoke all on function public.get_admin_payments(uuid, text, integer) from public, anon;
revoke all on function public.create_admin_payment(uuid, numeric, timestamptz, text, text, text, text) from public, anon;
revoke all on function public.update_admin_payment_status(uuid, text, timestamptz) from public, anon;
revoke all on function public.get_admin_business_detail(uuid) from public, anon;
grant execute on function public.get_admin_payments(uuid, text, integer) to authenticated;
grant execute on function public.create_admin_payment(uuid, numeric, timestamptz, text, text, text, text) to authenticated;
grant execute on function public.update_admin_payment_status(uuid, text, timestamptz) to authenticated;
grant execute on function public.get_admin_business_detail(uuid) to authenticated;
