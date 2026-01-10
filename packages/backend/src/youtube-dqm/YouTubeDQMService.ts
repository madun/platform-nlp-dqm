/**
 * YouTube Data Quality Management Service
 * Validates and filters YouTube comments
 * Mirrors Twitter DQMService with YouTube-specific adaptations
 */

import { RawYouTubeComment } from '@prisma/client';
import prisma from '../database/connection.js';
import logger from '../config/logger.js';

export interface YouTubeDQMResult {
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
    hasExcessiveEmojis: boolean;
    hasRepeatedText: boolean;
  };
  reason?: string;
}

export class YouTubeDQMService {
  // Bot detection patterns (YouTube-specific)
  private readonly BOT_PATTERNS = [
    /sub\s+for\s+sub/i,
    /sub4sub/i,
    /check\s+my\s+channel/i,
    /subscribe\s+to\s+me/i,
    /free\s+(subscribe|sub|followers)/i,
    /click\s+my\s+profile/i,
    /first/i, // "First!" comments
    /\d{5,}$/, // Usernames ending in many numbers
  ];

  // Spam patterns
  private readonly SPAM_PATTERNS = [
    /(buy|get|free).{0,20}(subscribe|sub|followers|views|like)/i,
    /https?:\/\/\S{20,}/,
    /\.{4,}/,
    /^(.)\1{10,}/,
    /copy\s+and\s+paste/i,
  ];

  // Unicode ranges for common emojis (surrogate pairs)
  private readonly EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

  // Indonesian language markers (same as Twitter)
  private readonly INDONESIAN_MARKERS = [
    'yang',
    'dan',
    'di',
    'ke',
    'dari',
    'untuk',
    'dengan',
    'adalah',
    'ini',
    'itu',
    'juga',
    'atau',
    'karena',
    'tapi',
    'kalau',
    'yg',
    'dgn',
    'utk',
    'jg',
    'krn',
    'tp',
    'kl',
  ];

  // English markers
  private readonly ENGLISH_MARKERS = [
    'the',
    'and',
    'is',
    'to',
    'of',
    'in',
    'for',
    'with',
    'this',
    'that',
    'are',
    'was',
    'were',
    'been',
    'being',
  ];

  // YouTube-specific thresholds
  private readonly MIN_COMMENT_LENGTH = 10; // Longer than tweets
  private readonly MAX_COMMENT_LENGTH = 5000; // YouTube allows longer comments
  private readonly QUALITY_THRESHOLD = 0.5; // Same as Twitter

  /**
   * Check comment quality
   */
  async checkComment(comment: RawYouTubeComment): Promise<YouTubeDQMResult> {
    const checks = {
      isDuplicate: await this.checkDuplicate(comment),
      isLanguageValid: this.checkLanguage(comment),
      isMinLength: this.checkMinLength(comment),
      isMaxLength: this.checkMaxLength(comment),
      isBot: this.checkBot(comment),
      hasValidUrls: this.checkUrls(comment),
      hasValidMentions: this.checkMentions(comment),
      hasExcessiveEmojis: this.checkEmojis(comment),
      hasRepeatedText: this.checkRepeatedText(comment),
    };

    // Calculate quality score
    const score = this.calculateQualityScore(checks);
    const passed = score >= this.QUALITY_THRESHOLD && checks.isLanguageValid;

    const result: YouTubeDQMResult = {
      passed,
      score,
      checks,
      reason: !passed ? this.getFailureReason(checks, score) : undefined,
    };

    // Save DQM check result
    await prisma.youTubeDqmCheck.create({
      data: {
        rawCommentId: comment.id,
        isDuplicate: checks.isDuplicate,
        isLanguageValid: checks.isLanguageValid,
        isMinLength: checks.isMinLength,
        isMaxLength: checks.isMaxLength,
        isBot: checks.isBot,
        hasExcessiveEmojis: checks.hasExcessiveEmojis,
        qualityScore: score,
        passed,
      },
    });

    // If passed, create ProcessedYouTubeComment for NLP
    if (passed) {
      await this.createProcessedComment(comment, result);
    }

    return result;
  }

  /**
   * Check for duplicate content
   */
  private async checkDuplicate(comment: RawYouTubeComment): Promise<boolean> {
    // Extract a safe prefix for duplicate checking
    // Remove all non-alphanumeric characters except spaces to avoid SQL errors
    let textPrefix = comment.text
      .slice(0, 50)  // Use a longer prefix for better accuracy
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, '')  // Remove special chars, keep alphanumeric and spaces
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();

    // Skip duplicate check if text is too short after cleaning
    if (textPrefix.length < 5) {
      return false;
    }

    try {
      const similarCount = await prisma.rawYouTubeComment.count({
        where: {
          text: { contains: textPrefix },
          id: { not: comment.id },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      });

      return similarCount > 0;
    } catch (error) {
      // If duplicate check fails, log and continue (don't block the comment)
      logger.warn(`Duplicate check failed for comment ${comment.id}:`, error);
      return false;
    }
  }

  /**
   * Check if comment is in Indonesian
   */
  private checkLanguage(comment: RawYouTubeComment): boolean {
    const text = comment.text.toLowerCase();
    const words = text.split(/\s+/);

    const indoCount = words.filter((w) => this.INDONESIAN_MARKERS.includes(w)).length;
    const engCount = words.filter((w) => this.ENGLISH_MARKERS.includes(w)).length;

    return indoCount >= engCount;
  }

  /**
   * Check minimum length
   */
  private checkMinLength(comment: RawYouTubeComment): boolean {
    const length = comment.text.length;
    return length >= this.MIN_COMMENT_LENGTH && length > 0;
  }

  /**
   * Check maximum length
   */
  private checkMaxLength(comment: RawYouTubeComment): boolean {
    return comment.text.length <= this.MAX_COMMENT_LENGTH;
  }

  /**
   * Check if comment is likely spam/bot
   */
  private checkBot(comment: RawYouTubeComment): boolean {
    for (const pattern of this.BOT_PATTERNS) {
      if (pattern.test(comment.text)) {
        return true;
      }
    }

    for (const pattern of this.SPAM_PATTERNS) {
      if (pattern.test(comment.text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check URL count
   */
  private checkUrls(comment: RawYouTubeComment): boolean {
    const urlCount = (comment.text.match(/https?:\/\//g) || []).length;
    return urlCount <= 2;
  }

  /**
   * Check mention count
   */
  private checkMentions(comment: RawYouTubeComment): boolean {
    const mentionCount = (comment.text.match(/@/g) || []).length;
    return mentionCount <= 5;
  }

  /**
   * Check for excessive emojis
   * Returns true if emojis are acceptable, false if excessive
   */
  private checkEmojis(comment: RawYouTubeComment): boolean {
    const emojiMatches = comment.text.match(this.EMOJI_REGEX) || [];
    const emojiCount = emojiMatches.length;
    const textLength = comment.text.length;

    // Allow up to 30% of text to be emojis, but max 10 emojis total
    const maxEmojis = Math.min(10, Math.ceil(textLength * 0.3));

    return emojiCount <= maxEmojis;
  }

  /**
   * Check for repeated text/characters
   */
  private checkRepeatedText(comment: RawYouTubeComment): boolean {
    const text = comment.text.toLowerCase();

    // Check for repeated words (e.g., "good good good good")
    const words = text.split(/\s+/);
    const consecutiveRepeats = words.filter(
      (word, i) => i > 0 && word === words[i - 1] && word.length > 2
    ).length;

    return consecutiveRepeats < 3;
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(checks: any): number {
    let score = 1.0;

    if (checks.isDuplicate) score -= 0.5;
    if (!checks.isLanguageValid) score -= 0.4;
    if (!checks.isMinLength) score -= 0.2;
    if (!checks.isMaxLength) score -= 0.1;
    if (checks.isBot) score -= 0.6;
    if (!checks.hasValidUrls) score -= 0.1;
    if (!checks.hasValidMentions) score -= 0.1;
    if (!checks.hasExcessiveEmojis) score -= 0.15;
    if (!checks.hasRepeatedText) score -= 0.15;

    return Math.max(0, score);
  }

  /**
   * Get failure reason
   */
  private getFailureReason(checks: any, score: number): string {
    if (checks.isDuplicate) return 'Duplicate comment detected';
    if (!checks.isLanguageValid) return 'Invalid language (not Indonesian)';
    if (checks.isBot) return 'Bot or spam detected';
    if (!checks.isMinLength) return 'Comment too short';
    if (!checks.hasExcessiveEmojis) return 'Excessive emojis detected';
    if (!checks.hasRepeatedText) return 'Repeated text detected';
    if (score < this.QUALITY_THRESHOLD) {
      return `Quality score ${score.toFixed(2)} below threshold ${this.QUALITY_THRESHOLD}`;
    }
    return 'Unknown quality issue';
  }

  /**
   * Create ProcessedYouTubeComment for NLP
   */
  private async createProcessedComment(
    comment: RawYouTubeComment,
    dqmResult: YouTubeDQMResult
  ): Promise<void> {
    const cleanedText = this.cleanText(comment.text);
    const normalizedText = this.normalizeText(cleanedText);

    await prisma.processedYouTubeComment.create({
      data: {
        rawCommentId: comment.id,
        cleanedText,
        normalizedText,
        sentimentLabel: 'NEUTRAL',
        sentimentScore: 0.0,
        dqmRulesApplied: ['language_check', 'length_check', 'spam_check', 'emoji_check'],
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

export default YouTubeDQMService;
