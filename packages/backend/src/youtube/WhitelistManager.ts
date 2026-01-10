/**
 * YouTube Whitelist Manager
 * CRUD operations for whitelisted videos and channels
 */

import prisma from '../database/connection.js';

export interface WhitelistItem {
  id: string;
  targetType: 'video' | 'channel';
  targetId: string;
  title?: string;
  isActive: boolean;
  priority: number;
  maxComments?: number;
  lastCollectedAt?: Date;
  totalComments: number;
}

export class WhitelistManager {
  /**
   * Add video or channel to whitelist
   */
  async addToWhitelist(
    targetType: 'video' | 'channel',
    targetId: string,
    options?: {
      title?: string;
      priority?: number;
      maxComments?: number;
      notes?: string;
    }
  ): Promise<WhitelistItem> {
    return await prisma.youTubeWhitelist.upsert({
      where: {
        targetType_targetId: {
          targetType,
          targetId,
        },
      },
      update: {
        isActive: true,
        ...(options?.title && { title: options.title }),
        ...(options?.priority !== undefined && { priority: options.priority }),
        ...(options?.maxComments && { maxComments: options.maxComments }),
        ...(options?.notes && { notes: options.notes }),
      },
      create: {
        targetType,
        targetId,
        title: options?.title,
        priority: options?.priority || 0,
        maxComments: options?.maxComments,
        notes: options?.notes,
        isActive: true,
      },
    });
  }

  /**
   * Remove from whitelist (soft delete)
   */
  async removeFromWhitelist(targetType: 'video' | 'channel', targetId: string): Promise<void> {
    await prisma.youTubeWhitelist.update({
      where: {
        targetType_targetId: {
          targetType,
          targetId,
        },
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Get active whitelist
   */
  async getActiveWhitelist(targetType?: 'video' | 'channel'): Promise<WhitelistItem[]> {
    const where: any = {
      isActive: true,
    };

    if (targetType) {
      where.targetType = targetType;
    }

    return await prisma.youTubeWhitelist.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * Get videos to collect
   */
  async getVideosToCollect(): Promise<Array<{ id: string; maxComments?: number }>> {
    const items = await this.getActiveWhitelist('video');

    return items
      .filter((v) => v.targetType === 'video')
      .map((v) => ({
        id: v.targetId,
        maxComments: v.maxComments,
      }));
  }

  /**
   * Update collection stats
   */
  async updateCollectionStats(
    targetType: 'video' | 'channel',
    targetId: string,
    commentsCollected: number
  ): Promise<void> {
    await prisma.youTubeWhitelist.update({
      where: {
        targetType_targetId: {
          targetType,
          targetId,
        },
      },
      data: {
        lastCollectedAt: new Date(),
        totalComments: {
          increment: commentsCollected,
        },
      },
    });
  }

  /**
   * Get whitelist statistics
   */
  async getStats(): Promise<{
    totalVideos: number;
    totalChannels: number;
    totalComments: number;
    active: number;
  }> {
    const [total, byType] = await Promise.all([
      prisma.youTubeWhitelist.count({ where: { isActive: true } }),
      prisma.youTubeWhitelist.groupBy({
        by: ['targetType'],
        where: { isActive: true },
        _sum: { totalComments: true },
        _count: true,
      }),
    ]);

    const videos = byType.find((t) => t.targetType === 'video');
    const channels = byType.find((t) => t.targetType === 'channel');

    return {
      totalVideos: videos?._count || 0,
      totalChannels: channels?._count || 0,
      totalComments:
        (videos?._sum.totalComments || 0) + (channels?._sum.totalComments || 0),
      active: total,
    };
  }
}

export default WhitelistManager;
