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
  private static readonly REQUEST_DELAY_MS = 8000; // 8 seconds between requests
  private static readonly MAX_RETRIES = 3;
  private static readonly RATE_LIMIT_DELAY = 60000 * 2; // 2 minutes on rate limit

  constructor(config: ScraperConfig) {
    this.config = config;
    this.executablePath = "/Applications/Chromium.app/Contents/MacOS/Chromium";
  }

  /**
   * Initialize Puppeteer browser with proper error handling
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Initializing Puppeteer browser...");

      const fs = await import("fs");
      if (!fs.existsSync(this.executablePath)) {
        throw new Error(
          `Chrome executable not found at: ${this.executablePath}`,
        );
      }

      logger.info(`Using Chrome executable: ${this.executablePath}`);

      const headless = process.env.HEADLESS !== "false";
      logger.info(`Headless mode: ${headless}`);

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
        timeout: 60000,
      });

      this.browser = await Promise.race([
        launchPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Browser launch timeout")), 60000),
        ),
      ]);

      logger.info("Browser launched successfully");

      this.page = await this.browser.newPage();
      logger.info("New page created");

      await this.page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );

      await this.page.setViewport({ width: 1280, height: 720 });
      logger.info("Viewport set to 1280x720");

      await this.page.setRequestInterception(true);
      this.page.on("request", (req) => {
        const resourceType = req.resourceType();
        const url = req.url();

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

      await this.page.setCacheEnabled(true);

      await this.loginIfRequired();
      logger.info("Browser initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize browser:", error);
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
      await this.page!.goto("https://twitter.com/i/flow/login", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      await this.randomDelay(2000, 3000);

      if (await this.isLoggedIn()) {
        logger.info("Already logged in to Twitter");
        return;
      }

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
      const hasLogoutButton = await this.page!.$(
        '[data-testid="SideNav_AccountSwitcher_Button"]',
      );
      const hasProfile = await this.page!.$('[role="banner"]');
      return !!(hasLogoutButton || hasProfile);
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

    logger.info("Entering username...");
    await page.waitForSelector('input[autocomplete="username"]', {
      timeout: 10000,
    });
    await page.type('input[autocomplete="username"]', username, {
      delay: 100,
    });

    await this.randomDelay(1000, 2000);

    logger.info("Clicking Next button after username...");

    let nextButtonClicked = false;

    try {
      const nextButton = await page.$x(
        '//button[@role="button"]//span[text()="Next"]',
      );

      if (nextButton && nextButton.length > 0) {
        await nextButton[0].click();
        nextButtonClicked = true;
        logger.debug("Clicked Next button using XPath");
      }
    } catch (e) {
      logger.debug("XPath selector failed for Next button:", e);
    }

    if (!nextButtonClicked) {
      try {
        await page.evaluate(() => {
          const buttons = Array.from(
            document.querySelectorAll('div[role="button"] span'),
          );
          const nextBtn = buttons.find((b) => b.textContent === "Next");
          if (nextBtn) (nextBtn as HTMLElement).click();
        });
        nextButtonClicked = true;
        logger.debug("Clicked Next button via evaluate");
      } catch (e) {
        logger.error("Failed to click Next button via evaluate:", e);
      }
    }

    if (!nextButtonClicked) {
      throw new Error(
        "Could not find or click Next button after entering username",
      );
    }

    logger.info("Waiting for page transition after clicking Next...");
    await this.randomDelay(1000, 1500);

    try {
      await page.waitForSelector(
        'input[autocomplete="email"], input[name="password"]',
        { timeout: 10000 },
      );
    } catch (e) {
      logger.warn("Email or password input not found after Next button");
    }

    const emailInput = await page.$('input[autocomplete="email"]');
    if (emailInput && email) {
      logger.info("Email requested, entering email...");
      await page.type('input[autocomplete="email"]', email, { delay: 100 });
      await this.randomDelay(1000, 2000);

      logger.info("Clicking Next button after email...");

      let emailNextButtonClicked = false;

      try {
        const emailNextButton = await page.$x(
          '//button[@role="button"]//span[text()="Next"]',
        );

        if (emailNextButton && emailNextButton.length > 0) {
          await emailNextButton[0].click();
          emailNextButtonClicked = true;
          logger.debug("Clicked email Next button using XPath");
        }
      } catch (e) {
        logger.debug("XPath selector failed for email Next button:", e);
      }

      if (!emailNextButtonClicked) {
        try {
          await page.evaluate(() => {
            const buttons = Array.from(
              document.querySelectorAll('div[role="button"] span'),
            );
            const nextBtn = buttons.find((b) => b.textContent === "Next");
            if (nextBtn) (nextBtn as HTMLElement).click();
          });
          emailNextButtonClicked = true;
          logger.debug("Clicked email Next button via evaluate");
        } catch (e) {
          logger.error("Failed to click email Next button via evaluate:", e);
        }
      }

      if (!emailNextButtonClicked) {
        throw new Error(
          "Could not find or click Next button after entering email",
        );
      }

      logger.info("Waiting for password input after email...");
      await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    } else {
      logger.debug("Email field not required, proceeding to password");
    }

    await this.randomDelay(1000, 1500);

    logger.info("Entering password...");
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });

    await page.type('input[name="password"]', password, { delay: 100 });

    await this.randomDelay(1000, 2000);

    logger.info("Clicking Log in button...");

    let loginButtonClicked = false;

    try {
      const loginButton = await page.$x(
        '//button[@role="button"]//span[text()="Log in"]',
      );

      if (loginButton && loginButton.length > 0) {
        await loginButton[0].click();
        loginButtonClicked = true;
        logger.debug("Clicked Log in button using XPath");
      }
    } catch (e) {
      logger.debug("XPath selector failed for Log in button:", e);
    }

    if (!loginButtonClicked) {
      try {
        await page.evaluate(() => {
          const buttons = Array.from(
            document.querySelectorAll('div[role="button"] span'),
          );
          const loginBtn = buttons.find((b) => b.textContent === "Log in");
          if (loginBtn) (loginBtn as HTMLElement).click();
        });
        loginButtonClicked = true;
        logger.debug("Clicked Log in button via evaluate");
      } catch (e) {
        logger.error("Failed to click Log in button via evaluate:", e);
      }
    }

    if (!loginButtonClicked) {
      throw new Error("Could not find or click Log in button");
    }

    logger.info("Waiting for login to complete...");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
    await this.randomDelay(2000, 3000);

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

    await this.rateLimit();

    let retries = 0;
    let lastError: Error | null = null;

    while (retries < TwitterScraper.MAX_RETRIES) {
      try {
        const tweets = await this.searchTweetsInternal(keyword, maxTweets);
        this.requestCount = 0;
        console.log(`Scraped ${tweets.length} tweets for keyword "${keyword}"`);
        return tweets;
      } catch (error) {
        lastError = error as Error;

        if (this.isRateLimitError(error)) {
          retries++;
          const delay = Math.pow(2, retries) * TwitterScraper.RATE_LIMIT_DELAY;

          logger.warn(
            `Rate limit detected for keyword "${keyword}". Retrying in ${delay / 1000} seconds... (Attempt ${retries}/${TwitterScraper.MAX_RETRIES})`,
          );

          await this.randomDelay(delay, delay + 10000);

          try {
            await this.page!.goto("https://twitter.com/home", {
              waitUntil: "networkidle2",
              timeout: 30000,
            });
          } catch {
            // Ignore navigation errors
          }

          continue;
        }

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

    await this.page!.goto(searchUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    const currentUrl = this.page!.url();
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

      logger.info("Retrying navigation to search page after login...");
      await this.page!.goto(searchUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
    }

    logger.info("Page loaded successfully");

    try {
      await this.page!.waitForSelector('article[data-testid="tweet"]', {
        timeout: 15000,
      });
      logger.info("Tweet elements found");
    } catch {
      logger.warn(`No tweets found for keyword: ${keyword}`);
      return [];
    }

    if (await this.isCurrentlyRateLimited()) {
      logger.warn("Rate limit detected from page content");
      throw new Error("Rate limit detected");
    }

    let scrollAttempts = 0;
    const maxScrollAttempts = 2;
    let previousHeight = 0;

    logger.info(`Starting to scroll and collect tweets (max: ${maxTweets})`);

    while (tweets.length < maxTweets && scrollAttempts < maxScrollAttempts) {
      logger.debug(
        `Current tweets: ${tweets.length}, Scroll attempt: ${scrollAttempts}/${maxScrollAttempts}`,
      );

      const newTweets = await this.extractTweetsFromPage(keyword);

      logger.info(`Scraped ${newTweets.length} tweets`);

      for (const tweet of newTweets) {
        if (!tweets.find((t) => t.id === tweet.id)) {
          tweets.push(tweet);
          logger.debug(`Found new tweet: ${tweet.id}`);
        }
      }

      if (tweets.length >= maxTweets) break;

      if (await this.isCurrentlyRateLimited()) {
        logger.warn("Rate limit detected during scrolling");
        throw new Error("Rate limit detected during scrolling");
      }

      previousHeight = await this.page!.evaluate("document.body.scrollHeight");
      await this.page!.evaluate(
        "window.scrollTo(0, document.body.scrollHeight)",
      );
      await this.randomDelay(3000, 5000);

      const newHeight = await this.page!.evaluate("document.body.scrollHeight");
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
   * Extract tweets from current page
   */
  private async extractTweetsFromPage(keyword: string): Promise<Tweet[]> {
    if (!this.page) return [];

    try {
      const tweetElements = await this.page.$$('article[data-testid="tweet"]');
      const tweets: Tweet[] = [];

      for (let index = 0; index < tweetElements.length; index++) {
        const element = tweetElements[index];
        try {
          const tweetId = await this.extractTweetIdFromElement(element);

          if (!tweetId) {
            tweets.push({
              id: "",
              text: "",
              authorId: "",
              authorUsername: "",
              authorDisplayName: "",
              authorFollowers: 0,
              authorVerified: false,
              createdAt: "",
              scrapedAt: new Date().toISOString(),
              retweets: 0,
              likes: 0,
              replies: 0,
              language: "id",
              source: "twitter",
              hashtags: [],
              mentions: [],
              searchKeyword: keyword,
              elementIndex: index,
            });
            continue;
          }

          await this.clickShowMoreButtons(element);

          const text = await this.extractText(element);
          if (!text) continue;

          const { username, displayName, isVerified } =
            await this.extractAuthorInfo(element);
          const { retweets, likes, replies } =
            await this.extractMetrics(element);
          const hashtags = await this.extractHashtags(element);
          const mentions = await this.extractMentions(element);

          const datetime = await this.extractTime(element);

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
            retweets,
            likes,
            replies,
            language: "id",
            source: "twitter",
            hashtags,
            mentions,
          });

          (tweets as any).searchKeyword = keyword;
        } catch (error) {
          logger.error(`Error extracting tweet ${index}:`, error);
        }
      }

      return tweets;
    } catch (error) {
      logger.error("Error in extractTweetsFromPage:", error);
      return [];
    }
  }

  /**
   * Extract tweet ID from element
   */
  private async extractTweetIdFromElement(element: any): Promise<string> {
    // Method 1: Try to find the timestamp/time element which typically contains the tweet permalink
    const timeElement = await element.$("time");
    if (timeElement) {
      const parentLink = await element.evaluate((el: HTMLElement) => {
        const closestLink = (el as any).closest('a[href*="/status/"]');
        return closestLink ? closestLink.getAttribute("href") || "" : "";
      }, timeElement);
      const timeMatch = parentLink.match(/status\/(\d+)/);
      if (timeMatch) return timeMatch[1];
    }

    // Method 2: Try to find any direct link element with status in href
    const linkElement = await element.$('a[href*="/status/"]');
    if (linkElement) {
      const href = await element.evaluate(
        (el: HTMLElement) => el.getAttribute("href") || "",
        linkElement,
      );
      const match = href.match(/status\/(\d+)/);
      if (match) return match[1];
    }

    // Method 3: Try to extract from data-testid or other data attributes
    const tweetIdFromData = await element.evaluate((el: HTMLElement) => {
      // Check for data-testid containing the ID
      const allElements = el.querySelectorAll("[data-testid], [data-tweet-id]");
      for (const elem of allElements) {
        const testId = elem.getAttribute("data-testid");
        if (testId && testId.includes("tweet")) {
          const idMatch = testId.match(/\d+/);
          if (idMatch && idMatch[0].length >= 10) return idMatch[0];
        }
        const tweetId = elem.getAttribute("data-tweet-id");
        if (tweetId) return tweetId;
      }
      return "";
    });
    if (tweetIdFromData) return tweetIdFromData;

    // Method 4: Try to extract from aria-label or other metadata
    const tweetIdFromAria = await element.evaluate((el: HTMLElement) => {
      const elements = el.querySelectorAll(
        "[aria-label], [data-aria-label-part]",
      );
      for (const elem of elements) {
        const ariaLabel = elem.getAttribute("aria-label") || "";
        const dataAriaPart = elem.getAttribute("data-aria-label-part") || "";
        const combined = `${ariaLabel} ${dataAriaPart}`;
        const idMatch = combined.match(/(\d{10,})/);
        if (idMatch) return idMatch[1];
      }
      return "";
    });
    if (tweetIdFromAria) return tweetIdFromAria;

    // Method 5: Try to extract from the element's internal structure or React props
    const tweetIdFromProps = await element.evaluate((el: HTMLElement) => {
      // Check if element has any properties or internal state with the ID
      const allLinks = el.querySelectorAll("a");
      for (const link of allLinks) {
        const href = link.getAttribute("href") || "";
        if (href.includes("/status/")) {
          const match = href.match(/status\/(\d+)/);
          if (match) return match[1];
        }
      }

      // Try to find ID in any text content that looks like a tweet ID (10+ digits)
      const textContent = el.textContent || "";
      const idMatch = textContent.match(/\b(\d{15,19})\b/); // Tweet IDs are typically 15-19 digits
      if (idMatch) return idMatch[1];

      return "";
    });
    if (tweetIdFromProps) return tweetIdFromProps;

    return "";
  }

  /**
   * Click "Show more" buttons
   */
  private async clickShowMoreButtons(element: any): Promise<void> {
    const showMoreButtons = await element.$$(
      '[data-testid="tweet-text-show-more-link"]',
    );

    if (showMoreButtons.length > 0) {
      logger.debug(
        `Found ${showMoreButtons.length} "Show more" button(s) for tweet`,
      );
      for (const button of showMoreButtons) {
        await button.click();
      }
      await this.randomDelay(500, 800);
    }
  }

  /**
   * Extract tweet text
   */
  private async extractText(element: any): Promise<string> {
    const textElement = await element.$('[data-testid="tweetText"]');
    if (!textElement) return "";

    const text = await element.evaluate(
      (el: HTMLElement) => el.textContent?.trim() || "",
      textElement,
    );
    return text;
  }

  /**
   * Extract author information
   */
  private async extractAuthorInfo(
    element: any,
  ): Promise<{ username: string; displayName: string; isVerified: boolean }> {
    let username = "";
    let displayName = "";
    let isVerified = false;

    const authorNameElement = await element.$('[data-testid="User-Name"]');
    if (authorNameElement) {
      const userLink = await authorNameElement.$('[role="link"]');
      if (userLink) {
        const href = await userLink.evaluate(
          (el: HTMLElement) => el.getAttribute("href") || "",
        );
        if (href.startsWith("/")) {
          const parts = href.split("/").filter((p) => p);
          logger.info(`Extracting author info from ${href}`);
          logger.info(`parts ${JSON.stringify(parts)}`);
          if (parts.length > 0) {
            (username as any) = parts[0];
            (displayName as any) = await authorNameElement.evaluate(
              (el: HTMLElement) => {
                const span = el.querySelector("span");
                return span ? span.textContent?.trim() || "" : "";
              },
            );
          }
        }
      }

      // const verifiedBadge = await element.$('[data-testid="icon-verified"]');
      // (isVerified as any) = verifiedBadge !== null;
    }

    return {
      username: username || "",
      displayName: displayName || "",
      isVerified,
    };
  }

  /**
   * Extract metrics (retweets, likes, replies)
   */
  private async extractMetrics(
    element: any,
  ): Promise<{ retweets: number; likes: number; replies: number }> {
    const retweets = await this.extractMetricValue(element, "retweet");
    const likes = await this.extractMetricValue(element, "like");
    const replies = await this.extractMetricValue(element, "reply");

    return { retweets, likes, replies };
  }

  /**
   * Extract single metric value
   */
  private async extractMetricValue(
    element: any,
    testId: string,
  ): Promise<number> {
    const metricElement = await element.$(`[data-testid="${testId}"]`);
    if (!metricElement) return 0;

    const text = await metricElement.evaluate((el: HTMLElement) => {
      // Find the span with the actual count value
      const span = el.querySelector(
        'span[data-testid="app-text-transition-container"] span',
      );
      return span?.textContent?.trim() || el.textContent?.trim() || "0";
    });

    if (!text || text === "") return 0;

    if (text.includes("K")) {
      return parseFloat(text.replace("K", "")) * 1000;
    }
    if (text.includes("M")) {
      return parseFloat(text.replace("M", "")) * 1000000;
    }
    return parseInt(text.replace(/[^0-9]/g, "")) || 0;
  }

  /**
   * Extract hashtags
   */
  private async extractHashtags(element: any): Promise<string[]> {
    const hashtagElements = await element.$$('a[href*="/hashtag/"]');
    const hashtags: string[] = [];

    for (const h of hashtagElements) {
      const text = await element.evaluate(
        (el: HTMLElement) => el.textContent?.replace(/^#/, "") || "",
        h,
      );
      if (text) hashtags.push(text);
    }

    return hashtags;
  }

  /**
   * Extract mentions
   */
  private async extractMentions(element: any): Promise<string[]> {
    const mentionElements = await element.$$('a[href*="/"]');
    const mentions: string[] = [];

    for (const m of mentionElements) {
      const text = await element.evaluate(
        (el: HTMLElement) => el.textContent || "",
        m,
      );
      if (text.startsWith("@")) {
        mentions.push(text.replace(/^@/, ""));
      }
    }

    return mentions;
  }

  /**
   * Extract time/datetime
   */
  private async extractTime(element: any): Promise<string> {
    const timeElement = await element.$("time");
    logger.info(`Extracting time from element ${JSON.stringify(timeElement)}`);
    if (timeElement) {
      const datetime = await element.evaluate(
        (el: HTMLElement) => el.getAttribute("datetime") || "",
        timeElement,
      );
      if (datetime) return datetime;
    }
    return new Date().toISOString();
  }

  /**
   * Fallback method: Navigate to tweet detail page to extract information
   */
  private async extractTweetFromDetailPage(
    elementIndex: number,
  ): Promise<Tweet | null> {
    if (!this.page) return null;

    try {
      const tweetElements = await this.page.$$('article[data-testid="tweet"]');

      if (elementIndex >= tweetElements.length) {
        logger.warn(`Element index ${elementIndex} out of bounds`);
        return null;
      }

      const tweetElement = tweetElements[elementIndex];

      logger.debug(
        `Navigating to tweet detail page for element ${elementIndex}...`,
      );

      await tweetElement.click();

      await this.page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 15000,
      });

      const detailUrl = this.page!.url();
      logger.debug(`Detail page URL: ${detailUrl}`);

      const urlMatch = detailUrl.match(/status\/(\d+)/);
      const tweetId = urlMatch ? urlMatch[1].split("?")[0] : "";

      if (!tweetId) {
        logger.warn("Could not extract tweet ID from detail page URL");
        await this.page.goBack().catch(() => {});
        await this.page
          .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
          .catch(() => {});
        return null;
      }

      await this.clickShowMoreButtons(this.page as any);

      const text = await this.extractText(this.page as any);
      if (!text) return null;

      const { username, displayName, isVerified } =
        await this.extractAuthorInfo(this.page as any);
      const { retweets, likes, replies } = await this.extractMetrics(
        this.page as any,
      );
      const hashtags = await this.extractHashtags(this.page as any);
      const mentions = await this.extractMentions(this.page as any);

      const datetime = await this.extractTime(this.page as any);

      logger.debug(`Successfully extracted tweet ${tweetId} from detail page`);

      await this.page!.goBack();
      await this.page
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
        .catch(() => {});

      return {
        id: tweetId,
        text,
        authorId: username,
        authorUsername: username,
        authorDisplayName: displayName,
        authorFollowers: 0,
        authorVerified: isVerified,
        createdAt: datetime,
        scrapedAt: new Date().toISOString(),
        retweets,
        likes,
        replies,
        language: "id",
        source: "twitter",
        hashtags,
        mentions,
      };
    } catch (error) {
      logger.error("Error extracting tweet from detail page:", error);

      try {
        if (this.page) {
          await this.page!.goBack().catch(() => {});
          await this.page
            .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
            .catch(() => {});
        }
      } catch {
        // Ignore errors during recovery
      }

      return null;
    }
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
      const rateLimitText = await this.page.evaluate(() => {
        const selectors = ["h2", 'div[role="alert"]', "span", "p"];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
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
