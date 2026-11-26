CREATE TABLE "organization_slug_aliases" (
	"slug" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_slug_aliases" ADD CONSTRAINT "organization_slug_aliases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;