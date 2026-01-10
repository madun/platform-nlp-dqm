import {
  BarChart2,
  Database,
  Search,
  Settings,
  ShieldCheck,
  Twitter,
  Youtube,
} from "lucide-react";

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Social Intelligence Dashboard
        </h1>
        <p className="text-gray-500 mt-1">
          Platform-NLP-DQM: Monitoring Public Sentiment on Food Security
        </p>
      </div>

      {/* Hero Section */}
      <div className="card bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
        <h2 className="text-2xl font-bold mb-4">Welcome to the Platform</h2>
        <p className="text-lg opacity-90 leading-relaxed">
          This application is designed to analyze public sentiment regarding
          Indonesian food security programs (e.g., "Makan Bergizi Gratis"). It aggregated data from social media, validates its quality (DQM),
          and applies Natural Language Processing (NLP) to extract meaningful insights.
        </p>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Search className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Multi-Platform Scraping
              </h3>
              <p className="text-gray-500 mt-2">
                Automated data collection from major social media platforms:
              </p>
              <div className="flex space-x-4 mt-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Twitter className="w-4 h-4 mr-1 text-blue-400" /> Twitter/X
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Youtube className="w-4 h-4 mr-1 text-red-500" /> YouTube
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Data Quality Management (DQM)
              </h3>
              <p className="text-gray-500 mt-2">
                Ensures high-quality insights by filtering out noise:
              </p>
              <ul className="list-disc list-inside mt-2 text-sm text-gray-600 space-y-1">
                <li>Language validation (Indonesian-focus)</li>
                <li>Spam and bot detection</li>
                <li>Relevance scoring for food security topics</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Database className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Natural Language Processing
              </h3>
              <p className="text-gray-500 mt-2">
                Advanced text analysis powered by AI/ML algorithms:
              </p>
              <ul className="list-disc list-inside mt-2 text-sm text-gray-600 space-y-1">
                <li>Sentiment Analysis (Positive, Negative, Neutral)</li>
                <li>Keyword & Topic Extraction</li>
                <li>Trend detection over time</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <BarChart2 className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Actionable Analytics
              </h3>
              <p className="text-gray-500 mt-2">
                Visualizing public opinion to support decision making:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                  Daily Trends
                </span>
                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                  Sentiment Distribution
                </span>
                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                  Top Issues
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tech Stack Footer */}
      <div className="border-t border-gray-200 pt-8 mt-8">
        <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="w-4 h-4 mr-2" /> System Architecture
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block mb-1">Frontend</span>
            <span className="font-medium">React + Vite + Tailwind</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Backend</span>
            <span className="font-medium">Fastify + Node.js</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Database</span>
            <span className="font-medium">PostgreSQL + Prisma</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Scraping</span>
            <span className="font-medium">Puppeteer + YouTube API</span>
          </div>
        </div>
      </div>
    </div>
  );
}
