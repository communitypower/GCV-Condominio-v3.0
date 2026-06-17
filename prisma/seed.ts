import { PrismaClient, UnitType, UnitStatus, RelationshipRole, PlatformRole, EquipmentStatus, PlanFrequency, PlanStatus, MaintenanceCategory, MaintenancePriority, MaintenanceStatus, BillingStatus, AuditAction } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("Database already seeded. Skipping cleaning and seeding.");
    return;
  }

  console.log("Seeding started...");

  // Clean database
  await prisma.auditEvent.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.chargeLineItem.deleteMany();
  await prisma.charge.deleteMany();
  await prisma.billingPeriod.deleteMany();
  await prisma.maintenancePlan.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticketStatusHistory.deleteMany();
  await prisma.maintenanceTicket.deleteMany();
  await prisma.unitRelationship.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.building.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.condominium.deleteMany();
  await prisma.user.deleteMany();
  await prisma.person.deleteMany();
  await prisma.account.deleteMany();

  // 1. Create Default Account
  const account = await prisma.account.create({
    data: {
      name: "GCV Administradora LTDA",
    },
  });
  console.log(`Created Account: ${account.name}`);

  // 2. Create Condominium
  const condo = await prisma.condominium.create({
    data: {
      name: "Condomínio Bella Vista Premium",
      address: "Av. Paulista, 1000 - São Paulo, SP",
      accountId: account.id,
    },
  });
  console.log(`Created Condominium: ${condo.name}`);

  // 3. Create Buildings
  const blockA = await prisma.building.create({
    data: { name: "Bloco A", condominiumId: condo.id },
  });
  const blockB = await prisma.building.create({
    data: { name: "Bloco B", condominiumId: condo.id },
  });
  const casas = await prisma.building.create({
    data: { name: "Casas", condominiumId: condo.id },
  });

  const buildingMap: Record<string, string> = {
    "Bloco A": blockA.id,
    "Bloco B": blockB.id,
    "Casas": casas.id,
  };

  // 4. Create Mock Syndic
  const syndicPerson = await prisma.person.create({
    data: {
      name: "Cassiano Marins",
      email: "sindico@gcv.com.br",
      phone: "(11) 99999-9999",
    },
  });

  const syndicUser = await prisma.user.create({
    data: {
      email: syndicPerson.email,
      passwordHash: bcrypt.hashSync("sindico123", 10),
      personId: syndicPerson.id,
    },
  });

  await prisma.membership.create({
    data: {
      userId: syndicUser.id,
      accountId: account.id,
      condominiumId: condo.id,
      role: PlatformRole.syndic,
    },
  });

  // Create Mock Staff / Zelador
  const staffPerson = await prisma.person.create({
    data: {
      name: "Geraldo Nascimento",
      email: "zelador@gcv.com.br",
      phone: "(11) 98888-8888",
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      email: staffPerson.email,
      passwordHash: bcrypt.hashSync("zelador123", 10),
      personId: staffPerson.id,
    },
  });

  await prisma.membership.create({
    data: {
      userId: staffUser.id,
      accountId: account.id,
      condominiumId: condo.id,
      role: PlatformRole.manager,
    },
  });

  // 5. Create Units, Persons, and Relationships
  const initialUnits = [
    { block: 'Bloco A', number: '101', ownerName: 'Carlos Eduardo Ramos', ownerEmail: 'carlos.ramos@email.com', ownerPhone: '(11) 98765-4321', type: UnitType.apartment, status: UnitStatus.occupied, fractionalShare: 0.008 },
    { block: 'Bloco A', number: '102', ownerName: 'Mariana Costa Albuquerque', ownerEmail: 'mariana.costa@email.com', ownerPhone: '(11) 97654-3210', type: UnitType.apartment, status: UnitStatus.occupied, fractionalShare: 0.008 },
    { block: 'Bloco A', number: '201', ownerName: 'Rodrigo Azevedo Neves', ownerEmail: 'rodrigo.neves@email.com', ownerPhone: '(11) 96543-2109', type: UnitType.apartment, status: UnitStatus.occupied, fractionalShare: 0.008 },
    { block: 'Bloco A', number: '202', ownerName: 'Simone Ribeiro Prado', ownerEmail: 'simone.prado@email.com', ownerPhone: '(11) 95432-1098', type: UnitType.apartment, status: UnitStatus.vacant, fractionalShare: 0.008 },
    { block: 'Bloco A', number: '301', ownerName: 'Thiago Mendes Ferreira', ownerEmail: 'thiago.ferreira@email.com', ownerPhone: '(11) 94321-0987', type: UnitType.penthouse, status: UnitStatus.occupied, fractionalShare: 0.016 },
    { block: 'Bloco A', number: '302', ownerName: 'Beatriz Santos Oliveira', ownerEmail: 'beatriz.oliveira@email.com', ownerPhone: '(11) 93210-9876', type: UnitType.penthouse, status: UnitStatus.maintenance, fractionalShare: 0.016 },
    { block: 'Bloco B', number: '101', ownerName: 'Marcelo Dias Vieira', ownerEmail: 'marcelo.vieira@email.com', ownerPhone: '(11) 92109-8765', type: UnitType.apartment, status: UnitStatus.occupied, fractionalShare: 0.008 },
    { block: 'Bloco B', number: '102', ownerName: 'Fernanda Lima de Souza', ownerEmail: 'fernanda.souza@email.com', ownerPhone: '(11) 91098-7654', type: UnitType.apartment, status: UnitStatus.occupied, fractionalShare: 0.008 },
    { block: 'Bloco B', number: '201', ownerName: 'Patrícia Gomes Peixoto', ownerEmail: 'patricia.gomes@email.com', ownerPhone: '(11) 90987-6543', type: UnitType.apartment, status: UnitStatus.occupied, fractionalShare: 0.008 },
    { block: 'Bloco B', number: '202', ownerName: 'Ricardo Tavares Cruz', ownerEmail: 'ricardo.cruz@email.com', ownerPhone: '(11) 89876-5432', type: UnitType.apartment, status: UnitStatus.vacant, fractionalShare: 0.008 },
    { block: 'Bloco B', number: '301', ownerName: 'Gabriel de Alencar', ownerEmail: 'gabriel.alencar@email.com', ownerPhone: '(11) 88765-4321', type: UnitType.penthouse, status: UnitStatus.occupied, fractionalShare: 0.016 },
    { block: 'Casas', number: 'Casa 01', ownerName: 'André de Souza Arantes', ownerEmail: 'andre.arantes@email.com', ownerPhone: '(11) 87654-3210', type: UnitType.house, status: UnitStatus.occupied, fractionalShare: 0.024 },
    { block: 'Casas', number: 'Casa 02', ownerName: 'Juliana Vasconcelos', ownerEmail: 'juliana.vasc@email.com', ownerPhone: '(11) 86543-2109', type: UnitType.house, status: UnitStatus.occupied, fractionalShare: 0.024 },
    { block: 'Casas', number: 'Casa 03', ownerName: 'Luiz Felipe Nogueira', ownerEmail: 'luiz.nogueira@email.com', ownerPhone: '(11) 85432-1098', type: UnitType.house, status: UnitStatus.occupied, fractionalShare: 0.024 }
  ];

  const unitIdMap: Record<string, string> = {};

  for (const item of initialUnits) {
    const buildingId = buildingMap[item.block];
    if (!buildingId) continue;

    const unit = await prisma.unit.create({
      data: {
        number: item.number,
        type: item.type,
        status: item.status,
        fractionalShare: item.fractionalShare,
        buildingId: buildingId,
      },
    });

    unitIdMap[`${item.block}-${item.number}`] = unit.id;

    const person = await prisma.person.create({
      data: {
        name: item.ownerName,
        email: item.ownerEmail,
        phone: item.ownerPhone,
      },
    });

    const user = await prisma.user.create({
      data: {
        email: person.email,
        passwordHash: bcrypt.hashSync("resident123", 10),
        personId: person.id,
      },
    });

    await prisma.membership.create({
      data: {
        userId: user.id,
        accountId: account.id,
        condominiumId: condo.id,
        role: PlatformRole.resident,
      },
    });

    await prisma.unitRelationship.create({
      data: {
        unitId: unit.id,
        personId: person.id,
        role: RelationshipRole.owner,
      },
    });
  }

  // 6. Create Billing Periods
  const periodApril = await prisma.billingPeriod.create({
    data: { condominiumId: condo.id, monthString: "2026-04", closed: true }
  });
  const periodMay = await prisma.billingPeriod.create({
    data: { condominiumId: condo.id, monthString: "2026-05", closed: false }
  });

  // 7. Seed Charges (tracker data)
  const initialBillings = [
    { block: 'Bloco A', number: '101', period: periodApril, amount: 650.00, dueDate: '2026-04-10', status: BillingStatus.paid, paidAt: '2026-04-09' },
    { block: 'Bloco A', number: '102', period: periodApril, amount: 650.00, dueDate: '2026-04-10', status: BillingStatus.paid, paidAt: '2026-04-10' },
    { block: 'Bloco A', number: '301', period: periodApril, amount: 1450.00, dueDate: '2026-04-10', status: BillingStatus.paid, paidAt: '2026-04-08', extra: { desc: 'Fundo de Reserva', amt: 250.00 } },
    { block: 'Casas', number: 'Casa 01', period: periodApril, amount: 850.00, dueDate: '2026-04-10', status: BillingStatus.overdue, penalty: 17.00, interest: 8.50 },
    
    { block: 'Bloco A', number: '101', period: periodMay, amount: 650.00, dueDate: '2026-05-10', status: BillingStatus.paid, paidAt: '2026-05-10' },
    { block: 'Bloco A', number: '102', period: periodMay, amount: 650.00, dueDate: '2026-05-10', status: BillingStatus.pending },
    { block: 'Bloco A', number: '201', period: periodMay, amount: 650.00, dueDate: '2026-05-10', status: BillingStatus.paid, paidAt: '2026-05-08' },
    { block: 'Bloco A', number: '301', period: periodMay, amount: 1200.00, dueDate: '2026-05-10', status: BillingStatus.pending },
    { block: 'Bloco A', number: '302', period: periodMay, amount: 1200.00, dueDate: '2026-05-10', status: BillingStatus.pending },
    { block: 'Bloco B', number: '101', period: periodMay, amount: 650.00, dueDate: '2026-05-10', status: BillingStatus.paid, paidAt: '2026-05-09' },
    { block: 'Bloco B', number: '102', period: periodMay, amount: 650.00, dueDate: '2026-05-10', status: BillingStatus.pending },
    { block: 'Bloco B', number: '201', period: periodMay, amount: 650.00, dueDate: '2026-05-10', status: BillingStatus.paid, paidAt: '2026-05-10' },
    { block: 'Bloco B', number: '301', period: periodMay, amount: 1200.00, dueDate: '2026-05-10', status: BillingStatus.paid, paidAt: '2026-05-09' },
    { block: 'Casas', number: 'Casa 01', period: periodMay, amount: 850.00, dueDate: '2026-05-10', status: BillingStatus.pending },
    { block: 'Casas', number: 'Casa 02', period: periodMay, amount: 850.00, dueDate: '2026-05-10', status: BillingStatus.paid, paidAt: '2026-05-10' },
    { block: 'Casas', number: 'Casa 03', period: periodMay, amount: 850.00, dueDate: '2026-05-10', status: BillingStatus.pending }
  ];

  for (const b of initialBillings) {
    const unitId = unitIdMap[`${b.block}-${b.number}`];
    if (!unitId) continue;

    const charge = await prisma.charge.create({
      data: {
        unitId: unitId,
        billingPeriodId: b.period.id,
        amount: b.amount,
        dueDate: new Date(b.dueDate),
        status: b.status,
        paidAt: b.paidAt ? new Date(b.paidAt) : null,
        barcode: "34191.79001 01043.513184 91020.150008 7 97130000065000",
        pixQrCode: "00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br",
        description: `Taxa Condominial Ordinária - ${b.period.monthString}`,
        penaltyFee: b.penalty || null,
        interestFee: b.interest || null,
      }
    });

    // Create line items
    if (b.extra) {
      await prisma.chargeLineItem.create({
        data: { chargeId: charge.id, description: b.extra.desc, amount: b.extra.amt }
      });
    }
    await prisma.chargeLineItem.create({
      data: { chargeId: charge.id, description: "Taxa Ordinária", amount: b.amount - (b.extra?.amt || 0) }
    });
  }

  // 8. Seed Equipments
  const initialEquipments = [
    { name: 'Bomba Centrífuga Principal', location: 'Casa de Bombas - Subsolo', category: 'Hidráulica', status: EquipmentStatus.alert },
    { name: 'Quadro Elétrico Geral', location: 'Sala Elétrica - Térreo', category: 'Elétrica / Cabine', status: EquipmentStatus.critical },
    { name: 'Gerador Principal de Emergência (350kVA)', location: 'Subsolo 1 - Área Técnica', category: 'Alternadores', status: EquipmentStatus.maintenance },
    { name: 'Portão Eletrônico Guarita', location: 'Entrada Veículos Principal', category: 'Mecânica', status: EquipmentStatus.operational }
  ];

  const equipmentMap: Record<string, string> = {};

  for (const eq of initialEquipments) {
    const e = await prisma.equipment.create({
      data: {
        condominiumId: condo.id,
        name: eq.name,
        location: eq.location,
        category: eq.category,
        status: eq.status,
        lastInspection: new Date('2026-05-10'),
        nextInspection: new Date('2026-06-10'),
        installDate: new Date('2020-05-15'),
      }
    });
    equipmentMap[eq.name] = e.id;
  }

  // 9. Seed Maintenance Plans
  const initialPlans = [
    { title: 'Manutenção Preditiva Termográfica Quadros Elétricos', description: 'Termometria infravermelha nos contatos.', eqName: 'Quadro Elétrico Geral', freq: PlanFrequency.semestral },
    { title: 'Limpeza Semestral de Reservatórios d\'Água', description: 'Lavação sob pressão.', freq: PlanFrequency.semestral }
  ];

  for (const pl of initialPlans) {
    const eqId = pl.eqName ? equipmentMap[pl.eqName] : null;
    await prisma.maintenancePlan.create({
      data: {
        condominiumId: condo.id,
        equipmentId: eqId,
        title: pl.title,
        description: pl.description,
        frequency: pl.freq,
        nextOccurrence: new Date('2026-08-10'),
        status: PlanStatus.active,
      }
    });
  }

  // 10. Seed Maintenance Tickets
  const initialTickets = [
    { title: 'Limpeza da caixa d\'água', desc: 'Higienização semestral obrigatória.', cat: MaintenanceCategory.plumbing, pri: MaintenancePriority.medium, stat: MaintenanceStatus.reported, cost: 800.00 },
    { title: 'Infiltração na Suíte Principal', desc: 'Vazamento vindo do teto.', cat: MaintenanceCategory.plumbing, pri: MaintenancePriority.high, stat: MaintenanceStatus.in_progress, cost: 1200.00, block: 'Bloco A', num: '302' },
    { title: 'Troca da Bomba Principal da Piscina', desc: 'A bomba do filtro leste parou de funcionar.', cat: MaintenanceCategory.common_area, pri: MaintenancePriority.urgent, stat: MaintenanceStatus.reported, cost: 2850.00 }
  ];

  for (const tk of initialTickets) {
    const targetUnitId = tk.block && tk.num ? unitIdMap[`${tk.block}-${tk.num}`] : null;

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        condominiumId: condo.id,
        unitId: targetUnitId,
        title: tk.title,
        description: tk.desc,
        category: tk.cat,
        priority: tk.pri,
        status: tk.stat,
        estimatedCost: tk.cost,
        reportedAt: new Date(),
      }
    });

    // Seed ticket comment
    await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorName: "Sistema GCV",
        comment: "Chamado registrado no banco de dados.",
      }
    });
  }

  // 11. Seed Documents
  const regDoc = await prisma.document.create({
    data: {
      condominiumId: condo.id,
      title: "Regulamento Interno GCV",
      category: "regulation",
      requiredRole: PlatformRole.resident,
      filePath: "uploads/regulamento.pdf"
    }
  });
  await prisma.documentVersion.create({
    data: {
      documentId: regDoc.id,
      versionNumber: 1,
      filePath: "uploads/regulamento.pdf",
      uploadedBy: "sindico@gcv.com.br"
    }
  });

  const ataDoc = await prisma.document.create({
    data: {
      condominiumId: condo.id,
      title: "Ata da Assembleia Trimestral - Maio 2026",
      category: "minutes",
      requiredRole: PlatformRole.resident,
      filePath: "uploads/ata_maio.pdf"
    }
  });
  await prisma.documentVersion.create({
    data: {
      documentId: ataDoc.id,
      versionNumber: 1,
      filePath: "uploads/ata_maio.pdf",
      uploadedBy: "sindico@gcv.com.br"
    }
  });

  // 12. Seed Audit Events
  await prisma.auditEvent.create({
    data: {
      accountId: account.id,
      userId: syndicUser.id,
      userEmail: syndicUser.email,
      action: AuditAction.auth_login,
      entity: "User",
      entityId: syndicUser.id,
      details: "Síndico realizou o bootstrap do sistema."
    }
  });

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
