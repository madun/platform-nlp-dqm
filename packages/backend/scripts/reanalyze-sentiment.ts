import { PrismaClient } from '@prisma/client';
import { SentimentAnalyzer } from '../src/nlp/SentimentAnalyzer.js';

const prisma = new PrismaClient();
const analyzer = new SentimentAnalyzer();

async function main() {
  // Get all processed YouTube comments
  const comments = await prisma.processedYouTubeComment.findMany({
    include: {
      rawComment: {
        select: {
          text: true,
        }
      }
    }
  });

  console.log(`Re-analyzing ${comments.length} comments with updated lexicon...`);

  let posCount = 0;
  let negCount = 0;
  let neuCount = 0;
  let mixedCount = 0;

  for (const comment of comments) {
    // Re-analyze sentiment
    const result = analyzer.analyzeText(comment.cleanedText, comment.normalizedText);

    // Update in database
    await prisma.processedYouTubeComment.update({
      where: { id: comment.id },
      data: {
        sentimentLabel: result.label,
        sentimentScore: result.score,
        sentimentDetails: result.details,
      }
    });

    // Count labels
    if (result.label === 'POSITIVE') posCount++;
    else if (result.label === 'NEGATIVE') negCount++;
    else if (result.label === 'NEUTRAL') neuCount++;
    else if (result.label === 'MIXED') mixedCount++;

    // Log progress every 100 comments
    if ((posCount + negCount + neuCount + mixedCount) % 100 === 0) {
      console.log(`Processed ${posCount + negCount + neuCount + mixedCount}/${comments.length}...`);
    }
  }

  const total = posCount + negCount + neuCount + mixedCount;

  console.log('\n=== Updated Sentiment Distribution ===');
  console.log(`POSITIVE: ${posCount} (${((posCount / total) * 100).toFixed(1)}%)`);
  console.log(`NEGATIVE: ${negCount} (${((negCount / total) * 100).toFixed(1)}%)`);
  console.log(`NEUTRAL: ${neuCount} (${((neuCount / total) * 100).toFixed(1)}%)`);
  console.log(`MIXED: ${mixedCount} (${((mixedCount / total) * 100).toFixed(1)}%)`);

  // Show some samples
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
