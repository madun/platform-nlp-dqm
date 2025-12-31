# Twitter Scraper Rate Limiting Strategy

## Overview

Twitter/X enforces strict rate limits on web scraping to prevent automated access. This document explains the rate limiting strategies implemented in our scraper to minimize the risk of being blocked.

## Rate Limiting Features

### 1. Request Throttling

The scraper implements request throttling to ensure we don't make too many requests in quick succession:

- **Minimum delay between requests**: 5 seconds
- **Delay between keywords**: 10-15 seconds (randomized)
- **Scroll delay**: 3-5 seconds (randomized)

### 2. Exponential Backoff

When a rate limit is detected, the scraper implements exponential backoff:

| Retry Attempt | Wait Time |
|---------------|-----------|
| 1st Retry     | 1 minute  |
| 2nd Retry     | 2 minutes  |
| 3rd Retry     | 4 minutes  |

Maximum retries: 3 attempts per keyword.

### 3. Automatic Rate Limit Detection

The scraper automatically detects rate limits through:

- **Error message analysis**: Catches errors containing "rate limit", "too many requests", or "429"
- **Page content scanning**: Checks for rate limit messages on the page
- **HTTP status codes**: Monitors for 429 status codes

### 4. Recovery Strategy

When a rate limit is detected:

1. Wait for the calculated delay (exponential backoff)
2. Navigate to Twitter home page to clear the rate limit state
3. Retry the search operation
4. If all retries fail, log the error and continue to next keyword

## Configuration

### Environment Variables

No additional configuration is required. The following constants are set in `TwitterScraper.ts`:

```typescript
private static readonly REQUEST_DELAY_MS = 5000;  // 5 seconds between requests
private static readonly MAX_RETRIES = 3;            // Maximum retry attempts
private static readonly RATE_LIMIT_DELAY = 60000;   // 1 minute base delay
```

### Adjusting Rate Limits

To modify rate limiting behavior, edit these constants in `TwitterScraper.ts`:

```typescript
// More aggressive (faster scraping)
private static readonly REQUEST_DELAY_MS = 3000;
private static readonly MAX_RETRIES = 5;

// More conservative (safer for long-term use)
private static readonly REQUEST_DELAY_MS = 10000;
private static readonly MAX_RETRIES = 3;
```

## Best Practices

### 1. Scrape Frequency

- **Recommended**: Run scraper once every 30-60 minutes
- **Maximum**: Once every 15-20 minutes
- **Avoid**: Continuous or frequent scraping

### 2. Keyword Selection

- Limit the number of keywords to 10-15 per run
- Avoid scraping multiple similar keywords in quick succession
- Consider spreading keywords across multiple runs

### 3. Tweet Limits

- Set reasonable `TWEETS_PER_KEYWORD` limits (50-100 per keyword)
- Higher limits increase the risk of rate limiting
- Consider incremental scraping over multiple runs

### 4. Authentication

- Always use valid Twitter credentials
- Login improves rate limits compared to anonymous scraping
- Consider using a dedicated account for scraping

### 5. Schedule Management

Use the scheduled runner instead of manual execution:

```bash
# Run scheduled scraper (recommended)
pnpm scrape:scheduled

# Manual scraping (use sparingly)
pnpm scrape
```

## Handling Rate Limits

### Temporary Rate Limits

If you see rate limit errors:

1. **Wait**: Let the scraper handle automatic retry
2. **Monitor**: Check logs for retry progress
3. **Patience**: If all retries fail, wait 10-15 minutes before retrying

### Persistent Rate Limits

If you consistently hit rate limits:

1. **Reduce frequency**: Increase time between scraper runs
2. **Fewer keywords**: Reduce the number of keywords per run
3. **Lower limits**: Decrease `TWEETS_PER_KEYWORD` in config
4. **Different accounts**: Consider using multiple Twitter accounts (with rotation)

### Account Lockouts

If your account is temporarily locked:

1. **Stop scraping**: Immediately cease all scraping operations
2. **Verify account**: Complete any verification steps from Twitter
3. **Wait**: Allow 24-48 hours before resuming
4. **Reduce intensity**: Significantly reduce scraping frequency

## Monitoring

### Logs

Rate limiting events are logged with `WARN` level:

```
23:45:12 [warn]: Rate limit detected for keyword "test". Retrying in 60 seconds... (Attempt 1/3)
23:45:12 [warn]: Rate limit detected from page content
23:45:12 [warn]: Rate limit detected during scrolling
```

### Scraper Run Tracking

The `scraperRun` table in the database tracks:
- `tweetsFound`: Number of tweets discovered
- `tweetsScraped`: Number of tweets successfully scraped
- `status`: COMPLETED, FAILED, or CANCELLED
- `errorMessage`: Details of any failures

Check this table to identify patterns in rate limiting.

## Troubleshooting

### Problem: Frequent Rate Limits

**Solution**: Increase delays
```typescript
// In TwitterScraper.ts
private static readonly REQUEST_DELAY_MS = 8000; // Increase to 8 seconds
```

**Solution**: Increase keyword delay in `index.ts`
```typescript
// In ScraperOrchestrator.run()
await this.randomDelay(15000, 20000); // Increase to 15-20 seconds
```

### Problem: Scraper Hangs

**Solution**: The scraper is likely waiting for rate limit timeout. Check logs and wait.

### Problem: Account Suspended

**Solution**: Stop scraping immediately, verify with Twitter, and wait 24-48 hours.

## Additional Recommendations

1. **Use a VPN**: Different IP addresses can help with rate limiting
2. **Proxy Rotation**: Consider using rotating proxies for large-scale scraping
3. **Headless Mode**: Use `HEADLESS=false` only for debugging, not production
4. **Database Deduplication**: The system automatically skips existing tweets
5. **Backup Strategy**: Regularly backup your database

## Summary

The implemented rate limiting strategy provides:

✅ Automatic detection of rate limits
✅ Exponential backoff for retries
✅ Graceful error handling
✅ Randomized delays to mimic human behavior
✅ Detailed logging for monitoring

Following the best practices in this document will help maintain reliable access to Twitter data while respecting their rate limit policies.

## Support

For questions or issues with rate limiting:

1. Check the logs for detailed error messages
2. Review the `scraperRun` table in your database
3. Refer to Twitter's official rate limit documentation
4. Contact the development team for assistance
