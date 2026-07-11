import { Router } from 'express';
import {
  DataImportEntity,
  DataImportSource,
  DataImportStatus,
  EquipmentStatus,
  PlatformRole,
  Prisma,
  PrismaClient,
  RelationshipRole,
  UnitStatus,
  UnitType,
} from '@prisma/client';
import { z } from 'zod';
import path from 'path';
import { requireAuth, requireRole, tenantGuard } from '../middleware/auth';
import { validateBody } from '../middleware/validation';

const router = Router();
const prisma = new PrismaClient();
type DbClient = Prisma.TransactionClient | PrismaClient;

const createImportSchema = z.object({
  source: z.enum(DataImportSource),
  entity: z.enum(DataImportEntity),
  fileName: z.string().trim().max(255).optional(),
  records: z.array(z.record(z.string(), z.unknown())).min(1).max(1000),
});

type ImportRecord = Record<string, unknown>;
type ValidationIssue = { row: number; field: string; message: string };

const textValue = (record: ImportRecord, field: string) =>
  typeof record[field] === 'string' ? record[field].trim() : '';

const dateValue = (value: unknown) => {
  const date = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

function validateRecord(entity: DataImportEntity, record: ImportRecord, row: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const required = (field: string) => {
    if (!textValue(record, field)) issues.push({ row, field, message: 'Campo obrigatório.' });
  };

  if (entity === DataImportEntity.buildings) required('name');

  if (entity === DataImportEntity.units) {
    required('building');
    required('number');
    if (!Object.values(UnitType).includes(record.type as UnitType)) issues.push({ row, field: 'type', message: 'Use apartment, house ou penthouse.' });
    if (!Object.values(UnitStatus).includes(record.status as UnitStatus)) issues.push({ row, field: 'status', message: 'Use occupied, vacant ou maintenance.' });
    const share = Number(record.fractionalShare);
    if (!Number.isFinite(share) || share <= 0) issues.push({ row, field: 'fractionalShare', message: 'Informe um número maior que zero.' });
  }

  if (entity === DataImportEntity.equipment) {
    ['name', 'location', 'category'].forEach(required);
    if (!Object.values(EquipmentStatus).includes(record.status as EquipmentStatus)) issues.push({ row, field: 'status', message: 'Status de equipamento inválido.' });
    ['lastInspection', 'nextInspection', 'installDate'].forEach((field) => {
      if (!dateValue(record[field])) issues.push({ row, field, message: 'Informe uma data válida (AAAA-MM-DD).' });
    });
  }

  if (entity === DataImportEntity.residents) {
    ['building', 'unitNumber', 'name', 'email', 'phone'].forEach(required);
    if (!z.string().email().safeParse(record.email).success) issues.push({ row, field: 'email', message: 'E-mail inválido.' });
    if (!Object.values(RelationshipRole).includes(record.role as RelationshipRole)) issues.push({ row, field: 'role', message: 'Vínculo inválido.' });
  }

  if (entity === DataImportEntity.documents) {
    ['title', 'category', 'filePath'].forEach(required);
    if (record.requiredRole && !Object.values(PlatformRole).includes(record.requiredRole as PlatformRole)) {
      issues.push({ row, field: 'requiredRole', message: 'Perfil de acesso inválido.' });
    }
    const filePath = textValue(record, 'filePath');
    if (path.isAbsolute(filePath) || filePath.split(/[\\/]+/).includes('..')) {
      issues.push({ row, field: 'filePath', message: 'Use um caminho relativo, sem segmentos "..".' });
    }
    if ((record.building && !record.unitNumber) || (!record.building && record.unitNumber)) {
      issues.push({ row, field: 'unitNumber', message: 'Edifício e unidade devem ser informados juntos.' });
    }
  }

  return issues;
}

async function resolveUnit(db: DbClient, condoId: string, buildingName: string, unitNumber: string) {
  return db.unit.findFirst({
    where: { number: unitNumber, building: { condominiumId: condoId, name: buildingName } },
  });
}

async function validateReferences(condoId: string, entity: DataImportEntity, records: ImportRecord[]) {
  const entitiesWithReferences = new Set<DataImportEntity>([DataImportEntity.units, DataImportEntity.residents, DataImportEntity.documents]);
  if (!entitiesWithReferences.has(entity)) return [];
  const buildings = await prisma.building.findMany({
    where: { condominiumId: condoId },
    include: { units: { select: { number: true } } },
  });
  const buildingMap = new Map(buildings.map((building) => [building.name, new Set(building.units.map((unit) => unit.number))]));
  const issues: ValidationIssue[] = [];
  records.forEach((record, index) => {
    const row = index + 2;
    const buildingName = textValue(record, 'building');
    if (!buildingName) return;
    const units = buildingMap.get(buildingName);
    if (!units) {
      issues.push({ row, field: 'building', message: `Edifício não encontrado no condomínio: ${buildingName}.` });
      return;
    }
    if (entity !== DataImportEntity.units) {
      const unitNumber = textValue(record, 'unitNumber');
      if (unitNumber && !units.has(unitNumber)) issues.push({ row, field: 'unitNumber', message: `Unidade não encontrada no edifício ${buildingName}.` });
    }
  });
  return issues;
}

async function applyRecord(db: DbClient, condoId: string, entity: DataImportEntity, record: ImportRecord, uploadedBy: string) {
  if (entity === DataImportEntity.buildings) {
    const name = textValue(record, 'name');
    const existing = await db.building.findFirst({ where: { condominiumId: condoId, name } });
    return existing || db.building.create({ data: { condominiumId: condoId, name } });
  }

  if (entity === DataImportEntity.units) {
    const buildingName = textValue(record, 'building');
    const building = await db.building.findFirst({ where: { condominiumId: condoId, name: buildingName } });
    if (!building) throw new Error(`Edifício não encontrado: ${buildingName}`);
    const number = textValue(record, 'number');
    const existing = await db.unit.findFirst({ where: { buildingId: building.id, number } });
    const data = {
      type: record.type as UnitType,
      status: record.status as UnitStatus,
      fractionalShare: Number(record.fractionalShare),
    };
    return existing
      ? db.unit.update({ where: { id: existing.id }, data })
      : db.unit.create({ data: { ...data, number, buildingId: building.id } });
  }

  if (entity === DataImportEntity.equipment) {
    const name = textValue(record, 'name');
    const location = textValue(record, 'location');
    const existing = await db.equipment.findFirst({ where: { condominiumId: condoId, name, location } });
    const data = {
      category: textValue(record, 'category'),
      status: record.status as EquipmentStatus,
      lastInspection: dateValue(record.lastInspection)!,
      nextInspection: dateValue(record.nextInspection)!,
      installDate: dateValue(record.installDate)!,
    };
    return existing
      ? db.equipment.update({ where: { id: existing.id }, data })
      : db.equipment.create({ data: { ...data, condominiumId: condoId, name, location } });
  }

  if (entity === DataImportEntity.residents) {
    const unit = await resolveUnit(db, condoId, textValue(record, 'building'), textValue(record, 'unitNumber'));
    if (!unit) throw new Error('Unidade não encontrada para o morador.');
    const email = textValue(record, 'email').toLowerCase();
    const person = await db.person.upsert({
      where: { email },
      update: { name: textValue(record, 'name'), phone: textValue(record, 'phone') },
      create: { email, name: textValue(record, 'name'), phone: textValue(record, 'phone') },
    });
    const role = record.role as RelationshipRole;
    const existing = await db.unitRelationship.findFirst({ where: { unitId: unit.id, personId: person.id, role, endDate: null } });
    return existing || db.unitRelationship.create({ data: { unitId: unit.id, personId: person.id, role } });
  }

  const building = textValue(record, 'building');
  const unitNumber = textValue(record, 'unitNumber');
  const unit = building && unitNumber ? await resolveUnit(db, condoId, building, unitNumber) : null;
  if (building && unitNumber && !unit) throw new Error('Unidade vinculada ao documento não encontrada.');
  const title = textValue(record, 'title');
  const filePath = textValue(record, 'filePath');
  const existing = await db.document.findFirst({ where: { condominiumId: condoId, title, filePath } });
  if (existing) return existing;
  return db.document.create({
    data: {
      condominiumId: condoId,
      unitId: unit?.id,
      title,
      category: textValue(record, 'category'),
      requiredRole: (record.requiredRole as PlatformRole) || PlatformRole.resident,
      filePath,
      versions: { create: { versionNumber: 1, filePath, uploadedBy } },
    },
  });
}

router.get('/:condoId/imports', requireAuth, tenantGuard, requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]), async (req, res) => {
  const jobs = await prisma.dataImportJob.findMany({
    where: { condominiumId: req.params.condoId },
    select: { id: true, source: true, entity: true, fileName: true, status: true, totalRows: true, validRows: true, invalidRows: true, result: true, createdByEmail: true, createdAt: true, completedAt: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json(jobs);
});

export function recordReference(entity: DataImportEntity, record: ImportRecord) {
  const candidates: Partial<Record<DataImportEntity, string[]>> = {
    [DataImportEntity.buildings]: ['name'],
    [DataImportEntity.units]: ['building', 'number'],
    [DataImportEntity.equipment]: ['name', 'location'],
    [DataImportEntity.residents]: ['email', 'building', 'unitNumber'],
    [DataImportEntity.documents]: ['title', 'filePath'],
  };
  const values = (candidates[entity] || [])
    .map((field) => textValue(record, field))
    .filter(Boolean);
  return values.length ? values.join(' / ').slice(0, 240) : 'sem referência';
}

router.post('/:condoId/imports/validate', requireAuth, tenantGuard, requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]), validateBody(createImportSchema), async (req: any, res) => {
  const { source, entity, fileName, records } = req.body;
  const structuralIssues = records.flatMap((record: ImportRecord, index: number) => validateRecord(entity, record, index + 2));
  const referenceIssues = await validateReferences(req.params.condoId, entity, records);
  const issues = [...structuralIssues, ...referenceIssues];
  const invalidRows = new Set(issues.map((issue: ValidationIssue) => issue.row)).size;
  const job = await prisma.dataImportJob.create({
    data: {
      condominiumId: req.params.condoId,
      source,
      entity,
      fileName,
      status: issues.length ? DataImportStatus.draft : DataImportStatus.validated,
      createdByEmail: req.user.email,
      totalRows: records.length,
      validRows: records.length - invalidRows,
      invalidRows,
      payload: records,
      validationReport: { issues: issues.slice(0, 200), truncated: issues.length > 200 },
    },
  });
  res.status(201).json({ id: job.id, status: job.status, totalRows: records.length, validRows: records.length - invalidRows, invalidRows, issues: issues.slice(0, 200) });
});

router.post('/:condoId/imports/:importId/apply', requireAuth, tenantGuard, requireRole([PlatformRole.admin, PlatformRole.syndic, PlatformRole.manager]), async (req: any, res) => {
  await prisma.dataImportJob.updateMany({
    where: {
      id: req.params.importId,
      condominiumId: req.params.condoId,
      status: DataImportStatus.processing,
      updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
    },
    data: {
      status: DataImportStatus.failed,
      result: { error: 'Processamento anterior interrompido antes da confirmação transacional.', recoverable: true },
    },
  });
  const job = await prisma.dataImportJob.findFirst({ where: { id: req.params.importId, condominiumId: req.params.condoId } });
  if (!job) return res.status(404).json({ error: 'Lote de importação não encontrado.' });
  if (job.status !== DataImportStatus.validated) return res.status(409).json({ error: 'O lote precisa estar validado e sem erros antes da aplicação.' });

  let failedRow: number | null = null;
  let failedReference: string | null = null;
  try {
    const records = job.payload as ImportRecord[];
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(409).json({ error: 'O lote não possui payload disponível para aplicação.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.dataImportJob.updateMany({
        where: { id: job.id, condominiumId: req.params.condoId, status: DataImportStatus.validated },
        data: { status: DataImportStatus.processing },
      });
      if (claim.count !== 1) throw new Error('IMPORT_ALREADY_CLAIMED');

      for (let index = 0; index < records.length; index += 1) {
        failedRow = index + 2;
        failedReference = recordReference(job.entity, records[index]);
        await applyRecord(tx, req.params.condoId, job.entity, records[index], req.user.email);
      }

      const completedResult = { processed: records.length, skipped: 0 };
      await tx.dataImportJob.update({
        where: { id: job.id },
        data: {
          status: DataImportStatus.completed,
          result: completedResult,
          completedAt: new Date(),
          payload: [],
          validationReport: { valid: true, issueCount: 0, payloadRemovedAfterSuccess: true },
        },
      });
      const condo = await tx.condominium.findUnique({ where: { id: req.params.condoId }, select: { accountId: true } });
      if (condo) {
        await tx.auditEvent.create({
          data: {
            accountId: condo.accountId,
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'create',
            entity: 'DataImportJob',
            entityId: job.id,
            details: `Importação concluída: ${job.entity}, ${records.length} registros.`,
            ipAddress: req.ip,
          },
        });
      }
      return completedResult;
    }, { timeout: 60_000 });

    res.json({ id: job.id, status: DataImportStatus.completed, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    if (message === 'IMPORT_ALREADY_CLAIMED') {
      return res.status(409).json({ error: 'Este lote já está sendo processado ou foi aplicado.', importId: job.id });
    }
    const failure = { error: message.slice(0, 1000), row: failedRow, reference: failedReference };
    await prisma.dataImportJob.updateMany({
      where: { id: job.id, condominiumId: req.params.condoId, status: DataImportStatus.validated },
      data: { status: DataImportStatus.failed, result: failure },
    });
    res.status(422).json({ error: `Importação interrompida na linha ${failedRow ?? 'desconhecida'} (${failedReference ?? 'sem referência'}): ${message}`, importId: job.id, failure });
  }
});

export default router;
