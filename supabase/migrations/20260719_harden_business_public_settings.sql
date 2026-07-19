alter table public.businesses
  drop constraint if exists businesses_name_length_check,
  add constraint businesses_name_length_check check (length(trim(name)) between 2 and 120),
  drop constraint if exists businesses_slug_format_check,
  add constraint businesses_slug_format_check check (length(slug) between 3 and 80 and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  drop constraint if exists businesses_public_description_length_check,
  add constraint businesses_public_description_length_check check (length(coalesce(public_description, '')) <= 1000),
  drop constraint if exists businesses_confirmation_template_length_check,
  add constraint businesses_confirmation_template_length_check check (length(coalesce(whatsapp_confirmation_template, '')) <= 2000),
  drop constraint if exists businesses_opening_hours_length_check,
  add constraint businesses_opening_hours_length_check check (length(coalesce(opening_hours_text, '')) <= 1000),
  drop constraint if exists businesses_primary_color_format_check,
  add constraint businesses_primary_color_format_check check (primary_color ~ '^#[0-9A-Fa-f]{6}$');
