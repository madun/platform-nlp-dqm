import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getRecentYouTubeComments,
  getYouTubeCommentsBySentiment,
} from '../services/api';
import { SentimentLabel } from '@memphis/shared';
import { ThumbsUp, MessageCircle, Youtube } from 'lucide-react';

const sentimentColors: Record<SentimentLabel, string> = {
  POSITIVE: 'bg-green-100 text-green-700',
  NEGATIVE: 'bg-red-100 text-red-700',
  NEUTRAL: 'bg-gray-100 text-gray-700',
  MIXED: 'bg-yellow-100 text-yellow-700',
};

export default function YouTubeCommentsPage() {
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['youtube-comments', filter, page],
    queryFn: () =>
      filter === 'all'
        ? getRecentYouTubeComments(20, page * 20)
        : getYouTubeCommentsBySentiment(filter, 20),
  });

  const comments = data?.comments || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Youtube className="w-6 h-6 text-red-600" />
            YouTube Comments
          </h1>
          <p className="text-gray-500">Recent YouTube comments with sentiment analysis</p>
        </div>

        {/* Filter */}
        <div className="flex space-x-2">
          {(['all', 'POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED'] as const).map((sentiment) => (
            <button
              key={sentiment}
              onClick={() => {
                setFilter(sentiment);
                setPage(0);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === sentiment
                  ? sentiment === 'all'
                    ? 'bg-gray-800 text-white'
                    : sentimentColors[sentiment]
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {sentiment === 'all' ? 'All' : sentiment.charAt(0) + sentiment.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Comments List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading comments...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">Error loading comments</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No comments found. Run the YouTube scraper to collect comments.
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment: any) => (
            <div key={comment.id} className="card">
              {/* Video Context */}
              {comment.videoTitle && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3 pb-3 border-b border-gray-100">
                  <Youtube className="w-4 h-4 text-red-500" />
                  <span className="font-medium text-gray-700">{comment.videoTitle}</span>
                  <span>•</span>
                  <span>{comment.videoChannelTitle}</span>
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {comment.authorProfileUrl ? (
                    <img
                      src={comment.authorProfileUrl}
                      alt={comment.authorDisplayName}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-600 font-medium">
                        {comment.authorDisplayName?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      {comment.authorDisplayName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(comment.publishedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    sentimentColors[comment.sentimentLabel as SentimentLabel]
                  }`}
                >
                  {comment.sentimentLabel}
                </span>
              </div>

              {/* Comment Text */}
              <p className="text-gray-700 mb-3 whitespace-pre-wrap">
                {comment.cleanedText || comment.text}
              </p>

              {/* Engagement Metrics */}
              <div className="flex items-center space-x-6 text-sm text-gray-500 mb-3">
                <div className="flex items-center gap-1">
                  <ThumbsUp className="w-4 h-4" />
                  <span>{comment.likeCount || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  <span>{comment.replyCount || 0}</span>
                </div>
                <div>
                  Score: <span className="font-medium">{(comment.sentimentScore || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Keywords */}
              {comment.keywords && comment.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {comment.keywords.slice(0, 5).map((kw: any) => (
                    <span
                      key={kw.keyword || kw}
                      className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                    >
                      {kw.keyword || kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {data.total > 20 && (
            <div className="flex items-center justify-center space-x-2 pt-4">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-gray-600">
                Page {page + 1} of {Math.ceil(data.total / 20)}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * 20 >= data.total}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
