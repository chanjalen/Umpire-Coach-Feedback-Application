import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JwtPayload {
  userId: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}

/** Signs a short-lived token used only for email verification links. */
export function signEmailVerifyToken(userId: string): string {
  return jwt.sign({ userId, purpose: 'email-verify' }, config.jwt.secret, { expiresIn: '72h' });
}

/** Verifies an email verification token. Throws if invalid, expired, or wrong purpose. */
export function verifyEmailVerifyToken(token: string): { userId: string } {
  const payload = jwt.verify(token, config.jwt.secret) as { userId: string; purpose: string };
  if (payload.purpose !== 'email-verify') throw new Error('Invalid token purpose');
  return { userId: payload.userId };
}
