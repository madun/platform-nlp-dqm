/**
 * YouTube Collector Orchestrator
 * Coordinates comment collection, DQM, and database operations
 */

import logger from '../config/logger.js';
import prisma from '../database/connection.js';
import { YouTubeDQMService } from '../youtube-dqm/YouTubeDQMService.js';
import { YouTubeNLPOrchestrator } from '../youtube-nlp/YouTubeNLPOrchestrator.js';
import { YouTubeApiClient, YouTubeComment, YouTubeVideo } from './YouTubeApiClient.js';
import { WhitelistManager } from './WhitelistManager.js';

export interface CollectorConfig {
  maxCommentsPerVideo?: number;
  includeReplies?: boolean;
}

export class YouTubeCollector {
  private apiClient: YouTubeApiClient;
  private whitelistManager: WhitelistManager;
  private dqmService: YouTubeDQMService;
  private nlpOrchestrator: YouTubeNLPOrchestrator;
  private isShuttingDown = false;

  constructor(apiKey: string, config?: CollectorConfig) {
    this.apiClient = new YouTubeApiClient(apiKey);
    this.whitelistManager = new WhitelistManager();
    this.dqmService = new YouTubeDQMService();
    this.nlpOrchestrator = new YouTubeNLPOrchestrator();
  }

  /**
   * Run the complete YouTube collection pipeline
   */
  async run(): Promise<void> {
    const startTime = new Date();
    logger.info(`Starting YouTube comment collection at ${startTime.toISOString()}`);

    // Setup signal handlers for graceful shutdown
    this.setupShutdownHandlers();

    // Get videos from whitelist
    const videosToCollect = await this.whitelistManager.getVideosToCollect();

    if (videosToCollect.length === 0) {
      logger.warn('No videos in whitelist to collect');
      return;
    }

    // Create collector run log
    const collectorRun = await prisma.youTubeCollectorRun.create({
      data: {
        startTime,
        status: 'RUNNING',
        videoIds: videosToCollect.map((v) => v.id),
      },
    });

    let totalFound = 0;
    let totalCollected = 0;
    let totalPassed = 0;

    try {
      // Fetch video metadata first
      const videoIds = videosToCollect.map((v) => v.id);
      const videoMetadata = await this.fetchVideoMetadataBatch(videoIds);

      logger.info(`Fetching comments from ${videosToCollect.length} videos`);

      // Collect comments for each video
      for (const video of videosToCollect) {
        if (this.isShuttingDown) {
          logger.info('Shutdown requested, stopping collection...');
          break;
        }

        const metadata = videoMetadata.find((m) => m.id === video.id);
        const maxComments = video.maxComments || 1000;

        logger.info(
          `Processing video: ${metadata?.title || video.id} (${video.id}), max: ${maxComments}`
        );

        const comments = await this.collectVideoComments(
          video.id,
          maxComments,
          metadata
        );

        totalFound += comments.length;
        logger.info(`Found ${comments.length} comments for video ${video.id}`);

        // Process each comment
        for (const comment of comments) {
          if (this.isShuttingDown) break;

          try {
            const result = await this.processComment(comment, metadata);
            totalCollected++;
            if (result.passed) totalPassed++;
          } catch (error) {
            logger.error(`Error processing comment ${comment.id}:`, error);
          }
        }

        // Update whitelist stats
        await this.whitelistManager.updateCollectionStats('video', video.id, comments.length);

        // Small delay between videos
        await this.delay(1000);

        if (this.isShuttingDown) break;
      }

      if (!this.isShuttingDown) {
        // Process NLP for new comments
        await this.nlpOrchestrator.processPendingComments();
        await this.nlpOrchestrator.updateDailyAggregation();
      }

      // Update collector run
      const status = this.isShuttingDown
        ? 'CANCELLED'
        : totalCollected > 0
          ? 'COMPLETED'
          : 'FAILED';

      await prisma.youTubeCollectorRun.update({
        where: { id: collectorRun.id },
        data: {
          endTime: new Date(),
          status,
          commentsFound: totalFound,
          commentsCollected: totalCollected,
          commentsPassedDqm: totalPassed,
          quotaUsed: this.apiClient.getQuotaUsed(),
        },
      });

      logger.info(
        `Collection completed. Found: ${totalFound}, Collected: ${totalCollected}, Passed: ${totalPassed}`
      );
      logger.info(`API quota used: ${this.apiClient.getQuotaUsed()}`);
    } catch (error) {
      logger.error('Collection failed:', error);

      await prisma.youTubeCollectorRun.update({
        where: { id: collectorRun.id },
        data: {
          endTime: new Date(),
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Collect all comments for a video (with pagination)
   */
  private async collectVideoComments(
    videoId: string,
    maxComments: number,
    metadata?: YouTubeVideo
  ): Promise<YouTubeComment[]> {
    const allComments: YouTubeComment[] = [];
    let pageToken: string | undefined = undefined;
    let totalCollected = 0;

    while (totalCollected < maxComments && !this.isShuttingDown) {
      const remaining = maxComments - totalCollected;
      const result = await this.apiClient.fetchVideoComments(
        videoId,
        Math.min(remaining, 100),
        pageToken
      );

      allComments.push(...result.comments);
      totalCollected += result.comments.length;

      logger.debug(
        `Collected ${result.comments.length} comments, total: ${totalCollected}/${maxComments}`
      );

      if (!result.nextPageToken) break;
      pageToken = result.nextPageToken;

      // Small delay between pages
      await this.delay(200);
    }

    return allComments;
  }

  /**
   * Fetch video metadata in batches
   */
  private async fetchVideoMetadataBatch(videoIds: string[]): Promise<YouTubeVideo[]> {
    const batchSize = 50;
    const allMetadata: YouTubeVideo[] = [];

    for (let i = 0; i < videoIds.length; i += batchSize) {
      const batch = videoIds.slice(i, i + batchSize);
      logger.debug(`Fetching metadata for ${batch.length} videos`);

      const metadata = await this.apiClient.fetchVideoMetadata(batch);
      allMetadata.push(...metadata);

      logger.debug(`Fetched metadata for ${metadata.length} videos`);
    }

    return allMetadata;
  }

  /**
   * Process a single comment (save to DB and run DQM)
   */
  private async processComment(
    comment: YouTubeComment,
    videoMetadata?: YouTubeVideo
  ): Promise<{ passed: boolean; saved: boolean }> {
    // Check if already exists
    const existing = await prisma.rawYouTubeComment.findUnique({
      where: { commentId: comment.id },
    });

    if (existing) {
      logger.debug(`Comment ${comment.id} already exists, skipping`);
      return { passed: false, saved: false };
    }

    logger.debug(`Processing comment ${comment.id}`);

    // Save raw comment
    const saved = await prisma.rawYouTubeComment.create({
      data: {
        commentId: comment.id,
        text: comment.text,
        authorDisplayName: comment.authorDisplayName,
        authorChannelId: comment.authorChannelId,
        authorProfileUrl: comment.authorProfileUrl,
        likeCount: comment.likeCount,
        replyCount: comment.replyCount,
        parentId: comment.parentId,
        publishedAt: new Date(comment.publishedAt),
        videoId: videoMetadata?.id || '',
        videoTitle: videoMetadata?.title,
        videoChannelId: videoMetadata?.channelId,
        videoChannelTitle: videoMetadata?.channelTitle,
      },
    });

    // Run DQM checks
    const dqmResult = await this.dqmService.checkComment(saved);

    return { passed: dqmResult.passed, saved: true };
  }

  /**
   * Setup shutdown handlers for graceful cleanup
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);
      this.isShuttingDown = true;
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      await prisma.$disconnect();
      logger.info('Resources cleaned up successfully');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default YouTubeCollector;
