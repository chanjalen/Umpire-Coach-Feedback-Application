import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireOrgAdmin } from '../middleware/org.middleware';
import * as notificationController from '../controllers/notification.controller';

const router = Router();

router.use(authenticate);

// Admin only — notification log is internal/sensitive
router.get('/:orgId/notifications', requireOrgAdmin, notificationController.listNotifications);

export default router;
