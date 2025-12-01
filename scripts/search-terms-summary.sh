#!/bin/bash

cd server && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- npx tsx -e "
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getSearchTermStats() {
  // Get the most recent scrape job for each search term
  const recentJobs = await prisma.scrapeJob.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
    distinct: ['searchTerm'],
  });

  // Get property counts for each search term
  const propertyCountsRaw = await prisma.property.groupBy({
    by: ['searchTerm'],
    _count: { id: true },
  });

  const propertyCounts = new Map(
    propertyCountsRaw.map(pc => [pc.searchTerm, pc._count.id])
  );

  console.log('\\n╔════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                         RECENT SEARCH TERMS SUMMARY                                            ║');
  console.log('╠═══════════════════════════════════════════╦══════════════╦═══════════════╦═══════════════════╣');
  console.log('║ Search Term                               ║ Properties   ║ Status        ║ Last Updated      ║');
  console.log('╠═══════════════════════════════════════════╬══════════════╬═══════════════╬═══════════════════╣');

  for (const job of recentJobs) {
    const searchTerm = job.searchTerm.padEnd(41).substring(0, 41);
    const count = (propertyCounts.get(job.searchTerm) || 0).toString().padStart(12);
    const status = job.status.padEnd(13).substring(0, 13);
    const updated = new Date(job.completedAt || job.startedAt).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).padEnd(17);

    console.log(\`║ \${searchTerm} ║ \${count} ║ \${status} ║ \${updated} ║\`);
  }

  console.log('╚═══════════════════════════════════════════╩══════════════╩═══════════════╩═══════════════════╝');

  // Summary stats
  const totalProperties = Array.from(propertyCounts.values()).reduce((sum, count) => sum + count, 0);
  const avgProperties = recentJobs.length > 0 ? (totalProperties / recentJobs.length).toFixed(1) : '0';

  console.log(\`\\nTotal properties from these search terms: \${totalProperties}\`);
  console.log(\`Average properties per search term: \${avgProperties}\`);

  await prisma.\$disconnect();
}

getSearchTermStats().catch(console.error);
"
