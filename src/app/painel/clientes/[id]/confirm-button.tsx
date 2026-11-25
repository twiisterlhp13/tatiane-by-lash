"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/modal";

export function ConfirmButton({ action, label, confirm }: { action: () => Promise<void>; label: string; confirm: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>{label}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        <p className="text-sm text-ink-2">{confirm}</p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Voltar</Button>
          <Button variant="danger" className="flex-1" disabled={pending} onClick={() => start(() => action())}>{pending ? "Aguarde…" : "Confirmar"}</Button>
        </div>
      </Modal>
    </>
  );
}
