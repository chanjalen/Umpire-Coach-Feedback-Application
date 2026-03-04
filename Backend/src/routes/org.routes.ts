import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireOrgMember, requireOrgAdmin } from '../middleware/org.middleware';
import * as orgController from '../controllers/org.controller';

const router = Router();

// All org routes require a valid JWT
router.use(authenticate);

// Create a new org — any authenticated user (no org context yet)
router.post('/', orgController.createOrg);

// Org details — any member can view
router.get('/:orgId', requireOrgMember, orgController.getOrg);

// Org stats — admin only
router.get('/:orgId/stats', requireOrgAdmin, orgController.getOrgStats);

// My ratings — any member (role-scoped in service)
router.get('/:orgId/me/ratings', requireOrgMember, orgController.getMyRatings);

// Org management — admin only
router.patch('/:orgId', requireOrgAdmin, orgController.updateOrg);
router.delete('/:orgId', requireOrgAdmin, orgController.deleteOrg);

// Member management — admin only
router.get('/:orgId/members', requireOrgAdmin, orgController.listMembers);
router.get('/:orgId/members/:userId/profile', requireOrgAdmin, orgController.getMemberProfile);
router.post('/:orgId/members', requireOrgAdmin, orgController.addMemberByEmail);
router.patch('/:orgId/members/:userId', requireOrgAdmin, orgController.updateMemberRole);
router.delete('/:orgId/members/:userId', requireOrgAdmin, orgController.removeMember);

// Invite management — admin only
router.post('/:orgId/invites', requireOrgAdmin, orgController.createInvite);
router.get('/:orgId/invites', requireOrgAdmin, orgController.listInvites);
router.delete('/:orgId/invites/:inviteId', requireOrgAdmin, orgController.revokeInvite);

// Join via code — any authenticated user (no org context yet, so no org middleware)
router.post('/join', orgController.joinOrg);

export default router;
