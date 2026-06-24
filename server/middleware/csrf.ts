import { NextFunction, Request, Response } from 'express';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type CsrfOptions = {
  enabled: boolean;
  appUrl?: string;
};

function normalizeOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

export function createCsrfProtection(options: CsrfOptions) {
  const configuredOrigin = normalizeOrigin(options.appUrl);

  return (req: Request, res: Response, next: NextFunction) => {
    if (!options.enabled || !unsafeMethods.has(req.method)) {
      return next();
    }

    const requestOrigin = normalizeOrigin(req.get('origin'));
    const hostOrigin = `${req.protocol}://${req.get('host')}`;
    const allowedOrigins = new Set([configuredOrigin, hostOrigin].filter(Boolean));

    if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
      return res.status(403).json({ error: 'Requisição bloqueada por proteção CSRF.' });
    }

    next();
  };
}
