import app from './app';
import { config } from './config';
import { prisma } from './lib/prisma';
import { startCronJobs } from './lib/cron';

async function main() {
  startCronJobs();

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port} [${config.nodeEnv}]`);
  });
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
