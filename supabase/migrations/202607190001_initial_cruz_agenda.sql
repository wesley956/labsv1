-- Cruz Agenda: esquema inicial multiestabelecimento
-- Execute no SQL Editor do Supabase quando o projeto estiver criado.

create extension if not exists pgcrypto;

create type public.business_role as enum ('owner', 'admin', 'staff');
create type public.appointment_status as enum ('confirmed', 'completed', 'cancelled', 'no_show');
create type public.appointment_origin as enum ('manual', 'public');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  segment text not null default '',
  phone text not null default '',
  city text not null default '',
  address text not null default '',
  slug text not null unique,
  public_description text not null default '',
  minimum_notice_hours integer not null default 2 check (minimum_notice_hours >= 0),
  booking_window_days integer not null default 60 check (booking_window_days between 1 and 365),
  slot_step_minutes integer not null default 30 check (slot_step_minutes in (15, 30, 60)),
  allow_client_cancellation boolean not null default true,
  cancellation_notice_hours integer not null default 4 check (cancellation_notice_hours >= 0),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  show_prices_publicly boolean not null default true,
  show_professional_specialty boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.business_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  specialty text not null default '',
  phone text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0 check (price >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_professionals (
  service_id uuid not null references public.services(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  primary key (service_id, professional_id)
);

create table public.weekly_availability (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  enabled boolean not null default true,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  block_date date not null,
  all_day boolean not null default false,
  start_time time,
  end_time time,
  reason text not null default '',
  created_at timestamptz not null default now(),
  check (all_day or (start_time is not null and end_time is not null and start_time < end_time))
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text not null,
  phone_normalized text not null,
  email text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, phone_normalized)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  customer_name text not null,
  customer_phone text not null,
  professional_name text not null,
  service_name text not null,
  service_duration_minutes integer not null check (service_duration_minutes > 0),
  service_price numeric(12,2) not null default 0,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status public.appointment_status not null default 'confirmed',
  origin public.appointment_origin not null default 'manual',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create index businesses_owner_id_idx on public.businesses(owner_id);
create index business_members_user_id_idx on public.business_members(user_id);
create index professionals_business_id_idx on public.professionals(business_id);
create index services_business_id_idx on public.services(business_id);
create index weekly_availability_lookup_idx on public.weekly_availability(business_id, professional_id, weekday);
create index availability_blocks_lookup_idx on public.availability_blocks(business_id, professional_id, block_date);
create index clients_business_phone_idx on public.clients(business_id, phone_normalized);
create index appointments_calendar_idx on public.appointments(business_id, professional_id, appointment_date, start_time);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_set_updated_at before update on public.businesses for each row execute function public.set_updated_at();
create trigger professionals_set_updated_at before update on public.professionals for each row execute function public.set_updated_at();
create trigger services_set_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = (select auth.uid())
  );
$$;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.professionals enable row level security;
alter table public.services enable row level security;
alter table public.service_professionals enable row level security;
alter table public.weekly_availability enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;

create policy businesses_select_members on public.businesses for select to authenticated
using (owner_id = (select auth.uid()) or public.is_business_member(id));
create policy businesses_insert_owner on public.businesses for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy businesses_update_owner on public.businesses for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy businesses_delete_owner on public.businesses for delete to authenticated
using (owner_id = (select auth.uid()));

create policy members_select_same_business on public.business_members for select to authenticated
using (public.is_business_member(business_id) or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy members_manage_owner on public.business_members for all to authenticated
using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));

create policy professionals_members_all on public.professionals for all to authenticated
using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy services_members_all on public.services for all to authenticated
using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy service_professionals_members_all on public.service_professionals for all to authenticated
using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy availability_members_all on public.weekly_availability for all to authenticated
using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy blocks_members_all on public.availability_blocks for all to authenticated
using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy clients_members_all on public.clients for all to authenticated
using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy appointments_members_all on public.appointments for all to authenticated
using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

-- O proprietário precisa entrar como membro após criar o negócio.
create or replace function public.add_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_members (business_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.add_owner_as_member() from public, anon, authenticated;
create trigger businesses_add_owner_member after insert on public.businesses for each row execute function public.add_owner_as_member();

-- A leitura/escrita pública será exposta posteriormente por RPCs específicas,
-- evitando liberar INSERT direto em appointments para o papel anon.
