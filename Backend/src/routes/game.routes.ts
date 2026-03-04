import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.middleware';
import { requireOrgMember, requireOrgAdmin } from '../middleware/org.middleware';
import * as gameController from '../controllers/game.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

// Import must come before /:gameId to avoid "import" being treated as a gameId param
router.post('/:orgId/games/import',      requireOrgAdmin, upload.single('file'), gameController.importGames);
router.post('/:orgId/games/import-rows', requireOrgAdmin, gameController.importRows);

// All org members can list and view games
router.get('/:orgId/games', requireOrgMember, gameController.listGames);
router.get('/:orgId/games/:gameId', requireOrgMember, gameController.getGame);

// Admin only
router.post('/:orgId/games', requireOrgAdmin, gameController.createGame);
router.patch('/:orgId/games/:gameId', requireOrgAdmin, gameController.updateGame);
router.delete('/:orgId/games/:gameId', requireOrgAdmin, gameController.deleteGame);

export default router;
