-- RLS na nova tabela (mesma política das demais: só o servidor acessa)
ALTER TABLE "organization_slug_aliases" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Corrige o nome digitado no cadastro ("Taiane by Lash") e mantém o link antigo funcionando
INSERT INTO "organization_slug_aliases" ("slug", "organization_id")
SELECT 'taiane-by-lash', o.id FROM "organizations" o
WHERE o.slug = 'taiane-by-lash'
  AND NOT EXISTS (SELECT 1 FROM "organizations" x WHERE x.slug = 'tatiane-by-lash');
--> statement-breakpoint
UPDATE "organizations" SET "slug" = 'tatiane-by-lash', "name" = 'Tatiane By Lash', "updated_at" = now()
WHERE "slug" = 'taiane-by-lash'
  AND NOT EXISTS (SELECT 1 FROM "organizations" x WHERE x.slug = 'tatiane-by-lash');
