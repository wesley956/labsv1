-- Administrative events are available only through guarded SECURITY DEFINER RPCs.

drop policy if exists platform_admin_events_deny_direct_read on public.platform_admin_events;
create policy platform_admin_events_deny_direct_read
on public.platform_admin_events
for select
to authenticated
using (false);
