import assert from 'node:assert/strict';
import { parseSession, serializeSession } from '../server/services/session';

const originalSecret = process.env.SESSION_SECRET;

try {
  process.env.SESSION_SECRET = 'session-security-test-secret';
  const identity = { id: '0b0b1673-c446-4ff6-8bef-9e0185f379ba', sessionVersion: 7 };
  const serialized = serializeSession(identity);
  const sessionParts = serialized.split('.');
  const encryptedPart = sessionParts[2];
  sessionParts[2] = `${encryptedPart[0] === 'A' ? 'B' : 'A'}${encryptedPart.slice(1)}`;
  const tamperedSession = sessionParts.join('.');

  assert.deepStrictEqual(parseSession(serialized), identity, 'Encrypted sessions must round-trip');
  assert.ok(!serialized.includes(identity.id), 'Session cookies must not expose the user identifier');
  assert.strictEqual(parseSession(tamperedSession), null, 'Modified ciphertext must be rejected');
  assert.strictEqual(parseSession(`${identity.id}.${identity.sessionVersion}`), null, 'Legacy clear-text sessions must be rejected');

  process.env.SESSION_SECRET = 'different-session-security-test-secret';
  assert.strictEqual(parseSession(serialized), null, 'Sessions encrypted with another secret must be rejected');

  console.log('Session confidentiality and integrity tests completed with SUCCESS.');
} finally {
  if (originalSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSecret;
}
