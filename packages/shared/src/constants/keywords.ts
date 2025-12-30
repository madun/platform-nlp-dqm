/**
 * Search keywords for Twitter/X scraping
 * Focused on Indonesian nutrition and food security topics
 */

/**
 * Main search keywords for scraping
 */
export const searchKeywords = [
  'gizi',
  'ketahanan pangan',
  'stunting',
  'malnutrisi',
  'Makan Bergizi Gratis',
  'MBG',
  'mbg',
  'Makan Siang Gratis',
  'gizi buruk',
  'krisis pangan'
] as const;

/**
 * Keyword categories
 */
export const keywordCategories = {
  GIZI: ['gizi', 'nutrisi', 'bergizi', 'kekurangan gizi', 'gizi buruk'],
  STUNTING: ['stunting', 'tumbuh kembang', 'balita', 'anak', 'kurang gizi'],
  MALNUTRISI: ['malnutrisi', 'gizi buruk', 'kurang gizi', 'wasting', 'kurus'],
  MBG: ['Makan Bergizi Gratis', 'MBG', 'mbg', 'Makan Siang Gratis'],
  KETAHANAN_PANGAN: ['ketahanan pangan', 'kedaulatan pangan', 'swasembada', 'krisis pangan'],
  BANTUAN: ['bantuan', 'bansos', 'subsidi', 'bantuan pangan']
} as const;

/**
 * Get category for a keyword
 */
export function getKeywordCategory(keyword: string): string | null {
  const lowerKeyword = keyword.toLowerCase();

  for (const [category, keywords] of Object.entries(keywordCategories)) {
    for (const kw of keywords) {
      if (lowerKeyword === kw.toLowerCase() || lowerKeyword.includes(kw.toLowerCase())) {
        return category;
      }
    }
  }

  return null;
}

/**
 * Scrape configuration
 */
export const scrapeConfig = {
  TARGET_TWEETS_PER_DAY: 50,
  TWEETS_PER_KEYWORD: 8, // ~50 tweets / 8 keywords ≈ 6-8 per keyword
  SCRAPE_INTERVAL_HOURS: 6,
  MIN_TWEET_LENGTH: 20,
  MAX_TWEET_LENGTH: 500,
  QUALITY_THRESHOLD: 0.6,
  MAX_HASHTAGS: 10,
  MAX_URLS: 5,
  MAX_MENTIONS: 3
} as const;

/**
 * Scraper schedule (cron format)
 */
export const scraperSchedule = {
  SCRAPE_CRON: '0 */6 * * *', // Every 6 hours: 00:00, 06:00, 12:00, 18:00
  NLP_CRON: '0 * * * *', // Every hour
  AGGREGATION_CRON: '50 23 * * *', // Daily at 23:50
  TIMEZONE: 'Asia/Jakarta'
} as const;

/**
 * Default export
 */
export default {
  searchKeywords,
  keywordCategories,
  scrapeConfig,
  scraperSchedule
};
