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
  date?: string;
  platform?: Platform;
  // Twitter fields
  tweetsScraped?: number;
  tweetsPassedDqm?: number;
  tweetsAnalyzed?: number;
  // YouTube fields
  commentsCollected?: number;
  commentsPassedDqm?: number;
  commentsAnalyzed?: number;
  // Sentiment fields (shared across platforms)
  sentimentPositive: number;
  sentimentNegative: number;
  sentimentNeutral: number;
  sentimentMixed: number;
  avgSentimentScore: number;
  topKeywords?: KeywordData[];
  topHashtags?: any[];
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

// ========================================
// Platform Types
// ========================================

export type Platform = "twitter" | "youtube" | "all";

// ========================================
// YouTube Types
// ========================================

export interface YouTubeComment {
  id: string;
  text: string;
  cleanedText: string;
  authorDisplayName: string;
  authorChannelId: string;
  authorProfileUrl?: string;
  likeCount: number;
  replyCount: number;
  videoId: string;
  videoTitle: string;
  videoChannelId: string;
  videoChannelTitle: string;
  publishedAt: string;
  sentimentLabel: SentimentLabel;
  sentimentScore: number;
  keywords?: KeywordData[];
}

export interface YouTubeVideo {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  categoryId: string;
  duration: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface YouTubeCollectorConfig {
  maxCommentsPerVideo?: number;
  includeReplies?: boolean;
}

export interface YouTubeCollectorRunResult {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: RunStatus;
  commentsFound: number;
  commentsCollected: number;
  commentsPassedDqm: number;
  videoIds: string[];
  quotaUsed: number;
  quotaRemaining?: number;
  errorMessage?: string;
}

export interface WhitelistItem {
  id: string;
  targetType: "video" | "channel";
  targetId: string;
  title?: string;
  isActive: boolean;
  priority: number;
  maxComments?: number;
  lastCollectedAt?: Date;
  totalComments: number;
}

// ========================================
// Multi-Platform Stats Types
// ========================================

export interface MultiPlatformDailyStats {
  date: string;
  twitter: DailyStats;
  youtube: DailyStats;
  combined: DailyStats;
}
