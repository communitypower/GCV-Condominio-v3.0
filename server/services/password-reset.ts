import { createHash, randomBytes } from 'node:crypto';

const TOKEN_TTL_MINUTES = 30;

export function hashPasswordResetToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createPasswordResetToken() {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
  };
}

export function buildPasswordResetUrl(token: string) {
  const appUrl = new URL(process.env.APP_URL || 'http://localhost:3000');
  if (!['http:', 'https:'].includes(appUrl.protocol)
    || appUrl.username || appUrl.password || appUrl.search || appUrl.hash || appUrl.pathname !== '/'
    || ((process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') && appUrl.protocol !== 'https:')) {
    throw new Error('APP_URL inválida para recuperação de senha.');
  }
  appUrl.pathname = '/reset-password';
  appUrl.search = `token=${encodeURIComponent(token)}`;
  return appUrl.toString();
}

export async function deliverPasswordReset(input: {
  email: string;
  resetUrl: string;
  expiresAt: Date;
}) {
  const webhookUrl = process.env.PASSWORD_RESET_EMAIL_WEBHOOK_URL?.trim();
  if (!webhookUrl) return false;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.PASSWORD_RESET_EMAIL_WEBHOOK_TOKEN
        ? { authorization: `Bearer ${process.env.PASSWORD_RESET_EMAIL_WEBHOOK_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Password reset delivery failed with status ${response.status}.`);
  return true;
}

export function passwordResetTokenFingerprint(token: string) {
  return hashPasswordResetToken(token).slice(0, 16);
}
