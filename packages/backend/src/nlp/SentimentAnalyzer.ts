/**
 * Sentiment Analyzer
 * Priority feature: Analyzes sentiment of nutrition-related tweets
 * Uses lexicon-based approach with Indonesian language support
 */

import { ProcessedTweet, Prisma } from '@prisma/client';
import prisma from '../database/connection.js';
import logger from '../config/logger.js';
import {
  SentimentLabel,
  SentimentResult,
  getSentimentScore,
  hasNutritionContext,
  extractNutritionKeywords,
  extractProgramMentions,
  indonesianStemmer,
  indonesianStopwords,
  removeStopwords,
} from '@memphis/shared';

export class SentimentAnalyzer {
  private readonly NEGATION_WORDS = ['tidak', 'bukan', 'tanpa', 'belum', 'jangan', 'nggak', 'enggak', 'tak'];
  private readonly BOOSTER_WORDS = ['sangat', 'amat', 'terlalu', 'benar-benar', 'sungguh', 'sekali'];

  /**
   * Analyze sentiment of a processed tweet
   */
  async analyzeTweet(processedTweet: ProcessedTweet): Promise<SentimentResult> {
    const text = processedTweet.normalizedText;
    const originalText = processedTweet.cleanedText;

    // Tokenize
    const tokens = this.tokenize(text);

    // Remove stopwords
    const tokensWithoutStopwords = removeStopwords(tokens);

    // Find sentiment matches
    const positiveMatches: string[] = [];
    const negativeMatches: string[] = [];

    for (const token of tokensWithoutStopwords) {
      const score = getSentimentScore(token);
      if (score > 0) {
        positiveMatches.push(token);
      } else if (score < 0) {
        negativeMatches.push(token);
      }
    }

    // Check for multi-word phrases
    const textLower = text.toLowerCase();
    for (const phrase of ['sangat bagus', 'cukup baik', 'makan siang gratis', 'makan bergizi gratis']) {
      if (textLower.includes(phrase)) {
        if (getSentimentScore(phrase) > 0 && !positiveMatches.includes(phrase)) {
          positiveMatches.push(phrase);
        }
      }
    }

    // Calculate base score
    let rawScore = positiveMatches.length * 1.0 - negativeMatches.length * 1.0;

    // Handle negation
    const hasNegation = this.checkNegation(text);
    if (hasNegation) {
      rawScore = rawScore * -0.5; // Invert and reduce impact
    }

    // Handle booster words
    const hasBooster = this.BOOSTER_WORDS.some((b) => textLower.includes(b));
    if (hasBooster) {
      rawScore = rawScore * 1.5;
    }

    // Find nutrition context
    const nutritionContext = extractNutritionKeywords(originalText);

    // Weight by nutrition relevance
    const nutritionWeight = 1 + nutritionContext.length * 0.15;
    const weightedScore = rawScore * nutritionWeight;

    // Determine label
    let label: SentimentLabel;
    if (weightedScore > 1.5) {
      label = 'POSITIVE';
    } else if (weightedScore < -1.5) {
      label = 'NEGATIVE';
    } else if (positiveMatches.length > 0 && negativeMatches.length > 0) {
      label = 'MIXED';
    } else {
      label = 'NEUTRAL';
    }

    // Calculate confidence based on match counts
    const totalMatches = positiveMatches.length + negativeMatches.length;
    const confidence = Math.min(1.0, (totalMatches / 4) + 0.3);

    // Normalize score to -1 to 1 range
    const finalScore = Math.max(-1, Math.min(1, weightedScore / 3));

    const result: SentimentResult = {
      label,
      score: finalScore,
      confidence,
      details: {
        positiveMatches,
        negativeMatches,
        nutritionContext,
        weightedScore,
      },
    };

    // Update ProcessedTweet with sentiment
    await prisma.processedTweet.update({
      where: { id: processedTweet.id },
      data: {
        sentimentLabel: label,
        sentimentScore: finalScore,
        sentimentDetails: result.details as Prisma.InputJsonValue,
        hasNutritionTerms: nutritionContext.length > 0,
        hasPolicyTerms: extractProgramMentions(originalText).length > 0,
      },
    });

    return result;
  }

  /**
   * Analyze multiple tweets in batch
   */
  async analyzeBatch(tweets: ProcessedTweet[]): Promise<SentimentResult[]> {
    const results: SentimentResult[] = [];

    for (const tweet of tweets) {
      try {
        const result = await this.analyzeTweet(tweet);
        results.push(result);
      } catch (error) {
        logger.error(`Error analyzing tweet ${tweet.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\d+/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }

  /**
   * Check for negation in text
   */
  private checkNegation(text: string): boolean {
    const words = text.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      if (this.NEGATION_WORDS.includes(words[i])) {
        // Check if next word is a sentiment word
        const nextWord = words[i + 1];
        if (getSentimentScore(nextWord) !== 0) {
          return true;
        }
      }
    }
    return false;
  }
}

export default SentimentAnalyzer;
