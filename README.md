# Agenda · Tatiane By Lash

Sistema de agendamentos com dois canais integrados ao mesmo banco de dados:

- **Painel da profissional** (`/painel`): app web instalável no Android (PWA) com agenda dia/semana/mês, agendamentos, bloqueio de horários, clientes, serviços, equipe, horários, políticas, notificações e auditoria.
- **Site da cliente** (`/<link-do-negócio>`): página pública com agendamento online em 4 passos, sem precisar criar conta, e link pessoal para consultar, cancelar ou reagendar.

Multiempresa desde o início: qualquer negócio pode criar conta em `/cadastro` e ganha o próprio link.

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
