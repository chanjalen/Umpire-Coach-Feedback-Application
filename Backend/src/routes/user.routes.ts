import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { updateProfile, changePassword, leaveOrg } from '../controllers/user.controller';

const router = Router();

router.use(authenticate);

router.patch('/me', updateProfile);
router.patch('/me/password', changePassword);
router.delete('/me/orgs/:orgId', leaveOrg);

export default router;
