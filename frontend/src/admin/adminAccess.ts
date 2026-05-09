/** Back-office: administrador ou equipa de suporte/moderação. */
export function isBackOfficeStaff(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPORTE";
}

/** Controlo total da plataforma (finanças, equipa, fretes, site crítico, etc.). */
export function isPlatformAdmin(role: string | undefined): boolean {
  return role === "ADMIN";
}
