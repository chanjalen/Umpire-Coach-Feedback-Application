import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
});

export const updateOrgSchema = z.object({
  name: z.string().min(2).optional(),
  logoUrl: z.string().url('Must be a valid URL').optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'UMPIRE', 'MANAGER']),
});

export const createInviteSchema = z.object({
  role: z.enum(['ADMIN', 'UMPIRE', 'MANAGER']),
  email: z.string().email().optional(),
});

export const addMemberByEmailSchema = z.object({
  email: z.string().email(),
  role: z.enum(['UMPIRE', 'MANAGER']),
});

export const joinOrgSchema = z.object({
  code: z.string().min(1, 'Invite code is required'),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type AddMemberByEmailInput = z.infer<typeof addMemberByEmailSchema>;
export type JoinOrgInput = z.infer<typeof joinOrgSchema>;
