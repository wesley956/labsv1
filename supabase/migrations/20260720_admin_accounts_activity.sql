-- Administrative accounts and complete platform activity history.

create or replace function public.get_admin_accounts()
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
      'user_id', pa.user_id,
      'email', coalesce(u.email, ''),
      'role', pa.role,
      'active', pa.active,
      'created_by_email', coalesce(creator.email, ''),
      'created_at', pa.created_at,
      'updated_at', pa.updated_at,
      'is_current_user', pa.user_id = (select auth.uid())
    ) order by pa.active desc, pa.role, u.email)
    from public.platform_admins pa
    join auth.users u on u.id = pa.user_id
    left join auth.users creator on creator.id = pa.created_by
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.upsert_platform_admin_by_email(
  p_email text,
  p_role text,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_target_user auth.users%rowtype;
  v_old public.platform_admins%rowtype;
  v_new public.platform_admins%rowtype;
  v_other_super_admins integer;
begin
  if not public.is_platform_admin(true) then
    raise exception 'Acesso de superadministrador necessário.';
  end if;

  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Informe um e-mail válido.';
  end if;

  if p_role not in ('super_admin', 'support') then
    raise exception 'Função administrativa inválida.';
  end if;

  select * into v_target_user
  from auth.users
  where lower(email) = v_email
  limit 1;

  if not found then
    raise exception 'Não existe uma conta cadastrada com este e-mail. A pessoa precisa criar uma conta antes de receber acesso administrativo.';
  end if;

  select * into v_old
  from public.platform_admins
  where user_id = v_target_user.id
  for update;

  if v_target_user.id = (select auth.uid()) and (not p_active or p_role <> 'super_admin') then
    raise exception 'Você não pode remover ou reduzir o próprio acesso de superadministrador.';
  end if;

  if found and v_old.active and v_old.role = 'super_admin' and (not p_active or p_role <> 'super_admin') then
    select count(*) into v_other_super_admins
    from public.platform_admins
    where active = true
      and role = 'super_admin'
      and user_id <> v_target_user.id;

    if v_other_super_admins = 0 then
      raise exception 'Não é possível remover o último superadministrador ativo.';
    end if;
  end if;

  insert into public.platform_admins(user_id, role, active, created_by, updated_at)
  values (v_target_user.id, p_role, p_active, (select auth.uid()), now())
  on conflict (user_id)
  do update set
    role = excluded.role,
    active = excluded.active,
    updated_at = now()
  returning * into v_new;

  insert into public.platform_admin_events(admin_user_id, action, metadata)
  values (
    (select auth.uid()),
    'admin_account_updated',
    jsonb_build_object(
      'target_user_id', v_target_user.id,
      'target_email', v_target_user.email,
      'old_role', case when v_old.user_id is null then null else v_old.role end,
      'new_role', v_new.role,
      'old_active', case when v_old.user_id is null then null else v_old.active end,
      'new_active', v_new.active
    )
  );

  return jsonb_build_object(
    'user_id', v_new.user_id,
    'email', v_target_user.email,
    'role', v_new.role,
    'active', v_new.active,
    'created_at', v_new.created_at,
    'updated_at', v_new.updated_at,
    'is_current_user', v_new.user_id = (select auth.uid())
  );
end;
$function$;

create or replace function public.get_admin_activity(
  p_business_id uuid default null,
  p_action text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if not public.is_platform_admin(false) then
    raise exception 'Acesso administrativo não autorizado.';
  end if;

  return jsonb_build_object(
    'total', (
      select count(*)
      from public.platform_admin_events e
      where (p_business_id is null or e.target_business_id = p_business_id)
        and (nullif(trim(coalesce(p_action, '')), '') is null or e.action = trim(p_action))
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rows.id,
        'action', rows.action,
        'admin_user_id', rows.admin_user_id,
        'admin_email', rows.admin_email,
        'business_id', rows.target_business_id,
        'business_name', rows.business_name,
        'metadata', rows.metadata,
        'created_at', rows.created_at
      ) order by rows.created_at desc)
      from (
        select
          e.id,
          e.action,
          e.admin_user_id,
          coalesce(u.email, '') as admin_email,
          e.target_business_id,
          coalesce(b.name, e.metadata->>'business_name', 'Sem estabelecimento') as business_name,
          e.metadata,
          e.created_at
        from public.platform_admin_events e
        left join auth.users u on u.id = e.admin_user_id
        left join public.businesses b on b.id = e.target_business_id
        where (p_business_id is null or e.target_business_id = p_business_id)
          and (nullif(trim(coalesce(p_action, '')), '') is null or e.action = trim(p_action))
        order by e.created_at desc
        limit v_limit offset v_offset
      ) rows
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_admin_accounts() from public, anon;
revoke all on function public.upsert_platform_admin_by_email(text, text, boolean) from public, anon;
revoke all on function public.get_admin_activity(uuid, text, integer, integer) from public, anon;
grant execute on function public.get_admin_accounts() to authenticated;
grant execute on function public.upsert_platform_admin_by_email(text, text, boolean) to authenticated;
grant execute on function public.get_admin_activity(uuid, text, integer, integer) to authenticated;
