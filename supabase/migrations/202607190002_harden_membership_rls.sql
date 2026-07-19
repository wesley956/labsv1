-- Corrige a verificação de associação sem recursão de RLS.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.business_members bm
      where bm.business_id = target_business_id
        and bm.user_id = (select auth.uid())
    );
$$;

revoke all on function private.is_business_member(uuid) from public, anon;
grant execute on function private.is_business_member(uuid) to authenticated;

drop policy if exists businesses_select_members on public.businesses;
drop policy if exists members_select_same_business on public.business_members;
drop policy if exists professionals_members_all on public.professionals;
drop policy if exists services_members_all on public.services;
drop policy if exists service_professionals_members_all on public.service_professionals;
drop policy if exists availability_members_all on public.weekly_availability;
drop policy if exists blocks_members_all on public.availability_blocks;
drop policy if exists clients_members_all on public.clients;
drop policy if exists appointments_members_all on public.appointments;

create policy businesses_select_members on public.businesses for select to authenticated
using (owner_id = (select auth.uid()) or private.is_business_member(id));

create policy members_select_same_business on public.business_members for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = (select auth.uid())
  )
);

create policy professionals_members_all on public.professionals for all to authenticated
using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
create policy services_members_all on public.services for all to authenticated
using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
create policy service_professionals_members_all on public.service_professionals for all to authenticated
using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
create policy availability_members_all on public.weekly_availability for all to authenticated
using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
create policy blocks_members_all on public.availability_blocks for all to authenticated
using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
create policy clients_members_all on public.clients for all to authenticated
using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
create policy appointments_members_all on public.appointments for all to authenticated
using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));

drop function if exists public.is_business_member(uuid);
