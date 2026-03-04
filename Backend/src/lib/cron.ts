import cron from 'node-cron';
import { prisma } from './prisma';
import { sendNotification, wasAlreadySent } from './email';
import { submissionOpenEmail, reminderDay3Email, reminderDay7Email } from './emailTemplates';
import { config } from '../config';

// ─── Auto-complete games + open submissions ────────────────────────────────────

/**
 * Every 5 min: mark SCHEDULED games as COMPLETED if scheduledAt + 1 hour has passed.
 * For each newly completed game (or any completed game without an open submission),
 * create a Submission and notify assigned umpires + managers.
 *
 * dueAt is intentionally null — no hard deadline by default.
 */
async function autoCompleteGames() {
  const now        = new Date();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // SCHEDULED → IN_PROGRESS: game has started but the 1-hour window hasn't closed yet
  const started = await prisma.game.updateMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now, gt: oneHourAgo } },
    data:  { status: 'IN_PROGRESS' },
  });
  if (started.count > 0) {
    console.log(`[cron] Marked ${started.count} game(s) as IN_PROGRESS`);
  }

  // SCHEDULED or IN_PROGRESS → COMPLETED: 1-hour window has closed
  const toComplete = await prisma.game.findMany({
    where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] }, scheduledAt: { lte: oneHourAgo } },
    select: { id: true, createdBy: true },
  });

  if (toComplete.length === 0) return;

  console.log(`[cron] Auto-completing ${toComplete.length} game(s)`);

  for (const game of toComplete) {
    try {
      await prisma.game.update({ where: { id: game.id }, data: { status: 'COMPLETED' } });
      await openSubmissionIfNeeded(game.id, game.createdBy);
    } catch (err) {
      console.error(`[cron] Failed to auto-complete game ${game.id}:`, err);
    }
  }
}

/**
 * Creates a submission for a completed game if one doesn't already exist,
 * then sends open-notification emails to all assigned umpires + managers.
 */
async function openSubmissionIfNeeded(gameId: string, createdBy: string) {
  const existingOpen = await prisma.submission.findFirst({
    where: { gameId, status: 'PENDING' },
  });
  if (existingOpen) return; // already open

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      title: true,
      umpires: { include: { user: { select: { id: true, email: true, firstName: true } } } },
      managers: { include: { user: { select: { id: true, email: true, firstName: true } } } },
    },
  });
  if (!game) return;

  const submission = await prisma.submission.create({
    data: { gameId, createdBy },
    // dueAt is null intentionally — admin sets it manually if needed
  });

  const recipients = [
    ...game.umpires.map(u => ({ id: u.user.id, email: u.user.email, firstName: u.user.firstName })),
    ...game.managers.map(m => ({ id: m.user.id, email: m.user.email, firstName: m.user.firstName })),
  ];

  for (const r of recipients) {
    const already = await wasAlreadySent(r.id, 'SUBMISSION_OPEN', submission.id);
    if (already) continue;
    sendNotification({
      userId: r.id,
      toEmail: r.email,
      type: 'SUBMISSION_OPEN',
      relatedId: submission.id,
      subject: `Ratings are now open — ${game.title}`,
      html: submissionOpenEmail({ firstName: r.firstName, gameTitle: game.title, submitUrl: `${config.frontendUrl}/` }),
    }).catch(() => {});
  }
}

// ─── Auto-close submissions past dueAt ────────────────────────────────────────

async function autoCloseSubmissions() {
  const result = await prisma.submission.updateMany({
    where: {
      status: 'PENDING',
      dueAt: { lt: new Date() },
    },
    data: { status: 'SUBMITTED', closedAt: new Date() },
  });

  if (result.count > 0) {
    console.log(`[cron] Auto-submitted ${result.count} submission(s)`);
  }
}

// ─── Day-3 and day-7 reminders ─────────────────────────────────────────────────

/**
 * For each open submission, check if 3 or 7 days have passed since it was created.
 * Send a reminder to any umpire/manager who hasn't completed their rating yet.
 * Uses wasAlreadySent to guarantee each reminder fires at most once per user per submission.
 */
async function sendScheduledReminders() {
  const now = Date.now();
  const day3 = new Date(now - 3 * 24 * 60 * 60 * 1000);
  const day7 = new Date(now - 7 * 24 * 60 * 60 * 1000);

  // Open submissions created at least 3 days ago
  const submissions = await prisma.submission.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lte: day3 },
    },
    include: {
      game: {
        select: {
          title: true,
          umpires: { include: { user: { select: { id: true, email: true, firstName: true } } } },
          managers: { include: { user: { select: { id: true, email: true, firstName: true } } } },
        },
      },
      coachRatings: { select: { coachId: true } },
      umpireRatings: { select: { umpireId: true } },
    },
  });

  for (const sub of submissions) {
    const isDay7Eligible = sub.createdAt <= day7;
    const type = isDay7Eligible ? 'SUBMISSION_REMINDER_7' : 'SUBMISSION_REMINDER_3';
    const gameTitle = sub.game.title;

    const coachesWhoSubmitted = new Set(sub.coachRatings.map(r => r.coachId));
    const umpiresWhoSubmitted = new Set(sub.umpireRatings.map(r => r.umpireId));

    const pendingManagers = sub.game.managers.filter(m => !coachesWhoSubmitted.has(m.user.id));
    const pendingUmpires = sub.game.umpires.filter(u => !umpiresWhoSubmitted.has(u.user.id));

    for (const m of pendingManagers) {
      const already = await wasAlreadySent(m.user.id, type, sub.id);
      if (already) continue;
      sendNotification({
        userId: m.user.id,
        toEmail: m.user.email,
        type,
        relatedId: sub.id,
        subject: `Reminder: please submit your ratings for ${gameTitle}`,
        html: isDay7Eligible
          ? reminderDay7Email({ firstName: m.user.firstName, gameTitle, submitUrl: `${config.frontendUrl}/` })
          : reminderDay3Email({ firstName: m.user.firstName, gameTitle, submitUrl: `${config.frontendUrl}/` }),
      }).catch(() => {});
    }

    for (const u of pendingUmpires) {
      const already = await wasAlreadySent(u.user.id, type, sub.id);
      if (already) continue;
      sendNotification({
        userId: u.user.id,
        toEmail: u.user.email,
        type,
        relatedId: sub.id,
        subject: `Reminder: please submit your ratings for ${gameTitle}`,
        html: isDay7Eligible
          ? reminderDay7Email({ firstName: u.user.firstName, gameTitle, submitUrl: `${config.frontendUrl}/` })
          : reminderDay3Email({ firstName: u.user.firstName, gameTitle, submitUrl: `${config.frontendUrl}/` }),
      }).catch(() => {});
    }
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function startCronJobs() {
  cron.schedule('*/5 * * * *', async () => {
    try { await autoCompleteGames(); } catch (err) { console.error('[cron] autoCompleteGames error:', err); }
    try { await autoCloseSubmissions(); } catch (err) { console.error('[cron] autoCloseSubmissions error:', err); }
    try { await sendScheduledReminders(); } catch (err) { console.error('[cron] sendScheduledReminders error:', err); }
  });

  console.log('[cron] Jobs registered');
}
