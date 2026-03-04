import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { createGameSchema, updateGameSchema } from '../schemas/game.schema';
import * as gameService from '../services/game.service';

type OrgRequest = AuthRequest & { orgMembership?: { role: string } };

export async function createGame(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const input = createGameSchema.parse(req.body);
    const game = await gameService.createGame(
      req.params.orgId as string,
      req.user!.userId,
      input,
    );
    res.status(201).json(game);
  } catch (err) { next(err); }
}

export async function listGames(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const games = await gameService.listGames(
      req.params.orgId as string,
      req.user!.userId,
      req.orgMembership?.role ?? 'UMPIRE',
    );
    res.json(games);
  } catch (err) { next(err); }
}

export async function getGame(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const game = await gameService.getGame(
      req.params.orgId as string,
      req.params.gameId as string,
    );
    res.json(game);
  } catch (err) { next(err); }
}

export async function updateGame(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const input = updateGameSchema.parse(req.body);
    const game = await gameService.updateGame(
      req.params.orgId as string,
      req.params.gameId as string,
      input,
    );
    res.json(game);
  } catch (err) { next(err); }
}

export async function deleteGame(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    await gameService.deleteGame(
      req.params.orgId as string,
      req.params.gameId as string,
    );
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function importRows(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'rows must be a non-empty array' });
      return;
    }
    const result = await gameService.importGamesFromRows(
      req.params.orgId as string,
      req.user!.userId,
      rows,
    );
    res.status(201).json(result);
  } catch (err) { next(err); }
}

export async function importGames(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No CSV file uploaded' });
      return;
    }
    const result = await gameService.importGamesFromCsv(
      req.params.orgId as string,
      req.user!.userId,
      req.file.buffer,
    );
    res.status(201).json(result);
  } catch (err) { next(err); }
}
