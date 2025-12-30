# Memphis - Twitter/X Scraper with NLP & DQM for Nutrition Sentiment Analysis

A monorepo application that scrapes Twitter/X for Indonesian nutrition-related content, performs sentiment analysis using Natural Language Processing, and manages data quality through a comprehensive DQM pipeline.

## Features

- **Twitter/X Scraper**: Puppeteer-based scraper (no API required)
- **Data Quality Management (DQM)**: Validates and filters tweets for quality
- **Sentiment Analysis**: Indonesian NLP with nutrition-specific lexicon
- **Keyword Extraction**: TF-IDF based keyword extraction
- **REST API**: Fastify-based API for data access
- **Dashboard**: React + Vite frontend for visualization
- **Scheduler**: Automated scraping every 6 hours

## Architecture

```
memphis/
├── packages/
│   ├── backend/          # Node.js + TypeScript + Puppeteer + PostgreSQL
│   ├── frontend/         # React + Vite + Tailwind CSS
│   └── shared/           # Shared types, NLP utilities, constants
├── pnpm-workspace.yaml
└── package.json
```

## Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Scraping**: Puppeteer (headless browser automation)
- **Database**: PostgreSQL with Prisma ORM
- **NLP**: Natural, Compromise, custom Indonesian stemmer
- **API**: Fastify with Swagger documentation
- **Scheduler**: node-cron

### Frontend
- **Framework**: React 18 with TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Data Fetching**: TanStack Query

### Shared
- **Types**: TypeScript interfaces shared across packages
- **NLP**: Indonesian stemmer, stopwords, sentiment lexicon

## Setup Instructions

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 14+

### 1. Clone and Install Dependencies

```bash
# Install pnpm if needed
npm install -g pnpm

# Install dependencies
pnpm install
```

### 2. Database Setup

```bash
# Copy environment file
cp packages/backend/.env.example packages/backend/.env

# Edit DATABASE_URL in packages/backend/.env
# Example: DATABASE_URL="postgresql://postgres:password@localhost:5432/memphis"

# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# Seed initial data
pnpm --filter backend prisma:seed
```

### 3. Build Shared Package

```bash
pnpm shared:build
```

### 4. Development Mode

```bash
# Terminal 1: Start backend API
pnpm backend:dev

# Terminal 2: Start frontend dashboard
pnpm frontend:dev
```

### 5. Manual Scraping (Optional)

```bash
# Run scraper once
pnpm scrape

# Run scheduled scraper (continuous)
pnpm scrape:scheduled
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start backend and frontend in parallel |
| `pnpm backend:dev` | Start backend development server |
| `pnpm frontend:dev` | Start frontend development server |
| `pnpm scrape` | Run scraper once |
| `pnpm scrape:scheduled` | Run scheduler (continuous) |
| `pnpm prisma:studio` | Open Prisma Studio |
| `pnpm prisma:migrate` | Run database migrations |
| `pnpm build` | Build all packages |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/stats/daily` | Daily statistics |
| `GET /api/stats/range?days=7` | Statistics for date range |
| `GET /api/tweets/recent?limit=20` | Recent tweets |
| `GET /api/tweets/sentiment/:sentiment` | Tweets by sentiment |
| `GET /api/analytics/sentiment-trend?days=7` | Sentiment trend |
| `GET /api/analytics/top-keywords?limit=50` | Top keywords |
| `GET /api/scraper/runs` | Scraper run history |
| `GET /docs` | API documentation (Swagger) |

## Keywords

The scraper searches for these Indonesian nutrition-related keywords:

- `gizi` (nutrition)
- `ketahanan pangan` (food security)
- `stunting`
- `malnutrisi` (malnutrition)
- `Makan Bergizi Gratis` (MBG - Free Nutritious Meals)
- `MBG`, `mbg`
- `Makan Siang Gratis` (Free Lunch)

## Sentiment Lexicon

The sentiment analyzer uses a custom Indonesian lexicon with 187+ words categorized as:

- **Positive**: sehat, bergizi, baik, mantap, bermanfaat, tersedia, dll.
- **Negative**: kurang, buruk, stunting, kelaparan, mahal, langka, dll.
- **Nutrition-specific**: Terms related to food, health, and policy

## Target

- **50 unique tweets per day** (after DQM filtering)
- **Scraping every 6 hours** (00:00, 06:00, 12:00, 18:00 WIB)
- **~8-10 tweets per batch** per keyword

## License

MIT

## Contributors

Built for nutrition sentiment analysis and food security research.
