// ========================================
// Core Types
// ========================================

export interface Tweet {
  id: string;
  text: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorFollowers: number;
  authorVerified: boolean;
  createdAt: string;
  scrapedAt: string;
  imageUrl?: string;
  retweets: number;
  likes: number;
  replies: number;
  language?: string;
  source?: string;
  hashtags?: string[];
  mentions?: string[];
  elementIndex?: number;
}

export interface ScraperConfig {
  searchParams: {
    maxTweets: number;
    since?: string;
    until?: string;
  };
}

export interface DQMConfig {
  minScore: number;
  minQualityScore: number;
  minLength: number;
  maxLength: number;
}

export interface NLPConfig {
  sentimentThreshold: number;
  keywordCount: number;
}

// ========================================
// Sentiment Types
// ========================================

export type SentimentLabel = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED";

export interface SentimentAnalysis {
  label: SentimentLabel;
  score: number;
  confidence: number;
}

export interface SentimentResult {
  label: SentimentLabel;
  score: number;
  confidence: number;
  details: {
    positiveMatches: string[];
    negativeMatches: string[];
    nutritionContext: string[];
    weightedScore: number;
  };
}

// ========================================
// DQM Types
// ========================================

export interface DQMResult {
  passed: boolean;
  score: number;
  checks: {
    isDuplicate: boolean;
    isLanguageValid: boolean;
    isMinLength: boolean;
    isMaxLength: boolean;
    isBot: boolean;
    hasUrl: boolean;
    hasMention: boolean;
  };
  reason?: string;
}

// ========================================
// Analytics Types
// ========================================

export interface DailyStats {
  date: string;
  tweetsScraped: number;
  tweetsPassedDqm: number;
  tweetsAnalyzed: number;
  sentimentPositive: number;
  sentimentNegative: number;
  sentimentNeutral: number;
  sentimentMixed: number;
  avgSentimentScore: number;
}

export interface SentimentDistribution {
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
}

export interface DailyVolume {
  date: string;
  scraped: number;
  passed: number;
  analyzed: number;
}

export interface KeywordData {
  keyword: string;
  count: number;
  score: number;
}

// ========================================
// API Types
// ========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface TweetsResponse {
  tweets: Tweet[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ScraperRunStatus {
  id: string;
  startTime: string;
  endTime?: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL";
  tweetsFound: number;
  tweetsScraped: number;
  tweetsPassedDqm: number;
  keywords: string[];
  errorMessage?: string;
}

// ========================================
// Scraper Types
// ========================================

export type RunStatus = "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL";

export interface ScraperRunResult {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: RunStatus;
  tweetsFound: number;
  tweetsScraped: number;
  tweetsPassedDqm: number;
  keywords: string[];
  errorMessage?: string;
}
