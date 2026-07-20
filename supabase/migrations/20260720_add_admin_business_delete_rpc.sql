create or replace function public.delete_admin_business(
  p_business_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_business public.businesses%rowtype;
  v_owner_email text;
  v_clients_count integer;
  v_professionals_count integer;
  v_services_count integer;
  v_appointments_count integer;
  v_reviews_count integer;
begin
  if not public.is_platform_admin(true) then
    raise exception 'Acesso de superadministrador necessário.';
  end if;

  if p_business_id is null then
    raise exception 'Estabelecimento inválido.';
  end if;

  select * into v_business
  from public.businesses
  where id = p_business_id
  for update;

  if not found then
    raise exception 'Estabelecimento não encontrado.';
  end if;

  if trim(coalesce(p_confirmation, '')) <> trim(v_business.name) then
    raise exception 'Digite exatamente o nome do estabelecimento para confirmar.';
  end if;

  select coalesce(email, '') into v_owner_email
  from auth.users
  where id = v_business.owner_id;

  select count(*) into v_clients_count from public.clients where business_id = p_business_id;
  select count(*) into v_professionals_count from public.professionals where business_id = p_business_id;
  select count(*) into v_services_count from public.services where business_id = p_business_id;
  select count(*) into v_appointments_count from public.appointments where business_id = p_business_id;
  select count(*) into v_reviews_count from public.reviews where business_id = p_business_id;

  insert into public.platform_admin_events(
    admin_user_id,
    action,
    target_business_id,
    metadata
  ) values (
    (select auth.uid()),
    'business_deleted',
    p_business_id,
    jsonb_build_object(
      'business_name', v_business.name,
      'slug', v_business.slug,
      'owner_email', v_owner_email,
      'subscription_status', v_business.subscription_status,
      'clients_count', v_clients_count,
      'professionals_count', v_professionals_count,
      'services_count', v_services_count,
      'appointments_count', v_appointments_count,
      'reviews_count', v_reviews_count
    )
  );

  delete from public.businesses where id = p_business_id;

  return jsonb_build_object(
    'success', true,
    'business_id', p_business_id,
    'business_name', v_business.name,
    'owner_email', v_owner_email,
    'deleted_counts', jsonb_build_object(
      'clients', v_clients_count,
      'professionals', v_professionals_count,
      'services', v_services_count,
      'appointments', v_appointments_count,
      'reviews', v_reviews_count
    )
  );
end;
$function$;

revoke all on function public.delete_admin_business(uuid, text) from public, anon;
grant execute on function public.delete_admin_business(uuid, text) to authenticated;
