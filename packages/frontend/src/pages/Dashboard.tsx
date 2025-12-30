import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getDailyStats } from "../services/api";

export default function Dashboard() {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["daily-stats"],
    queryFn: getDailyStats,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">
          Error loading dashboard {error.message}
        </div>
      </div>
    );
  }

  const sentimentPercent =
    stats.tweetsAnalyzed > 0
      ? ((stats.sentimentPositive +
          stats.sentimentNegative +
          stats.sentimentMixed) /
          stats.tweetsAnalyzed) *
        100
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Nutrition sentiment analysis for Indonesian food security topics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Tweets Scraped */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Tweets Scraped</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.tweetsScraped}
              </p>
              <p className="text-xs text-gray-400 mt-1">Today</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Quality Passed */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Quality Passed</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.tweetsPassedDqm}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {stats.tweetsScraped > 0
                  ? `${((stats.tweetsPassedDqm / stats.tweetsScraped) * 100).toFixed(1)}%`
                  : "0%"}{" "}
                pass rate
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Analyzed */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Analyzed</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.tweetsAnalyzed}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Target: {stats.tweetsAnalyzed}/50
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Avg Sentiment */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Sentiment</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.avgSentimentScore.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Score (-1 to 1)</p>
            </div>
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                stats.avgSentimentScore > 0.1
                  ? "bg-green-100"
                  : stats.avgSentimentScore < -0.1
                    ? "bg-red-100"
                    : "bg-gray-100"
              }`}
            >
              {stats.avgSentimentScore > 0.1 ? (
                <TrendingUp className="w-6 h-6 text-green-600" />
              ) : stats.avgSentimentScore < -0.1 ? (
                <TrendingDown className="w-6 h-6 text-red-600" />
              ) : (
                <Minus className="w-6 h-6 text-gray-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sentiment Distribution */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Sentiment Distribution
        </h2>
        <div className="space-y-4">
          {/* Positive */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-green-600">
                Positive
              </span>
              <span className="text-sm text-gray-600">
                {stats.sentimentPositive}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-green-500 h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${stats.tweetsAnalyzed > 0 ? (stats.sentimentPositive / stats.tweetsAnalyzed) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Neutral */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-600">Neutral</span>
              <span className="text-sm text-gray-600">
                {stats.sentimentNeutral}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gray-400 h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${stats.tweetsAnalyzed > 0 ? (stats.sentimentNeutral / stats.tweetsAnalyzed) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Negative */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-red-600">Negative</span>
              <span className="text-sm text-gray-600">
                {stats.sentimentNegative}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-red-500 h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${stats.tweetsAnalyzed > 0 ? (stats.sentimentNegative / stats.tweetsAnalyzed) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Mixed */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-yellow-600">Mixed</span>
              <span className="text-sm text-gray-600">
                {stats.sentimentMixed}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-yellow-500 h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${stats.tweetsAnalyzed > 0 ? (stats.sentimentMixed / stats.tweetsAnalyzed) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top Keywords */}
      {stats.topKeywords && stats.topKeywords.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Top Keywords
          </h2>
          <div className="flex flex-wrap gap-2">
            {stats.topKeywords.slice(0, 15).map((kw: any) => (
              <span
                key={kw.keyword || kw}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                {kw.keyword || kw} ({kw.count || kw})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
