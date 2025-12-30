/**
 * Prisma Seed
 * Populate database with initial data
 */

import { PrismaClient } from '@prisma/client';
import { searchKeywords } from '@memphis/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Seed search keywords
  console.log('Seeding search keywords...');
  for (const keyword of searchKeywords) {
    await prisma.searchKeyword.upsert({
      where: { keyword },
      update: {},
      create: {
        keyword,
        category: getCategoryForKeyword(keyword),
        priority: 10,
        isActive: true,
      },
    });
  }

  // Seed DQM rules
  console.log('Seeding DQM rules...');
  const dqmRules = [
    {
      ruleName: 'min_content_length',
      ruleType: 'validation',
      ruleConfig: { min_length: 20, max_length: 500 },
      priority: 10,
      description: 'Validate tweet content length',
    },
    {
      ruleName: 'language_check',
      ruleType: 'validation',
      ruleConfig: { allowed_languages: ['id', 'en'], min_confidence: 0.7 },
      priority: 9,
      description: 'Check if tweet is in Indonesian',
    },
    {
      ruleName: 'remove_urls',
      ruleType: 'cleaning',
      ruleConfig: { preserve_in_separate_field: true },
      priority: 5,
      description: 'Remove URLs from tweet text',
    },
    {
      ruleName: 'normalize_whitespace',
      ruleType: 'cleaning',
      ruleConfig: {},
      priority: 1,
      description: 'Normalize whitespace in tweet text',
    },
    {
      ruleName: 'remove_duplicate_content',
      ruleType: 'validation',
      ruleConfig: { similarity_threshold: 0.85, days: 7 },
      priority: 8,
      description: 'Detect and remove duplicate tweets',
    },
    {
      ruleName: 'spam_detection',
      ruleType: 'validation',
      ruleConfig: { max_hashtags: 10, max_urls: 5, max_mentions: 3 },
      priority: 7,
      description: 'Detect spam and bot accounts',
    },
  ];

  for (const rule of dqmRules) {
    await prisma.dqmRule.upsert({
      where: { ruleName: rule.ruleName },
      update: {},
      create: rule,
    });
  }

  console.log('Seed completed successfully!');
}

function getCategoryForKeyword(keyword: string): string {
  const lower = keyword.toLowerCase();

  if (lower.includes('mbg') || lower.includes('makan siang') || lower.includes('makan bergizi')) {
    return 'MBG';
  }
  if (lower.includes('stunting')) {
    return 'STUNTING';
  }
  if (lower.includes('malnutrisi') || lower.includes('gizi buruk')) {
    return 'MALNUTRISI';
  }
  if (lower.includes('pangan')) {
    return 'KETAHANAN_PANGAN';
  }
  if (lower.includes('gizi')) {
    return 'GIZI';
  }

  return 'GENERAL';
}

main()
  .catch((e) => {
    console.error('Error in seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
