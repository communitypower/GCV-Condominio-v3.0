import { Router } from 'express';
import { PrismaClient, PlatformRole, BillingStatus } from '@prisma/client';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const billingStatusSchema = z.enum(BillingStatus);
const monthStringSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Competência deve estar no formato YYYY-MM.');

const updateChargeStatusSchema = z.object({
  status: billingStatusSchema,
});

const createChargeSchema = z.object({
  unitId: z.string().uuid(),
  monthString: monthStringSchema,
  amount: z.coerce.number().positive(),
  dueDate: z.coerce.date(),
  description: z.string().trim().min(1).max(240),
});

const massGenerateSchema = z.object({
  monthString: monthStringSchema,
});

// GET /api/v1/condominiums/:condoId/charges
router.get('/:condoId/charges', requireAuth, tenantGuard, async (req: any, res) => {
  const { condoId } = req.params;
  try {
    const isStaff = req.user.memberships.some((m: any) =>
      [PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager, PlatformRole.accountant, PlatformRole.council_member].includes(m.role)
    );

    if (isStaff) {
      const charges = await prisma.charge.findMany({
        where: {
          billingPeriod: { condominiumId: condoId },
        },
        include: {
          unit: { include: { building: true } },
          lineItems: true,
        },
        orderBy: { dueDate: 'desc' },
      });
      return res.json(charges);
    }

    // Residents see only their unit's charges
    const userRelationships = await prisma.unitRelationship.findMany({
      where: {
        person: { email: req.user.email },
        unit: { building: { condominiumId: condoId } },
      },
      select: { unitId: true },
    });
    const unitIds = userRelationships.map((r) => r.unitId);

    const charges = await prisma.charge.findMany({
      where: {
        unitId: { in: unitIds },
      },
      include: {
        unit: { include: { building: true } },
        lineItems: true,
      },
      orderBy: { dueDate: 'desc' },
    });

    res.json(charges);
  } catch (error) {
    console.error("Fetch Charges Error:", error);
    res.status(500).json({ error: "Erro ao buscar faturamento." });
  }
});

// PATCH /api/v1/condominiums/:condoId/charges/:chargeId/status
router.patch(
  '/:condoId/charges/:chargeId/status',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.accountant]),
  validateBody(updateChargeStatusSchema),
  async (req: any, res) => {
    const { chargeId } = req.params;
    const { status } = req.body;

    try {
      const charge = await prisma.charge.findFirst({
        where: {
          id: chargeId,
          billingPeriod: { condominiumId: req.params.condoId },
        },
      });

      if (!charge) {
        return res.status(404).json({ error: "Cobrança não encontrada." });
      }

      const updatedCharge = await prisma.charge.update({
        where: { id: chargeId },
        data: {
          status: status as BillingStatus,
          paidAt: status === BillingStatus.paid ? new Date() : null,
        },
      });

      // Audit event logging
      const condo = await prisma.condominium.findFirst({
        where: {
          billingPeriods: {
            some: { id: charge.billingPeriodId }
          }
        }
      });
      if (condo) {
        await prisma.auditEvent.create({
          data: {
            accountId: condo.accountId,
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'update',
            entity: 'Charge',
            entityId: charge.id,
            details: `Cobrança atualizada de ${charge.status} para ${status}.`,
          }
        });
      }

      res.json(updatedCharge);
    } catch (error) {
      console.error("Update Charge Status Error:", error);
      res.status(500).json({ error: "Erro ao atualizar status de pagamento." });
    }
  }
);

// POST /api/v1/condominiums/:condoId/charges
router.post(
  '/:condoId/charges',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.accountant]),
  validateBody(createChargeSchema),
  async (req, res) => {
    const { condoId } = req.params;
    const { unitId, monthString, amount, dueDate, description } = req.body;

    try {
      // Find or create the billing period for this month and condominium
      let billingPeriod = await prisma.billingPeriod.findFirst({
        where: { condominiumId: condoId, monthString },
      });

      if (!billingPeriod) {
        billingPeriod = await prisma.billingPeriod.create({
          data: {
            condominiumId: condoId,
            monthString,
          },
        });
      }

      // Generate a mock barcode and pix Qr code
      const barcode = '34191.79001 01043.513184 91020.150008 7 97130000' + Math.floor(amount * 100).toString().padStart(6, '0');
      const pixQrCode = `00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL${monthString.replace('-', '')}${unitId}520400005303986540${amount.toFixed(2)}5802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL${monthString.replace('-', '')}${unitId}`;

      const charge = await prisma.charge.create({
        data: {
          unitId,
          billingPeriodId: billingPeriod.id,
          amount,
          dueDate,
          status: BillingStatus.pending,
          barcode,
          pixQrCode,
          description,
        },
        include: {
          unit: { include: { building: true } },
        }
      });

      res.status(201).json(charge);
    } catch (error) {
      console.error("Create Charge Error:", error);
      res.status(500).json({ error: "Erro ao criar cobrança." });
    }
  }
);

// POST /api/v1/condominiums/:condoId/charges/mass-generate
router.post(
  '/:condoId/charges/mass-generate',
  requireAuth,
  tenantGuard,
  requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.accountant]),
  validateBody(massGenerateSchema),
  async (req, res) => {
    const { condoId } = req.params;
    const { monthString } = req.body;

    try {
      // Find occupied or maintenance units
      const units = await prisma.unit.findMany({
        where: {
          building: { condominiumId: condoId },
          status: { in: ['occupied', 'maintenance'] }
        }
      });

      // Find or create billing period
      let billingPeriod = await prisma.billingPeriod.findFirst({
        where: { condominiumId: condoId, monthString },
      });

      if (!billingPeriod) {
        billingPeriod = await prisma.billingPeriod.create({
          data: {
            condominiumId: condoId,
            monthString,
          },
        });
      }

      // Find existing charges of this month
      const existingCharges = await prisma.charge.findMany({
        where: { billingPeriodId: billingPeriod.id }
      });
      const existingUnitIds = new Set(existingCharges.map(c => c.unitId));

      let countGenerated = 0;
      const createdCharges = [];

      for (const u of units) {
        if (!existingUnitIds.has(u.id)) {
          let standardAmount = 650.00;
          let desc = 'Taxa Condominial Ordinária';
          if (u.type === 'penthouse') {
            standardAmount = 1200.00;
            desc = 'Taxa Condominial Ordinária - Cobertura';
          } else if (u.type === 'house') {
            standardAmount = 850.00;
            desc = 'Taxa Condominial Ordinária - Residência';
          }

          const barcode = '34191.79001 01043.513184 91020.150008 7 97130000' + Math.floor(standardAmount * 100).toString().padStart(6, '0');
          const pixQrCode = `00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL${monthString.replace('-', '')}${u.id}520400005303986540${standardAmount.toFixed(2)}5802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL${monthString.replace('-', '')}${u.id}`;

          const charge = await prisma.charge.create({
            data: {
              unitId: u.id,
              billingPeriodId: billingPeriod.id,
              amount: standardAmount,
              dueDate: new Date(`${monthString}-10`),
              status: BillingStatus.pending,
              barcode,
              pixQrCode,
              description: desc,
            }
          });
          createdCharges.push(charge);
          countGenerated++;
        }
      }

      res.status(201).json({ countGenerated, charges: createdCharges });
    } catch (error) {
      console.error("Mass Generate Charges Error:", error);
      res.status(500).json({ error: "Erro ao gerar faturamento em massa." });
    }
  }
);

export default router;
