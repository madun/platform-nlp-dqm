import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const stats = await prisma.processedYouTubeComment.groupBy({
    by: ['sentimentLabel'],
    _count: true,
    orderBy: {
      _count: {
        sentimentLabel: 'desc'
      }
    }
  });

  console.log('YouTube Comment Sentiment Distribution:');
  const total = stats.reduce((sum, s) => sum + s._count, 0);
  stats.forEach(s => {
    const pct = ((s._count / total) * 100).toFixed(1);
    console.log(`  ${s.sentimentLabel}: ${s._count} (${pct}%)`);
  });

  // Sample some comments with their labels
  const samples = await prisma.processedYouTubeComment.findMany({
    take: 10,
    orderBy: {
      processedAt: 'desc'
    },
    include: {
      rawComment: {
        select: {
          text: true,
        }
      }
    },
  });

  console.log('\nSample comments:');
  samples.forEach((s, i) => {
    const preview = s.rawComment?.text?.substring(0, 80) || '';
    const details = s.sentimentDetails as any;
    const pos = details?.positiveMatches?.length || 0;
    const neg = details?.negativeMatches?.length || 0;
    console.log(`  ${i + 1}. [${s.sentimentLabel}] (${s.sentimentScore.toFixed(2)}) pos:${pos} neg:${neg}`);
    console.log(`      "${preview}"`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
