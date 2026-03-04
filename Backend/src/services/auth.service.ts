import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signToken, signEmailVerifyToken, verifyEmailVerifyToken } from '../lib/jwt';
import { sendRawEmail } from '../lib/email';
import { verificationEmail } from '../lib/emailTemplates';
import { config } from '../config';
import { RegisterInput, LoginInput } from '../schemas/auth.schema';

async function sendVerificationEmail(userId: string, email: string, firstName: string): Promise<void> {
  const token = signEmailVerifyToken(userId);
  const link  = `${config.frontendUrl}/verify-email?token=${token}`;
  await sendRawEmail({
    to: email,
    subject: 'Verify your Bluelyticsdash email address',
    html: verificationEmail({ firstName, verifyUrl: link }),
  });
}

export async function registerUser(input: RegisterInput) {
  // 1. Block duplicate emails up front — cleaner than letting the DB throw
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    const err = new Error('An account with that email already exists') as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

  // 2. Hash the password and create the user (no org yet — set up via onboarding)
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: 'UMPIRE', // default; real role is determined when joining/creating an org
    },
  });

  // 3. Send verification email (awaited so it completes before the response is sent)
  try {
    await sendVerificationEmail(user.id, user.email, input.firstName);
  } catch (err) {
    console.error('[auth] Failed to send verification email:', err);
  }

  return { message: 'Account created. Please check your email to verify your address.' };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Same error message for wrong email OR wrong password — avoids user enumeration
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    const err = new Error('Invalid email or password') as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error('Account is deactivated') as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  if (!user.emailVerifiedAt) {
    const err = Object.assign(
      new Error('Please verify your email address before signing in.'),
      { statusCode: 403, code: 'EMAIL_NOT_VERIFIED' },
    );
    throw err;
  }

  const token = signToken({ userId: user.id, role: user.role });
  return { token, user: sanitizeUser(user) };
}

export async function verifyEmail(token: string) {
  let userId: string;
  try {
    ({ userId } = verifyEmailVerifyToken(token));
  } catch {
    const err = new Error('Verification link is invalid or has expired.') as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
}

export async function resendVerification(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Don't reveal whether the email exists
  if (!user || user.emailVerifiedAt) return;

  await sendVerificationEmail(user.id, user.email, user.firstName);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      orgMemberships: { include: { org: true } },
    },
  });

  if (!user) {
    const err = new Error('User not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return sanitizeUser(user);
}

// Never send the password hash to the client
function sanitizeUser<T extends { passwordHash: string }>(user: T): Omit<T, 'passwordHash'> {
  const { passwordHash: _, ...safe } = user;
  return safe;
}
