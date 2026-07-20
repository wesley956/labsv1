-- Cover frequently joined foreign keys used by scheduling and platform administration.

create index if not exists appointments_client_id_idx on public.appointments(client_id);
create index if not exists appointments_service_id_idx on public.appointments(service_id);
create index if not exists availability_blocks_professional_id_idx on public.availability_blocks(professional_id);
create index if not exists platform_admin_events_admin_user_id_idx on public.platform_admin_events(admin_user_id);
create index if not exists platform_admins_created_by_idx on public.platform_admins(created_by);
create index if not exists reviews_professional_id_idx on public.reviews(professional_id);
create index if not exists reviews_service_id_idx on public.reviews(service_id);
create index if not exists service_professionals_business_id_idx on public.service_professionals(business_id);
create index if not exists service_professionals_professional_id_idx on public.service_professionals(professional_id);
create index if not exists subscription_payments_created_by_admin_idx on public.subscription_payments(created_by_admin);
create index if not exists weekly_availability_professional_id_idx on public.weekly_availability(professional_id);
