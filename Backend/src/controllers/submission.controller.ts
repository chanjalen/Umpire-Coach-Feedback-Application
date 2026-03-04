import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  CreateCoachRatingSchema,
  UpdateCoachRatingSchema,
  CreateUmpireRatingSchema,
  UpdateUmpireRatingSchema,
} from '../schemas/submission.schema';
import * as submissionService from '../services/submission.service';

type OrgRequest = AuthRequest & { orgMembership?: { role: string } };

// ─── Submissions ──────────────────────────────────────────────────────────────

export async function openSubmission(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const submission = await submissionService.openSubmission(
      req.params.orgId as string,
      req.params.gameId as string,
      req.user!.userId,
    );
    res.status(201).json(submission);
  } catch (err) {
    next(err);
  }
}

export async function listGameSubmissions(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const submissions = await submissionService.listGameSubmissions(
      req.params.orgId as string,
      req.params.gameId as string,
      req.user!.userId,
      req.orgMembership?.role ?? 'UMPIRE',
    );
    res.json(submissions);
  } catch (err) {
    next(err);
  }
}

export async function getSubmission(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const submission = await submissionService.getSubmission(
      req.params.orgId as string,
      req.params.submissionId as string,
      req.user!.userId,
      req.orgMembership?.role ?? 'UMPIRE',
    );
    res.json(submission);
  } catch (err) {
    next(err);
  }
}

export async function closeSubmission(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const submission = await submissionService.closeSubmission(
      req.params.orgId as string,
      req.params.submissionId as string,
    );
    res.json(submission);
  } catch (err) {
    next(err);
  }
}

export async function sendReminder(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const result = await submissionService.sendReminder(
      req.params.orgId as string,
      req.params.submissionId as string,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Coach ratings ────────────────────────────────────────────────────────────

export async function submitCoachRating(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const input = CreateCoachRatingSchema.parse(req.body);
    const rating = await submissionService.submitCoachRating(
      req.params.orgId as string,
      req.params.submissionId as string,
      req.user!.userId,
      input,
    );
    res.status(201).json(rating);
  } catch (err) {
    next(err);
  }
}

export async function updateCoachRating(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const input = UpdateCoachRatingSchema.parse(req.body);
    const rating = await submissionService.updateCoachRating(
      req.params.orgId as string,
      req.params.submissionId as string,
      req.user!.userId,
      req.params.umpireId as string,
      input,
    );
    res.json(rating);
  } catch (err) {
    next(err);
  }
}

// ─── Umpire ratings ───────────────────────────────────────────────────────────

export async function submitUmpireRating(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const input = CreateUmpireRatingSchema.parse(req.body);
    const rating = await submissionService.submitUmpireRating(
      req.params.orgId as string,
      req.params.submissionId as string,
      req.user!.userId,
      input,
    );
    res.status(201).json(rating);
  } catch (err) {
    next(err);
  }
}

export async function updateUmpireRating(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const input = UpdateUmpireRatingSchema.parse(req.body);
    const rating = await submissionService.updateUmpireRating(
      req.params.orgId as string,
      req.params.submissionId as string,
      req.user!.userId,
      req.params.managerId as string,
      input,
    );
    res.json(rating);
  } catch (err) {
    next(err);
  }
}
