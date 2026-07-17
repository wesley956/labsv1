# Segurança e RLS no Supabase — Cruz Agenda V1

## Objetivo

Este documento define como o Cruz Agenda protegerá os dados no Supabase. A aplicação é multiestabelecimento, portanto a regra principal é:

> Um usuário autenticado só pode acessar dados dos estabelecimentos aos quais pertence, respeitando seu papel. Um estabelecimento nunca pode acessar dados de outro.

A interface não é considerada uma barreira de segurança. Toda autorização deve ser validada no banco por Row Level Security (RLS), constraints e funções server-side.

## Princípios obrigatórios

- RLS em todas as tabelas do schema `public`.
- Grants mínimos para `anon` e `authenticated`.
- Nunca expor `service_role` no navegador.
- Nunca usar `raw_user_meta_data` para autorização.
- Políticas devem usar `TO anon` ou `TO authenticated` explicitamente.
- `TO authenticated` sozinho não é autorização.
- Políticas de `UPDATE` devem possuir `USING` e `WITH CHECK`.
- Toda coluna usada em políticas deve ser indexada quando necessário.
- Views acessíveis pela API devem usar `security_invoker = true`.
- Funções `security definer` devem ficar em schema privado, com `search_path` fixo e execução revogada de `PUBLIC`.
- Dados públicos devem ser expostos por funções ou views específicas, não por acesso amplo às tabelas internas.

## Schemas

### `public`

Contém tabelas de negócio acessadas pelo aplicativo com RLS.

### `private`

Contém funções auxiliares de autorização e operações privilegiadas.

O schema `private` não deve ser exposto na Data API.

## Modelo de autorização

A tabela `establishment_members` é a fonte principal de autorização para o painel do estabelecimento.

Um usuário pertence a um estabelecimento quando existe registro ativo com:

```sql
user_id = auth.uid()
and is_active = true
```

Papéis:

- `owner`: controle completo do estabelecimento e assinatura;
- `admin`: gerencia operação, profissionais, serviços e agenda;
- `receptionist`: gerencia agenda e clientes, sem assinatura ou configurações críticas;
- `professional`: visualiza e administra apenas sua agenda quando houver perfil vinculado;
- administrador Cruz Labs: acesso administrativo por função protegida e papel de plataforma.

## Funções auxiliares de autorização

As funções abaixo devem ficar em `private`.

### `private.is_platform_admin()`

Retorna verdadeiro apenas quando o usuário autenticado é administrador da Cruz Labs.

Requisitos:

- consultar fonte não editável pelo usuário;
- pode consultar `profiles.is_platform_admin` apenas se o cliente não possuir permissão para alterar essa coluna;
- alternativa preferida: tabela privada de administradores;
- retornar falso quando `auth.uid()` for nulo.

### `private.is_establishment_member(target_establishment_id uuid)`

Retorna verdadeiro quando o usuário é membro ativo do estabelecimento.

### `private.has_establishment_role(target_establishment_id uuid, allowed_roles membership_role[])`

Retorna verdadeiro quando o usuário possui um dos papéis permitidos.

### `private.owns_professional(target_professional_id uuid)`

Usada futuramente para limitar o profissional à própria agenda.

## Matriz de permissões

| Recurso | Owner | Admin | Receptionist | Professional | Cruz Labs | Público |
|---|---:|---:|---:|---:|---:|---:|
| Estabelecimento: consultar | Sim | Sim | Sim | Sim | Sim | Dados públicos mínimos |
| Estabelecimento: editar | Sim | Sim | Não | Não | Sim | Não |
| Assinatura | Sim | Não | Não | Não | Sim | Não |
| Membros e papéis | Sim | Parcial | Não | Não | Sim | Não |
| Profissionais | Sim | Sim | Consulta | Próprio | Sim | Ativos mínimos |
| Serviços | Sim | Sim | Consulta | Consulta vinculada | Sim | Ativos mínimos |
| Disponibilidade | Sim | Sim | Sim | Própria | Sim | Horários calculados |
| Clientes | Sim | Sim | Sim | Ligados à agenda | Sim | Não |
| Agendamentos | Sim | Sim | Sim | Próprios | Sim | Criar por RPC |
| Métricas | Sim | Sim | Limitadas | Limitadas | Sim | Não |
| Feedback | Criar/consultar próprio | Criar/consultar próprio | Criar | Criar | Gerenciar | Não |
| Auditoria administrativa | Não | Não | Não | Não | Sim | Não |

## Políticas por tabela

## `profiles`

### SELECT

Usuário pode consultar o próprio perfil.

```sql
using ((select auth.uid()) = id)
```

Administradores Cruz Labs podem consultar perfis por operação server-side protegida.

### UPDATE

Usuário pode alterar apenas o próprio registro, mas nunca `is_platform_admin`.

Recomendação:

- não conceder privilégio de atualização dessa coluna ao papel `authenticated`;
- ou separar administradores em tabela privada.

### INSERT

Criado por trigger após cadastro no Auth. Não permitir insert direto pelo cliente.

## `establishments`

### SELECT autenticado

Permitido quando o usuário é membro ativo ou administrador da plataforma.

### UPDATE

- owner e admin podem alterar informações operacionais;
- apenas owner ou Cruz Labs altera assinatura, status, trial e campos financeiros;
- para evitar mudanças indevidas, campos críticos devem ser atualizados por RPC server-side, não por update genérico.

### INSERT

Criação deve ocorrer em uma operação transacional de onboarding que:

1. cria o estabelecimento;
2. cria o vínculo do usuário como owner;
3. cria a assinatura trial;
4. registra evento de conta criada.

### DELETE

Não permitir delete direto. Usar arquivamento/cancelamento.

## `establishment_members`

### SELECT

Membros ativos podem consultar membros do próprio estabelecimento conforme necessidade da interface.

### INSERT

- owner pode convidar qualquer papel;
- admin pode convidar admin, receptionist ou professional, conforme regra futura;
- nunca permitir que o usuário se adicione a outro estabelecimento apenas informando o ID.

### UPDATE

- owner gerencia papéis;
- ninguém remove ou rebaixa o último owner ativo;
- usuário comum pode atualizar somente preferências pessoais separadas, não papel.

### DELETE

Evitar delete físico. Usar `is_active = false`.

## `professionals`

### SELECT

- membros consultam profissionais do próprio estabelecimento;
- público consulta apenas profissionais ativos por função/view pública mínima.

### INSERT/UPDATE

Owner e admin.

Receptionist pode consultar e, se aprovado futuramente, ajustar agenda sem editar cadastro estrutural.

### DELETE

Não permitir delete físico. Arquivar após verificar agendamentos futuros.

## `services`

### SELECT

- membros consultam serviços do estabelecimento;
- público consulta apenas serviços ativos e campos necessários.

### INSERT/UPDATE

Owner e admin.

### DELETE

Não permitir delete físico quando houver histórico. Usar `is_active = false`.

## `professional_services`

### SELECT

Membros do estabelecimento e leitura pública mínima para cálculo de opções.

### INSERT/UPDATE/DELETE

Owner e admin, sempre validando que profissional e serviço pertencem ao mesmo estabelecimento.

## `weekly_availability`

### SELECT

Membros do estabelecimento.

Para o público, não expor diretamente. A disponibilidade pública deve ser calculada por RPC.

### INSERT/UPDATE/DELETE

- owner e admin para qualquer profissional;
- receptionist conforme permissão operacional definida;
- professional somente para o próprio registro quando login individual entrar em uso.

## `availability_exceptions`

Mesma lógica da disponibilidade semanal.

Toda criação deve validar:

- estabelecimento correto;
- profissional correto;
- intervalo válido;
- permissão do usuário;
- conflito com agendamentos existentes, gerando alerta sem apagar registros.

## `customers`

### SELECT

Somente membros autorizados do estabelecimento.

### INSERT/UPDATE

- painel: owner, admin e receptionist;
- público: apenas indiretamente pela função de criação de agendamento.

### DELETE

Não permitir delete direto. Para LGPD, usar fluxo administrativo de anonimização ou exclusão controlada.

### Público

Nenhuma policy `anon` de leitura.

## `appointments`

### SELECT

- owner, admin e receptionist: todos do estabelecimento;
- professional: somente os vinculados ao próprio `professional_id`;
- Cruz Labs: via operação administrativa protegida;
- público: sem leitura direta.

### INSERT pelo painel

Permitido a owner, admin e receptionist, desde que:

- o estabelecimento esteja ativo para novos agendamentos;
- todos os IDs pertençam ao mesmo estabelecimento;
- profissional execute o serviço;
- horário esteja disponível;
- não exista sobreposição.

### INSERT público

Não criar policy ampla para `anon` inserir diretamente.

Usar RPC transacional `create_public_appointment`, que valida todos os dados e retorna somente informações mínimas.

### UPDATE

- owner, admin e receptionist podem reagendar e alterar status;
- professional pode atualizar status dos próprios atendimentos conforme regra;
- `establishment_id`, snapshots e origem não devem ser livremente alteráveis;
- reagendamento deve passar por função transacional que revalida conflito.

### DELETE

Proibido. Cancelamento é mudança de status.

## `subscriptions`

### SELECT

Owner do estabelecimento e Cruz Labs.

### INSERT/UPDATE

Somente backend/Cruz Labs.

Nenhum cliente autenticado deve poder ativar a própria assinatura por update direto.

## `usage_events`

### SELECT

- estabelecimento consulta métricas agregadas próprias;
- Cruz Labs consulta globalmente;
- preferir views agregadas com `security_invoker` ou RPC.

### INSERT

Eventos confiáveis criados pelo servidor, banco ou funções protegidas.

Não permitir insert irrestrito pelo navegador para eventos críticos.

## `feedbacks`

Membros podem inserir e consultar feedbacks do próprio estabelecimento. Cruz Labs pode alterar status e notas administrativas.

## `admin_audit_logs`

Somente Cruz Labs.

- sem policy de acesso para usuários comuns;
- inserção realizada automaticamente pelas funções administrativas;
- registros não podem ser alterados ou apagados pelo painel comum.

## `notifications`

Usuário consulta notificações dirigidas ao próprio `user_id` ou estabelecimento ao qual pertence.

Usuário pode apenas marcar como lida. Criação deve ocorrer pelo servidor ou Cruz Labs.

## Acesso público seguro

A página pública precisa consultar informações sem expor tabelas internas.

Recomendação:

### RPC `get_public_establishment(slug text)`

Retorna somente:

- nome;
- descrição;
- logo;
- segmento;
- cidade;
- Instagram;
- cor pública;
- estado de disponibilidade pública.

Nunca retorna:

- e-mail do proprietário;
- dados da assinatura;
- IDs de usuários;
- métricas;
- dados de clientes;
- notas internas.

### RPC `get_public_services(slug text)`

Retorna serviços ativos e informações mínimas.

### RPC `get_public_professionals(slug text, service_id uuid)`

Retorna profissionais ativos vinculados ao serviço.

### RPC `get_available_slots(slug text, service_id uuid, professional_id uuid, date date)`

Deve:

1. validar conta pública ativa;
2. validar antecedência mínima de 2 horas;
3. limitar consulta a 60 dias;
4. calcular disponibilidade recorrente;
5. aplicar exceções;
6. retirar horários ocupados;
7. aplicar duração e buffers;
8. respeitar timezone;
9. retornar somente horários, sem informações privadas.

### RPC `create_public_appointment(...)`

Deve incluir:

- validação de payload;
- normalização de telefone;
- limite de tamanho para textos;
- rate limiting na camada de aplicação/Edge Function;
- proteção contra spam;
- revalidação do slot;
- transação única;
- tratamento de conflito de exclusão;
- resposta genérica, sem revelar agenda interna.

## Proteção contra abuso da página pública

- rate limit por IP, slug e telefone;
- CAPTCHA adaptativo após comportamento suspeito;
- limite de consultas de disponibilidade;
- mensagens de erro genéricas;
- não informar se um telefone já existe;
- registrar tentativas excessivas;
- impedir agendamentos em massa automatizados;
- limitar comprimento de nome e observações;
- bloquear HTML e conteúdo inesperado;
- aplicar validação Zod no servidor e constraints no banco.

## Storage

Buckets planejados:

### `avatars`

- fotos de usuários e profissionais;
- leitura pública apenas quando necessário;
- upload autenticado;
- caminho deve incorporar `establishment_id` ou `user_id`;
- usuário não pode escrever em pasta de outro estabelecimento.

### `establishment-assets`

- logos e imagens públicas do estabelecimento;
- leitura pública;
- escrita somente por owner/admin do estabelecimento.

Políticas de Storage devem validar o caminho do objeto. Para substituição com upsert, são necessários privilégios de `INSERT`, `SELECT` e `UPDATE`.

## Grants da Data API

Após criar tabelas por SQL:

- conceder somente as operações necessárias a `authenticated`;
- evitar grants amplos para `anon` nas tabelas internas;
- para público, preferir `EXECUTE` nas RPCs específicas;
- confirmar configuração de schemas expostos no painel do Supabase;
- lembrar que GRANT define acesso ao objeto e RLS define acesso às linhas. Ambos são necessários.

## Views

Qualquer view acessível por `anon` ou `authenticated` deve usar:

```sql
with (security_invoker = true)
```

Caso uma view não precise ser pública:

- colocar em schema privado;
- revogar acesso de `anon` e `authenticated`.

## Funções privilegiadas

Quando `security definer` for realmente necessário:

- criar em `private`;
- definir `set search_path = ''` ou lista explícita segura;
- qualificar tabelas com schema;
- validar `auth.uid()` dentro da função;
- revogar `execute` de `PUBLIC`;
- conceder somente aos papéis necessários;
- nunca usar `security definer` apenas para contornar uma policy que falhou.

## Segurança do painel Cruz Labs

Ações sensíveis devem exigir:

- usuário autenticado;
- papel de administrador de plataforma;
- idealmente MFA futuramente;
- chamada server-side;
- registro em `admin_audit_logs`;
- confirmação explícita para suspensão, cancelamento e extensão de trial;
- nenhuma chave privilegiada no cliente.

## Estratégia para service role

A chave `service_role`:

- existe apenas no servidor;
- não usa prefixo `NEXT_PUBLIC_`;
- nunca é incluída no bundle do navegador;
- só será usada em rotas/ações realmente administrativas;
- não substitui validações de permissão na aplicação;
- deve ser rotacionada se houver suspeita de exposição.

## Testes obrigatórios de RLS

## Isolamento entre estabelecimentos

1. usuário A pertence ao estabelecimento A;
2. usuário B pertence ao estabelecimento B;
3. A não consegue selecionar, inserir, alterar ou excluir dados de B;
4. B não consegue acessar dados de A;
5. alterar manualmente `establishment_id` no request deve falhar.

## Papéis

- receptionist não altera assinatura;
- professional não acessa agenda de outro profissional;
- admin não remove último owner;
- usuário sem membership não acessa nenhum dado interno;
- usuário desativado perde acesso imediatamente conforme política baseada em tabela.

## Público

- `anon` não lê clientes;
- `anon` não lê agendamentos;
- `anon` não lê assinatura;
- `anon` não insere diretamente nas tabelas;
- RPC pública retorna somente campos aprovados;
- trial vencido impede criação de agendamento;
- concorrência no mesmo slot permite apenas um agendamento.

## Atualizações

- update sem SELECT policy deve ser detectado nos testes;
- usuário não consegue mudar `establishment_id` para escapar da policy;
- usuário não consegue promover a si mesmo;
- usuário não consegue ativar assinatura;
- snapshots de agendamento permanecem imutáveis.

## Storage

- usuário A não substitui arquivo de B;
- arquivo público pode ser lido sem permitir escrita;
- upsert funciona somente com os três privilégios necessários;
- exclusão respeita papel e estabelecimento.

## Checklist antes da produção

- [ ] RLS habilitado em toda tabela exposta.
- [ ] Policies revisadas por operação.
- [ ] Grants mínimos aplicados.
- [ ] Índices das policies criados.
- [ ] Views com `security_invoker`.
- [ ] Nenhuma função privilegiada exposta por acidente.
- [ ] `service_role` ausente do cliente.
- [ ] Segredos fora do repositório.
- [ ] Testes de isolamento executados.
- [ ] Teste de concorrência de agendamento executado.
- [ ] Advisors do Supabase executados e problemas corrigidos.
- [ ] Auth redirects e URLs de produção configurados.
- [ ] Rate limiting da página pública configurado.
- [ ] Backups e estratégia de restauração definidos.
- [ ] Política de retenção e LGPD revisada.

## Implementação futura

Quando o projeto Supabase for criado, a sequência correta será:

1. verificar versão da CLI e documentação atual;
2. inicializar Supabase no repositório;
3. criar migração com `supabase migration new <nome>`;
4. implementar tipos, tabelas, constraints e índices;
5. implementar funções e triggers;
6. habilitar RLS;
7. criar policies e grants;
8. subir ambiente local;
9. executar testes de isolamento e concorrência;
10. rodar advisors;
11. corrigir alertas;
12. gerar e revisar a migração final;
13. aplicar no projeto remoto somente após validação.
