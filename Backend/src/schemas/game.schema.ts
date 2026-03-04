import { z } from 'zod';

const umpireAssignmentSchema = z.object({
  userId: z.string(),
  position: z.enum(['plate', 'base']).default('plate'),
});

const managerAssignmentSchema = z.object({
  userId: z.string(),
  team: z.enum(['home', 'away']),
});

export const createGameSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  homeTeam: z.string().optional(),
  awayTeam: z.string().optional(),
  location: z.string().optional(),
  scheduledAt: z.string().datetime({ message: 'scheduledAt must be an ISO datetime string' }),
  sport: z.string().default('baseball'),
  level: z.string().optional(),
  notes: z.string().optional(),
  umpires: z.array(umpireAssignmentSchema).optional(),
  managers: z.array(managerAssignmentSchema).optional(),
});

export const updateGameSchema = z.object({
  title: z.string().min(1).optional(),
  homeTeam: z.string().optional(),
  awayTeam: z.string().optional(),
  location: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  sport: z.string().optional(),
  level: z.string().optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
  umpires: z.array(umpireAssignmentSchema).optional(),
  managers: z.array(managerAssignmentSchema).optional(),
});

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type UpdateGameInput = z.infer<typeof updateGameSchema>;
