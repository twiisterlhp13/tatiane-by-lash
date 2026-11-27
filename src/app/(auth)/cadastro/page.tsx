import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { Onboarding } from "./onboarding";

export const metadata = { title: "Criar conta" };

export default async function Page() {
  if (await getCtx()) redirect("/painel");
  return <Onboarding />;
}
