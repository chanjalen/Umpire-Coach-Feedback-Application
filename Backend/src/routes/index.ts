import { Router } from 'express';
import authRouter from './auth.routes';
import orgRouter from './org.routes';
import userRouter from './user.routes';
import gameRouter from './game.routes';
import submissionRouter from './submission.routes';
import incidentRouter from './incident.routes';
import notificationRouter from './notification.routes';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRouter);
router.use('/orgs', orgRouter);
router.use('/orgs', gameRouter);
router.use('/orgs', submissionRouter);
router.use('/orgs', incidentRouter);
router.use('/orgs', notificationRouter);
router.use('/users', userRouter);

export default router;
