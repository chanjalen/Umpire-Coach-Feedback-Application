import sgMail from '@sendgrid/mail';
import { config } from '../config';
import { prisma } from './prisma';

sgMail.setApiKey(config.sendgrid.apiKey);

export type NotificationType =
  | 'SUBMISSION_OPEN'
  | 'SUBMISSION_REMINDER_3'
  | 'SUBMISSION_REMINDER_7'
  | 'SUBMISSION_REMINDER_MANUAL'
  | 'INCIDENT_FILED';

interface SendNotificationOptions {
  userId: string;
  toEmail: string;
  type: NotificationType;
  relatedId: string;
  subject: string;
  html: string;
}

/**
 * Sends an email via SendGrid and logs the attempt in EmailNotification.
 * Always resolves — errors are captured in the DB record and logged, never thrown.
 */
export async function sendNotification(opts: SendNotificationOptions): Promise<void> {
  const { userId, toEmail, type, relatedId, subject, html } = opts;

  const record = await prisma.emailNotification.create({
    data: { userId, type, relatedId, subject, body: html, status: 'PENDING' },
  });

  try {
    await sgMail.send({
      to: toEmail,
      from: config.sendgrid.fromEmail,
      subject,
      html,
    });

    await prisma.emailNotification.update({
      where: { id: record.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] Failed to send "${type}" to ${toEmail}:`, message);
    await prisma.emailNotification.update({
      where: { id: record.id },
      data: { status: 'FAILED', error: message },
    });
  }
}

/**
 * Sends a one-off email directly via SendGrid (no DB log, no userId required).
 * Used for invite emails where the recipient may not have an account yet.
 */
export async function sendRawEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  try {
    await sgMail.send({ to: opts.to, from: config.sendgrid.fromEmail, subject: opts.subject, html: opts.html });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] Failed to send invite email to ${opts.to}:`, message);
  }
}

/**
 * Returns true if a notification of this type has already been sent
 * (status SENT) for the given user + submission.
 */
export async function wasAlreadySent(
  userId: string,
  type: NotificationType,
  relatedId: string,
): Promise<boolean> {
  const existing = await prisma.emailNotification.findFirst({
    where: { userId, type, relatedId, status: 'SENT' },
    select: { id: true },
  });
  return existing !== null;
}
