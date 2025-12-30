/**
 * Scheduler
 * Manages cron jobs for scraping, NLP processing, and aggregation
 */

import cron from 'node-cron';
import { ScraperOrchestrator } from '../scraper/index.js';
import { NLPOrchestrator } from '../nlp/NLPOrchestrator.js';
import { ScraperConfig } from '@memphis/shared';
import { scraperSchedule, scrapeConfig } from '@memphis/shared';
import logger from '../config/logger.js';

export class Scheduler {
  private scrapeTask: cron.ScheduledTask | null = null;
  private nlpTask: cron.ScheduledTask | null = null;
  private aggregationTask: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start all scheduled tasks
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info('Starting scheduler...');
    this.isRunning = true;

    // Scrape every 6 hours: 00:00, 06:00, 12:00, 18:00 WIB
    this.scrapeTask = cron.schedule(
      scraperSchedule.SCRAPE_CRON,
      async () => {
        logger.info('Running scheduled scrape task');
        await this.runScrapeTask();
      },
      {
        timezone: scraperSchedule.TIMEZONE,
      }
    );

    // NLP processing every hour
    this.nlpTask = cron.schedule(
      scraperSchedule.NLP_CRON,
      async () => {
        logger.info('Running NLP processing task');
        await this.runNlpTask();
      },
      {
        timezone: scraperSchedule.TIMEZONE,
      }
    );

    // Daily aggregation at 23:50
    this.aggregationTask = cron.schedule(
      scraperSchedule.AGGREGATION_CRON,
      async () => {
        logger.info('Running daily aggregation task');
        await this.runAggregationTask();
      },
      {
        timezone: scraperSchedule.TIMEZONE,
      }
    );

    logger.info('Scheduler started successfully');
    logger.info(`Scrape schedule: Every 6 hours (cron: ${scraperSchedule.SCRAPE_CRON})`);
    logger.info(`NLP schedule: Every hour (cron: ${scraperSchedule.NLP_CRON})`);
    logger.info(`Aggregation schedule: Daily at 23:50 (cron: ${scraperSchedule.AGGREGATION_CRON})`);
    logger.info(`Timezone: ${scraperSchedule.TIMEZONE}`);
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    logger.info('Stopping scheduler...');
    this.isRunning = false;

    if (this.scrapeTask) {
      this.scrapeTask.stop();
      logger.info('Scrape task stopped');
    }
    if (this.nlpTask) {
      this.nlpTask.stop();
      logger.info('NLP task stopped');
    }
    if (this.aggregationTask) {
      this.aggregationTask.stop();
      logger.info('Aggregation task stopped');
    }

    logger.info('Scheduler stopped');
  }

  /**
   * Run scrape task
   */
  private async runScrapeTask(): Promise<void> {
    try {
      const config: ScraperConfig = {
        searchParams: {
          maxTweets: scrapeConfig.TWEETS_PER_KEYWORD,
        },
      };

      const orchestrator = new ScraperOrchestrator(config);
      await orchestrator.run();

      // Trigger NLP processing after scrape
      const nlpOrchestrator = new NLPOrchestrator();
      await nlpOrchestrator.processPendingTweets();
      await nlpOrchestrator.updateDailyAggregation();

      logger.info('Scheduled scrape task completed successfully');
    } catch (error) {
      logger.error('Error in scheduled scrape task:', error);
    }
  }

  /**
   * Run NLP processing task
   */
  private async runNlpTask(): Promise<void> {
    try {
      const nlpOrchestrator = new NLPOrchestrator();
      await nlpOrchestrator.processPendingTweets();
      logger.info('Scheduled NLP task completed successfully');
    } catch (error) {
      logger.error('Error in scheduled NLP task:', error);
    }
  }

  /**
   * Run daily aggregation task
   */
  private async runAggregationTask(): Promise<void> {
    try {
      const nlpOrchestrator = new NLPOrchestrator();
      await nlpOrchestrator.updateDailyAggregation();
      logger.info('Scheduled aggregation task completed successfully');
    } catch (error) {
      logger.error('Error in scheduled aggregation task:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean; tasks: { scraping: boolean; nlp: boolean; aggregation: boolean } } {
    return {
      isRunning: this.isRunning,
      tasks: {
        scraping: this.scrapeTask?.getStatus() === 'scheduled',
        nlp: this.nlpTask?.getStatus() === 'scheduled',
        aggregation: this.aggregationTask?.getStatus() === 'scheduled',
      },
    };
  }
}

// ========================================
// CLI Entry Point
// ========================================

const scheduler = new Scheduler();

// Start scheduler
scheduler.start();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  scheduler.stop();
  process.exit(0);
});

// Keep process running
logger.info('Scheduler is running. Press Ctrl+C to stop.');
