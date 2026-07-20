alter table public.businesses
  add column if not exists subscription_provider text not null default 'manual',
  add column if not exists mercado_pago_preapproval_id text,
  add column if not exists mercado_pago_subscription_status text,
  add column if not exists mercado_pago_payer_email text,
  add column if not exists mercado_pago_init_point text,
  add column if not exists mercado_pago_next_payment_at timestamptz,
  add column if not exists mercado_pago_last_synced_at timestamptz;

alter table public.businesses
  drop constraint if exists businesses_subscription_provider_check,
  add constraint businesses_subscription_provider_check
    check (subscription_provider in ('manual', 'mercado_pago')),
  drop constraint if exists businesses_mercado_pago_preapproval_length,
  add constraint businesses_mercado_pago_preapproval_length
    check (length(coalesce(mercado_pago_preapproval_id, '')) <= 120),
  drop constraint if exists businesses_mercado_pago_status_length,
  add constraint businesses_mercado_pago_status_length
    check (length(coalesce(mercado_pago_subscription_status, '')) <= 60),
  drop constraint if exists businesses_mercado_pago_email_length,
  add constraint businesses_mercado_pago_email_length
    check (length(coalesce(mercado_pago_payer_email, '')) <= 254),
  drop constraint if exists businesses_mercado_pago_init_point_length,
  add constraint businesses_mercado_pago_init_point_length
    check (length(coalesce(mercado_pago_init_point, '')) <= 2000);

create unique index if not exists businesses_mercado_pago_preapproval_uidx
  on public.businesses (mercado_pago_preapproval_id)
  where mercado_pago_preapproval_id is not null;

create unique index if not exists subscription_payments_provider_payment_uidx
  on public.subscription_payments (provider, provider_payment_id)
  where provider_payment_id is not null;

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_key text not null,
  event_type text not null,
  action text not null default '',
  resource_id text not null default '',
  live_mode boolean,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  constraint billing_webhook_events_provider_check check (provider in ('mercado_pago')),
  constraint billing_webhook_events_event_key_length check (length(event_key) between 1 and 500),
  constraint billing_webhook_events_type_length check (length(event_type) <= 120),
  constraint billing_webhook_events_action_length check (length(action) <= 200),
  constraint billing_webhook_events_resource_length check (length(resource_id) <= 200),
  constraint billing_webhook_events_error_length check (length(coalesce(processing_error, '')) <= 2000),
  constraint billing_webhook_events_event_key_unique unique (provider, event_key)
);

alter table public.billing_webhook_events enable row level security;

drop policy if exists billing_webhook_events_deny_direct on public.billing_webhook_events;
create policy billing_webhook_events_deny_direct
on public.billing_webhook_events
as restrictive
for all
to public
using (false)
with check (false);

create index if not exists billing_webhook_events_created_idx
  on public.billing_webhook_events (created_at desc);

create index if not exists billing_webhook_events_resource_idx
  on public.billing_webhook_events (provider, resource_id);
