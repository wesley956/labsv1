create or replace function public.protect_business_billing_fields()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if auth.uid() is null or public.is_platform_admin(true) then
    return new;
  end if;

  if new.subscription_status is distinct from old.subscription_status
     or new.subscription_grace_ends_at is distinct from old.subscription_grace_ends_at
     or new.trial_started_at is distinct from old.trial_started_at
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.plan_name is distinct from old.plan_name
     or new.monthly_price is distinct from old.monthly_price
     or new.subscription_provider is distinct from old.subscription_provider
     or new.mercado_pago_preapproval_id is distinct from old.mercado_pago_preapproval_id
     or new.mercado_pago_subscription_status is distinct from old.mercado_pago_subscription_status
     or new.mercado_pago_payer_email is distinct from old.mercado_pago_payer_email
     or new.mercado_pago_init_point is distinct from old.mercado_pago_init_point
     or new.mercado_pago_next_payment_at is distinct from old.mercado_pago_next_payment_at
     or new.mercado_pago_last_synced_at is distinct from old.mercado_pago_last_synced_at then
    raise exception 'Os dados de cobrança só podem ser alterados pelo sistema ou pelo administrador da plataforma.';
  end if;

  return new;
end;
$$;

drop trigger if exists businesses_protect_billing_fields on public.businesses;
create trigger businesses_protect_billing_fields
before update on public.businesses
for each row
execute function public.protect_business_billing_fields();

revoke all on function public.protect_business_billing_fields() from public;
revoke all on function public.protect_business_billing_fields() from anon;
revoke all on function public.protect_business_billing_fields() from authenticated;
