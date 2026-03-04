import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { UpdateProfileInput, ChangePasswordInput } from '../schemas/user.schema';

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatarUrl: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });
  return user;
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw Object.assign(new Error('Current password is incorrect.'), { status: 400 });
  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function leaveOrg(orgId: string, userId: string) {
  await prisma.orgMember.deleteMany({ where: { orgId, userId } });
}
