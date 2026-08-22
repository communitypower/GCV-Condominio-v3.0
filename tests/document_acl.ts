import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient, RelationshipRole, UnitStatus, UnitType } from '@prisma/client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const APP_ORIGIN = new URL(BASE_URL).origin;
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

async function downloadDocument(condoId: string, documentId: string, cookie: string) {
  const linkResponse = await fetch(`${BASE_URL}/condominiums/${condoId}/documents/${documentId}/download-url`, {
    headers: { Cookie: cookie },
  });
  const linkBody = await linkResponse.text();
  assert.strictEqual(linkResponse.status, 200, `Temporary download link failed: ${linkBody}`);
  const { url } = JSON.parse(linkBody) as { url: string };
  return fetch(`${APP_ORIGIN}${url}`, { headers: { Cookie: cookie } });
}

async function waitForCleanDocument(documentId: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    const version = document?.versions[0];
    if (version?.scanStatus === 'clean' && ['indexed', 'partial'].includes(version.processingStatus)) return;
    if (['failed', 'cancelled'].includes(version?.processingStatus || '')) {
      assert.fail(`Document processing failed: ${version?.processingError || version?.processingStatus}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail('Document did not leave quarantine before the ACL assertion');
}

async function runTests() {
  console.log("Running Document ACL Verification tests...");
  let publicDocId: string | null = null;
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

    const legacyPublicDoc = documents.find(d => d.unitId === null);
    assert.ok(legacyPublicDoc, "Should have a legacy public document");
    const publicStoredDocument = await prisma.document.findUnique({ where: { id: legacyPublicDoc.id }, include: { versions: true } });
    assert.ok(publicStoredDocument, 'Seeded public document should exist');
    const publicLatestVersion = [...publicStoredDocument.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
    assert.ok(publicLatestVersion, 'Seeded public document should have a version');
    await prisma.documentVersion.update({
      where: { id: publicLatestVersion.id },
      data: { scanStatus: 'clean', processingStatus: 'indexed' },
    });
    ensureTestDocumentFile(latestDocumentPath(publicStoredDocument), createdFiles);

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
    assert.strictEqual(invalidDocumentRes.status, 410, "Legacy path registration must be disabled");
    console.log("✔ Legacy path registration rejected successfully (410)");

    const publicUpload = new FormData();
    publicUpload.append('files', new Blob(['GCV public ACL fixture'], { type: 'text/plain' }), `public-${Date.now()}.txt`);
    publicUpload.append('category', 'regulation');
    publicUpload.append('requiredRole', 'resident');
    const createPublicRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents/upload`, {
      method: 'POST',
      headers: { Cookie: syndicCookie },
      body: publicUpload,
    });
    const publicUploadBody = (await createPublicRes.json()) as any;
    const publicDoc = publicUploadBody.uploads?.[0];
    assert.ok(publicDoc?.id, `Should have created public document successfully: ${JSON.stringify(publicUploadBody)}`);
    publicDocId = publicDoc.id;
    await waitForCleanDocument(publicDoc.id);

    console.log(`Creating private document for temporary Carlos unit (${tempUnit.id})...`);
    const privateUpload = new FormData();
    privateUpload.append('files', new Blob(['GCV private ACL fixture'], { type: 'text/plain' }), `private-a101-${Date.now()}.txt`);
    privateUpload.append('category', 'billing');
    privateUpload.append('requiredRole', 'resident');
    privateUpload.append('unitId', tempUnit.id);
    const createPrivateRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents/upload`, {
      method: 'POST',
      headers: { Cookie: syndicCookie },
      body: privateUpload,
    });
    const privateUploadBody = (await createPrivateRes.json()) as any;
    const privateDoc = privateUploadBody.uploads?.[0];
    assert.ok(privateDoc.id, `Should have created private document successfully: ${JSON.stringify(privateDoc)}`);
    privateDocId = privateDoc.id;
    await waitForCleanDocument(privateDoc.id);

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

    const legacyDownload = await downloadDocument(condoId, legacyPublicDoc.id, syndicCookie);
    assert.strictEqual(legacyDownload.status, 410, 'Legacy non-tenant storage keys must remain unavailable');

    // 4. Test access permissions
    // Carlos (A-101) downloads public document -> should succeed (200)
    console.log("Testing: Resident Carlos downloading public document...");
    const downloadPublicRes = await downloadDocument(condoId, publicDoc.id, carlosCookie);
    assert.strictEqual(downloadPublicRes.status, 200, "Carlos should be allowed to download public documents");
    console.log("✔ Resident successfully accessed public document");

    // Carlos (A-101) downloads private document scoped to A-101 -> should succeed (200)
    console.log("Testing: Resident Carlos downloading private document scoped to A-101...");
    const downloadPrivateCarlosRes = await downloadDocument(condoId, privateDoc.id, carlosCookie);
    assert.strictEqual(downloadPrivateCarlosRes.status, 200, "Carlos should be allowed to download documents scoped to unit A-101");
    console.log("✔ Resident successfully accessed their unit-scoped document");

    // Mariana (A-102) downloads private document scoped to A-101 -> should fail (403)
    console.log("Testing: Resident Mariana trying to download private document scoped to A-101...");
    const downloadPrivateMarianaRes = await fetch(`${BASE_URL}/condominiums/${condoId}/documents/${privateDoc.id}/download-url`, {
      headers: { Cookie: marianaCookie }
    });
    assert.strictEqual(downloadPrivateMarianaRes.status, 403, "Mariana should be blocked from downloading document scoped to another unit");
    console.log("✔ Cross-unit document access blocked successfully (403)");

    // Syndic downloads private document scoped to A-101 -> should succeed (200)
    console.log("Testing: Syndic downloading private document scoped to A-101...");
    const downloadPrivateSyndicRes = await downloadDocument(condoId, privateDoc.id, syndicCookie);
    assert.strictEqual(downloadPrivateSyndicRes.status, 200, "Syndic should bypass unit-scopes for all documents");
    console.log("✔ Syndic successfully bypassed unit-scoped document restrictions");

    console.log("All Document ACL tests completed with SUCCESS.");
  } finally {
    await prisma.auditEvent.deleteMany({
      where: { details: 'Login mock realizado em ambiente local/teste.' },
    });

    for (const documentId of [publicDocId, privateDocId].filter((id): id is string => Boolean(id))) {
      await prisma.auditEvent.deleteMany({ where: { entity: 'Document', entityId: documentId } });
      const versions = await prisma.documentVersion.findMany({ where: { documentId }, select: { id: true, filePath: true } });
      await prisma.auditEvent.deleteMany({ where: { entity: 'DocumentVersion', entityId: { in: versions.map((version) => version.id) } } });
      await prisma.aiProposal.deleteMany({ where: { sourceVersion: { documentId } } });
      await prisma.documentChunk.deleteMany({ where: { version: { documentId } } });
      await prisma.documentVersion.deleteMany({ where: { documentId } });
      await prisma.document.deleteMany({ where: { id: documentId } });
      for (const version of versions) {
        const absolutePath = path.resolve(documentStorageRoot, version.filePath);
        if (absolutePath.startsWith(`${documentStorageRoot}${path.sep}`) && fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
      }
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
