-- Keep review moderation private and audit approval changes.

drop policy if exists reviews_public_read_approved on public.reviews;

create or replace function public.log_review_moderation()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if old.approved is distinct from new.approved then
    insert into public.appointment_events(
      business_id,
      appointment_id,
      event_type,
      actor_type,
      description,
      metadata
    ) values (
      new.business_id,
      new.appointment_id,
      case when new.approved then 'review_approved' else 'review_hidden' end,
      'staff',
      case when new.approved then 'Avaliação aprovada para publicação' else 'Avaliação ocultada da publicação' end,
      jsonb_build_object('review_id', new.id, 'approved', new.approved)
    );
  end if;
  return new;
end;
$function$;

revoke all on function public.log_review_moderation() from public, anon, authenticated;

drop trigger if exists reviews_log_moderation on public.reviews;
create trigger reviews_log_moderation
after update of approved on public.reviews
for each row
execute function public.log_review_moderation();
