import {
  AuditAction,
  InvitationStatus,
  MembershipStatus,
  PlatformRole,
  Prisma,
  PrismaClient,
  RelationshipRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { DomainError } from './domain-errors';
import { ensureInvitedIdentity, normalizeEmail } from './identity';

type TransactionClient = Prisma.TransactionClient;
type DatabaseClient = PrismaClient | TransactionClient;

const openStatuses: InvitationStatus[] = [InvitationStatus.pending, InvitationStatus.sent];
const DEFAULT_EXPIRATION_HOURS = 72;

export type CreateInvitationInput = {
  accountId: string;
  condominiumId: string;
  unitId?: string | null;
  email: string;
  name: string;
  phone?: string | null;
  role: PlatformRole;
  relationshipRole?: RelationshipRole | null;
  invitedById: string;
  invitedByEmail: string;
  ipAddress?: string | null;
  expiresInHours?: number;
};

export function hashInvitationToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function createToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token) };
}

function invitationSelect() {
  return {
    id: true,
    accountId: true,
    condominiumId: true,
    unitId: true,
    emailNormalized: true,
    invitedName: true,
    invitedPhone: true,
    role: true,
    relationshipRole: true,
    status: true,
    expiresAt: true,
    sentAt: true,
    acceptedAt: true,
    cancelledAt: true,
    revokedAt: true,
    invitedById: true,
    acceptedById: true,
    membershipId: true,
    unitRelationshipId: true,
    createdAt: true,
    updatedAt: true,
    unit: {
      select: {
        number: true,
        building: { select: { name: true } },
      },
    },
  } satisfies Prisma.InvitationSelect;
}

export function serializeInvitation<T extends object>(invitation: T): Omit<T, 'tokenHash'> {
  const safe = { ...invitation } as T & { tokenHash?: string };
  delete safe.tokenHash;
  return safe;
}

export function buildInvitationLinks(token: string) {
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return {
    acceptanceUrl: `${appUrl}/invite/${encodeURIComponent(token)}`,
    apiInspectUrl: `${appUrl}/api/v1/onboarding/invitations/${encodeURIComponent(token)}`,
  };
}

async function writeAudit(
  tx: TransactionClient,
  input: {
    accountId: string;
    condominiumId: string;
    userId?: string | null;
    userEmail?: string | null;
    action: AuditAction;
    entity: string;
    entityId?: string | null;
    details: string;
    ipAddress?: string | null;
  }
) {
  await tx.auditEvent.create({ data: input });
}

async function findScopedMembership(
  tx: TransactionClient,
  userId: string,
  accountId: string,
  condominiumId: string,
  role: PlatformRole
) {
  return tx.membership.findFirst({
    where: { userId, accountId, condominiumId, role },
  });
}

export async function createInvitationInTransaction(
  tx: TransactionClient,
  input: CreateInvitationInput
) {
  const condominium = await tx.condominium.findFirst({
    where: { id: input.condominiumId, accountId: input.accountId },
    select: { id: true },
  });
  if (!condominium) {
    throw new DomainError('CONDOMINIUM_NOT_IN_ACCOUNT', 'Condomínio não pertence à conta informada.', 400);
  }
  if (input.unitId) {
    const unit = await tx.unit.findFirst({
      where: { id: input.unitId, building: { condominiumId: input.condominiumId } },
      select: { id: true },
    });
    if (!unit) {
      throw new DomainError('UNIT_NOT_IN_CONDOMINIUM', 'Unidade não encontrada neste condomínio.', 400);
    }
  }
  if (input.role === PlatformRole.resident && (!input.unitId || !input.relationshipRole)) {
    throw new DomainError('RESIDENT_UNIT_REQUIRED', 'Convites de moradores exigem unidade e tipo de vínculo.', 400);
  }

  const identity = await ensureInvitedIdentity(tx, input);
  const activeMembership = await findScopedMembership(
    tx,
    identity.user.id,
    input.accountId,
    input.condominiumId,
    input.role
  );
  if (activeMembership?.status === MembershipStatus.active) {
    throw new DomainError('MEMBERSHIP_ALREADY_ACTIVE', 'Esta pessoa já possui acesso ativo com o perfil informado.', 409);
  }

  await tx.invitation.updateMany({
    where: {
      condominiumId: input.condominiumId,
      emailNormalized: normalizeEmail(input.email),
      role: input.role,
      status: { in: openStatuses },
    },
    data: { status: InvitationStatus.cancelled, cancelledAt: new Date() },
  });

  const membership = activeMembership
    ? await tx.membership.update({
        where: { id: activeMembership.id },
        data: {
          status: MembershipStatus.pending,
          activatedAt: null,
          revokedAt: null,
          revokedById: null,
        },
      })
    : await tx.membership.create({
        data: {
          userId: identity.user.id,
          accountId: input.accountId,
          condominiumId: input.condominiumId,
          role: input.role,
      status: MembershipStatus.pending,
      activatedAt: null,
    },
  });

  const { token, tokenHash } = createToken();
  const expiresAt = new Date(Date.now() + (input.expiresInHours ?? DEFAULT_EXPIRATION_HOURS) * 60 * 60 * 1000);
  const invitation = await tx.invitation.create({
    data: {
      accountId: input.accountId,
      condominiumId: input.condominiumId,
      unitId: input.unitId,
      emailNormalized: normalizeEmail(input.email),
      invitedName: input.name.trim(),
      invitedPhone: input.phone?.trim() || null,
      role: input.role,
      relationshipRole: input.relationshipRole,
      tokenHash,
      status: InvitationStatus.pending,
      expiresAt,
      invitedById: input.invitedById,
      membershipId: membership.id,
    },
    select: invitationSelect(),
  });

  await writeAudit(tx, {
    accountId: input.accountId,
    condominiumId: input.condominiumId,
    userId: input.invitedById,
    userEmail: input.invitedByEmail,
    action: AuditAction.create,
    entity: 'Invitation',
    entityId: invitation.id,
    details: `Convite criado para ${normalizeEmail(input.email)} com perfil ${input.role}.`,
    ipAddress: input.ipAddress,
  });

  return { invitation, token, identity };
}

async function deliverInvitation(invitation: {
  id: string;
  emailNormalized: string;
  invitedName: string;
}, token: string) {
  const links = buildInvitationLinks(token);
  const webhookUrl = process.env.INVITATION_EMAIL_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return { method: 'manual_link' as const, ...links };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.INVITATION_EMAIL_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.INVITATION_EMAIL_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        invitationId: invitation.id,
        recipient: invitation.emailNormalized,
        recipientName: invitation.invitedName,
        ...links,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { method: 'email_webhook' as const };
  } catch (error) {
    console.error('Invitation delivery failed; using manual link fallback:', error);
    return { method: 'manual_link' as const, fallbackReason: 'email_transport_failed', ...links };
  }
}

export async function finalizeInvitationDelivery(
  prisma: PrismaClient,
  invitation: { id: string; emailNormalized: string; invitedName: string },
  token: string
) {
  const delivery = await deliverInvitation(invitation, token);
  const sentAt = new Date();
  await prisma.invitation.updateMany({
    where: { id: invitation.id, status: InvitationStatus.pending },
    data: { status: InvitationStatus.sent, sentAt },
  });
  return delivery;
}

export async function createInvitation(prisma: PrismaClient, input: CreateInvitationInput) {
  const created = await prisma.$transaction((tx) => createInvitationInTransaction(tx, input));
  const delivery = await finalizeInvitationDelivery(prisma, created.invitation, created.token);
  return {
    invitation: serializeInvitation(created.invitation),
    delivery,
  };
}

async function loadInvitationByToken(prisma: DatabaseClient, token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: {
      condominium: { select: { name: true } },
      unit: { select: { number: true, building: { select: { name: true } } } },
      membership: {
        include: {
          user: {
            include: { oauthAccounts: { select: { id: true } }, person: true },
          },
        },
      },
    },
  });
  if (!invitation) {
    throw new DomainError('INVITATION_NOT_FOUND', 'Convite inválido.', 404);
  }
  if (openStatuses.includes(invitation.status) && invitation.expiresAt <= new Date()) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.expired },
    });
    throw new DomainError('INVITATION_EXPIRED', 'Convite expirado.', 410);
  }
  return invitation;
}

export async function inspectInvitation(prisma: PrismaClient, token: string) {
  const invitation = await loadInvitationByToken(prisma, token);
  if (!openStatuses.includes(invitation.status)) {
    throw new DomainError('INVITATION_UNAVAILABLE', `Convite ${invitation.status}.`, 409);
  }
  const user = invitation.membership?.user;
  return {
    id: invitation.id,
    email: invitation.emailNormalized,
    name: invitation.invitedName,
    phone: invitation.invitedPhone,
    role: invitation.role,
    relationshipRole: invitation.relationshipRole,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    condominium: invitation.condominium,
    unit: invitation.unit,
    requiresExistingAccountLogin: Boolean(user?.passwordHash || user?.oauthAccounts.length),
  };
}

export async function acceptInvitation(
  prisma: PrismaClient,
  input: {
    token: string;
    authenticatedUserId?: string;
    password?: string;
    name?: string;
    phone?: string;
    ipAddress?: string | null;
  }
) {
  return prisma.$transaction(async (tx) => {
    const invitation = await loadInvitationByToken(tx, input.token);
    if (!openStatuses.includes(invitation.status)) {
      throw new DomainError('INVITATION_UNAVAILABLE', `Convite ${invitation.status}.`, 409);
    }
    const membership = invitation.membership;
    const invitedUser = membership?.user;
    if (!membership || !invitedUser) {
      throw new DomainError('INVITATION_IDENTITY_MISSING', 'Identidade do convite não encontrada.', 409);
    }

    if (input.authenticatedUserId) {
      if (invitedUser.id !== input.authenticatedUserId) {
        throw new DomainError('INVITATION_EMAIL_MISMATCH', 'O convite pertence a outra conta.', 403);
      }
    } else {
      const hasEstablishedAccount = Boolean(invitedUser.passwordHash || invitedUser.oauthAccounts.length);
      if (hasEstablishedAccount) {
        throw new DomainError('EXISTING_ACCOUNT_LOGIN_REQUIRED', 'Entre na conta existente para aceitar este convite.', 409);
      }
      if (!input.password || input.password.length < 10) {
        throw new DomainError('PASSWORD_REQUIRED', 'Informe uma senha com pelo menos 10 caracteres.', 400);
      }
      await tx.user.update({
        where: { id: invitedUser.id },
        data: { passwordHash: await bcrypt.hash(input.password, 12) },
      });
    }

    if (input.name || input.phone !== undefined) {
      await tx.person.update({
        where: { id: invitedUser.personId! },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
        },
      });
    }

    const acceptedAt = new Date();
    await tx.membership.update({
      where: { id: membership.id },
      data: {
        status: MembershipStatus.active,
        activatedAt: acceptedAt,
        revokedAt: null,
        revokedById: null,
      },
    });

    let unitRelationshipId = invitation.unitRelationshipId;
    if (invitation.unitId && invitation.relationshipRole) {
      const existingRelationship = await tx.unitRelationship.findFirst({
        where: {
          unitId: invitation.unitId,
          personId: invitedUser.personId!,
          role: invitation.relationshipRole,
        },
      });
      const relationship = existingRelationship
        ? await tx.unitRelationship.update({
            where: { id: existingRelationship.id },
            data: { endDate: null, startDate: acceptedAt },
          })
        : await tx.unitRelationship.create({
            data: {
              unitId: invitation.unitId,
              personId: invitedUser.personId!,
              role: invitation.relationshipRole,
              startDate: acceptedAt,
            },
          });
      unitRelationshipId = relationship.id;
    }

    const accepted = await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.accepted,
        acceptedAt,
        acceptedById: invitedUser.id,
        unitRelationshipId,
      },
      select: invitationSelect(),
    });
    await writeAudit(tx, {
      accountId: invitation.accountId,
      condominiumId: invitation.condominiumId,
      userId: invitedUser.id,
      userEmail: invitedUser.email,
      action: AuditAction.update,
      entity: 'Invitation',
      entityId: invitation.id,
      details: `Convite aceito por ${invitedUser.email}.`,
      ipAddress: input.ipAddress,
    });
    return serializeInvitation(accepted);
  });
}

export async function resendInvitation(
  prisma: PrismaClient,
  input: {
    invitationId: string;
    condominiumId: string;
    actorId: string;
    actorEmail: string;
    ipAddress?: string | null;
  }
) {
  const rotated = await prisma.$transaction(async (tx) => {
    const current = await tx.invitation.findFirst({
      where: { id: input.invitationId, condominiumId: input.condominiumId },
    });
    if (!current) throw new DomainError('INVITATION_NOT_FOUND', 'Convite não encontrado.', 404);
    const resendableStatuses: InvitationStatus[] = [...openStatuses, InvitationStatus.expired];
    if (!resendableStatuses.includes(current.status)) {
      throw new DomainError('INVITATION_NOT_RESENDABLE', 'Este convite não pode ser reenviado.', 409);
    }
    const { token, tokenHash } = createToken();
    const invitation = await tx.invitation.update({
      where: { id: current.id },
      data: {
        tokenHash,
        status: InvitationStatus.pending,
        expiresAt: new Date(Date.now() + DEFAULT_EXPIRATION_HOURS * 60 * 60 * 1000),
        sentAt: null,
        cancelledAt: null,
      },
      select: invitationSelect(),
    });
    await writeAudit(tx, {
      accountId: current.accountId,
      condominiumId: current.condominiumId,
      userId: input.actorId,
      userEmail: input.actorEmail,
      action: AuditAction.update,
      entity: 'Invitation',
      entityId: current.id,
      details: `Convite reenviado para ${current.emailNormalized}; token anterior invalidado.`,
      ipAddress: input.ipAddress,
    });
    return { invitation, token };
  });
  const delivery = await finalizeInvitationDelivery(prisma, rotated.invitation, rotated.token);
  return { invitation: serializeInvitation(rotated.invitation), delivery };
}

export async function closeInvitation(
  prisma: PrismaClient,
  input: {
    invitationId: string;
    condominiumId: string;
    actorId: string;
    actorEmail: string;
    action: 'cancel' | 'revoke';
    ipAddress?: string | null;
  }
) {
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findFirst({
      where: { id: input.invitationId, condominiumId: input.condominiumId },
    });
    if (!invitation) throw new DomainError('INVITATION_NOT_FOUND', 'Convite não encontrado.', 404);

    if (input.action === 'cancel' && !openStatuses.includes(invitation.status)) {
      throw new DomainError('INVITATION_NOT_CANCELLABLE', 'Apenas convites pendentes podem ser cancelados.', 409);
    }
    if (input.action === 'revoke' && invitation.status === InvitationStatus.revoked) {
      return serializeInvitation(invitation);
    }

    const now = new Date();
    const status = input.action === 'cancel' ? InvitationStatus.cancelled : InvitationStatus.revoked;
    if (invitation.membershipId) {
      await tx.membership.update({
        where: { id: invitation.membershipId },
        data: {
          status: MembershipStatus.revoked,
          revokedAt: now,
          revokedById: input.actorId,
        },
      });
    }
    if (invitation.unitRelationshipId) {
      await tx.unitRelationship.update({
        where: { id: invitation.unitRelationshipId },
        data: { endDate: now },
      });
    }
    const updated = await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        status,
        ...(input.action === 'cancel' ? { cancelledAt: now } : { revokedAt: now }),
      },
      select: invitationSelect(),
    });
    await writeAudit(tx, {
      accountId: invitation.accountId,
      condominiumId: invitation.condominiumId,
      userId: input.actorId,
      userEmail: input.actorEmail,
      action: AuditAction.update,
      entity: 'Invitation',
      entityId: invitation.id,
      details: `Convite ${input.action === 'cancel' ? 'cancelado' : 'revogado'} para ${invitation.emailNormalized}.`,
      ipAddress: input.ipAddress,
    });
    return serializeInvitation(updated);
  });
}

export async function listInvitations(prisma: PrismaClient, condominiumId: string) {
  await prisma.invitation.updateMany({
    where: {
      condominiumId,
      status: { in: openStatuses },
      expiresAt: { lte: new Date() },
    },
    data: { status: InvitationStatus.expired },
  });
  const invitations = await prisma.invitation.findMany({
    where: { condominiumId },
    select: invitationSelect(),
    orderBy: { createdAt: 'desc' },
  });
  return invitations.map((invitation) => serializeInvitation(invitation));
}
