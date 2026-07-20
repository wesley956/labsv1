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
      'business_name', coalesce(b.name, e.metadata->>'business_name', 'Estabelecimento removido'),
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

drop policy if exists logos_platform_admin_select on storage.objects;
create policy logos_platform_admin_select
on storage.objects
for select
to authenticated
using (bucket_id = 'logos' and public.is_platform_admin(false));

drop policy if exists logos_platform_admin_delete on storage.objects;
create policy logos_platform_admin_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'logos' and public.is_platform_admin(true));
