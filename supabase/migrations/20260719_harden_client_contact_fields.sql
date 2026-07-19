alter table public.clients
  drop constraint if exists clients_phone_normalized_length_check,
  add constraint clients_phone_normalized_length_check check (length(phone_normalized) between 10 and 13),
  drop constraint if exists clients_email_length_check,
  add constraint clients_email_length_check check (length(coalesce(email, '')) <= 254),
  drop constraint if exists clients_notes_length_check,
  add constraint clients_notes_length_check check (length(coalesce(notes, '')) <= 2000);

alter table public.professionals
  drop constraint if exists professionals_phone_length_check,
  add constraint professionals_phone_length_check check (length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) <= 13),
  drop constraint if exists professionals_specialty_length_check,
  add constraint professionals_specialty_length_check check (length(trim(specialty)) between 2 and 120);
