/**
 * Twitter/X Scraper using Puppeteer
 * Scrapes tweets without using official API
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { Tweet, ScraperConfig } from '@memphis/shared';
import { searchKeywords, scrapeConfig } from '@memphis/shared';
import logger from '../config/logger.js';

export interface ScrapeResult {
  keyword: string;
  tweets: Tweet[];
  success: boolean;
  error?: string;
}

export class TwitterScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  /**
   * Initialize Puppeteer browser
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Puppeteer browser...');

    const headless = process.env.HEADLESS !== 'false';

    this.browser = await puppeteer.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    this.page = await this.browser.newPage();

    // Set user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set viewport
    await this.page.setViewport({ width: 1920, height: 1080 });

    // Block unnecessary resources for speed
    await this.page.setRequestInterception(true);
    this.page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    logger.info('Browser initialized successfully');
  }

  /**
   * Search tweets by keyword
   */
  async searchTweets(keyword: string, maxTweets: number = scrapeConfig.TWEETS_PER_KEYWORD): Promise<Tweet[]> {
    if (!this.page) {
      throw new Error('Scraper not initialized. Call initialize() first.');
    }

    const tweets: Tweet[] = [];
    const searchUrl = this.buildSearchUrl(keyword);

    try {
      logger.info(`Searching for tweets with keyword: "${keyword}"`);

      await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for tweets to load
      try {
        await this.page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });
      } catch {
        logger.warn(`No tweets found for keyword: ${keyword}`);
        return [];
      }

      let scrollAttempts = 0;
      const maxScrollAttempts = 15;
      let previousHeight = 0;

      // Scroll and collect tweets
      while (tweets.length < maxTweets && scrollAttempts < maxScrollAttempts) {
        // Extract tweets from current view
        const newTweets = await this.extractTweetsFromPage(keyword);

        // Add unique tweets
        for (const tweet of newTweets) {
          if (!tweets.find((t) => t.id === tweet.id)) {
            tweets.push(tweet);
            if (tweets.length >= maxTweets) break;
          }
        }

        if (tweets.length >= maxTweets) break;

        // Scroll down
        previousHeight = await this.page.evaluate('document.body.scrollHeight');
        await this.page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await this.randomDelay(1500, 2500);

        const newHeight = await this.page.evaluate('document.body.scrollHeight');
        if (newHeight === previousHeight) {
          scrollAttempts++;
        } else {
          scrollAttempts = 0;
        }
      }

      logger.info(`Found ${tweets.length} tweets for keyword: "${keyword}"`);
      return tweets.slice(0, maxTweets);
    } catch (error) {
      logger.error(`Error scraping tweets for keyword "${keyword}":`, error);
      throw error;
    }
  }

  /**
   * Extract tweets from current page
   */
  private async extractTweetsFromPage(keyword: string): Promise<Tweet[]> {
    if (!this.page) return [];

    try {
      return await this.page.evaluate((searchKeyword) => {
        const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
        const tweets: any[] = [];

        tweetElements.forEach((element) => {
          try {
            // Extract tweet ID from link
            const tweetLink = element.querySelector('a[href*="/status/"]');
            const href = tweetLink?.getAttribute('href') || '';
            const tweetId = href.split('/status/')?.[1]?.split('?')?.[0] || '';

            if (!tweetId) return;

            // Extract text
            const textElement = element.querySelector('[data-testid="tweetText"]');
            const text = textElement?.textContent?.trim() || '';

            if (!text) return;

            // Extract author info
            const authorElement = element.querySelector('[data-testid="User-Name"]');
            const userLink = authorElement?.querySelector('a');
            const username = userLink?.getAttribute('href')?.replace(/^\//, '') || '';
            const displayName = authorElement?.querySelector('span')?.textContent || '';

            // Extract verification badge
            const verifiedBadge = element.querySelector('[data-testid="icon-verified"]');
            const isVerified = !!verifiedBadge;

            // Extract metrics
            const getMetric = (testId: string): number => {
              const metricEl = element.querySelector(`[data-testid="${testId}"]`);
              const text = metricEl?.textContent?.trim() || '0';
              if (text.includes('K')) return parseFloat(text.replace('K', '')) * 1000;
              if (text.includes('M')) return parseFloat(text.replace('M', '')) * 1000000;
              return parseInt(text.replace(/[^0-9]/g, '')) || 0;
            };

            // Extract hashtags
            const hashtagElements = element.querySelectorAll('a[href*="/hashtag/"]');
            const hashtags: string[] = [];
            hashtagElements.forEach((h) => {
              const text = h?.textContent?.replace(/^#/, '') || '';
              if (text) hashtags.push(text);
            });

            // Extract mentions
            const mentionElements = element.querySelectorAll('a[href*="/"]');
            const mentions: string[] = [];
            mentionElements.forEach((m) => {
              const text = m?.textContent || '';
              if (text.startsWith('@')) mentions.push(text.replace(/^@/, ''));
            });

            // Extract time
            const timeElement = element.querySelector('time');
            const datetime = timeElement?.getAttribute('datetime') || new Date().toISOString();

            tweets.push({
              id: tweetId,
              text,
              authorId: username,
              authorUsername: username,
              authorDisplayName: displayName,
              authorFollowers: 0, // Not visible without clicking profile
              authorVerified: isVerified,
              createdAt: datetime,
              scrapedAt: new Date().toISOString(),
              retweets: getMetric('retweet'),
              likes: getMetric('like'),
              replies: getMetric('reply'),
              views: getMetric('view'),
              language: 'id', // Default to Indonesian
              source: 'twitter',
              hashtags,
              mentions,
              searchKeyword,
            });
          } catch (error) {
            console.error('Error extracting tweet:', error);
          }
        });

        return tweets;
      }, keyword);
    } catch (error) {
      logger.error('Error in extractTweetsFromPage:', error);
      return [];
    }
  }

  /**
   * Build Twitter search URL
   */
  private buildSearchUrl(keyword: string): string {
    const query = encodeURIComponent(keyword);
    return `https://twitter.com/search?q=${query}&src=typed_query&f=live&lang=id`;
  }

  /**
   * Random delay to avoid detection
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info('Browser closed');
    }
  }
}

export default TwitterScraper;
