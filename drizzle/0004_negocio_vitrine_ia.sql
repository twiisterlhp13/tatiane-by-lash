CREATE TABLE "ai_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"question" text NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'local' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'outros' NOT NULL,
	"amount_cents" integer NOT NULL,
	"spent_on" date NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT 'un' NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"minimum" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"image_data" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "settings" SET DEFAULT '{"slotIntervalMinutes":30,"minAdvanceMinutes":120,"maxAdvanceDays":60,"cancelUntilHours":24,"rescheduleUntilHours":24,"requireCancelReason":false,"autoConfirmOnline":false,"requireEmail":false,"policyText":"Cancelamentos e reagendamentos podem ser feitos pelo link do seu agendamento até 24 horas antes do horário marcado. Em caso de atraso superior a 15 minutos, o atendimento poderá ser reduzido ou remarcado.","reminder24h":true,"reminder2h":true,"notifyBusinessEmail":""}'::jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "area" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "specialties" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_questions" ADD CONSTRAINT "ai_questions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_questions" ADD CONSTRAINT "ai_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_photos" ADD CONSTRAINT "portfolio_photos_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_questions_org_idx" ON "ai_questions" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "expenses_org_date_idx" ON "expenses" USING btree ("organization_id","spent_on");--> statement-breakpoint
CREATE INDEX "inventory_org_idx" ON "inventory_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "portfolio_org_idx" ON "portfolio_photos" USING btree ("organization_id","sort_order");--> statement-breakpoint
-- Mesma regra das demais tabelas: só o servidor acessa (API pública do Supabase bloqueada)
ALTER TABLE "ai_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "portfolio_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_valid" CHECK ("amount_cents" >= 0);--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_valid" CHECK ("quantity" >= 0 AND "minimum" >= 0);--> statement-breakpoint
-- Lógica de pedidos: agendamentos online chegam como pedido e a profissional aceita ou recusa
UPDATE "organizations" SET "settings" = jsonb_set("settings", '{autoConfirmOnline}', 'false'::jsonb, true), "updated_at" = now();--> statement-breakpoint
-- Vitrine: especialidades iniciais de quem atende cílios e sobrancelhas
UPDATE "organizations" SET "specialties" = '["Fio a fio","Volume brasileiro","Volume russo","Lash lifting","Design de sobrancelhas"]'::jsonb
WHERE "segment" = 'lash' AND "specialties" = '[]'::jsonb;
--> statement-breakpoint
-- Nome da marca como a dona escreve
UPDATE "organizations" SET "name" = 'TATIANE By Lash', "updated_at" = now() WHERE "slug" = 'tatiane-by-lash' AND "name" = 'Tatiane By Lash';
