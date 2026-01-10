import axios from 'axios';
import type {
  DailyStats,
  DailyVolume,
  KeywordData,
  ApiResponse,
  Platform,
} from '@memphis/shared';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ========================================
// Stats API (Multi-platform)
// ========================================

export async function getDailyStats(platform: Platform = 'all'): Promise<DailyStats | any> {
  const { data } = await apiClient.get<ApiResponse<any>>('/stats/daily', {
    params: { platform }
  });
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
// YouTube Comments API
// ========================================

export async function getRecentYouTubeComments(
  limit: number = 20,
  offset: number = 0,
  sentiment?: string
) {
  const params: any = { limit, offset };
  if (sentiment) params.sentiment = sentiment;
  const { data } = await apiClient.get('/youtube/comments/recent', { params });
  return data;
}

export async function getYouTubeCommentsBySentiment(sentiment: string, limit: number = 20) {
  const { data } = await apiClient.get(`/youtube/comments/sentiment/${sentiment}`, { params: { limit } });
  return data;
}

export async function getYouTubeCollectorRuns(limit: number = 10) {
  const { data } = await apiClient.get('/youtube/collector/runs', { params: { limit } });
  return data;
}

// ========================================
// Analytics API (Multi-platform)
// ========================================

export async function getSentimentTrend(days: number = 7, platform: Platform = 'all') {
  const { data } = await apiClient.get('/analytics/sentiment-trend', {
    params: { days, platform }
  });
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
// YouTube Whitelist API
// ========================================

export async function getYouTubeWhitelist(type?: 'video' | 'channel') {
  const params: any = {};
  if (type) params.type = type;
  const { data } = await apiClient.get('/youtube/whitelist', { params });
  return data;
}

export async function addToYouTubeWhitelist(item: {
  targetType: 'video' | 'channel';
  targetId: string;
  title?: string;
  priority?: number;
  maxComments?: number;
  notes?: string;
}) {
  const { data } = await apiClient.post('/youtube/whitelist', item);
  return data;
}

export async function removeFromYouTubeWhitelist(id: string) {
  const { data } = await apiClient.delete(`/youtube/whitelist/${id}`);
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
