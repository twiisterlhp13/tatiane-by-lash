"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, EyeOff, Plus } from "lucide-react";
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Field, Input, Textarea } from "@/components/ui";
import { Modal } from "@/components/modal";
import { fmtDuration, fmtMoney } from "@/lib/time";
import { deleteServiceAction, moveServiceAction, saveServiceAction } from "./actions";

type Service = {
  id: string; name: string; category: string; description: string; durationMinutes: number; bufferMinutes: number;
  priceCents: number; priceFrom: boolean; active: boolean; onlineVisible: boolean; professionalIds: string[];
};

export function ServicesManager({ services, professionals }: { services: Service[]; professionals: { id: string; name: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}><Plus size={18} /> Novo serviço</Button>
      </div>
      {services.length === 0 ? (
        <EmptyState title="Nenhum serviço cadastrado" action={<Button onClick={() => setEditing("new")}>Cadastrar o primeiro</Button>}>
          Cadastre os serviços com duração e preço para que as clientes possam agendar.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line">
          {services.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-4 sm:px-5">
              <div className="flex flex-col">
                <button aria-label="Subir" disabled={i === 0 || pending} className="p-1 text-muted disabled:opacity-30" onClick={() => start(async () => { await moveServiceAction(s.id, -1); router.refresh(); })}><ArrowUp size={15} /></button>
                <button aria-label="Descer" disabled={i === services.length - 1 || pending} className="p-1 text-muted disabled:opacity-30" onClick={() => start(async () => { await moveServiceAction(s.id, 1); router.refresh(); })}><ArrowDown size={15} /></button>
              </div>
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(s)}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  {!s.active && <Badge>Inativo</Badge>}
                  {s.active && !s.onlineVisible && <Badge tone="warn"><EyeOff size={12} className="mr-1" />Só no painel</Badge>}
                </span>
                <span className="block text-sm text-muted">
                  {fmtDuration(s.durationMinutes)}{s.bufferMinutes > 0 && ` + ${s.bufferMinutes} min de intervalo`} · {s.priceFrom ? "a partir de " : ""}{fmtMoney(s.priceCents)}
                  {professionals.length > 1 && ` · ${s.professionalIds.length} profissional(is)`}
                </span>
              </button>
              <Button variant="ghost" className="px-3" onClick={() => setEditing(s)}>Editar</Button>
            </div>
          ))}
        </Card>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Novo serviço" : "Editar serviço"}>
        {editing !== null && (
          <ServiceForm
            service={editing === "new" ? null : editing}
            professionals={professionals}
            onDone={() => { setEditing(null); router.refresh(); }}
          />
        )}
      </Modal>
    </>
  );
}

function ServiceForm({ service, professionals, onDone }: { service: Service | null; professionals: { id: string; name: string }[]; onDone: () => void }) {
  const [v, setV] = useState({
    name: service?.name ?? "",
    category: service?.category ?? "",
    description: service?.description ?? "",
    duration: String(service?.durationMinutes ?? 60),
    buffer: String(service?.bufferMinutes ?? 0),
    price: service ? (service.priceCents / 100).toFixed(2).replace(".", ",") : "",
    priceFrom: service?.priceFrom ?? false,
    active: service?.active ?? true,
    onlineVisible: service?.onlineVisible ?? true,
    professionalIds: service?.professionalIds ?? professionals.map((p) => p.id),
  });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV({ ...v, [k]: val });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveServiceAction({
            id: service?.id, name: v.name, category: v.category, description: v.description,
            durationMinutes: Number(v.duration), bufferMinutes: Number(v.buffer || 0),
            priceCents: Math.round(Number(v.price.replace(/\./g, "").replace(",", ".") || 0) * 100),
            priceFrom: v.priceFrom, active: v.active, onlineVisible: v.onlineVisible, professionalIds: v.professionalIds,
          });
          if (r.ok) onDone(); else setError(r.error);
        });
      }}
    >
      <Alert>{error}</Alert>
      <Field label="Nome"><Input value={v.name} onChange={(e) => set("name", e.target.value)} required /></Field>
      <Field label="Categoria" hint="Agrupa os serviços na página pública. Ex.: Extensão de cílios"><Input value={v.category} onChange={(e) => set("category", e.target.value)} /></Field>
      <Field label="Descrição"><Textarea rows={2} value={v.description} onChange={(e) => set("description", e.target.value)} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Duração (min)"><Input type="number" min={5} step={5} value={v.duration} onChange={(e) => set("duration", e.target.value)} required /></Field>
        <Field label="Intervalo depois" hint="Limpeza/preparo"><Input type="number" min={0} step={5} value={v.buffer} onChange={(e) => set("buffer", e.target.value)} /></Field>
        <Field label="Preço (R$)"><Input inputMode="decimal" value={v.price} onChange={(e) => set("price", e.target.value)} placeholder="0,00" /></Field>
      </div>
      <Checkbox checked={v.priceFrom} onChange={(e) => set("priceFrom", e.target.checked)} label='Mostrar como "a partir de"' />
      {professionals.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-2">Quem faz este serviço</legend>
          <div className="space-y-2">
            {professionals.map((p) => (
              <Checkbox key={p.id} label={p.name} checked={v.professionalIds.includes(p.id)}
                onChange={(e) => set("professionalIds", e.target.checked ? [...v.professionalIds, p.id] : v.professionalIds.filter((x) => x !== p.id))} />
            ))}
          </div>
        </fieldset>
      )}
      <div className="space-y-2 rounded-xl bg-paper-2 p-3.5">
        <Checkbox checked={v.active} onChange={(e) => set("active", e.target.checked)} label="Serviço ativo" />
        <Checkbox checked={v.onlineVisible} onChange={(e) => set("onlineVisible", e.target.checked)} label="Clientes podem agendar pela página pública" />
      </div>
      <div className="flex gap-2">
        {service && (
          <Button type="button" variant="danger" disabled={pending} onClick={() => {
            if (!confirm("Remover este serviço? Se já houver agendamentos com ele, ele será apenas desativado.")) return;
            start(async () => { const r = await deleteServiceAction(service.id); if (r.ok) onDone(); else setError(r.error); });
          }}>Remover</Button>
        )}
        <Button type="submit" className="flex-1" disabled={pending}>{pending ? "Salvando…" : "Salvar serviço"}</Button>
      </div>
    </form>
  );
}
