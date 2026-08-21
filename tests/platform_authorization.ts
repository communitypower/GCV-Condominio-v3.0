import assert from 'assert';
import { PlatformRole } from '@prisma/client';
import { requireRole, requireSystemAdmin } from '../server/middleware/auth';
import {
  hasPlatformAdminAccess,
  isApprovedPlatformAdminEmail,
  PLATFORM_ADMIN_EMAILS,
} from '../server/services/system-admin';

function mockResponse() {
  const state = { statusCode: 200, payload: undefined as unknown };
  return {
    state,
    response: {
      status(code: number) {
        state.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        state.payload = payload;
        return this;
      },
    } as any,
  };
}

assert.deepStrictEqual([...PLATFORM_ADMIN_EMAILS], [
  'cassianomarins@gmail.com',
  'vitorlcastro92@gmail.com',
]);
assert.strictEqual(isApprovedPlatformAdminEmail(' CASSIANOMARINS@GMAIL.COM '), true);
assert.strictEqual(isApprovedPlatformAdminEmail('vitorlcastro92@gmail.com'), true);
assert.strictEqual(isApprovedPlatformAdminEmail('sindico@gcv.com.br'), false);
assert.strictEqual(hasPlatformAdminAccess({ email: 'cassianomarins@gmail.com', isSystemAdmin: true }), true);
assert.strictEqual(hasPlatformAdminAccess({ email: 'cassianomarins@gmail.com', isSystemAdmin: false }), false);
assert.strictEqual(hasPlatformAdminAccess({ email: 'attacker@example.com', isSystemAdmin: true }), false);

const approvedRequest: any = { user: { isSystemAdmin: true } };
let approved = false;
requireSystemAdmin(approvedRequest, mockResponse().response, () => { approved = true; });
assert.strictEqual(approved, true);

const rejectedAdmin = mockResponse();
requireSystemAdmin({ user: { isSystemAdmin: false } } as any, rejectedAdmin.response, () => {
  throw new Error('Unapproved user must not pass requireSystemAdmin');
});
assert.strictEqual(rejectedAdmin.state.statusCode, 403);

const legacyTenantAdmin = mockResponse();
requireRole([PlatformRole.syndic])({
  user: {
    memberships: [{ role: PlatformRole.admin }],
  },
} as any, legacyTenantAdmin.response, () => {
  throw new Error('Legacy tenant admin must not inherit syndic permissions');
});
assert.strictEqual(legacyTenantAdmin.state.statusCode, 403);

const syndicRequest: any = {
  user: { memberships: [{ role: PlatformRole.syndic }] },
};
let syndicAllowed = false;
requireRole([PlatformRole.syndic])(syndicRequest, mockResponse().response, () => {
  syndicAllowed = true;
});
assert.strictEqual(syndicAllowed, true);

console.log('Platform administrator and role authorization tests completed with SUCCESS.');
