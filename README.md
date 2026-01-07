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

| Command                 | Description                            |
| ----------------------- | -------------------------------------- |
| `pnpm dev`              | Start backend and frontend in parallel |
| `pnpm backend:dev`      | Start backend development server       |
| `pnpm frontend:dev`     | Start frontend development server      |
| `pnpm scrape`           | Run scraper once                       |
| `pnpm scrape:scheduled` | Run scheduler (continuous)             |
| `pnpm prisma:studio`    | Open Prisma Studio                     |
| `pnpm prisma:migrate`   | Run database migrations                |
| `pnpm build`            | Build all packages                     |

## API Endpoints

| Endpoint                                    | Description                 |
| ------------------------------------------- | --------------------------- |
| `GET /health`                               | Health check                |
| `GET /api/stats/daily`                      | Daily statistics            |
| `GET /api/stats/range?days=7`               | Statistics for date range   |
| `GET /api/tweets/recent?limit=20`           | Recent tweets               |
| `GET /api/tweets/sentiment/:sentiment`      | Tweets by sentiment         |
| `GET /api/analytics/sentiment-trend?days=7` | Sentiment trend             |
| `GET /api/analytics/top-keywords?limit=50`  | Top keywords                |
| `GET /api/scraper/runs`                     | Scraper run history         |
| `GET /docs`                                 | API documentation (Swagger) |

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

## DQM and Sentiment Analysis Formulas

### Data Quality Management (DQM) Formula

The DQM system validates and filters tweets before sentiment analysis through a comprehensive quality scoring system.

#### Quality Score Calculation

```
Quality Score = 1.0 - Penalties
```

**Penalty System:**

| Check               | Penalty | Description                            |
| ------------------- | ------- | -------------------------------------- |
| `isDuplicate`       | -0.5    | Near-duplicate detected in last 7 days |
| `!isLanguageValid`  | -0.4    | Tweet not in Indonesian                |
| `!isMinLength`      | -0.2    | Tweet too short                        |
| `!isMaxLength`      | -0.1    | Tweet exceeds maximum length           |
| `isBot`             | -0.6    | Bot or spam detected                   |
| `!hasValidUrls`     | -0.1    | Too many URLs                          |
| `!hasValidMentions` | -0.1    | Too many mentions                      |

**Pass Threshold:** Score ≥ `QUALITY_THRESHOLD` AND language is valid

#### DQM Validation Checks

**1. Duplicate Detection**

```
Text similarity based on first 50 characters
Similar if: count(tweets with same prefix in last 7 days) > 0
```

**2. Language Validation**

```
Indonesian Markers: yang, dan, di, ke, dari, untuk, dengan, adalah, ini, itu, juga, atau, karena, tapi, kalau, dll.
English Markers: the, and, is, to, of, in, for, with, this, that, are, was, were, been, being

Valid if: count(Indonesian markers) ≥ count(English markers)
```

**3. Length Validation**

```
Minimum: MIN_TWEET_LENGTH (and > 0 characters)
Maximum: MAX_TWEET_LENGTH
```

**4. Bot Detection**

```
Username Patterns:
- /bot\d*$/i (ends with bot and numbers)
- /_bot_/i (contains bot with underscores)
- /^auto/i (starts with auto)
- /@.*@.*\./i (email-like format)
- /\d{5,}$/ (ends with 5+ numbers)

Spam Patterns:
- /(buy|get|free).{0,20}(follower|like|retweet)/i
- /https?:\/\/\S{20,}/ (very long URLs)
- /\.{4,}/ (multiple dots)
- /^(.)\1{10,}/ (repeated characters)

Bot if: username pattern matches OR spam pattern matches
```

**5. URL/Mention Validation**

```
Max URLs: MAX_URLS (default: 3)
Max Mentions: MAX_MENTIONS (default: 5)
```

### Sentiment Analysis Formula

#### Token Processing Pipeline

**Step 1: Tokenization**

```
tokens = text
  .toLowerCase()
  .replace(/[^\w\s]/g, ' ')      # Remove punctuation
  .replace(/\d+/g, '')             # Remove numbers
  .split(/\s+/)                   # Split by whitespace
  .filter(word => word.length > 2) # Remove words ≤ 2 chars
```

**Step 2: Stopword Removal**

```
tokensWithoutStopwords = tokens.filter(
  token => !indonesianStopwords.has(token)
)
```

Indonesian stopwords (432 words): yang, dan, di, ke, dari, untuk, dengan, adalah, ini, itu, juga, atau, karena, tapi, kalau, dll.

**Step 3: Stemming**

```
stemmed = IndonesianStemmer.stem(word)

Suffixes removed: ['kan', 'an', 'i', 'nya', 'ku', 'mu']
Prefixes removed: ['di', 'ke', 'me', 'mem', 'men', 'meng', 'meny', 'pe', 'pem', 'pen', 'peng', 'peny', 'per', 'ber', 'ter', 'se']
```

#### Sentiment Score Calculation

**Step 1: Find Sentiment Matches**

```
positiveMatches = tokensWithoutStopwords.filter(
  token => getSentimentScore(token) > 0
)
negativeMatches = tokensWithoutStopwords.filter(
  token => getSentimentScore(token) < 0
)
```

**Step 2: Calculate Raw Score**

```
rawScore = (positiveMatches.length × 1.0) - (negativeMatches.length × 1.0)
```

**Step 3: Apply Negation Handling**

```
Negation Words: tidak, bukan, tanpa, belum, jangan, nggak, enggak, tak

if (hasNegation(text)):
  rawScore = rawScore × (-0.5)  # Invert and reduce impact
```

**Step 4: Apply Booster Words**

```
Booster Words: sangat, amat, terlalu, benar-benar, sungguh, sekali

if (text contains booster word):
  rawScore = rawScore × 1.5
```

**Step 5: Extract Nutrition Context**

```
nutritionKeywords: gizi, nutrisi, makan, makanan, minum, minuman, diet,
  protein, karbohidrat, lemak, vitamin, mineral, serat, sayur, buah,
  stunting, malnutrisi, sehat, sakit, imun, tumbuh, kembang, anak,
  balita, ibu, hamil, menyusui, asi, mpasi, dll.

nutritionContext = extractNutritionKeywords(originalText)
```

**Step 6: Apply Nutrition Relevance Weighting**

```
nutritionWeight = 1 + (nutritionContext.length × 0.15)
weightedScore = rawScore × nutritionWeight
```

**Step 7: Normalize to [-1, 1] Range**

```
finalScore = weightedScore / 3
finalScore = max(-1, min(1, finalScore))
```

#### Sentiment Label Determination

```
if (weightedScore > 1.5):
  label = 'POSITIVE'
else if (weightedScore < -1.5):
  label = 'NEGATIVE'
else if (positiveMatches.length > 0 AND negativeMatches.length > 0):
  label = 'MIXED'
else:
  label = 'NEUTRAL'
```

#### Confidence Calculation

```
totalMatches = positiveMatches.length + negativeMatches.length
confidence = min(1.0, (totalMatches / 4) + 0.3)
```

Range: [0.3, 1.0] - Higher confidence with more sentiment matches

### Complete Example

**Tweet:** "Makanan sangat bagus, anak saya sehat dan tumbuh dengan baik berkat program MBG"

#### DQM Process

```
✓ Not duplicate
✓ Language valid (Indonesian)
✓ Length OK
✓ Not bot
✓ URLs: 0
✓ Mentions: 0

Quality Score: 1.0 → PASSED
```

#### Text Preprocessing

```
cleanedText = "Makanan sangat bagus anak saya sehat dan tumbuh dengan baik berkat program mbg"
normalizedText = "makanan sangat bagus anak saya sehat dan tumbuh dengan baik berkat program mbg"
```

#### Tokenization & Stopword Removal

```
tokens: ['makanan', 'sangat', 'bagus', 'anak', 'saya', 'sehat', 'dan', 'tumbuh', 'dengan', 'baik', 'berkat', 'program', 'mbg']
tokensWithoutStopwords: ['makanan', 'sangat', 'bagus', 'sehat', 'tumbuh', 'baik', 'berkat', 'program', 'mbg']
```

#### Sentiment Matching

```
positiveMatches: ['sangat', 'bagus', 'sehat', 'baik'] (4 matches)
negativeMatches: [] (0 matches)
```

#### Score Calculation

```
rawScore = (4 × 1.0) - (0 × 1.0) = 4.0
hasNegation = false
hasBooster = true (contains 'sangat')
rawScore = 4.0 × 1.5 = 6.0
nutritionContext = ['makanan', 'sehat', 'tumbuh', 'mbg'] (4 keywords)
nutritionWeight = 1 + (4 × 0.15) = 1.6
weightedScore = 6.0 × 1.6 = 9.6
finalScore = 9.6 / 3 = 3.2
finalScore = max(-1, min(1, 3.2)) = 1.0
```

#### Final Classification

```
weightedScore (9.6) > 1.5 → label = 'POSITIVE'
confidence = min(1.0, (4 / 4) + 0.3) = 1.0

Result:
{
  "sentimentLabel": "POSITIVE",
  "sentimentScore": 1.0,
  "confidence": 1.0,
  "details": {
    "positiveMatches": ["sangat", "bagus", "sehat", "baik"],
    "negativeMatches": [],
    "nutritionContext": ["makanan", "sehat", "tumbuh", "mbg"],
    "weightedScore": 9.6
  }
}
```

### Token and Feature Definitions

#### Tokens

Tokens are the basic units of text analysis, created through tokenization, stopword removal, and stemming.

#### Sentiment Lexicon (187 words)

**Positive Words (+1):**

- General: baik, bagus, sangat bagus, memuaskan, mantap, hebat, oke, puas, senang, terbantu, bermanfaat, sesuai, tepat sasaran, mudah, jelas, lengkap, cepat, terjangkau, murah, dll.
- Nutrition-specific: sehat, bergizi, nutritif, berkualitas, segar, enak, layak, memadai, terpenuhi, gizi tercukupi, makan teratur, porsi cukup, menu bervariasi, protein cukup, sayur cukup, buah cukup, dll.

**Negative Words (-1):**

- General: biasa saja, standar, netral, tidak masalah, kurang, kurang baik, tidak baik, buruk, sangat buruk, mengecewakan, kecewa, sedih, khawatir, cemas, stress, lapar, dll.
- Nutrition-specific: kekurangan gizi, gizi kurang, gizi buruk, stunting, kurus, wasting, anemia, kurang darah, bb kurang, nafsu makan turun, sakit-sakitan, makanan tidak sehat, junk food, dll.

#### Nutrition Keywords

Core terms: gizi, nutrisi, makan, makanan, minum, minuman, diet, protein, karbohidrat, lemak, vitamin, mineral, serat, sayur, buah

Health indicators: stunting, malnutrisi, buruk, sehat, sakit, imun, daya tahan, tumbuh, kembang, anak, balita, ibu, hamil, menyusui, asi, mpasi

Policy/program terms: mbg, makan siang gratis, makan bergizi gratis, program, kebijakan, pemerintah, subsidi, bantuan, bansos, pangan, ketahanan pangan, kedaulatan pangan, swasembada

#### Stopwords (432 words)

Common Indonesian words removed to focus on meaningful content: yang, dan, di, ke, dari, untuk, dengan, adalah, ini, itu, juga, atau, karena, tapi, kalau, dll.

## Target

- **50 unique tweets per day** (after DQM filtering)
- **Scraping every 6 hours** (00:00, 06:00, 12:00, 18:00 WIB)
- **~8-10 tweets per batch** per keyword

## License

MIT

## Contributors

Built for nutrition sentiment analysis and food security research.
