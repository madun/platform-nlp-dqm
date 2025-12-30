/**
 * Data Quality Management Service
 * Validates and filters scraped tweets
 */

import { RawTweet, Prisma } from '@prisma/client';
import prisma from '../database/connection.js';
import logger from '../config/logger.js';
import { scrapeConfig } from '@memphis/shared';

export interface DQMResult {
  passed: boolean;
  score: number;
  checks: {
    isDuplicate: boolean;
    isLanguageValid: boolean;
    isMinLength: boolean;
    isMaxLength: boolean;
    isBot: boolean;
    hasValidUrls: boolean;
    hasValidMentions: boolean;
  };
  reason?: string;
}

export class DQMService {
  // Bot detection patterns
  private readonly BOT_PATTERNS = [
    /bot\d*$/i,
    /_bot_/i,
    /^auto/i,
    /@.*@.*\./i, // email-like usernames
    /\d{5,}$/, // usernames ending in many numbers
  ];

  // Spam patterns
  private readonly SPAM_PATTERNS = [
    /(buy|get|free).{0,20}(follower|like|retweet)/i,
    /https?:\/\/\S{20,}/, // Very long URLs
    /\.{4,}/, // Multiple dots
    /^(.)\1{10,}/, // Repeated characters
  ];

  // Indonesian language markers
  private readonly INDONESIAN_MARKERS = [
    'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'adalah',
    'ini', 'itu', 'juga', 'atau', 'karena', 'tapi', 'kalau',
    'yg', 'dgn', 'utk', 'jg', 'krn', 'tp', 'kl'
  ];

  // English markers (to detect non-Indonesian content)
  private readonly ENGLISH_MARKERS = [
    'the', 'and', 'is', 'to', 'of', 'in', 'for', 'with', 'this',
    'that', 'are', 'was', 'were', 'been', 'being'
  ];

  /**
   * Check tweet quality
   */
  async checkTweet(tweet: RawTweet): Promise<DQMResult> {
    const checks = {
      isDuplicate: await this.checkDuplicate(tweet),
      isLanguageValid: this.checkLanguage(tweet),
      isMinLength: this.checkMinLength(tweet),
      isMaxLength: this.checkMaxLength(tweet),
      isBot: this.checkBot(tweet),
      hasValidUrls: this.checkUrls(tweet),
      hasValidMentions: this.checkMentions(tweet),
    };

    // Calculate quality score
    const score = this.calculateQualityScore(checks);
    const passed = score >= scrapeConfig.QUALITY_THRESHOLD && checks.isLanguageValid;

    const result: DQMResult = {
      passed,
      score,
      checks,
      reason: !passed ? this.getFailureReason(checks, score) : undefined,
    };

    // Save DQM check result
    await prisma.rawDqmCheck.create({
      data: {
        rawTweetId: tweet.id,
        isDuplicate: checks.isDuplicate,
        isLanguageValid: checks.isLanguageValid,
        isMinLength: checks.isMinLength,
        isMaxLength: checks.isMaxLength,
        isBot: checks.isBot,
        hasUrl: checks.hasValidUrls,
        hasMention: checks.hasValidMentions,
        qualityScore: score,
        passed,
      },
    });

    // If passed, create ProcessedTweet for NLP
    if (passed) {
      await this.createProcessedTweet(tweet, result);
    }

    return result;
  }

  /**
   * Check for duplicate content
   */
  private async checkDuplicate(tweet: RawTweet): Promise<boolean> {
    // Check exact duplicate by tweetId (already unique in DB)
    // Check for near-duplicate by text similarity
    const textPrefix = tweet.text.slice(0, 50);

    const similarCount = await prisma.rawTweet.count({
      where: {
        text: { contains: textPrefix },
        id: { not: tweet.id },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    });

    return similarCount > 0;
  }

  /**
   * Check if tweet is in Indonesian
   */
  private checkLanguage(tweet: RawTweet): boolean {
    const text = tweet.text.toLowerCase();
    const words = text.split(/\s+/);

    // Count markers
    const indoCount = words.filter((w) => this.INDONESIAN_MARKERS.includes(w)).length;
    const engCount = words.filter((w) => this.ENGLISH_MARKERS.includes(w)).length;

    // Must have more Indonesian markers than English
    return indoCount >= engCount;
  }

  /**
   * Check minimum length
   */
  private checkMinLength(tweet: RawTweet): boolean {
    const length = tweet.text.length;
    return length >= scrapeConfig.MIN_TWEET_LENGTH && length > 0;
  }

  /**
   * Check maximum length
   */
  private checkMaxLength(tweet: RawTweet): boolean {
    return tweet.text.length <= scrapeConfig.MAX_TWEET_LENGTH;
  }

  /**
   * Check if account is likely a bot
   */
  private checkBot(tweet: RawTweet): boolean {
    // Check username patterns
    for (const pattern of this.BOT_PATTERNS) {
      if (pattern.test(tweet.authorUsername)) {
        return true;
      }
    }

    // Check if follower/following ratio is suspicious
    // (not available without clicking profile, skip for now)

    // Check for spam patterns in text
    for (const pattern of this.SPAM_PATTERNS) {
      if (pattern.test(tweet.text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check URL count
   */
  private checkUrls(tweet: RawTweet): boolean {
    const urlCount = (tweet.text.match(/https?:\/\//g) || []).length;
    return urlCount <= scrapeConfig.MAX_URLS;
  }

  /**
   * Check mention count
   */
  private checkMentions(tweet: RawTweet): boolean {
    const mentionCount = (tweet.text.match(/@/g) || []).length;
    return mentionCount <= scrapeConfig.MAX_MENTIONS;
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(checks: {
    isDuplicate: boolean;
    isLanguageValid: boolean;
    isMinLength: boolean;
    isMaxLength: boolean;
    isBot: boolean;
    hasValidUrls: boolean;
    hasValidMentions: boolean;
  }): number {
    let score = 1.0;

    // Penalize each failed check
    if (checks.isDuplicate) score -= 0.5;
    if (!checks.isLanguageValid) score -= 0.4;
    if (!checks.isMinLength) score -= 0.2;
    if (!checks.isMaxLength) score -= 0.1;
    if (checks.isBot) score -= 0.6;
    if (!checks.hasValidUrls) score -= 0.1;
    if (!checks.hasValidMentions) score -= 0.1;

    return Math.max(0, score);
  }

  /**
   * Get failure reason
   */
  private getFailureReason(
    checks: any,
    score: number
  ): string {
    if (checks.isDuplicate) return 'Duplicate tweet detected';
    if (!checks.isLanguageValid) return 'Invalid language (not Indonesian)';
    if (checks.isBot) return 'Bot or spam detected';
    if (!checks.isMinLength) return 'Tweet too short';
    if (score < scrapeConfig.QUALITY_THRESHOLD)
      return `Quality score ${score.toFixed(2)} below threshold ${scrapeConfig.QUALITY_THRESHOLD}`;
    return 'Unknown quality issue';
  }

  /**
   * Create ProcessedTweet for NLP processing
   */
  private async createProcessedTweet(
    tweet: RawTweet,
    dqmResult: DQMResult
  ): Promise<void> {
    const cleanedText = this.cleanText(tweet.text);
    const normalizedText = this.normalizeText(cleanedText);

    await prisma.processedTweet.create({
      data: {
        rawTweetId: tweet.id,
        cleanedText,
        normalizedText,
        sentimentLabel: 'NEUTRAL',
        sentimentScore: 0.0,
        dqmRulesApplied: ['language_check', 'length_check', 'spam_check'],
        dqmValidationPassed: true,
      },
    });
  }

  /**
   * Clean text (remove URLs, mentions, extra whitespace)
   */
  private cleanText(text: string): string {
    return text
      .replace(/https?:\/\/\S+/g, '') // Remove URLs
      .replace(/@\w+/g, '') // Remove mentions
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Normalize text (lowercase, remove punctuation/numbers)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\d+/g, '') // Remove numbers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}

export default DQMService;
