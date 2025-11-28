export interface Subtitle {
  start: number;
  end: number;
  text: string;
}

export function parseVTT(vttString: string): Subtitle[] {
  const lines = vttString.split("\n");
  const result: Subtitle[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.includes("-->")) {
      const parts = line.split("-->");

      // 1. Safe Timestamp Parsing
      const startStr = parts[0].trim().split(" ")[0];
      const endStr = parts[1].trim().split(" ")[0];

      const start = parseTime(startStr);
      const end = parseTime(endStr);

      // 2. Extract Text
      let text = "";
      i++;
      while (i < lines.length && lines[i].trim() !== "") {
        text += lines[i].trim() + " ";
        i++;
      }

      // 3. Clean Text
      // Remove tags AND specifically the "[Music]" or "[Applause]" markers
      text = text
        .replace(/<[^>]*>/g, "")
        .replace(/\[.*?\]/g, "") // Removes [Music], [Applause]
        .replace(/\s+/g, " ")
        .trim();

      if (text) {
        const validEnd = end > start ? end : start + 4;
        result.push({ start, end: validEnd, text });
      }
    } else {
      i++;
    }
  }

  return cleanupOverlaps(result);
}

// --- IMPROVED DEDUPLICATION ---
function cleanupOverlaps(subs: Subtitle[]): Subtitle[] {
  if (subs.length < 2) return subs;

  const cleaned: Subtitle[] = [subs[0]];

  for (let i = 1; i < subs.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    let curr = subs[i];

    // 1. If text is identical, just extend the previous time
    if (prev.text === curr.text) {
      prev.end = Math.max(prev.end, curr.end);
      continue;
    }

    // 2. Remove overlapping start
    const newText = removeDuplicateStart(prev.text, curr.text);

    if (newText.length > 0) {
      // Update current text to be just the "new" part
      curr.text = newText;

      // Adjust start time to prevent visual overlap
      // (The new words technically start later than the full line)
      // This is an estimation: we shift start time forward slightly
      if (curr.start < prev.end) {
        curr.start = prev.end;
      }

      cleaned.push(curr);
    } else {
      // If current became empty, it was fully contained in previous
      prev.end = Math.max(prev.end, curr.end);
    }
  }
  return cleaned;
}

function removeDuplicateStart(prevText: string, currText: string): string {
  const prevWords = prevText.split(" ");
  const currWords = currText.split(" ");

  // Try to find the biggest overlap
  // Example:
  // Prev: "hello world how"
  // Curr: "world how are you"
  // Overlap: "world how" (Length 2)

  let bestOverlap = 0;

  // Look at the last N words of Previous
  const maxCheck = Math.min(prevWords.length, currWords.length);

  for (let i = 1; i <= maxCheck; i++) {
    // Last 'i' words of prev
    const suffix = prevWords
      .slice(-i)
      .join(" ")
      .toLowerCase()
      .replace(/[.,?!]/g, "");
    // First 'i' words of curr
    const prefix = currWords
      .slice(0, i)
      .join(" ")
      .toLowerCase()
      .replace(/[.,?!]/g, "");

    if (suffix === prefix) {
      bestOverlap = i;
    }
  }

  if (bestOverlap > 0) {
    return currWords.slice(bestOverlap).join(" ");
  }

  return currText;
}

function parseTime(timeStr: string): number {
  const parts = timeStr.split(":");
  let seconds = 0;
  if (parts.length === 3) {
    seconds += parseFloat(parts[0]) * 3600;
    seconds += parseFloat(parts[1]) * 60;
    seconds += parseFloat(parts[2]);
  } else if (parts.length === 2) {
    seconds += parseFloat(parts[0]) * 60;
    seconds += parseFloat(parts[1]);
  }
  return seconds;
}
