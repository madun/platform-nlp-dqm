/**
 * NLP Orchestrator
 * Coordinates NLP processing (sentiment analysis, keyword extraction)
 */

import { ProcessedTweet } from '@prisma/client';
import prisma from '../database/connection.js';
import logger from '../config/logger.js';
import { SentimentAnalyzer } from './SentimentAnalyzer.js';
import { KeywordExtractor } from './KeywordExtractor.js';

export class NLPOrchestrator {
  private sentimentAnalyzer: SentimentAnalyzer;
  private keywordExtractor: KeywordExtractor;

  constructor() {
    this.sentimentAnalyzer = new SentimentAnalyzer();
    this.keywordExtractor = new KeywordExtractor();
  }

  /**
   * Process all pending tweets (sentiment + keywords)
   */
  async processPendingTweets(): Promise<void> {
    logger.info('Starting NLP processing for pending tweets...');

    // Get tweets that passed DQM but haven't been analyzed yet
    const pendingTweets = await prisma.processedTweet.findMany({
      where: {
        sentimentScore: 0.0, // Not yet analyzed
        sentimentLabel: 'NEUTRAL', // Default value
      },
      include: {
        rawTweet: true,
      },
      take: 100, // Process in batches
    });

    logger.info(`Found ${pendingTweets.length} pending tweets`);

    if (pendingTweets.length === 0) {
      logger.info('No pending tweets to process');
      return;
    }

    // Process sentiment (PRIORITY)
    logger.info('Processing sentiment analysis...');
    await this.sentimentAnalyzer.analyzeBatch(pendingTweets);

    // Extract keywords
    logger.info('Extracting keywords...');
    await this.keywordExtractor.extractBatch(pendingTweets);

    logger.info(`NLP processing completed for ${pendingTweets.length} tweets`);
  }

  /**
   * Update daily aggregation
   */
  async updateDailyAggregation(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's processed tweets
    const tweets = await prisma.processedTweet.findMany({
      where: {
        processedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (tweets.length === 0) {
      logger.info('No tweets to aggregate for today');
      return;
    }

    // Calculate sentiment counts
    const sentimentCounts = {
      POSITIVE: tweets.filter((t) => t.sentimentLabel === 'POSITIVE').length,
      NEGATIVE: tweets.filter((t) => t.sentimentLabel === 'NEGATIVE').length,
      NEUTRAL: tweets.filter((t) => t.sentimentLabel === 'NEUTRAL').length,
      MIXED: tweets.filter((t) => t.sentimentLabel === 'MIXED').length,
    };

    const avgSentimentScore =
      tweets.reduce((sum, t) => sum + t.sentimentScore, 0) / tweets.length;

    // Get raw stats
    const rawStats = await prisma.rawDqmCheck.aggregate({
      where: {
        checkedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      _count: {
        id: true,
      },
    });

    const passedDqm = await prisma.rawDqmCheck.count({
      where: {
        checkedAt: { gte: today, lt: tomorrow },
        passed: true,
      },
    });

    // Get top keywords
    const keywordExtractor = new KeywordExtractor();
    const topKeywords = await keywordExtractor.getTopKeywords(20);

    // Get top hashtags
    const rawTweets = await prisma.rawTweet.findMany({
      where: {
        scrapedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      select: { hashtags: true },
    });

    const hashtagCounts = new Map<string, number>();
    for (const tweet of rawTweets) {
      if (tweet.hashtags && Array.isArray(tweet.hashtags)) {
        for (const tag of tweet.hashtags) {
          hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
        }
      }
    }

    const topHashtags = Array.from(hashtagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Upsert daily aggregation
    await prisma.dailyAggregation.upsert({
      where: { date: today },
      create: {
        date: today,
        tweetsScraped: rawStats._count.id,
        tweetsPassedDqm: passedDqm,
        tweetsAnalyzed: tweets.length,
        sentimentPositive: sentimentCounts.POSITIVE,
        sentimentNegative: sentimentCounts.NEGATIVE,
        sentimentNeutral: sentimentCounts.NEUTRAL,
        sentimentMixed: sentimentCounts.MIXED,
        avgSentimentScore,
        topKeywords: topKeywords as any,
        topHashtags: topHashtags as any,
      },
      update: {
        tweetsScraped: rawStats._count.id,
        tweetsPassedDqm: passedDqm,
        tweetsAnalyzed: tweets.length,
        sentimentPositive: sentimentCounts.POSITIVE,
        sentimentNegative: sentimentCounts.NEGATIVE,
        sentimentNeutral: sentimentCounts.NEUTRAL,
        sentimentMixed: sentimentCounts.MIXED,
        avgSentimentScore,
        topKeywords: topKeywords as any,
        topHashtags: topHashtags as any,
      },
    });

    logger.info('Daily aggregation updated');
    logger.info(`Stats - Scraped: ${rawStats._count.id}, Passed: ${passedDqm}, Analyzed: ${tweets.length}`);
    logger.info(
      `Sentiment - Positive: ${sentimentCounts.POSITIVE}, Negative: ${sentimentCounts.NEGATIVE}, Neutral: ${sentimentCounts.NEUTRAL}`
    );
  }

  /**
   * Get sentiment trend over time
   */
  async getSentimentTrend(days: number = 7): Promise<
    Array<{
      date: string;
      positive: number;
      negative: number;
      neutral: number;
      mixed: number;
      avgScore: number;
    }>
  > {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const aggregations = await prisma.dailyAggregation.findMany({
      where: {
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    return aggregations.map((agg) => ({
      date: agg.date.toISOString().split('T')[0],
      positive: agg.sentimentPositive,
      negative: agg.sentimentNegative,
      neutral: agg.sentimentNeutral,
      mixed: agg.sentimentMixed,
      avgScore: agg.avgSentimentScore,
    }));
  }
}

export default NLPOrchestrator;
