type AuthPresentationUser = {
  isSystemAdmin?: boolean;
  memberships?: Array<{ role?: string }>;
};

export function authDescription(user: AuthPresentationUser) {
  if (user.isSystemAdmin) return 'Superusuário da Plataforma';
  return user.memberships?.[0]?.role || 'Morador';
}
