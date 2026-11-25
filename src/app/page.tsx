import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck, Lock, Smartphone } from "lucide-react";
import { getCtx } from "@/lib/auth";

export default async function Home() {
  // Domínio próprio de um único negócio: a raiz leva direto à página de agendamento
  if (process.env.DEFAULT_ORG_SLUG) redirect(`/${process.env.DEFAULT_ORG_SLUG}`);
  const ctx = await getCtx();
  return (
    <main className="min-h-dvh">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="font-display text-xl text-berry">Agenda</span>
        <div className="flex gap-2 text-sm">
          {ctx ? (
            <Link href="/painel" className="rounded-full bg-berry px-5 py-2.5 font-medium text-white">Abrir painel</Link>
          ) : (
            <>
              <Link href="/entrar" className="rounded-full px-4 py-2.5 text-ink-2 hover:bg-paper-2">Entrar</Link>
              <Link href="/cadastro" className="rounded-full bg-berry px-5 py-2.5 font-medium text-white">Criar conta</Link>
            </>
          )}
        </div>
      </div>
      <section className="mx-auto max-w-3xl px-5 pb-16 pt-14 text-center sm:pt-24">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-berry">Agenda online para quem atende com hora marcada</p>
        <h1 className="mt-4 font-display text-4xl leading-[1.1] sm:text-6xl">Suas clientes agendam sozinhas. Você cuida do resto.</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-2">Link de agendamento, agenda no celular, bloqueio de horários e lembretes automáticos. Sem planilha e sem troca infinita de mensagens.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/cadastro" className="inline-flex min-h-12 items-center rounded-full bg-berry px-7 font-medium text-white">Começar grátis</Link>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-5 pb-20 sm:grid-cols-3">
        {[
          { icon: CalendarCheck, title: "Agendamento 24h", text: "Só aparecem horários realmente livres, já descontando intervalos e bloqueios." },
          { icon: Lock, title: "Bloqueie em segundos", text: "Médico, almoço, férias: feche a agenda sem expor o motivo para ninguém." },
          { icon: Smartphone, title: "App no celular", text: "Instale o painel na tela inicial do Android e acompanhe tudo em tempo real." },
        ].map((f) => (
          <div key={f.title} className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-soft)]">
            <f.icon className="text-berry" size={24} strokeWidth={1.7} />
            <h2 className="mt-3 font-display text-xl">{f.title}</h2>
            <p className="mt-1 text-sm text-ink-2">{f.text}</p>
          </div>
        ))}
      </section>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        <Link href="/termos" className="hover:underline">Termos de uso</Link> · <Link href="/privacidade" className="hover:underline">Privacidade</Link>
      </footer>
    </main>
  );
}
