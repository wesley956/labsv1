# Estrutura de Layout — Cruz Agenda

## Objetivo

Criar uma interface consistente, mobile first, simples para profissionais da beleza e escalável para estabelecimentos com várias equipes.

## Estrutura geral do produto

O produto terá três superfícies principais:

1. Site institucional
2. Painel do estabelecimento
3. Painel administrativo Cruz Labs

A página pública de agendamento pertence ao produto, mas possui navegação simplificada e foco total na conversão.

---

## 1. Site institucional

### Cabeçalho

- Logo Cruz Agenda
- Recursos
- Como funciona
- Planos
- Entrar
- Botão `Começar grátis`

No celular, os links ficam em menu recolhível e o botão principal permanece visível.

### Página inicial

Seções planejadas:

1. Hero com proposta principal
2. Demonstração visual da agenda
3. Principais benefícios
4. Como funciona em três passos
5. Recursos para autônomos e salões
6. Período gratuito de 15 dias
7. Depoimentos futuramente
8. Plano e chamada para cadastro
9. Perguntas frequentes
10. Rodapé legal e institucional

Mensagem principal sugerida:

> Sua agenda organizada. Seus clientes agendando sozinhos.

---

## 2. Painel do estabelecimento

### Desktop

Estrutura:

- Barra lateral fixa à esquerda
- Cabeçalho superior compacto
- Conteúdo central com largura fluida
- Painéis laterais apenas quando necessários

#### Barra lateral

- Visão geral
- Agenda
- Agendamentos
- Profissionais
- Serviços
- Clientes
- Disponibilidade
- Meu link
- Plano e assinatura
- Configurações

Na parte inferior:

- Ajuda
- Perfil do usuário
- Sair

#### Cabeçalho superior

- Nome da página
- Seletor de estabelecimento futuramente
- Busca contextual quando necessária
- Notificações
- Ação principal da tela
- Avatar do usuário

### Mobile

Estrutura recomendada:

#### Navegação inferior

- Início
- Agenda
- Novo agendamento
- Clientes
- Mais

O botão central de novo agendamento pode receber destaque, mas não deve quebrar o padrão visual.

#### Menu `Mais`

- Profissionais
- Serviços
- Disponibilidade
- Meu link
- Plano
- Configurações
- Ajuda

### Padrão de página

Cada tela deve seguir:

1. Título
2. Descrição curta quando necessária
3. Ação principal
4. Filtros ou período
5. Conteúdo
6. Estado vazio ou feedback

Evitar múltiplos botões primários na mesma área.

---

## 3. Dashboard do estabelecimento

### Conteúdo inicial

- Saudação e data
- Estado do período gratuito
- Próximo atendimento
- Atendimentos de hoje
- Agendamentos da semana
- Clientes atendidos
- Atalhos de ação
- Lista resumida do dia
- Progresso de configuração inicial

### Checklist de ativação

- Cadastrar estabelecimento
- Cadastrar primeiro profissional
- Cadastrar primeiro serviço
- Definir disponibilidade
- Personalizar link
- Receber primeiro agendamento

O checklist desaparece ou fica recolhido após ser concluído.

---

## 4. Agenda

### Desktop

Visualizações:

- Dia
- Semana
- Lista

A primeira versão deve priorizar `Dia` e `Semana`.

Recursos:

- Filtro por profissional
- Navegação entre datas
- Botão `Hoje`
- Cores discretas por profissional ou status
- Clique no horário para criar agendamento
- Clique no agendamento para abrir detalhes

Em estabelecimentos com vários profissionais, a visão diária pode mostrar colunas por profissional.

### Mobile

Priorizar:

- Data atual
- Seletor horizontal de dias
- Filtro de profissional
- Lista cronológica de horários
- Botão flutuante ou ação fixa para novo agendamento

Evitar tentar reproduzir uma grade semanal comprimida no celular.

---

## 5. Agendamentos

Tela em formato de lista ou tabela responsiva.

Filtros:

- Data
- Profissional
- Serviço
- Status
- Busca por cliente

Status iniciais:

- Confirmado
- Concluído
- Cancelado
- Não compareceu

No celular, cada registro vira um cartão compacto.

---

## 6. Profissionais

### Lista

Cada profissional apresenta:

- Foto ou iniciais
- Nome
- Especialidade
- Serviços vinculados
- Estado ativo/inativo
- Próximo atendimento opcional

Ações:

- Adicionar
- Editar
- Vincular serviços
- Definir disponibilidade
- Desativar

---

## 7. Serviços

Cada serviço apresenta:

- Nome
- Duração
- Preço
- Profissionais vinculados
- Estado

A tela deve permitir criar um serviço em poucos campos e vincular profissionais sem fluxo excessivamente longo.

---

## 8. Clientes

### Lista

- Nome
- WhatsApp
- Último atendimento
- Quantidade de agendamentos
- Ausências

### Detalhes

- Dados básicos
- Observações
- Histórico
- Próximo agendamento

Informações sensíveis devem ser exibidas apenas aos usuários autorizados do estabelecimento.

---

## 9. Disponibilidade

A tela deve separar:

- Horários semanais recorrentes
- Intervalos
- Folgas e bloqueios específicos

Fluxo ideal:

1. Escolher profissional
2. Configurar dias da semana
3. Definir início e fim
4. Adicionar intervalo
5. Salvar

Bloqueios pontuais ficam em uma seção ou tela própria.

---

## 10. Meu link

Tela orientada ao compartilhamento.

Mostrar:

- URL pública
- Botão copiar
- Botão compartilhar
- Prévia da página
- QR Code futuramente
- Estado de publicação
- Personalização permitida

---

## 11. Página pública do estabelecimento

### Estrutura

- Identidade do estabelecimento
- Nome e especialidade
- Endereço ou modalidade
- Serviço
- Profissional
- Data
- Horário
- Dados do cliente
- Revisão
- Confirmação

### Princípios

- Sem menu administrativo
- Sem cadastro obrigatório do cliente
- Poucas distrações
- Botão principal sempre claro
- Progresso visível
- Boa experiência com uma mão no celular

O sistema pode usar etapas, mas deve preservar os dados ao voltar.

---

## 12. Painel Cruz Labs

### Desktop prioritário

Barra lateral:

- Visão geral
- Estabelecimentos
- Trials
- Assinaturas
- Uso da plataforma
- Feedbacks
- Comunicados
- Configurações

Dashboard:

- Total de contas
- Trials ativos
- Contas pagantes
- Trials vencidos
- Conversão
- Agendamentos processados
- Ativação por etapa
- Contas que precisam de atenção

### Detalhe do estabelecimento

- Perfil
- Responsável
- Estado da conta
- Trial
- Plano
- Último acesso
- Configuração concluída
- Profissionais
- Serviços
- Quantidade de agendamentos
- Histórico administrativo

O administrador Cruz Labs não deve navegar livremente por dados pessoais sem necessidade operacional registrada.

---

## Componentes essenciais

Construir e reutilizar:

- AppShell
- Sidebar
- MobileBottomNavigation
- PageHeader
- Card
- MetricCard
- DataTable
- EmptyState
- StatusBadge
- SearchInput
- FilterBar
- ConfirmDialog
- FormField
- DatePicker
- TimePicker
- ProfessionalAvatar
- AppointmentCard
- TrialBanner
- SetupChecklist

## Regras contra sobrecarga

- Um componente para cada padrão, não uma versão diferente por tela
- Um botão primário por área principal
- Máximo de três níveis claros de hierarquia visual
- Não criar dashboard com informação sem ação associada
- Não exibir todos os recursos simultaneamente no mobile
- Não duplicar agenda e agendamentos sem finalidade distinta
- Ações destrutivas sempre confirmadas
- Estados vazios devem ensinar a próxima ação

## Próxima definição

Antes da implementação visual final, criar wireframes das telas prioritárias:

1. Login e cadastro
2. Onboarding
3. Dashboard
4. Agenda desktop
5. Agenda mobile
6. Profissionais
7. Serviços
8. Página pública
9. Painel Cruz Labs
