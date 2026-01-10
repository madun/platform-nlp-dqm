/**
 * YouTube Collector CLI Entry Point
 */

import logger from '../config/logger.js';
import { YouTubeCollector } from './YouTubeCollector.js';

export async function main(): Promise<void> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    logger.error('YOUTUBE_API_KEY environment variable is required');
    logger.error('Please set YOUTUBE_API_KEY in your .env file');
    process.exit(1);
  }

  const maxComments = process.env.YOUTUBE_MAX_COMMENTS_PER_VIDEO
    ? parseInt(process.env.YOUTUBE_MAX_COMMENTS_PER_VIDEO)
    : undefined;

  const collector = new YouTubeCollector(apiKey, {
    maxCommentsPerVideo: maxComments,
    includeReplies: true,
  });

  try {
    await collector.run();
    logger.info('YouTube comment collection completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('YouTube comment collection failed:', error);
    process.exit(1);
  }
}

// Run if called directly
import { fileURLToPath } from 'node:url';

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
