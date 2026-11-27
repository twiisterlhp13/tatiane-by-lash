# TATIANE By Lash · app de agendamento

App para lash designer (cílios e sobrancelhas) com a mesma lógica do Trança AI: uma abertura na primeira visita, uma tela de escolha ("Quero agendar" ou "Sou lash designer") e dois apps no mesmo endereço, ligados ao mesmo banco de dados.

**Área da lash designer** (`/painel`, instalável no celular):

- **Início**: o dia em dinheiro (entra hoje, lucro estimado pelo custo médio, comparação com o mesmo ponto do mês passado), a *linha do dia* (o expediente desenhado como uma linha de cílios), pedidos de horário para aceitar ou recusar, próxima cliente com o que separar e confirmação pronta no WhatsApp, "Faça agora" (clientes para chamar de volta e manutenção vencida, estoque baixo, atendimentos sem concluir, horários livres amanhã para divulgar, aniversariantes) e "Pergunte à IA".
- **Agenda**: pedidos, atendimentos para concluir ou marcar falta, próximos dias, novo agendamento rápido (WhatsApp opcional), agenda da semana e bloqueios.
- **Clientes**: busca, histórico, próximo horário e WhatsApp.
- **Negócio**: financeiro (faturamento = atendimentos concluídos, despesas, lucro, últimos 6 meses) e estoque com mínimo.
- **Vitrine**: perfil público (foto, Instagram, bairro, especialidades, sobre), horário de atendimento, procedimentos e valores, portfólio de fotos e link para compartilhar.
- **Pergunte à IA**: responde com os dados da conta pelo Vercel AI Gateway (modelo em `IA_MODELO`, padrão `anthropic/claude-haiku-5.5`; autenticação por OIDC na Vercel ou `AI_GATEWAY_API_KEY`). Sem IA disponível ou acima do limite mensal (150 por negócio), o app responde com os números calculados.

**Lado da cliente** (`/<link-do-negócio>`): vitrine com procedimentos, valores, portfólio e combinados; "Agendar horário" com dias e horários realmente livres; o pedido chega como *aguardando confirmação* (ou já confirmado, se a profissional preferir) e fica em **Meus horários** neste aparelho, com remarcar e cancelar dentro do prazo.

Multiempresa: qualquer lash designer pode criar conta em `/cadastro` (4 passos: perfil, especialidades, procedimentos e valores, dias e horários) e ganha o próprio link.

## Stack

- Next.js 16 (App Router, Server Actions) + React 19 + Tailwind CSS 4
- PostgreSQL (Supabase via integração da Vercel) com Drizzle ORM e migrations SQL
- Autenticação própria: senhas com bcrypt, sessões em cookie httpOnly guardadas no banco (hash do token)
- E-mail via Resend (opcional, adaptador substituível); WhatsApp/SMS com ponto de integração pronto
- Vercel Cron para lembretes

## Rodar localmente

```bash
npm install
cp .env.example .env.local        # ajuste DATABASE_URL / POSTGRES_URL
npm run db:migrate
npm run dev
```

Abra http://localhost:3000/cadastro, crie a conta e o negócio (a opção de serviços sugeridos já cadastra o catálogo de cílios).

## Testes

```bash
npm test                  # unitários do motor de disponibilidade, bloqueios, recorrência e políticas
npm run test:integration  # Postgres real: dupla reserva simultânea, bloqueios, cancelamento, reagendamento, isolamento entre empresas
```

## Deploy (Vercel)

1. Projeto Vercel com a integração **Supabase** conectada (cria `POSTGRES_URL` e `POSTGRES_URL_NON_POOLING`).
2. Variáveis: `CRON_SECRET` (obrigatória para lembretes), `RESEND_API_KEY` e `EMAIL_FROM` (para e-mails reais), `DEFAULT_ORG_SLUG` (opcional).
3. O `build` roda `scripts/migrate.ts` antes do `next build`, aplicando as migrations pendentes automaticamente.

## Como as regras críticas foram implementadas

| Regra | Onde |
| --- | --- |
| Disponibilidade = expediente (ou exceção da data) − agendamentos ativos (com intervalo pós-atendimento) − bloqueios − antecedência/janela | `src/lib/availability.ts` (funções puras, testadas) |
| Nunca reservar o mesmo horário duas vezes | revalidação no servidor dentro de transação + `pg_advisory_xact_lock` por profissional + restrição `EXCLUDE USING gist` no banco (`drizzle/0001_constraints.sql`) |
| Reenvio do formulário não duplica | chave de idempotência por agendamento |
| Bloqueios nunca expõem o motivo | o site só recebe horários livres; o título do bloqueio fica no painel |
| Pedidos de horário | `autoConfirmOnline` (Configurações › Regras de agendamento): desligado = pedido para aceitar ou recusar |
| Meus horários sem senha | o aparelho guarda código + token de cada pedido; só quem tem o token vê o agendamento (`/api/public/<link>/meus`) |
| Conflito ao bloquear | o painel lista os agendamentos afetados e oferece cancelar, manter ou voltar |
| Fuso horário | instantes em UTC (`timestamptz`), conversão pelo fuso da empresa (`America/Sao_Paulo` por padrão) |
| Isolamento entre empresas | toda consulta filtra por `organization_id`; RLS ativado no Supabase sem políticas (API REST pública bloqueada) |
| Permissões | `src/lib/permissions.ts` (proprietária, administradora, recepção, profissional), checadas no servidor |
| Auditoria | `appointment_events` (histórico de cada agendamento) e `audit_logs` (ações do painel) |
| LGPD | aceite de termos, consentimento de marketing separado, exportação JSON e anonimização da cliente |

## Status por fase

**MVP (pronto):** contas e empresas, profissionais, serviços, horários semanais e exceções, calendário, bloqueios únicos/recorrentes/férias, clientes, site público, confirmação/cancelamento/reagendamento, e-mails e lembretes, permissões, histórico e auditoria, políticas, dashboard, PWA.

**Fase 2 (modelo de dados já criado, telas ainda não):** lista de espera (`waitlist_entries`), pagamentos e sinal com gateway (`payments`, `processed_webhooks` para idempotência), recorrência de agendamentos (`recurrence_rules`), fichas de anamnese (`custom_forms`, `form_fields`, `form_answers`), assinaturas (`subscriptions`), WhatsApp/SMS (adaptador em `src/lib/notify.ts`).

**Fase 3:** app nativo da cliente, busca de empresas, avaliações, pacotes e cupons, múltiplas unidades (`locations`).

## Observações

- Os lembretes usam o Vercel Cron. No plano gratuito (Hobby) o cron roda uma vez por dia (10h de Brasília), então o lembrete da véspera é enviado nesse horário e o de 2 horas só funciona em planos com cron mais frequente.
- Os textos de termos e privacidade são um ponto de partida e devem ser revisados por assessoria jurídica antes do lançamento, especialmente se forem coletados dados de saúde em fichas.
