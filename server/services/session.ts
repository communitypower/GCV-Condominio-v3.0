import type { Response } from 'express';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const SESSION_COOKIE = 'gcv_session';
const SESSION_FORMAT = 'v1';
const SESSION_AAD = Buffer.from('gcv-session-v1');

function isProductionLike() {
  return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
}

export type SessionIdentity = {
  id: string;
  sessionVersion: number;
};

function sessionEncryptionKey() {
  const secret = process.env.SESSION_SECRET || 'gcv_local_secret';
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function serializeSession(identity: SessionIdentity) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sessionEncryptionKey(), initializationVector);
  cipher.setAAD(SESSION_AAD);
  const plaintext = Buffer.from(JSON.stringify({ id: identity.id, sessionVersion: identity.sessionVersion }), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  return [
    SESSION_FORMAT,
    initializationVector.toString('base64url'),
    encrypted.toString('base64url'),
    authenticationTag.toString('base64url'),
  ].join('.');
}

export function parseSession(value: unknown): SessionIdentity | null {
  if (typeof value !== 'string') return null;
  const [format, encodedIv, encodedCiphertext, encodedTag, extra] = value.split('.');
  if (format !== SESSION_FORMAT || !encodedIv || !encodedCiphertext || !encodedTag || extra !== undefined) return null;

  try {
    const initializationVector = Buffer.from(encodedIv, 'base64url');
    const encrypted = Buffer.from(encodedCiphertext, 'base64url');
    const authenticationTag = Buffer.from(encodedTag, 'base64url');
    if (initializationVector.length !== 12 || encrypted.length === 0 || authenticationTag.length !== 16) return null;

    const decipher = createDecipheriv('aes-256-gcm', sessionEncryptionKey(), initializationVector);
    decipher.setAAD(SESSION_AAD);
    decipher.setAuthTag(authenticationTag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plaintext);
    if (!parsed || typeof parsed.id !== 'string' || !parsed.id ||
      !Number.isSafeInteger(parsed.sessionVersion) || parsed.sessionVersion < 0) return null;
    return { id: parsed.id, sessionVersion: parsed.sessionVersion };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, identity: SessionIdentity) {
  res.cookie(SESSION_COOKIE, serializeSession(identity), {
    httpOnly: true,
    signed: true,
    secure: isProductionLike(),
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    signed: true,
    secure: isProductionLike(),
    sameSite: 'lax',
  });
}
