import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { updateProfileSchema, changePasswordSchema } from '../schemas/user.schema';
import * as userService from '../services/user.service';

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = updateProfileSchema.parse(req.body);
    const user = await userService.updateProfile(req.user!.userId, input);
    res.json(user);
  } catch (err) { next(err); }
}

export async function changePassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = changePasswordSchema.parse(req.body);
    await userService.changePassword(req.user!.userId, input);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function leaveOrg(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await userService.leaveOrg(req.params.orgId as string, req.user!.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
}
