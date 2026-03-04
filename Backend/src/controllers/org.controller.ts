import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';

type OrgRequest = AuthRequest & { orgMembership?: { role: string } };
import {
  createOrgSchema,
  updateOrgSchema,
  updateMemberRoleSchema,
  createInviteSchema,
  addMemberByEmailSchema,
  joinOrgSchema,
} from '../schemas/org.schema';
import * as orgService from '../services/org.service';

export async function createOrg(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = createOrgSchema.parse(req.body);
    const org = await orgService.createOrg(req.user!.userId, input);
    res.status(201).json(org);
  } catch (err) { next(err); }
}

export async function getOrg(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const org = await orgService.getOrg(req.params.orgId as string);
    res.json(org);
  } catch (err) { next(err); }
}

export async function updateOrg(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = updateOrgSchema.parse(req.body);
    const org = await orgService.updateOrg(req.params.orgId as string, input);
    res.json(org);
  } catch (err) { next(err); }
}

export async function deleteOrg(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await orgService.deleteOrg(req.params.orgId as string);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function listMembers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const members = await orgService.listMembers(req.params.orgId as string);
    res.json(members);
  } catch (err) { next(err); }
}

export async function getMemberProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await orgService.getMemberProfile(
      req.params.orgId as string,
      req.params.userId as string,
    );
    res.json(profile);
  } catch (err) { next(err); }
}

export async function updateMemberRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = updateMemberRoleSchema.parse(req.body);
    const member = await orgService.updateMemberRole(req.params.orgId as string, req.params.userId as string, input);
    res.json(member);
  } catch (err) { next(err); }
}

export async function removeMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await orgService.removeMember(req.params.orgId as string, req.params.userId as string, req.user!.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function addMemberByEmail(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = addMemberByEmailSchema.parse(req.body);
    const member = await orgService.addMemberByEmail(req.params.orgId as string, input);
    res.status(201).json(member);
  } catch (err) { next(err); }
}

export async function createInvite(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = createInviteSchema.parse(req.body);
    const invite = await orgService.createInvite(req.params.orgId as string, req.user!.userId, input);
    res.status(201).json(invite);
  } catch (err) { next(err); }
}

export async function listInvites(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const invites = await orgService.listInvites(req.params.orgId as string);
    res.json(invites);
  } catch (err) { next(err); }
}

export async function revokeInvite(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await orgService.revokeInvite(req.params.orgId as string, req.params.inviteId as string);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function getMyRatings(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const data = await orgService.getMyRatings(
      req.params.orgId as string,
      req.user!.userId,
      req.orgMembership?.role ?? 'UMPIRE',
    );
    res.json(data);
  } catch (err) { next(err); }
}

export async function getOrgStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const stats = await orgService.getOrgStats(req.params.orgId as string);
    res.json(stats);
  } catch (err) { next(err); }
}

export async function joinOrg(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = joinOrgSchema.parse(req.body);
    const membership = await orgService.joinOrg(req.user!.userId, input);
    res.status(201).json(membership);
  } catch (err) { next(err); }
}
