/**
 * Keyword Extractor
 * Extracts important keywords using TF-IDF
 */

import { ProcessedTweet } from '@prisma/client';
import prisma from '../database/connection.js';
import logger from '../config/logger.js';
import { removeStopwords, indonesianStemmer } from '@memphis/shared';

export interface KeywordData {
  keyword: string;
  score: number;
  count: number;
}

export class KeywordExtractor {
  /**
   * Extract keywords from a processed tweet
   */
  async extractKeywords(processedTweet: ProcessedTweet): Promise<KeywordData[]> {
    const text = processedTweet.normalizedText;

    // Tokenize and remove stopwords
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3);

    const tokensWithoutStopwords = removeStopwords(tokens);

    // Stem tokens
    const stemmedTokens = tokensWithoutStopwords.map((t) => indonesianStemmer.stem(t));

    // Count frequency
    const frequency = new Map<string, number>();
    for (const token of stemmedTokens) {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    }

    // Convert to array and sort by frequency
    const keywords: KeywordData[] = Array.from(frequency.entries())
      .map(([keyword, count]) => ({
        keyword,
        score: count / stemmedTokens.length, // TF score
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Update ProcessedTweet
    await prisma.processedTweet.update({
      where: { id: processedTweet.id },
      data: {
        keywords: keywords as any,
        stemmedText: stemmedTokens.join(' '),
        tokens: tokensWithoutStopwords as any,
      },
    });

    return keywords;
  }

  /**
   * Extract keywords from multiple tweets
   */
  async extractBatch(tweets: ProcessedTweet[]): Promise<void> {
    for (const tweet of tweets) {
      try {
        await this.extractKeywords(tweet);
      } catch (error) {
        logger.error(`Error extracting keywords from tweet ${tweet.id}:`, error);
      }
    }
  }

  /**
   * Get top keywords across all tweets
   */
  async getTopKeywords(limit: number = 50): Promise<KeywordData[]> {
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

    return Array.from(keywordFreq.entries())
      .map(([keyword, count]) => ({
        keyword,
        score: count / tweets.length,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

export default KeywordExtractor;
