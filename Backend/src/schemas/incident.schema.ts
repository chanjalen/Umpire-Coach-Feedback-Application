import { z } from 'zod';

export const CreateIncidentSchema = z.object({
  gameId:      z.string().min(1),
  subjectId:   z.string().min(1),
  title:       z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
});
export type CreateIncidentInput = z.infer<typeof CreateIncidentSchema>;

export const UpdateIncidentSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided',
});
export type UpdateIncidentInput = z.infer<typeof UpdateIncidentSchema>;

export const ResolveIncidentSchema = z.object({
  resolved: z.boolean(),
});
export type ResolveIncidentInput = z.infer<typeof ResolveIncidentSchema>;

export const ListIncidentsQuerySchema = z.object({
  subjectId: z.string().optional(),
  resolved:  z.enum(['true', 'false']).optional(),
  gameId:    z.string().optional(),
});
export type ListIncidentsQuery = z.infer<typeof ListIncidentsQuerySchema>;
