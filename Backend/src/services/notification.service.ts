import { prisma } from '../lib/prisma';

// ─── List org notifications ───────────────────────────────────────────────────

export interface ListNotificationsQuery {
  status?: 'PENDING' | 'SENT' | 'FAILED';
  type?: string;
  userId?: string;
}

/**
 * Returns email notifications scoped to an org.
 *
 * EmailNotification has no orgId column. We scope by:
 *   1. relatedId matching a submission or incident belonging to this org
 *   2. Plus any direct userId filter if provided (user must be an org member)
 *
 * This accurately captures every notification fired for org-specific events.
 */
export async function listOrgNotifications(orgId: string, query: ListNotificationsQuery) {
  // Collect all submission and incident IDs for this org
  const [submissions, incidents] = await Promise.all([
    prisma.submission.findMany({
      where: { game: { orgId } },
      select: { id: true },
    }),
    prisma.incident.findMany({
      where: { orgId },
      select: { id: true },
    }),
  ]);

  const relatedIds = [
    ...submissions.map(s => s.id),
    ...incidents.map(i => i.id),
  ];

  const where: Record<string, unknown> = {
    relatedId: { in: relatedIds },
  };

  if (query.status) where.status = query.status;
  if (query.type)   where.type   = query.type;
  if (query.userId) {
    // Confirm the requested userId is actually an org member before filtering
    const isMember = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: query.userId } },
      select: { userId: true },
    });
    if (isMember) where.userId = query.userId;
  }

  return prisma.emailNotification.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
