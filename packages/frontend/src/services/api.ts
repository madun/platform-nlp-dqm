import axios from 'axios';
import type {
  DailyStats,
  SentimentDistribution,
  DailyVolume,
  KeywordData,
  ApiResponse,
  Tweet,
} from '@memphis/shared';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ========================================
// Stats API
// ========================================

export async function getDailyStats(): Promise<DailyStats> {
  const { data } = await apiClient.get<ApiResponse<DailyStats>>('/stats/daily');
  if (!data.data) throw new Error(data.error || 'Failed to fetch daily stats');
  return data.data;
}

export async function getStatsRange(days: number = 7): Promise<DailyVolume[]> {
  const { data } = await apiClient.get('/stats/range', { params: { days } });
  return data;
}

// ========================================
// Tweets API
// ========================================

export async function getRecentTweets(limit: number = 20, offset: number = 0) {
  const { data } = await apiClient.get('/tweets/recent', { params: { limit, offset } });
  return data;
}

export async function getTweetsBySentiment(sentiment: string, limit: number = 20) {
  const { data } = await apiClient.get(`/tweets/sentiment/${sentiment}`, { params: { limit } });
  return data;
}

// ========================================
// Analytics API
// ========================================

export async function getSentimentTrend(days: number = 7) {
  const { data } = await apiClient.get('/analytics/sentiment-trend', { params: { days } });
  return data;
}

export async function getTopKeywords(limit: number = 50): Promise<KeywordData[]> {
  const { data } = await apiClient.get<ApiResponse<KeywordData[]>>('/analytics/top-keywords', {
    params: { limit },
  });
  if (!data.data) throw new Error(data.error || 'Failed to fetch top keywords');
  return data.data;
}

// ========================================
// Scraper API
// ========================================

export async function getScraperRuns(limit: number = 10) {
  const { data } = await apiClient.get('/scraper/runs', { params: { limit } });
  return data;
}

export async function getConfig() {
  const { data } = await apiClient.get('/config');
  return data;
}

// ========================================
// Health Check
// ========================================

export async function healthCheck() {
  const { data } = await apiClient.get('/health');
  return data;
}

// Export default api client for direct axios usage if needed
export default apiClient;
