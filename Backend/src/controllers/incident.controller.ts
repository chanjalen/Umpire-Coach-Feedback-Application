import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  CreateIncidentSchema,
  UpdateIncidentSchema,
  ResolveIncidentSchema,
  ListIncidentsQuerySchema,
} from '../schemas/incident.schema';
import * as incidentService from '../services/incident.service';

type OrgRequest = AuthRequest & { orgMembership?: { role: string } };

export async function createIncident(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const input = CreateIncidentSchema.parse(req.body);
    const incident = await incidentService.createIncident(
      req.params.orgId as string,
      req.user!.userId,
      input,
    );
    res.status(201).json(incident);
  } catch (err) {
    next(err);
  }
}

export async function listMyIncidents(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const incidents = await incidentService.listMyIncidents(
      req.params.orgId as string,
      req.user!.userId,
    );
    res.json(incidents);
  } catch (err) {
    next(err);
  }
}

export async function listIncidents(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const query = ListIncidentsQuerySchema.parse(req.query);
    const incidents = await incidentService.listIncidents(
      req.params.orgId as string,
      query,
    );
    res.json(incidents);
  } catch (err) {
    next(err);
  }
}

export async function getIncident(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const incident = await incidentService.getIncident(
      req.params.orgId as string,
      req.params.incidentId as string,
    );
    res.json(incident);
  } catch (err) {
    next(err);
  }
}

export async function updateIncident(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const input = UpdateIncidentSchema.parse(req.body);
    const incident = await incidentService.updateIncident(
      req.params.orgId as string,
      req.params.incidentId as string,
      input,
    );
    res.json(incident);
  } catch (err) {
    next(err);
  }
}

export async function resolveIncident(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const input = ResolveIncidentSchema.parse(req.body);
    const incident = await incidentService.resolveIncident(
      req.params.orgId as string,
      req.params.incidentId as string,
      input,
    );
    res.json(incident);
  } catch (err) {
    next(err);
  }
}

export async function deleteIncident(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    await incidentService.deleteIncident(
      req.params.orgId as string,
      req.params.incidentId as string,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
