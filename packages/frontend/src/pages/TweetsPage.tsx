import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRecentTweets, getTweetsBySentiment } from '../services/api';
import { SentimentLabel } from '@memphis/shared';

const sentimentColors: Record<SentimentLabel, string> = {
  POSITIVE: 'bg-green-100 text-green-700',
  NEGATIVE: 'bg-red-100 text-red-700',
  NEUTRAL: 'bg-gray-100 text-gray-700',
  MIXED: 'bg-yellow-100 text-yellow-700',
};

export default function TweetsPage() {
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tweets', filter, page],
    queryFn: () =>
      filter === 'all'
        ? getRecentTweets(20, page * 20)
        : getTweetsBySentiment(filter, 20),
  });

  const tweets = data?.tweets || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tweets</h1>
          <p className="text-gray-500">Recent tweets with sentiment analysis</p>
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

      {/* Tweets List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading tweets...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">Error loading tweets</div>
      ) : tweets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No tweets found</div>
      ) : (
        <div className="space-y-4">
          {tweets.map((tweet: any) => (
            <div key={tweet.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 font-medium">
                      {tweet.authorUsername?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {tweet.authorDisplayName || tweet.authorUsername}
                    </p>
                    <p className="text-sm text-gray-500">@{tweet.authorUsername}</p>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    sentimentColors[tweet.sentimentLabel as SentimentLabel]
                  }`}
                >
                  {tweet.sentimentLabel}
                </span>
              </div>

              <p className="text-gray-700 mb-3">{tweet.cleanedText || tweet.text}</p>

              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>♥ {tweet.likes || 0}</span>
                <span>↻ {tweet.retweets || 0}</span>
                <span>↩ {tweet.replies || 0}</span>
                <span>
                  Score: {(tweet.sentimentScore || 0).toFixed(2)}
                </span>
              </div>

              {tweet.keywords && tweet.keywords.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tweet.keywords.slice(0, 5).map((kw: any) => (
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
