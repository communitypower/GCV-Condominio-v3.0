import { purgeExpiredDocuments } from '../server/services/document-retention';

async function main() {
  const execute = process.argv.includes('--execute');
  const confirmation = process.env.DOCUMENT_PURGE_CONFIRM;
  if (execute && confirmation !== 'PURGE_EXPIRED_DOCUMENTS') {
    throw new Error('Set DOCUMENT_PURGE_CONFIRM=PURGE_EXPIRED_DOCUMENTS to execute physical purge.');
  }

  const result = await purgeExpiredDocuments({ execute });
  console.log(JSON.stringify({ mode: execute ? 'execute' : 'dry-run', ...result }, null, 2));
  if (result.failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
