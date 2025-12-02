// entrypoints/content/utils/highlighter.ts

// Define the shape of our highlighter function
export type HighlighterFn = (text: string) => string;

/**
 * Factory function: Creates a specialized highlighting function
 * for a specific list of words and color.
 *
 * Performance Note: We compile the RegExp ONCE here, not every frame.
 */
export function createHighlighter(
  words: string[],
  color: string
): HighlighterFn {
  if (!words || words.length === 0) {
    return (text) => text; // No-op if list is empty
  }

  // 1. Escape special regex characters (like ., *, ?) to prevent errors
  const escapedWords = words.map((w) =>
    w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );

  // 2. Create the pattern: \b(word1|word2|word3)\b
  // \b ensures we match "run" but not "running"
  const pattern = `\\b(${escapedWords.join("|")})\\b`;
  const regex = new RegExp(pattern, "gi");

  // 3. Return the transformation function
  return (text: string) => {
    return text.replace(
      regex,
      `<span style="color: ${color}; font-weight: bold;">$1</span>`
    );
  };
}
