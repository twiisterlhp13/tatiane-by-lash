import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  date,
  smallint,
  index,
  uniqueIndex,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const memberRole = pgEnum("member_role", ["owner", "admin", "professional", "receptionist"]);

export const appointmentStatus = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled_by_client",
  "cancelled_by_business",
  "no_show",
  "rescheduled",
]);

export const appointmentSource = pgEnum("appointment_source", ["online", "panel"]);

export const blockKind = pgEnum("block_kind", ["personal", "break", "vacation", "holiday", "maintenance", "other"]);

export const blockRecurrence = pgEnum("block_recurrence", ["none", "daily", "weekly"]);

export const actorType = pgEnum("actor_type", ["user", "client", "system"]);

export const deliveryStatus = pgEnum("delivery_status", ["queued", "sent", "failed", "simulated", "skipped"]);

/* ------------------------------------------------------------------ */
/* Settings type stored in organizations.settings                      */
/* ------------------------------------------------------------------ */

export type OrgSettings = {
  /** Intervalo entre horários oferecidos (min). */
  slotIntervalMinutes: number;
  /** Antecedência mínima para reservar online (min). */
  minAdvanceMinutes: number;
  /** Janela máxima futura para reservar online (dias). */
  maxAdvanceDays: number;
  /** Cliente pode cancelar até X horas antes. 0 = não pode cancelar online. */
  cancelUntilHours: number;
  /** Cliente pode reagendar até X horas antes. 0 = não pode reagendar online. */
  rescheduleUntilHours: number;
  /** Exigir motivo no cancelamento feito pela cliente. */
  requireCancelReason: boolean;
  /** Agendamentos online já entram confirmados (true) ou como pendentes (false). */
  autoConfirmOnline: boolean;
  /** Pedir e-mail obrigatoriamente no agendamento online. */
  requireEmail: boolean;
  /** Texto livre da política mostrado à cliente. */
  policyText: string;
  /** Lembretes por e-mail. */
  reminder24h: boolean;
  reminder2h: boolean;
  /** Notificar o negócio por e-mail a cada novo agendamento online. */
  notifyBusinessEmail: string;
};

export const defaultOrgSettings: OrgSettings = {
  slotIntervalMinutes: 30,
  minAdvanceMinutes: 120,
  maxAdvanceDays: 60,
  cancelUntilHours: 24,
  rescheduleUntilHours: 24,
  requireCancelReason: false,
  autoConfirmOnline: false,
  requireEmail: false,
  policyText:
    "Cancelamentos e reagendamentos podem ser feitos pelo link do seu agendamento até 24 horas antes do horário marcado. Em caso de atraso superior a 15 minutos, o atendimento poderá ser reduzido ou remarcado.",
  reminder24h: true,
  reminder2h: true,
  notifyBusinessEmail: "",
};

/* ------------------------------------------------------------------ */
/* Tenancy, users, access                                              */
/* ------------------------------------------------------------------ */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  segment: text("segment").notNull().default("beleza"),
  description: text("description").notNull().default(""),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  phone: text("phone").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  email: text("email").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  address: text("address").notNull().default(""),
  /** Bairro e cidade mostrados na vitrine (o endereço exato nunca aparece no perfil público). */
  area: text("area").notNull().default(""),
  /** Especialidades exibidas na vitrine (ex.: Fio a fio, Volume russo, Design de sobrancelhas). */
  specialties: jsonb("specialties").$type<string[]>().notNull().default([]),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  currency: text("currency").notNull().default("BRL"),
  onlineBookingEnabled: boolean("online_booking_enabled").notNull().default(true),
  settings: jsonb("settings").$type<OrgSettings>().notNull().default(defaultOrgSettings),
  plan: text("plan").notNull().default("free"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Links antigos de uma empresa: continuam levando para o link atual depois de uma troca. */
export const organizationSlugAliases = pgTable("organization_slug_aliases", {
  slug: text("slug").primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  createdAt: createdAt(),
}, (t) => [index("locations_org_idx").on(t.organizationId)]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 do token
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  userAgent: text("user_agent").notNull().default(""),
  createdAt: createdAt(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const passwordResets = pgTable("password_resets", {
  id: text("id").primaryKey(), // sha256 do token
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const professionals = pgTable("professionals", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  photoUrl: text("photo_url"),
  color: text("color").notNull().default("#9c4a6b"),
  email: text("email").notNull().default(""),
  active: boolean("active").notNull().default(true),
  acceptsOnline: boolean("accepts_online").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index("professionals_org_idx").on(t.organizationId)]);

export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: memberRole("role").notNull(),
  professionalId: uuid("professional_id").references(() => professionals.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("members_org_user_uq").on(t.organizationId, t.userId),
  index("members_user_idx").on(t.userId),
]);

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey(), // sha256 do token
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: memberRole("role").notNull(),
  professionalId: uuid("professional_id").references(() => professionals.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("invitations_org_idx").on(t.organizationId)]);

/* ------------------------------------------------------------------ */
/* Catálogo e horários                                                 */
/* ------------------------------------------------------------------ */

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  phoneNormalized: text("phone_normalized").notNull().default(""),
  email: text("email").notNull().default(""),
  birthDate: date("birth_date"),
  notes: text("notes").notNull().default(""),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
  anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("clients_org_idx").on(t.organizationId),
  index("clients_org_phone_idx").on(t.organizationId, t.phoneNormalized),
  index("clients_org_name_idx").on(t.organizationId, t.name),
]);

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default(""),
  description: text("description").notNull().default(""),
  durationMinutes: integer("duration_minutes").notNull(),
  bufferMinutes: integer("buffer_minutes").notNull().default(0),
  priceCents: integer("price_cents").notNull().default(0),
  priceFrom: boolean("price_from").notNull().default(false),
  active: boolean("active").notNull().default(true),
  onlineVisible: boolean("online_visible").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index("services_org_idx").on(t.organizationId)]);

export const professionalServices = pgTable("professional_services", {
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  professionalId: uuid("professional_id").notNull().references(() => professionals.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.professionalId, t.serviceId] }), index("ps_service_idx").on(t.serviceId)]);

/** Horário padrão da empresa (usado como modelo e na página pública). */
export const businessHours = pgTable("business_hours", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  weekday: smallint("weekday").notNull(), // 0 = domingo
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
}, (t) => [index("bh_org_idx").on(t.organizationId)]);

/** Horário de trabalho do profissional. Vários intervalos por dia permitem pausas (ex.: almoço). */
export const professionalHours = pgTable("professional_hours", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  professionalId: uuid("professional_id").notNull().references(() => professionals.id, { onDelete: "cascade" }),
  weekday: smallint("weekday").notNull(),
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
}, (t) => [index("ph_prof_idx").on(t.professionalId)]);

/** Exceção por data: substitui o horário semanal naquele dia (dia extra de trabalho ou horário diferente). */
export const specialHours = pgTable("special_hours", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  professionalId: uuid("professional_id").notNull().references(() => professionals.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
  note: text("note").notNull().default(""),
}, (t) => [index("sh_prof_date_idx").on(t.professionalId, t.date)]);

/** Bloqueios: compromissos pessoais, férias, feriados, pausas. professionalId nulo = toda a empresa. */
export const availabilityBlocks = pgTable("availability_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  professionalId: uuid("professional_id").references(() => professionals.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""), // motivo interno: nunca exibido à cliente
  kind: blockKind("kind").notNull().default("personal"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  recurrence: blockRecurrence("recurrence").notNull().default("none"),
  recurrenceUntil: date("recurrence_until"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [
  index("blocks_org_range_idx").on(t.organizationId, t.startsAt, t.endsAt),
  index("blocks_prof_idx").on(t.professionalId),
]);

/* ------------------------------------------------------------------ */
/* Agendamentos                                                        */
/* ------------------------------------------------------------------ */

export const recurrenceRules = pgTable("recurrence_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  frequency: text("frequency").notNull(), // weekly | biweekly | monthly
  until: date("until"),
  count: integer("count"),
  createdAt: createdAt(),
});

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "restrict" }),
  professionalId: uuid("professional_id").notNull().references(() => professionals.id, { onDelete: "restrict" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  /** Fim do período ocupado (fim + intervalo pós-atendimento). Usado na restrição anti-sobreposição. */
  occupiedUntil: timestamp("occupied_until", { withTimezone: true }).notNull(),
  status: appointmentStatus("status").notNull().default("confirmed"),
  source: appointmentSource("source").notNull(),
  serviceName: text("service_name").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  discountCents: integer("discount_cents").notNull().default(0),
  depositCents: integer("deposit_cents").notNull().default(0),
  paidCents: integer("paid_cents").notNull().default(0),
  paymentMethod: text("payment_method").notNull().default(""),
  internalNotes: text("internal_notes").notNull().default(""),
  clientNotes: text("client_notes").notNull().default(""),
  manageTokenHash: text("manage_token_hash"),
  recurrenceRuleId: uuid("recurrence_rule_id").references(() => recurrenceRules.id, { onDelete: "set null" }),
  rescheduledFromId: uuid("rescheduled_from_id"),
  cancelReason: text("cancel_reason").notNull().default(""),
  reminder24hSentAt: timestamp("reminder_24h_sent_at", { withTimezone: true }),
  reminder2hSentAt: timestamp("reminder_2h_sent_at", { withTimezone: true }),
  idempotencyKey: text("idempotency_key"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("appointments_org_code_uq").on(t.organizationId, t.code),
  uniqueIndex("appointments_org_idem_uq").on(t.organizationId, t.idempotencyKey),
  index("appointments_org_range_idx").on(t.organizationId, t.startsAt),
  index("appointments_prof_range_idx").on(t.professionalId, t.startsAt),
  index("appointments_client_idx").on(t.clientId),
  index("appointments_status_idx").on(t.organizationId, t.status),
]);

export const appointmentEvents = pgTable("appointment_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // created, confirmed, completed, cancelled, rescheduled, updated, no_show
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  actorType: actorType("actor_type").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorLabel: text("actor_label").notNull().default(""),
  source: text("source").notNull().default(""), // panel | online | cron
  reason: text("reason").notNull().default(""),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
}, (t) => [index("appt_events_appt_idx").on(t.appointmentId)]);

/* ------------------------------------------------------------------ */
/* Notificações                                                        */
/* ------------------------------------------------------------------ */

export const messageTemplates = pgTable("message_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  channel: text("channel").notNull().default("email"),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("templates_org_key_channel_uq").on(t.organizationId, t.key, t.channel)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  recipientType: text("recipient_type").notNull(), // client | business
  channel: text("channel").notNull(), // email | whatsapp | sms | push
  recipient: text("recipient").notNull(),
  templateKey: text("template_key").notNull(),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull().default(""),
  status: deliveryStatus("status").notNull().default("queued"),
  provider: text("provider").notNull().default(""),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
  dedupeKey: text("dedupe_key"),
  attempts: integer("attempts").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  index("notifications_org_idx").on(t.organizationId, t.createdAt),
  uniqueIndex("notifications_dedupe_uq").on(t.dedupeKey),
]);

/* ------------------------------------------------------------------ */
/* Auditoria                                                           */
/* ------------------------------------------------------------------ */

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  actorLabel: text("actor_label").notNull().default(""),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  ip: text("ip").notNull().default(""),
  createdAt: createdAt(),
}, (t) => [index("audit_org_idx").on(t.organizationId, t.createdAt)]);

/* ------------------------------------------------------------------ */
/* Negócio: despesas, estoque, portfólio e perguntas à IA              */
/* ------------------------------------------------------------------ */

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  category: text("category").notNull().default("outros"), // insumos | aluguel | marketing | impostos | outros
  amountCents: integer("amount_cents").notNull(),
  spentOn: date("spent_on").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [index("expenses_org_date_idx").on(t.organizationId, t.spentOn)]);

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("un"),
  quantity: integer("quantity").notNull().default(0),
  minimum: integer("minimum").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("inventory_org_idx").on(t.organizationId)]);

/** Fotos do portfólio (JPEG reduzido no aparelho, guardado em base64). */
export const portfolioPhotos = pgTable("portfolio_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  imageData: text("image_data").notNull(),
  caption: text("caption").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index("portfolio_org_idx").on(t.organizationId, t.sortOrder)]);

/** Perguntas feitas à IA (limite mensal por negócio). */
export const aiQuestions = pgTable("ai_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  question: text("question").notNull(),
  answer: text("answer").notNull().default(""),
  source: text("source").notNull().default("local"), // ia | local
  createdAt: createdAt(),
}, (t) => [index("ai_questions_org_idx").on(t.organizationId, t.createdAt)]);

/* ------------------------------------------------------------------ */
/* Módulos preparados (fase 2) — modelo de dados pronto, telas atrás  */
/* de feature flags                                                    */
/* ------------------------------------------------------------------ */

export const waitlistEntries = pgTable("waitlist_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "cascade" }),
  professionalId: uuid("professional_id").references(() => professionals.id, { onDelete: "cascade" }),
  preferredFrom: date("preferred_from"),
  preferredTo: date("preferred_to"),
  preferredPeriod: text("preferred_period").notNull().default(""), // manha | tarde | noite
  status: text("status").notNull().default("waiting"),
  createdAt: createdAt(),
}, (t) => [index("waitlist_org_idx").on(t.organizationId)]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  kind: text("kind").notNull().default("payment"), // deposit | payment | refund
  amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull(), // pix | card | cash | other
  status: text("status").notNull().default("pending"),
  gateway: text("gateway").notNull().default("manual"),
  gatewayPaymentId: text("gateway_payment_id"),
  createdAt: createdAt(),
}, (t) => [
  index("payments_org_idx").on(t.organizationId),
  uniqueIndex("payments_gateway_uq").on(t.gateway, t.gatewayPaymentId),
]);

export const processedWebhooks = pgTable("processed_webhooks", {
  id: text("id").primaryKey(), // provider:event_id — garante idempotência
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customForms = pgTable("custom_forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "cascade" }),
  sensitive: boolean("sensitive").notNull().default(false),
  createdAt: createdAt(),
});

export const formFields = pgTable("form_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  formId: uuid("form_id").notNull().references(() => customForms.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  type: text("type").notNull().default("text"),
  required: boolean("required").notNull().default(false),
  options: jsonb("options").$type<string[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const formAnswers = pgTable("form_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  formId: uuid("form_id").notNull().references(() => customForms.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: createdAt(),
});
