import { Router } from 'express';
import { register, login, verifyEmail, resendVerification, me } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public
router.post('/register',             register);
router.post('/login',                login);
router.get('/verify-email',          verifyEmail);
router.post('/resend-verification',  resendVerification);

// Protected — token required
router.get('/me', authenticate, me);

export default router;
