# Modelagem do Banco de Dados — Cruz Agenda V1

## Objetivo

Este documento define a estrutura lógica do banco de dados da V1 do Cruz Agenda. A modelagem foi criada para suportar:

- múltiplos estabelecimentos;
- múltiplos usuários por estabelecimento;
- múltiplos profissionais;
- serviços executados por um ou vários profissionais;
- disponibilidade individual;
- agenda pública sem cadastro do cliente final;
- isolamento rigoroso entre estabelecimentos;
- trial de 15 dias;
- administração central pela Cruz Labs;
- histórico confiável, sem alterações retroativas indevidas.

A implementação será feita em PostgreSQL por meio do Supabase.

## Convenções gerais

- Chaves primárias: `uuid`.
- Datas técnicas: `timestamptz` em UTC.
- Datas locais de atendimento: armazenadas como `timestamptz`, convertidas pela aplicação conforme o fuso do estabelecimento.
- Valores monetários: `integer` em centavos, nunca `float`.
- Duração: minutos inteiros.
- Exclusão de dados operacionais: preferencialmente lógica por `is_active`, `archived_at` ou status.
- Toda tabela de negócio multiestabelecimento deve conter `establishment_id`.
- Toda tabela exposta pela Data API deve possuir RLS habilitado.
- Campos de auditoria padrão: `created_at`, `updated_at`.

## Enums planejados

### `establishment_status`

- `trial`
- `active`
- `past_due`
- `suspended`
- `cancelled`

### `membership_role`

- `owner`
- `admin`
- `receptionist`
- `professional`

### `appointment_status`

- `confirmed`
- `completed`
- `cancelled`
- `no_show`

### `appointment_origin`

- `public_booking`
- `manual`

### `subscription_status`

- `trialing`
- `active`
- `past_due`
- `cancelled`
- `suspended`

### `theme_preference`

- `light`
- `dark`
- `system`

### `block_type`

- `break`
- `personal`
- `vacation`
- `manual_block`
- `other`

## Tabelas principais

## 1. `profiles`

Representa os dados públicos e operacionais do usuário autenticado. O identificador é o mesmo de `auth.users.id`.

Campos:

- `id uuid primary key references auth.users(id) on delete cascade`
- `full_name text not null`
- `phone text null`
- `avatar_path text null`
- `theme_preference theme_preference not null default 'system'`
- `is_platform_admin boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Regras:

- o usuário comum pode consultar e alterar apenas seu próprio perfil;
- `is_platform_admin` nunca pode ser alterado pelo cliente;
- autorização não deve depender de `raw_user_meta_data`;
- permissões de plataforma devem ser controladas em tabela protegida ou `app_metadata` gerenciado pelo servidor.

## 2. `establishments`

Representa a empresa assinante: profissional autônomo, studio, barbearia, clínica ou salão.

Campos:

- `id uuid primary key`
- `name text not null`
- `slug text not null unique`
- `segment text not null`
- `description text null`
- `phone text not null`
- `instagram text null`
- `email text null`
- `address_line text null`
- `city text null`
- `state text null`
- `postal_code text null`
- `timezone text not null default 'America/Sao_Paulo'`
- `logo_path text null`
- `public_accent text null`
- `status establishment_status not null default 'trial'`
- `trial_started_at timestamptz not null default now()`
- `trial_ends_at timestamptz not null`
- `booking_enabled boolean not null default true`
- `onboarding_completed_at timestamptz null`
- `created_by uuid not null references auth.users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `archived_at timestamptz null`

Regras:

- `trial_ends_at` deve iniciar em `trial_started_at + 15 dias`;
- `slug` deve ser normalizado, minúsculo e sem espaços;
- slugs reservados como `admin`, `login`, `api`, `app`, `suporte` e `cruzlabs` não podem ser usados;
- `booking_enabled` deve ser desligado quando a conta expirar, for suspensa ou cancelada;
- a aplicação pode manter consulta ao painel após o trial, sem permitir novos agendamentos.

## 3. `establishment_members`

Relaciona usuários autenticados a estabelecimentos e seus papéis.

Campos:

- `id uuid primary key`
- `establishment_id uuid not null references establishments(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `role membership_role not null`
- `is_active boolean not null default true`
- `invited_by uuid null references auth.users(id)`
- `joined_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Restrições:

- `unique(establishment_id, user_id)`;
- deve existir pelo menos um proprietário ativo por estabelecimento;
- somente proprietário pode promover outro membro a proprietário;
- o último proprietário ativo não pode ser removido nem inativado.

## 4. `professionals`

Representa quem executa atendimentos. Um profissional pode existir sem login próprio.

Campos:

- `id uuid primary key`
- `establishment_id uuid not null references establishments(id) on delete cascade`
- `profile_id uuid null references profiles(id) on delete set null`
- `name text not null`
- `specialty text null`
- `phone text null`
- `bio text null`
- `avatar_path text null`
- `is_active boolean not null default true`
- `display_order integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `archived_at timestamptz null`

Regras:

- `profile_id` será usado quando o profissional possuir acesso próprio;
- um profissional com agendamentos futuros confirmados não pode ser arquivado sem tratamento prévio desses agendamentos;
- profissionais inativos não aparecem na página pública nem geram horários disponíveis.

## 5. `services`

Representa os serviços oferecidos pelo estabelecimento.

Campos:

- `id uuid primary key`
- `establishment_id uuid not null references establishments(id) on delete cascade`
- `name text not null`
- `description text null`
- `duration_minutes integer not null`
- `price_cents integer not null default 0`
- `buffer_before_minutes integer not null default 0`
- `buffer_after_minutes integer not null default 0`
- `is_active boolean not null default true`
- `display_order integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `archived_at timestamptz null`

Restrições:

- `duration_minutes > 0`;
- `price_cents >= 0`;
- buffers não podem ser negativos;
- um serviço inativo continua preservado nos agendamentos históricos.

## 6. `professional_services`

Relaciona profissionais aos serviços que executam.

Campos:

- `id uuid primary key`
- `establishment_id uuid not null references establishments(id) on delete cascade`
- `professional_id uuid not null references professionals(id) on delete cascade`
- `service_id uuid not null references services(id) on delete cascade`
- `custom_duration_minutes integer null`
- `custom_price_cents integer null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Restrições:

- `unique(professional_id, service_id)`;
- profissional e serviço precisam pertencer ao mesmo estabelecimento;
- duração e preço personalizados ficam preparados para evolução futura, mas podem permanecer nulos na V1.

## 7. `weekly_availability`

Define a disponibilidade recorrente semanal de cada profissional.

Campos:

- `id uuid primary key`
- `establishment_id uuid not null references establishments(id) on delete cascade`
- `professional_id uuid not null references professionals(id) on delete cascade`
- `weekday smallint not null`
- `start_time time not null`
- `end_time time not null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Restrições:

- `weekday between 0 and 6`;
- `start_time < end_time`;
- podem existir vários períodos no mesmo dia, como 08:00–12:00 e 13:00–18:00;
- períodos do mesmo profissional não podem se sobrepor.

## 8. `availability_exceptions`

Registra alterações pontuais na agenda recorrente, incluindo folgas, férias, pausas e disponibilidade extraordinária.

Campos:

- `id uuid primary key`
- `establishment_id uuid not null references establishments(id) on delete cascade`
- `professional_id uuid not null references professionals(id) on delete cascade`
- `starts_at timestamptz not null`
- `ends_at timestamptz not null`
- `is_available boolean not null default false`
- `type block_type null`
- `reason text null`
- `created_by uuid not null references auth.users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Regras:

- `starts_at < ends_at`;
- `is_available = false` representa bloqueio;
- `is_available = true` representa horário extraordinário;
- bloqueios nunca apagam agendamentos existentes; a interface deve alertar conflitos.

## 9. `customers`

Representa os clientes finais de um estabelecimento.

Campos:

- `id uuid primary key`
- `establishment_id uuid not null references establishments(id) on delete cascade`
- `name text not null`
- `phone text not null`
- `phone_normalized text not null`
- `email text null`
- `notes text null`
- `last_appointment_at timestamptz null`
- `appointments_count integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `archived_at timestamptz null`

Restrições:

- `unique(establishment_id, phone_normalized)`;
- o mesmo telefone pode existir em estabelecimentos diferentes;
- clientes finais não recebem acesso direto à tabela na V1;
- dados pessoais não devem ser expostos pela página pública.

## 10. `appointments`

É a tabela central do produto.

Campos:

- `id uuid primary key`
- `establishment_id uuid not null references establishments(id) on delete cascade`
- `customer_id uuid not null references customers(id)`
- `professional_id uuid not null references professionals(id)`
- `service_id uuid not null references services(id)`
- `starts_at timestamptz not null`
- `ends_at timestamptz not null`
- `status appointment_status not null default 'confirmed'`
- `origin appointment_origin not null`
- `customer_name_snapshot text not null`
- `customer_phone_snapshot text not null`
- `professional_name_snapshot text not null`
- `service_name_snapshot text not null`
- `service_duration_snapshot integer not null`
- `service_price_cents_snapshot integer not null`
- `notes text null`
- `cancellation_reason text null`
- `created_by uuid null references auth.users(id)`
- `cancelled_at timestamptz null`
- `completed_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Regras:

- `starts_at < ends_at`;
- profissional, serviço e cliente devem pertencer ao mesmo estabelecimento;
- somente profissionais vinculados ao serviço podem ser agendados;
- snapshots preservam preço, duração e nomes históricos;
- agendamento cancelado não é apagado;
- mudança futura de preço ou duração não altera registros existentes;
- o servidor calcula `ends_at`, não o navegador;
- a confirmação deve revalidar disponibilidade dentro da mesma transação.

## Prevenção de conflito de horário

A regra crítica da V1 é impedir dois agendamentos ativos que se sobreponham para o mesmo profissional.

Estratégia recomendada:

- habilitar a extensão necessária para `btree_gist`, se disponível e aprovada no projeto;
- criar uma restrição de exclusão baseada em:
  - `professional_id WITH =`;
  - `tstzrange(starts_at, ends_at, '[)') WITH &&`;
- aplicar a restrição somente aos registros com status `confirmed`;
- usar intervalo semiaberto `[)` para permitir que um atendimento termine exatamente quando o próximo começa.

Exemplo lógico:

```sql
exclude using gist (
  professional_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
)
where (status = 'confirmed')
```

Essa proteção deve existir no banco, além das validações da interface.

## 11. `subscriptions`

Controla trial e assinatura do estabelecimento.

Campos:

- `id uuid primary key`
- `establishment_id uuid not null unique references establishments(id) on delete cascade`
- `status subscription_status not null default 'trialing'`
- `plan_code text not null default 'founder'`
- `price_cents integer not null`
- `trial_started_at timestamptz not null`
- `trial_ends_at timestamptz not null`
- `current_period_started_at timestamptz null`
- `current_period_ends_at timestamptz null`
- `cancel_at_period_end boolean not null default false`
- `payment_provider text null`
- `provider_customer_id text null`
- `provider_subscription_id text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Na V1, alterações podem ser manuais pelo painel Cruz Labs. A estrutura fica preparada para gateway de pagamento futuro.

## 12. `usage_events`

Registra eventos de ativação e uso do produto.

Campos:

- `id bigint generated always as identity primary key`
- `establishment_id uuid not null references establishments(id) on delete cascade`
- `user_id uuid null references auth.users(id) on delete set null`
- `event_name text not null`
- `entity_type text null`
- `entity_id uuid null`
- `properties jsonb not null default '{}'::jsonb`
- `occurred_at timestamptz not null default now()`

Eventos iniciais:

- `account_created`
- `onboarding_started`
- `onboarding_completed`
- `professional_created`
- `service_created`
- `availability_configured`
- `public_link_opened`
- `public_link_shared`
- `first_appointment_created`
- `appointment_created`
- `appointment_cancelled`
- `trial_expired`
- `subscription_activated`
- `subscription_cancelled`

Regras:

- eventos críticos devem ser gerados pelo servidor ou por trigger confiável;
- eventos do navegador não devem ser aceitos como verdade absoluta para métricas financeiras ou de segurança.

## 13. `feedbacks`

Armazena feedbacks da fase beta.

Campos:

- `id uuid primary key`
- `establishment_id uuid not null references establishments(id) on delete cascade`
- `submitted_by uuid null references auth.users(id)`
- `category text not null`
- `rating smallint null`
- `message text not null`
- `status text not null default 'new'`
- `admin_notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## 14. `admin_audit_logs`

Registra ações administrativas sensíveis da Cruz Labs.

Campos:

- `id bigint generated always as identity primary key`
- `admin_user_id uuid not null references auth.users(id)`
- `establishment_id uuid null references establishments(id)`
- `action text not null`
- `target_type text null`
- `target_id uuid null`
- `before_data jsonb null`
- `after_data jsonb null`
- `created_at timestamptz not null default now()`

Exemplos:

- extensão do trial;
- ativação manual;
- suspensão;
- reativação;
- alteração de assinatura;
- alteração de papel de usuário;
- acesso administrativo sensível.

## 15. `notifications`

Notificações internas do painel.

Campos:

- `id uuid primary key`
- `establishment_id uuid null references establishments(id) on delete cascade`
- `user_id uuid null references auth.users(id) on delete cascade`
- `title text not null`
- `message text not null`
- `type text not null`
- `read_at timestamptz null`
- `created_at timestamptz not null default now()`

Uso inicial:

- trial próximo do fim;
- configuração incompleta;
- novo agendamento;
- conflito administrativo;
- aviso da Cruz Labs.

## Índices obrigatórios

Além das chaves primárias e uniques:

- `establishment_members(user_id, is_active)`;
- `establishment_members(establishment_id, role, is_active)`;
- `professionals(establishment_id, is_active)`;
- `services(establishment_id, is_active)`;
- `professional_services(establishment_id, professional_id, is_active)`;
- `weekly_availability(professional_id, weekday, is_active)`;
- `availability_exceptions(professional_id, starts_at, ends_at)`;
- `customers(establishment_id, phone_normalized)`;
- `appointments(establishment_id, starts_at)`;
- `appointments(professional_id, starts_at, status)`;
- `appointments(customer_id, starts_at desc)`;
- `appointments(establishment_id, status, starts_at)`;
- `usage_events(establishment_id, occurred_at desc)`;
- `usage_events(event_name, occurred_at desc)`;
- `feedbacks(establishment_id, status, created_at desc)`;
- `admin_audit_logs(establishment_id, created_at desc)`.

## Funções e triggers planejados

### `set_updated_at()`

Atualiza automaticamente `updated_at` em tabelas mutáveis.

### `handle_new_auth_user()`

Cria `profiles` após cadastro no Supabase Auth.

Cuidados:

- deve usar `security definer` apenas se necessário;
- `search_path` deve ser definido explicitamente;
- permissão `EXECUTE` deve ser revogada de `PUBLIC` quando aplicável;
- deve ser testada porque falhas podem impedir novos cadastros.

### `normalize_phone()`

Normaliza telefone para comparação e deduplicação.

### `validate_same_establishment()`

Garante consistência entre entidades relacionadas.

### `create_public_appointment()`

Função transacional para agendamento público:

1. valida estabelecimento e `booking_enabled`;
2. valida trial/assinatura;
3. valida serviço ativo;
4. valida profissional ativo e vínculo com serviço;
5. recalcula duração e horário final;
6. verifica disponibilidade semanal e exceções;
7. localiza ou cria cliente pelo telefone normalizado;
8. tenta inserir o agendamento;
9. deixa a restrição de exclusão impedir concorrência;
10. registra evento de uso;
11. retorna confirmação mínima, sem expor dados internos.

Essa função não deve aceitar `establishment_id` isolado como confiança. Deve resolver o estabelecimento pelo slug público e validar todas as relações.

### `expire_trials()`

Processo agendado futuro para:

- localizar trials vencidos;
- alterar estado para `past_due`;
- desabilitar novos agendamentos;
- gerar notificação;
- registrar evento.

## Relações principais

```text
auth.users
  └── profiles
  └── establishment_members ── establishments
                                  ├── professionals
                                  ├── services
                                  │    └── professional_services ── professionals
                                  ├── weekly_availability
                                  ├── availability_exceptions
                                  ├── customers
                                  ├── appointments
                                  ├── subscriptions
                                  ├── usage_events
                                  ├── feedbacks
                                  └── notifications
```

## Ordem sugerida de implementação

1. tipos e extensões;
2. profiles;
3. establishments;
4. establishment_members;
5. professionals;
6. services;
7. professional_services;
8. weekly_availability;
9. availability_exceptions;
10. customers;
11. appointments e restrição anticolisão;
12. subscriptions;
13. usage_events;
14. feedbacks;
15. notifications;
16. admin_audit_logs;
17. funções auxiliares;
18. políticas RLS;
19. grants da Data API;
20. testes de isolamento e concorrência.

## Decisões adiadas

Ficam fora da V1:

- comissões;
- estoque;
- pacotes e recorrências;
- múltiplos recursos físicos, como salas e equipamentos;
- pagamentos do atendimento;
- cashback;
- lista de espera;
- fila de encaixe;
- integração automática com WhatsApp;
- marketplace;
- prontuário clínico.
