/**
 * Indonesian Stemmer
 * Basic implementation for Indonesian language morphology
 * Based on user-provided implementation
 */

export class IndonesianStemmer {
  private readonly prefixes = [
    'di', 'ke', 'me', 'mem', 'men', 'meng', 'meny', 'pe', 'pem', 'pen',
    'peng', 'peny', 'per', 'ber', 'ter', 'se'
  ];
  private readonly suffixes = ['kan', 'an', 'i', 'nya', 'ku', 'mu'];

  stem(word: string): string {
    let stemmed = word.toLowerCase();

    // Remove suffixes first
    for (const suffix of this.suffixes) {
      if (stemmed.endsWith(suffix) && stemmed.length > suffix.length + 3) {
        stemmed = stemmed.slice(0, -suffix.length);
        break;
      }
    }

    // Remove prefixes
    for (const prefix of this.prefixes) {
      if (stemmed.startsWith(prefix) && stemmed.length > prefix.length + 3) {
        stemmed = stemmed.slice(prefix.length);
        break;
      }
    }

    return stemmed;
  }

  stemBatch(words: string[]): string[] {
    return words.map(word => this.stem(word));
  }
}

export const indonesianStemmer = new IndonesianStemmer();
