export const PLATFORM_ADMIN_EMAILS = [
  'cassianomarins@gmail.com',
  'vitorlcastro92@gmail.com',
] as const;

const platformAdminEmailSet = new Set<string>(PLATFORM_ADMIN_EMAILS);

export function isApprovedPlatformAdminEmail(email: string) {
  return platformAdminEmailSet.has(email.trim().toLowerCase());
}

export function hasPlatformAdminAccess(user: { email: string; isSystemAdmin: boolean }) {
  return user.isSystemAdmin && isApprovedPlatformAdminEmail(user.email);
}
