/**
 * Scraper Orchestrator
 * Coordinates scraping, DQM, and database operations
 */

import {
  scrapeConfig,
  ScraperConfig,
  searchKeywords,
  Tweet,
} from "@memphis/shared";
import logger from "../config/logger.js";
import prisma from "../database/connection.js";
import { DQMService } from "../dqm/DQMService.js";
import { NLPOrchestrator } from "../nlp/NLPOrchestrator.js";
import { TwitterScraper } from "./TwitterScraper.js";

export class ScraperOrchestrator {
  private scraper: TwitterScraper;
  private dqmService: DQMService;
  private nlpOrchestrator: NLPOrchestrator;
  private isShuttingDown = false;

  constructor(config: ScraperConfig) {
    this.scraper = new TwitterScraper(config);
    this.dqmService = new DQMService();
    this.nlpOrchestrator = new NLPOrchestrator();
  }

  /**
   * Run the complete scraping pipeline
   */
  async run(): Promise<void> {
    const startTime = new Date();
    logger.info(`Starting scrape run at ${startTime.toISOString()}`);

    // Setup signal handlers for graceful shutdown
    this.setupShutdownHandlers();

    // Create scraper run log
    const scraperRun = await prisma.scraperRun.create({
      data: {
        startTime,
        status: "RUNNING",
        keywords: Array.from(searchKeywords),
        maxTweetsPerKeyword: scrapeConfig.TWEETS_PER_KEYWORD,
      },
    });

    let totalFound = 0;
    let totalScraped = 0;
    let totalPassed = 0;

    try {
      await this.scraper.initialize();

      // Scrape for each keyword
      for (const keyword of searchKeywords) {
        if (this.isShuttingDown) {
          logger.info("Shutdown requested, stopping scrape...");
          break;
        }

        logger.info(`Processing keyword: "${keyword}"`);

        const tweets = await this.scraper.searchTweets(
          keyword,
          scrapeConfig.TWEETS_PER_KEYWORD,
        );

        totalFound += tweets.length;
        logger.info(
          `Found ${tweets.length} tweets for "${keyword}", total found: ${totalFound}`,
        );

        // Save and process tweets
        for (const tweet of tweets) {
          if (this.isShuttingDown) break;

          try {
            const result = await this.processTweet(tweet, keyword);
            totalScraped++;
            if (result.passed) totalPassed++;
          } catch (error) {
            logger.error(`Error processing tweet ${tweet.id}:`, error);
          }
        }

        if (this.isShuttingDown) break;

        // Add delay between keywords to avoid rate limiting
        // Increased to 10-15 seconds to reduce rate limit risk
        await this.randomDelay(10000, 15000);
      }

      if (!this.isShuttingDown) {
        // Process NLP for all new tweets
        await this.nlpOrchestrator.processPendingTweets();
        await this.nlpOrchestrator.updateDailyAggregation();
      }

      // Update scraper run
      const status = this.isShuttingDown
        ? "CANCELLED"
        : totalScraped > 0
          ? "COMPLETED"
          : "FAILED";

      await prisma.scraperRun.update({
        where: { id: scraperRun.id },
        data: {
          endTime: new Date(),
          status,
          tweetsFound: totalFound,
          tweetsScraped: totalScraped,
          tweetsPassedDqm: totalPassed,
        },
      });

      logger.info(
        `Scrape run completed. Found: ${totalFound}, Scraped: ${totalScraped}, Passed: ${totalPassed}`,
      );
    } catch (error) {
      logger.error("Scrape run failed:", error);

      await prisma.scraperRun.update({
        where: { id: scraperRun.id },
        data: {
          endTime: new Date(),
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        },
      });

      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Process a single tweet (save to DB and run DQM)
   */
  private async processTweet(
    tweet: Tweet,
    keyword: string,
  ): Promise<{ passed: boolean; saved: boolean }> {
    // Check if already exists
    const existing = await prisma.rawTweet.findUnique({
      where: { tweetId: tweet.id },
    });

    if (existing) {
      logger.debug(`Tweet ${tweet.id} already exists, skipping`);
      return { passed: false, saved: false };
    }

    // Save raw tweet
    const saved = await prisma.rawTweet.create({
      data: {
        tweetId: tweet.id,
        text: tweet.text,
        authorId: tweet.authorId,
        authorUsername: tweet.authorUsername,
        authorDisplayName: tweet.authorDisplayName,
        authorFollowers: tweet.authorFollowers,
        authorVerified: tweet.authorVerified,
        createdAt: new Date(tweet.createdAt),
        scrapedAt: new Date(tweet.scrapedAt),
        retweets: tweet.retweets,
        likes: tweet.likes,
        replies: tweet.replies,
        views: tweet.views?.toString() || "0",
        imageUrl: tweet.imageUrl,
        language: tweet.language,
        source: tweet.source,
        hashtags: tweet.hashtags || [],
        mentions: tweet.mentions || [],
        isReply: tweet.text?.startsWith("@") || false,
        isRetweet: tweet.text?.startsWith("RT") || false,
        searchKeyword: keyword,
      },
    });

    // Run DQM checks
    const dqmResult = await this.dqmService.checkTweet(saved);

    return { passed: dqmResult.passed, saved: true };
  }

  /**
   * Random delay helper
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Setup shutdown handlers for graceful cleanup
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);
      this.isShuttingDown = true;
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      await this.scraper.close();
      await prisma.$disconnect();
      logger.info("Resources cleaned up successfully");
    } catch (error) {
      logger.error("Error during cleanup:", error);
    }
  }
}

// ========================================
// CLI Entry Point
// ========================================

export async function main(): Promise<void> {
  const config: ScraperConfig = {
    searchParams: {
      maxTweets: scrapeConfig.TWEETS_PER_KEYWORD,
    },
  };

  const orchestrator = new ScraperOrchestrator(config);

  try {
    await orchestrator.run();
    logger.info("Scraping completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Scraping failed:", error);
    process.exit(1);
  }
}

// Run if called directly
import { fileURLToPath } from "node:url";

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
