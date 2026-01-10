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
// Stats Endpoints (Multi-platform)
// ========================================

/**
 * Get daily statistics with platform filter
 */
fastify.get('/api/stats/daily', async (request, reply) => {
  try {
    const query = request.query as { platform?: string };
    const platform = query.platform || 'all';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If platform is 'all', fetch both Twitter and YouTube stats
    if (platform === 'all') {
      const [twitterStats, youtubeStats] = await Promise.all([
        prisma.dailyAggregation.findFirst({
          where: { date: today, platform: 'twitter' },
        }),
        prisma.dailyAggregation.findFirst({
          where: { date: today, platform: 'youtube' },
        }),
      ]);

      const combined = {
        date: today.toISOString().split('T')[0],
        platform: 'all',
        twitter: twitterStats || {
          date: today.toISOString().split('T')[0],
          platform: 'twitter',
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
        },
        youtube: youtubeStats || {
          date: today.toISOString().split('T')[0],
          platform: 'youtube',
          ytCommentsCollected: 0,
          ytCommentsPassedDqm: 0,
          ytCommentsAnalyzed: 0,
          sentimentPositive: 0,
          sentimentNegative: 0,
          sentimentNeutral: 0,
          sentimentMixed: 0,
          avgSentimentScore: 0,
          topKeywords: [],
        },
        combined: {
          tweetsScraped: (twitterStats?.tweetsScraped || 0),
          tweetsPassedDqm: (twitterStats?.tweetsPassedDqm || 0),
          tweetsAnalyzed: (twitterStats?.tweetsAnalyzed || 0),
          ytCommentsCollected: (youtubeStats?.ytCommentsCollected || 0),
          ytCommentsPassedDqm: (youtubeStats?.ytCommentsPassedDqm || 0),
          ytCommentsAnalyzed: (youtubeStats?.ytCommentsAnalyzed || 0),
          sentimentPositive: (twitterStats?.sentimentPositive || 0) + (youtubeStats?.sentimentPositive || 0),
          sentimentNegative: (twitterStats?.sentimentNegative || 0) + (youtubeStats?.sentimentNegative || 0),
          sentimentNeutral: (twitterStats?.sentimentNeutral || 0) + (youtubeStats?.sentimentNeutral || 0),
          sentimentMixed: (twitterStats?.sentimentMixed || 0) + (youtubeStats?.sentimentMixed || 0),
          avgSentimentScore: ((twitterStats?.avgSentimentScore || 0) * (twitterStats?.tweetsAnalyzed || 0) +
                              (youtubeStats?.avgSentimentScore || 0) * (youtubeStats?.ytCommentsAnalyzed || 0)) /
                             ((twitterStats?.tweetsAnalyzed || 0) + (youtubeStats?.ytCommentsAnalyzed || 0) || 1),
          topKeywords: twitterStats?.topKeywords || [],
          topHashtags: twitterStats?.topHashtags || [],
        },
      };
      return combined;
    }

    // Single platform
    const stats = await prisma.dailyAggregation.findFirst({
      where: { date: today, platform },
    });

    if (!stats) {
      return {
        date: today.toISOString().split('T')[0],
        platform,
        tweetsScraped: 0,
        tweetsPassedDqm: 0,
        tweetsAnalyzed: 0,
        ytCommentsCollected: 0,
        ytCommentsPassedDqm: 0,
        ytCommentsAnalyzed: 0,
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
      platform: stats.platform,
      tweetsScraped: stats.tweetsScraped,
      tweetsPassedDqm: stats.tweetsPassedDqm,
      tweetsAnalyzed: stats.tweetsAnalyzed,
      ytCommentsCollected: stats.ytCommentsCollected,
      ytCommentsPassedDqm: stats.ytCommentsPassedDqm,
      ytCommentsAnalyzed: stats.ytCommentsAnalyzed,
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
// YouTube Comments Endpoints
// ========================================

/**
 * Get recent processed YouTube comments
 */
fastify.get('/api/youtube/comments/recent', async (request, reply) => {
  try {
    const query = request.query as { limit?: string; offset?: string; sentiment?: string };
    const limit = Math.min(parseInt(query.limit || '20'), 100);
    const offset = parseInt(query.offset || '0');
    const sentiment = query.sentiment;

    const where: any = {};
    if (sentiment) {
      where.sentimentLabel = sentiment.toUpperCase();
    }

    const comments = await prisma.processedYouTubeComment.findMany({
      where,
      include: {
        rawComment: true,
      },
      orderBy: { processedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.processedYouTubeComment.count({ where });

    return {
      comments: comments.map((c) => ({
        id: c.id,
        text: c.rawComment.text,
        cleanedText: c.cleanedText,
        authorDisplayName: c.rawComment.authorDisplayName,
        authorChannelId: c.rawComment.authorChannelId,
        likeCount: c.rawComment.likeCount,
        replyCount: c.rawComment.replyCount,
        videoId: c.rawComment.videoId,
        videoTitle: c.rawComment.videoTitle,
        videoChannelId: c.rawComment.videoChannelId,
        videoChannelTitle: c.rawComment.videoChannelTitle,
        publishedAt: c.rawComment.publishedAt,
        sentimentLabel: c.sentimentLabel,
        sentimentScore: c.sentimentScore,
        keywords: c.keywords,
      })),
      total,
      limit,
      offset,
    };
  } catch (error) {
    logger.error('Error fetching recent YouTube comments:', error);
    reply.code(500).send({ error: 'Failed to fetch recent comments' });
  }
});

/**
 * Get YouTube comments by sentiment
 */
fastify.get('/api/youtube/comments/sentiment/:sentiment', async (request, reply) => {
  try {
    const params = request.params as { sentiment: string };
    const query = request.query as { limit?: string };

    const limit = Math.min(parseInt(query.limit || '20'), 100);

    const comments = await prisma.processedYouTubeComment.findMany({
      where: {
        sentimentLabel: params.sentiment.toUpperCase(),
      },
      include: {
        rawComment: true,
      },
      orderBy: { processedAt: 'desc' },
      take: limit,
    });

    const total = await prisma.processedYouTubeComment.count({
      where: {
        sentimentLabel: params.sentiment.toUpperCase() as any,
      },
    });

    return {
      comments: comments.map((c) => ({
        id: c.id,
        text: c.rawComment.text,
        cleanedText: c.cleanedText,
        authorDisplayName: c.rawComment.authorDisplayName,
        sentimentLabel: c.sentimentLabel,
        sentimentScore: c.sentimentScore,
        keywords: c.keywords,
        videoTitle: c.rawComment.videoTitle,
        publishedAt: c.rawComment.publishedAt,
      })),
      total,
      limit,
      offset: 0,
    };
  } catch (error) {
    logger.error('Error fetching YouTube comments by sentiment:', error);
    reply.code(500).send({ error: 'Failed to fetch comments' });
  }
});

/**
 * Get YouTube collector runs
 */
fastify.get('/api/youtube/collector/runs', async (request, reply) => {
  try {
    const query = request.query as { limit?: string };
    const limit = parseInt(query.limit || '10');

    const runs = await prisma.youTubeCollectorRun.findMany({
      orderBy: { startTime: 'desc' },
      take: limit,
    });

    return runs.map((r) => ({
      id: r.id,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      commentsFound: r.commentsFound,
      commentsCollected: r.commentsCollected,
      commentsPassedDqm: r.commentsPassedDqm,
      videoIds: r.videoIds,
      quotaUsed: r.quotaUsed,
      quotaRemaining: r.quotaRemaining,
      errorMessage: r.errorMessage,
    }));
  } catch (error) {
    logger.error('Error fetching YouTube collector runs:', error);
    reply.code(500).send({ error: 'Failed to fetch collector runs' });
  }
});

/**
 * Get YouTube whitelist
 */
fastify.get('/api/youtube/whitelist', async (request, reply) => {
  try {
    const query = request.query as { type?: string };
    const targetType = query.type;

    const where: any = { isActive: true };
    if (targetType && ['video', 'channel'].includes(targetType)) {
      where.targetType = targetType;
    }

    const items = await prisma.youTubeWhitelist.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    return items;
  } catch (error) {
    logger.error('Error fetching YouTube whitelist:', error);
    reply.code(500).send({ error: 'Failed to fetch whitelist' });
  }
});

/**
 * Add to YouTube whitelist
 */
fastify.post('/api/youtube/whitelist', async (request, reply) => {
  try {
    const body = request.body as {
      targetType: 'video' | 'channel';
      targetId: string;
      title?: string;
      priority?: number;
      maxComments?: number;
      notes?: string;
    };

    const item = await prisma.youTubeWhitelist.create({
      data: body,
    });

    return item;
  } catch (error) {
    logger.error('Error adding to YouTube whitelist:', error);
    reply.code(500).send({ error: 'Failed to add to whitelist' });
  }
});

/**
 * Remove from YouTube whitelist (soft delete)
 */
fastify.delete<{ Params: { id: string } }>('/api/youtube/whitelist/:id', async (request, reply) => {
  try {
    const params = request.params as { id: string };

    await prisma.youTubeWhitelist.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return { success: true };
  } catch (error) {
    logger.error('Error removing from YouTube whitelist:', error);
    reply.code(500).send({ error: 'Failed to remove from whitelist' });
  }
});

// ========================================
// Analytics Endpoints
// ========================================

/**
 * Get sentiment trend with platform filter
 */
fastify.get('/api/analytics/sentiment-trend', async (request, reply) => {
  try {
    const query = request.query as { days?: string; platform?: string };
    const days = parseInt(query.days || '7');
    const platform = query.platform || 'all';

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const where: any = { date: { gte: startDate } };
    if (platform !== 'all') {
      where.platform = platform;
    }

    const aggregations = await prisma.dailyAggregation.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    if (platform === 'all') {
      // Group by date and combine platforms
      const grouped = new Map<string, any>();

      for (const agg of aggregations) {
        const dateKey = agg.date.toISOString().split('T')[0];
        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, {
            date: dateKey,
            twitter: null,
            youtube: null,
          });
        }
        const entry = grouped.get(dateKey);
        if (agg.platform === 'twitter') entry.twitter = agg;
        if (agg.platform === 'youtube') entry.youtube = agg;
      }

      return Array.from(grouped.values()).map((entry) => {
        const twitter = entry.twitter || { sentimentPositive: 0, sentimentNegative: 0, sentimentNeutral: 0, sentimentMixed: 0, avgSentimentScore: 0, tweetsAnalyzed: 0 };
        const youtube = entry.youtube || { sentimentPositive: 0, sentimentNegative: 0, sentimentNeutral: 0, sentimentMixed: 0, avgSentimentScore: 0, ytCommentsAnalyzed: 0 };

        const totalAnalyzed = (twitter.tweetsAnalyzed || 0) + (youtube.ytCommentsAnalyzed || 0);

        return {
          date: entry.date,
          positive: (twitter.sentimentPositive || 0) + (youtube.sentimentPositive || 0),
          negative: (twitter.sentimentNegative || 0) + (youtube.sentimentNegative || 0),
          neutral: (twitter.sentimentNeutral || 0) + (youtube.sentimentNeutral || 0),
          mixed: (twitter.sentimentMixed || 0) + (youtube.sentimentMixed || 0),
          avgScore: totalAnalyzed > 0
            ? ((twitter.avgSentimentScore || 0) * (twitter.tweetsAnalyzed || 0) +
                (youtube.avgSentimentScore || 0) * (youtube.ytCommentsAnalyzed || 0)) /
                totalAnalyzed
            : 0,
        };
      });
    }

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
