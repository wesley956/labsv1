# Fluxos Funcionais da V1 — Cruz Agenda

Este documento é a referência oficial de comportamento da primeira versão do Cruz Agenda. Ele define o que cada função faz, quem pode usá-la, quais validações devem existir e qual resultado o sistema deve produzir.

## 1. Princípios gerais

- O sistema é multiestabelecimento e multiprofissional.
- Todo registro funcional pertence a um estabelecimento.
- Um estabelecimento nunca pode acessar dados de outro.
- O cliente final não precisa criar conta na V1.
- A interface é mobile first e deve manter o mesmo comportamento no tema claro e escuro.
- Regras críticas devem ser validadas no servidor, não apenas na interface.
- Nenhum agendamento pode ser criado se houver conflito de horário.
- Alterações importantes devem produzir feedback visual de sucesso ou erro.
- Exclusões que afetem histórico devem preferir inativação em vez de remoção definitiva.

## 2. Perfis e permissões da V1

### 2.1 Administrador Cruz Labs

Pode:

- visualizar todos os estabelecimentos;
- consultar métricas de uso;
- controlar trial, assinatura e estado da conta;
- bloquear e reativar estabelecimentos;
- registrar feedbacks e observações internas;
- consultar informações necessárias para suporte.

Não deve editar agendamentos ou dados operacionais do estabelecimento sem uma função explícita de suporte e registro da ação.

### 2.2 Proprietário do estabelecimento

Pode:

- configurar o estabelecimento;
- cadastrar, editar e inativar profissionais;
- cadastrar, editar e inativar serviços;
- vincular profissionais a serviços;
- definir disponibilidades e bloqueios;
- criar, editar, cancelar e concluir agendamentos;
- visualizar clientes;
- configurar o link público;
- consultar trial e assinatura.

### 2.3 Administrador ou recepcionista

Na V1, pode operar agenda, agendamentos, clientes, profissionais, serviços e disponibilidade. Não pode transferir propriedade da conta nem executar ações financeiras críticas.

### 2.4 Profissional

A arquitetura será preparada para acesso individual. Na V1, o acesso próprio pode ser limitado ou adiado. Quando habilitado, deve visualizar e operar apenas a própria agenda, salvo permissão adicional.

### 2.5 Cliente final

Pode:

- acessar a página pública;
- escolher serviço, profissional, data e horário;
- informar nome e WhatsApp;
- confirmar o agendamento.

Não possui acesso ao painel administrativo.

---

# PARTE A — PAINEL DO ESTABELECIMENTO

## 3. Cadastro e autenticação

### 3.1 Criar conta

Fluxo:

1. Usuário informa nome, e-mail, WhatsApp e senha.
2. Aceita Termos de Uso e Política de Privacidade.
3. Sistema valida campos e unicidade do e-mail.
4. Sistema cria usuário proprietário.
5. Sistema cria o estabelecimento em estado `configuracao_pendente`.
6. Trial de 15 dias é iniciado automaticamente.
7. Usuário é direcionado à configuração inicial.

Validações:

- e-mail válido e não cadastrado;
- senha com requisito mínimo de segurança;
- WhatsApp em formato válido;
- aceite obrigatório dos documentos legais.

Erros:

- e-mail já cadastrado: oferecer login ou recuperação de senha;
- falha de criação: não criar registros parciais sem vínculo.

### 3.2 Login

Fluxo:

1. Usuário informa e-mail e senha.
2. Sistema autentica.
3. Sistema identifica o estabelecimento e o papel do usuário.
4. Se a configuração estiver incompleta, direciona ao onboarding.
5. Caso contrário, abre o dashboard.

Estados especiais:

- conta bloqueada: mostrar motivo genérico e canal de suporte;
- trial expirado: permitir entrada em modo de consulta, com aviso de assinatura;
- usuário inativo: negar acesso.

### 3.3 Recuperar senha

Fluxo:

1. Usuário informa e-mail.
2. Sistema envia link seguro de redefinição.
3. Usuário define nova senha.
4. Sessões antigas podem ser invalidadas por segurança.

A resposta não deve revelar se um e-mail inexistente está ou não cadastrado.

## 4. Configuração inicial guiada

Objetivo: levar o estabelecimento ao primeiro agendamento possível com o menor número de etapas.

Etapas:

1. Dados do estabelecimento.
2. Profissional principal.
3. Primeiro serviço.
4. Horário de funcionamento do profissional.
5. Criação do link público.
6. Tela de conclusão com ação de compartilhar.

### 4.1 Dados do estabelecimento

Campos:

- nome público;
- segmento;
- descrição curta;
- WhatsApp;
- endereço opcional;
- logotipo ou foto opcional;
- slug do link público.

Validações:

- nome obrigatório;
- slug único, normalizado e sem palavras reservadas;
- imagem com tipo e tamanho permitidos.

### 4.2 Profissional principal

Fluxo:

1. Sugerir o próprio responsável como primeiro profissional.
2. Permitir alterar nome, foto, especialidade e telefone.
3. Criar profissional ativo vinculado ao estabelecimento.

### 4.3 Primeiro serviço

Campos:

- nome;
- descrição opcional;
- duração;
- preço;
- profissionais que realizam o serviço.

O profissional principal deve aparecer pré-selecionado.

### 4.4 Primeira disponibilidade

Fluxo:

1. Exibir dias da semana.
2. Permitir copiar horário para outros dias.
3. Definir início, fim e intervalo opcional.
4. Validar que o término seja posterior ao início.
5. Salvar disponibilidade recorrente.

### 4.5 Conclusão do onboarding

O sistema marca a configuração como concluída quando houver, no mínimo:

- estabelecimento válido;
- um profissional ativo;
- um serviço ativo ligado a um profissional;
- disponibilidade válida;
- slug público definido.

Resultado:

- exibir link público;
- permitir copiar e compartilhar;
- direcionar ao dashboard.

## 5. Dashboard — Visão geral

Objetivo: mostrar o que exige atenção hoje e facilitar as ações mais frequentes.

Conteúdo:

- agendamentos de hoje;
- próximos atendimentos;
- total de clientes ativos;
- resumo da semana;
- estado do trial ou assinatura;
- checklist de configuração;
- link público;
- atalhos para novo agendamento, serviço e profissional.

Regras:

- valores devem considerar o fuso horário do estabelecimento;
- cards sem dados devem ter estado vazio útil;
- métricas não podem misturar dados de outros estabelecimentos;
- faturamento exibido na V1 é estimado com base no preço dos serviços concluídos, não uma confirmação de recebimento.

## 6. Profissionais

### 6.1 Listar profissionais

Exibir:

- foto;
- nome;
- especialidade;
- serviços vinculados;
- telefone;
- status;
- ações.

Filtros:

- ativos;
- inativos;
- busca por nome.

### 6.2 Adicionar profissional

Campos:

- nome;
- foto opcional;
- especialidade;
- telefone opcional;
- cor de identificação na agenda;
- serviços executados;
- status ativo.

Resultado:

- profissional disponível para configuração de agenda e vínculo com serviços.

### 6.3 Editar profissional

Pode alterar dados pessoais, especialidade, cor e serviços.

Alterações não devem modificar o histórico de agendamentos antigos.

### 6.4 Inativar profissional

Regras:

- profissional com agendamentos futuros não pode ser inativado silenciosamente;
- sistema deve informar quantos agendamentos serão afetados;
- usuário deve cancelar ou transferir os futuros agendamentos antes da inativação, ou confirmar um fluxo assistido;
- histórico permanece preservado.

## 7. Serviços

### 7.1 Listar serviços

Exibir:

- nome;
- duração;
- preço;
- profissionais vinculados;
- status.

### 7.2 Adicionar serviço

Campos:

- nome;
- descrição opcional;
- duração em minutos;
- preço;
- intervalo adicional após atendimento opcional;
- profissionais aptos;
- status ativo.

Validações:

- duração maior que zero;
- preço não negativo;
- pelo menos um profissional vinculado para publicação.

### 7.3 Editar serviço

Mudanças de preço e duração afetam apenas novos agendamentos. Agendamentos já criados devem manter cópia do nome, preço e duração usados no momento da reserva.

### 7.4 Inativar serviço

- remove o serviço da página pública;
- impede novos agendamentos;
- preserva histórico;
- agendamentos futuros existentes continuam visíveis e exigem tratamento manual se necessário.

## 8. Relação entre profissionais e serviços

Regras:

- um serviço pode ser executado por vários profissionais;
- um profissional pode executar vários serviços;
- o vínculo pode ser ativado ou removido sem apagar histórico;
- na V1, preço e duração são definidos pelo serviço e iguais para todos os profissionais;
- preço e duração específicos por profissional ficam para versão futura.

## 9. Disponibilidade

### 9.1 Disponibilidade recorrente

Cada profissional possui horários próprios por dia da semana.

Pode haver mais de um período no mesmo dia, por exemplo:

- 08:00–12:00;
- 13:00–18:00.

Validações:

- períodos não podem se sobrepor;
- início deve ser anterior ao fim;
- profissional inativo não recebe novos horários.

### 9.2 Bloqueios e exceções

Tipos:

- pausa;
- compromisso;
- folga;
- férias;
- indisponibilidade extraordinária.

Fluxo:

1. Selecionar profissional.
2. Informar data ou período.
3. Informar horário ou marcar dia inteiro.
4. Adicionar motivo opcional.
5. Salvar.

Se o bloqueio colidir com agendamentos existentes, o sistema deve alertar e exigir resolução, sem cancelar automaticamente.

### 9.3 Geração de horários disponíveis

Para um serviço, profissional e data, o sistema deve:

1. carregar disponibilidade recorrente;
2. aplicar exceções e bloqueios;
3. considerar duração do serviço e intervalo adicional;
4. remover horários conflitantes com agendamentos ativos;
5. aplicar antecedência mínima;
6. aplicar limite máximo de agendamento futuro;
7. retornar apenas horários completos que caibam dentro da jornada.

Configuração inicial recomendada da V1:

- intervalo de grade: 30 minutos;
- antecedência mínima: 2 horas;
- limite futuro: 60 dias;
- fuso horário definido pelo estabelecimento;
- esses valores poderão ser configuráveis posteriormente.

## 10. Agenda

### 10.1 Visualização

No desktop:

- dia e semana;
- colunas por profissional;
- filtros por profissional e status.

No celular:

- lista cronológica do dia;
- seletor horizontal de datas;
- filtro de profissional.

Cores devem identificar profissional ou status sem depender apenas da cor para acessibilidade.

### 10.2 Criar agendamento manual

Fluxo:

1. Selecionar cliente existente ou criar novo.
2. Selecionar serviço.
3. Selecionar profissional apto.
4. Selecionar data e horário.
5. Informar observação opcional.
6. Validar conflito.
7. Confirmar.

O painel pode permitir encaixe manual fora da grade, desde que esteja dentro da disponibilidade e sem conflito. Forçar conflito não entra na V1.

### 10.3 Abrir detalhes do agendamento

Exibir:

- cliente;
- WhatsApp;
- serviço;
- profissional;
- início e fim;
- preço registrado;
- status;
- origem;
- observações;
- histórico básico de alterações.

Ações:

- editar;
- reagendar;
- cancelar;
- marcar como concluído;
- marcar como não compareceu.

### 10.4 Reagendar

Fluxo:

1. Abrir agendamento.
2. Escolher nova data, horário ou profissional.
3. Recalcular disponibilidade.
4. Validar conflito.
5. Confirmar alteração.
6. Preservar registro da alteração.

### 10.5 Cancelar

Fluxo:

1. Selecionar cancelar.
2. Informar motivo opcional.
3. Confirmar.
4. Alterar status para `cancelado`.
5. Liberar horário imediatamente.

O registro não é apagado.

### 10.6 Concluir atendimento

Ao final do serviço, usuário marca como `concluido`.

Efeitos:

- conta no histórico do cliente;
- entra no faturamento estimado;
- não pode voltar automaticamente a confirmado sem ação explícita.

### 10.7 Não compareceu

Usuário marca `nao_compareceu`.

Efeitos:

- preserva histórico;
- não entra em faturamento concluído;
- ajuda a futura métrica de faltas.

## 11. Estados do agendamento

Estados oficiais da V1:

- `confirmado`;
- `concluido`;
- `cancelado`;
- `nao_compareceu`.

Origem:

- `publico`;
- `manual`.

Regras:

- somente `confirmado` bloqueia horário futuro;
- `concluido` preserva ocupação histórica;
- `cancelado` libera horário;
- `nao_compareceu` preserva histórico.

## 12. Clientes

### 12.1 Criação automática

Ao receber um agendamento público:

1. normalizar WhatsApp;
2. buscar cliente do mesmo estabelecimento pelo telefone;
3. atualizar nome se necessário, sem apagar dados internos;
4. criar novo cliente se não existir;
5. vincular ao agendamento.

Clientes de estabelecimentos diferentes nunca devem ser mesclados.

### 12.2 Lista de clientes

Exibir:

- nome;
- WhatsApp;
- quantidade de agendamentos;
- último atendimento;
- próximo atendimento;
- status.

### 12.3 Detalhe do cliente

Exibir:

- dados básicos;
- observações internas;
- histórico de agendamentos;
- total de atendimentos concluídos;
- faltas e cancelamentos.

### 12.4 Editar ou inativar cliente

- telefone pode ser atualizado com validação de duplicidade;
- inativação não apaga histórico;
- exclusão definitiva será tratada por fluxo de privacidade/LGPD.

## 13. Meu link

Exibir:

- URL pública;
- botão copiar;
- botão visualizar página;
- compartilhamento por WhatsApp, Instagram e link nativo quando disponível;
- estado de publicação.

Configurações da V1:

- slug;
- foto ou logo;
- descrição;
- telefone;
- endereço opcional;
- cor de destaque entre opções aprovadas;
- exibir ou ocultar profissionais inativos nunca é permitido: inativos não aparecem.

O link só pode ser publicado quando houver profissional, serviço e disponibilidade válidos.

## 14. Configurações do estabelecimento

Seções:

- dados do negócio;
- aparência;
- regras básicas de agenda;
- usuários e acesso, quando habilitado;
- privacidade;
- plano e assinatura.

### 14.1 Aparência

Opções:

- claro;
- escuro;
- seguir sistema.

A escolha é salva por usuário. A página pública pode seguir preferência do visitante ou padrão claro na V1.

## 15. Trial e assinatura no painel

### 15.1 Durante o trial

- mostrar dias restantes;
- manter todas as funções da V1 disponíveis;
- exibir chamadas para assinatura sem bloquear uso.

### 15.2 Trial próximo do fim

Avisos recomendados:

- 7 dias restantes;
- 3 dias restantes;
- 1 dia restante;
- dia do vencimento.

### 15.3 Trial expirado

Comportamento:

- usuário continua entrando;
- pode consultar dados e agenda existente;
- página pública deixa de aceitar novos agendamentos;
- criação manual de novos agendamentos fica bloqueada;
- edição de dados essenciais permanece disponível para não prender o usuário;
- sistema mostra ação clara para assinar.

### 15.4 Conta ativa

Após confirmação de assinatura, funções bloqueadas são liberadas sem perda de dados.

---

# PARTE B — PÁGINA PÚBLICA

## 16. Entrada na página pública

Ao acessar o slug:

1. sistema localiza estabelecimento ativo ou em trial válido;
2. verifica se a página está publicada;
3. carrega identidade, serviços e profissionais ativos;
4. exibe mensagem adequada se indisponível.

Estados:

- disponível;
- configuração incompleta;
- trial expirado;
- conta bloqueada;
- slug inexistente.

Não revelar detalhes administrativos ao visitante.

## 17. Escolher serviço

Exibir apenas serviços ativos, publicados e com ao menos um profissional apto.

Cada cartão mostra:

- nome;
- duração;
- preço;
- descrição curta opcional.

Ao selecionar, avançar para profissional.

## 18. Escolher profissional

Exibir:

- profissionais ativos vinculados ao serviço;
- foto, nome e especialidade;
- opção `Qualquer profissional disponível`.

Regra para qualquer profissional:

- o sistema agrega disponibilidades;
- no momento da escolha do horário, cada slot precisa estar associado a um profissional específico;
- após selecionar o horário, o profissional atribuído deve ser exibido na revisão.

## 19. Escolher data

Exibir somente datas dentro do limite futuro configurado.

Dias sem disponibilidade podem aparecer desabilitados.

A data de hoje só oferece horários que respeitem a antecedência mínima.

## 20. Escolher horário

Exibir horários livres calculados pelo motor de disponibilidade.

Ao selecionar um horário:

- manter seleção temporária apenas na sessão;
- não considerar o horário definitivamente reservado antes da confirmação;
- revalidar no servidor na etapa final.

## 21. Dados do cliente

Campos obrigatórios:

- nome;
- WhatsApp.

Campos opcionais na V1:

- observação curta.

Deve haver aceite de política de privacidade e ciência de que os dados serão compartilhados com o estabelecimento escolhido.

## 22. Revisão e confirmação

Mostrar:

- estabelecimento;
- serviço;
- profissional;
- data;
- início e fim;
- preço;
- nome e WhatsApp.

Ao confirmar:

1. revalidar conta e trial;
2. revalidar serviço e profissional;
3. revalidar disponibilidade e conflito;
4. criar ou localizar cliente;
5. criar agendamento em transação atômica;
6. registrar origem `publico`;
7. mostrar confirmação.

Se outro cliente ocupar o horário antes da confirmação:

- não criar duplicidade;
- informar que o horário acabou de ser ocupado;
- retornar à seleção de horário com novas opções.

## 23. Confirmação final

Mostrar:

- mensagem de sucesso;
- resumo do agendamento;
- endereço e contato do estabelecimento, quando disponíveis;
- orientação para salvar a informação.

Na V1, não prometer lembrete automático por WhatsApp se a integração ainda não existir.

---

# PARTE C — PAINEL CRUZ LABS

## 24. Dashboard administrativo

Exibir:

- estabelecimentos totais;
- novos cadastros no período;
- contas em trial;
- contas ativas;
- trials expirados;
- contas bloqueadas;
- agendamentos totais e no período;
- conversão trial para ativo;
- gráfico de evolução;
- estabelecimentos recentes.

Métricas devem permitir filtro por período.

## 25. Gestão de estabelecimentos

### 25.1 Lista

Colunas:

- estabelecimento;
- responsável;
- segmento;
- data de cadastro;
- estado da configuração;
- estado do trial;
- assinatura;
- último acesso;
- quantidade de agendamentos;
- ações.

Filtros:

- trial;
- ativo;
- expirado;
- bloqueado;
- configuração incompleta;
- sem primeiro agendamento;
- período de cadastro.

### 25.2 Detalhe do estabelecimento

Exibir:

- dados da conta;
- responsável;
- plano;
- datas do trial;
- último acesso;
- estágio de ativação;
- número de profissionais, serviços, clientes e agendamentos;
- eventos principais;
- feedbacks e observações internas;
- histórico de alterações administrativas.

Não exibir dados sensíveis desnecessários.

## 26. Controle de trial

Ações permitidas:

- consultar início, fim e dias restantes;
- estender trial com motivo obrigatório;
- encerrar trial manualmente com confirmação;
- reativar temporariamente;
- registrar quem realizou a ação e quando.

Extensão de trial não deve apagar histórico anterior.

## 27. Assinaturas

Estados previstos:

- `trial`;
- `ativa`;
- `vencida`;
- `cancelada`;
- `bloqueada`.

Na V1, enquanto o pagamento automático não estiver integrado, o administrador pode ativar manualmente uma assinatura, informando:

- plano;
- início;
- vencimento;
- observação;
- referência externa opcional.

Toda alteração deve ficar registrada.

## 28. Bloquear ou reativar conta

### Bloqueio

Fluxo:

1. abrir estabelecimento;
2. selecionar bloquear;
3. informar motivo interno obrigatório;
4. confirmar;
5. impedir novos agendamentos e acesso operacional;
6. preservar dados.

### Reativação

1. selecionar reativar;
2. definir estado de assinatura ou trial;
3. registrar motivo;
4. liberar conforme regras do estado escolhido.

## 29. Métricas de ativação

Eventos mínimos:

- conta criada;
- dados do estabelecimento salvos;
- primeiro profissional criado;
- primeiro serviço criado;
- disponibilidade configurada;
- onboarding concluído;
- link público copiado;
- primeiro agendamento criado;
- primeiro agendamento concluído;
- assinatura ativada;
- trial expirado;
- conta bloqueada ou cancelada.

O painel deve mostrar em qual etapa cada estabelecimento parou.

## 30. Feedbacks

Fluxo:

1. administrador registra feedback recebido;
2. vincula ao estabelecimento;
3. classifica como bug, sugestão, dúvida ou elogio;
4. define prioridade;
5. altera estado entre novo, analisando, planejado, resolvido ou descartado;
6. adiciona observações internas.

Não é um sistema completo de suporte na V1, mas deve evitar perda de aprendizados do beta.

## 31. Comunicados

Na V1, o painel pode preparar comunicados exibidos dentro do sistema.

Campos:

- título;
- mensagem;
- público-alvo;
- início e fim de exibição;
- prioridade;
- ação opcional.

Exemplos:

- manutenção;
- nova funcionalidade;
- aviso de trial;
- pesquisa de feedback.

---

# PARTE D — REGRAS TRANSVERSAIS

## 32. Prevenção de agendamento duplicado

Obrigatório:

- validação no servidor;
- operação atômica no banco;
- restrição ou mecanismo equivalente para impedir sobreposição;
- nova validação no momento da confirmação;
- tratamento amigável de disputa pelo mesmo horário.

Apenas esconder um horário na interface não é suficiente.

## 33. Sobreposição de horários

Um profissional não pode possuir dois agendamentos ativos com períodos sobrepostos.

A regra considera intervalos completos, não apenas horário inicial.

Exemplo:

- atendimento A: 10:00–11:00;
- atendimento B: 10:30–11:00;

Existe conflito e o segundo deve ser impedido.

## 34. Fuso horário

- cada estabelecimento possui um fuso horário;
- datas devem ser armazenadas de forma consistente;
- exibição e cálculo usam o fuso do estabelecimento;
- a V1 brasileira pode iniciar com `America/Sao_Paulo`, mas a estrutura não deve depender de horário fixo.

## 35. Auditoria mínima

Registrar para ações críticas:

- usuário responsável;
- ação;
- entidade afetada;
- data e hora;
- valor anterior e novo quando necessário.

Ações críticas:

- alteração de trial;
- ativação ou bloqueio de conta;
- cancelamento e reagendamento;
- mudança de assinatura;
- alteração de permissões.

## 36. Estados vazios

Toda tela sem dados deve orientar a próxima ação.

Exemplos:

- sem profissionais: `Cadastre seu primeiro profissional`;
- sem serviços: `Adicione o primeiro serviço`;
- sem agendamentos: `Compartilhe seu link ou crie um agendamento`;
- sem disponibilidade: `Defina os horários de atendimento`.

## 37. Erros e feedback visual

Padrão:

- sucesso: confirmação curta e clara;
- erro de campo: próximo ao campo;
- erro geral: alerta visível;
- ação destrutiva: confirmação explícita;
- carregamento: impedir cliques duplicados;
- falha de rede: preservar dados preenchidos quando possível.

## 38. Tema claro e escuro

- todas as funções devem funcionar igualmente nos dois temas;
- não criar componentes separados por tema;
- usar tokens semânticos de cor;
- respeitar contraste e acessibilidade;
- preferência salva por usuário;
- opção `seguir sistema` disponível.

## 39. Critério de conclusão funcional da V1

A V1 estará funcionalmente pronta quando um novo estabelecimento conseguir, sem intervenção técnica:

1. criar conta;
2. concluir configuração;
3. cadastrar profissionais e serviços;
4. definir disponibilidades;
5. compartilhar o link público;
6. receber um agendamento sem conflito;
7. visualizar e administrar esse agendamento;
8. consultar clientes;
9. usar o sistema no celular e computador;
10. ser acompanhado pelo painel Cruz Labs;
11. ter trial encerrado e conta ativada sem perda de dados.

Qualquer função fora deste documento deve ser avaliada antes de entrar na V1 para evitar aumento desnecessário de escopo.