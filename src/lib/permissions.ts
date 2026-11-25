export type Role = "owner" | "admin" | "professional" | "receptionist";

export type Permission =
  | "agenda.view_all" // ver agenda de todos os profissionais
  | "agenda.manage_all" // criar/alterar agendamentos de qualquer profissional
  | "agenda.manage_own" // criar/alterar os próprios agendamentos e bloqueios
  | "clients.view"
  | "clients.manage"
  | "clients.view_phone" // ver telefone completo
  | "clients.privacy" // exportar / anonimizar dados (LGPD)
  | "services.manage"
  | "team.manage"
  | "hours.manage"
  | "settings.manage"
  | "reports.view"
  | "audit.view";

const MATRIX: Record<Role, Permission[]> = {
  owner: [
    "agenda.view_all", "agenda.manage_all", "agenda.manage_own", "clients.view", "clients.manage", "clients.view_phone",
    "clients.privacy", "services.manage", "team.manage", "hours.manage", "settings.manage", "reports.view", "audit.view",
  ],
  admin: [
    "agenda.view_all", "agenda.manage_all", "agenda.manage_own", "clients.view", "clients.manage", "clients.view_phone",
    "clients.privacy", "services.manage", "team.manage", "hours.manage", "settings.manage", "reports.view", "audit.view",
  ],
  receptionist: [
    "agenda.view_all", "agenda.manage_all", "agenda.manage_own", "clients.view", "clients.manage", "clients.view_phone",
  ],
  professional: ["agenda.manage_own", "clients.view", "clients.view_phone"],
};

export function can(role: Role, permission: Permission) {
  return MATRIX[role]?.includes(permission) ?? false;
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Proprietária",
  admin: "Administradora",
  professional: "Profissional",
  receptionist: "Recepção",
};
