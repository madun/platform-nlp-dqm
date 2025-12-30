/**
 * Memphis Backend Entry Point
 * Twitter/X Scraper with NLP & DQM for Nutrition Sentiment Analysis
 */

import { fastify, start } from './api/server.js';
import logger from './config/logger.js';

// Start the API server
start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  fastify.close().then(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  fastify.close().then(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
