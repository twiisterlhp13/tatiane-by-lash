import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getOrgBySlug } from "@/lib/booking";

/** Foto do portfólio servida como imagem (com cache longo: cada foto tem um id único). */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Não encontrada", { status: 404 });
  const org = await getOrgBySlug(slug);
  if (!org) return new Response("Não encontrada", { status: 404 });
  const [foto] = await db.select({ data: schema.portfolioPhotos.imageData }).from(schema.portfolioPhotos)
    .where(and(eq(schema.portfolioPhotos.id, id), eq(schema.portfolioPhotos.organizationId, org.id))).limit(1);
  if (!foto) return new Response("Não encontrada", { status: 404 });
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(foto.data);
  if (!m) return new Response("Não encontrada", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: {
      "Content-Type": m[1],
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
