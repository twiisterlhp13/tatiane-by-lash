import "server-only";
import { db, schema, type Tx } from "@/db";

export async function audit(
  entry: {
    organizationId: string | null;
    userId?: string | null;
    actorLabel?: string;
    action: string;
    entity: string;
    entityId?: string | null;
    data?: Record<string, unknown>;
    ip?: string;
  },
  tx?: Tx,
) {
  await (tx ?? db).insert(schema.auditLogs).values({
    organizationId: entry.organizationId,
    userId: entry.userId ?? null,
    actorLabel: entry.actorLabel ?? "",
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    data: entry.data ?? {},
    ip: entry.ip ?? "",
  });
}
