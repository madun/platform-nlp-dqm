import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSentimentTrend, getTopKeywords } from '../services/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function AnalyticsPage() {
  const [days, setDays] = useState(7);

  const { data: trendData } = useQuery({
    queryKey: ['sentiment-trend', days],
    queryFn: () => getSentimentTrend(days),
  });

  const { data: keywords } = useQuery({
    queryKey: ['top-keywords'],
    queryFn: () => getTopKeywords(30),
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500">Sentiment trends and insights</p>
        </div>

        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="input"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {/* Sentiment Trend Chart */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sentiment Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="positive"
              stroke="#22c55e"
              strokeWidth={2}
              name="Positive"
            />
            <Line
              type="monotone"
              dataKey="negative"
              stroke="#ef4444"
              strokeWidth={2}
              name="Negative"
            />
            <Line
              type="monotone"
              dataKey="neutral"
              stroke="#6b7280"
              strokeWidth={2}
              name="Neutral"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Average Score Trend */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Average Sentiment Score</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trendData || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[-1, 1]} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="avgScore"
              stroke="#8b5cf6"
              strokeWidth={3}
              name="Avg Score"
              dot={{ fill: '#8b5cf6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Keywords */}
      {keywords && keywords.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Keywords</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={keywords.slice(0, 15).map((k) => ({
                keyword: k.keyword,
                count: k.count,
              }))}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="keyword" type="category" width={120} />
              <Tooltip />
              <Bar dataKey="count" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
