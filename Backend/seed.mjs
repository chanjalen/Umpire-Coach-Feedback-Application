/**
 * Mid-season seed script for UmpApp.
 * Run from Backend/: node seed.mjs
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  const hash = await bcrypt.hash('12345678', 10);

  // ─── Clean up existing NLLB org (cascade deletes games, members, etc.) ─────
  const existingOrg = await prisma.org.findUnique({ where: { slug: 'nllb' } });
  if (existingOrg) {
    await prisma.org.delete({ where: { id: existingOrg.id } });
    console.log('  ↩  Removed existing NLLB org');
  }

  // ─── Upsert users ─────────────────────────────────────────────────────────
  const [admin, umpire1, umpire2, manager1, manager2] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@gmail.com' },
      update: { passwordHash: hash },
      create: { email: 'admin@gmail.com', passwordHash: hash, firstName: 'Alex',   lastName: 'Bennett', role: 'ORG_ADMIN' },
    }),
    prisma.user.upsert({
      where: { email: 'umpire1@gmail.com' },
      update: { passwordHash: hash },
      create: { email: 'umpire1@gmail.com', passwordHash: hash, firstName: 'James', lastName: 'Carter', role: 'UMPIRE' },
    }),
    prisma.user.upsert({
      where: { email: 'umpire2@gmail.com' },
      update: { passwordHash: hash },
      create: { email: 'umpire2@gmail.com', passwordHash: hash, firstName: 'Maria', lastName: 'Lopez',  role: 'UMPIRE' },
    }),
    prisma.user.upsert({
      where: { email: 'manager1@gmail.com' },
      update: { passwordHash: hash },
      create: { email: 'manager1@gmail.com', passwordHash: hash, firstName: 'David',  lastName: 'Kim',    role: 'MANAGER' },
    }),
    prisma.user.upsert({
      where: { email: 'manager2@gmail.com' },
      update: { passwordHash: hash },
      create: { email: 'manager2@gmail.com', passwordHash: hash, firstName: 'Rachel', lastName: 'Nguyen', role: 'MANAGER' },
    }),
  ]);
  console.log('  ✓ Users upserted');

  // ─── Create org + memberships ──────────────────────────────────────────────
  const org = await prisma.org.create({
    data: {
      name: 'NLLB',
      slug: 'nllb',
      members: {
        create: [
          { userId: admin.id,    role: 'ADMIN'   },
          { userId: umpire1.id,  role: 'UMPIRE'  },
          { userId: umpire2.id,  role: 'UMPIRE'  },
          { userId: manager1.id, role: 'MANAGER' },
          { userId: manager2.id, role: 'MANAGER' },
        ],
      },
    },
  });
  console.log(`  ✓ Org created: ${org.name}`);

  // ─── Game fixtures ─────────────────────────────────────────────────────────
  const now = new Date();

  function daysAgo(n)   { const d = new Date(now); d.setDate(d.getDate() - n); d.setHours(18, 30, 0, 0); return d; }
  function daysAhead(n) { const d = new Date(now); d.setDate(d.getDate() + n); d.setHours(18, 30, 0, 0); return d; }

  const pastFixtures = [
    { homeTeam: 'Eagles',  awayTeam: 'Hawks',    level: 'Majors', location: 'Riverside Park — Field 1',     scheduledAt: daysAgo(28) },
    { homeTeam: 'Lions',   awayTeam: 'Tigers',   level: 'AAA',    location: 'Eastside Complex — Field 2',   scheduledAt: daysAgo(21) },
    { homeTeam: 'Bears',   awayTeam: 'Wolves',   level: 'AA',     location: 'North Diamond — Field 3',      scheduledAt: daysAgo(14) },
    { homeTeam: 'Falcons', awayTeam: 'Ravens',   level: 'Majors', location: 'Riverside Park — Field 2',     scheduledAt: daysAgo(7)  },
    { homeTeam: 'Sharks',  awayTeam: 'Dolphins', level: 'AAA',    location: 'Eastside Complex — Field 1',   scheduledAt: daysAgo(3)  },
  ];

  const futureFixtures = [
    { homeTeam: 'Eagles',  awayTeam: 'Wolves',   level: 'Majors', location: 'Riverside Park — Field 1',     scheduledAt: daysAhead(3)  },
    { homeTeam: 'Tigers',  awayTeam: 'Hawks',    level: 'AAA',    location: 'Eastside Complex — Field 2',   scheduledAt: daysAhead(7)  },
    { homeTeam: 'Bears',   awayTeam: 'Falcons',  level: 'AA',     location: 'North Diamond — Field 3',      scheduledAt: daysAhead(10) },
    { homeTeam: 'Ravens',  awayTeam: 'Lions',    level: 'Majors', location: 'Riverside Park — Field 2',     scheduledAt: daysAhead(14) },
    { homeTeam: 'Dolphins', awayTeam: 'Sharks',  level: 'AAA',    location: 'Eastside Complex — Field 1',   scheduledAt: daysAhead(21) },
  ];

  const umpireAssignment = {
    create: [
      { userId: umpire1.id, position: 'plate' },
      { userId: umpire2.id, position: 'base'  },
    ],
  };
  const managerAssignment = {
    create: [
      { userId: manager1.id, team: 'home' },
      { userId: manager2.id, team: 'away' },
    ],
  };

  // Past games (COMPLETED)
  const pastGames = [];
  for (const f of pastFixtures) {
    const game = await prisma.game.create({
      data: {
        orgId: org.id,
        createdBy: admin.id,
        title: `${f.homeTeam} vs ${f.awayTeam}`,
        ...f,
        status: 'COMPLETED',
        umpires:  umpireAssignment,
        managers: managerAssignment,
      },
    });
    pastGames.push(game);
  }
  console.log('  ✓ Past games created (5)');

  // Future games (SCHEDULED)
  for (const f of futureFixtures) {
    await prisma.game.create({
      data: {
        orgId: org.id,
        createdBy: admin.id,
        title: `${f.homeTeam} vs ${f.awayTeam}`,
        ...f,
        status: 'SCHEDULED',
        umpires:  umpireAssignment,
        managers: managerAssignment,
      },
    });
  }
  console.log('  ✓ Future games created (5)');

  // ─── Submissions + ratings for each completed game ─────────────────────────
  // Umpire 1 (James): consistently high performer (4-5 range)
  // Umpire 2 (Maria): solid but developing (3-4 range)
  // Manager 1 (David): great sportsmanship (4-5 range)
  // Manager 2 (Rachel): decent but sometimes difficult (3-4 range)

  const coachRatingsForUmpire1 = [
    { appearance: 5, judgment: 5, mechanics: 5, gameControl: 4, composure: 5, attitude: 5, comments: 'Outstanding plate work. Very professional.' },
    { appearance: 4, judgment: 5, mechanics: 5, gameControl: 5, composure: 5, attitude: 4, comments: 'Excellent call consistency throughout the game.' },
    { appearance: 5, judgment: 4, mechanics: 5, gameControl: 4, composure: 5, attitude: 5, comments: 'Great composure under pressure in extra innings.' },
    { appearance: 5, judgment: 5, mechanics: 4, gameControl: 5, composure: 4, attitude: 5, comments: null },
    { appearance: 4, judgment: 5, mechanics: 5, gameControl: 5, composure: 5, attitude: 5, comments: "One of the best umpires we've had this season." },
  ];

  const coachRatingsForUmpire2 = [
    { appearance: 3, judgment: 4, mechanics: 3, gameControl: 4, composure: 3, attitude: 4, comments: 'Decent base coverage, a few positioning issues.' },
    { appearance: 4, judgment: 3, mechanics: 4, gameControl: 3, composure: 4, attitude: 3, comments: null },
    { appearance: 3, judgment: 4, mechanics: 3, gameControl: 3, composure: 4, attitude: 4, comments: 'Needs to work on timing on swings.' },
    { appearance: 4, judgment: 4, mechanics: 3, gameControl: 4, composure: 3, attitude: 4, comments: 'Improving each week — showed good effort.' },
    { appearance: 3, judgment: 3, mechanics: 4, gameControl: 4, composure: 4, attitude: 3, comments: null },
  ];

  const umpireRatingsForManager1 = [
    { sportsmanship: 5, cooperation: 5, comments: 'Very respectful and cooperative all game.' },
    { sportsmanship: 4, cooperation: 5, comments: null },
    { sportsmanship: 5, cooperation: 4, comments: 'Great attitude throughout — kept players calm.' },
    { sportsmanship: 5, cooperation: 5, comments: null },
    { sportsmanship: 4, cooperation: 4, comments: 'Solid sportsmanship from first pitch to last.' },
  ];

  const umpireRatingsForManager2 = [
    { sportsmanship: 3, cooperation: 4, comments: 'A few complaints but handled it professionally.' },
    { sportsmanship: 4, cooperation: 3, comments: null },
    { sportsmanship: 3, cooperation: 3, comments: 'Could improve communication with officials.' },
    { sportsmanship: 4, cooperation: 4, comments: null },
    { sportsmanship: 3, cooperation: 4, comments: 'Sometimes argumentative, but within reason.' },
  ];

  for (let i = 0; i < pastGames.length; i++) {
    const game = pastGames[i];

    const submission = await prisma.submission.create({
      data: {
        gameId:    game.id,
        createdBy: admin.id,
        status:    'SUBMITTED',
        closedAt:  game.scheduledAt,
      },
    });

    // Coach → Umpire ratings (manager1 and manager2 each rate umpire1 and umpire2)
    await prisma.coachUmpireRating.createMany({
      data: [
        { submissionId: submission.id, coachId: manager1.id, umpireId: umpire1.id, ...coachRatingsForUmpire1[i] },
        { submissionId: submission.id, coachId: manager1.id, umpireId: umpire2.id, ...coachRatingsForUmpire2[i] },
        // manager2 gives slightly different scores to umpire1 (1 point lower on appearance some games)
        {
          submissionId: submission.id,
          coachId: manager2.id,
          umpireId: umpire1.id,
          appearance:  Math.max(1, coachRatingsForUmpire1[i].appearance - (i % 2)),
          judgment:    coachRatingsForUmpire1[i].judgment,
          mechanics:   coachRatingsForUmpire1[i].mechanics,
          gameControl: coachRatingsForUmpire1[i].gameControl,
          composure:   coachRatingsForUmpire1[i].composure,
          attitude:    coachRatingsForUmpire1[i].attitude,
          comments:    null,
        },
        { submissionId: submission.id, coachId: manager2.id, umpireId: umpire2.id, ...coachRatingsForUmpire2[i] },
      ],
    });

    // Umpire → Manager ratings (umpire1 and umpire2 each rate manager1 and manager2)
    await prisma.umpireManagerRating.createMany({
      data: [
        { submissionId: submission.id, umpireId: umpire1.id, managerId: manager1.id, ...umpireRatingsForManager1[i] },
        { submissionId: submission.id, umpireId: umpire1.id, managerId: manager2.id, ...umpireRatingsForManager2[i] },
        { submissionId: submission.id, umpireId: umpire2.id, managerId: manager1.id, ...umpireRatingsForManager1[i] },
        { submissionId: submission.id, umpireId: umpire2.id, managerId: manager2.id, ...umpireRatingsForManager2[i] },
      ],
    });
  }
  console.log('  ✓ Submissions & ratings created');

  // ─── Incident ─────────────────────────────────────────────────────────────
  await prisma.incident.create({
    data: {
      orgId:       org.id,
      reportedBy:  admin.id,
      subjectId:   umpire2.id,
      gameId:      pastGames[2].id,
      title:       'Disputed foul ball call — 7th inning',
      description: 'Umpire made a contested foul ball ruling in the 7th inning that reversed a would-be home run. The away team manager argued extensively and the crowd became disruptive. Situation was de-escalated without ejection but required a brief game delay.',
    },
  });
  console.log('  ✓ Incident created');

  console.log('\n✅ Seed complete!');
  console.log('──────────────────────────────────');
  console.log('  Org:       NLLB  (slug: nllb)');
  console.log('  Admin:     admin@gmail.com     / 12345678');
  console.log('  Umpire 1:  umpire1@gmail.com   / 12345678  (James Carter — high ratings)');
  console.log('  Umpire 2:  umpire2@gmail.com   / 12345678  (Maria Lopez  — mid ratings)');
  console.log('  Manager 1: manager1@gmail.com  / 12345678  (David Kim    — great sportsmanship)');
  console.log('  Manager 2: manager2@gmail.com  / 12345678  (Rachel Nguyen — solid)');
  console.log('  Games:     5 completed + 5 scheduled');
  console.log('  Ratings:   10 per umpire, 10 per manager (threshold met)');
  console.log('  Incidents: 1');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
