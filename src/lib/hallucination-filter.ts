// ---------------------------------------------------------------------------
// Hallucination detection for Whisper transcription output
// ---------------------------------------------------------------------------
// Whisper on silence/noise produces repetitive garbage like
// "press again, press again, press again". This module detects when
// a transcript is likely a hallucination by checking for repetitive patterns.
// ---------------------------------------------------------------------------

/**
 * Check if a transcript is likely a Whisper hallucination.
 *
 * Detects:
 * 1. Consecutive phrase repeats (3+ identical segments separated by punctuation)
 * 2. Word-level phrase repetition (same 2+ word phrase dominating 75%+ of text)
 *
 * @param text - The transcript text to check
 * @returns true if the text appears to be a hallucination
 */
export function isHallucination(text: string): boolean {
  const normalized = text
    .replace(/[.!?,…;:–—]+$/g, '') // Strip trailing punctuation
    .trim()
    .toLowerCase();
  if (!normalized) return false;

  // Try splitting on common delimiters (commas, periods, exclamation, newlines)
  const segments = normalized
    .split(/[,.!?:;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // If we have 3+ segments, check if any phrase repeats 3+ times consecutively
  if (segments.length >= 3) {
    for (let i = 0; i <= segments.length - 3; i++) {
      if (segments[i] === segments[i + 1] && segments[i] === segments[i + 2]) {
        return true;
      }
    }
  }

  // Also check if the entire normalized text is a repetition of a short phrase
  // e.g. "press again press again press again" (no delimiter between repeats)
  if (normalized.length >= 6) {
    const words = normalized.split(/\s+/);
    for (let phraseLen = 2; phraseLen <= Math.floor(words.length / 3); phraseLen++) {
      const phrase = words.slice(0, phraseLen).join(' ');
      let count = 0;
      for (let i = 0; i <= words.length - phraseLen; i += phraseLen) {
        if (words.slice(i, i + phraseLen).join(' ') === phrase) {
          count++;
        }
      }
      // If the same phrase appears 3+ times and dominates the text
      if (count >= 3 && (count * phraseLen) >= words.length * 0.75) {
        return true;
      }
    }
  }

  return false;
}