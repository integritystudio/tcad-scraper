#!/bin/bash

cd server && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tcad_scraper" doppler run -- npx tsx -e "
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getSearchTermStats() {
  const searchTerms = await prisma.searchTerm.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: {
      _count: {
        select: { properties: true }
      }
    }
  });

  console.log('\\n╔════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                         RECENT SEARCH TERMS SUMMARY                                            ║');
  console.log('╠═══════════════════════════════════════════╦══════════════╦═══════════════╦═══════════════════╣');
  console.log('║ Search Term                               ║ Properties   ║ Status        ║ Last Updated      ║');
  console.log('╠═══════════════════════════════════════════╬══════════════╬═══════════════╬═══════════════════╣');

  for (const term of searchTerms) {
    const searchTerm = term.term.padEnd(41).substring(0, 41);
    const count = term._count.properties.toString().padStart(12);
    const status = term.status.padEnd(13).substring(0, 13);
    const updated = new Date(term.updatedAt).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).padEnd(17);

    console.log(\`║ \${searchTerm} ║ \${count} ║ \${status} ║ \${updated} ║\`);
  }

  console.log('╚═══════════════════════════════════════════╩══════════════╩═══════════════╩═══════════════════╝');

  // Summary stats
  const totalProperties = searchTerms.reduce((sum, term) => sum + term._count.properties, 0);
  const avgProperties = (totalProperties / searchTerms.length).toFixed(1);

  console.log(\`\\nTotal properties from these search terms: \${totalProperties}\`);
  console.log(\`Average properties per search term: \${avgProperties}\`);

  await prisma.\$disconnect();
}

getSearchTermStats().catch(console.error);
"
