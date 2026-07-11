import assert from 'node:assert/strict';
import { DataImportEntity } from '@prisma/client';
import { recordReference } from '../server/routes/imports';

function runTests() {
  assert.equal(
    recordReference(DataImportEntity.units, { building: 'Torre A', number: '101' }),
    'Torre A / 101',
  );
  assert.equal(
    recordReference(DataImportEntity.residents, {
      email: 'morador@example.com',
      building: 'Torre B',
      unitNumber: '202',
    }),
    'morador@example.com / Torre B / 202',
  );
  assert.equal(recordReference(DataImportEntity.documents, {}), 'sem referência');

  const oversized = recordReference(DataImportEntity.buildings, { name: 'x'.repeat(500) });
  assert.equal(oversized.length, 240, 'Failure references must be bounded before persistence');

  console.log('Import route safety tests completed with SUCCESS.');
}

runTests();
