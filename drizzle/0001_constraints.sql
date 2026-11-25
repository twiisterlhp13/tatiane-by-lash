-- Proteção contra dupla reserva no nível do banco:
-- dois agendamentos ativos do mesmo profissional nunca podem ocupar períodos sobrepostos.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "professional_id" WITH =,
    tstzrange("starts_at", "occupied_until", '[)') WITH &&
  )
  WHERE ("status" IN ('pending', 'confirmed'));
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_valid_range" CHECK ("ends_at" > "starts_at" AND "occupied_until" >= "ends_at");
--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "blocks_valid_range" CHECK ("ends_at" > "starts_at");
--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_valid_duration" CHECK ("duration_minutes" > 0 AND "buffer_minutes" >= 0 AND "price_cents" >= 0);
--> statement-breakpoint
ALTER TABLE "professional_hours" ADD CONSTRAINT "ph_valid" CHECK ("weekday" BETWEEN 0 AND 6 AND "start_minute" >= 0 AND "end_minute" <= 1440 AND "end_minute" > "start_minute");
--> statement-breakpoint
ALTER TABLE "business_hours" ADD CONSTRAINT "bh_valid" CHECK ("weekday" BETWEEN 0 AND 6 AND "start_minute" >= 0 AND "end_minute" <= 1440 AND "end_minute" > "start_minute");
--> statement-breakpoint
ALTER TABLE "special_hours" ADD CONSTRAINT "sh_valid" CHECK ("start_minute" >= 0 AND "end_minute" <= 1440 AND "end_minute" >= "start_minute");
--> statement-breakpoint
-- O Supabase expõe o schema public pela API REST. Este app acessa o banco só pelo servidor,
-- então ativamos RLS sem políticas: a API pública do Supabase não lê nem grava nada,
-- e a conexão direta do servidor (dono das tabelas) continua funcionando.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
