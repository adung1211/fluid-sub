// entrypoints/content/utils/highlighter.ts

export type HighlighterFn = (text: string) => string;

export interface HighlightConfig {
  words: string[];
  color: string;
}

/**
 * Creates a single highlighter function that handles multiple word groups/colors at once.
 * This prevents the issue where highlighting "span" breaks previously inserted HTML tags.
 */
export function createUnifiedHighlighter(
  configs: HighlightConfig[]
): HighlighterFn {
  const colorMap = new Map<string, string>();
  const allWords = new Set<string>();

  // 1. Build a master map of word -> color
  // We use lowercase keys for case-insensitive lookup
  configs.forEach((config) => {
    if (!config.words || config.words.length === 0) return;
    config.words.forEach((word) => {
      if (word) {
        colorMap.set(word.toLowerCase(), config.color);
        allWords.add(word);
      }
    });
  });

  if (allWords.size === 0) {
    return (text) => text;
  }

  // 2. Sort words by length (descending) to ensure longest match wins if overlaps exist
  const sortedWords = Array.from(allWords).sort((a, b) => b.length - a.length);

  // 3. Escape special regex characters
  const escapedWords = sortedWords.map((w) =>
    w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );

  // 4. Create one master pattern: \b(word1|word2|...)\b
  const pattern = `\\b(${escapedWords.join("|")})\\b`;
  const regex = new RegExp(pattern, "gi");

  // 5. Return the transformation function
  return (text: string) => {
    // Replace all matches in one pass
    return text.replace(regex, (match) => {
      // Look up color using lowercase match
      const color = colorMap.get(match.toLowerCase());
      if (color) {
        return `<span style="color: ${color}; font-weight: bold;">${match}</span>`;
      }
      return match;
    });
  };
}
