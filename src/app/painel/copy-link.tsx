"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui";

export function CopyLink({ url, label = "Copiar link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex shrink-0 gap-2">
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt("Copie o link:", url);
          }
        }}
      >
        {copied ? <Check size={17} /> : <Copy size={17} />} {copied ? "Copiado!" : label}
      </Button>
      <Button
        variant="secondary"
        aria-label="Compartilhar"
        className="px-3.5 sm:hidden"
        onClick={() => navigator.share?.({ url, title: "Agende seu horário" }).catch(() => {})}
      >
        <Share2 size={17} />
      </Button>
    </div>
  );
}
