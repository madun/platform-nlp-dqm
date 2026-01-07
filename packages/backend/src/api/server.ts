/**
 * Fastify REST API Server
 * Provides endpoints for the frontend dashboard
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import prisma from '../database/connection.js';
import logger from '../config/logger.js';
import { scrapeConfig } from '@memphis/shared';

const fastify = Fastify({
  logger: false,
});

// Register plugins
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

// Register Swagger
await fastify.register(swagger, {
  openapi: {
    info: {
      title: 'Memphis API',
      description: 'Twitter/X Scraper with NLP & DQM for Nutrition Sentiment Analysis',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
  },
});

await fastify.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

// ========================================
// Health Check
// ========================================

fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: await prisma.$queryRaw`SELECT 1`.then(() => 'connected').catch(() => 'disconnected'),
  };
});

// ========================================
// Stats Endpoints
// ========================================

/**
 * Get daily statistics
 */
fastify.get('/api/stats/daily', async (request, reply) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await prisma.dailyAggregation.findUnique({
      where: { date: today },
    });

    if (!stats) {
      return {
        date: today.toISOString().split('T')[0],
        tweetsScraped: 0,
        tweetsPassedDqm: 0,
        tweetsAnalyzed: 0,
        sentimentPositive: 0,
        sentimentNegative: 0,
        sentimentNeutral: 0,
        sentimentMixed: 0,
        avgSentimentScore: 0,
        topKeywords: [],
        topHashtags: [],
      };
    }

    return {
      date: stats.date.toISOString().split('T')[0],
      tweetsScraped: stats.tweetsScraped,
      tweetsPassedDqm: stats.tweetsPassedDqm,
      tweetsAnalyzed: stats.tweetsAnalyzed,
      sentimentPositive: stats.sentimentPositive,
      sentimentNegative: stats.sentimentNegative,
      sentimentNeutral: stats.sentimentNeutral,
      sentimentMixed: stats.sentimentMixed,
      avgSentimentScore: stats.avgSentimentScore,
      topKeywords: stats.topKeywords || [],
      topHashtags: stats.topHashtags || [],
    };
  } catch (error) {
    logger.error('Error fetching daily stats:', error);
    reply.code(500).send({ error: 'Failed to fetch daily stats' });
  }
});

/**
 * Get stats for multiple days
 */
fastify.get('/api/stats/range', async (request, reply) => {
  try {
    const query = request.query as { days?: string };
    const days = parseInt(query.days || '7');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const stats = await prisma.dailyAggregation.findMany({
      where: {
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    return stats.map((s) => ({
      date: s.date.toISOString().split('T')[0],
      tweetsScraped: s.tweetsScraped,
      tweetsPassedDqm: s.tweetsPassedDqm,
      tweetsAnalyzed: s.tweetsAnalyzed,
      sentimentPositive: s.sentimentPositive,
      sentimentNegative: s.sentimentNegative,
      sentimentNeutral: s.sentimentNeutral,
      sentimentMixed: s.sentimentMixed,
      avgSentimentScore: s.avgSentimentScore,
    }));
  } catch (error) {
    logger.error('Error fetching stats range:', error);
    reply.code(500).send({ error: 'Failed to fetch stats range' });
  }
});

// ========================================
// Tweets Endpoints
// ========================================

/**
 * Get recent processed tweets
 */
fastify.get('/api/tweets/recent', async (request, reply) => {
  try {
    const query = request.query as { limit?: string; offset?: string; sentiment?: string };
    const limit = Math.min(parseInt(query.limit || '20'), 100);
    const offset = parseInt(query.offset || '0');
    const sentiment = query.sentiment;

    const where: any = {};
    if (sentiment) {
      where.sentimentLabel = sentiment.toUpperCase();
    }

    const tweets = await prisma.processedTweet.findMany({
      where,
      include: {
        rawTweet: true,
      },
      orderBy: { processedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.processedTweet.count({ where });

    return {
      tweets: tweets.map((t) => ({
        id: t.id,
        text: t.rawTweet.text,
        cleanedText: t.cleanedText,
        authorUsername: t.rawTweet.authorUsername,
        authorDisplayName: t.rawTweet.authorDisplayName,
        authorVerified: t.rawTweet.authorVerified,
        likes: t.rawTweet.likes,
        retweets: t.rawTweet.retweets,
        replies: t.rawTweet.replies,
        createdAt: t.rawTweet.createdAt,
        sentimentLabel: t.sentimentLabel,
        sentimentScore: t.sentimentScore,
        keywords: t.keywords,
        hashtags: t.rawTweet.hashtags,
      })),
      total,
      limit,
      offset,
    };
  } catch (error) {
    logger.error('Error fetching recent tweets:', error);
    reply.code(500).send({ error: 'Failed to fetch recent tweets' });
  }
});

/**
 * Get tweets by sentiment
 */
fastify.get('/api/tweets/sentiment/:sentiment', async (request, reply) => {
  try {
    const params = request.params as { sentiment: string };
    const query = request.query as { limit?: string };

    const limit = Math.min(parseInt(query.limit || '20'), 100);

    const tweets = await prisma.processedTweet.findMany({
      where: {
        sentimentLabel: params.sentiment.toUpperCase(),
      },
      include: {
        rawTweet: true,
      },
      orderBy: { processedAt: 'desc' },
      take: limit,
    });

    const total = await prisma.processedTweet.count({
      where: {
        sentimentLabel: params.sentiment.toUpperCase() as any,
      },
    });

    return {
      tweets: tweets.map((t) => ({
        id: t.id,
        text: t.rawTweet.text,
        cleanedText: t.cleanedText,
        authorUsername: t.rawTweet.authorUsername,
        authorDisplayName: t.rawTweet.authorDisplayName,
        sentimentLabel: t.sentimentLabel,
        sentimentScore: t.sentimentScore,
        keywords: t.keywords,
        createdAt: t.rawTweet.createdAt,
      })),
      total,
      limit,
      offset: 0,
    };
  } catch (error) {
    logger.error('Error fetching tweets by sentiment:', error);
    reply.code(500).send({ error: 'Failed to fetch tweets' });
  }
});

// ========================================
// Analytics Endpoints
// ========================================

/**
 * Get sentiment trend
 */
fastify.get('/api/analytics/sentiment-trend', async (request, reply) => {
  try {
    const query = request.query as { days?: string };
    const days = parseInt(query.days || '7');

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
  } catch (error) {
    logger.error('Error fetching sentiment trend:', error);
    reply.code(500).send({ error: 'Failed to fetch sentiment trend' });
  }
});

/**
 * Get top keywords
 */
fastify.get('/api/analytics/top-keywords', async (request, reply) => {
  try {
    const query = request.query as { limit?: string };
    const limit = parseInt(query.limit || '50');

    const tweets = await prisma.processedTweet.findMany({
      where: {
        keywords: { not: null },
      },
      select: { keywords: true },
    });

    const keywordFreq = new Map<string, number>();

    for (const tweet of tweets) {
      if (tweet.keywords && Array.isArray(tweet.keywords)) {
        for (const kw of tweet.keywords as any[]) {
          const keyword = kw.keyword || kw;
          keywordFreq.set(keyword, (keywordFreq.get(keyword) || 0) + 1);
        }
      }
    }

    const result = Array.from(keywordFreq.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return result;
  } catch (error) {
    logger.error('Error fetching top keywords:', error);
    reply.code(500).send({ error: 'Failed to fetch top keywords' });
  }
});

// ========================================
// Scraper Endpoints
// ========================================

/**
 * Get scraper runs
 */
fastify.get('/api/scraper/runs', async (request, reply) => {
  try {
    const query = request.query as { limit?: string };
    const limit = parseInt(query.limit || '10');

    const runs = await prisma.scraperRun.findMany({
      orderBy: { startTime: 'desc' },
      take: limit,
    });

    return runs.map((r) => ({
      id: r.id,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      tweetsFound: r.tweetsFound,
      tweetsScraped: r.tweetsScraped,
      tweetsPassedDqm: r.tweetsPassedDqm,
      keywords: r.keywords,
      errorMessage: r.errorMessage,
    }));
  } catch (error) {
    logger.error('Error fetching scraper runs:', error);
    reply.code(500).send({ error: 'Failed to fetch scraper runs' });
  }
});

/**
 * Get configuration
 */
fastify.get('/api/config', async (request, reply) => {
  return {
    targetTweetsPerDay: scrapeConfig.TARGET_TWEETS_PER_DAY,
    tweetsPerKeyword: scrapeConfig.TWEETS_PER_KEYWORD,
    scrapeIntervalHours: 6,
    qualityThreshold: scrapeConfig.QUALITY_THRESHOLD,
    searchKeywords: [
      'gizi',
      'ketahanan pangan',
      'stunting',
      'malnutrisi',
      'Makan Bergizi Gratis',
      'MBG',
      'mbg',
      'Makan Siang Gratis',
    ],
  };
});

// ========================================
// Start Server
// ========================================

const PORT = parseInt(process.env.PORT || '3001');

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`Server is running on http://localhost:${PORT}`);
    logger.info(`API documentation available at http://localhost:${PORT}/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Start if not in test mode
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { fastify, start };
export default fastify;
