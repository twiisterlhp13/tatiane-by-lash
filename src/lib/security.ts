import { createHash, randomBytes, randomInt } from "node:crypto";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** Código curto e legível do agendamento (ex.: TBL-7K3M9Q). */
export function appointmentCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/** Normaliza telefone brasileiro para apenas dígitos com DDI 55. */
export function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return digits;
}

export function isValidBrPhone(raw: string) {
  const d = normalizePhone(raw);
  return /^55\d{10,11}$/.test(d);
}

export function formatPhone(raw: string) {
  const d = normalizePhone(raw);
  if (!d.startsWith("55")) return raw;
  const local = d.slice(2);
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return raw;
}

/** Mascara telefone para papéis que não precisam ver o dado completo. */
export function maskPhone(raw: string) {
  const d = normalizePhone(raw);
  if (d.length < 6) return "••••";
  return `(${d.slice(2, 4)}) •••••-${d.slice(-4)}`;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Rotas do sistema que não podem ser usadas como link público de empresa. */
export const RESERVED_SLUGS = new Set([
  "api", "painel", "entrar", "sair", "cadastro", "convite", "recuperar-senha", "redefinir-senha",
  "termos", "privacidade", "admin", "app", "static", "_next", "manifest", "sw", "icons", "favicon",
  "robots", "sitemap", "agendar", "a", "login", "logout", "suporte",
]);

export function whatsappLink(phone: string, text?: string) {
  const d = normalizePhone(phone);
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
