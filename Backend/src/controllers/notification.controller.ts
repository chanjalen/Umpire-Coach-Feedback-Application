import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import * as notificationService from '../services/notification.service';

type OrgRequest = AuthRequest & { orgMembership?: { role: string } };

const ListQuerySchema = z.object({
  status: z.enum(['PENDING', 'SENT', 'FAILED']).optional(),
  type: z.string().optional(),
  userId: z.string().optional(),
});

export async function listNotifications(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const query = ListQuerySchema.parse(req.query);
    const notifications = await notificationService.listOrgNotifications(
      req.params.orgId as string,
      query,
    );
    res.json(notifications);
  } catch (err) {
    next(err);
  }
}
