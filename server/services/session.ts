import type { Response } from 'express';

const SESSION_COOKIE = 'gcv_session';

function isProductionLike() {
  return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
}

export type SessionIdentity = {
  id: string;
  sessionVersion: number;
};

export function serializeSession(identity: SessionIdentity) {
  return `${identity.id}.${identity.sessionVersion}`;
}

export function parseSession(value: unknown): SessionIdentity | null {
  if (typeof value !== 'string') return null;
  const separator = value.lastIndexOf('.');
  if (separator <= 0 || separator === value.length - 1) return null;

  const id = value.slice(0, separator);
  const sessionVersion = Number(value.slice(separator + 1));
  if (!id || !Number.isSafeInteger(sessionVersion) || sessionVersion < 0) return null;
  return { id, sessionVersion };
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
