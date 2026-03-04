import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireOrgMember, requireOrgAdmin } from '../middleware/org.middleware';
import * as submissionController from '../controllers/submission.controller';

const router = Router();

router.use(authenticate);

// ─── Scoped under a game ──────────────────────────────────────────────────────

// Admin opens a submission manually; all members can list
router.post('/:orgId/games/:gameId/submissions', requireOrgAdmin, submissionController.openSubmission);
router.get('/:orgId/games/:gameId/submissions', requireOrgMember, submissionController.listGameSubmissions);

// ─── Scoped to a submission ───────────────────────────────────────────────────

// Any org member can view (response is role-scoped in the service)
router.get('/:orgId/submissions/:submissionId', requireOrgMember, submissionController.getSubmission);

// Admin only
router.patch('/:orgId/submissions/:submissionId/close', requireOrgAdmin, submissionController.closeSubmission);
router.post('/:orgId/submissions/:submissionId/remind', requireOrgAdmin, submissionController.sendReminder);

// ─── Coach → Umpire ratings ───────────────────────────────────────────────────
// requireOrgMember is enough here — the service verifies the user is an assigned game manager

router.post(
  '/:orgId/submissions/:submissionId/coach-ratings',
  requireOrgMember,
  submissionController.submitCoachRating,
);
router.patch(
  '/:orgId/submissions/:submissionId/coach-ratings/:umpireId',
  requireOrgMember,
  submissionController.updateCoachRating,
);

// ─── Umpire → Manager ratings ─────────────────────────────────────────────────
// requireOrgMember is enough — the service verifies the user is an assigned game umpire

router.post(
  '/:orgId/submissions/:submissionId/umpire-ratings',
  requireOrgMember,
  submissionController.submitUmpireRating,
);
router.patch(
  '/:orgId/submissions/:submissionId/umpire-ratings/:managerId',
  requireOrgMember,
  submissionController.updateUmpireRating,
);

export default router;
