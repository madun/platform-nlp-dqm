/**
 * YouTube Data API v3 Client
 * Handles all YouTube API interactions with proper error handling and retry logic
 */

import axios, { AxiosError } from 'axios';

export interface YouTubeComment {
  id: string;
  text: string;
  authorDisplayName: string;
  authorChannelId: string;
  authorProfileUrl?: string;
  likeCount: number;
  replyCount: number;
  isPublic: boolean;
  parentId?: string;
  publishedAt: string;
  updatedAt?: string;
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

export class YouTubeApiClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://www.googleapis.com/youtube/v3';
  private quotaUsed: number = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetch comments from a specific video
   * Uses youtube.commentThreads.list endpoint
   */
  async fetchVideoComments(
    videoId: string,
    maxResults: number = 100,
    pageToken?: string
  ): Promise<{ comments: YouTubeComment[]; nextPageToken?: string }> {
    try {
      const params: any = {
        part: 'snippet,replies',
        videoId,
        maxResults: Math.min(maxResults, 100), // API max is 100
        order: 'relevance', // or 'time'
        textFormat: 'plainText',
        key: this.apiKey,
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await axios.get(
        `${this.baseUrl}/commentThreads`,
        { params, timeout: 10000 }
      );

      this.quotaUsed += 1; // Each request costs 1 unit

      const items = response.data.items || [];
      const comments: YouTubeComment[] = [];

      for (const item of items) {
        // Top-level comment
        const topLevel = item.snippet.topLevelComment.snippet;
        comments.push(this.parseComment(topLevel, item.id));

        // Replies (if any)
        if (item.replies) {
          for (const reply of item.replies.comments) {
            comments.push(this.parseComment(reply.snippet, reply.id, item.id));
          }
        }
      }

      return {
        comments,
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('YouTube API quota exceeded');
        }
        if (error.response?.status === 404) {
          throw new Error(`Video ${videoId} not found`);
        }
      }
      throw error;
    }
  }

  /**
   * Fetch video metadata
   * Uses youtube.videos.list endpoint
   */
  async fetchVideoMetadata(videoIds: string[]): Promise<YouTubeVideo[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/videos`,
        {
          params: {
            part: 'snippet,contentDetails,statistics',
            id: videoIds.join(','),
            maxResults: 50, // API max
            key: this.apiKey,
          },
          timeout: 10000,
        }
      );

      this.quotaUsed += 1;

      return (response.data.items || []).map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        categoryId: item.snippet.categoryId,
        duration: item.contentDetails.duration,
        viewCount: parseInt(item.statistics.viewCount || '0'),
        likeCount: parseInt(item.statistics.likeCount || '0'),
        commentCount: parseInt(item.statistics.commentCount || '0'),
      }));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        throw new Error('YouTube API quota exceeded');
      }
      throw error;
    }
  }

  /**
   * Search for videos by channel ID
   * Uses youtube.search.list endpoint
   */
  async searchChannelVideos(
    channelId: string,
    publishedAfter?: string,
    maxResults: number = 50
  ): Promise<string[]> {
    try {
      const params: any = {
        part: 'snippet',
        channelId,
        type: 'video',
        order: 'date',
        maxResults: Math.min(maxResults, 50),
        key: this.apiKey,
      };

      if (publishedAfter) {
        params.publishedAfter = publishedAfter;
      }

      const response = await axios.get(
        `${this.baseUrl}/search`,
        { params, timeout: 10000 }
      );

      this.quotaUsed += 100; // Search endpoint costs 100 units

      return (response.data.items || []).map((item: any) => item.id.videoId);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        throw new Error('YouTube API quota exceeded');
      }
      throw error;
    }
  }

  /**
   * Get quota usage
   */
  getQuotaUsed(): number {
    return this.quotaUsed;
  }

  /**
   * Reset quota counter
   */
  resetQuota(): void {
    this.quotaUsed = 0;
  }

  /**
   * Parse comment from API response
   */
  private parseComment(snippet: any, id: string, parentId?: string): YouTubeComment {
    return {
      id,
      text: snippet.textDisplay || snippet.textOriginal,
      authorDisplayName: snippet.authorDisplayName,
      authorChannelId: snippet.authorChannelId?.value || snippet.authorChannelId,
      authorProfileUrl: snippet.authorProfileImageUrl,
      likeCount: snippet.likeCount || 0,
      replyCount: snippet.totalReplyCount || 0,
      isPublic: !snippet.moderationReason,
      parentId,
      publishedAt: snippet.publishedAt,
      updatedAt: snippet.updatedAt,
    };
  }
}

export default YouTubeApiClient;
