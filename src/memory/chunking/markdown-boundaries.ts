/**
 * Utilities for detecting markdown structure and finding natural split points.
 *
 * These helpers identify safe places to split markdown content while
 * preserving semantic structure.
 */

/**
 * Check if a line is a markdown heading.
 */
export function isHeading(line: string): boolean {
  const trimmed = line.trimStart();
  return /^#{1,6}\s/.test(trimmed);
}

/**
 * Check if a line starts or ends a code block fence.
 */
export function isCodeBlockFence(line: string): boolean {
  const trimmed = line.trim();
  return /^```/.test(trimmed);
}

/**
 * Check if a line is a list item.
 */
export function isListItem(line: string): boolean {
  const trimmed = line.trimStart();
  return /^[-*+]\s|^\d+\.\s/.test(trimmed);
}

/**
 * Check if a line is a blockquote.
 */
export function isBlockquote(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith(">");
}

/**
 * Check if a line is empty (whitespace only).
 */
export function isEmptyLine(line: string): boolean {
  return line.trim().length === 0;
}

/**
 * Check if a line is a thematic break (horizontal rule).
 */
export function isThematicBreak(line: string): boolean {
  const trimmed = line.trim();
  return /^[-*_]{3,}\s*$/.test(trimmed);
}

/**
 * Determine if a line is a structural boundary (good place to split).
 */
export function isStructuralBoundary(line: string): boolean {
  return (
    isEmptyLine(line) ||
    isHeading(line) ||
    isThematicBreak(line)
  );
}

/**
 * Find a safe split point within a long line.
 *
 * Looks for natural boundaries like spaces, punctuation, etc.
 * Returns the index where splitting should occur.
 *
 * @param line - The line to split
 * @param maxLength - Maximum length for the split
 * @returns Index to split at, or -1 if no good split found
 */
export function findSafeSplitPoint(line: string, maxLength: number): number {
  if (line.length <= maxLength) {
    return line.length;
  }

  // Search backwards from maxLength for a good split point
  const searchEnd = Math.min(maxLength, line.length);

  // Priority 1: Space followed by non-space (word boundary)
  for (let i = searchEnd; i > 0; i--) {
    if (line[i - 1] === " " && line[i] !== " ") {
      return i - 1;
    }
  }

  // Priority 2: Common punctuation that can end a segment
  const punctuation = [".", ",", ";", ":", "!", "?", ")", "]", "}"];
  for (const punct of punctuation) {
    for (let i = searchEnd; i > 0; i--) {
      if (line[i - 1] === punct) {
        // Make sure it's not part of something like "..." or "::"
        if (i < line.length && line[i] !== punct) {
          return i;
        }
      }
    }
  }

  // Priority 3: Any whitespace character
  for (let i = searchEnd; i > 0; i--) {
    if (/\s/.test(line[i - 1]) && !/\s/.test(line[i])) {
      return i - 1;
    }
  }

  // Fallback: hard split at maxLength
  return maxLength;
}

/**
 * Split a long line at safe points.
 *
 * @param line - The line to split
 * @param maxLength - Maximum length per segment
 * @returns Array of line segments
 */
export function splitLongLine(line: string, maxLength: number): string[] {
  if (line.length <= maxLength) {
    return [line];
  }

  const segments: string[] = [];
  let remaining = line;

  while (remaining.length > maxLength) {
    const splitPoint = findSafeSplitPoint(remaining, maxLength);

    if (splitPoint <= 0) {
      // Can't find a good split, force it
      segments.push(remaining.slice(0, maxLength));
      remaining = remaining.slice(maxLength);
    } else {
      segments.push(remaining.slice(0, splitPoint).trimEnd());
      remaining = remaining.slice(splitPoint).trimStart();
    }
  }

  if (remaining.length > 0) {
    segments.push(remaining);
  }

  return segments;
}

/**
 * Analyze a line to determine its role in document structure.
 */
export type LineRole =
  | "empty"
  | "heading"
  | "code_fence"
  | "list_item"
  | "blockquote"
  | "thematic_break"
  | "content";

/**
 * Get the structural role of a line.
 */
export function getLineRole(line: string): LineRole {
  if (isEmptyLine(line)) return "empty";
  if (isHeading(line)) return "heading";
  if (isCodeBlockFence(line)) return "code_fence";
  if (isListItem(line)) return "list_item";
  if (isBlockquote(line)) return "blockquote";
  if (isThematicBreak(line)) return "thematic_break";
  return "content";
}
