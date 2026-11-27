import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCtx } from "@/lib/auth";
import { getOrgBySlug } from "@/lib/booking";
import { Abertura } from "./abertura";

/** Primeira tela do app: abertura (só na primeira visita) e escolha entre agendar ou entrar como lash designer. */
export default async function Home() {
  const ctx = await getCtx();
  if (ctx) redirect("/painel");
  const org =
    (await getOrgBySlug(process.env.DEFAULT_ORG_SLUG || "tatiane-by-lash")) ??
    (await db.select().from(schema.organizations).orderBy(asc(schema.organizations.createdAt)).limit(1))[0] ??
    null;
  return (
    <>
      <script
        // decide antes da pintura se a abertura deve aparecer (evita piscar a tela de escolha)
        dangerouslySetInnerHTML={{ __html: "try{if(!localStorage.getItem('tbl_intro'))document.documentElement.classList.add('primeira-visita')}catch(e){}" }}
      />
      <Abertura
        slug={org?.slug ?? null}
        nome={org?.name ?? "TATIANE By Lash"}
        foto={org?.logoUrl ?? null}
        area={org?.area ?? ""}
      />
    </>
  );
}
