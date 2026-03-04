import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { prisma } from '../lib/prisma';

// Confirms the logged-in user is a member of the org in the URL.
// Attaches the membership record to req so downstream handlers can use it
// without making another DB call.
export async function requireOrgMember(req: AuthRequest, res: Response, next: NextFunction) {
  const orgId = req.params.orgId as string;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: req.user!.userId } },
  });

  if (!membership) {
    res.status(403).json({ message: 'You are not a member of this organization' });
    return;
  }

  // Stash on req so controllers can read the role without re-querying
  (req as AuthRequest & { orgMembership: typeof membership }).orgMembership = membership;
  next();
}

// Like requireOrgMember but also enforces ADMIN role within the org.
// Always stack after requireOrgMember so the membership is already on req.
export async function requireOrgAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const orgId = req.params.orgId as string;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: req.user!.userId } },
  });

  if (!membership || membership.role !== 'ADMIN') {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }

  (req as AuthRequest & { orgMembership: typeof membership }).orgMembership = membership;
  next();
}
