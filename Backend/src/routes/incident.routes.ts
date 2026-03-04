import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireOrgMember, requireOrgAdmin } from '../middleware/org.middleware';
import * as incidentController from '../controllers/incident.controller';

const router = Router();

router.use(authenticate);

// Any org member can file (service verifies game assignment)
router.post('/:orgId/incidents', requireOrgMember, incidentController.createIncident);

// Any org member can see incidents they personally filed
router.get('/:orgId/incidents/mine', requireOrgMember, incidentController.listMyIncidents);

// Admin only for all read/write operations
router.get('/:orgId/incidents', requireOrgAdmin, incidentController.listIncidents);
router.get('/:orgId/incidents/:incidentId', requireOrgAdmin, incidentController.getIncident);
router.patch('/:orgId/incidents/:incidentId', requireOrgAdmin, incidentController.updateIncident);
router.patch('/:orgId/incidents/:incidentId/resolve', requireOrgAdmin, incidentController.resolveIncident);
router.delete('/:orgId/incidents/:incidentId', requireOrgAdmin, incidentController.deleteIncident);

export default router;
