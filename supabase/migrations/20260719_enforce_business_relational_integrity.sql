create or replace function public.enforce_same_business_relations()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_table_name = 'service_professionals' then
    if not exists (select 1 from public.services s where s.id = new.service_id and s.business_id = new.business_id)
       or not exists (select 1 from public.professionals p where p.id = new.professional_id and p.business_id = new.business_id) then
      raise exception 'Serviço e profissional precisam pertencer ao mesmo estabelecimento.';
    end if;
  elsif tg_table_name in ('weekly_availability','availability_blocks') then
    if not exists (select 1 from public.professionals p where p.id = new.professional_id and p.business_id = new.business_id) then
      raise exception 'Profissional inválido para este estabelecimento.';
    end if;
  elsif tg_table_name = 'appointments' then
    if not exists (select 1 from public.professionals p where p.id = new.professional_id and p.business_id = new.business_id) then
      raise exception 'Profissional inválido para este estabelecimento.';
    end if;
    if not exists (select 1 from public.services s where s.id = new.service_id and s.business_id = new.business_id) then
      raise exception 'Serviço inválido para este estabelecimento.';
    end if;
    if new.client_id is not null and not exists (select 1 from public.clients c where c.id = new.client_id and c.business_id = new.business_id) then
      raise exception 'Cliente inválido para este estabelecimento.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists service_professionals_same_business on public.service_professionals;
create trigger service_professionals_same_business before insert or update on public.service_professionals for each row execute function public.enforce_same_business_relations();

drop trigger if exists weekly_availability_same_business on public.weekly_availability;
create trigger weekly_availability_same_business before insert or update on public.weekly_availability for each row execute function public.enforce_same_business_relations();

drop trigger if exists availability_blocks_same_business on public.availability_blocks;
create trigger availability_blocks_same_business before insert or update on public.availability_blocks for each row execute function public.enforce_same_business_relations();

drop trigger if exists appointments_same_business on public.appointments;
create trigger appointments_same_business before insert or update on public.appointments for each row execute function public.enforce_same_business_relations();