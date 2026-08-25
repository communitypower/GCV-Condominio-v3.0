import { createHash } from 'node:crypto';
import {
  AiProposalStatus,
  AiProposalType,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  PlanFrequency,
  PlanStatus,
  PlatformRole,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import {
  configuredAiModel,
  configuredAiProvider,
  generateGroundedAnswer,
  generateOperationalProposal,
} from '../services/grounded-ai';
import { retrieveKnowledge } from '../services/knowledge-retrieval';

const router = Router();
const prisma = new PrismaClient();
const assistantRoles = [PlatformRole.syndic, PlatformRole.manager, PlatformRole.staff, PlatformRole.council_member];
const approvalRoles = [PlatformRole.syndic, PlatformRole.manager];

router.use((_req, res, next) => {
  if (process.env.ENABLE_AI_ASSISTANT !== 'true') {
    return res.status(403).json({ error: 'Assistente de IA desabilitado neste ambiente.', code: 'AI_ASSISTANT_DISABLED' });
  }
  next();
});

const querySchema = z.object({ prompt: z.string().trim().min(2).max(2000) });
const proposalRequestSchema = z.object({
  type: z.enum(AiProposalType),
  prompt: z.string().trim().min(2).max(2000),
  sourceVersionIds: z.array(z.string().uuid()).max(20).optional(),
});
const proposalReviewSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  reviewNotes: z.string().trim().max(2000).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Informe uma alteração.' });
const rejectionSchema = z.object({ reviewNotes: z.string().trim().min(2).max(2000) });

const planPayloadSchema = z.object({
  equipmentId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5000),
  frequency: z.enum(PlanFrequency),
  nextOccurrence: z.coerce.date(),
  status: z.literal(PlanStatus.suspended),
  risk: z.string().max(2000).optional(),
  procedureSteps: z.array(z.string().max(1000)).max(50).optional(),
}).passthrough();

const ticketPayloadSchema = z.object({
  unitId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5000),
  category: z.enum(MaintenanceCategory),
  priority: z.enum(MaintenancePriority),
  risk: z.string().max(2000).optional(),
  procedureSteps: z.array(z.string().max(1000)).max(50).optional(),
}).passthrough();

function retrievalAccess(req: any) {
  return {
    userId: req.user.id,
    isSystemAdmin: Boolean(req.user.isSystemAdmin),
    roles: [...new Set((req.authorizationContext?.memberships || []).map((membership: any) => membership.role))] as PlatformRole[],
  };
}

function asUntrustedModelSources<T extends { title: string; locator: string; excerpt: string }>(sources: T[]) {
  const neutralize = (value: string) => value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/</g, '‹')
    .replace(/>/g, '›');
  return sources.map((source) => ({
    ...source,
    title: neutralize(source.title),
    locator: neutralize(source.locator),
    excerpt: neutralize(source.excerpt),
  }));
}

async function tenantIdentity(condominiumId: string) {
  const condominium = await prisma.condominium.findUnique({ where: { id: condominiumId }, select: { accountId: true } });
  if (!condominium) throw new Error('CONDOMINIUM_NOT_FOUND');
  return condominium;
}

async function operationalContext(condominiumId: string) {
  const [equipment, tickets, plans, units] = await Promise.all([
    prisma.equipment.findMany({ where: { condominiumId }, select: { id: true, name: true, location: true, status: true } }),
    prisma.maintenanceTicket.findMany({ where: { condominiumId }, select: { status: true, priority: true, category: true } }),
    prisma.maintenancePlan.findMany({ where: { condominiumId }, select: { status: true, frequency: true } }),
    prisma.unit.findMany({ where: { building: { condominiumId } }, select: { id: true, number: true, building: { select: { name: true } } } }),
  ]);
  return {
    equipment,
    units,
    summary: {
      equipmentCount: equipment.length,
      openTickets: tickets.filter((ticket) => ticket.status !== MaintenanceStatus.resolved && ticket.status !== MaintenanceStatus.cancelled).length,
      activePlans: plans.filter((plan) => plan.status === PlanStatus.active).length,
    },
  };
}

router.post('/:condoId/assistant/query', requireAuth, tenantGuard, requireRole(assistantRoles), validateBody(querySchema), async (req: any, res) => {
  try {
    const tenant = await tenantIdentity(req.params.condoId);
    const sources = await retrieveKnowledge({
      accountId: tenant.accountId,
      condominiumId: req.params.condoId,
      query: req.body.prompt,
      access: retrievalAccess(req),
    });
    const context = await operationalContext(req.params.condoId);
    const text = await generateGroundedAnswer({
      prompt: req.body.prompt,
      sources: asUntrustedModelSources(sources),
      operationalContext: context.summary,
    });
    await prisma.auditEvent.create({
      data: {
        accountId: tenant.accountId,
        condominiumId: req.params.condoId,
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'document_access',
        entity: 'AssistantQuery',
        details: `Consulta fundamentada executada com ${sources.length} fonte(s) autorizada(s).`,
        ipAddress: req.ip,
      },
    });
    res.json({ text, sources: sources.map(({ quoteHash: _quoteHash, ...source }) => source) });
  } catch (error) {
    const code = (error as Error & { code?: string }).code;
    if (code === 'AI_DISABLED') return res.status(403).json({ error: error instanceof Error ? error.message : 'Assistente desabilitado.' });
    console.error('Grounded Assistant Error:', error);
    res.status(502).json({ error: 'Não foi possível consultar o assistente neste momento.' });
  }
});

router.get('/:condoId/assistant/proposals', requireAuth, tenantGuard, requireRole(assistantRoles), async (req, res) => {
  const proposals = await prisma.aiProposal.findMany({
    where: { condominiumId: req.params.condoId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(proposals);
});

router.post('/:condoId/assistant/proposals', requireAuth, tenantGuard, requireRole(assistantRoles), validateBody(proposalRequestSchema), async (req: any, res) => {
  try {
    const tenant = await tenantIdentity(req.params.condoId);
    const context = await operationalContext(req.params.condoId);
    const sources = await retrieveKnowledge({
      accountId: tenant.accountId,
      condominiumId: req.params.condoId,
      query: req.body.prompt,
      access: retrievalAccess(req),
      versionIds: req.body.sourceVersionIds,
      limit: 10,
    });
    if (sources.length === 0) return res.status(422).json({ error: 'Nenhuma fonte documental indexada foi encontrada para fundamentar a proposta.' });
    const generated = await generateOperationalProposal({
      type: req.body.type,
      prompt: req.body.prompt,
      sources: asUntrustedModelSources(sources),
      equipment: context.equipment,
      units: context.units,
    });
    const envelope = z.object({
      title: z.string().trim().min(1).max(180),
      rationale: z.string().trim().min(1).max(5000),
      confidence: z.coerce.number().min(0).max(1),
      payload: z.record(z.string(), z.unknown()),
    }).parse(generated);
    const payload = req.body.type === AiProposalType.maintenance_plan
      ? planPayloadSchema.parse(envelope.payload)
      : ticketPayloadSchema.parse(envelope.payload);

    if (payload.equipmentId && !context.equipment.some((item) => item.id === payload.equipmentId)) return res.status(422).json({ error: 'A IA sugeriu um equipamento fora do condomínio.' });
    if (payload.unitId && !context.units.some((item) => item.id === payload.unitId)) return res.status(422).json({ error: 'A IA sugeriu uma unidade fora do condomínio.' });

    const citations = sources.map((source) => ({
      documentId: source.documentId,
      versionId: source.versionId,
      chunkId: source.chunkId,
      title: source.title,
      locator: source.locator,
      excerpt: source.excerpt.slice(0, 500),
      quoteHash: source.quoteHash,
    }));
    const fingerprint = createHash('sha256').update(JSON.stringify({ type: req.body.type, payload, citations: citations.map((item) => item.quoteHash) })).digest('hex');
    const proposal = await prisma.aiProposal.upsert({
      where: { condominiumId_type_contentFingerprint: { condominiumId: req.params.condoId, type: req.body.type, contentFingerprint: fingerprint } },
      update: {},
      create: {
        accountId: tenant.accountId,
        condominiumId: req.params.condoId,
        sourceVersionId: citations[0]?.versionId,
        type: req.body.type,
        title: envelope.title,
        rationale: envelope.rationale,
        payload: payload as Prisma.InputJsonValue,
        citations: citations as Prisma.InputJsonValue,
        confidence: envelope.confidence,
        contentFingerprint: fingerprint,
        provider: configuredAiProvider(),
        model: configuredAiModel(),
        promptVersion: 'gcv-grounded-proposal-v1',
        createdByEmail: req.user.email,
      },
    });
    await prisma.auditEvent.create({
      data: { accountId: tenant.accountId, condominiumId: req.params.condoId, userId: req.user.id, userEmail: req.user.email, action: 'create', entity: 'AiProposal', entityId: proposal.id, details: `Rascunho ${proposal.type} criado com ${citations.length} fonte(s).`, ipAddress: req.ip },
    });
    res.status(201).json(proposal);
  } catch (error) {
    const code = (error as Error & { code?: string }).code;
    if (code === 'AI_DISABLED') return res.status(403).json({ error: error instanceof Error ? error.message : 'Assistente desabilitado.' });
    if (error instanceof z.ZodError) return res.status(422).json({ error: 'A resposta da IA não respeitou o contrato operacional.', details: error.issues });
    console.error('Proposal Generation Error:', error);
    res.status(502).json({ error: 'Não foi possível gerar a proposta fundamentada.' });
  }
});

router.patch('/:condoId/assistant/proposals/:proposalId', requireAuth, tenantGuard, requireRole(assistantRoles), validateBody(proposalReviewSchema), async (req: any, res) => {
  try {
    const proposal = await prisma.aiProposal.findFirst({ where: { id: req.params.proposalId, condominiumId: req.params.condoId } });
    if (!proposal) return res.status(404).json({ error: 'Proposta não encontrada.' });
    if (proposal.status !== AiProposalStatus.draft && proposal.status !== AiProposalStatus.in_review) return res.status(409).json({ error: 'Esta proposta não pode mais ser alterada.' });
    const payload = req.body.payload
      ? proposal.type === AiProposalType.maintenance_plan ? planPayloadSchema.parse(req.body.payload) : ticketPayloadSchema.parse(req.body.payload)
      : undefined;
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.aiProposal.update({
        where: { id: proposal.id },
        data: { ...(payload ? { payload: payload as Prisma.InputJsonValue } : {}), reviewNotes: req.body.reviewNotes, reviewedByEmail: req.user.email, reviewedAt: new Date(), status: AiProposalStatus.in_review },
      });
      await tx.auditEvent.create({ data: { accountId: proposal.accountId, condominiumId: proposal.condominiumId, userId: req.user.id, userEmail: req.user.email, action: 'update', entity: 'AiProposal', entityId: proposal.id, details: `Rascunho revisado por ${req.user.email}; campos propostos alterados: ${Boolean(payload)}.`, ipAddress: req.ip } });
      return result;
    });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(422).json({ error: 'Os campos revisados são inválidos.', details: error.issues });
    console.error('Proposal Review Error:', error);
    res.status(500).json({ error: 'Não foi possível revisar o rascunho.' });
  }
});

router.post('/:condoId/assistant/proposals/:proposalId/reject', requireAuth, tenantGuard, requireRole(approvalRoles), validateBody(rejectionSchema), async (req: any, res) => {
  const proposal = await prisma.aiProposal.findFirst({ where: { id: req.params.proposalId, condominiumId: req.params.condoId } });
  if (!proposal) return res.status(404).json({ error: 'Proposta não encontrada.' });
  const updated = await prisma.$transaction(async (tx) => {
    const decision = await tx.aiProposal.updateMany({
      where: { id: proposal.id, status: { in: [AiProposalStatus.draft, AiProposalStatus.in_review] } },
      data: { status: AiProposalStatus.rejected, reviewedByEmail: req.user.email, reviewedAt: new Date(), reviewNotes: req.body.reviewNotes },
    });
    if (decision.count === 1) await tx.auditEvent.create({ data: { accountId: proposal.accountId, condominiumId: proposal.condominiumId, userId: req.user.id, userEmail: req.user.email, action: 'update', entity: 'AiProposal', entityId: proposal.id, details: `Rascunho rejeitado com justificativa: ${req.body.reviewNotes}`, ipAddress: req.ip } });
    return decision;
  });
  if (updated.count !== 1) return res.status(409).json({ error: 'Proposta inexistente ou já decidida.' });
  res.json(await prisma.aiProposal.findUnique({ where: { id: req.params.proposalId } }));
});

router.post('/:condoId/assistant/proposals/:proposalId/approve', requireAuth, tenantGuard, requireRole(approvalRoles), async (req: any, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const proposal = await tx.aiProposal.findFirst({ where: { id: req.params.proposalId, condominiumId: req.params.condoId } });
      if (!proposal || (proposal.status !== AiProposalStatus.draft && proposal.status !== AiProposalStatus.in_review)) throw new Error('PROPOSAL_ALREADY_DECIDED');
      const claim = await tx.aiProposal.updateMany({
        where: { id: proposal.id, status: { in: [AiProposalStatus.draft, AiProposalStatus.in_review] } },
        data: { status: AiProposalStatus.approved, reviewedByEmail: req.user.email, reviewedAt: new Date() },
      });
      if (claim.count !== 1) throw new Error('PROPOSAL_ALREADY_DECIDED');

      let appliedEntity: { id: string };
      if (proposal.type === AiProposalType.maintenance_plan) {
        const payload = planPayloadSchema.parse(proposal.payload);
        const duplicate = await tx.maintenancePlan.findFirst({ where: { condominiumId: req.params.condoId, equipmentId: payload.equipmentId || null, title: payload.title, status: { in: [PlanStatus.active, PlanStatus.suspended] } } });
        if (duplicate) throw new Error('DUPLICATE_OPERATIONAL_RECORD');
        appliedEntity = await tx.maintenancePlan.create({ data: { condominiumId: req.params.condoId, equipmentId: payload.equipmentId || null, title: payload.title, description: payload.description, frequency: payload.frequency, nextOccurrence: payload.nextOccurrence, status: PlanStatus.suspended } });
      } else {
        const payload = ticketPayloadSchema.parse(proposal.payload);
        const duplicate = await tx.maintenanceTicket.findFirst({ where: { condominiumId: req.params.condoId, unitId: payload.unitId || null, title: payload.title, status: { in: [MaintenanceStatus.reported, MaintenanceStatus.in_progress] } } });
        if (duplicate) throw new Error('DUPLICATE_OPERATIONAL_RECORD');
        appliedEntity = await tx.maintenanceTicket.create({ data: { condominiumId: req.params.condoId, unitId: payload.unitId || null, title: payload.title, description: payload.description, category: payload.category, priority: payload.priority, status: MaintenanceStatus.reported } });
      }
      const applied = await tx.aiProposal.update({ where: { id: proposal.id }, data: { status: AiProposalStatus.applied, appliedEntityId: appliedEntity.id } });
      await tx.auditEvent.create({ data: { accountId: proposal.accountId, condominiumId: proposal.condominiumId, userId: req.user.id, userEmail: req.user.email, action: 'update', entity: 'AiProposal', entityId: proposal.id, details: `Rascunho aprovado e aplicado por confirmação humana em ${appliedEntity.id}.`, ipAddress: req.ip } });
      await tx.auditEvent.create({ data: { accountId: proposal.accountId, condominiumId: proposal.condominiumId, userId: req.user.id, userEmail: req.user.email, action: 'create', entity: proposal.type === AiProposalType.maintenance_plan ? 'MaintenancePlan' : 'MaintenanceTicket', entityId: appliedEntity.id, details: `Proposta de IA ${proposal.id} revisada e aplicada por confirmação humana.`, ipAddress: req.ip } });
      return { proposal: applied, appliedEntity };
    });
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'PROPOSAL_ALREADY_DECIDED') return res.status(409).json({ error: 'Proposta inexistente ou já decidida.' });
    if (error instanceof Error && error.message === 'DUPLICATE_OPERATIONAL_RECORD') return res.status(409).json({ error: 'Já existe um plano ou ordem aberta equivalente; revise antes de aplicar.' });
    if (error instanceof z.ZodError) return res.status(422).json({ error: 'O rascunho possui campos inválidos e precisa ser revisado.', details: error.issues });
    console.error('Proposal Approval Error:', error);
    res.status(500).json({ error: 'Não foi possível aplicar a proposta.' });
  }
});

export default router;
