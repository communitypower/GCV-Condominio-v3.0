export function isConfiguredSystemAdmin(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return (process.env.SYSTEM_ADMIN_EMAILS || '')
    .split(/[\s,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}
