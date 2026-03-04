import { parse } from 'csv-parse/sync';
import { prisma } from '../lib/prisma';
import { CreateGameInput, UpdateGameInput } from '../schemas/game.schema';

// ─── Shared include shape ─────────────────────────────────────────────────────

const gameInclude = {
  umpires: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
    },
  },
  managers: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
    },
  },
  creator: { select: { id: true, firstName: true, lastName: true } },
} as const;

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createGame(orgId: string, userId: string, input: CreateGameInput) {
  const scheduledAt = new Date(input.scheduledAt);
  return prisma.game.create({
    data: {
      orgId,
      createdBy: userId,
      title: input.title,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      location: input.location,
      scheduledAt,
      status: computeGameStatus(scheduledAt),
      sport: input.sport ?? 'baseball',
      level: input.level,
      notes: input.notes,
      umpires: input.umpires?.length
        ? { create: input.umpires.map(u => ({ userId: u.userId, position: u.position })) }
        : undefined,
      managers: input.managers?.length
        ? { create: input.managers.map(m => ({ userId: m.userId, team: m.team })) }
        : undefined,
    },
    include: gameInclude,
  });
}

export async function listGames(orgId: string, userId: string, memberRole: string) {
  const scopeFilter =
    memberRole === 'UMPIRE'
      ? { umpires: { some: { userId } } }
      : memberRole === 'MANAGER'
        ? { managers: { some: { userId } } }
        : {}; // ADMIN sees all games in the org

  return prisma.game.findMany({
    where: { orgId, ...scopeFilter },
    include: gameInclude,
    orderBy: { scheduledAt: 'desc' },
  });
}

export async function getGame(orgId: string, gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: gameInclude,
  });

  if (!game || game.orgId !== orgId) notFound('Game');
  return game;
}

export async function updateGame(orgId: string, gameId: string, input: UpdateGameInput) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.orgId !== orgId) notFound('Game');

  const { umpires, managers, scheduledAt, ...rest } = input;

  return prisma.$transaction(async (tx) => {
    if (umpires !== undefined) {
      await tx.gameUmpire.deleteMany({ where: { gameId } });
      if (umpires.length > 0) {
        await tx.gameUmpire.createMany({
          data: umpires.map(u => ({ gameId, userId: u.userId, position: u.position })),
        });
      }
    }

    if (managers !== undefined) {
      await tx.gameManager.deleteMany({ where: { gameId } });
      if (managers.length > 0) {
        await tx.gameManager.createMany({
          data: managers.map(m => ({ gameId, userId: m.userId, team: m.team })),
        });
      }
    }

    return tx.game.update({
      where: { id: gameId },
      data: {
        ...rest,
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
      },
      include: gameInclude,
    });
  });
}

export async function deleteGame(orgId: string, gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.orgId !== orgId) notFound('Game');

  await prisma.game.delete({ where: { id: gameId } });
}

// ─── CSV import ───────────────────────────────────────────────────────────────

export async function importGamesFromCsv(orgId: string, userId: string, buffer: Buffer) {
  const rows: Record<string, string>[] = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const created = [];
  const warnings: string[] = [];

  for (const row of rows) {
    const dateStr = (row['Date'] ?? '').trim();
    const timeStr = (row['Time'] ?? '').trim();
    const scheduledAt = parseScheduledAt(dateStr, timeStr);

    if (!scheduledAt) {
      warnings.push(`Row skipped — could not parse date/time: "${dateStr} ${timeStr}"`);
      continue;
    }

    const locationName = (row['Location Name'] ?? '').trim();
    const field = (row['Field'] ?? '').trim();
    const location = [locationName, field].filter(Boolean).join(' — ') || undefined;

    const homeTeam = (row['Home Team'] ?? '').trim() || undefined;
    const awayTeam = (row['Away Team'] ?? '').trim() || undefined;
    const level = (row['Division Level Of Play'] ?? '').trim() || undefined;
    const title =
      homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : homeTeam ?? awayTeam ?? 'Game';

    // Resolve home/away managers by email
    const managerData: { userId: string; team: string }[] = [];

    const homeEmail = (row['Home Team Email Address'] ?? '').trim();
    if (homeEmail) {
      const user = await prisma.user.findUnique({ where: { email: homeEmail }, select: { id: true } });
      if (user) {
        managerData.push({ userId: user.id, team: 'home' });
      } else {
        warnings.push(`Home manager "${homeEmail}" not found — not assigned`);
      }
    }

    const awayEmail = (row['Away Team Email Address'] ?? '').trim();
    if (awayEmail) {
      const user = await prisma.user.findUnique({ where: { email: awayEmail }, select: { id: true } });
      if (user) {
        managerData.push({ userId: user.id, team: 'away' });
      } else {
        warnings.push(`Away manager "${awayEmail}" not found — not assigned`);
      }
    }

    // Resolve officials/umpires by name or email against org members
    const officialsStr = (row['Officials'] ?? '').trim();
    const { resolved: umpireData, warnings: officialsWarnings } = await resolveOfficials(
      orgId,
      officialsStr,
    );
    warnings.push(...officialsWarnings);

    const game = await prisma.game.create({
      data: {
        orgId,
        createdBy: userId,
        title,
        homeTeam,
        awayTeam,
        location,
        scheduledAt,
        status: computeGameStatus(scheduledAt),
        level,
        umpires: umpireData.length
          ? { create: umpireData.map((u, i) => ({ userId: u.userId, position: i === 0 ? 'plate' : 'base' })) }
          : undefined,
        managers: managerData.length
          ? { create: managerData }
          : undefined,
      },
      include: gameInclude,
    });

    created.push(game);
  }

  return { created, warnings };
}

// ─── JSON row import ──────────────────────────────────────────────────────────

interface ImportRowInput {
  date: string;
  time: string;
  location?: string;
  field?: string;
  homeTeam: string;
  homeTeamEmail: string;
  awayTeam: string;
  awayTeamEmail: string;
  umpire1Email?: string;
  umpire2Email?: string;
  umpire3Email?: string;
  level?: string;
}

export async function importGamesFromRows(orgId: string, userId: string, rows: ImportRowInput[]) {
  let created = 0;
  const warnings: string[] = [];

  for (const [idx, row] of rows.entries()) {
    const label = `Row ${idx + 1} (${row.homeTeam} vs ${row.awayTeam})`;

    const scheduledAt = parseScheduledAt(row.date?.trim() ?? '', row.time?.trim() ?? '');
    if (!scheduledAt) {
      warnings.push(`${label}: Could not parse date "${row.date}" / time "${row.time}" — skipped`);
      continue;
    }

    const location = [row.location, row.field].filter(Boolean).join(' — ') || undefined;

    // Resolve managers
    const managerData: { userId: string; team: string }[] = [];
    for (const [team, email] of [['home', row.homeTeamEmail], ['away', row.awayTeamEmail]] as const) {
      if (!email?.trim()) continue;
      const u = await prisma.user.findUnique({ where: { email: email.trim() }, select: { id: true } });
      if (u) managerData.push({ userId: u.id, team });
      else warnings.push(`${label}: ${team} manager "${email}" not found — not assigned`);
    }

    // Resolve umpires (must be org members with UMPIRE role)
    const umpireEmails = [row.umpire1Email, row.umpire2Email, row.umpire3Email]
      .filter((e): e is string => !!e?.trim());
    const umpireData: { userId: string; position: string }[] = [];
    for (const [i, email] of umpireEmails.entries()) {
      const u = await prisma.user.findFirst({
        where: { email: email.trim(), orgMemberships: { some: { orgId, role: 'UMPIRE' } } },
        select: { id: true },
      });
      if (u) umpireData.push({ userId: u.id, position: i === 0 ? 'plate' : 'base' });
      else warnings.push(`${label}: Umpire "${email}" not found in org — not assigned`);
    }

    await prisma.game.create({
      data: {
        orgId,
        createdBy: userId,
        title: `${row.homeTeam} vs ${row.awayTeam}`,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        location,
        scheduledAt,
        status: computeGameStatus(scheduledAt),
        level: row.level?.trim() || undefined,
        umpires:  umpireData.length  ? { create: umpireData  } : undefined,
        managers: managerData.length ? { create: managerData } : undefined,
      },
    });
    created++;
  }

  return { created, skipped: rows.length - created, warnings };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveOfficials(orgId: string, officialsStr: string) {
  const resolved: { userId: string }[] = [];
  const warnings: string[] = [];

  if (!officialsStr) return { resolved, warnings };

  const names = officialsStr.split(',').map(s => s.trim()).filter(Boolean);

  const orgUmpires = await prisma.orgMember.findMany({
    where: { orgId, role: 'UMPIRE' },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  for (const name of names) {
    const isEmail = name.includes('@');
    const match = isEmail
      ? orgUmpires.find(m => m.user.email.toLowerCase() === name.toLowerCase())
      : orgUmpires.find(
          m => `${m.user.firstName} ${m.user.lastName}`.toLowerCase() === name.toLowerCase(),
        );

    if (match) {
      resolved.push({ userId: match.userId });
    } else {
      warnings.push(`Official "${name}" not found in org umpires — not assigned`);
    }
  }

  return { resolved, warnings };
}

function normalizeTime(raw: string): string {
  const t = raw.trim().replace(/\s+/g, '').toUpperCase();

  // HH:MM or H:MM (24h)
  const h24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) return `${h24[1].padStart(2, '0')}:${h24[2]}:00`;

  // HH:MM:SS (24h)
  const h24s = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (h24s) return `${h24s[1].padStart(2, '0')}:${h24s[2]}:${h24s[3]}`;

  // H:MM AM/PM or HH:MM AM/PM (with or without space — already stripped)
  const h12 = t.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (h12) {
    let h = parseInt(h12[1]);
    if (h12[3] === 'AM' && h === 12) h = 0;
    if (h12[3] === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${h12[2]}:00`;
  }

  return t; // pass through and let Date constructor decide
}

function normalizeDate(raw: string): string {
  const d = raw.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

  // MM/DD/YYYY or M/D/YYYY
  const mdy = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;

  // MM-DD-YYYY or M-D-YYYY
  const mdyDash = d.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdyDash) return `${mdyDash[3]}-${mdyDash[1].padStart(2, '0')}-${mdyDash[2].padStart(2, '0')}`;

  return d;
}

function parseScheduledAt(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const isoDate = normalizeDate(dateStr);
  const isoTime = normalizeTime(timeStr);
  const dt = new Date(`${isoDate}T${isoTime}`);
  return isNaN(dt.getTime()) ? null : dt;
}

function notFound(entity: string): never {
  const err = new Error(`${entity} not found`) as Error & { statusCode: number };
  err.statusCode = 404;
  throw err;
}

/** Derive the correct GameStatus from a scheduled start time. */
function computeGameStatus(scheduledAt: Date): 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' {
  const now = Date.now();
  const start = scheduledAt.getTime();
  const end   = start + 60 * 60 * 1000; // start + 1 hour
  if (now >= end)   return 'COMPLETED';
  if (now >= start) return 'IN_PROGRESS';
  return 'SCHEDULED';
}
