drop index if exists public.subscription_payments_provider_payment_uidx;
create unique index subscription_payments_provider_payment_uidx
  on public.subscription_payments (provider, provider_payment_id);
