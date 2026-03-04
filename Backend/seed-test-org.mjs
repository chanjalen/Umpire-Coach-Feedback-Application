/**
 * Adds a "Test" org and makes admin@gmail.com an UMPIRE member of it.
 * Run from Backend/: node seed-test-org.mjs
 */

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  // Find the admin user
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@gmail.com' } });

  // Remove existing "test" org if it exists so this is idempotent
  const existing = await prisma.org.findUnique({ where: { slug: 'test' } });
  if (existing) {
    await prisma.org.delete({ where: { id: existing.id } });
    console.log('  ↩  Removed existing Test org');
  }

  // Create the org and add admin as UMPIRE
  const org = await prisma.org.create({
    data: {
      name: 'Test',
      slug: 'test',
      members: {
        create: [{ userId: admin.id, role: 'UMPIRE' }],
      },
    },
  });

  console.log(`✅ Created org "${org.name}" — admin@gmail.com joined as UMPIRE`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
