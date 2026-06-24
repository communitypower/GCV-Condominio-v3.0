import assert from 'assert';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const API_ORIGIN = BASE_URL.replace(/\/api\/v1\/?$/, '');

async function runTests() {
  console.log('Running observability endpoint tests...');

  const metricsRes = await fetch(`${API_ORIGIN}/metrics`);
  assert.strictEqual(metricsRes.status, 200, 'Metrics endpoint should return 200');
  assert.ok(metricsRes.headers.get('content-type')?.includes('text/plain'), 'Metrics endpoint should return text/plain');

  const body = await metricsRes.text();
  assert.ok(body.includes('gcv_process_uptime_seconds'), 'Metrics should include process uptime');
  assert.ok(body.includes('gcv_http_requests_total'), 'Metrics should include HTTP request counters');
  assert.ok(body.includes('gcv_http_request_duration_ms_sum'), 'Metrics should include duration sum');

  console.log('All observability endpoint tests completed with SUCCESS.');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
