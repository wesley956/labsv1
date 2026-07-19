-- Enforce core booking data limits at the database layer.

alter table public.clients
  add constraint clients_name_length check (length(trim(name)) between 2 and 120) not valid;
alter table public.clients validate constraint clients_name_length;

alter table public.clients
  add constraint clients_phone_normalized_length check (length(phone_normalized) between 10 and 13) not valid;
alter table public.clients validate constraint clients_phone_normalized_length;

alter table public.professionals
  add constraint professionals_name_length check (length(trim(name)) between 2 and 120) not valid;
alter table public.professionals validate constraint professionals_name_length;

alter table public.services
  add constraint services_name_length check (length(trim(name)) between 2 and 120) not valid;
alter table public.services validate constraint services_name_length;

alter table public.services
  add constraint services_duration_reasonable check (duration_minutes between 5 and 1440) not valid;
alter table public.services validate constraint services_duration_reasonable;

alter table public.appointments
  add constraint appointments_customer_name_length check (length(trim(customer_name)) between 2 and 120) not valid;
alter table public.appointments validate constraint appointments_customer_name_length;

alter table public.appointments
  add constraint appointments_customer_phone_length check (
    length(regexp_replace(customer_phone, '\D', '', 'g')) between 10 and 13
  ) not valid;
alter table public.appointments validate constraint appointments_customer_phone_length;
