import assert from 'assert';
import { createCsrfProtection } from '../server/middleware/csrf';

function runMiddleware(method: string, origin?: string, host = 'app.example.com') {
  return new Promise<{ statusCode?: number; body?: any; nextCalled: boolean }>((resolve) => {
    const req: any = {
      method,
      protocol: 'https',
      get(header: string) {
        const normalized = header.toLowerCase();
        if (normalized === 'origin') return origin;
        if (normalized === 'host') return host;
        return undefined;
      },
    };

    const result = { statusCode: undefined as number | undefined, body: undefined as any, nextCalled: false };
    const res: any = {
      status(code: number) {
        result.statusCode = code;
        return this;
      },
      json(body: any) {
        result.body = body;
        resolve(result);
      },
    };

    const middleware = createCsrfProtection({
      enabled: true,
      appUrl: 'https://app.example.com',
    });

    middleware(req, res, () => {
      result.nextCalled = true;
      resolve(result);
    });
  });
}

async function runTests() {
  console.log('Running CSRF origin guard tests...');

  const safeGet = await runMiddleware('GET');
  assert.strictEqual(safeGet.nextCalled, true, 'Safe GET requests should bypass CSRF guard');

  const sameOriginPost = await runMiddleware('POST', 'https://app.example.com');
  assert.strictEqual(sameOriginPost.nextCalled, true, 'Same-origin POST should pass');

  const sameHostPost = await runMiddleware('PATCH', 'https://tenant.example.com', 'tenant.example.com');
  assert.strictEqual(sameHostPost.nextCalled, true, 'Current host origin should pass');

  const missingOriginPost = await runMiddleware('POST');
  assert.strictEqual(missingOriginPost.statusCode, 403, 'Missing Origin on unsafe method should be blocked');

  const crossOriginDelete = await runMiddleware('DELETE', 'https://evil.example.net');
  assert.strictEqual(crossOriginDelete.statusCode, 403, 'Cross-origin unsafe method should be blocked');

  console.log('All CSRF origin guard tests completed with SUCCESS.');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
