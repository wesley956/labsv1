-- Bootstrap the first Cruz Agenda platform administrator.
-- This account already exists in Supabase Auth.

insert into public.platform_admins(user_id, role, active)
select id, 'super_admin', true
from auth.users
where lower(email) = 'aweservicosaw@gmail.com'
on conflict (user_id) do update
set role = excluded.role,
    active = true,
    updated_at = now();
