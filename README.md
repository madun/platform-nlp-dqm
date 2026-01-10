# Memphis - Multi-Platform Social Media Sentiment Analysis for Nutrition

A monorepo application that scrapes Twitter/X and YouTube for Indonesian nutrition-related content, performs sentiment analysis using Natural Language Processing, and manages data quality through a comprehensive DQM pipeline.

## Features

- **Twitter/X Scraper**: Puppeteer-based scraper (no API required)
- **YouTube Comment Collector**: YouTube Data API v3 integration with whitelist support
- **Data Quality Management (DQM)**: Validates and filters content for quality (separate pipelines for Twitter/YouTube)
- **Sentiment Analysis**: Indonesian NLP with 270+ word nutrition-specific lexicon
- **Keyword Extraction**: TF-IDF based keyword extraction
- **REST API**: Fastify-based API for data access
- **Dashboard**: React + Vite frontend with multi-platform support
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
- **Twitter Scraping**: Puppeteer (headless browser automation)
- **YouTube Collection**: YouTube Data API v3 with axios
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

# Add YouTube API key (get from https://console.cloud.google.com/)
# YOUTUBE_API_KEY=your_api_key_here
# YOUTUBE_MAX_COMMENTS_PER_VIDEO=1000

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
# Run Twitter scraper once
pnpm scrape

# Run YouTube scraper once
pnpm scrape:youtube

# Run both scrapers
pnpm scrape:all

# Run scheduled scraper (continuous)
pnpm scrape:scheduled
```

#### YouTube Scraping Setup

Before running `pnpm scrape:youtube`, you must whitelist videos/channels:

```sql
-- Add video to whitelist (example: MBG program videos)
INSERT INTO youtube_whitelist (target_type, target_id, title, max_comments, is_active)
VALUES
  ('video', 'YOUTUBE_VIDEO_ID', 'Video title', 1000, true),
  ('channel', 'YOUTUBE_CHANNEL_ID', 'Channel name', 5000, true);

-- View whitelist
SELECT * FROM youtube_whitelist WHERE is_active = true;

-- Remove from whitelist
DELETE FROM youtube_whitelist WHERE target_id = 'YOUTUBE_VIDEO_ID';
```

**Notes:**
- `target_type`: 'video' or 'channel'
- `target_id`: YouTube video ID or channel ID
- `max_comments`: Maximum comments to collect per target
- Use `pnpm prisma:studio` to manage whitelist via GUI

## Available Scripts

| Command                 | Description                            |
| ----------------------- | -------------------------------------- |
| `pnpm dev`              | Start backend and frontend in parallel |
| `pnpm backend:dev`      | Start backend development server       |
| `pnpm frontend:dev`     | Start frontend development server      |
| `pnpm scrape`           | Run Twitter scraper once               |
| `pnpm scrape:youtube`   | Run YouTube comment collector once     |
| `pnpm scrape:all`       | Run both scrapers                      |
| `pnpm scrape:scheduled` | Run scheduler (continuous)             |
| `pnpm prisma:studio`    | Open Prisma Studio                     |
| `pnpm prisma:migrate`   | Run database migrations                |
| `pnpm build`            | Build all packages                     |

## API Endpoints

### General
| Endpoint                  | Description           |
| ------------------------- | --------------------- |
| `GET /health`             | Health check          |
| `GET /docs`               | API documentation (Swagger) |

### Twitter/X
| Endpoint                                    | Description                 |
| ------------------------------------------- | --------------------------- |
| `GET /api/tweets/recent?limit=20`           | Recent tweets               |
| `GET /api/tweets/sentiment/:sentiment`      | Tweets by sentiment         |
| `GET /api/scraper/runs`                     | Scraper run history         |

### YouTube
| Endpoint                                    | Description                 |
| ------------------------------------------- | --------------------------- |
| `GET /api/youtube/comments/recent?limit=20&sentiment=POSITIVE` | Recent YouTube comments (optional sentiment filter) |
| `GET /api/youtube/whitelist`                | Get whitelisted videos/channels |
| `POST /api/youtube/whitelist`               | Add video/channel to whitelist |
| `DELETE /api/youtube/whitelist/:id`         | Remove from whitelist       |
| `GET /api/youtube/collector/runs`           | YouTube collector run history |

### Analytics (Multi-Platform)
| Endpoint                                    | Description                 |
| ------------------------------------------- | --------------------------- |
| `GET /api/stats/daily?platform=all`         | Daily statistics (platform: all|twitter|youtube) |
| `GET /api/stats/range?days=7&platform=all`  | Statistics for date range   |
| `GET /api/analytics/sentiment-trend?days=7&platform=all` | Sentiment trend by platform |
| `GET /api/analytics/top-keywords?limit=50`  | Top keywords                |

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

The sentiment analyzer uses a custom Indonesian lexicon with **270+ words** categorized as:

### Positive Words (~100 words)
- **General**: baik, bagus, sangat bagus, memuaskan, mantap, hebat, oke, puas, senang, terbantu, bermanfaat, sesuai, tepat sasaran, dll.
- **YouTube/Informal**: keren, keren banget, sip, setuju, dukung, support, apresiasi, makasih, bangga, suka, semangat, dll.
- **Program-specific**: mbg, makan siang gratis, makan bergizi gratis, gratis, bantuan, bansos, subsidi
- **Nutrition-positive**: sehat, bergizi, nutritif, berkualitas, segar, enak, gizi tercukupi, porsi cukup, dll.

### Negative Words (~170 words)
- **General**: kurang, buruk, sangat buruk, mengecewakan, kecewa, sedih, khawatir, cemas, stress, lapar, dll.
- **YouTube/Informal**: paksa, dipaksa, korupsi, bodong, bohong, hoax, omong kosong, miskin, susah, benci, marah, dll.
- **Political/Program criticisms**: paksakan, menggaet, pencitraan, gimmick, tipu daya, janji palsu, dagang elektabilitas, dll.
- **Nutrition-negative**: stunting, kurus, wasting, anemia, gizi kurang, gizi buruk, junk food, kelaparan, dll.

## DQM and Sentiment Analysis Formulas

### Data Quality Management (DQM)

The DQM system validates and filters content before sentiment analysis through separate pipelines for Twitter and YouTube.

#### Platform-Specific Adjustments

| Parameter         | Twitter    | YouTube    | Reason                                    |
| ----------------- | ---------- | ---------- | ----------------------------------------- |
| Min Length        | 20 chars   | 10 chars   | YouTube comments are often shorter        |
| Max Length        | 500 chars  | 5000 chars | YouTube allows longer comments            |
| Spam Patterns     | Twitter-specific | YouTube-specific | Different platform spam behaviors |

**YouTube-Specific Checks:**
- Longer text tolerance (10-5000 chars vs 20-500 for Twitter)
- YouTube spam patterns: "sub4sub", "check my channel", "first!"
- Excessive emoji detection (common on YouTube)
- Video context preservation (videoId, channel info)

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
Negation Words: tidak, bukan, tanpa, belum, jangan, nggak, enggak, tak, gak, jgn, g

if (hasNegation(text)):
  rawScore = rawScore × (-0.5)  # Invert and reduce impact
```

**Step 4: Apply Booster Words**

```
Booster Words: sangat, amat, terlalu, benar-benar, sungguh, sekali, banget, bgt, parah

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
if (weightedScore > 0.8):
  label = 'POSITIVE'
else if (weightedScore < -0.8):
  label = 'NEGATIVE'
else if (positiveMatches.length > 0 AND negativeMatches.length > 0):
  label = 'MIXED'
else:
  label = 'NEUTRAL'
```

**Note:** Thresholds set at 0.8/-0.8 to balance sensitivity for shorter YouTube comments while maintaining accuracy for longer Twitter content.

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

#### Sentiment Lexicon (270+ words)

**Positive Words (+1):**

- General: baik, bagus, sangat bagus, memuaskan, mantap, hebat, oke, puas, senang, terbantu, bermanfaat, sesuai, tepat sasaran, dll.
- YouTube/Informal: keren, keren banget, sip, setuju, dukung, support, apresiasi, makasih, bangga, suka, semangat, terus, lanjut, dll.
- Nutrition-specific: sehat, bergizi, nutritif, berkualitas, segar, enak, layak, memadai, terpenuhi, gizi tercukupi, dll.

**Negative Words (-1):**

- General: biasa saja, standar, netral, kurang, kurang baik, tidak baik, buruk, sangat buruk, mengecewakan, kecewa, sedih, dll.
- YouTube/Informal: paksa, dipaksa, korupsi, bodong, bohong, hoax, omong kosong, miskin, susah, benci, marah, kecewa, dll.
- Political criticisms: paksakan, menggaet, pencitraan, gimmick, tipu daya, janji palsu, dagang elektabilitas, dll.
- Nutrition-specific: kekurangan gizi, gizi kurang, gizi buruk, stunting, kurus, wasting, anemia, kelaparan, dll.

#### Nutrition Keywords

Core terms: gizi, nutrisi, makan, makanan, minum, minuman, diet, protein, karbohidrat, lemak, vitamin, mineral, serat, sayur, buah

Health indicators: stunting, malnutrisi, buruk, sehat, sakit, imun, daya tahan, tumbuh, kembang, anak, balita, ibu, hamil, menyusui, asi, mpasi

Policy/program terms: mbg, makan siang gratis, makan bergizi gratis, program, kebijakan, pemerintah, subsidi, bantuan, bansos, pangan, ketahanan pangan, kedaulatan pangan, swasembada

#### Stopwords (432 words)

Common Indonesian words removed to focus on meaningful content: yang, dan, di, ke, dari, untuk, dengan, adalah, ini, itu, juga, atau, karena, tapi, kalau, dll.

## Targets

### Twitter/X
- **50 unique tweets per day** (after DQM filtering)
- **Scraping every 6 hours** (00:00, 06:00, 12:00, 18:00 WIB)
- **~8-10 tweets per batch** per keyword

### YouTube
- **Whitelist-based collection** (manual video/channel selection)
- **Configurable max comments per target** (default: 1000)
- **On-demand collection** via `pnpm scrape:youtube`

### Typical Sentiment Distribution (After Improvements)
Based on 2,000+ YouTube comments analysis:
- **NEUTRAL**: ~40-45% (short reactions, questions, factual statements)
- **POSITIVE**: ~30-35% (support, praise, agreement)
- **NEGATIVE**: ~15-20% (criticism, complaints, disagreement)
- **MIXED**: ~5-10% (balanced opinions)

## Recent Improvements

### Sentiment Analysis Enhancements (2026)
1. **Lowered thresholds** from 1.5/-1.5 to 0.8/-0.8 for better sensitivity with shorter comments
2. **Expanded lexicon** from 187 to 270+ words with Indonesian YouTube-specific slang
3. **Fixed multi-word phrase matching** to check full lexicon instead of hardcoded phrases
4. **Added informal negation words**: gak, tak, jgn, g
5. **Added booster words**: banget, bgt, parah
6. **Added political/program criticisms**: paksakan, menggaet, pencitraan, omong kosong, etc.

### Result
**Before**: 96.8% NEUTRAL (incorrect - missing sentiment words)
**After**: 42.9% NEUTRAL, 33.6% POSITIVE, 17.5% NEGATIVE, 6.0% MIXED (accurate distribution)

## License

MIT

## Contributors

Built for nutrition sentiment analysis and food security research across Twitter/X and YouTube platforms.
