import assert from 'node:assert/strict';
import path from 'node:path';

process.env.DOCUMENT_STORAGE_PATH = path.resolve('uploads-test');

const { latestDocumentVersion, resolveStoredDocumentPath } = await import('../server/routes/documents');

assert.equal(latestDocumentVersion([]), null, 'Documents without versions must be handled explicitly');
assert.deepEqual(
  latestDocumentVersion([{ versionNumber: 1, id: 'v1' }, { versionNumber: 3, id: 'v3' }]),
  { versionNumber: 3, id: 'v3' },
);

assert.equal(
  resolveStoredDocumentPath('manuals/elevator.pdf'),
  path.resolve('uploads-test/manuals/elevator.pdf'),
);
assert.equal(
  resolveStoredDocumentPath('uploads/manuals/elevator.pdf'),
  path.resolve('uploads-test/manuals/elevator.pdf'),
  'Legacy uploads/ prefixes must resolve inside the configured storage root',
);
assert.equal(resolveStoredDocumentPath('../secret.pdf'), null, 'Traversal paths must be rejected');

console.log('Document route safety tests completed with SUCCESS.');
