import { prisma } from '../lib/prisma';
import { sendRawEmail } from '../lib/email';
import { inviteEmail } from '../lib/emailTemplates';
import { config } from '../config';
import {
  CreateOrgInput,
  UpdateOrgInput,
  UpdateMemberRoleInput,
  CreateInviteInput,
  AddMemberByEmailInput,
  JoinOrgInput,
} from '../schemas/org.schema';

function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

// ─── Org ──────────────────────────────────────────────────────────────────────

export async function createOrg(userId: string, input: CreateOrgInput) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.org.create({
      data: { name: input.name, slug: slugify(input.name) },
    });
    await tx.orgMember.create({
      data: { userId, orgId: org.id, role: 'ADMIN' },
    });
    // Promote the user's global role to ORG_ADMIN
    await tx.user.update({ where: { id: userId }, data: { role: 'ORG_ADMIN' } });
    return org;
  });
}

export async function getOrg(orgId: string) {
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    include: {
      members: {
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, role: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  if (!org) notFound('Organization');
  return org;
}

export async function updateOrg(orgId: string, input: UpdateOrgInput) {
  return prisma.org.update({ where: { id: orgId }, data: input });
}

export async function deleteOrg(orgId: string) {
  // Cascade is set on all child tables in the schema, so this removes
  // members, games, invites, and incidents in one shot.
  await prisma.org.delete({ where: { id: orgId } });
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function listMembers(orgId: string) {
  return prisma.orgMember.findMany({
    where: { orgId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { joinedAt: 'asc' },
  });
}

export async function getMemberProfile(orgId: string, userId: string) {
  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  if (!member) notFound('Member');

  const info = { ...member.user, role: member.role, joinedAt: member.joinedAt };

  if (member.role === 'UMPIRE') {
    const raw = await prisma.coachUmpireRating.findMany({
      where: { umpireId: userId, submission: { game: { orgId } } },
      include: {
        coach: { select: { id: true, firstName: true, lastName: true } },
        submission: { include: { game: { select: { id: true, title: true, scheduledAt: true } } } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const nonNoShow = raw.filter(r => !r.noShow);
    const avg = nonNoShow.length ? {
      count:       nonNoShow.length,
      appearance:  round(mean(nonNoShow.map(r => r.appearance))),
      judgment:    round(mean(nonNoShow.map(r => r.judgment))),
      mechanics:   round(mean(nonNoShow.map(r => r.mechanics))),
      gameControl: round(mean(nonNoShow.map(r => r.gameControl))),
      composure:   round(mean(nonNoShow.map(r => r.composure))),
      attitude:    round(mean(nonNoShow.map(r => r.attitude))),
      overall:     computeOverall([
        mean(nonNoShow.map(r => r.appearance)),
        mean(nonNoShow.map(r => r.judgment)),
        mean(nonNoShow.map(r => r.mechanics)),
        mean(nonNoShow.map(r => r.gameControl)),
        mean(nonNoShow.map(r => r.composure)),
        mean(nonNoShow.map(r => r.attitude)),
      ]),
    } : null;

    const ratings = raw.map(r => ({
      id:         r.id,
      game:       r.submission.game,
      rater:      r.coach,
      noShow:     r.noShow,
      scores:     { appearance: r.appearance, judgment: r.judgment, mechanics: r.mechanics, gameControl: r.gameControl, composure: r.composure, attitude: r.attitude },
      overall:    r.noShow ? null : computeOverall([r.appearance, r.judgment, r.mechanics, r.gameControl, r.composure, r.attitude]),
      comments:   r.comments,
      submittedAt: r.submittedAt,
    }));

    const comments = nonNoShow.filter(r => r.comments).map(r => r.comments as string);
    return { member: info, ratings, avg, comments };
  }

  if (member.role === 'MANAGER' || member.role === 'COACH') {
    const raw = await prisma.umpireManagerRating.findMany({
      where: { managerId: userId, submission: { game: { orgId } } },
      include: {
        umpire: { select: { id: true, firstName: true, lastName: true } },
        submission: { include: { game: { select: { id: true, title: true, scheduledAt: true } } } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const nonNoShow = raw.filter(r => !r.noShow);
    const avg = nonNoShow.length ? {
      count:        nonNoShow.length,
      sportsmanship: round(mean(nonNoShow.map(r => r.sportsmanship))),
      cooperation:   round(mean(nonNoShow.map(r => r.cooperation))),
      overall:       computeOverall([
        mean(nonNoShow.map(r => r.sportsmanship)),
        mean(nonNoShow.map(r => r.cooperation)),
      ]),
    } : null;

    const ratings = raw.map(r => ({
      id:         r.id,
      game:       r.submission.game,
      rater:      r.umpire,
      noShow:     r.noShow,
      scores:     { sportsmanship: r.sportsmanship, cooperation: r.cooperation },
      overall:    r.noShow ? null : computeOverall([r.sportsmanship, r.cooperation]),
      comments:   r.comments,
      submittedAt: r.submittedAt,
    }));

    const comments = nonNoShow.filter(r => r.comments).map(r => r.comments as string);
    return { member: info, ratings, avg, comments };
  }

  // ADMIN — no ratings
  return { member: info, ratings: [], avg: null, comments: [] };
}

function mean(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function updateMemberRole(orgId: string, userId: string, input: UpdateMemberRoleInput) {
  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!member) notFound('Member');

  return prisma.orgMember.update({
    where: { orgId_userId: { orgId, userId } },
    data: { role: input.role },
  });
}

export async function removeMember(orgId: string, userId: string, requesterId: string) {
  if (userId === requesterId) {
    throw appError('You cannot remove yourself from the org', 400);
  }

  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!member) notFound('Member');

  await prisma.orgMember.delete({ where: { orgId_userId: { orgId, userId } } });
}

export async function addMemberByEmail(orgId: string, input: AddMemberByEmailInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw appError('No account found with that email', 404);

  const existing = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: user.id } },
  });
  if (existing) throw appError('That user is already a member of this org', 409);

  return prisma.orgMember.create({
    data: { orgId, userId: user.id, role: input.role },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

// ─── Invites ─────────────────────────────────────────────────────────────────

export async function createInvite(orgId: string, userId: string, input: CreateInviteInput) {
  const code = generateCode();

  const [invite, org] = await Promise.all([
    prisma.orgInvite.create({ data: { orgId, code, role: input.role, createdBy: userId } }),
    prisma.org.findUnique({ where: { id: orgId }, select: { name: true } }),
  ]);

  if (input.email) {
    const joinLink = `${config.frontendUrl}/join?code=${code}`;
    const roleName = input.role.charAt(0) + input.role.slice(1).toLowerCase();
    await sendRawEmail({
      to: input.email,
      subject: `You've been invited to join ${org?.name ?? 'an organization'} on Bluelyticsdash`,
      html: inviteEmail({ orgName: org?.name ?? 'an organization', role: roleName, joinUrl: joinLink }),
    });
  }

  return invite;
}

export async function listInvites(orgId: string) {
  return prisma.orgInvite.findMany({
    where: { orgId, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeInvite(orgId: string, inviteId: string) {
  const invite = await prisma.orgInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.orgId !== orgId) notFound('Invite');

  return prisma.orgInvite.update({ where: { id: inviteId }, data: { isActive: false } });
}

export async function joinOrg(userId: string, input: JoinOrgInput) {
  const invite = await prisma.orgInvite.findUnique({ where: { code: input.code } });

  if (!invite || !invite.isActive) {
    throw appError('Invalid or revoked invite code', 400);
  }

  const existing = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: invite.orgId, userId } },
  });
  if (existing) throw appError('You are already a member of this organization', 409);

  const membership = await prisma.orgMember.create({
    data: { orgId: invite.orgId, userId, role: invite.role },
    include: { org: true },
  });

  return membership;
}

// ─── My ratings ──────────────────────────────────────────────────────────────

const RATINGS_THRESHOLD = 5;

export async function getMyRatings(orgId: string, userId: string, memberRole: string) {
  if (memberRole === 'UMPIRE') {
    const [ratings, totalCount] = await Promise.all([
      prisma.coachUmpireRating.findMany({
        where: { umpireId: userId, noShow: false, submission: { game: { orgId } } },
        select: { appearance: true, judgment: true, mechanics: true, gameControl: true, composure: true, attitude: true, comments: true },
      }),
      prisma.coachUmpireRating.count({
        where: { umpireId: userId, submission: { game: { orgId } } },
      }),
    ]);

    const meetsThreshold = totalCount >= RATINGS_THRESHOLD;
    const comments = ratings.filter(r => r.comments).map(r => r.comments as string);

    if (!meetsThreshold) {
      return { ratingsCount: totalCount, meetsThreshold, threshold: RATINGS_THRESHOLD, avg: null, comments };
    }

    const appearance  = computeOverall(ratings.map(r => r.appearance));
    const judgment    = computeOverall(ratings.map(r => r.judgment));
    const mechanics   = computeOverall(ratings.map(r => r.mechanics));
    const gameControl = computeOverall(ratings.map(r => r.gameControl));
    const composure   = computeOverall(ratings.map(r => r.composure));
    const attitude    = computeOverall(ratings.map(r => r.attitude));
    const overall     = computeOverall([appearance, judgment, mechanics, gameControl, composure, attitude]);

    return {
      ratingsCount: totalCount,
      meetsThreshold,
      threshold: RATINGS_THRESHOLD,
      avg: { overall, appearance, judgment, mechanics, gameControl, composure, attitude },
      comments,
    };
  }

  if (memberRole === 'MANAGER' || memberRole === 'COACH') {
    const [ratings, totalCount] = await Promise.all([
      prisma.umpireManagerRating.findMany({
        where: { managerId: userId, noShow: false, submission: { game: { orgId } } },
        select: { sportsmanship: true, cooperation: true, comments: true },
      }),
      prisma.umpireManagerRating.count({
        where: { managerId: userId, submission: { game: { orgId } } },
      }),
    ]);

    const meetsThreshold = totalCount >= RATINGS_THRESHOLD;
    const comments = ratings.filter(r => r.comments).map(r => r.comments as string);

    if (!meetsThreshold) {
      return { ratingsCount: totalCount, meetsThreshold, threshold: RATINGS_THRESHOLD, avg: null, comments };
    }

    const sportsmanship = computeOverall(ratings.map(r => r.sportsmanship));
    const cooperation   = computeOverall(ratings.map(r => r.cooperation));
    const overall       = computeOverall([sportsmanship, cooperation]);

    return {
      ratingsCount: totalCount,
      meetsThreshold,
      threshold: RATINGS_THRESHOLD,
      avg: { overall, sportsmanship, cooperation },
      comments,
    };
  }

  return { ratingsCount: 0, meetsThreshold: false, threshold: RATINGS_THRESHOLD, avg: null, comments: [] };
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getOrgStats(orgId: string) {
  const [
    umpireRatingGroups,
    managerRatingGroups,
    umpireMembers,
    managerMembers,
    recentGames,
    incidents,
  ] = await Promise.all([
    prisma.coachUmpireRating.groupBy({
      by: ['umpireId'],
      where: { noShow: false, submission: { game: { orgId } } },
      _avg: { appearance: true, judgment: true, mechanics: true, gameControl: true, composure: true, attitude: true },
      _count: { _all: true },
    }),
    prisma.umpireManagerRating.groupBy({
      by: ['managerId'],
      where: { noShow: false, submission: { game: { orgId } } },
      _avg: { sportsmanship: true, cooperation: true },
      _count: { _all: true },
    }),
    prisma.orgMember.findMany({
      where: { orgId, role: 'UMPIRE' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.orgMember.findMany({
      where: { orgId, role: { in: ['MANAGER', 'COACH'] } },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.game.findMany({
      where: { orgId, status: 'COMPLETED' },
      orderBy: { scheduledAt: 'desc' },
      take: 10,
      select: { id: true, title: true, scheduledAt: true, status: true, homeTeam: true, awayTeam: true },
    }),
    prisma.incident.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true } },
        subject:  { select: { id: true, firstName: true, lastName: true } },
        game:     { select: { id: true, title: true } },
      },
    }),
  ]);

  const umpires = umpireMembers.map(m => {
    const g = umpireRatingGroups.find(r => r.umpireId === m.userId);
    return {
      userId:       m.userId,
      firstName:    m.user.firstName,
      lastName:     m.user.lastName,
      ratingsCount: g?._count._all ?? 0,
      avg: {
        appearance:  round(g?._avg.appearance),
        judgment:    round(g?._avg.judgment),
        mechanics:   round(g?._avg.mechanics),
        gameControl: round(g?._avg.gameControl),
        composure:   round(g?._avg.composure),
        attitude:    round(g?._avg.attitude),
        overall:     computeOverall([g?._avg.appearance, g?._avg.judgment, g?._avg.mechanics, g?._avg.gameControl, g?._avg.composure, g?._avg.attitude]),
      },
    };
  });

  const managers = managerMembers.map(m => {
    const g = managerRatingGroups.find(r => r.managerId === m.userId);
    return {
      userId:       m.userId,
      firstName:    m.user.firstName,
      lastName:     m.user.lastName,
      ratingsCount: g?._count._all ?? 0,
      avg: {
        sportsmanship: round(g?._avg.sportsmanship),
        cooperation:   round(g?._avg.cooperation),
        overall:       computeOverall([g?._avg.sportsmanship, g?._avg.cooperation]),
      },
    };
  });

  return { umpires, managers, recentGames, incidents };
}

function round(n: number | null | undefined): number | null {
  if (n == null) return null;
  return Math.round(n * 10) / 10;
}

function computeOverall(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 — easy to read
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function notFound(entity: string): never {
  throw appError(`${entity} not found`, 404);
}

function appError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}
