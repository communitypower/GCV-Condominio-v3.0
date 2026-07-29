import { Prisma } from '@prisma/client';
import { DomainError } from './domain-errors';

type TransactionClient = Prisma.TransactionClient;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function ensureInvitedIdentity(
  tx: TransactionClient,
  input: { email: string; name: string; phone?: string | null }
) {
  const email = normalizeEmail(input.email);
  const user = await tx.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { person: true, oauthAccounts: { select: { id: true } } },
  });
  const existingPerson = await tx.person.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { user: { select: { id: true } } },
  });
  const person = user?.person ?? existingPerson;

  if (user && person && user.personId && user.personId !== person.id) {
    throw new DomainError('IDENTITY_CONFLICT', 'E-mail vinculado a identidades incompatíveis.', 409);
  }
  if (!user && existingPerson?.user) {
    throw new DomainError('IDENTITY_CONFLICT', 'E-mail já vinculado a outra conta.', 409);
  }

  const resolvedPerson = person ?? await tx.person.create({
    data: {
      email,
      name: input.name.trim(),
      phone: input.phone?.trim() || '',
    },
  });

  const resolvedUser = user
    ? user.personId
      ? user
      : await tx.user.update({
          where: { id: user.id },
          data: { personId: resolvedPerson.id },
          include: { person: true, oauthAccounts: { select: { id: true } } },
        })
    : await tx.user.create({
        data: {
          email,
          personId: resolvedPerson.id,
        },
        include: { person: true, oauthAccounts: { select: { id: true } } },
      });

  return {
    user: resolvedUser,
    person: resolvedPerson,
    hasEstablishedAccount: Boolean(resolvedUser.passwordHash || resolvedUser.oauthAccounts.length),
  };
}
