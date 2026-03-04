import { prisma } from '../lib/prisma';
import { sendNotification, wasAlreadySent } from '../lib/email';
import { submissionOpenEmail, reminderManualEmail } from '../lib/emailTemplates';
import { config } from '../config';
import {
  CreateCoachRatingInput,
  UpdateCoachRatingInput,
  CreateUmpireRatingInput,
  UpdateUmpireRatingInput,
} from '../schemas/submission.schema';

// ─── Errors ───────────────────────────────────────────────────────────────────

function notFound(entity: string): never {
  const err = new Error(`${entity} not found`) as Error & { statusCode: number };
  err.statusCode = 404;
  throw err;
}

function forbidden(msg = 'Forbidden'): never {
  const err = new Error(msg) as Error & { statusCode: number };
  err.statusCode = 403;
  throw err;
}

function conflict(msg: string): never {
  const err = new Error(msg) as Error & { statusCode: number };
  err.statusCode = 409;
  throw err;
}

function badRequest(msg: string): never {
  const err = new Error(msg) as Error & { statusCode: number };
  err.statusCode = 400;
  throw err;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// The number of ratings an umpire/manager needs before averages become visible to them.
const VISIBILITY_THRESHOLD = 5;

async function assertSubmissionBelongsToOrg(submissionId: string, orgId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { game: { select: { orgId: true } } },
  });
  if (!submission || submission.game.orgId !== orgId) notFound('Submission');
  return submission;
}

async function assertSubmissionOpen(status: string) {
  if (status === 'SUBMITTED') {
    badRequest('Submission is already submitted — no changes allowed');
  }
}

/**
 * Sends the open-submission email to a single user.
 * Skips silently if already sent (idempotent).
 */
async function sendOpenEmail(
  userId: string,
  toEmail: string,
  firstName: string,
  submissionId: string,
  gameTitle: string,
) {
  const already = await wasAlreadySent(userId, 'SUBMISSION_OPEN', submissionId);
  if (already) return;

  await sendNotification({
    userId,
    toEmail,
    type: 'SUBMISSION_OPEN',
    relatedId: submissionId,
    subject: `Ratings are now open — ${gameTitle}`,
    html: submissionOpenEmail({ firstName, gameTitle, submitUrl: `${config.frontendUrl}/` }),
  });
}

// ─── Submissions CRUD ─────────────────────────────────────────────────────────

/**
 * Admin manually opens a submission for a game.
 * Enforces: game must be COMPLETED, only one open submission per game.
 */
export async function openSubmission(orgId: string, gameId: string, userId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      umpires: { include: { user: { select: { id: true, email: true, firstName: true } } } },
      managers: { include: { user: { select: { id: true, email: true, firstName: true } } } },
    },
  });

  if (!game || game.orgId !== orgId) notFound('Game');
  if (game.status !== 'COMPLETED') badRequest('Submission can only be opened for a COMPLETED game');

  const existing = await prisma.submission.findFirst({
    where: { gameId, status: 'PENDING' },
  });
  if (existing) conflict('An open submission already exists for this game');

  const submission = await prisma.submission.create({
    data: { gameId, createdBy: userId },
    include: { game: { select: { title: true } } },
  });

  // Fire-and-forget notification emails to all assigned umpires + managers
  const recipients = [
    ...game.umpires.map(u => ({ id: u.user.id, email: u.user.email, firstName: u.user.firstName })),
    ...game.managers.map(m => ({ id: m.user.id, email: m.user.email, firstName: m.user.firstName })),
  ];
  for (const r of recipients) {
    sendOpenEmail(r.id, r.email, r.firstName, submission.id, game.title).catch(() => {});
  }

  return submission;
}

export async function listGameSubmissions(
  orgId: string,
  gameId: string,
  userId: string,
  memberRole: string,
) {
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { orgId: true } });
  if (!game || game.orgId !== orgId) notFound('Game');

  const submissions = await prisma.submission.findMany({
    where: { gameId },
    include: {
      _count:        { select: { coachRatings: true, umpireRatings: true } },
      coachRatings:  { select: { coachId: true } },
      umpireRatings: { select: { umpireId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return submissions.map(({ coachRatings, umpireRatings, ...rest }) => {
    let myRatingsSubmitted = false;
    if (memberRole === 'UMPIRE') {
      myRatingsSubmitted = umpireRatings.some(r => r.umpireId === userId);
    } else if (memberRole === 'MANAGER' || memberRole === 'COACH') {
      myRatingsSubmitted = coachRatings.some(r => r.coachId === userId);
    }
    return { ...rest, myRatingsSubmitted };
  });
}

/**
 * Returns submission detail. What gets returned depends on the requester's role:
 *
 * ADMIN → full data with names, individual ratings
 * UMPIRE → their own coach ratings about them. Averages only shown if ≥5 total
 *           ratings exist for them (org-wide). Comments always shown. No names.
 * MANAGER → their own umpire ratings about them. Same threshold + anonymization.
 */
export async function getSubmission(
  orgId: string,
  submissionId: string,
  userId: string,
  memberRole: string,
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      game: {
        select: {
          id: true,
          title: true,
          orgId: true,
          scheduledAt: true,
          homeTeam: true,
          awayTeam: true,
          umpires: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
          managers: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        },
      },
      coachRatings: {
        include: {
          coach: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      umpireRatings: {
        include: {
          umpire: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!submission || submission.game.orgId !== orgId) notFound('Submission');

  if (memberRole === 'ADMIN') return submission;

  // UMPIRE: show only their own coach ratings, anonymized
  if (memberRole === 'UMPIRE') {
    const myRatings = submission.coachRatings.filter(r => r.umpireId === userId);

    const totalRatingsAboutMe = await prisma.coachUmpireRating.count({
      where: { umpireId: userId },
    });
    const showAverages = totalRatingsAboutMe >= VISIBILITY_THRESHOLD;

    const averages = showAverages
      ? computeCoachRatingAverages(myRatings)
      : null;

    const comments = myRatings
      .filter(r => r.comments)
      .map(r => ({ comments: r.comments })); // no coachId exposed

    // What this umpire submitted (their outgoing ratings of managers)
    const mySubmittedRatings = submission.umpireRatings
      .filter(r => r.umpireId === userId)
      .map(r => ({
        managerId:     r.managerId,
        noShow:        r.noShow,
        sportsmanship: r.sportsmanship,
        cooperation:   r.cooperation,
        comments:      r.comments,
      }));

    return {
      id: submission.id,
      gameId: submission.gameId,
      status: submission.status,
      game: submission.game,
      createdAt: submission.createdAt,
      averages,
      comments,
      ratingsCount: myRatings.length,
      meetsThreshold: showAverages,
      myRatingsSubmitted: mySubmittedRatings.length > 0,
      mySubmittedRatings,
    };
  }

  // MANAGER: show only umpire ratings about them, anonymized
  if (memberRole === 'MANAGER') {
    const myRatings = submission.umpireRatings.filter(r => r.managerId === userId);

    const totalRatingsAboutMe = await prisma.umpireManagerRating.count({
      where: { managerId: userId },
    });
    const showAverages = totalRatingsAboutMe >= VISIBILITY_THRESHOLD;

    const averages = showAverages
      ? computeUmpireRatingAverages(myRatings)
      : null;

    const comments = myRatings
      .filter(r => r.comments)
      .map(r => ({ comments: r.comments })); // no umpireId exposed

    // What this manager submitted (their outgoing ratings of umpires)
    const mySubmittedRatings = submission.coachRatings
      .filter(r => r.coachId === userId)
      .map(r => ({
        umpireId:    r.umpireId,
        noShow:      r.noShow,
        appearance:  r.appearance,
        judgment:    r.judgment,
        mechanics:   r.mechanics,
        gameControl: r.gameControl,
        composure:   r.composure,
        attitude:    r.attitude,
        comments:    r.comments,
      }));

    return {
      id: submission.id,
      gameId: submission.gameId,
      status: submission.status,
      game: submission.game,
      createdAt: submission.createdAt,
      averages,
      comments,
      ratingsCount: myRatings.length,
      meetsThreshold: showAverages,
      myRatingsSubmitted: mySubmittedRatings.length > 0,
      mySubmittedRatings,
    };
  }

  // COACH role — they can see what they submitted
  const myCoachRatings = submission.coachRatings.filter(r => r.coachId === userId);
  return {
    id: submission.id,
    gameId: submission.gameId,
    status: submission.status,
    game: submission.game,
    createdAt: submission.createdAt,
    myRatings: myCoachRatings.map(r => ({ ...r, coach: undefined })),
  };
}

export async function closeSubmission(orgId: string, submissionId: string) {
  const submission = await assertSubmissionBelongsToOrg(submissionId, orgId);
  if (submission.status === 'SUBMITTED') badRequest('Submission is already submitted');

  return prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'SUBMITTED', closedAt: new Date() },
  });
}

/**
 * Admin sends a manual reminder to all assigned umpires + managers who
 * haven't completed their ratings yet.
 */
export async function sendReminder(orgId: string, submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      game: {
        select: {
          title: true,
          orgId: true,
          umpires: { include: { user: { select: { id: true, email: true, firstName: true } } } },
          managers: { include: { user: { select: { id: true, email: true, firstName: true } } } },
        },
      },
      coachRatings: { select: { coachId: true } },
      umpireRatings: { select: { umpireId: true } },
    },
  });

  if (!submission || submission.game.orgId !== orgId) notFound('Submission');
  if (submission.status === 'SUBMITTED') badRequest('Cannot send reminders for a submitted submission');

  const coachesWhoSubmitted = new Set(submission.coachRatings.map(r => r.coachId));
  const umpiresWhoSubmitted = new Set(submission.umpireRatings.map(r => r.umpireId));

  const gameTitle = submission.game.title;

  const sends: Promise<void>[] = [];

  for (const m of submission.game.managers) {
    if (!coachesWhoSubmitted.has(m.user.id)) {
      sends.push(
        sendNotification({
          userId: m.user.id,
          toEmail: m.user.email,
          type: 'SUBMISSION_REMINDER_MANUAL',
          relatedId: submissionId,
          subject: `Reminder — ratings pending for ${gameTitle}`,
          html: reminderManualEmail({ firstName: m.user.firstName, gameTitle, submitUrl: `${config.frontendUrl}/` }),
        }),
      );
    }
  }

  for (const u of submission.game.umpires) {
    if (!umpiresWhoSubmitted.has(u.user.id)) {
      sends.push(
        sendNotification({
          userId: u.user.id,
          toEmail: u.user.email,
          type: 'SUBMISSION_REMINDER_MANUAL',
          relatedId: submissionId,
          subject: `Reminder — ratings pending for ${gameTitle}`,
          html: reminderManualEmail({ firstName: u.user.firstName, gameTitle, submitUrl: `${config.frontendUrl}/` }),
        }),
      );
    }
  }

  await Promise.allSettled(sends);
  return { sent: sends.length };
}

// ─── Coach → Umpire ratings ───────────────────────────────────────────────────

export async function submitCoachRating(
  orgId: string,
  submissionId: string,
  coachId: string,
  input: CreateCoachRatingInput,
) {
  const submission = await assertSubmissionBelongsToOrg(submissionId, orgId);
  await assertSubmissionOpen(submission.status);

  // The requester must be an assigned manager of this game
  const isAssigned = await prisma.gameManager.findFirst({
    where: { gameId: submission.gameId, userId: coachId },
  });
  if (!isAssigned) forbidden('You are not an assigned manager for this game');

  // The target umpire must be assigned to this game
  const umpireAssigned = await prisma.gameUmpire.findFirst({
    where: { gameId: submission.gameId, userId: input.umpireId },
  });
  if (!umpireAssigned) badRequest('The specified umpire is not assigned to this game');

  // Prevent duplicate (unique constraint will also catch it, but better error message)
  const existing = await prisma.coachUmpireRating.findFirst({
    where: { submissionId, coachId, umpireId: input.umpireId },
  });
  if (existing) conflict('You have already rated this umpire for this submission. Use PATCH to update.');

  return prisma.coachUmpireRating.create({
    data: {
      submissionId,
      coachId,
      umpireId: input.umpireId,
      noShow: input.noShow,
      appearance:  input.noShow ? null : (input.appearance  ?? null),
      judgment:    input.noShow ? null : (input.judgment    ?? null),
      mechanics:   input.noShow ? null : (input.mechanics   ?? null),
      gameControl: input.noShow ? null : (input.gameControl ?? null),
      composure:   input.noShow ? null : (input.composure   ?? null),
      attitude:    input.noShow ? null : (input.attitude    ?? null),
      comments: input.comments ?? null,
    },
  });
}

export async function updateCoachRating(
  orgId: string,
  submissionId: string,
  coachId: string,
  umpireId: string,
  input: UpdateCoachRatingInput,
) {
  const submission = await assertSubmissionBelongsToOrg(submissionId, orgId);
  await assertSubmissionOpen(submission.status);

  const existing = await prisma.coachUmpireRating.findFirst({
    where: { submissionId, coachId, umpireId },
  });
  if (!existing) notFound('Coach rating');

  return prisma.coachUmpireRating.update({
    where: { id: existing.id },
    data: {
      noShow: input.noShow,
      appearance:  input.noShow ? null : (input.appearance  ?? null),
      judgment:    input.noShow ? null : (input.judgment    ?? null),
      mechanics:   input.noShow ? null : (input.mechanics   ?? null),
      gameControl: input.noShow ? null : (input.gameControl ?? null),
      composure:   input.noShow ? null : (input.composure   ?? null),
      attitude:    input.noShow ? null : (input.attitude    ?? null),
      comments: input.comments ?? null,
    },
  });
}

// ─── Umpire → Manager ratings ─────────────────────────────────────────────────

export async function submitUmpireRating(
  orgId: string,
  submissionId: string,
  umpireId: string,
  input: CreateUmpireRatingInput,
) {
  const submission = await assertSubmissionBelongsToOrg(submissionId, orgId);
  await assertSubmissionOpen(submission.status);

  const isAssigned = await prisma.gameUmpire.findFirst({
    where: { gameId: submission.gameId, userId: umpireId },
  });
  if (!isAssigned) forbidden('You are not an assigned umpire for this game');

  const managerAssigned = await prisma.gameManager.findFirst({
    where: { gameId: submission.gameId, userId: input.managerId },
  });
  if (!managerAssigned) badRequest('The specified manager is not assigned to this game');

  const existing = await prisma.umpireManagerRating.findFirst({
    where: { submissionId, umpireId, managerId: input.managerId },
  });
  if (existing) conflict('You have already rated this manager for this submission. Use PATCH to update.');

  return prisma.umpireManagerRating.create({
    data: {
      submissionId,
      umpireId,
      managerId: input.managerId,
      noShow: input.noShow,
      sportsmanship: input.noShow ? null : (input.sportsmanship ?? null),
      cooperation: input.noShow ? null : (input.cooperation ?? null),
      comments: input.comments ?? null,
    },
  });
}

export async function updateUmpireRating(
  orgId: string,
  submissionId: string,
  umpireId: string,
  managerId: string,
  input: UpdateUmpireRatingInput,
) {
  const submission = await assertSubmissionBelongsToOrg(submissionId, orgId);
  await assertSubmissionOpen(submission.status);

  const existing = await prisma.umpireManagerRating.findFirst({
    where: { submissionId, umpireId, managerId },
  });
  if (!existing) notFound('Umpire rating');

  return prisma.umpireManagerRating.update({
    where: { id: existing.id },
    data: {
      noShow: input.noShow,
      sportsmanship: input.noShow ? null : (input.sportsmanship ?? null),
      cooperation: input.noShow ? null : (input.cooperation ?? null),
      comments: input.comments ?? null,
    },
  });
}

// ─── Average calculators ──────────────────────────────────────────────────────

function computeCoachRatingAverages(
  ratings: Array<{
    noShow: boolean;
    appearance:  number | null;
    judgment:    number | null;
    mechanics:   number | null;
    gameControl: number | null;
    composure:   number | null;
    attitude:    number | null;
  }>,
) {
  const actual = ratings.filter(r => !r.noShow);
  if (actual.length === 0) return null;

  const avg = (vals: (number | null)[]) => {
    const nums = vals.filter((v): v is number => v !== null);
    return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
  };

  return {
    appearance:  avg(actual.map(r => r.appearance)),
    judgment:    avg(actual.map(r => r.judgment)),
    mechanics:   avg(actual.map(r => r.mechanics)),
    gameControl: avg(actual.map(r => r.gameControl)),
    composure:   avg(actual.map(r => r.composure)),
    attitude:    avg(actual.map(r => r.attitude)),
    noShowCount: ratings.filter(r => r.noShow).length,
    ratedCount: actual.length,
  };
}

function computeUmpireRatingAverages(
  ratings: Array<{
    noShow: boolean;
    sportsmanship: number | null;
    cooperation: number | null;
  }>,
) {
  const actual = ratings.filter(r => !r.noShow);
  if (actual.length === 0) return null;

  const avg = (vals: (number | null)[]) => {
    const nums = vals.filter((v): v is number => v !== null);
    return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
  };

  return {
    sportsmanship: avg(actual.map(r => r.sportsmanship)),
    cooperation: avg(actual.map(r => r.cooperation)),
    noShowCount: ratings.filter(r => r.noShow).length,
    ratedCount: actual.length,
  };
}
