"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "./ui";

export function Submit({ children, pendingText = "Salvando…", ...props }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
