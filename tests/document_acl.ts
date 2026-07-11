import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient, RelationshipRole, UnitStatus, UnitType } from '@prisma/client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();
const documentStorageRoot = path.resolve(process.env.DOCUMENT_STORAGE_PATH || 'uploads');

function latestDocumentPath(document: any) {
  const versions = Array.isArray(document.versions) ? document.versions : [];
  const latest = versions.sort((a: any, b: any) => b.versionNumber - a.versionNumber)[0];
  return latest?.filePath || document.filePath;
}

function ensureTestDocumentFile(filePath: string, createdFiles: string[]) {
  const relativePath = filePath.replace(/^uploads[\\/]/, '');
  const absolutePath = path.resolve(documentStorageRoot, relativePath);
  assert.ok(absolutePath.startsWith(`${documentStorageRoot}${path.sep}`), 'Document path must stay inside storage root');

  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, '%PDF-1.4\n% GCV document ACL test fixture\n');
    createdFiles.push(absolutePath);
  }
}

async function runTests() {
  console.log("Running Document ACL Verification tests...");
  let privateDocId: string | null = null;
  let tempRelationshipId: string | null = null;
  let tempUnitId: string | null = null;
  let tempBuildingId: string | null = null;
  const createdFiles: string[] = [];

  try {
    // 1. Login as Syndic to find document IDs and condo ID
    console.log("Logging in as syndic to collect metadata...");
    const syndicLoginRes = await fetch(`${BASE_URL}/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sindico@gcv.com.br' }),
    });
    const syndicCookie = syndicLoginRes.headers.get('set-cookie')!;

    // Fetch condos to get active condo ID
    const condosRes = await fetch(`${BASE_URL}/condominiums`, {
      headers: { Cookie: syndicCookie }
    });
    const condos = (await condosRes.json()) as any[];
    const condoId = condos[0].id;

    // Fetch documents to get the seeded document IDs
    const docsRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents`, {
      headers: { Cookie: syndicCookie }
    });
    const documents = (await docsRes.json()) as any[];
    assert.ok(documents.length >= 2, "Should have seeded at least two documents");

    const publicDoc = documents.find(d => d.unitId === null);
    assert.ok(publicDoc, "Should have a public document");
    ensureTestDocumentFile(latestDocumentPath(publicDoc), createdFiles);

    const carlosPerson = await prisma.person.findUnique({
      where: { email: 'carlos.ramos@email.com' },
    });
    assert.ok(carlosPerson, "Seeded people should contain Carlos");

    const tempBuilding = await prisma.building.create({
      data: {
        name: `Document ACL Test Building ${Date.now()}`,
        condominiumId: condoId,
      },
    });
    tempBuildingId = tempBuilding.id;

    const tempUnit = await prisma.unit.create({
      data: {
        number: `DOC-${Date.now()}`,
        type: UnitType.apartment,
        status: UnitStatus.occupied,
        fractionalShare: 0.001,
        buildingId: tempBuilding.id,
      },
    });
    tempUnitId = tempUnit.id;

    const tempRelationship = await prisma.unitRelationship.create({
      data: {
        unitId: tempUnit.id,
        personId: carlosPerson.id,
        role: RelationshipRole.tenant,
      },
    });
    tempRelationshipId = tempRelationship.id;

    console.log("Testing document validation...");
    const invalidDocumentRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: syndicCookie
      },
      body: JSON.stringify({
        title: "",
        category: "",
        requiredRole: "not_a_role",
        unitId: "not-a-uuid",
        filePath: ""
      })
    });
    assert.strictEqual(invalidDocumentRes.status, 400, "Should reject invalid document payload");
    console.log("✔ Invalid document payload rejected successfully (400)");

    console.log(`Creating private document for temporary Carlos unit (${tempUnit.id})...`);
    const createPrivateRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: syndicCookie
      },
      body: JSON.stringify({
        title: `Extrato Financeiro Restrito A-101 - Test ${Date.now()}`,
        category: "billing",
        requiredRole: "resident",
        unitId: tempUnit.id,
        filePath: "uploads/private_a101.pdf"
      })
    });
    const privateDoc = (await createPrivateRes.json()) as any;
    assert.ok(privateDoc.id, `Should have created private document successfully: ${JSON.stringify(privateDoc)}`);
    privateDocId = privateDoc.id;
    ensureTestDocumentFile(latestDocumentPath(privateDoc), createdFiles);

    // 2. Login as Resident of unit A-101 (carlos.ramos@email.com)
    console.log("Logging in as Resident Carlos (A-101)...");
    const carlosLoginRes = await fetch(`${BASE_URL}/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'carlos.ramos@email.com' }),
    });
    const carlosCookie = carlosLoginRes.headers.get('set-cookie')!;

    // 3. Login as Resident of unit A-102 (mariana.costa@email.com)
    console.log("Logging in as Resident Mariana (A-102)...");
    const marianaLoginRes = await fetch(`${BASE_URL}/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mariana.costa@email.com' }),
    });
    const marianaCookie = marianaLoginRes.headers.get('set-cookie')!;

    // 4. Test access permissions
    // Carlos (A-101) downloads public document -> should succeed (200)
    console.log("Testing: Resident Carlos downloading public document...");
    const downloadPublicRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents/${publicDoc.id}/download`, {
      headers: { Cookie: carlosCookie }
    });
    assert.strictEqual(downloadPublicRes.status, 200, "Carlos should be allowed to download public documents");
    console.log("✔ Resident successfully accessed public document");

    // Carlos (A-101) downloads private document scoped to A-101 -> should succeed (200)
    console.log("Testing: Resident Carlos downloading private document scoped to A-101...");
    const downloadPrivateCarlosRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents/${privateDoc.id}/download`, {
      headers: { Cookie: carlosCookie }
    });
    assert.strictEqual(downloadPrivateCarlosRes.status, 200, "Carlos should be allowed to download documents scoped to unit A-101");
    console.log("✔ Resident successfully accessed their unit-scoped document");

    // Mariana (A-102) downloads private document scoped to A-101 -> should fail (403)
    console.log("Testing: Resident Mariana trying to download private document scoped to A-101...");
    const downloadPrivateMarianaRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents/${privateDoc.id}/download`, {
      headers: { Cookie: marianaCookie }
    });
    assert.strictEqual(downloadPrivateMarianaRes.status, 403, "Mariana should be blocked from downloading document scoped to another unit");
    console.log("✔ Cross-unit document access blocked successfully (403)");

    // Syndic downloads private document scoped to A-101 -> should succeed (200)
    console.log("Testing: Syndic downloading private document scoped to A-101...");
    const downloadPrivateSyndicRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents/${privateDoc.id}/download`, {
      headers: { Cookie: syndicCookie }
    });
    assert.strictEqual(downloadPrivateSyndicRes.status, 200, "Syndic should bypass unit-scopes for all documents");
    console.log("✔ Syndic successfully bypassed unit-scoped document restrictions");

    console.log("All Document ACL tests completed with SUCCESS.");
  } finally {
    await prisma.auditEvent.deleteMany({
      where: { details: 'Login mock realizado em ambiente local/teste.' },
    });

    if (privateDocId) {
      await prisma.auditEvent.deleteMany({ where: { entity: 'Document', entityId: privateDocId } });
      await prisma.documentVersion.deleteMany({ where: { documentId: privateDocId } });
      await prisma.document.deleteMany({ where: { id: privateDocId } });
    }
    if (tempRelationshipId) {
      await prisma.unitRelationship.deleteMany({ where: { id: tempRelationshipId } });
    }
    if (tempUnitId) {
      await prisma.unit.deleteMany({ where: { id: tempUnitId } });
    }
    if (tempBuildingId) {
      await prisma.building.deleteMany({ where: { id: tempBuildingId } });
    }
    for (const file of createdFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
