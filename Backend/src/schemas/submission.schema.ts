import { z } from 'zod';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const rating = z.number().int().min(1).max(5);

const COACH_NUMERIC = ['appearance', 'judgment', 'mechanics', 'gameControl', 'composure', 'attitude'] as const;

// ─── Submission ───────────────────────────────────────────────────────────────

export const CreateSubmissionSchema = z.object({});
export type CreateSubmissionInput = z.infer<typeof CreateSubmissionSchema>;

// ─── Coach → Umpire rating ────────────────────────────────────────────────────

const coachRatingBase = z.object({
  umpireId:   z.string().min(1),
  noShow:     z.boolean(),
  appearance: rating.optional().nullable(),
  judgment:   rating.optional().nullable(),
  mechanics:  rating.optional().nullable(),
  gameControl: rating.optional().nullable(),
  composure:  rating.optional().nullable(),
  attitude:   rating.optional().nullable(),
  comments:   z.string().max(2000).optional().nullable(),
});

function refineCoachRating<T extends Omit<z.infer<typeof coachRatingBase>, 'umpireId'> | z.infer<typeof coachRatingBase>>(
  val: T,
  ctx: z.RefinementCtx,
) {
  if ((val as { noShow: boolean }).noShow) {
    for (const field of COACH_NUMERIC) {
      if ((val as Record<string, unknown>)[field] != null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'Must be null or absent when noShow is true' });
      }
    }
  } else {
    if ((val as Record<string, unknown>).appearance == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['appearance'], message: 'Required when noShow is false' });
    }
  }
}

export const CreateCoachRatingSchema = coachRatingBase.superRefine(refineCoachRating);
export type CreateCoachRatingInput = z.infer<typeof CreateCoachRatingSchema>;

export const UpdateCoachRatingSchema = coachRatingBase.omit({ umpireId: true }).superRefine(refineCoachRating);
export type UpdateCoachRatingInput = z.infer<typeof UpdateCoachRatingSchema>;

// ─── Umpire → Manager rating ──────────────────────────────────────────────────

const umpireRatingBase = z.object({
  managerId:    z.string().min(1),
  noShow:       z.boolean(),
  sportsmanship: rating.optional().nullable(),
  cooperation:  rating.optional().nullable(),
  comments:     z.string().max(2000).optional().nullable(),
});

function refineUmpireRating<T extends Omit<z.infer<typeof umpireRatingBase>, 'managerId'> | z.infer<typeof umpireRatingBase>>(
  val: T,
  ctx: z.RefinementCtx,
) {
  if ((val as { noShow: boolean }).noShow) {
    for (const field of ['sportsmanship', 'cooperation'] as const) {
      if ((val as Record<string, unknown>)[field] != null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'Must be null or absent when noShow is true' });
      }
    }
  } else {
    if ((val as Record<string, unknown>).sportsmanship == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sportsmanship'], message: 'Required when noShow is false' });
    }
  }
}

export const CreateUmpireRatingSchema = umpireRatingBase.superRefine(refineUmpireRating);
export type CreateUmpireRatingInput = z.infer<typeof CreateUmpireRatingSchema>;

export const UpdateUmpireRatingSchema = umpireRatingBase.omit({ managerId: true }).superRefine(refineUmpireRating);
export type UpdateUmpireRatingInput = z.infer<typeof UpdateUmpireRatingSchema>;
