import { AuditAction, PlatformRole, PrismaClient } from '@prisma/client';
import {
  createInvitationInTransaction,
  finalizeInvitationDelivery,
  serializeInvitation,
} from './invitations';

export async function onboardCondominium(
  prisma: PrismaClient,
  input: {
    accountName: string;
    condominiumName: string;
    condominiumAddress: string;
    syndicName: string;
    syndicEmail: string;
    syndicPhone?: string | null;
    actorId: string;
    actorEmail: string;
    ipAddress?: string | null;
  }
) {
  const created = await prisma.$transaction(async (tx) => {
    const account = await tx.account.create({ data: { name: input.accountName.trim() } });
    const condominium = await tx.condominium.create({
      data: {
        accountId: account.id,
        name: input.condominiumName.trim(),
        address: input.condominiumAddress.trim(),
      },
    });
    const invitationResult = await createInvitationInTransaction(tx, {
      accountId: account.id,
      condominiumId: condominium.id,
      email: input.syndicEmail,
      name: input.syndicName,
      phone: input.syndicPhone,
      role: PlatformRole.syndic,
      invitedById: input.actorId,
      invitedByEmail: input.actorEmail,
      ipAddress: input.ipAddress,
    });
    await tx.auditEvent.create({
      data: {
        accountId: account.id,
        condominiumId: condominium.id,
        userId: input.actorId,
        userEmail: input.actorEmail,
        action: AuditAction.create,
        entity: 'CondominiumOnboarding',
        entityId: condominium.id,
        details: `Conta, condomínio e convite do síndico criados para ${input.syndicEmail.trim().toLowerCase()}.`,
        ipAddress: input.ipAddress,
      },
    });
    return { account, condominium, ...invitationResult };
  });
  const finalized = await finalizeInvitationDelivery(prisma, created.invitation, created.token);
  return {
    account: created.account,
    condominium: created.condominium,
    syndic: {
      id: created.identity.user.id,
      email: created.identity.user.email,
      name: created.identity.person.name,
    },
    invitation: serializeInvitation(finalized.invitation),
    delivery: finalized.delivery,
  };
}
