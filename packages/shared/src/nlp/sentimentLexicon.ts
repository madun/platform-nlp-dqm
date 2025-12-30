/**
 * Sentiment Lexicon for Nutrition/Food Security Context
 * Based on user-provided 187-word lexicon with categorized sentiment
 */

export interface SentimentLexicon {
  positive: string[];
  negative: string[];
}

/**
 * Positive sentiment words
 * General positive + nutrition-specific positive
 */
export const positiveSentimentWords: Set<string> = new Set([
  // General positive (from user's lexicon)
  'baik', 'bagus', 'sangat bagus', 'cukup baik', 'memuaskan', 'mantap',
  'hebat', 'oke', 'puas', 'senang', 'terbantu', 'bermanfaat', 'sesuai',
  'tepat sasaran', 'mudah', 'jelas', 'lengkap', 'cepat', 'terjangkau',
  'murah', 'mahal tapi sepadan', 'ramah', 'responsif', 'tersedia',
  'cukup tersedia', 'melimpah', 'stabil', 'aman', 'sehat', 'bergizi',
  'nutritif', 'berkualitas', 'segar', 'enak', 'layak', 'memadai',
  'terpenuhi', 'tercukupi', 'kecukupan gizi', 'gizi tercukupi',
  'makan teratur', 'porsi cukup', 'menu bervariasi', 'protein cukup',
  'sayur cukup', 'buah cukup', 'asi lancar', 'mpasi baik',
  'posyandu membantu', 'pelayanan baik', 'bantuan tepat waktu',
  'bantuan bermanfaat', 'bansos membantu', 'harga stabil',
  'harga terjangkau', 'akses mudah', 'pasokan lancar', 'stok ada',
  'tidak kelaparan', 'tidak kekurangan', 'tidak khawatir', 'optimis',
  'terjamin', 'cukup', 'pas', 'lumayan',

  // Additional positive words for context
  'sukses', 'berhasil', 'maju', 'positif', 'membaik', 'tumbuh',
  'sembuh', 'pulih', 'optimal', 'meningkat', 'berkembang', 'normal',
  'ideal', 'kuat', 'aktif', 'kuat', 'berprestasi'
]);

/**
 * Negative sentiment words
 * General negative + nutrition-specific negative
 */
export const negativeSentimentWords: Set<string> = new Set([
  // General negative (from user's lexicon)
  'biasa saja', 'standar', 'netral', 'tidak masalah', 'tidak terlalu',
  'kurang', 'kurang baik', 'tidak baik', 'buruk', 'sangat buruk',
  'mengecewakan', 'kecewa', 'sedih', 'khawatir', 'cemas', 'stress',
  'tertekan', 'lelah', 'lapar', 'kelaparan', 'kekurangan',
  'kekurangan gizi', 'gizi kurang', 'gizi buruk', 'stunting', 'kurus',
  'wasting', 'anemia', 'kurang darah', 'bb kurang', 'berat badan turun',
  'nafsu makan turun', 'sakit-sakitan', 'makanan tidak sehat',
  'junk food', 'makanan instan', 'tidak segar', 'basi', 'tidak enak',
  'hambar', 'porsi kurang', 'porsi kecil', 'menu tidak bervariasi',
  'jarang makan', 'tidak makan', 'terlambat makan', 'susah makan',
  'sulit makan', 'anak susah makan', 'tidak ada uang', 'tidak mampu',
  'penghasilan turun', 'pengangguran', 'utang', 'mahal', 'sangat mahal',
  'harga naik', 'inflasi', 'biaya tinggi', 'akses sulit', 'jauh',
  'transport mahal', 'pasar jauh', 'tidak tersedia', 'stok habis',
  'kosong', 'langka', 'pasokan terganggu', 'distribusi lambat', 'antri',
  'pelayanan buruk', 'tidak ramah', 'lambat', 'rumit', 'berbelit',
  'tidak jelas', 'membingungkan', 'data tidak akurat', 'data salah',
  'tidak valid', 'bias', 'tidak konsisten', 'duplikat', 'kosong',
  'tidak lengkap', 'tidak sesuai', 'tidak tepat', 'tidak tepat sasaran',
  'bantuan tidak tepat sasaran', 'bantuan terlambat', 'bantuan kurang',
  'bansos tidak ada', 'korupsi', 'pungli', 'curang', 'tidak dipercaya',
  'hoaks', 'informasi salah', 'minim informasi', 'rentan', 'rawan pangan',
  'tidak tahan pangan', 'krisis pangan', 'darurat pangan', 'banjir',
  'kekeringan', 'gagal panen', 'cuaca buruk', 'panen buruk', 'hama',
  'harga pupuk naik', 'harga pakan naik', 'hasil turun',
  'pendapatan petani turun', 'pasar sepi', 'daya beli turun',

  // Additional negative words for context
  'gagal', 'menurun', 'turun', 'krisis', 'parah', 'darurat', 'lemah',
  'sakit', 'penyakit', 'masalah', 'kendala', 'minim', 'rendah'
]);

/**
 * Nutrition-specific keywords for context extraction
 */
export const nutritionKeywords: Set<string> = new Set([
  // Core nutrition terms
  'gizi', 'nutrisi', 'makan', 'makanan', 'minum', 'minuman', 'diet',
  'protein', 'karbohidrat', 'lemak', 'vitamin', 'mineral', 'serat',
  'sayur', 'buah', 'nasi', 'lauk', 'lauk pauk',

  // Health indicators
  'stunting', 'malnutrisi', 'buruk', 'sehat', 'sakit', 'imun',
  'daya tahan', 'tumbuh', 'kembang', 'anak', 'balita', 'ibu',
  'hamil', 'menyusui', 'asi', 'mpasi',

  // Policy/program terms
  'mbg', 'makan siang gratis', 'makan bergizi gratis', 'program',
  'kebijakan', 'pemerintah', 'subsidi', 'bantuan', 'bansos', 'pangan',
  'ketahanan pangan', 'kedaulatan pangan', 'swasembada',

  // Related concepts
  'lapar', 'kenyang', 'sekolah', 'kantin', 'kantin sehat',
  'kualitas', 'kuantitas', 'cukup', 'kurang', 'lebih', 'imbang',
  'posyandu', 'kader', 'balita', 'anak usia dini'
]);

/**
 * Program-specific keywords
 */
export const programKeywords: Set<string> = new Set([
  'mbg', 'makan siang gratis', 'makan bergizi gratis',
  'bansos', 'bantuan sosial', 'pkh', 'program keluarga harapan',
  'bantuan pangan', 'kartu sembako'
]);

/**
 * Main sentiment lexicon export
 */
export const sentimentLexicon: SentimentLexicon = {
  positive: Array.from(positiveSentimentWords),
  negative: Array.from(negativeSentimentWords)
};

/**
 * Get sentiment score for a word
 * Returns positive score for positive words, negative score for negative words
 * Returns 0 if word is not in lexicon
 */
export function getSentimentScore(word: string): number {
  const lowerWord = word.toLowerCase().trim();

  if (positiveSentimentWords.has(lowerWord)) {
    return 1;
  }
  if (negativeSentimentWords.has(lowerWord)) {
    return -1;
  }

  // Check for multi-word phrases
  for (const phrase of positiveSentimentWords) {
    if (phrase.includes(' ') && lowerWord.includes(phrase)) {
      return 1;
    }
  }
  for (const phrase of negativeSentimentWords) {
    if (phrase.includes(' ') && lowerWord.includes(phrase)) {
      return -1;
    }
  }

  return 0;
}

/**
 * Check if a word is sentiment-bearing
 */
export function isSentimentWord(word: string): boolean {
  return getSentimentScore(word) !== 0;
}

/**
 * Check if text contains nutrition-related terms
 */
export function hasNutritionContext(text: string): boolean {
  const lowerText = text.toLowerCase();
  for (const keyword of nutritionKeywords) {
    if (lowerText.includes(keyword)) {
      return true;
    }
  }
  return false;
}

/**
 * Extract nutrition keywords from text
 */
export function extractNutritionKeywords(text: string): string[] {
  const found: string[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of nutritionKeywords) {
    if (lowerText.includes(keyword)) {
      found.push(keyword);
    }
  }

  return found;
}

/**
 * Extract program mentions from text
 */
export function extractProgramMentions(text: string): string[] {
  const found: string[] = [];
  const lowerText = text.toLowerCase();

  for (const program of programKeywords) {
    if (lowerText.includes(program)) {
      found.push(program);
    }
  }

  return found;
}
