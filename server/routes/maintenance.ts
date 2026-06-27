import { Router } from 'express';
import { PrismaClient, PlatformRole, MaintenanceStatus, MaintenanceCategory, MaintenancePriority } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const maintenanceCategorySchema = z.enum(MaintenanceCategory);
const maintenancePrioritySchema = z.enum(MaintenancePriority);
const maintenanceStatusSchema = z.enum(MaintenanceStatus);

const createTicketSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5000),
  category: maintenanceCategorySchema,
  priority: maintenancePrioritySchema,
  unitId: z.string().uuid().optional().nullable(),
  estimatedCost: z.coerce.number().nonnegative().optional().nullable(),
});

const updateTicketSchema = z.object({
  status: maintenanceStatusSchema.optional(),
  assignedStaff: z.string().trim().min(1).max(160).optional().nullable(),
  estimatedCost: z.coerce.number().nonnegative().optional().nullable(),
  actualCost: z.coerce.number().nonnegative().optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Ao menos um campo deve ser informado.',
});

const commentSchema = z.object({
  comment: z.string().trim().min(1).max(2000),
});

// GET /api/v1/condominiums/:condoId/tickets
router.get('/:condoId/tickets', requireAuth, tenantGuard, async (req: any, res) => {
  const { condoId } = req.params;
  try {
    const isStaff = req.user.memberships.some((m: any) =>
      [PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager, PlatformRole.council_member, PlatformRole.accountant].includes(m.role)
    );

    if (isStaff) {
      // Staff see all tickets in the condominium
      const tickets = await prisma.maintenanceTicket.findMany({
        where: { condominiumId: condoId },
        include: { comments: true },
        orderBy: { updatedAt: 'desc' },
      });
      return res.json(tickets);
    }

    // Residents see only common area tickets or their own unit tickets
    // Resolve resident unit IDs
    const userRelationships = await prisma.unitRelationship.findMany({
      where: {
        person: { email: req.user.email },
        unit: { building: { condominiumId: condoId } },
      },
      select: { unitId: true },
    });
    const unitIds = userRelationships.map((r) => r.unitId);

    const tickets = await prisma.maintenanceTicket.findMany({
      where: {
        condominiumId: condoId,
        OR: [
          { unitId: null }, // Common area
          { unitId: { in: unitIds } }, // Resident unit
        ],
      },
      include: { comments: true },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(tickets);
  } catch (error) {
    console.error("Fetch Tickets Error:", error);
    res.status(500).json({ error: "Erro ao buscar chamados de manutenção." });
  }
});

// POST /api/v1/condominiums/:condoId/tickets
router.post('/:condoId/tickets', requireAuth, tenantGuard, validateBody(createTicketSchema), async (req: any, res) => {
  const { condoId } = req.params;
  const { title, description, category, priority, unitId, estimatedCost } = req.body;

  try {
    // If unitId is specified, verify it belongs to this condo
    if (unitId) {
      const unitExists = await prisma.unit.findFirst({
        where: { id: unitId, building: { condominiumId: condoId } },
      });
      if (!unitExists) {
        return res.status(400).json({ error: "Unidade inválida para este condomínio." });
      }

      // Verify resident belongs to the unit if not staff/syndic
      const isStaff = req.user.memberships.some((m: any) =>
        [PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager].includes(m.role)
      );
      if (!isStaff) {
        const belongsToUnit = await prisma.unitRelationship.findFirst({
          where: { unitId, person: { email: req.user.email } },
        });
        if (!belongsToUnit) {
          return res.status(403).json({ error: "Você não possui permissão para registrar chamado nesta unidade." });
        }
      }
    }

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        condominiumId: condoId,
        unitId: unitId || null,
        title,
        description,
        category: category as MaintenanceCategory,
        priority: priority as MaintenancePriority,
        status: MaintenanceStatus.reported,
        estimatedCost: estimatedCost ?? null,
      },
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error("Create Ticket Error:", error);
    res.status(500).json({ error: "Erro ao criar chamado de manutenção." });
  }
});

// PATCH /api/v1/condominiums/:condoId/tickets/:ticketId
router.patch(
  '/:condoId/tickets/:ticketId',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]),
  validateBody(updateTicketSchema),
  async (req: any, res) => {
    const { ticketId } = req.params;
    const { status, assignedStaff, estimatedCost, actualCost } = req.body;

    try {
      const existingTicket = await prisma.maintenanceTicket.findFirst({
        where: {
          id: ticketId,
          condominiumId: req.params.condoId,
        },
      });

      if (!existingTicket) {
        return res.status(404).json({ error: "Chamado não encontrado." });
      }

      const updateData: any = {};
      if (status) updateData.status = status as MaintenanceStatus;
      if (assignedStaff !== undefined) updateData.assignedStaff = assignedStaff;
      if (estimatedCost !== undefined) updateData.estimatedCost = estimatedCost;
      if (actualCost !== undefined) updateData.actualCost = actualCost;

      if (status && status === MaintenanceStatus.resolved) {
        updateData.resolvedAt = new Date();
      }

      const ticket = await prisma.maintenanceTicket.update({
        where: { id: ticketId },
        data: updateData,
      });

      // Track status change history
      if (status && status !== existingTicket.status) {
        await prisma.ticketStatusHistory.create({
          data: {
            ticketId,
            fromStatus: existingTicket.status,
            toStatus: status as MaintenanceStatus,
            changedBy: req.user.email,
          },
        });
      }

      res.json(ticket);
    } catch (error) {
      console.error("Update Ticket Error:", error);
      res.status(500).json({ error: "Erro ao atualizar chamado." });
    }
  }
);

// POST /api/v1/condominiums/:condoId/tickets/:ticketId/comments
router.post('/:condoId/tickets/:ticketId/comments', requireAuth, tenantGuard, validateBody(commentSchema), async (req: any, res) => {
  const { ticketId } = req.params;
  const { comment } = req.body;

  try {
    const ticket = await prisma.maintenanceTicket.findFirst({
      where: {
        id: ticketId,
        condominiumId: req.params.condoId,
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Chamado não encontrado." });
    }

    const ticketComment = await prisma.ticketComment.create({
      data: {
        ticketId,
        authorName: req.user.email,
        comment,
      },
    });

    res.status(201).json(ticketComment);
  } catch (error) {
    console.error("Add Comment Error:", error);
    res.status(500).json({ error: "Erro ao adicionar comentário." });
  }
});

export default router;
