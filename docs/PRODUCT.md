# Visão do Produto — Cruz Agenda

## Posicionamento

O Cruz Agenda é uma plataforma de agendamento direcionada inicialmente à área da beleza. A arquitetura poderá atender outros segmentos no futuro, mas a comunicação inicial será especializada para facilitar aquisição, reconhecimento e vendas.

## Filosofia

> Menos tempo organizando agenda e mais tempo atendendo clientes.

Toda nova funcionalidade deve reduzir trabalho manual, evitar conflitos ou facilitar a experiência de agendamento.

## Perfis do sistema

### Cruz Labs

Administra a plataforma, estabelecimentos, trials, assinaturas, métricas, feedbacks e estados das contas.

### Estabelecimento

É a organização assinante. Pode representar um profissional autônomo, studio, barbearia, clínica ou salão com vários profissionais.

### Usuários internos

Papéis planejados:

- Proprietário
- Administrador
- Recepcionista
- Profissional

### Cliente final

Agenda pelo link público sem precisar criar conta na V1.

## Estrutura multiestabelecimento e multiprofissional

Cada estabelecimento possui seus próprios:

- Usuários
- Profissionais
- Serviços
- Relações entre profissionais e serviços
- Disponibilidades
- Bloqueios
- Clientes
- Agendamentos
- Configurações
- Assinatura

Os dados de um estabelecimento nunca podem ser acessados por outro.

## Fluxo público principal

1. Escolher serviço
2. Escolher profissional ou qualquer disponível
3. Escolher data
4. Escolher horário
5. Informar nome e WhatsApp
6. Confirmar agendamento

## Escopo funcional da V1

### Painel do estabelecimento

- Cadastro e autenticação
- Configuração inicial guiada
- Cadastro de vários profissionais
- Cadastro de serviços
- Vínculo entre profissionais e serviços
- Disponibilidade individual
- Bloqueios e pausas
- Agenda geral e individual
- Agendamento manual
- Gestão simples de clientes
- Link público personalizado
- Configurações do estabelecimento
- Estado do trial e assinatura

### Página pública

- Perfil do estabelecimento
- Lista de serviços
- Escolha do profissional
- Calendário de disponibilidade
- Horários disponíveis
- Formulário do cliente
- Confirmação
- Prevenção de conflito e agendamento duplicado

### Painel Cruz Labs

- Dashboard geral
- Lista de estabelecimentos
- Detalhes de uso
- Controle de trial
- Ativação e bloqueio de contas
- Estado da assinatura
- Métricas de ativação e conversão
- Registro de feedbacks

## Trial

- Duração: 15 dias
- Início automático ao criar a conta
- Avisos próximos ao vencimento
- Após o vencimento, acesso para consulta permanece disponível
- Novos agendamentos ficam bloqueados até ativação
- O administrador Cruz Labs pode ajustar o estado manualmente

## Estratégia comercial inicial

- Aquisição prioritária por anúncios no Instagram
- Oferta de 15 dias grátis
- Primeiro preço simples, sem excesso de planos
- Uso real e feedback orientam a evolução
- Conversão para assinatura ao final do trial

## Métricas fundamentais

- Contas criadas
- Configuração inicial concluída
- Primeiro profissional cadastrado
- Primeiro serviço cadastrado
- Disponibilidade configurada
- Link público compartilhado
- Primeiro agendamento recebido
- Agendamentos por estabelecimento
- Último acesso
- Trial convertido
- Conta cancelada ou bloqueada

## Fora da V1

- Aplicativos Android e iOS nativos
- IA e chatbot
- RAG e agentes
- Estoque
- Comissão
- Folha de pagamento
- Metas por profissional
- Marketplace
- Pagamento do atendimento pelo cliente
- Integração automática com WhatsApp
- Permissões extremamente granulares
- Personalização irrestrita do site público

## Princípios técnicos

- Mobile first
- Componentes reutilizáveis
- Interface consistente
- Separação rigorosa de dados
- Evitar duplicação de regras
- Nenhuma funcionalidade sem objetivo claro
- Não adicionar dependências sem necessidade
- Segurança e validação no servidor
