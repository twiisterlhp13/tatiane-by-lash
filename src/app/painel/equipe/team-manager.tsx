"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus } from "lucide-react";
import { Alert, Badge, Button, Card, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/modal";
import { ROLE_LABEL, type Role } from "@/lib/permissions";
import { CopyLink } from "../copy-link";
import { inviteMemberAction, saveProfessionalAction, updateMemberAction } from "./actions";

type Pro = { id: string; name: string; bio: string; email: string; color: string; active: boolean; acceptsOnline: boolean; photoUrl: string };
type Member = { id: string; name: string; email: string; role: Role; professionalId: string; active: boolean; isMe: boolean };

const COLORS = ["#8a3d5c", "#b0644e", "#4f7a6a", "#5b6aa8", "#a1803d", "#7a4f9a", "#3f7f99", "#9a4f4f"];

export function TeamManager({ professionals, members, invites }: { professionals: Pro[]; members: Member[]; invites: { email: string; role: string; expiresAt: string }[] }) {
  const router = useRouter();
  const [editPro, setEditPro] = useState<Pro | "new" | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const done = () => { setEditPro(null); setInviting(false); setEditMember(null); router.refresh(); };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl">Profissionais</h2>
          <Button variant="secondary" onClick={() => setEditPro("new")}><Plus size={17} /> Adicionar</Button>
        </div>
        <ul className="divide-y divide-line">
          {professionals.map((p) => (
            <li key={p.id}>
              <button className="flex w-full items-center gap-3 py-3 text-left" onClick={() => setEditPro(p)}>
                <span className="size-3 rounded-full" style={{ background: p.color }} />
                <span className="flex-1">
                  <span className="block font-medium">{p.name}</span>
                  <span className="text-sm text-muted">{p.acceptsOnline ? "Recebe agendamentos online" : "Só agenda pelo painel"}</span>
                </span>
                {!p.active && <Badge>Inativa</Badge>}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Cada profissional tem a própria agenda, horários e serviços. Ela não precisa ter acesso ao painel.</p>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl">Acesso ao painel</h2>
          <Button variant="secondary" onClick={() => setInviting(true)}><UserPlus size={17} /> Convidar</Button>
        </div>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id}>
              <button disabled={m.role === "owner"} className="flex w-full items-center gap-3 py-3 text-left disabled:cursor-default" onClick={() => setEditMember(m)}>
                <span className="flex-1">
                  <span className="block font-medium">{m.name}{m.isMe && " (você)"}</span>
                  <span className="text-sm text-muted">{m.email}</span>
                </span>
                <Badge tone={m.role === "owner" ? "berry" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
                {!m.active && <Badge tone="danger">Sem acesso</Badge>}
              </button>
            </li>
          ))}
          {invites.map((i) => (
            <li key={i.email + i.expiresAt} className="flex items-center gap-3 py-3 text-sm">
              <span className="flex-1 text-muted">{i.email}</span>
              <Badge tone="warn">Convite pendente</Badge>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 text-xs text-muted">
          <div><strong>Administradora:</strong> tudo, exceto a conta da proprietária.</div>
          <div><strong>Recepção:</strong> agenda de todas e clientes; não altera serviços nem configurações.</div>
          <div><strong>Profissional:</strong> vê e altera só a própria agenda e os próprios bloqueios.</div>
        </dl>
      </Card>

      <Modal open={editPro !== null} onClose={() => setEditPro(null)} title={editPro === "new" ? "Nova profissional" : "Editar profissional"}>
        {editPro !== null && <ProForm pro={editPro === "new" ? null : editPro} onDone={done} />}
      </Modal>
      <Modal open={inviting} onClose={() => setInviting(false)} title="Convidar para o painel">
        {inviting && <InviteForm professionals={professionals} />}
      </Modal>
      <Modal open={editMember !== null} onClose={() => setEditMember(null)} title="Acesso">
        {editMember && <MemberForm member={editMember} professionals={professionals} onDone={done} />}
      </Modal>
    </div>
  );
}

function ProForm({ pro, onDone }: { pro: Pro | null; onDone: () => void }) {
  const [v, setV] = useState<Omit<Pro, "id">>(pro ?? { name: "", bio: "", email: "", color: COLORS[1], active: true, acceptsOnline: true, photoUrl: "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveProfessionalAction({ id: pro?.id, ...v }); if (r.ok) onDone(); else setError(r.error); }); }}>
      <Alert>{error}</Alert>
      <Field label="Nome"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required /></Field>
      <Field label="Apresentação curta" hint="Aparece na página pública."><Textarea rows={2} value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} /></Field>
      <Field label="Foto (link da imagem)" hint="Opcional. Cole o endereço de uma imagem já publicada."><Input type="url" value={v.photoUrl} onChange={(e) => setV({ ...v, photoUrl: e.target.value })} /></Field>
      <Field label="Cor na agenda">
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" aria-label={c} onClick={() => setV({ ...v, color: c })} className="size-8 rounded-full ring-offset-2" style={{ background: c, boxShadow: v.color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined }} />
          ))}
        </div>
      </Field>
      <Checkbox checked={v.acceptsOnline} onChange={(e) => setV({ ...v, acceptsOnline: e.target.checked })} label="Aparece para as clientes no agendamento online" />
      <Checkbox checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} label="Ativa" />
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
      {!pro && <p className="text-xs text-muted">Ela começa com o horário de funcionamento e todos os serviços ativos. Ajuste em Horários e Serviços.</p>}
    </form>
  );
}

function InviteForm({ professionals }: { professionals: Pro[] }) {
  const [v, setV] = useState({ email: "", role: "professional" as "admin" | "professional" | "receptionist", professionalId: professionals[0]?.id ?? "" });
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [pending, start] = useTransition();
  if (link) {
    return (
      <div className="space-y-4">
        <Alert tone="ok">Convite criado. Envie o link abaixo para {v.email} (por WhatsApp, por exemplo). Ele vale por 7 dias.</Alert>
        <p className="break-all rounded-xl bg-paper-2 p-3 text-sm">{link}</p>
        <CopyLink url={link} />
      </div>
    );
  }
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await inviteMemberAction(v); if (r.ok && r.data) setLink(r.data.link); else if (!r.ok) setError(r.error); }); }}>
      <Alert>{error}</Alert>
      <Field label="E-mail"><Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required /></Field>
      <Field label="Papel">
        <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as typeof v.role })}>
          <option value="professional">Profissional</option>
          <option value="receptionist">Recepção</option>
          <option value="admin">Administradora</option>
        </Select>
      </Field>
      <Field label="É qual profissional da agenda?" hint={v.role === "professional" ? "Obrigatório para profissionais." : "Opcional."}>
        <Select value={v.professionalId} onChange={(e) => setV({ ...v, professionalId: e.target.value })}>
          <option value="">Nenhuma</option>
          {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Criando…" : "Gerar convite"}</Button>
    </form>
  );
}

function MemberForm({ member, professionals, onDone }: { member: Member; professionals: Pro[]; onDone: () => void }) {
  const [v, setV] = useState({ role: member.role as "admin" | "professional" | "receptionist", professionalId: member.professionalId, active: member.active });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateMemberAction({ memberId: member.id, ...v }); if (r.ok) onDone(); else setError(r.error); }); }}>
      <Alert>{error}</Alert>
      <p className="font-medium">{member.name} <span className="font-normal text-muted">· {member.email}</span></p>
      <Field label="Papel">
        <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as typeof v.role })}>
          <option value="professional">Profissional</option><option value="receptionist">Recepção</option><option value="admin">Administradora</option>
        </Select>
      </Field>
      <Field label="Profissional vinculada">
        <Select value={v.professionalId} onChange={(e) => setV({ ...v, professionalId: e.target.value })}>
          <option value="">Nenhuma</option>
          {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <Checkbox checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} label="Acesso ativo" />
      <Button type="submit" className="w-full" disabled={pending}>Salvar</Button>
    </form>
  );
}
