/**
 * Twitter/X Scraper using Puppeteer
 * Scrapes tweets without using official API
 */

import { scrapeConfig, ScraperConfig, Tweet } from "@memphis/shared";
import puppeteer, { Browser, Page } from "puppeteer";
import logger from "../config/logger.js";

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
  private readonly executablePath: string;
  private requestCount = 0;
  private lastRequestTime = 0;
  private static readonly REQUEST_DELAY_MS = 5000; // 5 seconds between requests
  private static readonly MAX_RETRIES = 3;
  private static readonly RATE_LIMIT_DELAY = 60000; // 1 minute on rate limit

  constructor(config: ScraperConfig) {
    this.config = config;
    // Use system Chromium
    this.executablePath = "/Applications/Chromium.app/Contents/MacOS/Chromium";
  }

  /**
   * Initialize Puppeteer browser with proper error handling
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Initializing Puppeteer browser...");

      // Verify the executable exists
      const fs = await import("fs");
      if (!fs.existsSync(this.executablePath)) {
        throw new Error(
          `Chrome executable not found at: ${this.executablePath}`,
        );
      }

      logger.info(`Using Chrome executable: ${this.executablePath}`);

      const headless = process.env.HEADLESS !== "false";
      logger.info(`Headless mode: ${headless}`);

      // Launch with timeout to prevent hanging
      const launchPromise = puppeteer.launch({
        headless: headless ? "new" : false,
        executablePath: this.executablePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--disable-software-rasterizer",
          "--disable-blink-features=AutomationControlled",
          "--window-size=1280,720",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
        defaultViewport: null,
        // Add timeout to prevent hanging
        timeout: 60000, // 60 seconds
      });

      // Wait for browser launch with explicit timeout
      this.browser = await Promise.race([
        launchPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Browser launch timeout")), 60000),
        ),
      ]);

      logger.info("Browser launched successfully");

      // Create new page with error handling
      this.page = await this.browser.newPage();
      logger.info("New page created");

      // Set user agent
      await this.page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );
      logger.info("User agent set");

      // Set viewport
      await this.page.setViewport({ width: 1280, height: 720 });
      logger.info("Viewport set to 1280x720");

      // Block unnecessary resources for speed and memory
      await this.page.setRequestInterception(true);
      this.page.on("request", (req) => {
        const resourceType = req.resourceType();
        const url = req.url();

        // Block heavy resources to save memory
        if (
          ["image", "stylesheet", "font", "media", "websocket"].includes(
            resourceType,
          )
        ) {
          req.abort();
        } else if (
          url.match(/\.(png|jpg|jpeg|gif|css|woff|woff2|svg|mp4|webm)$/i)
        ) {
          req.abort();
        } else {
          req.continue();
        }
      });
      logger.info("Request interception configured");

      // Enable page cache
      await this.page.setCacheEnabled(true);
      logger.info("Browser initialized successfully");

      // Login if credentials are provided
      await this.loginIfRequired();
    } catch (error) {
      logger.error("Failed to initialize browser:", error);
      // Cleanup if initialization failed
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Check if login is required and perform login if needed
   */
  private async loginIfRequired(): Promise<void> {
    const username = process.env.TWITTER_USERNAME;
    const password = process.env.TWITTER_PASSWORD;
    const email = process.env.TWITTER_EMAIL;

    if (!username || !password) {
      logger.info("No Twitter credentials provided, continuing without login");
      return;
    }

    logger.info("Twitter credentials found, attempting to login...");

    try {
      // Navigate to Twitter login page
      logger.info("Navigating to Twitter login page...");
      await this.page!.goto("https://x.com/i/flow/login", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      await this.randomDelay(2000, 3000);

      // Check if already logged in
      if (await this.isLoggedIn()) {
        logger.info("Already logged in to Twitter");
        return;
      }

      // Perform login
      await this.performLogin(username, password, email);
      logger.info("Successfully logged in to Twitter");
    } catch (error) {
      logger.error("Failed to login to Twitter:", error);
      throw new Error("Twitter login failed. Please check your credentials.");
    }
  }

  /**
   * Check if already logged in to Twitter
   */
  private async isLoggedIn(): Promise<boolean> {
    try {
      // Check for logout button or user profile which indicates logged in state
      const hasLogoutButton = await this.page!.$(
        '[data-testid="AccountSwitcher_Logout_Button"]',
      );
      const hasProfile = await this.page!.$(
        '[data-testid="SideNav_AccountSwitcher_Button"]',
      );

      if (hasLogoutButton || hasProfile) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Perform Twitter login
   */
  private async performLogin(
    username: string,
    password: string,
    email?: string,
  ): Promise<void> {
    const page = this.page!;

    // Wait for username input
    logger.info("Entering username...");
    await page.waitForSelector('input[autocomplete="username"]', {
      timeout: 10000,
    });

    await page.type('input[autocomplete="username"]', username, {
      delay: 100,
    });

    await this.randomDelay(1000, 2000);

    // Click next button
    const nextButton = await page.$x(
      '//button[@role="button"]//span[text()="Next"]',
    );
    if (nextButton.length > 0) {
      await nextButton[0].click();
    } else {
      // Try alternative selector
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll('button[role="button"] span'),
        );
        const nextBtn = buttons.find((b) => b.textContent === "Next");
        if (nextBtn) (nextBtn as HTMLElement).click();
      });
    }

    await this.randomDelay(2000, 3000);

    // Check if email is requested
    try {
      const emailInput = await page.$('input[autocomplete="email"]');
      if (emailInput && email) {
        logger.info("Email requested, entering email...");
        await page.waitForSelector('input[autocomplete="email"]', {
          timeout: 5000,
        });
        await page.type('input[autocomplete="email"]', email, { delay: 100 });
        await this.randomDelay(1000, 2000);

        // Click next button again
        const emailNextButton = await page.$x(
          '//button[@role="button"]//span[text()="Next"]',
        );
        if (emailNextButton.length > 0) {
          await emailNextButton[0].click();
        } else {
          await page.evaluate(() => {
            const buttons = Array.from(
              document.querySelectorAll('button[role="button"] span'),
            );
            const nextBtn = buttons.find((b) => b.textContent === "Next");
            if (nextBtn) (nextBtn as HTMLElement).click();
          });
        }
      }
    } catch {
      // Email field not required
      logger.debug("Email field not required");
    }

    await this.randomDelay(2000, 3000);

    // Wait for password input
    logger.info("Entering password...");
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });

    await page.type('input[name="password"]', password, { delay: 100 });

    await this.randomDelay(1000, 2000);

    // Click login button
    const loginButton = await page.$x(
      '//button[@role="button"]//span[text()="Log in"]',
    );
    if (loginButton.length > 0) {
      await loginButton[0].click();
    } else {
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll('button[role="button"] span'),
        );
        const loginBtn = buttons.find((b) => b.textContent === "Log in");
        if (loginBtn) (loginBtn as HTMLElement).click();
      });
    }

    // Wait for login to complete
    logger.info("Waiting for login to complete...");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });

    await this.randomDelay(2000, 3000);

    // Verify login was successful
    if (!(await this.isLoggedIn())) {
      throw new Error("Login verification failed");
    }
  }

  /**
   * Search tweets by keyword
   */
  async searchTweets(
    keyword: string,
    maxTweets: number = scrapeConfig.TWEETS_PER_KEYWORD,
  ): Promise<Tweet[]> {
    if (!this.page) {
      throw new Error("Scraper not initialized. Call initialize() first.");
    }

    // Rate limiting: wait between requests
    await this.rateLimit();

    // Retry logic with exponential backoff
    let retries = 0;
    let lastError: Error | null = null;

    while (retries < TwitterScraper.MAX_RETRIES) {
      try {
        const tweets = await this.searchTweetsInternal(keyword, maxTweets);

        // Reset retry counter on success
        this.requestCount = 0;
        return tweets;
      } catch (error) {
        lastError = error as Error;

        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          retries++;
          const delay = Math.pow(2, retries) * TwitterScraper.RATE_LIMIT_DELAY;

          logger.warn(
            `Rate limit detected for keyword "${keyword}". Retrying in ${delay / 1000} seconds... (Attempt ${retries}/${TwitterScraper.MAX_RETRIES})`,
          );

          await this.randomDelay(delay, delay + 10000);

          // Try to refresh page to clear rate limit
          await this.page!.goto("https://twitter.com/home", {
            waitUntil: "networkidle2",
            timeout: 30000,
          });

          continue;
        }

        // Not a rate limit error, rethrow immediately
        throw error;
      }
    }

    throw (
      lastError || new Error("Failed to scrape tweets after maximum retries")
    );
  }

  /**
   * Internal search implementation
   */
  private async searchTweetsInternal(
    keyword: string,
    maxTweets: number,
  ): Promise<Tweet[]> {
    const tweets: Tweet[] = [];
    const searchUrl = this.buildSearchUrl(keyword);

    logger.info(`Searching for tweets with keyword: "${keyword}"`);
    logger.info(`Search URL: ${searchUrl}`);

    // Navigate to search page
    logger.info("Navigating to Twitter search page...");
    await this.page!.goto(searchUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Check if we were redirected to login page
    const currentUrl = this.page.url();
    if (currentUrl.includes("login") || currentUrl.includes("i/flow")) {
      logger.info("Redirected to login page, logging in...");

      const username = process.env.TWITTER_USERNAME;
      const password = process.env.TWITTER_PASSWORD;
      const email = process.env.TWITTER_EMAIL;

      if (!username || !password) {
        throw new Error(
          "Twitter login required but credentials not provided. Please set TWITTER_USERNAME and TWITTER_PASSWORD in .env file",
        );
      }

      await this.performLogin(username, password, email);
      await this.randomDelay(2000, 3000);

      // Navigate to search page again after login
      logger.info("Retrying navigation to search page after login...");
      await this.page.goto(searchUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
    }

    logger.info("Page loaded successfully");

    // Wait for tweets to load
    logger.info("Waiting for tweet elements...");
    try {
      await this.page.waitForSelector('article[data-testid="tweet"]', {
        timeout: 15000,
      });
      logger.info("Tweet elements found");
    } catch {
      logger.warn(`No tweets found for keyword: ${keyword}`);
      return [];
    }

    let scrollAttempts = 0;
    const maxScrollAttempts = 10;
    let previousHeight = 0;

    // Check if rate limited
    if (await this.isCurrentlyRateLimited()) {
      logger.warn("Rate limit detected from page content");
      throw new Error("Rate limit detected");
    }

    // Scroll and collect tweets
    logger.info(`Starting to scroll and collect tweets (max: ${maxTweets})`);
    while (tweets.length < maxTweets && scrollAttempts < maxScrollAttempts) {
      logger.debug(
        `Current tweets: ${tweets.length}, Scroll attempt: ${scrollAttempts}/${maxScrollAttempts}`,
      );

      // Extract tweets from current view
      const newTweets = await this.extractTweetsFromPage(keyword);

      // Add unique tweets
      for (const tweet of newTweets) {
        if (!tweets.find((t) => t.id === tweet.id)) {
          tweets.push(tweet);
          logger.debug(`Found new tweet: ${tweet.id}`);
          if (tweets.length >= maxTweets) break;
        }
      }

      if (tweets.length >= maxTweets) break;

      // Check for rate limit during scrolling
      if (await this.isCurrentlyRateLimited()) {
        logger.warn("Rate limit detected during scrolling");
        throw new Error("Rate limit detected during scrolling");
      }

      // Scroll down with longer delays
      previousHeight = await this.page.evaluate("document.body.scrollHeight");
      await this.page.evaluate(
        "window.scrollTo(0, document.body.scrollHeight)",
      );
      await this.randomDelay(3000, 5000); // Increased from 1500-2500

      const newHeight = await this.page.evaluate("document.body.scrollHeight");
      if (newHeight === previousHeight) {
        scrollAttempts++;
        logger.debug(`No new content, scroll attempt ${scrollAttempts}`);
      } else {
        scrollAttempts = 0;
      }
    }

    logger.info(`Found ${tweets.length} tweets for keyword: "${keyword}"`);
    return tweets.slice(0, maxTweets);
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    const errorMessage = error?.message || "";

    return (
      errorMessage.includes("rate limit") ||
      errorMessage.includes("too many requests") ||
      errorMessage.includes("429") ||
      errorMessage.includes("Please wait a few moments")
    );
  }

  /**
   * Implement rate limiting between requests
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < TwitterScraper.REQUEST_DELAY_MS) {
      const waitTime = TwitterScraper.REQUEST_DELAY_MS - timeSinceLastRequest;
      logger.debug(`Rate limiting: waiting ${waitTime}ms before next request`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Check if rate limited by analyzing page content
   */
  private async isCurrentlyRateLimited(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Check for rate limit messages
      const rateLimitText = await this.page.evaluate(() => {
        const selectors = ["h2", 'div[role="alert"]', "span", "p"];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent?.toLowerCase() || "";
            if (
              text.includes("rate limit") ||
              text.includes("too many requests") ||
              text.includes("please wait") ||
              text.includes("you are rate limited")
            ) {
              return true;
            }
          }
        }
        return false;
      });

      return rateLimitText;
    } catch {
      return false;
    }
  }

  /**
   * Extract tweets from current page
   */
  private async extractTweetsFromPage(keyword: string): Promise<Tweet[]> {
    if (!this.page) return [];

    try {
      return await this.page.evaluate((searchKeyword) => {
        const tweetElements = document.querySelectorAll(
          'article[data-testid="tweet"]',
        );
        const tweets: any[] = [];

        tweetElements.forEach((element) => {
          try {
            // Extract tweet ID from link
            const tweetLink = element.querySelector('a[href*="/status/"]');
            const href = tweetLink?.getAttribute("href") || "";
            const tweetId = href.split("/status/")?.[1]?.split("?")?.[0] || "";

            if (!tweetId) return;

            // Extract text
            const textElement = element.querySelector(
              '[data-testid="tweetText"]',
            );
            const text = textElement?.textContent?.trim() || "";

            if (!text) return;

            // Extract author info
            const authorElement = element.querySelector(
              '[data-testid="User-Name"]',
            );
            const userLink = authorElement?.querySelector("a");
            const username =
              userLink?.getAttribute("href")?.replace(/^\//, "") || "";
            const displayName =
              authorElement?.querySelector("span")?.textContent || "";

            // Extract verification badge
            const verifiedBadge = element.querySelector(
              '[data-testid="icon-verified"]',
            );
            const isVerified = !!verifiedBadge;

            // Extract metrics
            const getMetric = (testId: string): number => {
              const metricEl = element.querySelector(
                `[data-testid="${testId}"]`,
              );
              const text = metricEl?.textContent?.trim() || "0";
              if (text.includes("K"))
                return parseFloat(text.replace("K", "")) * 1000;
              if (text.includes("M"))
                return parseFloat(text.replace("M", "")) * 1000000;
              return parseInt(text.replace(/[^0-9]/g, "")) || 0;
            };

            // Extract hashtags
            const hashtagElements = element.querySelectorAll(
              'a[href*="/hashtag/"]',
            );
            const hashtags: string[] = [];
            hashtagElements.forEach((h) => {
              const text = h?.textContent?.replace(/^#/, "") || "";
              if (text) hashtags.push(text);
            });

            // Extract mentions
            const mentionElements = element.querySelectorAll('a[href*="/"]');
            const mentions: string[] = [];
            mentionElements.forEach((m) => {
              const text = m?.textContent || "";
              if (text.startsWith("@")) mentions.push(text.replace(/^@/, ""));
            });

            // Extract time
            const timeElement = element.querySelector("time");
            const datetime =
              timeElement?.getAttribute("datetime") || new Date().toISOString();

            tweets.push({
              id: tweetId,
              text,
              authorId: username,
              authorUsername: username,
              authorDisplayName: displayName,
              authorFollowers: 0,
              authorVerified: isVerified,
              createdAt: datetime,
              scrapedAt: new Date().toISOString(),
              retweets: getMetric("retweet"),
              likes: getMetric("like"),
              replies: getMetric("reply"),
              views: getMetric("view"),
              language: "id",
              source: "twitter",
              hashtags,
              mentions,
              searchKeyword,
            });
          } catch (error) {
            console.error("Error extracting tweet:", error);
          }
        });

        return tweets;
      }, keyword);
    } catch (error) {
      logger.error("Error in extractTweetsFromPage:", error);
      return [];
    }
  }

  /**
   * Build Twitter search URL
   */
  private buildSearchUrl(keyword: string): string {
    const query = encodeURIComponent(keyword);
    return `https://x.com/search?q=${query}&src=typed_query&f=live&lang=id`;
  }

  /**
   * Random delay to avoid detection
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.removeAllListeners();
        await this.page.close();
        this.page = null;
      }

      if (this.browser) {
        const pages = await this.browser.pages();
        await Promise.all(pages.map((page) => page.close()));
        await this.browser.close();
        this.browser = null;
      }
      logger.info("Browser resources cleaned up");
    } catch (error) {
      logger.error("Error during cleanup:", error);
    }
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    await this.cleanup();
  }
}

export default TwitterScraper;
