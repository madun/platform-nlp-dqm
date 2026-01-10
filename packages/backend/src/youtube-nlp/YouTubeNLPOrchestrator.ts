/**
 * YouTube NLP Orchestrator
 * Coordinates NLP processing for YouTube comments
 * Reuses existing SentimentAnalyzer and KeywordExtractor from shared NLP
 */

import { ProcessedYouTubeComment } from '@prisma/client';
import prisma from '../database/connection.js';
import logger from '../config/logger.js';
import { SentimentAnalyzer } from '../nlp/SentimentAnalyzer.js';
import { KeywordExtractor } from '../nlp/KeywordExtractor.js';

export class YouTubeNLPOrchestrator {
  private sentimentAnalyzer: SentimentAnalyzer;
  private keywordExtractor: KeywordExtractor;

  constructor() {
    // Reuse existing analyzers
    this.sentimentAnalyzer = new SentimentAnalyzer();
    this.keywordExtractor = new KeywordExtractor();
  }

  /**
   * Process all pending YouTube comments
   */
  async processPendingComments(): Promise<void> {
    logger.info('Starting NLP processing for pending YouTube comments...');

    const pendingComments = await prisma.processedYouTubeComment.findMany({
      where: {
        sentimentScore: 0.0,
        sentimentLabel: 'NEUTRAL',
      },
      include: {
        rawComment: true,
      },
      take: 100,
    });

    logger.info(`Found ${pendingComments.length} pending comments`);

    if (pendingComments.length === 0) {
      logger.info('No pending comments to process');
      return;
    }

    // Process sentiment (reuse existing analyzer)
    logger.info('Processing sentiment analysis...');
    await this.analyzeBatch(pendingComments);

    // Extract keywords
    logger.info('Extracting keywords...');
    await this.extractKeywordsBatch(pendingComments);

    logger.info(`NLP processing completed for ${pendingComments.length} comments`);
  }

  /**
   * Analyze sentiment (reuse existing SentimentAnalyzer)
   */
  private async analyzeBatch(comments: ProcessedYouTubeComment[]): Promise<void> {
    for (const comment of comments) {
      try {
        // Use the generic analyzeText method which doesn't require database access
        const result = this.sentimentAnalyzer.analyzeText(
          comment.cleanedText,
          comment.normalizedText
        );

        await prisma.processedYouTubeComment.update({
          where: { id: comment.id },
          data: {
            sentimentLabel: result.label,
            sentimentScore: result.score,
            sentimentDetails: result.details as any,
            hasNutritionTerms: result.details.nutritionContext?.length > 0,
          },
        });
      } catch (error) {
        logger.error(`Error analyzing comment ${comment.id}:`, error);
      }
    }
  }

  /**
   * Extract keywords (reuse existing KeywordExtractor)
   */
  private async extractKeywordsBatch(comments: ProcessedYouTubeComment[]): Promise<void> {
    for (const comment of comments) {
      try {
        // Use the generic extractFromText method which doesn't require database access
        const keywords = this.keywordExtractor.extractFromText(comment.normalizedText);

        await prisma.processedYouTubeComment.update({
          where: { id: comment.id },
          data: {
            keywords: keywords as any,
          },
        });
      } catch (error) {
        logger.error(`Error extracting keywords for comment ${comment.id}:`, error);
      }
    }
  }

  /**
   * Update daily aggregation with YouTube data
   */
  async updateDailyAggregation(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const comments = await prisma.processedYouTubeComment.findMany({
      where: {
        processedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (comments.length === 0) {
      logger.info('No comments to aggregate for today');
      return;
    }

    const sentimentCounts = {
      POSITIVE: comments.filter((c) => c.sentimentLabel === 'POSITIVE').length,
      NEGATIVE: comments.filter((c) => c.sentimentLabel === 'NEGATIVE').length,
      NEUTRAL: comments.filter((c) => c.sentimentLabel === 'NEUTRAL').length,
      MIXED: comments.filter((c) => c.sentimentLabel === 'MIXED').length,
    };

    const avgSentimentScore =
      comments.reduce((sum, c) => sum + c.sentimentScore, 0) / comments.length;

    const dqmStats = await prisma.youTubeDqmCheck.aggregate({
      where: {
        checkedAt: { gte: today, lt: tomorrow },
      },
      _count: { id: true },
    });

    const passedDqm = await prisma.youTubeDqmCheck.count({
      where: {
        checkedAt: { gte: today, lt: tomorrow },
        passed: true,
      },
    });

    // Get top keywords
    const keywordFreq = new Map<string, number>();
    for (const comment of comments) {
      if (comment.keywords && Array.isArray(comment.keywords)) {
        for (const kw of comment.keywords as any[]) {
          const keyword = kw.keyword || kw;
          keywordFreq.set(keyword, (keywordFreq.get(keyword) || 0) + 1);
        }
      }
    }

    const topKeywords = Array.from(keywordFreq.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Upsert daily aggregation for YouTube
    await prisma.dailyAggregation.upsert({
      where: {
        date_platform: {
          date: today,
          platform: 'youtube',
        },
      },
      create: {
        date: today,
        platform: 'youtube',
        ytCommentsCollected: dqmStats._count.id,
        ytCommentsPassedDqm: passedDqm,
        ytCommentsAnalyzed: comments.length,
        sentimentPositive: sentimentCounts.POSITIVE,
        sentimentNegative: sentimentCounts.NEGATIVE,
        sentimentNeutral: sentimentCounts.NEUTRAL,
        sentimentMixed: sentimentCounts.MIXED,
        avgSentimentScore,
        topKeywords: topKeywords as any,
        tweetsScraped: 0,
        tweetsPassedDqm: 0,
        tweetsAnalyzed: 0,
      },
      update: {
        ytCommentsCollected: dqmStats._count.id,
        ytCommentsPassedDqm: passedDqm,
        ytCommentsAnalyzed: comments.length,
        sentimentPositive: sentimentCounts.POSITIVE,
        sentimentNegative: sentimentCounts.NEGATIVE,
        sentimentNeutral: sentimentCounts.NEUTRAL,
        sentimentMixed: sentimentCounts.MIXED,
        avgSentimentScore,
        topKeywords: topKeywords as any,
      },
    });

    logger.info('YouTube daily aggregation updated');
  }
}

export default YouTubeNLPOrchestrator;
