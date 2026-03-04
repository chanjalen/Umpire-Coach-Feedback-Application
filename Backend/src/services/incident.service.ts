import { prisma } from '../lib/prisma';
import { sendNotification } from '../lib/email';
import { incidentFiledEmail } from '../lib/emailTemplates';
import { config } from '../config';
import {
  CreateIncidentInput,
  UpdateIncidentInput,
  ResolveIncidentInput,
  ListIncidentsQuery,
} from '../schemas/incident.schema';

// ─── Errors ───────────────────────────────────────────────────────────────────

function notFound(entity: string): never {
  const err = new Error(`${entity} not found`) as Error & { statusCode: number };
  err.statusCode = 404;
  throw err;
}

function forbidden(msg: string): never {
  const err = new Error(msg) as Error & { statusCode: number };
  err.statusCode = 403;
  throw err;
}

function badRequest(msg: string): never {
  const err = new Error(msg) as Error & { statusCode: number };
  err.statusCode = 400;
  throw err;
}

// ─── Shared include ───────────────────────────────────────────────────────────

const incidentInclude = {
  reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
  subject:  { select: { id: true, firstName: true, lastName: true, email: true } },
  game:     { select: { id: true, title: true, scheduledAt: true } },
} as const;

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createIncident(orgId: string, reporterId: string, input: CreateIncidentInput) {
  // Verify the game belongs to this org
  const game = await prisma.game.findUnique({
    where: { id: input.gameId },
    select: { id: true, orgId: true, title: true },
  });
  if (!game || game.orgId !== orgId) notFound('Game');

  // Can't report yourself
  if (reporterId === input.subjectId) {
    badRequest('You cannot file an incident against yourself');
  }

  // Verify the reporter was assigned to the game (as umpire or manager)
  const [reporterAsUmpire, reporterAsManager] = await Promise.all([
    prisma.gameUmpire.findFirst({ where: { gameId: input.gameId, userId: reporterId } }),
    prisma.gameManager.findFirst({ where: { gameId: input.gameId, userId: reporterId } }),
  ]);
  if (!reporterAsUmpire && !reporterAsManager) {
    forbidden('You must be an assigned umpire or manager for this game to report an incident');
  }

  // Verify the subject was also assigned to the game (as umpire or manager)
  const [subjectAsUmpire, subjectAsManager] = await Promise.all([
    prisma.gameUmpire.findFirst({ where: { gameId: input.gameId, userId: input.subjectId } }),
    prisma.gameManager.findFirst({ where: { gameId: input.gameId, userId: input.subjectId } }),
  ]);
  if (!subjectAsUmpire && !subjectAsManager) {
    badRequest('The specified person was not assigned to this game');
  }

  const incident = await prisma.$transaction(async (tx) => {
    const created = await tx.incident.create({
      data: {
        orgId,
        reportedBy:  reporterId,
        subjectId:   input.subjectId,
        gameId:      input.gameId,
        title:       input.title,
        description: input.description,
      },
      include: incidentInclude,
    });

    // Flip hasIncident on the game
    await tx.game.update({
      where: { id: input.gameId },
      data: { hasIncident: true },
    });

    return created;
  });

  // Notify all org admins — fire-and-forget
  notifyAdmins(orgId, incident.id, game.title).catch(() => {});

  return incident;
}

// ─── List my filed incidents ──────────────────────────────────────────────────

export async function listMyIncidents(orgId: string, userId: string) {
  return prisma.incident.findMany({
    where: { orgId, reportedBy: userId },
    select: {
      id: true,
      title: true,
      description: true,
      resolvedAt: true,
      createdAt: true,
      game: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listIncidents(orgId: string, query: ListIncidentsQuery) {
  const where: Record<string, unknown> = { orgId };

  if (query.subjectId) where.subjectId = query.subjectId;
  if (query.gameId)    where.gameId   = query.gameId;
  if (query.resolved === 'true')  where.resolvedAt = { not: null };
  if (query.resolved === 'false') where.resolvedAt = null;

  return prisma.incident.findMany({
    where,
    include: incidentInclude,
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getIncident(orgId: string, incidentId: string) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: incidentInclude,
  });
  if (!incident || incident.orgId !== orgId) notFound('Incident');
  return incident;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateIncident(orgId: string, incidentId: string, input: UpdateIncidentInput) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident || incident.orgId !== orgId) notFound('Incident');

  return prisma.incident.update({
    where: { id: incidentId },
    data: {
      ...(input.title       !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
    },
    include: incidentInclude,
  });
}

// ─── Resolve / un-resolve ─────────────────────────────────────────────────────

export async function resolveIncident(
  orgId: string,
  incidentId: string,
  input: ResolveIncidentInput,
) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident || incident.orgId !== orgId) notFound('Incident');

  return prisma.incident.update({
    where: { id: incidentId },
    data: { resolvedAt: input.resolved ? new Date() : null },
    include: incidentInclude,
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteIncident(orgId: string, incidentId: string) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident || incident.orgId !== orgId) notFound('Incident');

  await prisma.incident.delete({ where: { id: incidentId } });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function notifyAdmins(orgId: string, incidentId: string, gameTitle: string) {
  const admins = await prisma.orgMember.findMany({
    where: { orgId, role: 'ADMIN' },
    include: { user: { select: { id: true, email: true } } },
  });

  for (const admin of admins) {
    sendNotification({
      userId: admin.user.id,
      toEmail: admin.user.email,
      type: 'INCIDENT_FILED',
      relatedId: incidentId,
      subject: `New incident reported — ${gameTitle}`,
      html: incidentFiledEmail({ gameTitle, dashboardUrl: `${config.frontendUrl}/admin/incidents` }),
    }).catch(() => {});
  }
}
