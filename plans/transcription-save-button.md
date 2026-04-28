# Transcription Save Button Implementation Plan

## Overview
Add a save button to the TranscriptPanel component that saves the transcription content to a markdown file, formatted with a date/time header.

## Current State Analysis

### Existing Save Functionality
- **OutputPanel** ([`src/components/OutputPanel.tsx:183-190`](src/components/OutputPanel.tsx:183-190)) has a save button for translation and summary
- Uses `onSave` callback prop: `onSave(currentContent, filename)`
- Filenames: `translation.md` or `summary.md`
- **saveToFile** utility ([`src/utils/text.ts:48-66`](src/utils/text.ts:48-66)) handles browser download

### TranscriptPanel Current State
- Located at [`src/components/TranscriptPanel.tsx`](src/components/TranscriptPanel.tsx)
- Receives `transcriptMessages: TranscriptMessage[]` and `isTranscribing: boolean`
- No save functionality currently exists

## Implementation Plan

### Step 1: Add formatTranscriptForSave Utility Function
**File:** [`src/utils/text.ts`](src/utils/text.ts)

Add a new function to format transcript messages with timestamp prefix on each line:

```typescript
/**
 * Format transcript messages for saving to markdown file
 * Each line prefixed with date/time from the message timestamp
 */
export function formatTranscriptForSave(
  messages: Array<{ text: string; timestamp: Date }>
): string {
  if (messages.length === 0) return '';
  
  // Format each message with its own timestamp prefix
  const lines = messages.map(m => {
    const dateStr = m.timestamp.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = m.timestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateStr} ${timeStr} ${m.text}`;
  });
  
  return lines.join('\n');
}
```

### Step 2: Update TranscriptPanel Component
**File:** [`src/components/TranscriptPanel.tsx`](src/components/TranscriptPanel.tsx)

Changes needed:
1. Add `onSave` callback prop to interface
2. Add save button in the header section (similar to OutputPanel)
3. Disable button when no transcript content exists

```typescript
interface TranscriptPanelProps {
  readonly transcriptMessages: TranscriptMessage[];
  readonly isTranscribing: boolean;
  readonly onSave: () => void;  // New prop
}
```

UI addition in the header area:
```tsx
<button
  onClick={onSave}
  disabled={transcriptMessages.length === 0}
  className="rounded-lg border border-[#d7c7a7] bg-white/70 px-2 py-1 text-xs font-medium text-[#6b5a3f] transition hover:bg-[#efe0c3] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#cdbda6] dark:hover:bg-[#2a2218]"
  title="Save transcript to file"
>
  💾 Save
</button>
```

### Step 3: Update Main Page Component
**File:** [`src/app/page.tsx`](src/app/page.tsx)

Changes needed:
1. Import `formatTranscriptForSave` from text utils
2. Create `handleTranscriptSave` callback function
3. Pass `onSave` prop to TranscriptPanel

```typescript
import { saveToFile, formatTranscriptForSave } from '@/utils/text';

// Add handler
const handleTranscriptSave = useCallback(() => {
  const content = formatTranscriptForSave(transcriptMessages);
  saveToFile(content, 'transcript.md');
}, [transcriptMessages]);

// Update TranscriptPanel usage
<TranscriptPanel
  transcriptMessages={transcriptMessages}
  isTranscribing={isTranscribing}
  onSave={handleTranscriptSave}
/>
```

## File Changes Summary

| File | Change |
|------|--------|
| [`src/utils/text.ts`](src/utils/text.ts) | Add `formatTranscriptForSave` function |
| [`src/components/TranscriptPanel.tsx`](src/components/TranscriptPanel.tsx) | Add `onSave` prop and save button |
| [`src/app/page.tsx`](src/app/page.tsx) | Add `handleTranscriptSave` handler and pass to TranscriptPanel |

## Output Format Example

When saved, the `transcript.md` file will contain:

```markdown
February 19, 2026 9:01 AM First transcript message text here.
February 19, 2026 9:02 AM Second transcript message text here.
February 19, 2026 9:03 AM Third transcript message text here.
```

## Notes
- The date/time uses the user's local timezone (via `toLocaleDateString` and `toLocaleTimeString`)
- Messages are joined with double newlines for readability
- The save button is disabled when there are no transcript messages
- Filename follows the same pattern as translation/summary: `transcript.md`