CREATE TYPE "public"."actor_type" AS ENUM('user', 'client', 'system');--> statement-breakpoint
CREATE TYPE "public"."appointment_source" AS ENUM('online', 'panel');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'confirmed', 'completed', 'cancelled_by_client', 'cancelled_by_business', 'no_show', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."block_kind" AS ENUM('personal', 'break', 'vacation', 'holiday', 'maintenance', 'other');--> statement-breakpoint
CREATE TYPE "public"."block_recurrence" AS ENUM('none', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('queued', 'sent', 'failed', 'simulated', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'professional', 'receptionist');--> statement-breakpoint
CREATE TABLE "appointment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"actor_type" "actor_type" NOT NULL,
	"actor_user_id" uuid,
	"actor_label" text DEFAULT '' NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"client_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"occupied_until" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'confirmed' NOT NULL,
	"source" "appointment_source" NOT NULL,
	"service_name" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"deposit_cents" integer DEFAULT 0 NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"payment_method" text DEFAULT '' NOT NULL,
	"internal_notes" text DEFAULT '' NOT NULL,
	"client_notes" text DEFAULT '' NOT NULL,
	"manage_token_hash" text,
	"recurrence_rule_id" uuid,
	"rescheduled_from_id" uuid,
	"cancel_reason" text DEFAULT '' NOT NULL,
	"reminder_24h_sent_at" timestamp with time zone,
	"reminder_2h_sent_at" timestamp with time zone,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"actor_label" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"professional_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"kind" "block_kind" DEFAULT 'personal' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"recurrence" "block_recurrence" DEFAULT 'none' NOT NULL,
	"recurrence_until" date,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"phone_normalized" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"birth_date" date,
	"notes" text DEFAULT '' NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"marketing_consent_at" timestamp with time zone,
	"anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"service_id" uuid,
	"sensitive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"appointment_id" uuid,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"label" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" NOT NULL,
	"professional_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"appointment_id" uuid,
	"recipient_type" text NOT NULL,
	"channel" text NOT NULL,
	"recipient" text NOT NULL,
	"template_key" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" "delivery_status" DEFAULT 'queued' NOT NULL,
	"provider" text DEFAULT '' NOT NULL,
	"provider_message_id" text,
	"error" text,
	"dedupe_key" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"professional_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"segment" text DEFAULT 'beleza' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"logo_url" text,
	"cover_url" text,
	"phone" text DEFAULT '' NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"instagram" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"online_booking_enabled" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{"slotIntervalMinutes":30,"minAdvanceMinutes":120,"maxAdvanceDays":60,"cancelUntilHours":24,"rescheduleUntilHours":24,"requireCancelReason":false,"autoConfirmOnline":true,"requireEmail":false,"policyText":"Cancelamentos e reagendamentos podem ser feitos pelo link do seu agendamento até 24 horas antes do horário marcado. Em caso de atraso superior a 15 minutos, o atendimento poderá ser reduzido ou remarcado.","reminder24h":true,"reminder2h":true,"notifyBusinessEmail":""}'::jsonb NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"appointment_id" uuid,
	"kind" text DEFAULT 'payment' NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"gateway" text DEFAULT 'manual' NOT NULL,
	"gateway_payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_services" (
	"organization_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "professional_services_professional_id_service_id_pk" PRIMARY KEY("professional_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "professionals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"photo_url" text,
	"color" text DEFAULT '#9c4a6b' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"accepts_online" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurrence_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"frequency" text NOT NULL,
	"until" date,
	"count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration_minutes" integer NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"price_from" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"online_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "special_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"terms_accepted_at" timestamp with time zone,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"service_id" uuid,
	"professional_id" uuid,
	"preferred_from" date,
	"preferred_to" date,
	"preferred_period" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_recurrence_rule_id_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."recurrence_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_forms" ADD CONSTRAINT "custom_forms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_forms" ADD CONSTRAINT "custom_forms_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_answers" ADD CONSTRAINT "form_answers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_answers" ADD CONSTRAINT "form_answers_form_id_custom_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."custom_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_answers" ADD CONSTRAINT "form_answers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_answers" ADD CONSTRAINT "form_answers_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_custom_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."custom_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_hours" ADD CONSTRAINT "professional_hours_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_hours" ADD CONSTRAINT "professional_hours_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_services" ADD CONSTRAINT "professional_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_hours" ADD CONSTRAINT "special_hours_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_hours" ADD CONSTRAINT "special_hours_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appt_events_appt_idx" ON "appointment_events" USING btree ("appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_org_code_uq" ON "appointments" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_org_idem_uq" ON "appointments" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "appointments_org_range_idx" ON "appointments" USING btree ("organization_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_prof_range_idx" ON "appointments" USING btree ("professional_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_client_idx" ON "appointments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "appointments_status_idx" ON "appointments" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "blocks_org_range_idx" ON "availability_blocks" USING btree ("organization_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "blocks_prof_idx" ON "availability_blocks" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "bh_org_idx" ON "business_hours" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "clients_org_idx" ON "clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "clients_org_phone_idx" ON "clients" USING btree ("organization_id","phone_normalized");--> statement-breakpoint
CREATE INDEX "clients_org_name_idx" ON "clients" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "invitations_org_idx" ON "invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "locations_org_idx" ON "locations" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_org_key_channel_uq" ON "message_templates" USING btree ("organization_id","key","channel");--> statement-breakpoint
CREATE INDEX "notifications_org_idx" ON "notifications" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_uq" ON "notifications" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "members_org_user_uq" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_org_idx" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_gateway_uq" ON "payments" USING btree ("gateway","gateway_payment_id");--> statement-breakpoint
CREATE INDEX "ph_prof_idx" ON "professional_hours" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "ps_service_idx" ON "professional_services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "professionals_org_idx" ON "professionals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "services_org_idx" ON "services" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sh_prof_date_idx" ON "special_hours" USING btree ("professional_id","date");--> statement-breakpoint
CREATE INDEX "waitlist_org_idx" ON "waitlist_entries" USING btree ("organization_id");